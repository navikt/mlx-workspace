#!/usr/bin/env python3
"""Checks for bench-np-e2e: the nav-pilot path, memory and latency of one profile.

Called by .mise/tasks/bench-np-e2e, which owns the queue lock and the server. Every
subcommand reads and rewrites one results JSON, so a run that dies half way still
leaves what it measured.

  manifest <profile> <cache.json>        put the profile's params into nav-pilot's cached manifest
  probe    <out.json> <port> <model>     latency, classifier and reasoning_effort probes
  e2e      <out.json> <on|off>           bench-copilot rungs through nav-pilot, one classifier state
  finish   <out.json> <footprint.log>    peak memory per phase, verdicts against PLAN.md section 12
  selftest                               no server needed
"""
import importlib.machinery
import importlib.util
import json
import math
import os
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

    start = time.time()
    doc["classifier_probe"] = []
    for sid, legit, n, call in SCENARIOS:
        try:
            pa, secs = classify(port, model, n, call)
            doc["classifier_probe"].append({"id": sid, "legitimate": legit, "n": n, "p_a": pa, "seconds": secs,
                                            "would_block": pa > 0.9, "within_timeout": secs < 1.5})
        except Exception as e:  # recorded, not fatal: the guard fails open on the same errors
            doc["classifier_probe"].append({"id": sid, "legitimate": legit, "error": str(e)[:300]})
        print(f"  classifier {doc['classifier_probe'][-1]}", flush=True)
    phase(doc, "classifier", start)

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
    fp = [c["id"] for c in doc.get("classifier_probe", []) if c.get("legitimate") and c.get("would_block")]
    if doc.get("classifier_probe"):
        v.append(("classifier probe: no legit scenario over P(A) 0.9", fp, bool(fp)))
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
    {"manifest": manifest, "probe": probe, "e2e": e2e, "finish": finish, "selftest": selftest}[cmd](*args)
