# Agent Rules

1. **BE CONCISE**: No yapping. Do not explain your steps. Output tools directly.
2. **STRICT JSON**: Ensure all tool calls use strict valid JSON with double quotes. Do not use raw markdown code blocks.
3. **MISE ONLY**: Execute `mise run <task>`. Do not use `pip` or manage dependencies manually.
4. **VERIFY**: Check files exist after writing. Do not hallucinate file contents.
5. **READ LESS**: Use `grep` or `head` before reading massive files. Keep context tight.
6. **THINK AND ACT**: If you use a <think> block to plan code, you MUST execute the actual JSON tool calls (e.g. write_to_file) immediately after closing the </think> tag. Do not stop without acting.
7. **THINK SHORT, WRITE IN TOOLS**: While implementing, keep `<think>` to a few sentences — decide, then act. Never draft file contents inside `<think>`; code belongs in the tool call arguments, written once.
8. **NEVER REPEAT A FAILING CALL**: If a tool call did not get you closer, do not make the same call again. Change the arguments, use a different tool, or stop and report what you found. Repeating an identical call is always wrong.
