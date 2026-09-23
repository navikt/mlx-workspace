#!/usr/bin/env python3
"""Checks for bench-np-e2e: the nav-pilot path, memory and latency of one profile.

Called by .mise/tasks/bench-np-e2e, which owns the queue lock and the server. Every
subcommand reads and rewrites one results JSON, so a run that dies half way still
leaves what it measured.

  manifest <profile> <cache.json>        put the profile's params into nav-pilot's cached manifest
  probe    <out.json> <port> <model>     latency, classifier and reasoning_effort probes
  classifier <out.json> <port> <model>   the classifier probe alone (bench-system-one)
  session  <out.json> <loop|poll> <port>      one real Copilot CLI session through the guard (bench-system-one)
  e2e      <out.json> <on|off>           bench-copilot rungs through nav-pilot, one classifier state
  finish   <out.json> <footprint.log>    peak memory per phase, verdicts against PLAN.md section 12
  selftest                               no server needed
"""
import importlib.machinery
import importlib.util
import json
import math
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(HERE))
STATS = Path.home() / ".nav-pilot" / "local" / "stats.jsonl"
GB = 1e9


def load(out):
    p = Path(out)
    return json.loads(p.read_text()) if p.exists() else {}


def save(out, doc):
    Path(out).write_text(json.dumps(doc, indent=2) + "\n")


def phase(doc, name, start):
    doc.setdefault("phases", []).append({"name": name, "start": start, "end": time.time()})


# ── manifest ─────────────────────────────────────────────────────────────────

def manifest(profile, cache):
    """nav-pilot starts its server from the manifest entry whose model matches.
    Several profiles share one HF id (nopin and the pinned 8bit-mlx entry), so the
    entry is found by model and its params replaced; key, prose and the rest stay."""
    import _profiles as P
    _meta, params = P.load(profile)
    src = Path(cache) if Path(cache).exists() else ROOT / "manifest" / "models.json"
    m = json.loads(src.read_text())
    hits = [e for e in m["models"] if e["model"] == params["MLX_MODEL"]]
    if len(hits) != 1:
        raise SystemExit(f"✗ {len(hits)} manifest entries serve {params['MLX_MODEL']}; need exactly 1")
    hits[0]["params"] = {k: v for k, v in params.items() if k.startswith("MLX_")}
    Path(cache).write_text(json.dumps(m, indent=2) + "\n")
    print(f"✓ manifest entry {hits[0]['key']} now carries {profile}'s params")


# ── server probes ────────────────────────────────────────────────────────────

# Idle timeout, not a total: a streamed prefill sends a keepalive per chunk, so
# 300 s of silence means the server is gone, not busy.
def post(port, body, stream=False, timeout=300):
    req = urllib.request.Request(f"http://127.0.0.1:{port}/v1/chat/completions",
                                 data=json.dumps(body).encode(),
                                 headers={"Content-Type": "application/json"})
    return urllib.request.urlopen(req, timeout=timeout)


def stream_once(port, model, messages, max_tokens=256):
    """Cold or warm TTFT and decode rate from one streamed completion."""
    t0 = time.time()
    first = last = None
    usage, text = {}, []
    with post(port, {"model": model, "messages": messages, "max_tokens": max_tokens,
                     "stream": True, "stream_options": {"include_usage": True}}) as r:
        for raw in r:
            line = raw.decode(errors="replace").strip()
            if not line.startswith("data:") or line == "data: [DONE]":
                continue
            d = json.loads(line[5:])
            if d.get("usage"):
                usage = d["usage"]
            for c in d.get("choices") or []:
                delta = c.get("delta") or {}
                piece = delta.get("content") or delta.get("reasoning") or ""
                if piece:
                    now = time.time()
                    first = first or now
                    last = now
                    text.append(piece)
    out_toks = usage.get("completion_tokens") or 0
    decode = (out_toks - 1) / (last - first) if first and last and last > first and out_toks > 1 else None
    return {"prompt_tokens": usage.get("prompt_tokens"), "completion_tokens": out_toks,
            "ttft_s": round(first - t0, 2) if first else None,
            "decode_tok_s": round(decode, 1) if decode else None,
            "total_s": round(time.time() - t0, 2), "usage": usage}, "".join(text)


def corpus():
    # Real repository prose and code, so the tokenizer sees what an agent sends.
    parts = [p.read_text(errors="replace") for p in sorted((ROOT / ".mise" / "tasks").iterdir())
             if p.is_file() and p.stat().st_size < 200_000]
    parts += [(ROOT / f).read_text() for f in ("PLAN.md", "MODELS.md", "BENCHMARKING.md")]
    return "\n\n".join(parts)


# The guard's classifier prompt, copied from guard.go checkSystemOneLoop at e72319e0.
# ponytail: a copy drifts if guard.go changes it; re-copy when the branch moves.
CLASSIFIER = ("An AI coding agent has made the same tool call {n} times in a row with identical arguments:\n{call}\n"
              "Repeating a call can be legitimate, for example re-running a build or test after editing files, or polling for a result. "
              "It can also be a stuck loop that will not make progress.\n"
              "A: stuck loop\nB: legitimate\nAnswer with the single letter A or B.")
SCENARIOS = [  # (id, legitimate?, n, call as the guard formats it: name(arguments))
    ("rerun-tests", True, 6, 'bash({"command":"./gradlew test","description":"Run the tests again after the edit"})'),
    ("poll-ci", True, 6, 'bash({"command":"sleep 20; gh run view 123456 --json status,conclusion","description":"Wait for CI"})'),
    ("recompile", True, 7, 'bash({"command":"./gradlew compileKotlin","description":"Compile"})'),
    ("rerun-go-test", True, 6, 'bash({"command":"go test ./...","description":"Run the tests again after the fix"})'),
    ("poll-pr-checks", True, 7, 'bash({"command":"gh pr checks 42","description":"Check CI status"})'),
    # No "re-read a file after writing it": the write sits between the two reads, so
    # the guard never sees a run and the classifier is never asked.
    ("reread-file", False, 6, 'view({"path":"src/main/kotlin/no/nav/App.kt"})'),
    ("same-grep", False, 7, 'grep({"pattern":"fun main","path":"."})'),
]


def p_a(top):
    return sum(math.exp(t["logprob"]) for t in top
               if t["token"].replace("Ġ", "").strip() == "A")


def classify(port, model, n, call):
    t0 = time.time()
    with post(port, {"model": model, "messages": [{"role": "user", "content": CLASSIFIER.format(n=n, call=call)}],
                     "max_tokens": 1, "temperature": 0.0, "logprobs": True, "top_logprobs": 5,
                     "stream": False, "chat_template_kwargs": {"enable_thinking": False}}, timeout=60) as r:
        d = json.load(r)
    top = d["choices"][0]["logprobs"]["content"][0]["top_logprobs"]
    return round(p_a(top), 4), round(time.time() - t0, 3)


LATENCY_TARGETS = (2_000, 30_000, 60_000, 60_000)


def latency_targets(context, output):
    """The fixed targets that fit the profile's window, prompt plus reply. When one
    does not fit, the largest that does (rounded down to 1k) takes its place."""
    cap = context - output
    fit = [t for t in LATENCY_TARGETS if t <= cap]
    if len(fit) < len(LATENCY_TARGETS):
        fit.append(cap // 1000 * 1000)
    return fit


def failed(e):
    return {"error": "timeout" if isinstance(e, TimeoutError) or "timed out" in str(e) else str(e)[:300]}


def probe(out, port, model):
    import _profiles as P
    doc = load(out)
    params = P.load(doc["profile"])[1]
    targets = latency_targets(int(params["MLX_OPENCODE_CONTEXT"]), int(params["MLX_OPENCODE_OUTPUT"]))
    print(f"  latency targets {targets}", flush=True)
    lat = doc.setdefault("latency", [])
    text = corpus()
    chars_per_tok = 3.5
    for target in targets:
        start = time.time()
        rec = {"target": target}
        # One target failing (a client timeout on a wedged server) is recorded and
        # the rest still run, so the classifier and effort probes are never lost to it.
        try:
            # Nonce first, so no prefix of this prompt is in the prompt cache.
            need = int(target * chars_per_tok)
            body = (text * (need // len(text) + 1))[:need]
            q = "\n\nSummarise what the text above is about in detail, as a numbered list."
            msgs = [{"role": "user", "content": f"[{time.time_ns()}]\n{body}{q}"}]
            rec["cold"], reply = stream_once(port, model, msgs)
            if rec["cold"]["prompt_tokens"]:
                chars_per_tok = len(msgs[0]["content"]) / rec["cold"]["prompt_tokens"]
            if target >= 30_000 or target == targets[-1]:
                msgs += [{"role": "assistant", "content": reply},
                         {"role": "user", "content": "Now name the three biggest risks in it, one line each."}]
                rec["warm"], _ = stream_once(port, model, msgs)
        except Exception as e:
            rec["warm" if "cold" in rec else "cold"] = failed(e)
        lat.append(rec)
        phase(doc, f"latency-{target}", start)
        save(out, doc)
        print(f"  {target}: {json.dumps({k: v for k, v in rec.items() if k != 'target'})[:300]}", flush=True)

    classifier_probe(doc, port, model)

    # Qwen3.8's template is said to raise on reasoning_effort outside xhigh/medium/low,
    # the reason the other 8-bit profile pins it. Which request shapes reach it?
    doc["effort_probe"] = []
    for label, extra in (("kwargs-high", {"chat_template_kwargs": {"reasoning_effort": "high"}}),
                         ("kwargs-none", {"chat_template_kwargs": {"reasoning_effort": "none"}}),
                         ("toplevel-high", {"reasoning_effort": "high"})):
        body = {"model": model, "max_tokens": 8, "messages": [{"role": "user", "content": "Reply with exactly: OK"}], **extra}
        try:
            with post(port, body, timeout=120) as r:
                d = json.load(r)
            doc["effort_probe"].append({"shape": label, "status": 200,
                                        "reply": (d["choices"][0]["message"].get("content") or "")[:40]})
        except urllib.error.HTTPError as e:
            doc["effort_probe"].append({"shape": label, "status": e.code, "error": e.read()[:300].decode(errors="replace")})
        except Exception as e:
            doc["effort_probe"].append({"shape": label, "status": None, "error": str(e)[:300]})
        print(f"  effort {doc['effort_probe'][-1]}", flush=True)
    save(out, doc)


def p95(xs):
    xs = sorted(xs)
    return xs[math.ceil(0.95 * len(xs)) - 1] if xs else None


def classifier_probe(doc, port, model, reps=3):
    """Every scenario `reps` times, repetitions outermost: with 7 scenarios between
    two asks of the same prompt, a 2-3 entry prompt cache has evicted it, so each
    ask is cold as the guard's would be and the p95 is not a cache-hit number."""
    start = time.time()
    rows = doc["classifier_probe"] = []
    for rep in range(reps):
        for sid, legit, n, call in SCENARIOS:
            try:
                pa, secs = classify(port, model, n, call)
                rows.append({"id": sid, "rep": rep, "legitimate": legit, "n": n, "p_a": pa, "seconds": secs,
                             "would_block": pa > 0.9, "within_timeout": secs < 1.5})
            except Exception as e:  # recorded, not fatal: the guard fails open on the same errors
                rows.append({"id": sid, "rep": rep, "legitimate": legit, "error": str(e)[:300]})
            print(f"  classifier {rows[-1]}", flush=True)
    secs = [r["seconds"] for r in rows if "seconds" in r]
    doc["classifier_latency"] = {"n": len(secs), "p50": sorted(secs)[len(secs) // 2] if secs else None,
                                 "p95": p95(secs), "max": max(secs, default=None)}
    phase(doc, "classifier", start)


def classifier_only(out, port, model):
    doc = load(out)
    classifier_probe(doc, port, model)
    save(out, doc)
    print(f"  latency {doc['classifier_latency']}", flush=True)


# ── one real session through the guard (bench-system-one) ────────────────────

SYSTEM_ONE_FROM, LOOP_LIMIT = 6, 8  # guard.go at e72319e0: systemOneFrom() and DefaultLoopGuardRepeat
SESSIONS = {
    # A provoked loop: the file never changes, so every read is the same read.
    "loop": ({"ready.txt": "status: waiting\n"},
             "The file ready.txt in this directory will contain the line GO once an external job finishes. "
             "Check it with the view tool, reading exactly ready.txt each time. If GO is not there, check again "
             "the same way. Do not use any other tool, do not sleep, do not edit any file, and do not stop or ask "
             "me anything until you have seen GO."),
    # A legitimate poll: the same call seven times, each answer different, ready on the 7th.
    # The guard asks the classifier before the 7th call (run of 6) and before the final
    # answer (run of 7); a block at either is a false positive.
    "poll": ({"poll.sh": '#!/bin/sh\nn=$(( $(cat .count 2>/dev/null || echo 0) + 1 )); echo $n > .count\n'
                         'if [ $n -ge 7 ]; then echo "check $n: READY"; else echo "check $n: pending"; fi\n'},
             "A deployment is rolling out. Check its status by running exactly `./poll.sh` with the bash tool, "
             "with the description \"Check deployment status\". While it prints pending, run exactly the same "
             "command again, with no sleep and nothing else in between. When it prints READY, stop and reply "
             "with the check number it printed."),
}


def ts_iso(s):
    from datetime import datetime
    return datetime.fromisoformat(s.replace("Z", "+00:00")).timestamp()


def server_requests(chunk):
    """One entry per completion in server.log: when prompt processing was first
    logged and how many tokens it had to process (the part not in the prompt cache).
    The log carries neither max_tokens nor the body at INFO, so this is all there is."""
    import re
    reqs, cur = [], None
    for line in chunk.splitlines():
        m = re.match(r"(\d{4}-\d\d-\d\d \d\d:\d\d:\d\d),(\d{3}) - INFO - Prompt processing progress: (\d+)/(\d+)", line)
        if m:
            t = time.mktime(time.strptime(m[1], "%Y-%m-%d %H:%M:%S")) + int(m[2]) / 1000
            cur = cur or {"t0": t, "y": 0}
            cur.update(t1=t, y=int(m[4]))
        elif "POST /v1/chat/completions" in line:
            if cur is None:  # fully cached prompt: no progress line, second resolution only
                m = re.search(r"\[(\d\d/\w+/\d{4} \d\d:\d\d:\d\d)\]", line)
                t = time.mktime(time.strptime(m[1], "%d/%b/%Y %H:%M:%S")) if m else None
                cur = {"t0": t, "t1": t, "y": 0}
            reqs.append(cur)
            cur = None
    return reqs


def session_turns(events):
    """The model's turns from the Copilot CLI's own event log, each with the tool call
    signature the guard would compute and when the tools it asked for finished."""
    turns, done = [], {}
    for e in events:
        if e.get("type") == "assistant.message":
            reqs = e["data"].get("toolRequests") or []
            sig = ", ".join(f"{r['name']}({json.dumps(r.get('arguments'), ensure_ascii=False)})" for r in reqs)
            turns.append({"t": ts_iso(e["timestamp"]), "sig": sig or None, "ids": [r["toolCallId"] for r in reqs]})
        elif e.get("type") == "tool.execution_complete":
            done[e["data"].get("toolCallId")] = ts_iso(e["timestamp"])
    for t in turns:
        t["tools_done"] = max((done[i] for i in t["ids"] if i in done), default=t["t"])
    return turns


def align(turns, reqs, start, end):
    """Which server requests were the guard's classifier calls. Request i (the one that
    produced turn i, or the blocked one after the last turn) is sent once turn i-1's
    tools finish; when the run of identical calls before it is 6 or 7, the guard asks
    the classifier first, so every server request in that window but the agent's own
    last one is a classifier call. A blocked request never reaches the server, so after
    the last turn every request in the window is one."""
    out, run, prev = [], 0, None
    for i in range(len(turns) + 1):
        lo = turns[i - 1]["tools_done"] if i else start
        hi = turns[i]["t"] if i < len(turns) else end
        win = [r for r in reqs if r["t0"] is not None and lo <= r["t0"] <= hi]
        agent = win[-1] if i < len(turns) and win else None
        cls = win[:-1] if agent else win
        out.append({"i": i, "n": run, "call": prev, "agent_y": agent and agent["y"],
                    "agent_t0": agent and agent["t0"], "classifier": cls if SYSTEM_ONE_FROM <= run < LOOP_LIMIT else [],
                    "unexplained": cls if not SYSTEM_ONE_FROM <= run < LOOP_LIMIT else []})
        if i < len(turns):
            sig = turns[i]["sig"]
            run, prev = (run + 1, sig) if sig and sig == prev else ((1, sig) if sig else (0, None))
    return out


def session(out, kind, port):
    bc = bench_copilot()
    bh = bc.bh
    doc = load(out)
    model = doc["model"]
    files, prompt = SESSIONS[kind]
    stamp = time.strftime("%Y%m%d-%H%M%S")
    work = ROOT / ".bench-logs" / "system-one-work" / f"{kind}-{stamp}"
    work.mkdir(parents=True)
    for name, body in files.items():
        (work / name).write_text(body)
        if name.endswith(".sh"):
            (work / name).chmod(0o755)
    log = ROOT / ".bench-logs" / f"system-one-{kind}-{stamp}.log"
    argv = [bh.NAV_PILOT, "--client", "copilot", "--model", model, "--",
            "--allow-all-tools", "--no-ask-user", "-p", prompt]
    offset, started = bh.log_offset(), time.time()
    with log.open("w") as fh:
        fh.write(f"# argv: {argv!r}\n# cwd: {work}\n")
        fh.flush()
        proc = subprocess.Popen(argv, cwd=str(work), stdout=fh, stderr=subprocess.STDOUT,
                                stdin=subprocess.DEVNULL, start_new_session=True)
        rc, timed_out = bh.wait_with_deadline(proc, int(os.environ.get("SYSTEM_ONE_TIMEOUT", "900")))
    ended = time.time()
    text = log.read_text(errors="replace")
    with bh.NP_SERVER_LOG.open("rb") as fh:
        fh.seek(offset)
        reqs = server_requests(fh.read().decode("utf8", "replace"))

    # The Copilot CLI's own record of the session: the one started in our work dir.
    events = []
    for f in sorted((Path.home() / ".copilot" / "session-state").glob("*/events.jsonl"),
                    key=lambda f: f.stat().st_mtime, reverse=True)[:20]:
        first = json.loads(f.open().readline() or "{}")
        if (first.get("data") or {}).get("context", {}).get("cwd") == str(work):
            events = [json.loads(line) for line in f.open() if line.strip()]
            break
    turns = session_turns(events)
    steps = align(turns, reqs, started, ended)
    first_y = next((s["agent_y"] for s in steps if s["agent_y"]), None)
    calls = []
    for s in steps:
        for j, c in enumerate(s["classifier"]):
            rec = {"before_request": s["i"], "n": s["n"], "call": s["call"], "classifier_y": c["y"],
                   "added_s": round(s["agent_t0"] - s["classifier"][0]["t0"], 2) if s["agent_t0"] and j == 0 else None,
                   "next_agent_y": s["agent_y"], "first_request_y": first_y,
                   # The cache question: did the turn after the classifier re-prefill its prefix?
                   "reprefilled": bool(s["agent_y"] and first_y and s["agent_y"] >= 0.5 * first_y)}
            try:  # P(A) is not logged anywhere; ask again with the same prompt the guard built
                rec["p_a_replay"], _ = classify(port, model, s["n"], s["call"])
            except Exception as e:
                rec["p_a_replay"] = failed(e)
            calls.append(rec)
    agent_ys = [s["agent_y"] for s in steps if s["agent_y"] is not None]
    signals = guard_signals(text)
    rec = {"kind": kind, "legitimate": kind == "poll", "log": str(log.relative_to(ROOT)), "work": str(work),
           "exit": rc, "timed_out": timed_out, "seconds": round(ended - started, 1),
           "turns": len(turns), "server_requests": len(reqs), "agent_request_y": agent_ys,
           "max_run": max((s["n"] for s in steps), default=0), "classifier_calls": calls,
           "unexplained_requests": [r for s in steps for r in s["unexplained"]],
           "classifier_block": signals["classifier_block"], "static_block": signals["static_block"],
           "guard_message": next((line.strip() for line in text.splitlines() if "nav-pilot stopped this turn" in line), None),
           "session_errors": [e["data"].get("message") for e in events if e.get("type") == "session.error"],
           "tokens": bc.parse_summary(text), "events_found": bool(events)}
    if kind == "poll":
        rec["completed"] = "READY" in text and "7" in bc.reply_text(text)
    doc.setdefault("sessions", []).append(rec)
    phase(doc, f"session-{kind}", started)
    save(out, doc)
    print(f"  {kind}: {json.dumps({k: v for k, v in rec.items() if k not in ('agent_request_y', 'work')})[:1500]}", flush=True)


# ── end to end through nav-pilot ─────────────────────────────────────────────

def bench_copilot():
    spec = importlib.util.spec_from_loader(
        "bench_copilot", importlib.machinery.SourceFileLoader("bench_copilot", str(HERE / "bench-copilot")))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def guard_signals(text):
    return {
        "classifier_block": "a local classifier judged it a loop" in text,
        "static_block": "without the answer changing" in text,
        "path_error": any(s in text for s in ("local_server_", "did not forward this request")),
    }


def e2e(out, state):
    bc = bench_copilot()
    bh = bc.bh
    bh.ensure_clone()
    doc = load(out)
    rows = doc.setdefault("e2e", [])
    model = doc["model"]
    samples = int(os.environ.get("NP_E2E_SAMPLES", "2"))
    cap = int(os.environ.get("NP_E2E_TIMEOUT", "900"))
    rungs = [int(r) for r in os.environ.get("NP_E2E_RUNGS", "1 2 3").split()]
    for rung in rungs:
        task = bc.task_for(rung)
        for _ in range(samples):
            start = time.time()
            off = STATS.stat().st_size if STATS.exists() else 0
            rec = bc.run_sample("local", rung, task, len(rows), {"local_model": model}, cap)
            new = STATS.read_bytes()[off:].decode().splitlines() if STATS.exists() else []
            stats = [json.loads(line) for line in new if line.strip()]
            text = (ROOT / rec["log"]).read_text(errors="replace")
            rec.update(classifier=state, stats_rows=len(stats),
                       stats_rows_with_usage=sum(1 for s in stats if s.get("in") and s.get("out")),
                       **guard_signals(text))
            rows.append(rec)
            phase(doc, f"e2e-{task['id']}-{state}-{len(rows) - 1}", start)
            save(out, doc)
            print(f"  {task['id']} classifier={state}: verified={rec['verified']} {rec['seconds']}s "
                  f"calls={rec['local_calls']} stats={rec['stats_rows']}/{rec['stats_rows_with_usage']} "
                  f"blocks={rec['classifier_block']}/{rec['static_block']} note={rec['note']}", flush=True)
    bh.reset_repo()


# ── verdicts ─────────────────────────────────────────────────────────────────

def peaks(doc, samples):
    out = {}
    for ph in doc.get("phases", []):
        vals = [b for t, b in samples if ph["start"] <= t <= ph["end"]]
        out[ph["name"]] = round(max(vals) / GB, 2) if vals else None
    return out


def verdicts(doc):
    """PLAN.md section 12, as code. Each entry: (criterion, measured, refuted?)."""
    v = []
    peak = doc.get("memory", {}).get("peak_gb")
    if peak is not None:
        v.append(("peak footprint <= 40 GB", peak, peak > 40))
    for rec in doc.get("latency", []):
        c, w, t = rec.get("cold") or {}, rec.get("warm"), rec["target"]
        c = {"ttft_s": None, "decode_tok_s": None, **c}
        if t == 30_000:
            v.append(("cold TTFT@30k <= 30 s", c["ttft_s"], c["ttft_s"] is None or c["ttft_s"] > 30))
            v.append(("decode@30k >= 12 tok/s", c["decode_tok_s"], c["decode_tok_s"] is None or c["decode_tok_s"] < 12))
            if w:
                v.append(("warm TTFT@30k <= 5 s", w.get("ttft_s"), w.get("ttft_s") is None or w["ttft_s"] > 5))
        if t == 60_000 and not any(x[0].startswith("cold TTFT@60k") for x in v):
            v.append(("cold TTFT@60k <= 90 s", c["ttft_s"], c["ttft_s"] is None or c["ttft_s"] > 90))
    fp = sorted({c["id"] for c in doc.get("classifier_probe", []) if c.get("legitimate") and c.get("would_block")})
    if doc.get("classifier_probe"):
        v.append(("classifier probe: no legit scenario over P(A) 0.9", fp, bool(fp)))
        p = (doc.get("classifier_latency") or {}).get("p95")
        v.append(("classifier p95 latency < 1.5 s (else the guard fails open)", p, p is None or p >= 1.5))
    for s in doc.get("sessions", []):
        if s["legitimate"]:
            v.append(("real legit session: classifier blocks == 0", s["classifier_block"], s["classifier_block"]))
            v.append(("real legit session reached a run of 6 (classifier asked)", s["max_run"], s["max_run"] < SYSTEM_ONE_FROM))
    rows = doc.get("e2e", [])
    if rows:
        bad = [r for r in rows if not (r.get("valid") and r.get("verified"))]
        v.append(("E2E failures <= 1", len(bad), len(bad) > 1))
        perr = [r["task"] for r in rows if r.get("path_error") or (r.get("exit") not in (0, None)) or not r.get("local_calls")]
        v.append(("E2E path errors == 0", perr, bool(perr)))
        ok_off = {r["task"] for r in rows if r["classifier"] == "off" and r.get("verified")}
        fpb = [r["task"] for r in rows if r["classifier"] == "on" and r.get("classifier_block") and r["task"] in ok_off]
        v.append(("classifier false-positive blocks == 0", fpb, bool(fpb)))
    return [{"criterion": c, "measured": m, "refuted": bool(r)} for c, m, r in v]


def finish(out, fplog):
    doc = load(out)
    samples = []
    for line in Path(fplog).read_text().splitlines():
        parts = line.split()
        if len(parts) == 2 and parts[1].isdigit():
            samples.append((float(parts[0]), int(parts[1])))
    doc["memory"] = {"peak_gb": round(max(b for _, b in samples) / GB, 2) if samples else None,
                     "samples": len(samples), "peak_gb_by_phase": peaks(doc, samples)}
    doc["verdicts"] = verdicts(doc)
    save(out, doc)
    for x in doc["verdicts"]:
        print(f"  {'✗ REFUTED' if x['refuted'] else '✓ holds  '}  {x['criterion']}: {x['measured']}")


def selftest():
    assert abs(p_a([{"token": "A", "logprob": math.log(0.5)}, {"token": " A", "logprob": math.log(0.45)},
                    {"token": "B", "logprob": math.log(0.05)}]) - 0.95) < 1e-9
    assert guard_signals("… and a local classifier judged it a loop.")["classifier_block"]
    assert guard_signals("same tool call 8 times in a row without the answer changing")["static_block"]
    doc = {"phases": [{"name": "a", "start": 0, "end": 10}], "memory": {"peak_gb": 41.0},
           "latency": [{"target": 30_000, "cold": {"ttft_s": 20, "decode_tok_s": 15}, "warm": {"ttft_s": 2}}],
           "e2e": [{"task": "R2", "classifier": "off", "valid": True, "verified": True, "exit": 0, "local_calls": 3},
                   {"task": "R2", "classifier": "on", "valid": True, "verified": False, "exit": 0, "local_calls": 3,
                    "classifier_block": True}]}
    assert peaks(doc, [(5, 2 * GB), (11, 9 * GB)]) == {"a": 2.0}
    got = {x["criterion"]: x["refuted"] for x in verdicts(doc)}
    assert got["peak footprint <= 40 GB"] and not got["cold TTFT@30k <= 30 s"], got
    assert got["classifier false-positive blocks == 0"] and not got["E2E failures <= 1"], got
    assert "rerun-tests" in [s[0] for s in SCENARIOS] and "{n}" in CLASSIFIER
    assert len(corpus()) > 100_000, "corpus too small to reach 60k tokens without heavy repetition"
    log = ("2026-09-23 11:47:43,388 - INFO - Prompt processing progress: 2048/9000\n"
           "2026-09-23 11:47:45,388 - INFO - Prompt processing progress: 9000/9000\n"
           '127.0.0.1 - - [23/Sep/2026 11:47:46] "POST /v1/chat/completions HTTP/1.1" 200 -\n'
           '127.0.0.1 - - [23/Sep/2026 11:47:50] "POST /v1/chat/completions HTTP/1.1" 200 -\n')
    r = server_requests(log)
    assert [x["y"] for x in r] == [9000, 0] and r[0]["t1"] - r[0]["t0"] == 2, r
    # Seven identical calls, then a blocked eighth request: the classifier runs before
    # request 6 (run of 6, forwarded) and before request 7 (run of 7, blocked).
    turns = [{"t": 10 * i + 9, "tools_done": 10 * i + 10, "sig": "view({})"} for i in range(7)]
    reqs = [{"t0": 10 * i + 1, "y": 100} for i in range(6)] + [{"t0": 61, "y": 150}, {"t0": 62, "y": 90},
                                                                  {"t0": 71, "y": 150}]
    got = align(turns, reqs, 0, 100)
    assert [(g["i"], g["n"], len(g["classifier"])) for g in got if g["classifier"]] == [(6, 6, 1), (7, 7, 1)], got
    assert got[6]["agent_y"] == 90 and not any(g["unexplained"] for g in got)
    assert latency_targets(32768, 8192) == [2_000, 24_000]
    assert latency_targets(65536, 8192) == [2_000, 30_000, 57_000]
    assert latency_targets(131072, 8192) == list(LATENCY_TARGETS)
    assert failed(TimeoutError("timed out")) == {"error": "timeout"}
    # A timeout on every latency request still leaves the classifier and effort probes.
    import tempfile
    global stream_once
    real, stream_once = stream_once, lambda *a, **k: (_ for _ in ()).throw(TimeoutError("timed out"))
    try:
        with tempfile.TemporaryDirectory() as d:
            out = Path(d) / "p.json"
            save(out, {"profile": "qwen3.8-27b-8bit-nopin"})
            probe(out, "9", "none")  # port 9: nothing listens, every request fails fast
            got = load(out)
    finally:
        stream_once = real
    assert [r["target"] for r in got["latency"]] == [2_000, 24_000], got["latency"]
    assert all(r["cold"] == {"error": "timeout"} for r in got["latency"]), got["latency"]
    assert got["classifier_probe"] and len(got["effort_probe"]) == 3
    verdicts(got)  # an errored latency row must not crash the verdicts
    print("✓ selftest passed")


if __name__ == "__main__":
    cmd, *args = sys.argv[1:] or ["selftest"]
    {"manifest": manifest, "probe": probe, "classifier": classifier_only, "session": session,
     "e2e": e2e, "finish": finish, "selftest": selftest}[cmd](*args)
