#!/bin/bash
# nav-pilot's own-endpoint path (navikt/copilot #998, #1000) against real servers, unattended:
# mlx_lm.server, then Ollama, then llama-server. Waits for the GPU queue first. Every step's output
# goes to out/<step>.txt; a failed step is recorded and the run goes on. Ends by stopping the
# servers, releasing the lock, deleting the scratch HOME and touching endpoint-validation.done.
set -u
S=/private/tmp/claude-501/-Users-hans-mlx-workspace/f869846d-5571-4e13-94f1-74f86278bb0b/scratchpad
V=$S/val; OUT=$V/out; NPS=$S/nps; SH=$S/np-home
WS=/Users/hans/mlx-workspace; LOCK=$WS/.bench-logs/.queue.lock; DONE=$WS/.bench-logs/endpoint-validation.done
GGUF=$(ls /Users/hans/.cache/huggingface/hub/models--unsloth--Qwen3.6-35B-A3B-GGUF/snapshots/*/Qwen3.6-35B-A3B-UD-Q4_K_XL.gguf)
MLX_MODEL=mlx-community/Qwen3.6-35B-A3B-OptiQ-4bit
export PATH="$PATH:/Users/hans/.local/share/mise/installs/go/1.26.8/bin"
export NO_COLOR=1
mkdir -p "$OUT"

log() { echo "$(date '+%F %T') $*" | tee -a "$OUT/run.log"; }
# step <name> <timeout_s> cmd...: output to out/<name>.txt, exit status to the log.
step() {
  local name=$1 t=$2; shift 2
  log "--- $name: $*"
  local t0=$(date +%s)
  gtimeout -k 30 "$t" "$@" > "$OUT/$name.txt" 2>&1
  local rc=$?
  log "    $name exit $rc ($(( $(date +%s) - t0 )) s)"
  return $rc
}
ready() {  # ready <base> <seconds>: GET /v1/models answers 200
  local i
  for ((i = 0; i < $2; i += 5)); do
    [ "$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "$1/v1/models")" = 200 ] && return 0
    [ -n "$SERVER_PID" ] && ! kill -0 "$SERVER_PID" 2>/dev/null && return 1
    sleep 5
  done
  return 1
}
cfg() { grep -E "^$1 *=" "$SH/.nav-pilot/config.toml" 2>/dev/null | head -1 | sed -E 's/^[^=]*= *"?([^"]*)"?.*/\1/'; }
SERVER_PID=""
stop_server() {
  [ -n "$SERVER_PID" ] && kill "$SERVER_PID" 2>/dev/null
  for _ in $(seq 1 30); do [ -n "$SERVER_PID" ] && kill -0 "$SERVER_PID" 2>/dev/null || break; sleep 1; done
  [ -n "$SERVER_PID" ] && kill -9 "$SERVER_PID" 2>/dev/null
  pkill -f 'ollama runner' 2>/dev/null
  SERVER_PID=""
  sleep 5
}
HAVE_LOCK=""
cleanup() {
  stop_server
  pkill -f "^ollama serve" 2>/dev/null
  [ -n "$HAVE_LOCK" ] && rm -rf "$LOCK"
  rm -rf "$SH" "$S/ollama-pulltest"
  touch "$DONE"
  log "=== done: servers stopped, lock released, scratch HOME deleted, $DONE touched"
}

# ── wait for the GPU queue ───────────────────────────────────────────────────
# "/bench-" rather than "bench-": every command that merely names .bench-logs/ would match that.
log "=== waiting for launcher 98187, the queue lock and every benchmark process"
give_up=$(date -j -f '%Y-%m-%d %H:%M' "$(date -v+1d +%F) 10:00" +%s)
free_since=""
while :; do
  busy=$(pgrep -fl 'night-run|/bench-|mise run bench-|np-serve|mlx_lm[._]server|llama-server|ollama serve' | grep -v -e wait-gpu -e validate.sh)
  if ! kill -0 98187 2>/dev/null && [ ! -d "$LOCK" ] && [ -z "$busy" ]; then
    [ -z "$free_since" ] && free_since=$(date +%s)
    [ $(( $(date +%s) - free_since )) -ge 300 ] && break
  else
    free_since=""
  fi
  [ "$(date +%s)" -ge "$give_up" ] && { log "gave up waiting: ${busy:-lock or launcher}"; touch "$DONE"; exit 1; }
  sleep 60
done
mkdir "$LOCK" 2>/dev/null || { log "lock taken under us"; touch "$DONE"; exit 1; }
echo $$ > "$LOCK/pid"; HAVE_LOCK=1
trap cleanup EXIT
trap 'exit 130' INT TERM
log "=== queue free; lock held by pid $$"
log "power: $(pmset -g batt | head -1)"
log "network: en0 $(/usr/sbin/ipconfig getifaddr en0 2>/dev/null)"
log "wired limit: $(/usr/sbin/sysctl -n iogpu.wired_limit_mb) MB"
log "nav-pilot: $(go version -m /Users/hans/tmp/nav-pilot-local-endpoint | grep -E 'vcs.revision|vcs.modified' | tr -s ' \t' ' ')"
log "ollama $(ollama --version 2>&1 | tail -1); llama-server $(llama-server --version 2>&1 | head -1); mlx_lm $("$WS/.venv/bin/python" -c 'import mlx_lm; print(mlx_lm.__version__)')"

rm -rf "$SH"; mkdir -p "$SH"
step np-install 600 "$NPS" install --user --all --yes

# suite <key> <model> <port>: latency, decide, one local session.
suite() {
  local key=$1 model=$2 port=$3
  export NP_PORT=$port NP_MODEL=$model BENCH_NAV_PILOT=$NPS
  step "$key-lat" 1200 python3 "$V/dec.py" lat "$key" "$OUT/lat-$key.json"
  step "$key-why" 2700 python3 "$V/dec.py" why "$key" "$OUT/decide-why-$key.json"
  step "$key-sets" 2700 python3 "$V/dec.py" sets "$key" "$OUT/decide-sets-$key.json"
  step "$key-limits" 3600 python3 "$V/dec.py" limits "$key" "$OUT/decide-limits-$key.json"
  # One local session: opencode's own model is the endpoint's, no cloud orchestrator.
  local repo=$S/smoke-$key
  rm -rf "$repo"; mkdir -p "$repo"
  printf 'def greet(name):\n    return "Helo, " + name\n\n\nif __name__ == "__main__":\n    print(greet("world"))\n' > "$repo/greet.py"
  (cd "$repo" && git init -q && git add . && git -c user.name=smoke -c user.email=smoke@example.invalid -c commit.gpgsign=false commit -qm init)
  (cd "$repo" && step "$key-session" 1200 "$NPS" --client opencode --model "$model" -- run --format json \
    "greet.py has a typo: greet should return \"Hello, \" + name. Fix it. Then create test_greet.py that imports greet and asserts greet(\"Ada\") == \"Hello, Ada\", and run it with python3 test_greet.py.")
  {
    echo "greet.py:"; cat "$repo/greet.py"
    echo "test_greet.py:"; cat "$repo/test_greet.py" 2>&1
    echo "run: $(cd "$repo" && python3 test_greet.py >/dev/null 2>&1 && echo pass || echo fail)"
    echo "tool calls:"; grep -o '"tool":"[a-z_]*"' "$OUT/$key-session.txt" | sort | uniq -c
  } > "$OUT/$key-session-check.txt" 2>&1
  log "    session check: $(tr '\n' ' ' < "$OUT/$key-session-check.txt" | cut -c1-300)"
}

# ── 1. mlx_lm.server: nav-pilot's endpoint logic with the model its managed path runs ──
log "=== mlx_lm.server"
"$WS/.venv/bin/mlx_lm.server" --model "$MLX_MODEL" --port 8080 > "$OUT/mlx-server.log" 2>&1 &
SERVER_PID=$!
if ready http://127.0.0.1:8080 300; then
  curl -s http://127.0.0.1:8080/v1/models > "$OUT/mlx-models.json"
  step mlx-setup-yes 1200 "$NPS" alpha local setup --yes
  step mlx-setup-pty 1200 python3 "$V/pty_drive.py" "$OUT/mlx-setup-pty.tty" 1100 'Which model=enter' 'Save and turn=y' -- "$NPS" alpha local setup
  step mlx-setup-model 1200 "$NPS" alpha local setup --model "$MLX_MODEL" --yes
  step mlx-doctor 1200 "$NPS" alpha local doctor
  suite mlx "$MLX_MODEL" 8080
else
  log "mlx_lm.server did not answer in 5 min"
fi
stop_server

# ── 2. Ollama, started with its defaults, so the num_ctx trap can show ──
log "=== Ollama"
reg=$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 https://registry.ollama.ai/v2/)
log "registry.ollama.ai answers: ${reg:-000}"
ollama serve > "$OUT/ollama-server.log" 2>&1 &
SERVER_PID=$!
if ready http://127.0.0.1:11434 60; then
  if ! ollama list | grep -q '^qwen3.6:35b '; then
    step ollama-setup-nomodel 300 "$NPS" alpha local setup --yes
    step ollama-setup-nomodel-pty 300 python3 "$V/pty_drive.py" "$OUT/ollama-setup-nomodel-pty.tty" 250 'Download=n' -- "$NPS" alpha local setup
    if [ "$reg" != 000 ] && pmset -g batt | grep -q "'AC Power'" && /usr/sbin/ipconfig getifaddr en0 | grep -q '^192\.168\.'; then
      # The guided flow downloads it (about 23 GB): approved, and under the 50 GB cap with the GGUF.
      step ollama-setup-pull 5400 "$NPS" alpha local setup --pull --fix-context --yes
    else
      log "no pull: registry ${reg:-000}, or not on AC and home Wi-Fi"
    fi
  fi
  if ! ollama list | grep -q '^qwen3.6:35b '; then
    # Fallback: Ollama's own import of the GGUF already on disk. No tool-call parser, which is the
    # trap doctor names; recorded as such, not as Ollama's library model.
    printf 'FROM %s\n' "$GGUF" > "$S/Modelfile.gguf"
    step ollama-create-gguf 1800 ollama create qwen3.6:35b-gguf -f "$S/Modelfile.gguf"
    OMODEL=qwen3.6:35b-gguf
  else
    OMODEL=qwen3.6:35b
  fi
  ollama list > "$OUT/ollama-list.txt" 2>&1
  curl -s http://127.0.0.1:11434/v1/models > "$OUT/ollama-models.json"
  # The trap: the model as pulled, Ollama's default context.
  "$NPS" config set local_endpoint http://127.0.0.1:11434/v1 > /dev/null
  "$NPS" config set local_endpoint_model "$OMODEL" > /dev/null
  step ollama-doctor-default 1200 "$NPS" alpha local doctor
  ollama ps > "$OUT/ollama-ps-default.txt" 2>&1
  step ollama-setup-yes 1200 "$NPS" alpha local setup --model "$OMODEL" --yes
  step ollama-setup-fix 1200 "$NPS" alpha local setup --model "$OMODEL" --fix-context --yes
  COPY=$(echo "$OMODEL" | tr ':/' '--')-navpilot
  ollama rm "$COPY" > /dev/null 2>&1
  step ollama-setup-pty 1200 python3 "$V/pty_drive.py" "$OUT/ollama-setup-pty.tty" 1100 'Which model=enter' 'Create .*now=y' 'Save and turn=y' -- "$NPS" alpha local setup
  ollama list | grep -q "^$COPY" || step ollama-setup-fix2 1200 "$NPS" alpha local setup --model "$OMODEL" --fix-context --yes
  step ollama-doctor 1200 "$NPS" alpha local doctor
  ollama ps > "$OUT/ollama-ps.txt" 2>&1
  suite ollama "$(cfg local_endpoint_model)" 11434
  stop_server
  # setup --pull against a model whose weights are already here: a second Ollama with the blobs
  # cloned (APFS, no space) and no manifests, so it lists nothing and setup offers the pull.
  if [ "$OMODEL" = qwen3.6:35b ] && [ "$reg" != 000 ]; then
    rm -rf "$S/ollama-pulltest"; mkdir -p "$S/ollama-pulltest"
    cp -c -R "$HOME/.ollama/models/blobs" "$S/ollama-pulltest/blobs"
    OLLAMA_MODELS=$S/ollama-pulltest OLLAMA_HOST=127.0.0.1:11435 ollama serve > "$OUT/ollama-pulltest-server.log" 2>&1 &
    SERVER_PID=$!
    if ready http://127.0.0.1:11435 60; then
      step ollama-pull-flow-pty 1800 python3 "$V/pty_drive.py" "$OUT/ollama-pull-flow-pty.tty" 1700 'Download=y' 'Create .*now=y' 'Save and turn=n' -- "$NPS" alpha local setup --endpoint http://127.0.0.1:11435/v1
    fi
    stop_server
    rm -rf "$S/ollama-pulltest"
  fi
else
  log "ollama serve did not answer"
fi
stop_server

# ── 3. llama-server, with the command setup prints ──
log "=== llama-server"
llama-server --jinja -c 65536 --port 8080 -hf unsloth/Qwen3.6-35B-A3B-GGUF:UD-Q4_K_XL --offline > "$OUT/llama-server-hf.log" 2>&1 &
SERVER_PID=$!
LSTART="-hf --offline"
if ! ready http://127.0.0.1:8080 300; then
  log "llama-server -hf --offline did not come up; -m <file> instead"
  stop_server
  llama-server --jinja -c 65536 --port 8080 -m "$GGUF" > "$OUT/llama-server-m.log" 2>&1 &
  SERVER_PID=$!
  LSTART="-m"
  ready http://127.0.0.1:8080 300 || log "llama-server -m did not come up either"
fi
curl -s http://127.0.0.1:8080/v1/models > "$OUT/llama-models-noalias.json"
log "llama-server ($LSTART) lists: $(head -c 400 "$OUT/llama-models-noalias.json")"
rm -f "$SH/.nav-pilot/config.toml"
step llama-setup-yes 1200 "$NPS" alpha local setup --yes
step llama-setup-pty 1200 python3 "$V/pty_drive.py" "$OUT/llama-setup-pty.tty" 1100 'Which model=enter' 'Save and turn=y' -- "$NPS" alpha local setup
if [ "$(cfg local_endpoint)" != http://127.0.0.1:8080/v1 ]; then
  log "setup saved nothing for llama-server without --alias; restarting with --alias qwen3.6-35b"
  stop_server
  llama-server --jinja -c 65536 --port 8080 -m "$GGUF" --alias qwen3.6-35b > "$OUT/llama-server-alias.log" 2>&1 &
  SERVER_PID=$!
  ready http://127.0.0.1:8080 300
  curl -s http://127.0.0.1:8080/v1/models > "$OUT/llama-models-alias.json"
  step llama-setup-alias 1200 "$NPS" alpha local setup --yes
fi
step llama-doctor 1200 "$NPS" alpha local doctor
suite llama "$(cfg local_endpoint_model)" 8080
stop_server
log "=== all phases run"
