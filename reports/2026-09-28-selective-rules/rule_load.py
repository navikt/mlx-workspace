"""Static rule-load figures for reports/2026-09-28-selective-rules. Read-only, offline.

  .venv/bin/python rule_load.py session <session-state dir>...   # split a Copilot system prompt
  .venv/bin/python rule_load.py pakke <agentpakke checkout>...   # inventory instructions/agents/skills
  .venv/bin/python rule_load.py recall [session-state root]      # did sessions view scoped rules?

Counts are Qwen3.6 tokens, from the cached optiq tokenizer (HF_HUB_OFFLINE, no download).
"""
import glob, json, math, os, re, sys
from collections import defaultdict

os.environ["HF_HUB_OFFLINE"] = "1"


def counter():
    from tokenizers import Tokenizer
    path = glob.glob(os.path.expanduser(
        "~/.cache/huggingface/hub/models--mlx-community--Qwen3.6-35B-A3B-OptiQ-4bit/snapshots/*/tokenizer.json"))[0]
    tok = Tokenizer.from_file(path)
    return lambda s: len(tok.encode(s, add_special_tokens=False).ids)


def events(d):
    for line in open(os.path.join(d, "events.jsonl")):
        try:
            yield json.loads(line)
        except ValueError:
            pass


def split_prompt(txt):
    """Cut a Copilot CLI system.message into the parts nav-pilot controls; the rest is 'base'."""
    parts = {}
    for a, b, name in (("<available_skills>", "</available_skills>", "skills"),
                       ("<agent_instructions>", "</agent_instructions>", "agent_body")):
        i = txt.find(a)
        j = txt.find(b, i) if i >= 0 else -1
        if j >= 0:
            parts[name] = txt[i:j + len(b)]
            txt = txt[:i] + txt[j + len(b):]
    i, j = txt.find("<custom_instruction>"), txt.find("<system_notifications>")
    if 0 <= i < j:
        block = txt[i:j]
        txt = txt[:i] + txt[j:]
        t = block.find("Here is a list of instruction files")
        parts["always_on"] = block[:t] if t >= 0 else block
        parts["applyTo_table"] = block[t:] if t >= 0 else ""
    parts["base"] = txt
    return parts


def cmd_session(dirs):
    n = counter()
    for d in dirs:
        meta = {}
        for e in events(d):
            if e["type"] == "session.start":
                meta["model"] = e["data"].get("selectedModel")
            if e["type"] == "subagent.selected":
                meta["agent"] = e["data"]["agentName"]
            if e["type"] == "session.shutdown":
                meta["copilot_estimate"] = {k: e["data"].get(k) for k in ("systemTokens", "toolDefinitionsTokens")}
            if e["type"] == "system.message" and "prompt" not in meta:
                meta["prompt"] = e["data"]["content"]
        p = split_prompt(meta.pop("prompt"))
        row = {k: n(v) for k, v in p.items()}
        row["always_on_files"] = {
            (re.search(r"(?m)^# (.+)$", f) or [None, "head"])[1]: n(f)
            for f in re.split(r"(?m)^---\n(?=applyTo)", p.get("always_on", "")) if f.strip()}
        row["skills"] = [row.get("skills", 0), p.get("skills", "").count("<name>")]
        row["total"] = sum(n(v) for v in p.values())
        print(json.dumps({"session": os.path.basename(d)[:8], **meta, **row}, ensure_ascii=False))


def frontmatter(text):
    m = re.match(r"---\n(.*?)\n---\n?", text, re.S)
    meta = {}
    for line in (m.group(1).splitlines() if m else []):
        k, _, v = line.partition(":")
        if v.strip():
            meta[k.strip()] = v.strip().strip("'\"")
    return meta


def cmd_pakke(roots):
    n = counter()
    for root in roots:
        print("==", root)
        always = scoped = 0
        for f in sorted(glob.glob(root + "/instructions/*.instructions.md")):
            t = open(f).read()
            glob_ = frontmatter(t).get("applyTo", "(none)")
            k = n(t)
            if glob_ in ("**", "(none)"):
                always += k
            else:
                scoped += k
            print("  %-40s %-30s %5d" % (os.path.basename(f), glob_, k))
        print("  instructions: always-on %d, file-scoped %d" % (always, scoped))
        agents = [frontmatter(open(f).read()) for f in glob.glob(root + "/agents/*.agent.md")]
        print("  agents %d, name+description %d" % (
            len(agents), sum(n(a.get("name", "") + " " + a.get("description", "")) for a in agents)))
        skills = glob.glob(root + "/skills/*/SKILL.md")
        listing = sum(n("<skill>\n  <name>%s</name>\n  <description>%s</description>\n  <location>user</location>\n</skill>\n"
                        % (m.get("name", ""), m.get("description", "")))
                      for m in (frontmatter(open(f).read()) for f in skills))
        bodies = sum(n(open(f).read()) for f in skills)
        print("  skills %d, listing %d, bodies %d" % (len(skills), listing, bodies))


def wilson(k, n, z=1.96):
    if not n:
        return (0.0, 0.0)
    p, d = k / n, 1 + z * z / n
    c, h = p + z * z / (2 * n), z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n))
    return ((c - h) / d, (c + h) / d)


def cmd_recall(root):
    """Sessions whose prompt carried the applyTo table and that edited a file the rule covers:
    did the model open the rule (any tool call naming the file)?"""
    kt, sec = defaultdict(lambda: [0, 0]), defaultdict(lambda: [0, 0])
    for d in glob.glob(os.path.join(root, "*")):
        if not os.path.exists(os.path.join(d, "events.jsonl")):
            continue
        table = edit_kt = edit_code = saw_kt = saw_sec = False
        model = ""
        for e in events(d):
            t, data = e.get("type"), e.get("data", {})
            if t == "session.start":
                model = str(data.get("selectedModel"))
            elif t == "system.message" and "Here is a list of instruction files" in data.get("content", ""):
                table = True
            elif t == "tool.execution_start":
                a = json.dumps(data.get("arguments", {}))
                names = re.findall(r"instructions/([\w.-]+\.instructions\.md)", a)
                saw_kt |= any("kotlin" in x for x in names)
                saw_sec |= any("security" in x for x in names)
                if data.get("toolName") in ("edit", "create", "apply_patch"):
                    edit_kt |= bool(re.search(r'\.kts?["\\]', a))
                    edit_code |= bool(re.search(r'\.(kts?|go|java|tsx?)["\\]', a))
        if not table:
            continue
        where = "local" if model.startswith(("mlx-community", "Accio-Lab", "lmstudio")) else "cloud"
        for key in (where, model):
            if edit_kt:
                kt[key][0] += saw_kt
                kt[key][1] += 1
            if edit_code and key == where:
                sec[key][0] += saw_sec
                sec[key][1] += 1
    for title, table in (("edited .kt, opened a kotlin*.instructions.md", kt),
                         ("edited kt/go/java/ts, opened security-owasp.instructions.md", sec)):
        print(title)
        for key, (k, n) in sorted(table.items()):
            lo, hi = wilson(k, n)
            print("  %-46s %3d/%-3d [%.2f, %.2f]" % (key, k, n, lo, hi))


if __name__ == "__main__":
    cmd, args = sys.argv[1], sys.argv[2:]
    if cmd == "session":
        cmd_session(args)
    elif cmd == "pakke":
        cmd_pakke(args)
    elif cmd == "recall":
        cmd_recall(args[0] if args else os.path.expanduser("~/.copilot/session-state"))
