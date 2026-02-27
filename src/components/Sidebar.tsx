import React from 'react';
import type { Workspace } from '../types';

interface SidebarProps {
  workspaces: Workspace[];
  onWorkspaceClick: (workspace: Workspace) => void;
  onRemoveWorkspace: (id: string) => void;
  onAddWorkspace: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  workspaces,
  onWorkspaceClick,
  onRemoveWorkspace,
  onAddWorkspace,
}) => {
  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <h2>GitGui</h2>
        <button onClick={onAddWorkspace} className="add-workspace-btn">
          + Add Workspace
        </button>
      </div>
      <div className="workspaces-list">
        {workspaces.map(workspace => (
          <div
            key={workspace.id}
            className="workspace-item"
            onClick={() => onWorkspaceClick(workspace)}
          >
            <div className="workspace-info">
              <div className="workspace-name">{workspace.name}</div>
              <div className="workspace-path">{workspace.path}</div>
            </div>
            <button
              className="remove-workspace-btn"
              onClick={(e) => {
                e.stopPropagation();
                onRemoveWorkspace(workspace.id);
              }}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Sidebar;
