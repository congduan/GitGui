export interface Workspace {
  id: string;
  path: string;
  name: string;
  lastOpened: number;
}

export interface GitBranch {
  name: string;
  isCurrent: boolean;
  isRemote: boolean;
  upstream?: string;
}

export interface GitRemote {
  name: string;
  url: string;
}

export interface GitCommit {
  hash: string;
  author: string;
  date: string;
  message: string;
  parents: string[];
}

export interface GitCommitChange {
  path: string;
  status: string;
}

export interface GitCommitFileDiff {
  original: string;
  modified: string;
}

export interface GitStatus {
  filePath: string;
  status: string;
}

export interface Worktree {
  path: string;
  branch: string;
}

export interface GitRepoInfo {
  repoPath: string;
  gitDirPath: string;
  worktreePath: string;
  isBare: boolean;
  totalSizeBytes: number;
  worktreeSizeBytes: number;
  gitMetadataSizeBytes: number;
  gitObjectsSizeBytes: number;
  gitPackfilesSizeBytes: number;
  gitRefsSizeBytes: number;
  lfsEnabled: boolean;
  lfsObjectsSizeBytes: number;
}
