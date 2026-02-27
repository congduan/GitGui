import type { Workspace } from '../types';

// 检测是否在浏览器环境中
const isBrowser = typeof window !== 'undefined';

export class WorkspaceService {
  private workspaces: Workspace[] = [];
  private STORAGE_KEY = 'gitgui-workspaces';

  constructor() {
    this.loadWorkspaces();
  }

  private loadWorkspaces(): void {
    try {
      if (isBrowser) {
        // 在浏览器环境中使用localStorage
        const data = localStorage.getItem(this.STORAGE_KEY);
        if (data) {
          this.workspaces = JSON.parse(data);
        }
      } else {
        // 在Node.js环境中使用文件系统
        const fs = require('fs');
        const path = require('path');
        const WORKSPACES_FILE = path.join(process.env.HOME || '', '.gitgui', 'workspaces.json');
        
        const dir = path.dirname(WORKSPACES_FILE);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        
        if (fs.existsSync(WORKSPACES_FILE)) {
          const data = fs.readFileSync(WORKSPACES_FILE, 'utf8');
          this.workspaces = JSON.parse(data);
        }
      }
    } catch (error) {
      console.error('Failed to load workspaces:', error);
      this.workspaces = [];
    }
  }

  private saveWorkspaces(): void {
    try {
      if (isBrowser) {
        // 在浏览器环境中使用localStorage
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.workspaces, null, 2));
      } else {
        // 在Node.js环境中使用文件系统
        const fs = require('fs');
        const path = require('path');
        const WORKSPACES_FILE = path.join(process.env.HOME || '', '.gitgui', 'workspaces.json');
        
        const dir = path.dirname(WORKSPACES_FILE);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        
        fs.writeFileSync(WORKSPACES_FILE, JSON.stringify(this.workspaces, null, 2));
      }
    } catch (error) {
      console.error('Failed to save workspaces:', error);
    }
  }

  getAllWorkspaces(): Workspace[] {
    return this.workspaces.sort((a, b) => b.lastOpened - a.lastOpened);
  }

  addWorkspace(workspacePath: string): Workspace {
    const existingIndex = this.workspaces.findIndex(w => w.path === workspacePath);
    
    // 提取文件夹名称
    let workspaceName = workspacePath;
    if (isBrowser) {
      // 在浏览器环境中
      workspaceName = workspacePath.split('/').pop() || workspacePath;
    } else {
      // 在Node.js环境中
      const path = require('path');
      workspaceName = path.basename(workspacePath);
    }
    
    const workspace: Workspace = {
      id: existingIndex >= 0 ? this.workspaces[existingIndex].id : `ws-${Date.now()}`,
      path: workspacePath,
      name: workspaceName,
      lastOpened: Date.now(),
    };

    if (existingIndex >= 0) {
      this.workspaces[existingIndex] = workspace;
    } else {
      this.workspaces.push(workspace);
    }

    this.saveWorkspaces();
    return workspace;
  }

  removeWorkspace(id: string): void {
    this.workspaces = this.workspaces.filter(w => w.id !== id);
    this.saveWorkspaces();
  }

  updateWorkspaceLastOpened(id: string): void {
    const workspace = this.workspaces.find(w => w.id === id);
    if (workspace) {
      workspace.lastOpened = Date.now();
      this.saveWorkspaces();
    }
  }
}
