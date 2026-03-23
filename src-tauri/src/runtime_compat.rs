use std::future::Future;

pub fn block_on_compat<F>(future: F) -> F::Output
where
    F: Future,
{
    if let Ok(handle) = tokio::runtime::Handle::try_current() {
        tokio::task::block_in_place(|| handle.block_on(future))
    } else {
        tauri::async_runtime::block_on(future)
    }
}
