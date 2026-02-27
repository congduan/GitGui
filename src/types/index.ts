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
}

export interface GitStatus {
  filePath: string;
  status: string;
}

export interface Worktree {
  path: string;
  branch: string;
}
