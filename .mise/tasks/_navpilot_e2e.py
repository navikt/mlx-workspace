#!/usr/bin/env python3
"""Checks for bench-navpilot-e2e: navikt/copilot #931, #932 and #933 merged together, end to end.

Called by .mise/tasks/bench-navpilot-e2e, which owns the queue lock, the nav-pilot
server and the manifest. Every subcommand rewrites one results JSON, so a run that
dies half way still leaves what it measured. Reuses _np_checks (the loop and poll
sessions, the corpus, peaks) and bench-copilot/bench-hybrid (tasks, run_sample, verify).

  manifest <cache> <branch> [8bit]      the #20 manifest into nav-pilot's cache; 8bit adds the
                                        pre-#20 Qwen3.8 8-bit entry (65536) for the crash scenario
  note     <out> <model> <argv>         record the server just started; sets doc["model"]
  copilot  <out> <scenario> <rung>...   Copilot CLI tasks through nav-pilot + static tokens (#932)
  opencode <out>                        one task: cloud main agent, local-worker subagent
  crash    <out> <port>                 kill the generation thread by OOM, then time the next launch (#931)
  finish   <out> <footprint> <report>   pass/fail per scenario, summary table into the report
  selftest
"""
import json
import os
import re
import subprocess
import sys
import threading
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import _np_checks as N

ROOT = N.ROOT
SESSIONS = Path.home() / ".copilot" / "session-state"
STATE = Path.home() / ".nav-pilot" / "local" / "server.json"
CAP = int(os.environ.get("NAVPILOT_E2E_TIMEOUT", "900"))
MODEL_8BIT = "mlx-community/Qwen3.8-27B-8bit"
LOST = "generation thread died, most likely out of memory"


def manifest(cache, branch, add8=""):
    sh = lambda *a: subprocess.run(["git", *a], cwd=ROOT, capture_output=True, text=True, check=True).stdout
    m = json.loads(sh("show", f"{branch}:manifest/models.json"))
    if add8:  # #20 removed it; the crash reproducer needs it, at the 65536 it had before
        old = json.loads(sh("show", "HEAD:manifest/models.json"))
        e = next(e for e in old["models"] if e["model"] == MODEL_8BIT)
        e["default"] = False
        e["params"]["MLX_OPENCODE_CONTEXT"] = "65536"
        m["models"] = [x for x in m["models"] if x["model"] != MODEL_8BIT] + [e]
    Path(cache).write_text(json.dumps(m, indent=2) + "\n")
    print(f"✓ {cache} ← {branch} ({sh('rev-parse', '--short', branch).strip()}){' + 8-bit@65536' if add8 else ''}")


def note(out, model, argv):
    doc = N.load(out)
    doc["model"] = model
    doc.setdefault("servers", []).append({"model": model, "argv": argv, "at": time.time()})
    N.save(out, doc)


def log_since(off):
    p = N.bench_copilot().bh.NP_SERVER_LOG
    if not p.exists():
        return ""
    with p.open("rb") as fh:
        fh.seek(min(off, p.stat().st_size))
        return fh.read().decode("utf8", "replace")


def static_tokens(before, cwd):
    """Copilot's own count of the static prompt, from the shutdown event of the one
    session this run created. Only new session dirs are opened."""
    for d in sorted(set(os.listdir(SESSIONS)) - before):
        f = SESSIONS / d / "events.jsonl"
        if not f.exists():
            continue
        events = [json.loads(line) for line in f.open() if line.strip()]
        if not events or (events[0].get("data") or {}).get("context", {}).get("cwd") != str(cwd):
            continue
        shut = [e["data"] for e in events if e.get("type") == "session.shutdown"]
        if not shut:
            return {"session": d, "shutdown": False}
        s = shut[-1]
        return {"session": d, "systemTokens": s.get("systemTokens"),
                "toolDefinitionsTokens": s.get("toolDefinitionsTokens"),
                "static": (s.get("systemTokens") or 0) + (s.get("toolDefinitionsTokens") or 0)}
    return None


def copilot(out, scenario, *rungs):
    bc = N.bench_copilot()
    bh = bc.bh
    bh.ensure_clone()
    doc = N.load(out)
    rows = doc.setdefault(scenario, [])
    for rung in map(int, rungs):
        task = bc.task_for(rung)
        before, start, off = set(os.listdir(SESSIONS)), time.time(), bh.log_offset()
        rec = bc.run_sample("local", rung, task, len(rows), {"local_model": doc["model"]}, CAP)
        chunk = log_since(off)
        rec.update(model=doc["model"], static=static_tokens(before, bh.REPO),
                   insufficient_memory="Insufficient Memory" in chunk,
                   **N.guard_signals((ROOT / rec["log"]).read_text(errors="replace")))
        rows.append(rec)
        N.phase(doc, f"{scenario}-{task['id']}", start)
        N.save(out, doc)
        print(f"  {scenario} {task['id']}: verified={rec['verified']} {rec['seconds']}s calls={rec['local_calls']} "
              f"static={rec['static']} oom={rec['insufficient_memory']} note={rec['note']}", flush=True)
    bh.reset_repo()


def opencode(out):
    bh = N.bench_copilot().bh
    bh.ensure_clone()
    bh.reset_repo()
    doc = N.load(out)
    task = next(t for t in bh.CFG["tasks"] if t["id"] == "R2")
    cfg = bh.tomllib.loads(Path(os.environ["NAV_PILOT_CONFIG"]).read_text())
    cloud = os.environ.get("BENCH_CLOUD_MODEL") or cfg.get("model")
    prompt = "Hand this to the local-worker subagent and report its answer: " + task["prompt"]
    argv = [bh.NAV_PILOT, "--client", "opencode", "--model", cloud, "--", "--pure", "run", "--format", "json", prompt]
    log = ROOT / ".bench-logs" / f"navpilot-e2e-opencode-{time.strftime('%Y%m%d-%H%M%S')}.jsonl"
    start, off = time.time(), bh.log_offset()
    with log.open("w") as fh:
        fh.write(f"# argv: {argv!r}\n# cwd: {bh.REPO}\n")
        fh.flush()
        proc = subprocess.Popen(argv, cwd=str(bh.REPO), stdout=fh, stderr=subprocess.STDOUT,
                                stdin=subprocess.DEVNULL, start_new_session=True)
        rc, timed_out = bh.wait_with_deadline(proc, CAP)
    text = log.read_text(errors="replace")
    ev = bh.parse_events(text)
    ok, why = bh.verify(task, ev["reply"])
    doc["b"] = {"task": "R2", "cloud_model": cloud, "exit": rc, "timed_out": timed_out,
                "seconds": round(time.time() - start, 1), "log": str(log.relative_to(ROOT)),
                "announced": "Local dispatch: nav-pilot ends a turn" in text,
                "local_calls": bh.local_calls_since(off), "cloud_steps": ev["cloud_steps"],
                "cloud_tokens": ev["cloud_tokens"], "cloud_cost_usd": ev["cloud_cost_usd"],
                "verified": ok, "note": why, **N.guard_signals(text)}
    N.phase(doc, "b-opencode", start)
    N.save(out, doc)
    bh.reset_repo()
    print(f"  opencode: {json.dumps(doc['b'])[:800]}", flush=True)


def alive(pid):
    try:
        os.kill(pid, 0)
        return True
    except OSError:
        return False


def crash(out, port):
    """The known reproducer: 8-bit at 65536, prompt cache warm, then ~60k tokens.
    mlx OOMs near 51k under a 36 GB wired limit; with #931 the server exits 70
    instead of hanging, and the next launch says why at once."""
    bh = N.bench_copilot().bh
    doc = N.load(out)
    model, pid = doc["model"], json.loads(STATE.read_text())["pid"]
    rec = doc["e"] = {"model": model, "pid": pid}
    off, start, text = bh.log_offset(), time.time(), N.corpus()

    def ask(target, follow=False):
        body = (text * (int(target * 3.5) // len(text) + 1))[:int(target * 3.5)]
        msgs = [{"role": "user", "content": f"[{time.time_ns()}]\n{body}\n\nSummarise the text above as a numbered list."}]
        r, reply = N.stream_once(port, model, msgs)
        if follow:  # the warm turn: same prefix, so the cache holds it
            msgs += [{"role": "assistant", "content": reply}, {"role": "user", "content": "Name three risks in it."}]
            N.stream_once(port, model, msgs)
        return r

    try:
        rec["warmup_30k"] = ask(30_000, follow=True)
    except Exception as e:
        rec["warmup_30k"] = N.failed(e)

    def big():
        try:
            rec["prompt_60k"] = ask(60_000)
        except Exception as e:
            rec["prompt_60k"] = N.failed(e)
    t0 = time.time()
    threading.Thread(target=big, daemon=True).start()
    while alive(pid) and time.time() - t0 < 300:
        time.sleep(2)
    rec["server_exited"] = not alive(pid)
    rec["exit_wait_s"] = round(time.time() - t0, 1)
    chunk = log_since(off)
    ev = ROOT / ".bench-logs" / f"navpilot-e2e-crash-{time.strftime('%Y%m%d-%H%M%S')}.server.log"
    ev.write_text(chunk)
    rec["server_log"] = str(ev.relative_to(ROOT))
    rec["thread_died_line"] = next((line for line in chunk.splitlines() if line.startswith("nav-pilot: the server's thread")), None)
    rec["status_70"] = "exiting with status 70" in chunk  # printed just before os._exit(70); the parent is gone, so no waitpid
    rec["oom_in_log"] = any(s in chunk for s in ("Insufficient Memory", "out of memory", "OutOfMemory"))

    work = ROOT / ".bench-logs" / "navpilot-e2e-work" / f"crash-{int(t0)}"
    work.mkdir(parents=True, exist_ok=True)
    log = ROOT / ".bench-logs" / f"navpilot-e2e-crash-launch-{time.strftime('%Y%m%d-%H%M%S')}.log"
    argv = [bh.NAV_PILOT, "--client", "copilot", "--model", model, "--", "--allow-all-tools", "--no-ask-user",
            "-p", "Reply with exactly: OK"]
    t1 = time.time()
    with log.open("w") as fh:
        proc = subprocess.Popen(argv, cwd=str(work), stdout=fh, stderr=subprocess.STDOUT,
                                stdin=subprocess.DEVNULL, start_new_session=True)
        rc, timed_out = bh.wait_with_deadline(proc, 120)
    out_text = log.read_text(errors="replace")
    rec["launch"] = {"exit": rc, "timed_out": timed_out, "seconds": round(time.time() - t1, 1),
                     "log": str(log.relative_to(ROOT)), "lost_message": LOST in out_text,
                     "local_server_lost": "local_server_lost" in out_text}
    N.phase(doc, "e-crash", start)
    N.save(out, doc)
    print(f"  crash: {json.dumps(rec)[:1500]}", flush=True)


# ── verdicts ─────────────────────────────────────────────────────────────────

def verdicts(doc):
    ph = doc.get("memory", {}).get("peak_gb_by_phase", {})
    v = []
    a = doc.get("a") or []
    st = [(r.get("static") or {}).get("static") for r in a]
    v.append(("a", "Copilot CLI + optiq (default)",
              "R2, E1, M1 verify; Copilot static context 19–21k (not ~45k) (#932)",
              f"{sum(1 for r in a if r.get('verified'))}/{len(a)} verified; static {st}",
              ", ".join(r["log"] for r in a),
              len(a) == 3 and all(r.get("verified") for r in a) and all(s and 15_000 <= s <= 25_000 for s in st) if a else None))
    b = doc.get("b")
    v.append(("b", "opencode, cloud main + local-worker",
              "R2 verified, nav-pilot announces local dispatch, local server takes >= 1 call",
              b and f"verified={b['verified']} local_calls={b['local_calls']} announced={b['announced']} "
                    f"cloud_steps={b['cloud_steps']} cost=${b['cloud_cost_usd']}",
              b and b["log"], b and bool(b["verified"] and b["local_calls"] and b["announced"])))
    c = doc.get("c") or []
    peak_c = max((x for k, x in ph.items() if k.startswith("c-") and x), default=None)
    v.append(("c", "Copilot CLI + qwen3.8-27b-4bit at 65536",
              "1 task verifies, no 'Insufficient Memory' in server.log",
              c and f"verified={c[0]['verified']} {c[0]['seconds']}s oom={c[0]['insufficient_memory']} peak {peak_c} GB",
              c and c[0]["log"], bool(c and c[0].get("verified") and not c[0]["insufficient_memory"]) if c else None))
    ss = {s["kind"]: s for s in doc.get("sessions", [])}
    lp, pl = ss.get("loop"), ss.get("poll")
    gm = lambda s: (s or {}).get("guard_message") or ""
    backstop = bool(pl and (pl["max_run"] >= 8 or "8 times in a row" in gm(pl)))
    v.append(("d", "loop guard (#933)",
              "loop blocked at 4 with 'same result'; poll reaches READY on call 7, not blocked by the same-result rule",
              (lp or pl) and f"loop: max_run={lp and lp['max_run']} msg={gm(lp)[:140]!r}; poll: completed={pl and pl.get('completed')} "
                             f"max_run={pl and pl['max_run']} msg={gm(pl)[:140]!r}; backstop mattered={backstop}",
              (lp or pl) and ", ".join(s["log"] for s in (lp, pl) if s),
              bool(lp and pl and "same result 4 times" in gm(lp) and pl.get("completed") and "same result" not in gm(pl))
              if (lp or pl) else None))
    e = doc.get("e")
    L = (e or {}).get("launch") or {}
    v.append(("e", "crash reporting (#931)",
              "server exits 70 within 5 min of the ~60k prompt; next launch fails fast with the local_server_lost message",
              e and f"exited={e['server_exited']} after {e['exit_wait_s']}s status_70={e['status_70']} "
                    f"launch {L.get('seconds')}s exit={L.get('exit')} lost_message={L.get('lost_message')}",
              e and f"{e['server_log']}, {L.get('log')}",
              bool(e and e["server_exited"] and e["status_70"] and L.get("lost_message") and not L.get("timed_out")
                   and L.get("seconds", 999) < 60) if e else None))
    return [{"scenario": s, "name": n, "expected": x, "observed": o, "evidence": ev,
             "pass": p} for s, n, x, o, ev, p in v]


def finish(out, fplog, report):
    doc = N.load(out)
    samples = [(float(t), int(b)) for t, b in (line.split() for line in Path(fplog).read_text().splitlines()
                                               if len(line.split()) == 2 and line.split()[1].isdigit())]
    doc["memory"] = {"peak_gb": round(max((b for _, b in samples), default=0) / N.GB, 2) or None,
                     "peak_gb_by_phase": N.peaks(doc, samples)}
    doc["verdicts"] = verdicts(doc)
    N.save(out, doc)
    cell = lambda s: str(s if s is not None else "not run").replace("|", "\\|").replace("\n", " ")
    rows = ["| | scenario | expected | observed | evidence | result |", "|---|---|---|---|---|---|"]
    for x in doc["verdicts"]:
        res = {True: "pass", False: "**FAIL**", None: "not run"}[x["pass"]]
        rows.append(f"| {x['scenario']} | {x['name']} | {x['expected']} | {cell(x['observed'])} | {cell(x['evidence'])} | {res} |")
        print(f"  {res:8} {x['scenario']} {x['name']}: {x['observed']}")
    rp = Path(report)
    head = rp.read_text().split("## Results")[0] if rp.exists() else ""
    rp.write_text(head + f"## Results\n\nRun `{Path(out).name}`, finished {time.strftime('%Y-%m-%d %H:%M')}.\n\n"
                  + "\n".join(rows) + "\n")


def selftest():
    doc = {"a": [{"verified": True, "log": "x", "static": {"static": 20_000}}] * 3,
           "sessions": [{"kind": "loop", "max_run": 4, "log": "l", "guard_message":
                         "nav-pilot stopped this turn: the local model repeated the same tool call with the same result 4 times — view"},
                        {"kind": "poll", "max_run": 7, "log": "p", "guard_message": None, "completed": True}]}
    got = {x["scenario"]: x["pass"] for x in verdicts(doc)}
    assert got == {"a": True, "b": None, "c": None, "d": True, "e": None}, got
    doc["a"][0] = {"verified": True, "log": "x", "static": {"static": 45_000}}
    assert verdicts(doc)[0]["pass"] is False
    assert re.search("same result 4 times", doc["sessions"][0]["guard_message"])
    print("✓ selftest passed")


if __name__ == "__main__":
    cmd, *args = sys.argv[1:] or ["selftest"]
    {"manifest": manifest, "note": note, "copilot": copilot, "opencode": opencode, "crash": crash,
     "finish": finish, "selftest": selftest}[cmd](*args)
