import React, { useState, useRef, useEffect } from 'react';
import { invoke as tauriInvoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import Sidebar from './components/Sidebar';
import MainContent from './components/MainContent';
import { WorkspaceService } from './services/workspaceService';
import type { Workspace } from './types';
import './App.css';

const isTauriRuntime = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

function trimTrailingSlash(path: string): string {
  return path.replace(/[\\/]+$/, '');
}

function dirname(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/');
  const idx = normalized.lastIndexOf('/');
  if (idx <= 0) {
    return filePath;
  }
  return normalized.slice(0, idx);
}

function resolveFolderPath(file: File): string {
  const filePath = ((file as any).path || '') as string;
  const relativePath = (file.webkitRelativePath || '').replace(/\\/g, '/');

  if (filePath && relativePath.includes('/')) {
    const parts = relativePath.split('/');
    // e.g. repo/src/a.ts -> src/a.ts
    const suffix = parts.slice(1).join('/');
    if (suffix && filePath.endsWith(suffix)) {
      return trimTrailingSlash(filePath.slice(0, filePath.length - suffix.length));
    }
  }

  if (filePath) {
    return trimTrailingSlash(dirname(filePath));
  }

  if (relativePath) {
    return relativePath.split('/')[0];
  }

  return '';
}

function isAbsolutePath(path: string): boolean {
  return path.startsWith('/') || /^[A-Za-z]:[\\/]/.test(path);
}

function App() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState<Workspace | null>(null);
  const workspaceService = useRef(new WorkspaceService());
  const dropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // 加载工作区列表
    setWorkspaces(workspaceService.current.getAllWorkspaces());
  }, []);

  const addWorkspaceFromPath = (workspacePath: string) => {
    const normalizedPath = trimTrailingSlash(workspacePath.trim());
    if (!normalizedPath) {
      return;
    }
    const workspace = workspaceService.current.addWorkspace(normalizedPath);
    console.log('Workspace added:', workspace);
    setWorkspaces(workspaceService.current.getAllWorkspaces());
    setSelectedWorkspace(workspace);
  };

  useEffect(() => {
    if (!isTauriRuntime) {
      return;
    }

    let unlisten: (() => void) | undefined;
    const setup = async () => {
      try {
        unlisten = await getCurrentWindow().onDragDropEvent((event) => {
          if (event.payload.type !== 'drop') {
            return;
          }
          const firstPath = event.payload.paths[0];
          if (firstPath) {
            addWorkspaceFromPath(firstPath);
          }
        });
      } catch (error) {
        console.error('Failed to setup drag and drop listener:', error);
      }
    };
    setup();

    return () => {
      if (unlisten) {
        unlisten();
      }
    };
  }, []);

  const handleAddWorkspace = () => {
    if (isTauriRuntime) {
      tauriInvoke<string | null>('select_folder')
        .then((selectedPath) => {
          if (selectedPath) {
            addWorkspaceFromPath(selectedPath);
          }
        })
        .catch((error) => {
          console.error('Failed to open native folder dialog:', error);
          alert(`打开文件夹选择器失败: ${String(error)}`);
        });
      return;
    }

    console.log('Add Workspace button clicked');
    try {
      // 创建一个文件夹选择输入框
      const input = document.createElement('input');
      input.type = 'file';
      input.webkitdirectory = true;
      input.dir = '';
      input.style.display = 'none';
      
      // 处理文件选择事件
      input.onchange = (e) => {
        const target = e.target as HTMLInputElement;
        if (target.files && target.files.length > 0) {
          const file = target.files[0];
          const folderPath = resolveFolderPath(file);
          console.log('Folder selected:', folderPath);
          if (folderPath) {
            if (isTauriRuntime && !isAbsolutePath(folderPath)) {
              alert('未获取到绝对路径。请拖拽仓库文件夹到窗口，或手动输入绝对路径。');
              showBrowserInput();
              return;
            }
            addWorkspaceFromPath(folderPath);
          }
        }
        // 移除元素
        try {
          document.body.removeChild(input);
        } catch (removeError) {
          console.error('Error removing input element:', removeError);
        }
      };
      
      // 添加元素到页面并触发点击
      try {
        document.body.appendChild(input);
        input.click();
      } catch (appendError) {
        console.error('Error adding input element:', appendError);
        // 回退到输入框方式
        showBrowserInput();
      }
    } catch (error) {
      console.error('Error in handleAddWorkspace:', error);
      // 回退到输入框方式
      showBrowserInput();
    }
  };

  // 显示浏览器输入框的辅助函数
  const showBrowserInput = () => {
    console.log('Using browser input');
    // 创建一个临时的输入框元素
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Enter absolute Git repository path';
    input.style.position = 'fixed';
    input.style.top = '50%';
    input.style.left = '50%';
    input.style.transform = 'translate(-50%, -50%)';
    input.style.padding = '10px';
    input.style.fontSize = '16px';
    input.style.border = '1px solid #ccc';
    input.style.borderRadius = '4px';
    input.style.zIndex = '9999';
    
    // 创建一个确认按钮
    const button = document.createElement('button');
    button.textContent = 'Add';
    button.style.position = 'fixed';
    button.style.top = '60%';
    button.style.left = '50%';
    button.style.transform = 'translate(-50%, -50%)';
    button.style.padding = '10px 20px';
    button.style.fontSize = '16px';
    button.style.backgroundColor = '#3498db';
    button.style.color = 'white';
    button.style.border = 'none';
    button.style.borderRadius = '4px';
    button.style.cursor = 'pointer';
    button.style.zIndex = '9999';
    
    // 处理按钮点击事件
    button.onclick = () => {
      const folderPath = input.value;
      console.log('Folder path entered:', folderPath);
      if (folderPath && folderPath.trim() !== '') {
        addWorkspaceFromPath(folderPath);
      }
      // 移除元素
      try {
        document.body.removeChild(input);
        document.body.removeChild(button);
      } catch (removeError) {
        console.error('Error removing input elements:', removeError);
      }
    };
    
    // 添加元素到页面
    try {
      document.body.appendChild(input);
      document.body.appendChild(button);
      // 聚焦输入框
      input.focus();
    } catch (appendError) {
      console.error('Error adding input elements:', appendError);
    }
  };

  const handleWorkspaceClick = (workspace: Workspace) => {
    workspaceService.current.updateWorkspaceLastOpened(workspace.id);
    setWorkspaces(workspaceService.current.getAllWorkspaces());
    setSelectedWorkspace(workspace);
  };

  const handleRemoveWorkspace = (id: string) => {
    workspaceService.current.removeWorkspace(id);
    setWorkspaces(workspaceService.current.getAllWorkspaces());
    if (selectedWorkspace?.id === id) {
      setSelectedWorkspace(null);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    // Tauri 文件拖拽通过 onDragDropEvent 处理，这里只阻止浏览器默认行为
    e.preventDefault();
  };

  return (
    <div 
      className="app"
      ref={dropRef}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <Sidebar
        workspaces={workspaces}
        onWorkspaceClick={handleWorkspaceClick}
        onRemoveWorkspace={handleRemoveWorkspace}
        onAddWorkspace={handleAddWorkspace}
      />
      <div className="content-area">
        {selectedWorkspace ? (
          <MainContent workspacePath={selectedWorkspace.path} />
        ) : (
          <div className="welcome-screen">
            <h1>Welcome to GitGui</h1>
            <p>Add a Git repository to get started</p>
            <button onClick={handleAddWorkspace}>Add Workspace</button>
            <p className="drop-hint">or drag and drop a Git repository folder here</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
