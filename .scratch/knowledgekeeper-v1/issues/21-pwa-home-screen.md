# 21: PWA 与添加到主屏幕

**What to build:** 应用能添加到 iPad 主屏幕，从图标打开是全屏无地址栏的独立应用；断网也能打开和使用全部功能；有新版本时下次打开生效。没有安装过的用户在首页看到一条可关闭的引导横幅；备份页有「装到 iPad 主屏幕」的说明。

**Blocked by:** 02 部署到 GitHub Pages

**Spec:** spec.md「用户故事 54–56」「PWA 与 iPad」「界面设计 · 首页（横幅）/ 备份页」

**Status:** resolved

- [x] manifest：名称 Knowledge Keeper、standalone 显示、图标、主题色；service worker 预缓存应用壳，离线可打开全部视图；新版本在下次打开时生效，不做更新提示
- [ ] 从主屏幕图标打开：无地址栏、全屏；横竖屏都可用
- [x] 首页横幅：未安装（display-mode 非 standalone）且未关闭时，在副标之下显示「在 Safari 点「分享 → 添加到主屏幕」，全屏使用，存储也不会被 Safari 清理。[知道了]」；关闭状态按设备记（不经过应用核心、不进备份）；已安装不再显示
- [x] 备份页第三段「装到 iPad 主屏幕」说明块
- [x] service worker、manifest、离线行为不在 seam 上测，留给 22 手测

## Comments

- 2026-11-26 · agent：已实现并合入 `feat/knowledgekeeper-v1`，commit `8baab49 feat: 支持添加到主屏幕与离线使用`。
  - `public/manifest.webmanifest`（standalone、图标、主题色、子路径 start_url）、`index.html` 的 iOS meta 与 180×180 apple-touch-icon、手写的 `public/sw.js`（Vite 构建插件按真实 hashed 产物盖章预缓存清单 + 运行时缓存 /assets/，`skipWaiting()` / `clients.claim()`，无更新提示），注册用 `document.baseURI` 保持在 `/KnowledgeKeeper/` 作用域内。
  - 首页横幅按 `display-mode` 与按设备的 localStorage 关闭状态显示；备份页第三段「装到 iPad 主屏幕」说明块已填入预留 slot。
  - 验证：`pnpm test` 18 文件 / 90 测试通过；`pnpm build` 通过且 `dist/` 含 sw.js / manifest.webmanifest / 四个图标。按 Testing Decisions 未给 SW / manifest / 离线行为加 seam 测试。
  - **第 2 项保留未勾选，需人工在真实 iPad 上验证**：从主屏图标打开是否无地址栏、全屏，横竖屏是否都可用；连同离线、Safari 存储豁免一并记入 22 的清单。
