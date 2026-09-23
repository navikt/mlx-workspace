#!/usr/bin/env python3
"""Checks for bench-navpilot-e2e-rerun: scenarios d and e of bench-navpilot-e2e, redone.

The first run (bench/navpilot-e2e-20260923-140805.json) failed d and e for test-design
reasons. d: Copilot runs in the sandbox's project dir, which was the mlx-workspace root,
not the session's work dir, so poll.sh was never found and the loop session wrote one
shell `while true` instead of repeated view calls. e: the 8-bit OOM did not reproduce.
Called by .mise/tasks/bench-navpilot-e2e-rerun, which owns the lock and the server.

  --client ...                     wrapper for nav-pilot (BENCH_NAV_PILOT points here): makes the
                                   cwd a git root so cplt uses it as the project dir, puts the cwd
                                   in for {CWD}, appends $NP_EXTRA to Copilot's args
  session <out> <loop|poll> <port> _np_checks.session with absolute paths in the prompts
  faultdir <dir>                   write the sitecustomize.py that injects the fault
  fault   <out> <port> <sentinel>  healthy completion, sentinel, faulting request, exit 70, next launch
  verdicts <out>                   pass/fail for d and e
"""
import json
import os
import subprocess
import sys
import threading
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import _navpilot_e2e as E
import _np_checks as N

ROOT = N.ROOT

SITECUSTOMIZE = '''\
# Fault injection for bench-navpilot-e2e-rerun. Only on PYTHONPATH of that one server.
import os
_S = os.environ.get("NP_FAULT_SENTINEL")
if _S:
    import importlib
    _g = importlib.import_module("mlx_lm.generate")  # the package's `generate` attribute is the function
    _next = _g.BatchGenerator.next
    def _faulty_next(self, *a, **k):
        if os.path.exists(_S):
            raise RuntimeError("[metal::malloc] injected Metal OOM (bench-navpilot-e2e-rerun)")
        return _next(self, *a, **k)
    _g.BatchGenerator.next = _faulty_next
'''


def wrap():
    real, cwd = os.environ["NP_REAL"], os.getcwd()
    if not Path(cwd, ".git").exists():
        subprocess.run(["git", "init", "-q", cwd], check=True)
    args = [a.replace("{CWD}", cwd) for a in sys.argv[1:]] + os.environ.get("NP_EXTRA", "").split()
    os.execv(real, [real, *args])


def session(out, kind, port):
    files, _ = N.SESSIONS[kind]
    if kind == "loop":
        prompt = ("The file {CWD}/ready.txt will contain the line GO once an external job finishes. Check it "
                  "with the view tool, reading exactly {CWD}/ready.txt each time. If GO is not there, check again "
                  "the same way. Do not use any other tool, do not sleep, do not edit any file, and do not stop or "
                  "ask me anything until you have seen GO.")
    else:
        prompt = ("A deployment is rolling out. Check its status by running exactly `{CWD}/poll.sh` with the bash "
                  "tool, with the description \"Check deployment status\". While it prints pending, run exactly the "
                  "same command again, with no sleep and nothing else in between. When it prints READY, stop and "
                  "reply with the check number it printed.")
    N.SESSIONS[kind] = (files, prompt)
    N.session(out, kind, port)
    doc = N.load(out)
    rec = doc["sessions"][-1]
    rec["np_extra"] = os.environ.get("NP_EXTRA", "")
    rec["tools"] = sorted({t["sig"].split("(")[0] for t in N.session_turns(events_for(rec["work"])) if t["sig"]})
    rec["instruction_sources"] = instruction_sources(rec["work"])
    N.save(out, doc)
    print(f"  {kind}: tools={rec['tools']} guard={rec['guard_message']!r} completed={rec.get('completed')}", flush=True)


def events_for(work):
    for f in sorted(E.SESSIONS.glob("*/events.jsonl"), key=lambda f: f.stat().st_mtime, reverse=True)[:20]:
        first = json.loads(f.open().readline() or "{}")
        if (first.get("data") or {}).get("context", {}).get("cwd") == str(work):
            return [json.loads(line) for line in f.open() if line.strip()]
    return []


def instruction_sources(work):
    """Every path-like string in the session's events that names an instructions file."""
    import re
    hits = set()
    for e in events_for(work):
        for m in re.findall(r'[\w./~-]*(?:copilot-instructions\.md|AGENTS\.md|CLAUDE\.md|\.instructions\.md)',
                            json.dumps(e)):
            hits.add(m)
    return sorted(hits)


def faultdir(d):
    Path(d).mkdir(parents=True, exist_ok=True)
    Path(d, "sitecustomize.py").write_text(SITECUSTOMIZE)


def fault(out, port, sentinel):
    bh = N.bench_copilot().bh
    doc = N.load(out)
    model, pid = doc["model"], json.loads(E.STATE.read_text())["pid"]
    rec = doc["e"] = {"model": model, "pid": pid, "method": "sitecustomize raises in BatchGenerator.next once "
                      "the sentinel exists (PYTHONPATH on `alpha local start` only)"}
    off, start = bh.log_offset(), time.time()
    msgs = lambda: [{"role": "user", "content": f"[{time.time_ns()}] Reply with exactly: OK"}]
    try:
        rec["healthy"] = N.stream_once(port, model, msgs(), max_tokens=16)[0]
    except Exception as e:
        rec["healthy"] = N.failed(e)
    Path(sentinel).touch()

    def faulting():
        try:
            rec["faulting_request"] = N.stream_once(port, model, msgs(), max_tokens=16)[0]
        except Exception as e:
            rec["faulting_request"] = N.failed(e)
    t0 = time.time()
    threading.Thread(target=faulting, daemon=True).start()
    while E.alive(pid) and time.time() - t0 < 30:
        time.sleep(0.5)
    rec["server_exited"] = not E.alive(pid)
    rec["exit_wait_s"] = round(time.time() - t0, 1)
    time.sleep(1)
    chunk = E.log_since(off)
    ev = ROOT / ".bench-logs" / f"navpilot-rerun-fault-{time.strftime('%Y%m%d-%H%M%S')}.server.log"
    ev.write_text(chunk)
    rec["server_log"] = str(ev.relative_to(ROOT))
    lines = [line for line in chunk.splitlines() if line.strip()]
    rec["last_line"] = lines[-1] if lines else None
    rec["status_70_last"] = bool(lines) and "exiting with status 70" in lines[-1]
    rec["injected_in_log"] = "injected Metal OOM" in chunk

    work = ROOT / ".bench-logs" / "navpilot-e2e-work" / f"fault-{int(t0)}"
    work.mkdir(parents=True, exist_ok=True)
    log = ROOT / ".bench-logs" / f"navpilot-rerun-fault-launch-{time.strftime('%Y%m%d-%H%M%S')}.log"
    argv = [bh.NAV_PILOT, "--client", "copilot", "--model", model, "--", "--allow-all-tools", "--no-ask-user",
            "-p", "Reply with exactly: OK"]
    t1 = time.time()
    with log.open("w") as fh:
        fh.write(f"# argv: {argv!r}\n# cwd: {work}\n")
        fh.flush()
        proc = subprocess.Popen(argv, cwd=str(work), stdout=fh, stderr=subprocess.STDOUT,
                                stdin=subprocess.DEVNULL, start_new_session=True)
        rc, timed_out = bh.wait_with_deadline(proc, 120)
    text = log.read_text(errors="replace")
    rec["launch"] = {"exit": rc, "timed_out": timed_out, "seconds": round(time.time() - t1, 1),
                     "log": str(log.relative_to(ROOT)), "lost_message": E.LOST in text,
                     "local_server_lost": "local_server_lost" in text}
    N.phase(doc, "e-fault", start)
    N.save(out, doc)
    print(f"  fault: {json.dumps(rec)[:1500]}", flush=True)


def verdicts(out):
    doc = N.load(out)
    ss = {s["kind"]: s for s in doc.get("sessions", [])}
    lp, pl, e = ss.get("loop"), ss.get("poll"), doc.get("e")
    gm = lambda s: (s or {}).get("guard_message") or ""
    L = (e or {}).get("launch") or {}
    doc["verdicts"] = {
        "d_loop": bool(lp and "same result 4 times" in gm(lp)) if lp else None,
        "d_poll": bool(pl and pl.get("completed") and "same result" not in gm(pl)) if pl else None,
        "e": bool(e and e["server_exited"] and e["status_70_last"] and e["injected_in_log"]
                  and L.get("lost_message") and L.get("seconds", 999) < 60) if e else None,
    }
    N.save(out, doc)
    for k, v in doc["verdicts"].items():
        print(f"  {({True: 'pass', False: 'FAIL', None: 'not run'})[v]:8} {k}")


if __name__ == "__main__":
    if sys.argv[1:2] == ["--client"]:
        wrap()
    cmd, *args = sys.argv[1:]
    {"session": session, "faultdir": faultdir, "fault": fault, "verdicts": verdicts}[cmd](*args)
