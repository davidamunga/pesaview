mod tabula;

use std::io::Write;
use std::path::PathBuf;
use std::process::{Command, Stdio};
use std::sync::Mutex;

use tauri::Manager;
use tauri::State;

use crate::tabula::{group_areas, method_flag, parse_page_spec, TableArea};

pub struct ActivePid(pub Mutex<Option<u32>>);

#[cfg(target_os = "windows")]
fn normalize_windows_path(path: PathBuf) -> PathBuf {
    let path_str = path.to_string_lossy().to_string();
    if path_str.starts_with(r"\\?\") {
        PathBuf::from(path_str.trim_start_matches(r"\\?\"))
    } else {
        path
    }
}

#[cfg(not(target_os = "windows"))]
fn normalize_windows_path(path: PathBuf) -> PathBuf {
    path
}

fn normalize_user_path(path: &str) -> PathBuf {
    if cfg!(target_os = "windows") {
        PathBuf::from(path.trim_start_matches(r"\\?\"))
    } else {
        PathBuf::from(path)
    }
}

fn resolve_java(
    app_handle: &tauri::AppHandle,
) -> Result<(Command, PathBuf, PathBuf, String), String> {
    #[cfg(target_os = "windows")]
    use std::os::windows::process::CommandExt;

    let jar_path = app_handle
        .path()
        .resolve(
            "tabula-1.0.5-jar-with-dependencies.jar",
            tauri::path::BaseDirectory::Resource,
        )
        .map_err(|e| format!("Failed to resolve Tabula JAR: {e}"))?;
    let jar_path = normalize_windows_path(jar_path);

    let jre_folder = if cfg!(target_os = "windows") {
        "build-jre/jre-windows-x64"
    } else if cfg!(all(target_os = "macos", target_arch = "x86_64")) {
        "build-jre/jre-macos-x64"
    } else if cfg!(all(target_os = "macos", target_arch = "aarch64")) {
        "build-jre/jre-macos-arm64"
    } else if cfg!(all(target_os = "linux", target_arch = "x86_64")) {
        "build-jre/jre-linux-x64"
    } else if cfg!(all(target_os = "linux", target_arch = "aarch64")) {
        "build-jre/jre-linux-arm64"
    } else {
        return Err(format!(
            "Unsupported platform: {} {}",
            std::env::consts::OS,
            std::env::consts::ARCH
        ));
    };

    let jre_path = app_handle
        .path()
        .resolve(jre_folder, tauri::path::BaseDirectory::Resource)
        .map_err(|e| format!("Failed to resolve JRE at {jre_folder}: {e}"))?;

    let java_binary = if cfg!(target_os = "macos") {
        let jlink_path = jre_path.join("bin").join("java");
        let full_path = jre_path
            .join("Contents")
            .join("Home")
            .join("bin")
            .join("java");
        if jlink_path.exists() {
            jlink_path
        } else {
            full_path
        }
    } else {
        jre_path.join("bin").join(if cfg!(target_os = "windows") {
            "java.exe"
        } else {
            "java"
        })
    };

    let (cmd, java_source) = if java_binary.exists() {
        let command = Command::new(&java_binary);
        #[cfg(target_os = "windows")]
        {
            let mut command = command;
            command.creation_flags(0x08000000);
            (
                command,
                format!("bundled JRE at {:?}", java_binary),
            )
        }
        #[cfg(not(target_os = "windows"))]
        {
            (command, format!("bundled JRE at {:?}", java_binary))
        }
    } else {
        let command = Command::new("java");
        #[cfg(target_os = "windows")]
        {
            let mut command = command;
            command.creation_flags(0x08000000);
            (command, "system PATH (bundled JRE not found)".to_string())
        }
        #[cfg(not(target_os = "windows"))]
        {
            (command, "system PATH (bundled JRE not found)".to_string())
        }
    };

    Ok((cmd, jar_path, java_binary, java_source))
}

fn run_tabula(
    app_handle: &tauri::AppHandle,
    active_pid: &State<'_, ActivePid>,
    pdf_path: &str,
    password: Option<&str>,
    extra_args: &[&str],
) -> Result<String, String> {
    let (mut cmd, jar_path, java_binary, java_source) = resolve_java(app_handle)?;
    let pdf_path = normalize_user_path(pdf_path);

    cmd.arg("-jar")
        .arg(&jar_path)
        .args(extra_args)
        .arg(&pdf_path);

    if let Some(pwd) = password {
        cmd.arg("--password").arg(pwd);
    }

    cmd.stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    let child = cmd.spawn().map_err(|e| {
        format!(
            "Failed to execute Java (using {java_source}): {}\nExpected bundled Java at: {:?}\nJAR path: {:?}\nError: {e}",
            if e.kind() == std::io::ErrorKind::NotFound {
                "Java executable not found. Install Java or run the bundled JRE setup."
            } else {
                "Execution error"
            },
            java_binary,
            jar_path
        )
    })?;

    let pid = child.id();
    *active_pid.0.lock().unwrap() = Some(pid);

    let output = child
        .wait_with_output()
        .map_err(|e| format!("Failed waiting for Java process: {e}"))?;

    {
        let mut guard = active_pid.0.lock().unwrap();
        if *guard == Some(pid) {
            *guard = None;
        }
    }

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();

    if output.status.success() || stdout.trim_start().starts_with('[') {
        Ok(stdout)
    } else {
        let detail = if !stderr.is_empty() {
            stderr
        } else if !stdout.trim().is_empty() {
            stdout
        } else {
            format!("Process exited with {} and no output", output.status)
        };
        Err(format!("Tabula error: {detail}"))
    }
}

#[tauri::command]
fn cancel_extraction(active_pid: State<'_, ActivePid>) {
    let pid = active_pid.0.lock().unwrap().take();
    if let Some(pid) = pid {
        #[cfg(unix)]
        {
            let _ = Command::new("kill")
                .args(["-9", &pid.to_string()])
                .output();
        }
        #[cfg(windows)]
        {
            let _ = Command::new("taskkill")
                .args(["/F", "/PID", &pid.to_string()])
                .output();
        }
    }
}

#[tauri::command]
async fn extract_tables(
    app_handle: tauri::AppHandle,
    active_pid: State<'_, ActivePid>,
    pdf_path: String,
    password: Option<String>,
    areas: Vec<TableArea>,
) -> Result<String, String> {
    if areas.is_empty() {
        return run_tabula(
            &app_handle,
            &active_pid,
            &pdf_path,
            password.as_deref(),
            &["-f", "JSON", "-p", "all", "-g", "--silent"],
        );
    }

    let groups = group_areas(&areas);
    let mut combined: Vec<serde_json::Value> = Vec::new();

    for (page, method, group) in groups {
        let page_arg = page.to_string();
        let mut extra: Vec<String> = vec![
            "-f".into(),
            "JSON".into(),
            "-p".into(),
            page_arg,
            "--silent".into(),
        ];
        if let Some(flag) = method_flag(&method) {
            extra.push(flag.into());
        }
        for area in &group {
            extra.push("-a".into());
            extra.push(area.area_arg());
        }

        let extra_refs: Vec<&str> = extra.iter().map(String::as_str).collect();
        let stdout = run_tabula(
            &app_handle,
            &active_pid,
            &pdf_path,
            password.as_deref(),
            &extra_refs,
        )?;

        if let Ok(mut tables) = serde_json::from_str::<Vec<serde_json::Value>>(
            stdout
                .find('[')
                .and_then(|start| stdout.rfind(']').map(|end| &stdout[start..=end]))
                .unwrap_or("[]"),
        ) {
            for table in &mut tables {
                if table.get("page").is_none() {
                    table
                        .as_object_mut()
                        .map(|obj| obj.insert("page".into(), serde_json::json!(page)));
                }
            }
            combined.append(&mut tables);
        }
    }

    Ok(serde_json::to_string(&combined).unwrap_or_else(|_| "[]".into()))
}

#[tauri::command]
async fn guess_tables(
    app_handle: tauri::AppHandle,
    active_pid: State<'_, ActivePid>,
    pdf_path: String,
    password: Option<String>,
    pages: Option<String>,
) -> Result<String, String> {
    // Stream one page at a time so we can stamp `page` (Tabula `-g`/`-t -p all`
    // often omits it) and avoid full-page lattice boxes that cover letterhead.
    let page_list = parse_page_spec(&pages.unwrap_or_else(|| "all".into()));
    let mut combined: Vec<serde_json::Value> = Vec::new();

    for page in page_list {
        let page_arg = page.to_string();
        let stdout = match run_tabula(
            &app_handle,
            &active_pid,
            &pdf_path,
            password.as_deref(),
            &["-f", "JSON", "-p", &page_arg, "-t", "--silent"],
        ) {
            Ok(value) => value,
            Err(error) if error.contains("Page number does not exist") => break,
            Err(error) => return Err(error),
        };

        if let Ok(mut tables) = serde_json::from_str::<Vec<serde_json::Value>>(
            stdout
                .find('[')
                .and_then(|start| stdout.rfind(']').map(|end| &stdout[start..=end]))
                .unwrap_or("[]"),
        ) {
            for table in &mut tables {
                if let Some(obj) = table.as_object_mut() {
                    obj.insert("page".into(), serde_json::json!(page));
                    if !obj.contains_key("extraction_method") {
                        obj.insert("extraction_method".into(), serde_json::json!("stream"));
                    }
                }
            }
            combined.append(&mut tables);
        }
    }

    Ok(serde_json::to_string(&combined).unwrap_or_else(|_| "[]".into()))
}

#[tauri::command]
async fn save_file(
    app: tauri::AppHandle,
    content: Vec<u8>,
    default_filename: String,
    file_type: String,
) -> Result<String, String> {
    use tauri_plugin_dialog::DialogExt;

    let (title, filter_name, extensions) = match file_type.as_str() {
        "csv" => ("Save CSV File", "CSV Files", vec!["csv"]),
        "xlsx" => ("Save Excel File", "Excel Files", vec!["xlsx"]),
        "json" => ("Save JSON File", "JSON Files", vec!["json"]),
        _ => return Err("Unsupported file type".into()),
    };

    let file_path = app
        .dialog()
        .file()
        .set_title(title)
        .add_filter(filter_name, &extensions)
        .set_file_name(&default_filename)
        .blocking_save_file();

    match file_path {
        Some(path) => {
            let path_buf = path.as_path().ok_or("Invalid save path")?;
            let mut file = std::fs::File::create(&path_buf)
                .map_err(|e| format!("Failed to create file: {e}"))?;
            file.write_all(&content)
                .map_err(|e| format!("Failed to write file: {e}"))?;
            Ok(path_buf.display().to_string())
        }
        None => Err("Save dialog was cancelled".into()),
    }
}

#[tauri::command]
fn get_app_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

fn parse_hex_rgb(hex: &str) -> Result<(u8, u8, u8), String> {
    let hex = hex.trim().trim_start_matches('#');
    if hex.len() != 6 {
        return Err(format!("expected #RRGGBB, got {hex}"));
    }
    let r = u8::from_str_radix(&hex[0..2], 16).map_err(|e| e.to_string())?;
    let g = u8::from_str_radix(&hex[2..4], 16).map_err(|e| e.to_string())?;
    let b = u8::from_str_radix(&hex[4..6], 16).map_err(|e| e.to_string())?;
    Ok((r, g, b))
}

#[cfg(target_os = "macos")]
fn set_macos_window_background(window: &tauri::WebviewWindow, r: u8, g: u8, b: u8) -> Result<(), String> {
    use objc2_app_kit::{NSColor, NSTitlebarSeparatorStyle, NSWindow};

    let ns_window_ptr = window.ns_window().map_err(|e| e.to_string())? as *mut NSWindow;
    let ns_window = unsafe { &*ns_window_ptr };
    let bg_color = NSColor::colorWithRed_green_blue_alpha(
        r as f64 / 255.0,
        g as f64 / 255.0,
        b as f64 / 255.0,
        1.0,
    );
    ns_window.setTitlebarAppearsTransparent(true);
    ns_window.setTitlebarSeparatorStyle(NSTitlebarSeparatorStyle::None);
    ns_window.setOpaque(true);
    ns_window.setBackgroundColor(Some(&bg_color));
    Ok(())
}

/// Paints the native window (and macOS overlay title bar) the same color as the web UI.
#[tauri::command]
fn set_native_background(window: tauri::WebviewWindow, hex: String) -> Result<(), String> {
    let (r, g, b) = parse_hex_rgb(&hex)?;
    let _ = window.set_background_color(Some(tauri::window::Color(r, g, b, 255)));
    #[cfg(target_os = "macos")]
    set_macos_window_background(&window, r, g, b)?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(ActivePid(Mutex::new(None)))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            extract_tables,
            guess_tables,
            cancel_extraction,
            save_file,
            get_app_version,
            set_native_background
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
