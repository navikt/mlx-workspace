#!/usr/bin/env python3
"""The mlx-workspace decide harnesses' `run`, against whatever server is up (NP_PORT, NP_MODEL,
BENCH_NAV_PILOT), plus a latency probe the np-e2e way.

  dec.py why <key> <out.json>       _decide_why.run: commit-explains-why{,-no}.jsonl
  dec.py sets <key> <out.json>      _decide_sets.run with DECIDE_SETS=issue-type
  dec.py limits <key> <out.json>    _decide_limits.run on lang-en, lang-no and options only
  dec.py lat <key> <out.json>       TTFT and decode at ~2k and ~30k tokens, cold, and warm at 30k

The harness's own requests (the sanity prompt, the latency probe) get thinking turned off both
ways, as nav-pilot's decide does: the managed mlx server has it off in its chat template, an
endpoint does not.
"""
import json
import os
import sys
import time

sys.path.insert(0, "/Users/hans/mlx-workspace/.mise/tasks")
import _np_checks as C  # noqa: E402

_post = C.post


def post(port, body, stream=False, timeout=300):
    body = dict(body)
    body.setdefault("chat_template_kwargs", {"enable_thinking": False})
    body.setdefault("reasoning_effort", "none")
    return _post(port, body, stream, timeout)


C.post = post


def lat(key, out):
    port, model = os.environ["NP_PORT"], os.environ["NP_MODEL"]
    doc = {"key": key, "model": model, "started": time.strftime("%Y-%m-%dT%H:%M:%S%z"), "latency": []}
    text = C.corpus()
    cpt = 3.5
    for target in (2000, 30000):
        rec = {"target": target}
        try:
            need = int(target * cpt)
            body = (text * (need // len(text) + 1))[:need]
            msgs = [{"role": "user", "content": f"[{time.time_ns()}]\n{body}\n\nSummarise what the text above is about in detail, as a numbered list."}]
            rec["cold"], reply = C.stream_once(port, model, msgs)
            if rec["cold"]["prompt_tokens"]:
                cpt = len(msgs[0]["content"]) / rec["cold"]["prompt_tokens"]
            if target == 30000:
                msgs += [{"role": "assistant", "content": reply},
                         {"role": "user", "content": "Now name the three biggest risks in it, one line each."}]
                rec["warm"], _ = C.stream_once(port, model, msgs)
        except Exception as e:  # recorded, the next target still runs
            rec["error"] = str(e)[:300]
        doc["latency"].append(rec)
        print(f"  {key} {target}: {json.dumps(rec)[:400]}", flush=True)
        C.save(out, doc)


def main(kind, key, out):
    if kind == "lat":
        return lat(key, out)
    if kind == "why":
        import _decide_why as M
    elif kind == "sets":
        os.environ.setdefault("DECIDE_SETS", "issue-type")
        import _decide_sets as M
    elif kind == "limits":
        import _decide_limits as M
        M.SETS = ["lang-en", "lang-no", "options"]
    else:
        sys.exit(__doc__)
    M.run(key, out)


if __name__ == "__main__":
    main(*sys.argv[1:4])
