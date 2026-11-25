# 静态网页应用，部署在 GitHub Pages，不用后端

目标用户使用 iPad，装不了桌面应用，因此 KnowledgeKeeper 改为纯前端静态网页应用，部署在 GitHub Pages：没有后端、没有账号、没有跨设备同步，数据存在浏览器的 IndexedDB 中，以 JSON 备份 / 恢复作为数据安全的兜底。这取代了 ADR-0001 / 0002 的本地桌面应用方案。被否决的方案：Tauri 桌面应用（iPad 不可用）；带后端的同步服务（账号、托管、维护成本）。

## Consequences

- 浏览器存储可能被清理（iOS / iPadOS Safari 会删除 7 天未访问站点的脚本可写存储）。缓解手段：做成可添加到主屏幕的 PWA（主屏网页应用的存储不受此限，首次使用时引导添加）+ service worker 离线缓存；首页提醒备份。没有云端兜底。
- `*.github.io` 在中国大陆访问不稳定；必要时给同一份构建加 Cloudflare 作为备用入口，不改代码。
- `.doc`（Word 97-2003）仍不支持——浏览器端只有 docx 解析库。
