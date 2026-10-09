"""Tool-call parser for K2-Horizon's `ifm|` tags, registered into mlx_lm.server at start.

K2-Horizon writes GLM-4.7-shaped calls with renamed tags (issue #183):
    <ifm|tool_calls><ifm|tool_call>NAME<ifm|arg_key>k</ifm|arg_key><ifm|arg_value>v</ifm|arg_value></ifm|tool_call></ifm|tool_calls>
and reasons inside <ifm|think>...</ifm|think>. mlx-lm 0.31.3 infers neither, so the server
returned the raw text and no tool_calls. The server task runs this file instead of
mlx_lm.server when the profile sets MLX_TOOL_PARSER = "ifm"; it reuses mlx-lm's glm47 parser
after renaming the tags. Self-check: python .mise/tasks/_ifm_parser.py --check
"""
import re
import sys

tool_call_start = "<ifm|tool_calls>"
tool_call_end = "</ifm|tool_calls>"
THINK = ("<ifm|think>", "</ifm|think>")

_call = re.compile(r"<ifm\|tool_call>(.*?)(?:</ifm\|tool_call>|$)", re.DOTALL)
_arg_type = re.compile(r"<ifm\|arg_type>.*?</ifm\|arg_type>", re.DOTALL)


def parse_tool_call(text, tools=None):
    from mlx_lm.tool_parsers import glm47
    bodies = _call.findall(text) or [text]
    out = []
    for body in bodies:
        body = _arg_type.sub("", body).replace("ifm|arg_", "arg_")
        if body.strip():
            out.append(glm47.parse_tool_call(body, tools))
    return out


def _register():
    from mlx_lm import tokenizer_utils as tu
    sys.modules["mlx_lm.tool_parsers.ifm"] = sys.modules[__name__]
    infer_tool, infer_think = tu._infer_tool_parser, tu._infer_thinking
    tu._infer_tool_parser = lambda tok: "ifm" if tool_call_start in tok.get_vocab() else infer_tool(tok)

    def think(tok):
        vocab = tok.get_vocab()
        if all(t in vocab for t in THINK):
            return (*THINK, (vocab[THINK[0]],), (vocab[THINK[1]],))
        return infer_think(tok)
    tu._infer_thinking = think


def _check():
    tools = [{"function": {"name": "write", "parameters": {"properties": {
        "path": {"type": "string"}, "content": {"type": "string"}, "opts": {"type": "object"}}}}}]
    one = "\n<ifm|tool_call>read\n<ifm|arg_key>path</ifm|arg_key>\n<ifm|arg_value>a.py</ifm|arg_value>\n</ifm|tool_call>\n"
    assert parse_tool_call(one) == [{"name": "read", "arguments": {"path": "a.py"}}]
    two = one + ("<ifm|tool_call>write\n<ifm|arg_key>path</ifm|arg_key>\n<ifm|arg_type>string</ifm|arg_type>\n"
                 "<ifm|arg_value>b.json</ifm|arg_value>\n<ifm|arg_key>content</ifm|arg_key>\n"
                 '<ifm|arg_value>{"x": 1}</ifm|arg_value>\n<ifm|arg_key>opts</ifm|arg_key>\n'
                 '<ifm|arg_value>{"force": true, "n": [1, 2]}</ifm|arg_value>\n</ifm|tool_call>\n')
    got = parse_tool_call(two, tools)
    assert [c["name"] for c in got] == ["read", "write"], got
    assert got[1]["arguments"] == {"path": "b.json", "content": '{"x": 1}', "opts": {"force": True, "n": [1, 2]}}, got
    js = '\n<ifm|tool_call>{"name": "bash", "arguments": {"cmd": "ls"}}</ifm|tool_call>\n'
    assert parse_tool_call(js) == [{"name": "bash", "arguments": {"cmd": "ls"}}]
    # Think block: the server splits it off as reasoning by these token ids.
    class Tok:
        def get_vocab(self):
            return {"<ifm|think>": 7, "</ifm|think>": 8, tool_call_start: 9}
    _register()
    from mlx_lm import tokenizer_utils as tu
    assert tu._infer_thinking(Tok()) == ("<ifm|think>", "</ifm|think>", (7,), (8,))
    assert tu._infer_tool_parser(Tok()) == "ifm"
    import importlib
    assert importlib.import_module("mlx_lm.tool_parsers.ifm").parse_tool_call is parse_tool_call
    print("ok: ifm parser self-check")


if __name__ == "__main__":
    if sys.argv[1:] == ["--check"]:
        _check()
    else:
        _register()
        from mlx_lm.server import main
        sys.argv[0] = "mlx_lm.server"
        main()
