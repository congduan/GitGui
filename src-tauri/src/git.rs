use git2::{BranchType, Repository, StatusOptions, StatusShow}; 
use serde::{Deserialize, Serialize}; 
use std::error::Error; 
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
        
        commits.push(GitCommit {
            hash: oid.to_string(),
            author,
            date,
            message,
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
