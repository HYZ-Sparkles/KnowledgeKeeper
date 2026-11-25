# 02: 部署到 GitHub Pages

**What to build:** 推送到主分支后，CI 自动安装、测试、构建并发布到 GitHub Pages；应用在子路径下用 hash 路由，桌面浏览器和 iPad Safari 打开发布地址就能看到行走骨架。这是之后每张 ticket 的发布通道。

**Blocked by:** 01 行走骨架

**Spec:** spec.md「架构」「PWA 与 iPad」；ADR-0003

**Status:** ready-for-agent

- [ ] 构建产物的 base 按 GitHub Pages 子路径（仓库名）配置；hash 路由在任何路径下可用，不带 hash 打开时落到首页
- [ ] CI workflow：pnpm + npmmirror 安装 → 测试 → 构建 → 发布到 Pages；测试不过不发布
- [ ] 发布地址在 iPad Safari 与桌面浏览器打开即见壳与首页；IndexedDB 在 Pages 域下可写、刷新后数据仍在
- [ ] 文档记一句：国内访问不稳时给同一份构建加 Cloudflare 备用入口，不改代码
