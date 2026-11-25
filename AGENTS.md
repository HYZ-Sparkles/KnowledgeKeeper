## 编程环境

- 如果需要 Python，就用 UV 管理环境。不要污染全局环境。

## Commit 规范

格式：

```
<type>(<scope>): <subject>

<body>

<footer>
```

- `type` 取 `feat` / `fix` / `refactor` / `perf` / `test` / `docs` / `build` / `ci` / `chore` / `style` / `revert` 之一。
- `scope` 用领域词，取 `question`（题目与题型）、`import`（导入与校对）、`practice`（练习、轮、作答）、`srs`（遗忘曲线与到期）、`library`（题库与分组）、`backup`（备份与恢复）、`storage`（浏览器持久化）、`ui`、`tauri`、`docs`、`build` 之一；跨领域改动可省略 scope。术语一律以 `GLOSSARY.md` 为准。
- `subject` 用祈使句、小写开头、结尾不加句号，中文控制在 30 字内。
- `body` 解释**为什么**这么改，而不是重复 diff 里已能看出的**做了什么**；每行不超过 72 字符。
- 破坏性变更在 type 后加 `!`（如 `feat(storage)!:`），并在 footer 写 `BREAKING CHANGE: <说明>`。
- footer 关联 issue：`Closes #12`、`Refs #34`。
- 一个 commit 只做一件事，能独立 revert；纯格式化改动单独成 commit。
- 语言保持一致：subject 用英文或中文都行，但不要混写。

## Agent skills

### Issue tracker

Issues 作为 markdown 文件存放在 `.scratch/<feature-slug>/` 下（local-markdown tracker）。See `docs/agents/issue-tracker.md`.

### Triage labels

使用默认五个 canonical triage roles，label 字符串与 role name 相同。See `docs/agents/triage-labels.md`.

### Domain docs

Single-context：repo 根目录 `GLOSSARY.md` + `docs/adr/`。See `docs/agents/domain.md`.
