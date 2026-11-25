---
status: superseded by ADR-0003
---

# 用 Tauri 2 的 web UI，而非纯 Rust GUI

核心（存储、文件解析）用 Rust，界面用 React + TypeScript 渲染在系统 WebView 中，而不是 egui / iced 这类纯 Rust GUI。原因是目标用户不编程，界面需要精致且包含复杂布局（匹配题的左右分栏、多提交按钮、表格校对页），web 技术栈在这方面成本低得多；Win11 自带 WebView2，安装包仍然很小。代价：引入 Node 工具链、两种语言并存，以及 Rust ↔ 前端的 IPC 边界。
