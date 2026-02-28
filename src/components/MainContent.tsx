import React, { useEffect, useRef, useState } from 'react';
import { GitService } from '../services/gitService';
import type { GitBranch, GitRemote, GitCommit, GitCommitChange, GitRepoInfo, GitStatus, Worktree } from '../types';
import { DiffEditor } from '@monaco-editor/react';

interface MainContentProps {
  workspacePath: string;
}

type TabKey = 'repo' | 'branches' | 'remotes' | 'status' | 'commits' | 'worktrees';
type DiffViewMode = 'sideBySide' | 'inline';

const MainContent: React.FC<MainContentProps> = ({ workspacePath }) => {
  const [branches, setBranches] = useState<GitBranch[]>([]);
  const [remotes, setRemotes] = useState<GitRemote[]>([]);
  const [commits, setCommits] = useState<GitCommit[]>([]);
  const [status, setStatus] = useState<GitStatus[]>([]);
  const [worktrees, setWorktrees] = useState<Worktree[]>([]);
  const [repoInfo, setRepoInfo] = useState<GitRepoInfo | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('repo');
  const [expandedCommitHash, setExpandedCommitHash] = useState<string>('');
  const [commitChangesByHash, setCommitChangesByHash] = useState<Record<string, GitCommitChange[]>>({});
  const [loadingCommitChangesHash, setLoadingCommitChangesHash] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<string>('');
  const [diffOriginal, setDiffOriginal] = useState<string>('');
  const [diffModified, setDiffModified] = useState<string>('');
  const [diffViewMode, setDiffViewMode] = useState<DiffViewMode>('sideBySide');
  const [diffPaneWidth, setDiffPaneWidth] = useState<number>(640);
  const [isResizingDiffPane, setIsResizingDiffPane] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const splitPaneRef = useRef<HTMLDivElement | null>(null);

  const isLikelyAbsolutePath = (path: string) => {
    return path.startsWith('/') || /^[A-Za-z]:[\\/]/.test(path);
  };

  const getLanguageByFilePath = (filePath: string) => {
    const name = filePath.toLowerCase();
    if (name.endsWith('.ts') || name.endsWith('.tsx')) return 'typescript';
    if (name.endsWith('.js') || name.endsWith('.jsx')) return 'javascript';
    if (name.endsWith('.json')) return 'json';
    if (name.endsWith('.rs')) return 'rust';
    if (name.endsWith('.css')) return 'css';
    if (name.endsWith('.html')) return 'html';
    if (name.endsWith('.md')) return 'markdown';
    if (name.endsWith('.yml') || name.endsWith('.yaml')) return 'yaml';
    if (name.endsWith('.toml')) return 'ini';
    return 'plaintext';
  };

  const formatBytes = (bytes: number) => {
    if (!Number.isFinite(bytes) || bytes < 0) {
      return '-';
    }
    if (bytes < 1024) {
      return `${bytes} B`;
    }
    const units = ['KB', 'MB', 'GB', 'TB'];
    let value = bytes / 1024;
    let unit = units[0];
    for (let i = 1; i < units.length && value >= 1024; i += 1) {
      value /= 1024;
      unit = units[i];
    }
    return `${value.toFixed(2)} ${unit}`;
  };

  const formatCommitDate = (rawDate: string) => {
    const value = rawDate.trim();
    if (!value) {
      return '-';
    }

    // Handle numeric Unix timestamps from backend (seconds or milliseconds).
    if (/^-?\d+$/.test(value)) {
      const numeric = Number(value);
      if (Number.isFinite(numeric)) {
        const timestamp = value.length <= 10 ? numeric * 1000 : numeric;
        const parsed = new Date(timestamp);
        if (!Number.isNaN(parsed.getTime())) {
          return parsed.toLocaleString();
        }
      }
    }

    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleString();
    }
    return value;
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

        console.log('Calling getRepoInfo');
        const repoInfoData = await gitService.getRepoInfo();
        console.log('Got repo info:', repoInfoData);
        setRepoInfo(repoInfoData);
      } catch (error) {
        console.error('Failed to load Git data:', error);
        setError(error instanceof Error ? error.message : String(error));
      } finally {
        setLoading(false);
      }
    };

    loadGitData();
  }, [workspacePath]);

  useEffect(() => {
    setSelectedFile('');
    setDiffOriginal('');
    setDiffModified('');
  }, [activeTab]);

  useEffect(() => {
    if (!isResizingDiffPane) {
      return;
    }

    const handleMouseMove = (event: MouseEvent) => {
      const splitPane = splitPaneRef.current;
      if (!splitPane) {
        return;
      }

      const rect = splitPane.getBoundingClientRect();
      const maxWidth = Math.max(420, rect.width - 360);
      const nextWidth = rect.right - event.clientX;
      const clampedWidth = Math.max(420, Math.min(maxWidth, nextWidth));
      setDiffPaneWidth(clampedWidth);
    };

    const handleMouseUp = () => {
      setIsResizingDiffPane(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizingDiffPane]);

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
      setDiffOriginal('');
      setDiffModified(diffData);
    } catch (error) {
      console.error('Failed to get diff:', error);
    }
  };

  const handleToggleCommitChanges = async (commitHash: string) => {
    if (expandedCommitHash === commitHash) {
      setExpandedCommitHash('');
      return;
    }

    setExpandedCommitHash(commitHash);
    if (commitChangesByHash[commitHash]) {
      return;
    }

    try {
      setLoadingCommitChangesHash(commitHash);
      const gitService = new GitService(workspacePath);
      const changes = await gitService.getCommitChanges(commitHash);
      setCommitChangesByHash(prev => ({
        ...prev,
        [commitHash]: changes,
      }));
    } catch (error) {
      console.error('Failed to get commit changes:', error);
      setCommitChangesByHash(prev => ({
        ...prev,
        [commitHash]: [],
      }));
    } finally {
      setLoadingCommitChangesHash('');
    }
  };

  const handleViewCommitFileDiff = async (commitHash: string, filePath: string) => {
    try {
      const gitService = new GitService(workspacePath);
      const diffData = await gitService.getCommitFileDiff(commitHash, filePath);
      setSelectedFile(`${commitHash.substring(0, 7)}:${filePath}`);
      setDiffOriginal(diffData.original);
      setDiffModified(diffData.modified);
    } catch (error) {
      console.error('Failed to get commit file diff:', error);
    }
  };

  if (loading) {
    return <div className="main-content">Loading...</div>;
  }

  const activeTabTitle = activeTab[0].toUpperCase() + activeTab.slice(1);
  const repoDisplayName = (() => {
    const normalized = workspacePath.replace(/[\\/]+$/, '');
    const segments = normalized.split(/[\\/]/);
    return segments[segments.length - 1] || workspacePath;
  })();
  const activeTabCount = (() => {
    switch (activeTab) {
      case 'repo':
        return repoInfo ? 12 : 0;
      case 'branches':
        return branches.length;
      case 'remotes':
        return remotes.length;
      case 'status':
        return status.length;
      case 'commits':
        return commits.length;
      case 'worktrees':
        return worktrees.length;
      default:
        return 0;
    }
  })();

  const renderTabContent = () => {
    if (activeTab === 'repo') {
      if (!repoInfo) {
        return <div className="repo-info-empty">No repo info available.</div>;
      }
      return (
        <div className="repo-info-list">
          <div className="repo-info-item"><span className="repo-info-label">Repository Path</span><span className="repo-info-value">{repoInfo.repoPath}</span></div>
          <div className="repo-info-item"><span className="repo-info-label">Git Directory</span><span className="repo-info-value">{repoInfo.gitDirPath}</span></div>
          <div className="repo-info-item"><span className="repo-info-label">Worktree Path</span><span className="repo-info-value">{repoInfo.worktreePath}</span></div>
          <div className="repo-info-item"><span className="repo-info-label">Repository Type</span><span className="repo-info-value">{repoInfo.isBare ? 'Bare' : 'Non-bare'}</span></div>
          <div className="repo-info-item"><span className="repo-info-label">Total Size</span><span className="repo-info-value">{formatBytes(repoInfo.totalSizeBytes)}</span></div>
          <div className="repo-info-item"><span className="repo-info-label">Worktree Size</span><span className="repo-info-value">{formatBytes(repoInfo.worktreeSizeBytes)}</span></div>
          <div className="repo-info-item"><span className="repo-info-label">Git Metadata Size</span><span className="repo-info-value">{formatBytes(repoInfo.gitMetadataSizeBytes)}</span></div>
          <div className="repo-info-item"><span className="repo-info-label">Git Objects Size</span><span className="repo-info-value">{formatBytes(repoInfo.gitObjectsSizeBytes)}</span></div>
          <div className="repo-info-item"><span className="repo-info-label">Packfiles Size</span><span className="repo-info-value">{formatBytes(repoInfo.gitPackfilesSizeBytes)}</span></div>
          <div className="repo-info-item"><span className="repo-info-label">Refs Size</span><span className="repo-info-value">{formatBytes(repoInfo.gitRefsSizeBytes)}</span></div>
          <div className="repo-info-item"><span className="repo-info-label">Git LFS</span><span className="repo-info-value">{repoInfo.lfsEnabled ? 'Enabled' : 'Disabled'}</span></div>
          <div className="repo-info-item"><span className="repo-info-label">LFS Objects Size</span><span className="repo-info-value">{formatBytes(repoInfo.lfsObjectsSizeBytes)}</span></div>
        </div>
      );
    }

    if (activeTab === 'branches') {
      return (
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
      );
    }

    if (activeTab === 'remotes') {
      return (
        <div className="remotes-list">
          {remotes.map(remote => (
            <div key={remote.name} className="remote-item">
              <div className="remote-name">{remote.name}</div>
              <div className="remote-url">{remote.url}</div>
            </div>
          ))}
        </div>
      );
    }

    if (activeTab === 'status') {
      return (
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
      );
    }

    if (activeTab === 'commits') {
      return (
        <div className="commits-list">
          {commits.map(commit => (
            <div key={commit.hash} className="commit-item-wrapper">
              <div
                className={`commit-item ${expandedCommitHash === commit.hash ? 'active' : ''}`}
                onClick={() => handleToggleCommitChanges(commit.hash)}
              >
                <div className="commit-hash">{commit.hash.substring(0, 7)}</div>
                <div className="commit-info">
                  <div className="commit-message">{commit.message}</div>
                  <div className="commit-meta">
                    {commit.author} • {formatCommitDate(commit.date)}
                  </div>
                </div>
              </div>
              {expandedCommitHash === commit.hash && (
                <div className="commit-changes">
                  {loadingCommitChangesHash === commit.hash && (
                    <div className="commit-change-item">Loading changes...</div>
                  )}
                  {loadingCommitChangesHash !== commit.hash && (commitChangesByHash[commit.hash] || []).length === 0 && (
                    <div className="commit-change-item">No file changes found.</div>
                  )}
                  {loadingCommitChangesHash !== commit.hash && (commitChangesByHash[commit.hash] || []).map(change => (
                    <div key={`${commit.hash}-${change.path}-${change.status}`} className="commit-change-item">
                      <span className={`commit-change-status commit-change-status-${change.status}`}>{change.status}</span>
                      <button
                        type="button"
                        className="commit-change-path-btn"
                        onClick={() => handleViewCommitFileDiff(commit.hash, change.path)}
                      >
                        {change.path}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      );
    }

    return (
      <div className="worktrees-list">
        {worktrees.map((worktree, index) => (
          <div key={index} className="worktree-item">
            <div className="worktree-path">{worktree.path}</div>
            <div className="worktree-branch">{worktree.branch}</div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="main-content">
      <div className="main-header">
        <div className="main-header-eyebrow">Repository</div>
        <h1 title={repoDisplayName}>{repoDisplayName}</h1>
        <p className="main-header-path" title={workspacePath}>{workspacePath}</p>
        <div className="main-header-meta">
          <span className="main-header-pill">{activeTabTitle}</span>
          <span className="main-header-pill">{activeTabCount} Items</span>
        </div>
      </div>
      {error && (
        <div className="error-banner">
          {error}
          <br />
          请删除该工作区后重新添加，并优先使用拖拽文件夹到窗口的方式。
        </div>
      )}
      
      <div className="git-tabs">
        <button className={`git-tab-btn ${activeTab === 'repo' ? 'active' : ''}`} onClick={() => setActiveTab('repo')}>Repo</button>
        <button className={`git-tab-btn ${activeTab === 'branches' ? 'active' : ''}`} onClick={() => setActiveTab('branches')}>Branches</button>
        <button className={`git-tab-btn ${activeTab === 'remotes' ? 'active' : ''}`} onClick={() => setActiveTab('remotes')}>Remotes</button>
        <button className={`git-tab-btn ${activeTab === 'status' ? 'active' : ''}`} onClick={() => setActiveTab('status')}>Status</button>
        <button className={`git-tab-btn ${activeTab === 'commits' ? 'active' : ''}`} onClick={() => setActiveTab('commits')}>Commits</button>
        <button className={`git-tab-btn ${activeTab === 'worktrees' ? 'active' : ''}`} onClick={() => setActiveTab('worktrees')}>Worktrees</button>
      </div>
      <div
        ref={splitPaneRef}
        className={`info-section info-section-split ${selectedFile ? 'with-diff' : ''} ${isResizingDiffPane ? 'is-resizing' : ''}`}
      >
        <div className="info-main-pane">
          <h2>{activeTabTitle}</h2>
          {renderTabContent()}
        </div>

        {selectedFile && (
          <>
            <div
              className="diff-splitter"
              onMouseDown={() => setIsResizingDiffPane(true)}
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize diff pane"
            />
            <div className="info-diff-pane" style={{ width: `${diffPaneWidth}px` }}>
              <div className="diff-toolbar">
                <h2>Diff: {selectedFile}</h2>
                <div className="diff-view-switch">
                  <button
                    type="button"
                    className={`diff-view-btn ${diffViewMode === 'sideBySide' ? 'active' : ''}`}
                    onClick={() => setDiffViewMode('sideBySide')}
                  >
                    Side by Side
                  </button>
                  <button
                    type="button"
                    className={`diff-view-btn ${diffViewMode === 'inline' ? 'active' : ''}`}
                    onClick={() => setDiffViewMode('inline')}
                  >
                    Inline
                  </button>
                </div>
              </div>
              <div className="diff-editor">
                <DiffEditor
                  height="100%"
                  language={getLanguageByFilePath(selectedFile)}
                  original={diffOriginal}
                  modified={diffModified}
                  options={{
                    readOnly: true,
                    minimap: { enabled: false },
                    renderSideBySide: diffViewMode === 'sideBySide',
                    enableSplitViewResizing: true,
                    wordWrap: 'off',
                    scrollBeyondLastLine: false,
                    wrappingIndent: 'same',
                    scrollbar: {
                      vertical: 'auto',
                      horizontal: 'auto',
                    },
                  }}
                />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default MainContent;
