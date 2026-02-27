mod git;
use std::process::Command;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_fs::init())
    .invoke_handler(tauri::generate_handler![
      select_folder,
      get_branches,
      get_remotes,
      get_commits,
      get_status,
      checkout_branch,
      get_worktrees
    ])
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}

#[tauri::command]
async fn select_folder() -> Result<Option<String>, String> {
    #[cfg(target_os = "macos")]
    {
        let output = Command::new("osascript")
            .arg("-e")
            .arg("POSIX path of (choose folder with prompt \"Select Git Repository\")")
            .output()
            .map_err(|e| format!("failed to open folder dialog: {}", e))?;

        if output.status.success() {
            let path = String::from_utf8(output.stdout)
                .map_err(|e| format!("invalid dialog output: {}", e))?
                .trim()
                .to_string();
            if path.is_empty() {
                return Ok(None);
            }
            return Ok(Some(path));
        }

        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        // macOS AppleScript cancel code: -128
        if stderr.contains("-128") {
            return Ok(None);
        }

        Err(format!("folder dialog failed: {}", stderr))
    }

    #[cfg(not(target_os = "macos"))]
    {
        Err("select_folder is only implemented on macOS".to_string())
    }
}

#[tauri::command]
async fn get_branches(repo_path: String) -> Result<Vec<git::GitBranch>, String> {
    git::get_branches(&repo_path).map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_remotes(repo_path: String) -> Result<Vec<git::GitRemote>, String> {
    git::get_remotes(&repo_path).map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_commits(repo_path: String) -> Result<Vec<git::GitCommit>, String> {
    git::get_commits(&repo_path).map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_status(repo_path: String) -> Result<Vec<git::GitStatus>, String> {
    git::get_status(&repo_path).map_err(|e| e.to_string())
}

#[tauri::command]
async fn checkout_branch(repo_path: String, branch_name: String) -> Result<(), String> {
    git::checkout_branch(&repo_path, &branch_name).map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_worktrees(repo_path: String) -> Result<Vec<git::Worktree>, String> {
    git::get_worktrees(&repo_path).map_err(|e| e.to_string())
}
