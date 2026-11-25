# 17: 文件导入：PDF 与 Word

**What to build:** 在 iPad 上从「文件」app 里选一个文字版 PDF 或 .docx，应用把文字提取出来放进同一个可编辑的文本框，再走和粘贴一样的「开始校对」；提取需要时间时有「正在提取…」状态，选了 .doc 得到「请在 Word 里另存为 .docx」的提示，提取失败有明确警示。提取质量差时用户可以直接全选换成自己粘贴的文本。

**Blocked by:** 13 粘贴文本导入：解析、校对、写入

**Spec:** spec.md「用户故事 1、3、13」「解析规则（二进制提取 adapter）」「界面设计 · 导入页」

**Status:** resolved

- [x] 导入第一步工具栏：「从「文件」选择」（系统文件选择器，本张接受 .pdf .docx，.xlsx / .xls 在 18 加）+「或直接粘贴文本」
- [x] 选文件后按钮变「正在提取…」并禁用；完成后文本填进文本框并在上方显示「已从「文件名」提取约 N 字」；文本框内容可编辑，之后与粘贴流程一致
- [x] `.doc` → 文本框下方持久警示条「请在 Word 里另存为 .docx」；不支持的格式、提取失败、提取出 0 字 → 各自明确的警示条，不进校对页
- [x] 二进制文本提取是 adapter：PDF 用 pdf.js（文字版），Word 用 mammoth（.docx）；提取结果交给同一个文本解析器
- [x] seam 测试：每种格式一个文字版样本（.pdf / .docx），只验证文本能提出来
- [x] 文件选择在 iPad 上的实际行为留给 22 手测

## Comments

- 2026-11-26 · agent：已实现并合入 `feat/knowledgekeeper-v1`，commit `57a155b feat(import): 加入 PDF 与 Word 文本提取`。
  - `importFromFile` 加入应用核心；私有 adapter 用 pdf.js（legacy build，兼容 Vitest node 环境）与 mammoth 提取纯文本，再走与粘贴相同的解析器；.doc / 不支持格式 / 提取失败 / 0 字各有明确警示条。
  - 验证：`pnpm test` 16 文件 / 81 测试通过；`pnpm build` 通过。真机文件选择留给 22 手测。
