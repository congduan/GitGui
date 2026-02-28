use git2::{BranchType, Delta, DiffOptions, Oid, Repository, StatusOptions, StatusShow, Tree};
use serde::{Deserialize, Serialize}; 
use std::error::Error; 
use std::fs;
use std::path::Path;

#[derive(Serialize, Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct GitBranch {
    pub name: String,
    pub is_current: bool,
    pub is_remote: bool,
}

#[derive(Serialize, Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct GitRemote {
    pub name: String,
    pub url: String,
}

#[derive(Serialize, Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct GitCommit {
    pub hash: String,
    pub author: String,
    pub date: String,
    pub message: String,
    pub parents: Vec<String>,
}

#[derive(Serialize, Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct GitCommitChange {
    pub path: String,
    pub status: String,
}

#[derive(Serialize, Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct GitCommitFileDiff {
    pub original: String,
    pub modified: String,
}

#[derive(Serialize, Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct GitStatus {
    pub file_path: String,
    pub status: String,
}

#[derive(Serialize, Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Worktree {
    pub path: String,
    pub branch: String,
}

#[derive(Serialize, Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct GitRepoInfo {
    pub repo_path: String,
    pub git_dir_path: String,
    pub worktree_path: String,
    pub is_bare: bool,
    pub total_size_bytes: u64,
    pub worktree_size_bytes: u64,
    pub git_metadata_size_bytes: u64,
    pub git_objects_size_bytes: u64,
    pub git_packfiles_size_bytes: u64,
    pub git_refs_size_bytes: u64,
    pub lfs_enabled: bool,
    pub lfs_objects_size_bytes: u64,
}

fn open_repo(repo_path: &str) -> Result<Repository, Box<dyn Error>> {
    let path = Path::new(repo_path);
    let discover_path = if path.is_file() {
        path.parent().unwrap_or(path)
    } else {
        path
    };
    let repo = Repository::discover(discover_path)?;
    Ok(repo)
}

fn dir_size(path: &Path, skip_name: Option<&str>) -> u64 {
    let mut total = 0_u64;
    let entries = match fs::read_dir(path) {
        Ok(entries) => entries,
        Err(_) => return total,
    };

    for entry_result in entries {
        let entry = match entry_result {
            Ok(entry) => entry,
            Err(_) => continue,
        };
        let entry_path = entry.path();
        if let Some(skip) = skip_name {
            if entry_path.file_name().and_then(|n| n.to_str()) == Some(skip) {
                continue;
            }
        }

        let metadata = match fs::symlink_metadata(&entry_path) {
            Ok(metadata) => metadata,
            Err(_) => continue,
        };
        if metadata.is_file() {
            total = total.saturating_add(metadata.len());
        } else if metadata.is_dir() {
            total = total.saturating_add(dir_size(&entry_path, None));
        }
    }
    total
}

fn contains_lfs_filter(path: &Path) -> bool {
    match fs::read_to_string(path) {
        Ok(content) => content.contains("filter=lfs"),
        Err(_) => false,
    }
}

fn detect_lfs_enabled(repo: &Repository, worktree_path: &Path, git_dir: &Path) -> bool {
    if let Ok(config) = repo.config() {
        if config.get_string("filter.lfs.clean").is_ok() || config.get_string("filter.lfs.smudge").is_ok() {
            return true;
        }
    }

    if contains_lfs_filter(&worktree_path.join(".gitattributes")) {
        return true;
    }
    if contains_lfs_filter(&git_dir.join("info").join("attributes")) {
        return true;
    }
    false
}

pub fn get_branches(repo_path: &str) -> Result<Vec<GitBranch>, Box<dyn Error>> {
    println!("Opening repository at: {}", repo_path);
    let repo = open_repo(repo_path)?;
    println!("Successfully opened repository");
    let mut branches = Vec::new();
    
    // 获取本地分支
    println!("Getting local branches");
    for branch in repo.branches(Some(BranchType::Local))? {
        let (branch, _) = branch?;
        let name = branch.name()?.unwrap_or("").to_string();
        let is_current = branch.is_head();
        
        branches.push(GitBranch {
            name: name.clone(),
            is_current,
            is_remote: false,
        });
    }
    
    // 获取远程分支
    println!("Getting remote branches");
    for branch in repo.branches(Some(BranchType::Remote))? {
        let (branch, _) = branch?;
        let name = branch.name()?.unwrap_or("").to_string();
        let is_current = branch.is_head();
        
        branches.push(GitBranch {
            name: name.clone(),
            is_current,
            is_remote: true,
        });
    }
    
    println!("Found {} branches", branches.len());
    Ok(branches)
}

pub fn get_remotes(repo_path: &str) -> Result<Vec<GitRemote>, Box<dyn Error>> {
    let repo = open_repo(repo_path)?;
    let mut remotes = Vec::new();
    
    for remote in &repo.remotes()? {
        if let Some(name) = remote {
            let remote = repo.find_remote(name)?;
            if let Some(url) = remote.url() {
                remotes.push(GitRemote {
                    name: name.to_string(),
                    url: url.to_string(),
                });
            }
        }
    }
    
    Ok(remotes)
}

pub fn get_commits(repo_path: &str) -> Result<Vec<GitCommit>, Box<dyn Error>> {
    let repo = open_repo(repo_path)?;
    let mut commits = Vec::new();
    
    let head = repo.head()?;
    let commit = head.peel_to_commit()?;
    
    let mut revwalk = repo.revwalk()?;
    revwalk.push(commit.id())?;
    
    for oid in revwalk {
        let oid = oid?;
        let commit = repo.find_commit(oid)?;
        
        let author = commit.author().name().unwrap_or("").to_string();
        // 手动格式化时间
        let time = commit.author().when();
        let date = format!("{}", time.seconds());
        let message = commit.message().unwrap_or("").trim().to_string();
        let parents = commit.parent_ids().map(|id| id.to_string()).collect();
        
        commits.push(GitCommit {
            hash: oid.to_string(),
            author,
            date,
            message,
            parents,
        });
        
        if commits.len() >= 50 {
            break;
        }
    }
    
    Ok(commits)
}

pub fn get_status(repo_path: &str) -> Result<Vec<GitStatus>, Box<dyn Error>> {
    let repo = open_repo(repo_path)?;
    let mut status_options = StatusOptions::new();
    status_options.show(StatusShow::Workdir);
    
    let statuses = repo.statuses(Some(&mut status_options))?;
    let mut status_list = Vec::new();
    
    for entry in statuses.iter() {
        let path = entry.path().unwrap_or("").to_string();
        let status = entry.status();
        
        let status_str = if status.contains(git2::Status::INDEX_NEW) || status.contains(git2::Status::WT_NEW) {
            "new"
        } else if status.contains(git2::Status::INDEX_MODIFIED) || status.contains(git2::Status::WT_MODIFIED) {
            "modified"
        } else if status.contains(git2::Status::INDEX_DELETED) || status.contains(git2::Status::WT_DELETED) {
            "deleted"
        } else {
            "unknown"
        };
        
        status_list.push(GitStatus {
            file_path: path,
            status: status_str.to_string(),
        });
    }
    
    Ok(status_list)
}

pub fn get_commit_changes(repo_path: &str, commit_hash: &str) -> Result<Vec<GitCommitChange>, Box<dyn Error>> {
    let repo = open_repo(repo_path)?;
    let oid = Oid::from_str(commit_hash)?;
    let commit = repo.find_commit(oid)?;
    let current_tree = commit.tree()?;

    let parent_tree = if commit.parent_count() > 0 {
        Some(commit.parent(0)?.tree()?)
    } else {
        None
    };

    let diff = repo.diff_tree_to_tree(parent_tree.as_ref(), Some(&current_tree), None)?;
    let mut changes = Vec::new();

    for delta in diff.deltas() {
        let status = match delta.status() {
            Delta::Added => "added",
            Delta::Deleted => "deleted",
            Delta::Modified => "modified",
            Delta::Renamed => "renamed",
            Delta::Copied => "copied",
            Delta::Typechange => "typechange",
            _ => "unknown",
        };

        let path = delta
            .new_file()
            .path()
            .or_else(|| delta.old_file().path())
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_default();

        changes.push(GitCommitChange {
            path,
            status: status.to_string(),
        });
    }

    Ok(changes)
}

fn read_file_from_tree(repo: &Repository, tree: &Tree, file_path: &str) -> Result<Option<String>, Box<dyn Error>> {
    let entry = match tree.get_path(Path::new(file_path)) {
        Ok(entry) => entry,
        Err(_) => return Ok(None),
    };
    let object = entry.to_object(repo)?;
    let blob = match object.as_blob() {
        Some(blob) => blob,
        None => return Ok(None),
    };
    Ok(Some(String::from_utf8_lossy(blob.content()).to_string()))
}

pub fn get_commit_file_diff(repo_path: &str, commit_hash: &str, file_path: &str) -> Result<GitCommitFileDiff, Box<dyn Error>> {
    let repo = open_repo(repo_path)?;
    let oid = Oid::from_str(commit_hash)?;
    let commit = repo.find_commit(oid)?;
    let current_tree = commit.tree()?;

    let parent_tree = if commit.parent_count() > 0 {
        Some(commit.parent(0)?.tree()?)
    } else {
        None
    };

    let mut diff_opts = DiffOptions::new();
    diff_opts.pathspec(file_path);
    let diff = repo.diff_tree_to_tree(parent_tree.as_ref(), Some(&current_tree), Some(&mut diff_opts))?;

    let delta = diff.deltas().next();
    let old_path = delta
        .as_ref()
        .and_then(|d| d.old_file().path())
        .map(|p| p.to_string_lossy().to_string());
    let new_path = delta
        .as_ref()
        .and_then(|d| d.new_file().path())
        .map(|p| p.to_string_lossy().to_string());

    let original = match (&parent_tree, old_path.as_deref()) {
        (Some(tree), Some(path)) => read_file_from_tree(&repo, tree, path)?.unwrap_or_default(),
        _ => String::new(),
    };

    let modified = match new_path.as_deref() {
        Some(path) => read_file_from_tree(&repo, &current_tree, path)?.unwrap_or_default(),
        None => String::new(),
    };

    Ok(GitCommitFileDiff { original, modified })
}

pub fn checkout_branch(repo_path: &str, branch_name: &str) -> Result<(), Box<dyn Error>> {
    let repo = open_repo(repo_path)?;
    let branch = repo.find_branch(branch_name, BranchType::Local)?;
    let target = branch.get().target().unwrap();
    let commit = repo.find_commit(target)?;
    let object = commit.as_object();
    
    repo.checkout_tree(object, None)?;
    repo.set_head(&format!("refs/heads/{}", branch_name))?;
    
    Ok(())
}

pub fn get_worktrees(repo_path: &str) -> Result<Vec<Worktree>, Box<dyn Error>> {
    let repo = open_repo(repo_path)?;
    let mut result = Vec::new();
    
    // 获取主工作树
    let main_worktree_path = repo.workdir().unwrap_or_else(|| repo.path()).to_str().unwrap_or("").to_string();
    let main_branch = if let Ok(head) = repo.head() {
        if let Ok(reference) = head.resolve() {
            reference.shorthand().unwrap_or("").to_string()
        } else {
            "".to_string()
        }
    } else {
        "".to_string()
    };
    
    result.push(Worktree {
        path: main_worktree_path,
        branch: main_branch,
    });
    
    // 获取其他工作树
    let worktrees = repo.worktrees()?;
    for i in 0..worktrees.len() {
        if let Some(name) = worktrees.get(i) {
            if let Ok(worktree) = repo.find_worktree(name) {
                let path = worktree.path().to_str().unwrap_or("").to_string();
                // 对于其他工作树，暂时使用空字符串作为分支名称
                // 因为 libgit2 的 Worktree API 没有直接提供获取当前分支的方法
                result.push(Worktree {
                    path,
                    branch: "".to_string(),
                });
            }
        }
    }
    
    Ok(result)
}

pub fn get_repo_info(repo_path: &str) -> Result<GitRepoInfo, Box<dyn Error>> {
    let repo = open_repo(repo_path)?;
    let git_dir = repo.path();
    let worktree_path = repo.workdir().unwrap_or(git_dir);
    let is_bare = repo.is_bare();

    let worktree_size_bytes = if is_bare {
        0
    } else {
        dir_size(worktree_path, Some(".git"))
    };
    let git_metadata_size_bytes = dir_size(git_dir, None);
    let git_objects_size_bytes = dir_size(&git_dir.join("objects"), None);
    let git_packfiles_size_bytes = dir_size(&git_dir.join("objects").join("pack"), None);
    let git_refs_size_bytes = dir_size(&git_dir.join("refs"), None);
    let lfs_objects_size_bytes = dir_size(&git_dir.join("lfs").join("objects"), None);
    let lfs_enabled = detect_lfs_enabled(&repo, worktree_path, git_dir);

    Ok(GitRepoInfo {
        repo_path: repo_path.to_string(),
        git_dir_path: git_dir.to_string_lossy().to_string(),
        worktree_path: worktree_path.to_string_lossy().to_string(),
        is_bare,
        total_size_bytes: worktree_size_bytes.saturating_add(git_metadata_size_bytes),
        worktree_size_bytes,
        git_metadata_size_bytes,
        git_objects_size_bytes,
        git_packfiles_size_bytes,
        git_refs_size_bytes,
        lfs_enabled,
        lfs_objects_size_bytes,
    })
}
