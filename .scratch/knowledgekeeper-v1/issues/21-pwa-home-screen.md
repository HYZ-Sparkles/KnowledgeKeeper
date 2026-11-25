# 21: PWA 与添加到主屏幕

**What to build:** 应用能添加到 iPad 主屏幕，从图标打开是全屏无地址栏的独立应用；断网也能打开和使用全部功能；有新版本时下次打开生效。没有安装过的用户在首页看到一条可关闭的引导横幅；备份页有「装到 iPad 主屏幕」的说明。

**Blocked by:** 02 部署到 GitHub Pages

**Spec:** spec.md「用户故事 54–56」「PWA 与 iPad」「界面设计 · 首页（横幅）/ 备份页」

**Status:** ready-for-agent

- [ ] manifest：名称 Knowledge Keeper、standalone 显示、图标、主题色；service worker 预缓存应用壳，离线可打开全部视图；新版本在下次打开时生效，不做更新提示
- [ ] 从主屏幕图标打开：无地址栏、全屏；横竖屏都可用
- [ ] 首页横幅：未安装（display-mode 非 standalone）且未关闭时，在副标之下显示「在 Safari 点「分享 → 添加到主屏幕」，全屏使用，存储也不会被 Safari 清理。[知道了]」；关闭状态按设备记（不经过应用核心、不进备份）；已安装不再显示
- [ ] 备份页第三段「装到 iPad 主屏幕」说明块
- [ ] service worker、manifest、离线行为不在 seam 上测，留给 22 手测
