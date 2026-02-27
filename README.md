# GitGui

一个基于 Tauri + React + TypeScript 的桌面 Git 可视化工具。

## 功能

- 添加本地 Git 仓库工作区
- 查看分支（本地/远程）
- 查看远程仓库列表
- 查看提交记录（最多 50 条）
- 查看文件状态（new/modified/deleted）
- 查看 worktree 列表
- 切换本地分支

## 仓库选择方式

- 点击 `+ Add Workspace`：通过 Rust 侧原生目录选择器获取绝对路径（macOS）。
- 支持将文件夹直接拖拽到窗口中添加工作区。
- 如果路径不是绝对路径或不是 Git 仓库，会在主面板显示错误信息。

## 开发环境

- Node.js 18+
- Rust toolchain（建议 stable）
- Tauri v2
- macOS（当前原生目录选择命令仅实现了 macOS）

## 本地启动

```bash
npm install
npm run tauri dev
```

只运行前端（不含桌面能力）：

```bash
npm run dev
```

## 构建

```bash
npm run build
cd src-tauri && cargo check
```

## 技术栈

- Frontend: React 19, TypeScript, Vite
- Desktop: Tauri 2
- Git backend: Rust + git2
- Editor: Monaco Editor

## 已知限制

- `select_folder` 命令当前仅在 macOS 实现（使用 AppleScript 调系统文件夹选择器）。
- Diff 功能后端尚未实现，界面中暂未展示真实 diff 内容。
