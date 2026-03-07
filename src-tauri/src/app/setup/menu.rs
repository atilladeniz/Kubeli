#[cfg(target_os = "macos")]
pub fn setup_macos_menu(app: &mut tauri::App) -> tauri::Result<()> {
    use chrono::{Datelike, Utc};
    use tauri::menu::{AboutMetadataBuilder, MenuBuilder, SubmenuBuilder};

    let about_metadata = AboutMetadataBuilder::new()
        .name(Some("Kubeli"))
        .version(Some("0.1.0"))
        .copyright(Some(&format!("© {} Kubeli", Utc::now().year())))
        .comments(Some(
            "Modern Kubernetes Management Desktop Application.\n\nThank you for using Kubeli!",
        ))
        .build();

    let app_submenu = SubmenuBuilder::new(app, "Kubeli")
        .about(Some(about_metadata))
        .separator()
        .services()
        .separator()
        .hide()
        .hide_others()
        .show_all()
        .separator()
        .quit()
        .build()?;

    let edit_submenu = SubmenuBuilder::new(app, "Edit")
        .undo()
        .redo()
        .separator()
        .cut()
        .copy()
        .paste()
        .select_all()
        .build()?;

    let window_submenu = SubmenuBuilder::new(app, "Window")
        .minimize()
        .separator()
        .close_window()
        .build()?;

    let menu = MenuBuilder::new(app)
        .item(&app_submenu)
        .item(&edit_submenu)
        .item(&window_submenu)
        .build()?;

    app.set_menu(menu)?;
    Ok(())
}
