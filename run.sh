#!/bin/bash

# 一键运行GitGui应用
echo "启动GitGui应用..."

# 检查是否安装了依赖
if [ ! -d "node_modules" ]; then
  echo "正在安装依赖..."
  npm install
fi

# 启动Tauri开发服务器
echo "启动Tauri开发服务器..."
npm run tauri dev
