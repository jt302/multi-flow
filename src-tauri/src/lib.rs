use tauri::Manager;

mod commands;
mod engine_manager;
mod error;
mod local_api_server;
mod models;
mod services;
mod state;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let app_state = state::build_app_state(&app.handle())
                .map_err(|err| -> Box<dyn std::error::Error> { Box::new(err) })?;
            app.manage(app_state);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::profile_commands::create_profile,
            commands::profile_commands::list_profiles,
            commands::profile_commands::open_profile,
            commands::profile_commands::close_profile,
            commands::profile_commands::delete_profile,
            commands::profile_commands::restore_profile,
            commands::profile_commands::batch_open_profiles,
            commands::profile_commands::batch_close_profiles,
            commands::profile_commands::get_local_api_server_status,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
