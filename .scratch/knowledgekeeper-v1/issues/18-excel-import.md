# 18: Excel 导入与模板

**What to build:** 用户按固定列（题型 | 题干 | A–F | 答案 | 解析）整理的 .xlsx / .xls 能从「文件」选择导入，经同一个校对页写入分组；题型列留空时走推断；提供模板文件下载。

**Blocked by:** 17 文件导入：PDF 与 Word

**Spec:** spec.md「用户故事 12」「解析规则（Excel）」

**Status:** resolved

- [x] 文件选择器接受 .xlsx / .xls（SheetJS）：首行表头，固定列 `题型 | 题干 | A | B | C | D | E | F | 答案 | 解析`；空行跳过；题型列可空（走推断）
- [x] Excel 不承载匹配题：题型列写「匹配题」的行报为明确错误并指出行号
- [x] 答案列与解析列的规范化与文本导入一致（大写、判断符号）
- [x] 选 Excel 不经过文本框，直接进校对页
- [x] 导入页提供模板文件下载（表头 + 一两行示例）
- [x] seam 测试：模板形状的工作簿 → 草稿内容与警示正确；题型列空时推断；.xls 与 .xlsx 各一个样本能解析

## Comments

- 2026-11-26 · agent：已实现并合入 `feat/knowledgekeeper-v1`，commit `1bb8998 feat(import): 支持 Excel 导入与模板下载`。
  - SheetJS 固定列、空题型列走推断、匹配题行报出真实行号、答案 / 解析规范化；选 Excel 直接进校对页；模板运行时生成 .xlsx 下载。
  - `src/core/__fixtures__/` 放入极小的真实 .pdf / .docx / .xls / .xlsx 样本，seam 测试只验证文本能提出来。
  - 验证：`pnpm test` 16 文件 / 81 测试通过；`pnpm build` 通过；只提交 pnpm-lock.yaml。
