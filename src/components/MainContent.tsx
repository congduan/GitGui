import React, { useState, useEffect } from 'react';
import { GitService } from '../services/gitService';
import type { GitBranch, GitRemote, GitCommit, GitStatus, Worktree } from '../types';
import Editor from '@monaco-editor/react';

interface MainContentProps {
  workspacePath: string;
}

const MainContent: React.FC<MainContentProps> = ({ workspacePath }) => {
  const [branches, setBranches] = useState<GitBranch[]>([]);
  const [remotes, setRemotes] = useState<GitRemote[]>([]);
  const [commits, setCommits] = useState<GitCommit[]>([]);
  const [status, setStatus] = useState<GitStatus[]>([]);
  const [worktrees, setWorktrees] = useState<Worktree[]>([]);
  const [selectedFile, setSelectedFile] = useState<string>('');
  const [diff, setDiff] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');

  const isLikelyAbsolutePath = (path: string) => {
    return path.startsWith('/') || /^[A-Za-z]:[\\/]/.test(path);
  };

  useEffect(() => {
    const loadGitData = async () => {
      console.log('Loading Git data for:', workspacePath);
      setLoading(true);
      setError('');
      try {
        if (!isLikelyAbsolutePath(workspacePath)) {
          throw new Error(`工作区路径不是绝对路径: ${workspacePath}`);
        }
        const gitService = new GitService(workspacePath);
        console.log('Created GitService instance');
        
        // 分别调用各个方法，以便查看每个方法的执行情况
        console.log('Calling getBranches');
        const branchesData = await gitService.getBranches();
        console.log('Got branches:', branchesData);
        setBranches(branchesData);
        
        console.log('Calling getRemotes');
        const remotesData = await gitService.getRemotes();
        console.log('Got remotes:', remotesData);
        setRemotes(remotesData);
        
        console.log('Calling getCommits');
        const commitsData = await gitService.getCommits();
        console.log('Got commits:', commitsData);
        setCommits(commitsData);
        
        console.log('Calling getStatus');
        const statusData = await gitService.getStatus();
        console.log('Got status:', statusData);
        setStatus(statusData);
        
        console.log('Calling getWorktrees');
        const worktreesData = await gitService.getWorktrees();
        console.log('Got worktrees:', worktreesData);
        setWorktrees(worktreesData);
      } catch (error) {
        console.error('Failed to load Git data:', error);
        setError(error instanceof Error ? error.message : String(error));
      } finally {
        setLoading(false);
      }
    };

    loadGitData();
  }, [workspacePath]);

  const handleCheckoutBranch = async (branchName: string) => {
    try {
      const gitService = new GitService(workspacePath);
      await gitService.checkoutBranch(branchName);
      // 重新加载数据
      const loadGitData = async () => {
        const gitService = new GitService(workspacePath);
        const branchesData = await gitService.getBranches();
        setBranches(branchesData);
      };
      loadGitData();
    } catch (error) {
      console.error('Failed to checkout branch:', error);
    }
  };

  const handleViewDiff = async (filePath: string) => {
    try {
      const gitService = new GitService(workspacePath);
      const diffData = await gitService.getDiff(filePath);
      setSelectedFile(filePath);
      setDiff(diffData);
    } catch (error) {
      console.error('Failed to get diff:', error);
    }
  };

  if (loading) {
    return <div className="main-content">Loading...</div>;
  }

  return (
    <div className="main-content">
      <div className="main-header">
        <h1>{workspacePath}</h1>
      </div>
      {error && (
        <div className="error-banner">
          {error}
          <br />
          请删除该工作区后重新添加，并优先使用拖拽文件夹到窗口的方式。
        </div>
      )}
      
      <div className="git-info">
        <div className="info-section">
          <h2>Branches</h2>
          <div className="branches-list">
            {branches.map(branch => (
              <div
                key={branch.name}
                className={`branch-item ${branch.isCurrent ? 'current' : ''}`}
                onClick={() => !branch.isCurrent && handleCheckoutBranch(branch.name)}
              >
                {branch.name}
                {branch.isCurrent && <span className="current-branch">✓</span>}
              </div>
            ))}
          </div>
        </div>

        <div className="info-section">
          <h2>Remotes</h2>
          <div className="remotes-list">
            {remotes.map(remote => (
              <div key={remote.name} className="remote-item">
                <div className="remote-name">{remote.name}</div>
                <div className="remote-url">{remote.url}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="info-section">
          <h2>Status</h2>
          <div className="status-list">
            {status.map(item => (
              <div key={item.filePath} className="status-item">
                <div className="status-file" onClick={() => handleViewDiff(item.filePath)}>
                  {item.filePath}
                </div>
                <div className={`status-${item.status}`}>{item.status}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="info-section">
          <h2>Commits</h2>
          <div className="commits-list">
            {commits.map(commit => (
              <div key={commit.hash} className="commit-item">
                <div className="commit-hash">{commit.hash.substring(0, 7)}</div>
                <div className="commit-info">
                  <div className="commit-message">{commit.message}</div>
                  <div className="commit-meta">
                    {commit.author} • {new Date(commit.date).toLocaleString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="info-section">
          <h2>Worktrees</h2>
          <div className="worktrees-list">
            {worktrees.map((worktree, index) => (
              <div key={index} className="worktree-item">
                <div className="worktree-path">{worktree.path}</div>
                <div className="worktree-branch">{worktree.branch}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {selectedFile && (
        <div className="diff-section">
          <h2>Diff: {selectedFile}</h2>
          <div className="diff-editor">
            <Editor
              height="400px"
              language="diff"
              value={diff}
              options={{
                readOnly: true,
                minimap: { enabled: false },
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default MainContent;
