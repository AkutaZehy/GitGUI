# GitGUI

[![wails](https://img.shields.io/badge/Wails-v2.11.0-3066a1.svg)](https://github.com/wailsapp/wails)
[![platform](https://img.shields.io/badge/platform-Windows-blue.svg)](https://github.com/AkutaZehy/GitGUI)
[![license](https://img.shields.io/badge/license-MIT-green.svg)](https://github.com/lxyzz/GitGUI/blob/main/LICENSE)
[![stars](https://img.shields.io/github/stars/AkutaZehy/GitGUI?style=social)](https://github.com/AkutaZehy/GitGUI)

一款面向中高级开发者的跨平台桌面 Git 客户端。

## 核心理念

- **终端贯通** - GUI 与终端无缝衔接
- **篡改记录** - 安全的历史重写能力
- **交互式节点** - 可视化的分支与提交管理

## 技术栈

- **框架**：Wails v2（Go 后端 + WebView 前端）
- **前端**：React + TypeScript + Vite
- **后端**：Go（调用 git CLI）
- **目标平台**：Windows（首发）

## 功能特性

### 已完成

- **仓库管理** - 打开本地 Git 仓库
- **分支管理** - 查看并切换本地/远程分支
- **文件状态** - 展示未跟踪/已修改/已暂存文件
- **Diff 查看** - 彩色显示，支持折叠/展开
- **Staging** - 暂存/取消暂存文件
- **提交** - 提交已暂存的更改
- **同步操作** - Refresh / Fetch / Pull / Push
- **可调节面板** - 拖拽分隔条调整三栏布局（默认 2:5:5）
- **Tip 通知** - 底部状态栏显示操作进度和结果
- **暗黑主题** - 舒适的眼部体验

### 开发中 (MVP 2)

- 嵌入式终端
- 状态自动同步
- 快捷入口

### 规划中 (MVP 3)

- Reset / Cherry-pick
- 分支图可视化
- 交互式 Rebase
- 冲突解决 UI
- 行级 Staging
- Worktree 管理

## 快速开始

### 环境要求

- Go 1.18+
- Node.js 18+
- Git

### 开发模式

```bash
wails dev
```

### 构建生产版本

```bash
wails build
```

构建产物位于 `build/bin/gitgui.exe`

## 使用方法

### 1. 打开仓库

点击工具栏「Open Repository」按钮，选择本地 Git 仓库目录。

### 2. 查看与刷新

- **Refresh** - 刷新本地文件状态
- **Staged Changes** - 已暂存的更改
- **Changes** - 未暂存的更改

点击文件可查看 Diff 详情。

### 3. 暂存与提交

- 点击文件旁的 `+` 按钮暂存文件
- 点击 `-` 按钮取消暂存
- 填写提交信息后点击「Commit」提交

### 4. 分支操作

- 从下拉菜单切换分支
- 远程分支显示 🌐 图标
- 切换分支时底部显示进度

### 5. 同步

- **Fetch** - 获取远程更新
- **Pull** - 拉取并合并
- **Push** - 推送到远程

### 6. 面板调节

拖拽中间的分隔条可调整三栏宽度，默认比例 2:5:5。

### 7. 状态通知

底部 Tip Bar 显示：
- 绿色 = Ready（就绪）
- 蓝色 = 操作进度和结果（如 Pulling... / Push completed）
- 红色 = 错误信息

## 项目结构

```
GitGUI/
├── app.go              # Wails 应用入口
├── git/                # Git 操作封装
├── main.go             # 程序入口
├── frontend/           # React 前端
│   ├── src/
│   │   ├── App.tsx   # 主组件
│   │   └── App.css    # 样式
│   └── package.json
└── build/             # 构建产物
```

## UI 布局

```
+------------------------------------------------------------------+
|  工具栏：Open Repository | Refresh | Fetch | Pull | Push         |
+------------------------------------------------------------------+
|         |                                      |                |
| 侧边栏   |        变更区域 + Staging            |   Diff 详情     |
|         |                                      |                |
| 分支选择 |  Staged Changes    Changes           |  彩色 diff     |
|         |                                      |                |
|         +--------------------------------------+                |
|         |  提交区域                             |                |
+---------+--------------------------------------+----------------+
|  Tip Bar：Ready / Pulling... / Push completed / Error            |
+-----------------------------------------------------------------+
```

## 致谢

- [**JetBrains Mono**](https://github.com/JetBrains/JetBrainsMono)
- [**霞鹜新晰黑 / LXGW Neo XiHei**](https://github.com/lxgw/LxgwNeoXiHei)

## 许可证

[MIT](./LICENSE)
