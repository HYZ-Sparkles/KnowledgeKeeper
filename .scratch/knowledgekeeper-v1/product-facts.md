# 事实验证

## 产品自身

KnowledgeKeeper 是本次新做的产品，没有已发布版本、没有版本号、没有规格需要核实。
原型里出现的所有界面、数字、题面都是为演示构造的真实内容（不是 Lorem，也不是真实用户数据）。

## 参照站（用户指定）

- 站点：https://csgraduates.com/constitution_principle/representation/
- 事实：Hugo 生成的文档站，主题是 Docsy（Bootstrap 5 + SCSS 定制），中文，主题为「计算机考研杂货铺」。
- 色值不是猜的：从 `scss/main.min.*.css` 与 1440×900 截图里量出来的，记录在
  `refs/measured.md`。截图：`refs/board-1.jpg`（首屏）、`refs/full-1.jpg`（整页）、
  `refs/home-1.jpg`（深色 hero 首页）。
- 没有把它的插画、图标、课程内容搬进原型；只取色调与版式语言。

## 第二参照（练习界面）

- 产品：Brilliant（brilliant.org，iPad App Store 截图）
- 来源：`scripts/appstore_shots.py "Brilliant" --ipad` → `refs/brill.jpg/Brilliant-Learn-Math-Coding.jpg`
- 核实过的：练习页提交后底部出现整条绿色反馈（「Correct! +15 XP」），选项是整宽行，
  计划列表右侧用极小的圆点表示进度。
- 没能亲眼看到的：练习界面的完整交互流程（需登录）。原型里只用上面三条看见的机制。

## 不做的事

不编造用户评价、下载量、logo 墙、正确率统计来源。原型里的「正确率 74%」是演示数据，
界面上没有把它包装成真实统计背书。
