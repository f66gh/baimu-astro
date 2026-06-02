# Prompts

这个目录统一存放给其他模型或 agent 使用的项目提示词。它们不是网站正文内容，也不是构建产物。

## 命名规则

- 文件名使用 `主题-任务-目标模型.md`。
- 给 Gemini 的一次性交付提示词以 `-gemini.md` 结尾。
- 给 Codex 或本地 agent 的提示词以 `-codex.md` 结尾。
- 每个提示词开头写清楚用途、目标输出路径、相关上下文和验收标准。

## 示例

- `field-solver-interactive-gemini.md`
- `transistor-visualization-gemini.md`
- `note-polish-codex.md`
