use std::collections::HashSet;

use tauri::{AppHandle, Manager, State};

use crate::error::{AppError, AppResult};
use crate::logger;
use crate::models::{
    ArrangeFlow, ArrangeOrder, ArrangeProfileWindowsRequest, ArrangementSnapshotItem,
    BatchProfileActionItem, BatchProfileActionResponse, BatchSetWindowBoundsRequest,
    BatchWindowActionRequest, BroadcastSyncTextRequest, ChromeDecorationCompensation,
    DisplayMonitorItem, EdgeInsets, EnsureSyncSidecarStartedResponse, LastRowAlign,
    ListSyncTargetsResponse, MainPosition, ProfileWindowState, SyncTargetItem, WindowArrangeMode,
    WindowBounds,
};
use crate::runtime_guard;
use crate::services::display_monitor_service;
use crate::state::AppState;

#[tauri::command]
pub fn ensure_sync_sidecar_started(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<EnsureSyncSidecarStartedResponse, String> {
    ensure_sync_sidecar_started_inner(Some(&app), &state).map_err(error_to_string)
}

fn ensure_sync_sidecar_started_inner(
    app: Option<&AppHandle>,
    state: &AppState,
) -> AppResult<EnsureSyncSidecarStartedResponse> {
    let mut service = state.lock_sync_manager_service();
    service.ensure_started(app)
}

#[tauri::command]
pub async fn list_sync_targets(app: AppHandle) -> Result<ListSyncTargetsResponse, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let state = app.state::<AppState>();
        list_sync_targets_inner(&state)
    })
    .await
    .map_err(|err| format!("list sync targets task join failed: {err}"))?
}

fn list_sync_targets_inner(state: &AppState) -> Result<ListSyncTargetsResponse, String> {
    if let Err(err) = runtime_guard::reconcile_runtime_state(state) {
        logger::warn(
            "sync_cmd",
            format!("list_sync_targets reconcile failed: {err}"),
        );
    }
    let states = collect_window_states(state)?;
    let profile_service = state.lock_profile_service();
    let engine_manager = state.lock_engine_manager();

    let items = states
        .into_iter()
        .map(|state_item| {
            let label = profile_service
                .get_profile(&state_item.profile_id)
                .map(|profile| profile.name)
                .unwrap_or_else(|_| state_item.profile_id.clone());
            let magic_socket_server_port = engine_manager
                .get_runtime_handle(&state_item.profile_id)
                .ok()
                .and_then(|handle| handle.magic_port);
            let adapter_port = magic_socket_server_port.and_then(|port| {
                Some(state.lock_chromium_magic_adapter_service()).and_then(|mut service| {
                    service
                        .ensure_adapter(&state_item.profile_id, "127.0.0.1", port)
                        .ok()
                })
            });
            SyncTargetItem {
                profile_id: state_item.profile_id,
                label,
                host: "127.0.0.1".to_string(),
                magic_socket_server_port: adapter_port,
                session_id: state_item.session_id,
                pid: state_item.pid,
                total_windows: state_item.total_windows,
                total_tabs: state_item.total_tabs,
                windows: state_item.windows,
            }
        })
        .collect::<Vec<_>>();

    Ok(ListSyncTargetsResponse { items })
}

#[tauri::command]
pub fn broadcast_sync_text(
    state: State<'_, AppState>,
    payload: BroadcastSyncTextRequest,
) -> Result<BatchProfileActionResponse, String> {
    let text = payload.text.trim().to_string();
    if text.is_empty() {
        return Err("请输入要同步的文本".to_string());
    }
    let profile_ids = normalize_profile_ids(payload.profile_ids);
    if profile_ids.is_empty() {
        return Err("请选择至少一个从控环境".to_string());
    }

    run_batch_engine_action(
        "broadcast_sync_text",
        state,
        profile_ids,
        |engine_manager, profile_id| engine_manager.type_string(profile_id, text.as_str()),
    )
}

#[tauri::command]
pub fn list_display_monitors(app: AppHandle) -> Result<Vec<DisplayMonitorItem>, String> {
    display_monitor_service::collect_display_monitors(&app).map_err(error_to_string)
}

#[tauri::command]
pub fn batch_restore_profile_windows(
    state: State<'_, AppState>,
    payload: BatchWindowActionRequest,
) -> Result<BatchProfileActionResponse, String> {
    run_batch_engine_action(
        "batch_restore_profile_windows",
        state,
        payload.profile_ids,
        |engine_manager, profile_id| engine_manager.restore_window(profile_id, None),
    )
}

#[tauri::command]
pub fn batch_set_profile_window_bounds(
    state: State<'_, AppState>,
    payload: BatchSetWindowBoundsRequest,
) -> Result<BatchProfileActionResponse, String> {
    run_batch_engine_action(
        "batch_set_profile_window_bounds",
        state,
        payload.profile_ids,
        |engine_manager, profile_id| {
            engine_manager.set_window_bounds(profile_id, payload.bounds.clone(), None)
        },
    )
}

#[tauri::command]
pub fn arrange_profile_windows(
    app: AppHandle,
    state: State<'_, AppState>,
    payload: ArrangeProfileWindowsRequest,
) -> Result<BatchProfileActionResponse, String> {
    // 向后兼容：旧 gap 字段 → gap_x / gap_y
    let gap_x = payload.gap_x.or(payload.gap).unwrap_or(16).max(0);
    let gap_y = payload.gap_y.or(payload.gap).unwrap_or(16).max(0);

    let monitors =
        display_monitor_service::collect_display_monitors(&app).map_err(error_to_string)?;
    let monitor = monitors
        .into_iter()
        .find(|item| item.id == payload.monitor_id)
        .ok_or_else(|| "目标显示器不存在".to_string())?;

    // work_area 来自 Tauri，是物理像素坐标。Chromium Magic set_bounds 期望 DIP（逻辑像素）坐标。
    // 除以 scale_factor 将物理像素转换为 DIP，使窗口落到正确屏幕的正确位置。
    let scale = monitor.scale_factor.max(1.0);
    let dip_work_area = WindowBounds {
        x: (monitor.work_area.x as f64 / scale).round() as i32,
        y: (monitor.work_area.y as f64 / scale).round() as i32,
        width: (monitor.work_area.width as f64 / scale).round() as i32,
        height: (monitor.work_area.height as f64 / scale).round() as i32,
    };

    logger::info(
        "sync_cmd",
        format!(
            "arrange_profile_windows scale={scale} work_area={}x{}@({},{}) dip={}x{}@({},{})",
            monitor.work_area.width,
            monitor.work_area.height,
            monitor.work_area.x,
            monitor.work_area.y,
            dip_work_area.width,
            dip_work_area.height,
            dip_work_area.x,
            dip_work_area.y,
        ),
    );

    let profile_ids = normalize_profile_ids(payload.profile_ids.clone());
    let n = profile_ids.len();
    if n == 0 {
        return Ok(BatchProfileActionResponse {
            total: 0,
            success_count: 0,
            failed_count: 0,
            items: Vec::new(),
        });
    }

    // 根据 order 字段对 profile_ids 重排
    let profile_ids = match payload.order {
        ArrangeOrder::Name => {
            let mut ids = profile_ids;
            ids.sort();
            ids
        }
        ArrangeOrder::Selection => profile_ids,
    };

    logger::info(
        "sync_cmd",
        format!(
            "arrange_profile_windows profile_count={} monitor_id={} mode={:?}",
            n, monitor.id, payload.mode
        ),
    );

    let mut engine_manager = state
        .engine_manager
        .lock()
        .map_err(|_| "engine manager lock poisoned".to_string())?;

    // 在排布前先 snapshot 当前 bounds，供"撤销上次"使用
    let mut snapshot: Vec<ArrangementSnapshotItem> = Vec::with_capacity(n);
    for profile_id in &profile_ids {
        if let Ok(actual) = engine_manager.magic_get_window_bounds(profile_id) {
            snapshot.push(ArrangementSnapshotItem {
                profile_id: profile_id.clone(),
                bounds: actual,
            });
        }
    }
    if let Ok(mut guard) = state.last_arrangement_snapshot.lock() {
        *guard = snapshot;
    }

    // 计算初始 bounds（delta=0，无装饰补偿），用 DIP 工作区
    let initial_bounds = compute_arranged_bounds(&dip_work_area, &payload, n, gap_x, gap_y, 0, 0)?;

    // 装饰补偿：对第一个 profile 做 pre-set + read-back，推导 delta_h / delta_w
    // get_bounds 返回的是 DIP，和 dip_work_area 单位一致
    let (delta_w, delta_h) = if matches!(
        payload.chrome_decoration_compensation,
        ChromeDecorationCompensation::Auto
    ) {
        let first_id = &profile_ids[0];
        // pre-set 第一个 profile 到初始 bounds
        let _ = engine_manager.set_window_bounds(first_id, initial_bounds[0].clone(), None);
        // read-back 实际 bounds
        match engine_manager.magic_get_window_bounds(first_id) {
            Ok(actual) => {
                let dw = (actual.width - initial_bounds[0].width).max(0);
                let dh = (actual.height - initial_bounds[0].height).max(0);
                logger::info(
                    "sync_cmd",
                    format!("decoration delta: delta_w={dw} delta_h={dh}"),
                );
                (dw, dh)
            }
            Err(_) => (0, 0),
        }
    } else {
        (0, 0)
    };

    // 用 delta 重新计算所有 bounds（补偿后），仍用 DIP 工作区
    let final_bounds =
        compute_arranged_bounds(&dip_work_area, &payload, n, gap_x, gap_y, delta_w, delta_h)?;

    let mut items = Vec::with_capacity(n);
    let mut success_count = 0usize;

    for (index, profile_id) in profile_ids.into_iter().enumerate() {
        let result = (|| -> Result<(), AppError> {
            let bounds = final_bounds
                .get(index)
                .cloned()
                .ok_or_else(|| AppError::Validation("missing arranged bounds".to_string()))?;
            let _ = engine_manager.set_window_bounds(&profile_id, bounds, None)?;
            Ok(())
        })();
        match result {
            Ok(_) => {
                success_count += 1;
                items.push(BatchProfileActionItem {
                    profile_id,
                    ok: true,
                    message: "ok".to_string(),
                });
            }
            Err(err) => {
                items.push(BatchProfileActionItem {
                    profile_id,
                    ok: false,
                    message: err.to_string(),
                });
            }
        }
    }

    let total = items.len();
    Ok(BatchProfileActionResponse {
        total,
        success_count,
        failed_count: total.saturating_sub(success_count),
        items,
    })
}

#[tauri::command]
pub fn restore_last_arrangement(
    state: State<'_, AppState>,
) -> Result<BatchProfileActionResponse, String> {
    let snapshot = state
        .last_arrangement_snapshot
        .lock()
        .map_err(|_| "snapshot lock poisoned".to_string())?
        .clone();

    if snapshot.is_empty() {
        return Err("没有可撤销的排布记录".to_string());
    }

    let mut engine_manager = state
        .engine_manager
        .lock()
        .map_err(|_| "engine manager lock poisoned".to_string())?;

    let mut items = Vec::with_capacity(snapshot.len());
    let mut success_count = 0usize;

    for item in snapshot {
        let result = engine_manager.set_window_bounds(&item.profile_id, item.bounds, None);
        match result {
            Ok(_) => {
                success_count += 1;
                items.push(BatchProfileActionItem {
                    profile_id: item.profile_id,
                    ok: true,
                    message: "ok".to_string(),
                });
            }
            Err(err) => {
                items.push(BatchProfileActionItem {
                    profile_id: item.profile_id,
                    ok: false,
                    message: err.to_string(),
                });
            }
        }
    }

    let total = items.len();
    Ok(BatchProfileActionResponse {
        total,
        success_count,
        failed_count: total.saturating_sub(success_count),
        items,
    })
}

fn collect_window_states(state: &AppState) -> Result<Vec<ProfileWindowState>, String> {
    let mut engine_manager = state
        .engine_manager
        .lock()
        .map_err(|_| "engine manager lock poisoned".to_string())?;
    let mut states = engine_manager.list_window_states();
    drop(engine_manager);

    let existing_ids = states
        .iter()
        .map(|item| item.profile_id.clone())
        .collect::<HashSet<_>>();

    let profile_service = state
        .profile_service
        .lock()
        .map_err(|_| "profile service lock poisoned".to_string())?;
    let engine_session_service = state
        .engine_session_service
        .lock()
        .map_err(|_| "engine session service lock poisoned".to_string())?;
    let running_profile_ids = profile_service
        .list_running_profile_ids()
        .map_err(error_to_string)?;
    for profile_id in running_profile_ids {
        if existing_ids.contains(&profile_id) {
            continue;
        }
        let session = engine_session_service
            .get_session(&profile_id)
            .map_err(error_to_string)?;
        states.push(ProfileWindowState {
            profile_id,
            session_id: session.as_ref().map(|item| item.session_id).unwrap_or(0),
            pid: session.and_then(|item| item.pid),
            total_windows: 0,
            total_tabs: 0,
            windows: Vec::new(),
        });
    }
    states.sort_by(|a, b| a.profile_id.cmp(&b.profile_id));
    Ok(states)
}

// ─── 布局算法 ─────────────────────────────────────────────────────────────────

const MIN_WINDOW_W: i32 = 200;
const MIN_WINDOW_H: i32 = 150;

/// 计算工作矩形（扣除 padding 后的可用区域）
fn compute_work_rect(area: &WindowBounds, padding: &EdgeInsets) -> WindowBounds {
    WindowBounds {
        x: area.x + padding.left,
        y: area.y + padding.top,
        width: (area.width - padding.left - padding.right).max(0),
        height: (area.height - padding.top - padding.bottom).max(0),
    }
}

/// 根据提示（或 auto）推算最佳行列数。
/// auto 时选使单格宽高比最接近 work_area 宽高比的列数，同时惩罚空格。
fn choose_rows_cols(
    n: u32,
    rows_hint: Option<u32>,
    cols_hint: Option<u32>,
    rect: &WindowBounds,
) -> (u32, u32) {
    if n == 0 {
        return (1, 1);
    }
    match (rows_hint, cols_hint) {
        (Some(r), Some(c)) => (r.max(1), c.max(1)),
        (Some(r), None) => {
            let r = r.max(1);
            (r, n.div_ceil(r))
        }
        (None, Some(c)) => {
            let c = c.max(1);
            (n.div_ceil(c), c)
        }
        (None, None) => {
            let area_aspect = if rect.height > 0 {
                rect.width as f64 / rect.height as f64
            } else {
                16.0 / 9.0
            };
            let best_c = (1..=n)
                .min_by(|&a, &b| {
                    let score = |c: u32| -> f64 {
                        let r = n.div_ceil(c);
                        // 单格宽高比 vs 屏幕宽高比（越接近越好）
                        let cell_aspect = (c as f64) / (r as f64) * area_aspect;
                        let aspect_penalty = (cell_aspect / area_aspect - 1.0).abs();
                        // 空格惩罚（尽量少空格）
                        let empty_penalty = (r * c - n) as f64 * 0.05;
                        aspect_penalty + empty_penalty
                    };
                    score(a)
                        .partial_cmp(&score(b))
                        .unwrap_or(std::cmp::Ordering::Equal)
                })
                .unwrap_or(1);
            (n.div_ceil(best_c), best_c)
        }
    }
}

/// 计算最后一行（可能不满）的 x 偏移和宽度
fn apply_last_row_align(
    align: LastRowAlign,
    col: u32,
    items_in_row: u32,
    cell_w: i32,
    gap_x: i32,
    rect_w: i32,
) -> (i32, i32) {
    match align {
        LastRowAlign::Start => (col as i32 * (cell_w + gap_x), cell_w),
        LastRowAlign::Center => {
            let total = items_in_row as i32 * cell_w + (items_in_row as i32 - 1) * gap_x;
            let offset = ((rect_w - total) / 2).max(0);
            (offset + col as i32 * (cell_w + gap_x), cell_w)
        }
        LastRowAlign::Stretch => {
            let new_w = ((rect_w - (items_in_row as i32 - 1) * gap_x) / items_in_row as i32)
                .max(MIN_WINDOW_W);
            (col as i32 * (new_w + gap_x), new_w)
        }
    }
}

/// Grid fill 布局：根据 rows/cols/gap 均分工作矩形，delta 补偿 Chromium 装饰高度
fn build_grid_bounds(
    rect: &WindowBounds,
    n: u32,
    rows: u32,
    cols: u32,
    gap_x: i32,
    gap_y: i32,
    delta_w: i32,
    delta_h: i32,
    last_row_align: LastRowAlign,
    flow: ArrangeFlow,
) -> Result<Vec<WindowBounds>, String> {
    let cell_w = ((rect.width - (cols as i32 - 1) * gap_x) / cols as i32).max(0);
    let cell_h = ((rect.height - (rows as i32 - 1) * gap_y) / rows as i32).max(0);

    // 实际下发给 Magic 的尺寸 = cell - delta
    // 步长也用 target_*，保证视觉间距严格等于 gap（与 delta 无关）
    let target_w = (cell_w - delta_w).max(MIN_WINDOW_W);
    let target_h = (cell_h - delta_h).max(MIN_WINDOW_H);

    if cell_w < MIN_WINDOW_W || cell_h < MIN_WINDOW_H {
        return Err(format!(
            "显示器工作区太小，无法容纳 {rows}×{cols} 的布局（最小单格 {MIN_WINDOW_W}×{MIN_WINDOW_H}px）"
        ));
    }

    let mut out = Vec::with_capacity(n as usize);
    for i in 0..n {
        let (row, col) = match flow {
            ArrangeFlow::RowMajor => (i / cols, i % cols),
            ArrangeFlow::ColMajor => (i % rows, i / rows),
        };
        let is_last_row = row == rows - 1;
        let items_in_row = if is_last_row { n - row * cols } else { cols };

        let (x_off, w_i) = if is_last_row && items_in_row < cols {
            apply_last_row_align(
                last_row_align,
                col,
                items_in_row,
                target_w,
                gap_x,
                rect.width,
            )
        } else {
            (col as i32 * (target_w + gap_x), target_w)
        };

        out.push(WindowBounds {
            x: rect.x + x_off,
            y: rect.y + row as i32 * (target_h + gap_y),
            width: w_i,
            height: target_h,
        });
    }
    Ok(out)
}

/// Cascade 布局：对角线阶梯重叠
fn build_cascade_bounds(
    rect: &WindowBounds,
    n: u32,
    width: i32,
    height: i32,
    step: i32,
) -> Vec<WindowBounds> {
    let step = step.max(8);
    (0..n)
        .map(|i| {
            let offset = i as i32 * step;
            WindowBounds {
                x: rect.x + offset.min(rect.width - width.max(MIN_WINDOW_W)),
                y: rect.y + offset.min(rect.height - height.max(MIN_WINDOW_H)),
                width: width.max(MIN_WINDOW_W),
                height: height.max(MIN_WINDOW_H),
            }
        })
        .collect()
}

/// MainWithSidebar 布局：一个主窗 + N-1 个侧边窗格
fn build_main_sidebar_bounds(
    rect: &WindowBounds,
    n: u32,
    main_ratio: f64,
    main_position: MainPosition,
    gap_x: i32,
    gap_y: i32,
    delta_w: i32,
    delta_h: i32,
) -> Result<Vec<WindowBounds>, String> {
    if n == 0 {
        return Ok(Vec::new());
    }
    if n == 1 {
        return Ok(vec![rect.clone()]);
    }
    let ratio = main_ratio.clamp(0.2, 0.9);
    let sidebars = n - 1;
    let mut out = Vec::with_capacity(n as usize);

    match main_position {
        MainPosition::Left | MainPosition::Right => {
            let main_w = ((rect.width as f64 * ratio) as i32 - gap_x / 2).max(MIN_WINDOW_W);
            let side_w = (rect.width - main_w - gap_x).max(MIN_WINDOW_W);
            let side_h =
                ((rect.height - (sidebars as i32 - 1) * gap_y) / sidebars as i32).max(MIN_WINDOW_H);
            let (main_x, side_x) = if matches!(main_position, MainPosition::Left) {
                (rect.x, rect.x + main_w + gap_x)
            } else {
                (rect.x + side_w + gap_x, rect.x)
            };
            // 主窗
            out.push(WindowBounds {
                x: main_x,
                y: rect.y,
                width: (main_w - delta_w).max(MIN_WINDOW_W),
                height: (rect.height - delta_h).max(MIN_WINDOW_H),
            });
            // 侧边：步长用 target_side_h，保证视觉间距严格等于 gap_y
            let target_side_h = (side_h - delta_h).max(MIN_WINDOW_H);
            let target_side_w = (side_w - delta_w).max(MIN_WINDOW_W);
            for i in 0..sidebars {
                out.push(WindowBounds {
                    x: side_x,
                    y: rect.y + i as i32 * (target_side_h + gap_y),
                    width: target_side_w,
                    height: target_side_h,
                });
            }
        }
        MainPosition::Top | MainPosition::Bottom => {
            let main_h = ((rect.height as f64 * ratio) as i32 - gap_y / 2).max(MIN_WINDOW_H);
            let side_h = (rect.height - main_h - gap_y).max(MIN_WINDOW_H);
            let side_w =
                ((rect.width - (sidebars as i32 - 1) * gap_x) / sidebars as i32).max(MIN_WINDOW_W);
            let (main_y, side_y) = if matches!(main_position, MainPosition::Top) {
                (rect.y, rect.y + main_h + gap_y)
            } else {
                (rect.y + side_h + gap_y, rect.y)
            };
            // 主窗
            out.push(WindowBounds {
                x: rect.x,
                y: main_y,
                width: (rect.width - delta_w).max(MIN_WINDOW_W),
                height: (main_h - delta_h).max(MIN_WINDOW_H),
            });
            // 侧边：步长用 target_side_w，保证视觉间距严格等于 gap_x
            let target_side_w = (side_w - delta_w).max(MIN_WINDOW_W);
            let target_side_h = (side_h - delta_h).max(MIN_WINDOW_H);
            for i in 0..sidebars {
                out.push(WindowBounds {
                    x: rect.x + i as i32 * (target_side_w + gap_x),
                    y: side_y,
                    width: target_side_w,
                    height: target_side_h,
                });
            }
        }
    }
    Ok(out)
}

/// 根据 payload 统一计算所有 profile 的目标 bounds，delta 用于装饰补偿
fn compute_arranged_bounds(
    area: &WindowBounds,
    payload: &ArrangeProfileWindowsRequest,
    n: usize,
    gap_x: i32,
    gap_y: i32,
    delta_w: i32,
    delta_h: i32,
) -> Result<Vec<WindowBounds>, String> {
    let n = n as u32;
    if n == 0 {
        return Ok(Vec::new());
    }
    let rect = compute_work_rect(area, &payload.padding);

    match payload.mode {
        WindowArrangeMode::Grid => {
            let (rows, cols) = choose_rows_cols(n, payload.rows, payload.columns, &rect);
            if rows * cols < n {
                return Err(format!(
                    "行列乘积（{rows}×{cols}={} ）不足以容纳 {n} 个窗口",
                    rows * cols
                ));
            }
            build_grid_bounds(
                &rect,
                n,
                rows,
                cols,
                gap_x,
                gap_y,
                delta_w,
                delta_h,
                payload.last_row_align,
                payload.flow,
            )
        }
        WindowArrangeMode::Cascade => {
            let width = payload.width.unwrap_or(1280).max(MIN_WINDOW_W);
            let height = payload.height.unwrap_or(800).max(MIN_WINDOW_H);
            let step = payload.cascade_step.unwrap_or(32);
            Ok(build_cascade_bounds(&rect, n, width, height, step))
        }
        WindowArrangeMode::MainWithSidebar => {
            let main_ratio = payload.main_ratio.unwrap_or(0.66);
            build_main_sidebar_bounds(
                &rect,
                n,
                main_ratio,
                payload.main_position,
                gap_x,
                gap_y,
                delta_w,
                delta_h,
            )
        }
    }
}

fn normalize_profile_ids(profile_ids: Vec<String>) -> Vec<String> {
    let mut seen = HashSet::new();
    let mut unique = Vec::new();
    for profile_id in profile_ids {
        if seen.insert(profile_id.clone()) {
            unique.push(profile_id);
        }
    }
    unique
}

fn run_batch_engine_action<F>(
    action_name: &str,
    state: State<'_, AppState>,
    profile_ids: Vec<String>,
    mut action: F,
) -> Result<BatchProfileActionResponse, String>
where
    F: FnMut(
        &mut crate::engine_manager::EngineManager,
        &str,
    ) -> Result<ProfileWindowState, AppError>,
{
    logger::info(
        "sync_cmd",
        format!("{action_name} request profile_count={}", profile_ids.len()),
    );
    let mut engine_manager = state
        .engine_manager
        .lock()
        .map_err(|_| "engine manager lock poisoned".to_string())?;
    let mut items = Vec::with_capacity(profile_ids.len());
    let mut success_count = 0usize;

    for profile_id in normalize_profile_ids(profile_ids) {
        match action(&mut engine_manager, &profile_id) {
            Ok(_) => {
                success_count += 1;
                items.push(BatchProfileActionItem {
                    profile_id,
                    ok: true,
                    message: "ok".to_string(),
                });
            }
            Err(err) => {
                items.push(BatchProfileActionItem {
                    profile_id,
                    ok: false,
                    message: err.to_string(),
                });
            }
        }
    }

    let total = items.len();
    Ok(BatchProfileActionResponse {
        total,
        success_count,
        failed_count: total.saturating_sub(success_count),
        items,
    })
}

fn error_to_string(err: AppError) -> String {
    err.to_string()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Mutex;
    use std::time::{SystemTime, UNIX_EPOCH};

    use crate::db;
    use crate::engine_manager::EngineManager;
    use crate::services::app_preference_service::AppPreferenceService;
    use crate::services::automation_service::AutomationService;
    use crate::services::chromium_magic_adapter_service::ChromiumMagicAdapterService;
    use crate::services::device_preset_service::DevicePresetService;
    use crate::services::engine_session_service::EngineSessionService;
    use crate::services::plugin_package_service::PluginPackageService;
    use crate::services::profile_group_service::ProfileGroupService;
    use crate::services::profile_service::ProfileService;
    use crate::services::proxy_service::ProxyService;
    use crate::services::resource_service::ResourceService;
    use crate::services::sync_manager_service::SyncManagerService;
    use crate::state::AppState;

    #[test]
    fn ensure_sync_sidecar_started_is_idempotent_in_mock_mode() {
        let state = new_test_state();

        let first = ensure_sync_sidecar_started_inner(None, &state).expect("first ensure");
        let second = ensure_sync_sidecar_started_inner(None, &state).expect("second ensure");

        assert_eq!(first.port, second.port);
        assert!(!first.already_running);
        assert!(second.already_running);
    }

    fn new_test_state() -> AppState {
        let db = db::init_test_database().expect("init test db");
        let profile_group_service = ProfileGroupService::from_db(db.clone());
        let profile_service = ProfileService::from_db(db.clone());
        let device_preset_service = DevicePresetService::from_db(db.clone());
        let plugin_package_service = PluginPackageService::from_db(db.clone());
        let engine_session_service = EngineSessionService::from_db(db.clone());
        let proxy_service = ProxyService::from_db(db.clone());
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("time")
            .as_nanos();
        let resource_dir = std::env::temp_dir().join(format!("multi-flow-sync-cmd-test-{unique}"));
        let resource_service =
            ResourceService::from_data_dir(&resource_dir).expect("resource service");
        let app_preference_service = AppPreferenceService::from_data_dir(resource_dir.clone());
        AppState {
            active_runs: std::sync::Arc::new(
                crate::services::automation_context::ActiveRunRegistry::new(),
            ),
            active_run_channels: Mutex::new(std::collections::HashMap::new()),
            cancel_tokens: Mutex::new(std::collections::HashMap::new()),
            ai_dialog_channels: Mutex::new(std::collections::HashMap::new()),
            tool_confirmation_channels: Mutex::new(std::collections::HashMap::new()),
            chat_service: Mutex::new(crate::services::chat_service::ChatService::from_db(
                db.clone(),
            )),
            chat_cancel_tokens: Mutex::new(std::collections::HashMap::new()),
            automation_service: Mutex::new(AutomationService::from_db(db.clone())),
            profile_group_service: Mutex::new(profile_group_service),
            profile_service: Mutex::new(profile_service),
            device_preset_service: Mutex::new(device_preset_service),
            app_preference_service: Mutex::new(app_preference_service),
            plugin_package_service: Mutex::new(plugin_package_service),
            engine_session_service: Mutex::new(engine_session_service),
            proxy_service: Mutex::new(proxy_service),
            resource_service: Mutex::new(resource_service),
            active_resource_downloads: Mutex::new(std::collections::HashMap::new()),
            active_plugin_downloads: Mutex::new(std::collections::HashMap::new()),
            engine_manager: Mutex::new(EngineManager::new()),
            chromium_magic_adapter_service: Mutex::new(ChromiumMagicAdapterService::new()),
            sync_manager_service: Mutex::new(SyncManagerService::new_mock(None, None)),
            mcp_manager: std::sync::Arc::new(crate::services::mcp::McpManager::from_db(db.clone())),
            bookmark_template_service: Mutex::new(
                crate::services::bookmark_template_service::BookmarkTemplateService::from_db(
                    db.clone(),
                ),
            ),
            require_real_engine: false,
            last_arrangement_snapshot: Mutex::new(Vec::new()),
            host_locale_service: std::sync::Arc::new(
                crate::services::host_locale_service::HostLocaleService::new(|| None),
            ),
        }
    }

    // ─── layout algorithm unit tests ────────────────────────────────────────

    fn make_rect(w: i32, h: i32) -> WindowBounds {
        WindowBounds {
            x: 0,
            y: 0,
            width: w,
            height: h,
        }
    }

    #[test]
    fn grid_auto_cols_3_windows_wide_screen() {
        // 3 windows on 1800×1080 → should prefer 1×3 (one row three cols)
        let rect = make_rect(1800, 1080);
        let (rows, cols) = choose_rows_cols(3, None, None, &rect);
        // area is wide, so cols > rows expected
        assert!(
            cols >= rows,
            "wide screen: cols({cols}) should >= rows({rows})"
        );
        assert_eq!(rows * cols, cols * rows);
        assert!(rows * cols >= 3);
    }

    #[test]
    fn grid_explicit_rows_cols() {
        let rect = make_rect(1920, 1080);
        let bounds = build_grid_bounds(
            &rect,
            4,
            2,
            2,
            10,
            20,
            0,
            0,
            LastRowAlign::Stretch,
            ArrangeFlow::RowMajor,
        )
        .expect("grid ok");
        assert_eq!(bounds.len(), 4);
        let cell_w = (1920 - 10) / 2;
        let cell_h = (1080 - 20) / 2;
        assert_eq!(
            bounds[0],
            WindowBounds {
                x: 0,
                y: 0,
                width: cell_w,
                height: cell_h
            }
        );
        assert_eq!(bounds[1].x, cell_w + 10);
        assert_eq!(bounds[2].y, cell_h + 20);
    }

    #[test]
    fn grid_last_row_center() {
        let rect = make_rect(1000, 800);
        // n=5, cols=2 → 3 rows, last row has 1 window
        let bounds = build_grid_bounds(
            &rect,
            5,
            3,
            2,
            0,
            0,
            0,
            0,
            LastRowAlign::Center,
            ArrangeFlow::RowMajor,
        )
        .expect("grid ok");
        assert_eq!(bounds.len(), 5);
        let cell_w = 1000 / 2;
        // last window (index 4) should be centered
        let expected_x = (1000 - cell_w) / 2;
        assert_eq!(bounds[4].x, expected_x, "last row center x mismatch");
    }

    #[test]
    fn grid_last_row_stretch() {
        let rect = make_rect(1000, 800);
        let bounds = build_grid_bounds(
            &rect,
            5,
            3,
            2,
            0,
            0,
            0,
            0,
            LastRowAlign::Stretch,
            ArrangeFlow::RowMajor,
        )
        .expect("grid ok");
        // last window should span full width
        assert_eq!(bounds[4].x, 0);
        assert_eq!(bounds[4].width, 1000);
    }

    #[test]
    fn grid_default_last_row_align_does_not_stretch() {
        let rect = make_rect(1000, 800);
        let bounds = build_grid_bounds(
            &rect,
            3,
            2,
            2,
            0,
            0,
            0,
            0,
            LastRowAlign::default(),
            ArrangeFlow::RowMajor,
        )
        .expect("grid ok");

        assert_eq!(bounds[2].x, 0);
        assert_eq!(bounds[2].width, 500);
    }

    #[test]
    fn grid_decoration_delta_compensated() {
        // delta_h=28: we send height=(cell_h - 28); y step uses target_h so visual gap == gap_y
        let rect = make_rect(1800, 1080);
        let (rows, cols) = (3u32, 3u32);
        let cell_h = (1080 - 2 * 16) / 3; // gap_y=16
        let bounds = build_grid_bounds(
            &rect,
            9,
            rows,
            cols,
            16,
            16,
            0,
            28,
            LastRowAlign::Stretch,
            ArrangeFlow::RowMajor,
        )
        .expect("grid ok");
        let expected_h = (cell_h - 28).max(MIN_WINDOW_H);
        assert_eq!(bounds[0].height, expected_h);
        // y step should be target_h + gap_y (visual gap equals gap_y regardless of delta)
        assert_eq!(bounds[3].y, expected_h + 16);
    }

    #[test]
    fn grid_overflow_returns_err() {
        // Work area too small for 5 rows 5 cols with min window size
        let rect = make_rect(200, 200);
        let result = build_grid_bounds(
            &rect,
            25,
            5,
            5,
            0,
            0,
            0,
            0,
            LastRowAlign::Start,
            ArrangeFlow::RowMajor,
        );
        assert!(result.is_err());
    }

    #[test]
    fn cascade_step_offsets() {
        let rect = make_rect(1920, 1080);
        let bounds = build_cascade_bounds(&rect, 3, 800, 600, 40);
        assert_eq!(bounds[0].x, 0);
        assert_eq!(bounds[0].y, 0);
        assert_eq!(bounds[1].x, 40);
        assert_eq!(bounds[1].y, 40);
        assert_eq!(bounds[2].x, 80);
        assert_eq!(bounds[2].y, 80);
    }

    #[test]
    fn main_sidebar_left() {
        let rect = make_rect(1800, 1080);
        let bounds = build_main_sidebar_bounds(&rect, 4, 0.66, MainPosition::Left, 16, 16, 0, 0)
            .expect("main sidebar ok");
        assert_eq!(bounds.len(), 4);
        // main window at x=0
        assert_eq!(bounds[0].x, 0);
        // sidebars at x = main_w + gap
        assert!(bounds[1].x > 0);
        assert_eq!(bounds[1].x, bounds[2].x);
        assert_eq!(bounds[1].x, bounds[3].x);
        // sidebars stacked vertically
        assert!(bounds[2].y > bounds[1].y);
    }

    #[test]
    fn backward_compatible_old_bounds_grid() {
        // Old test: build_arranged_bounds_grid_tiles_in_rows equivalent
        // 3 windows at cols=2 (auto for n=3 on wide 1920×1080)
        let area = WindowBounds {
            x: 10,
            y: 20,
            width: 1920,
            height: 1080,
        };
        let payload = ArrangeProfileWindowsRequest {
            profile_ids: vec![],
            monitor_id: String::new(),
            mode: WindowArrangeMode::Grid,
            rows: None,
            columns: None,
            gap_x: Some(16),
            gap_y: Some(16),
            padding: EdgeInsets {
                top: 0,
                right: 0,
                bottom: 0,
                left: 0,
            },
            last_row_align: LastRowAlign::Stretch,
            flow: ArrangeFlow::RowMajor,
            width: None,
            height: None,
            cascade_step: None,
            main_ratio: None,
            main_position: MainPosition::Left,
            order: ArrangeOrder::Selection,
            chrome_decoration_compensation: ChromeDecorationCompensation::Off,
            gap: None,
        };
        let bounds =
            compute_arranged_bounds(&area, &payload, 3, 16, 16, 0, 0).expect("should succeed");
        assert_eq!(bounds.len(), 3);
        // first window starts at area origin
        assert_eq!(bounds[0].x, 10);
        assert_eq!(bounds[0].y, 20);
    }
}
