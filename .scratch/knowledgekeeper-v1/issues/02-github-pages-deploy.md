# 02: 部署到 GitHub Pages

**What to build:** 推送到主分支后，CI 自动安装、测试、构建并发布到 GitHub Pages；应用在子路径下用 hash 路由，桌面浏览器和 iPad Safari 打开发布地址就能看到行走骨架。这是之后每张 ticket 的发布通道。

**Blocked by:** 01 行走骨架

**Spec:** spec.md「架构」「PWA 与 iPad」；ADR-0003

**Status:** resolved

- [x] 构建产物的 base 按 GitHub Pages 子路径（仓库名）配置；hash 路由在任何路径下可用，不带 hash 打开时落到首页
- [x] CI workflow：pnpm + npmmirror 安装 → 测试 → 构建 → 发布到 Pages；测试不过不发布
- [ ] 发布地址在 iPad Safari 与桌面浏览器打开即见壳与首页；IndexedDB 在 Pages 域下可写、刷新后数据仍在
- [x] 文档记一句：国内访问不稳时给同一份构建加 Cloudflare 备用入口，不改代码

## Comments

- 2026-11-26 · agent：已实现并合入 `feat/knowledgekeeper-v1`，commit `037d503 ci(build): 添加 GitHub Pages 发布流程`。
  - `.github/workflows/deploy.yml`：pnpm 12.23.0 + npmmirror(`.npmrc`) → `pnpm test` → `pnpm build` → Pages 发布；deploy job `needs: build`，测试不过不发布。
  - 国内访问不稳时同一份构建加 Cloudflare 备用入口的一句说明写在 `README.md`。
  - **需人工验证（第 3 项保留未勾选）**：本仓库当前无远端、未推送，无法在本地验证真实 Pages 地址在 iPad Safari / 桌面浏览器打开，以及 Pages 域下 IndexedDB 刷新后数据仍在。推送主分支并启用 Pages 后请逐项确认。
