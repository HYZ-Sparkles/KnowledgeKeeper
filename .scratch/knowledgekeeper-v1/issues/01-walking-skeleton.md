# 01: 行走骨架

**What to build:** 应用以静态网页的形式跑起来：三栏壳（顶栏、左栏分组、右轨、内容栏）与 hash 路由可用，首页列出分组——此时只有首次启动自动创建的默认分组「错题集」——及其题数。工程能开发、能测试、能构建。应用核心作为唯一 seam 存在，接受 storage adapter、clock、random 三个依赖而不自己创建；storage adapter 有 IndexedDB（经 Dexie）与内存两个实现；时钟与随机可注入，测试用固定值。第一个穿过 seam 的测试证明首次启动后默认分组存在。设计 token 从原型映射到 Tailwind theme。

**Blocked by:** None（can start immediately）

**Spec:** spec.md「架构」「唯一外部 seam」「数据模型」「界面设计 · 总则 / 壳 / 首页」

**Status:** ready-for-agent

- [ ] `pnpm dev`、`pnpm test`、`pnpm build` 可用；依赖安装走国内镜像（pnpm + npmmirror），不产生 package-lock.json / yarn.lock
- [ ] 应用核心接受 storage、clock、random 三个依赖；解析、排期、轮构建、备份序列化都是它的私有实现，UI 只调用它的 interface
- [ ] storage adapter 同一接口下有 IndexedDB（Dexie）与内存两个实现；存储布局覆盖分组、题目（含匹配题的共用选项与子题）、排期、作答（含子题序号）、题库元数据，字段按 spec「数据模型」
- [ ] 首次启动创建默认分组「错题集」；测试用内存 adapter + 固定时钟，断言分组列表恰有这一个分组、题数为 0
- [ ] 三栏壳：顶栏 56px sticky（品牌 Knowledge Keeper、导航、日期），左栏 240px 分组列表（名称，当前项加粗），右轨 220px，内容栏（面包屑 → 40px 标题 → 副标 → 药丸 → 发丝线 → 正文）；断点 ≤1180 / ≤960 / ≤760 按 spec「壳」
- [ ] hash 路由可直达 `#home`、`#group`；点分组行进入分组页（此时只有标题、副标与空列表），顶栏「题库」在两个视图下高亮；导航只放已实现的视图
- [ ] 设计 token 映射到 Tailwind theme：纸色、墨色、褐标题、琥珀、橙、蓝、绿、红及其浅底；字号层级 40 / 30 / 16 / 15 / 14 / 13.5 / 12.5；3–4px 圆角；文字对比度 ≥ 4.5:1、图形 ≥ 3:1；中文系统字体栈，不装 webfont
- [ ] 首页：副标「N 个分组，M 道题。做错的题会按 1、2、4、7、15、30 天重新出现，直到通过最后一个间隔。」、分组行（组名、N 题）；首页右轨的「排期」「存储」说明
- [ ] Vitest 配好；内存 adapter 与固定时钟 / 固定随机的测试工具可复用；不做 React 组件测试
