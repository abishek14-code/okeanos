// The browser and desktop shell share the TypeScript controller.
// Hardware USB transport uses Web Serial in Chrome/Edge; this shell is simulation/replay only.
// Removed the independent Rust mock state and hard-coded override PINs.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
