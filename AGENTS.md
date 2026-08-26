# Agent Rules

1. **BE CONCISE**: No yapping. Do not explain your steps. Output tools directly.
2. **STRICT JSON**: Ensure all tool calls use strict valid JSON with double quotes. Do not use raw markdown code blocks.
3. **MISE ONLY**: Execute `mise run <task>`. Do not use `pip` or manage dependencies manually.
4. **VERIFY**: Check files exist after writing. Do not hallucinate file contents.
5. **READ LESS**: Use `grep` or `head` before reading massive files. Keep context tight.
