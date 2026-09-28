#!/bin/bash
# Second pass, same container: pass 1 lost nav-pilot install to a github.com TLS failure,
# and Ollama setup stopped at FAIL context without --fix-context, so nothing was saved.
set -u
OUT=/out; cd ~
export NO_COLOR=1 PATH="$HOME/.local/bin:$HOME/.opencode/bin:$PATH"
log() { echo "$(date '+%F %T') $*" >> $OUT/run.log; }
step() {
  local name=$1 t=$2; shift 2
  log "--- $name"
  local t0=$(date +%s)
  timeout -k 20 "$t" bash -c "$*" > "$OUT/$name.txt" 2>&1 < /dev/null
  local rc=$?
  log "    $name exit $rc ($(( $(date +%s) - t0 )) s)"
  return $rc
}
mem() { log "    cgroup memory.current $(( $(cat /sys/fs/cgroup/memory.current) / 1048576 )) MiB, peak $(( $(cat /sys/fs/cgroup/memory.peak) / 1048576 )) MiB, $(grep -E 'oom_kill' /sys/fs/cgroup/memory.events | tr '\n' ' ')"; }
ready() { for ((i = 0; i < $2; i += 5)); do [ "$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "$1")" = 200 ] && return 0; sleep 5; done; return 1; }
session() {
  local key=$1 model=$2 repo=$HOME/smoke-$1
  rm -rf "$repo"; mkdir -p "$repo"
  printf 'def greet(name):\n    return "Helo, " + name\n\n\nif __name__ == "__main__":\n    print(greet("world"))\n' > "$repo/greet.py"
  (cd "$repo" && git init -q && git add . && git -c user.name=smoke -c user.email=smoke@example.invalid commit -qm init)
  local prompt='greet.py has a typo: greet should return "Hello, " + name. Fix it. Then create test_greet.py that imports greet and asserts greet("Ada") == "Hello, Ada", and run it with python3 test_greet.py.'
  step "$key-session" 1200 "cd $repo && nav-pilot --client opencode --model '$model' -- run --format json '$prompt'"
  {
    echo "greet.py:"; cat "$repo/greet.py"
    echo "test_greet.py:"; cat "$repo/test_greet.py" 2>&1
    echo "run: $(cd "$repo" && python3 test_greet.py >/dev/null 2>&1 && echo pass || echo fail)"
    echo "tool calls:"; grep -o '"tool":"[a-z_]*"' "$OUT/$key-session.txt" | sort | uniq -c
  } > "$OUT/$key-session-check.txt" 2>&1
  mem
}
decide() {
  step "$1-decide" 120 'echo "Hello there, how are you today?" > /tmp/ev.txt; s=$(date +%s%N); nav-pilot alpha decide "Is this text a greeting?" --options yes,no --evidence /tmp/ev.txt --json --timeout 60s; echo "rc $?"; echo "wall_ms $(( ($(date +%s%N) - s) / 1000000 ))"'
}
log "=== pass 2"
pkill -f llama-server; pkill -f 'ollama serve'; pkill -f 'ollama runner'; sleep 3
step p2-np-install 900 'nav-pilot install --user --all --yes'

# llama-server again, with whatever pass 1 could start (default context, else 16k).
LS=$(find ~/llama -name llama-server -type f | head -1); export LD_LIBRARY_PATH="$(dirname "$LS")"
# libgomp1 was missing in pass 1 (installed by hand between passes). Default context first, else 16k.
LARGS=()
"$LS" --jinja -m ~/models/Qwen3-1.7B-Q4_K_M.gguf --alias qwen3-1.7b --port 8080 > $OUT/p2-llama-server-default.log 2>&1 &
LPID=$!
if ! ready http://127.0.0.1:8080/v1/models 120 || ! kill -0 $LPID 2>/dev/null; then
  log "    llama-server default context did not come up: $(tail -2 $OUT/p2-llama-server-default.log | tr '\n' ' ')"
  kill $LPID 2>/dev/null; LARGS=(-c 16384)
  "$LS" --jinja -m ~/models/Qwen3-1.7B-Q4_K_M.gguf --alias qwen3-1.7b --port 8080 "${LARGS[@]}" > $OUT/p2-llama-server-c16k.log 2>&1 &
  LPID=$!
fi
if ready http://127.0.0.1:8080/v1/models 180; then
  log "    llama-server up (${LARGS[*]:-default context})"
  step p2-llama-setup 1500 'nav-pilot alpha local setup --yes; echo "exit $?"; cat ~/.nav-pilot/config.toml'
  mem
  decide p2-llama
  session p2-llama qwen3-1.7b
fi
kill $LPID 2>/dev/null; sleep 3

# Ollama: setup --fix-context (expected to fail on memory in 5 GB), then doctor.
ollama serve > $OUT/p2-ollama-server.log 2>&1 &
OPID=$!
ready http://127.0.0.1:11434/api/tags 60
step p2-ollama-fix 1500 'nav-pilot alpha local setup --fix-context --yes; echo "exit $?"; ollama list; ollama ps'
mem
# Nothing saved for Ollama: point nav-pilot at the plain model by hand, as the doctor's hint says.
grep -q '11434' ~/.nav-pilot/config.toml 2>/dev/null || step p2-ollama-config 30 'nav-pilot config set local_endpoint http://127.0.0.1:11434/v1 && nav-pilot config set local_endpoint_model qwen3:1.7b && nav-pilot config set local_enabled true; cat ~/.nav-pilot/config.toml'
step p2-ollama-doctor 1500 'nav-pilot alpha local doctor; echo "exit $?"; ollama ps'
mem
decide p2-ollama
session p2-ollama "$(sed -nE 's/^local_endpoint_model *= *"?([^"]*)"?.*/\1/p' ~/.nav-pilot/config.toml 2>/dev/null | head -1)"
step p2-ollama-ps 30 'ollama ps; cat ~/.nav-pilot/config.toml'
kill $OPID 2>/dev/null
log "=== pass 2 end"
