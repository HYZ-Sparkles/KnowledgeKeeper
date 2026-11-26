# 24: 匹配题子题多时共用选项被滚走

**What to build:** 用户反馈：做匹配题时子题很多，翻动页面看后面的子题，左侧「共用选项」面板会跟着页面一起滚出屏幕，看不见选项就没法作答。要求面板固定在一个位置，随子题滚动一起移动，直到整道匹配题结束才离开。

**Blocked by:** None

**Spec:** spec.md「界面设计 · 练习页」「Testing Decisions」（React 渲染不做 seam 自动化测试）

**Status:** resolved

- [x] 宽屏两栏：共用选项面板 sticky 在 56px 顶栏下方（top 68px），翻子题时始终可见；最后一个子题滚过后随 `.match` 一起离开，不遮提交行与反馈块。
- [x] 面板高度不超过视口（100dvh − 80px）；共用选项很多时只滚面板内部，标题「共用选项」留在原位，滚动不带走整页。
- [x] ≤760 单列：`.match` 改成块流，让 sticky 的包含块覆盖整段子题列表（留在 grid 里只占自己那一行）；面板限高 42dvh，给子题留出可见区域。
- [x] 不改判分、轮、排期与任何文案规则。

## Comments

- 2026-11-26 · 用户：问题反馈「共用选项在页面翻动时会被翻过去」，要求固定在一个位置、能够一起移动。
- 2026-11-26 · agent：`src/index.css` 给 `.shared` 加 sticky / 限高 / 层级，`.shared-scroll` 包住选项列表；`src/ui/PracticeView.tsx` 补这一层包装。窄屏把 `.match` 从单列 grid 改成 block，否则 sticky 的包含块只有自己那一行高。
  - 验证：`pnpm build`（tsc -b + vite build）通过；`pnpm test` 19 文件 / 96 测试通过。本改动是 CSS / 渲染，按 spec「Testing Decisions」不做 seam 自动化测试。
  - 浏览器验证（Chromium，注入同结构页面 + 构建出的 CSS，16 个子题）：宽屏 1524×824 下滚到 300 / 700 / 1189px，面板 top 恒为 68px；滚到底时面板底边与 `.match` 底边齐平，提交行无遮挡。窄屏 600×800 下 `.match` 为 block，面板 top 恒为 68px。26 个共用选项、视口 700px 高时面板限高 620px，内部 559 / 1383 可滚且标题不动。
  - 手测数据：`docs/matching-sticky-test-data.md`（可直接粘贴的 4 道题：20 / 8 / 2 个子题的匹配题 + 1 道普通题，覆盖长列表、长选项、短页面、切题）。已用临时测试经 `importFromText` + `commitReview` 验证：4 道题、无缺答案警示、共用选项 10 / 10 / 3、子题 20 / 8 / 2，写入成功。
  - 待人工：真实 iPad Safari 竖屏 / 横屏各滚一次，见 `docs/ipad-manual-checklist.md` 第 7 项。
