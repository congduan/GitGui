import type { GitBranch, GitRemote, GitCommit, GitStatus, Worktree } from '../types';
import { invoke as tauriInvoke } from '@tauri-apps/api/core';

const isTauriRuntime = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

const mockInvoke = async (command: string, params: any) => {
  console.log('Mock invoke called with command:', command, 'params:', params);
  switch (command) {
    case 'get_branches':
      return [
        { name: 'main', is_current: true, is_remote: false },
        { name: 'feature-branch', is_current: false, is_remote: false },
        { name: 'origin/main', is_current: false, is_remote: true }
      ];
    case 'get_remotes':
      return [{ name: 'origin', url: 'https://github.com/example/repo.git' }];
    case 'get_commits':
      return [
        {
          hash: '1234567890abcdef1234567890abcdef12345678',
          author: 'John Doe',
          date: new Date().toISOString(),
          message: 'Initial commit'
        }
      ];
    case 'get_status':
      return [];
    case 'get_worktrees':
      return [{ path: params.repoPath, branch: 'main' }];
    default:
      return [];
  }
};

const invoke = async <T>(command: string, params: Record<string, unknown>): Promise<T> => {
  if (isTauriRuntime) {
    return tauriInvoke<T>(command, params);
  }
  return mockInvoke(command, params) as Promise<T>;
}

export class GitService {
  private workdir: string;

  constructor(workdir: string) {
    this.workdir = workdir;
  }

  async getBranches(): Promise<GitBranch[]> {
    try {
      const branches = await invoke<GitBranch[]>('get_branches', {
        repoPath: this.workdir
      });
      return branches;
    } catch (error) {
      console.error('Error getting branches:', error);
      throw error;
    }
  }

  async getRemotes(): Promise<GitRemote[]> {
    try {
      const remotes = await invoke<GitRemote[]>('get_remotes', {
        repoPath: this.workdir
      });
      return remotes;
    } catch (error) {
      console.error('Error getting remotes:', error);
      throw error;
    }
  }

  async checkoutBranch(branchName: string): Promise<void> {
    try {
      await invoke<void>('checkout_branch', {
        repoPath: this.workdir,
        branchName
      });
    } catch (error) {
      console.error('Error checking out branch:', error);
      throw error;
    }
  }

  async createWorktree(_branchName: string, _worktreePath: string): Promise<void> {
    try {
      // 注意：后端尚未实现 create_worktree 函数
      console.log('Worktree creation is not yet implemented in the backend');
      // await invoke('create_worktree', {
      //   repoPath: this.workdir,
      //   branchName: _branchName,
      //   worktreePath: _worktreePath
      // });
    } catch (error) {
      console.error('Error creating worktree:', error);
    }
  }

  async getCommits(): Promise<GitCommit[]> {
    try {
      const commits = await invoke<GitCommit[]>('get_commits', {
        repoPath: this.workdir
      });
      return commits;
    } catch (error) {
      console.error('Error getting commits:', error);
      throw error;
    }
  }

  async getStatus(): Promise<GitStatus[]> {
    try {
      const status = await invoke<GitStatus[]>('get_status', {
        repoPath: this.workdir
      });
      return status;
    } catch (error) {
      console.error('Error getting status:', error);
      throw error;
    }
  }

  async getDiff(_filePath: string): Promise<string> {
    try {
      // 注意：后端尚未实现 get_diff 函数
      console.log('Diff functionality is not yet implemented in the backend');
      // const diff = await invoke('get_diff', {
      //   repoPath: this.workdir,
      //   filePath: _filePath
      // });
      // return diff;
    } catch (error) {
      console.error('Error getting diff:', error);
    }
    return '';
  }

  async getWorktrees(): Promise<Worktree[]> {
    try {
      const worktrees = await invoke<Worktree[]>('get_worktrees', {
        repoPath: this.workdir
      });
      return worktrees;
    } catch (error) {
      console.error('Error getting worktrees:', error);
      throw error;
    }
  }
}
