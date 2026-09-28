#!/bin/bash
# Linux smoke rerun, inside a fresh ubuntu:24.04 container, as a non-root sudo user.
# Every step's output goes to /out/<step>.txt, its exit status to /out/run.log. A failed step is recorded and the run goes on.
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
peak() { log "    cgroup memory.peak $(( $(cat /sys/fs/cgroup/memory.peak 2>/dev/null || echo 0) / 1048576 )) MiB, oom_kill $(grep oom_kill /sys/fs/cgroup/memory.events 2>/dev/null | tr '\n' ' ')"; }
ready() { for ((i = 0; i < $2; i += 5)); do [ "$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "$1")" = 200 ] && return 0; sleep 5; done; return 1; }

log "=== start $(uname -m) $(. /etc/os-release; echo $PRETTY_NAME), $(nproc) CPU, cgroup max $(( $(cat /sys/fs/cgroup/memory.max) / 1048576 )) MiB"

# 1a. The wizard's Linux block, verbatim (NAV_PILOT_APT_INSTALL).
step 1a-apt 900 'curl -fsSL https://navikt.github.io/apt/keyring/navikt-archive-keyring.gpg \
  | sudo tee /usr/share/keyrings/navikt-archive-keyring.gpg >/dev/null
echo "deb [signed-by=/usr/share/keyrings/navikt-archive-keyring.gpg] https://navikt.github.io/apt stable main" \
  | sudo tee /etc/apt/sources.list.d/navikt.list
sudo apt update && sudo apt install nav-pilot cplt'
step 1a-versions 60 'command -v nav-pilot cplt; nav-pilot --version; cplt --version; dpkg -l nav-pilot cplt | tail -2'

# 1b. The install.sh fallback, into its own directory so it does not touch the apt copy.
step 1b-installsh 600 'curl -fsSL https://raw.githubusercontent.com/navikt/copilot/main/scripts/install.sh | bash -s -- --dir $HOME/isbin && $HOME/isbin/nav-pilot --version'

step np-install 600 'nav-pilot install --user --all --yes'
step opencode-install 600 'curl -fsSL https://opencode.ai/install | bash && opencode --version'

# session <key> <model>: one opencode session through nav-pilot against the saved endpoint.
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
  peak
}
decide() {  # decide <key>: a trivial decide, timed end to end (telemetry export included)
  step "$1-decide" 120 'echo "Hello there, how are you today?" > /tmp/ev.txt; s=$(date +%s%N); nav-pilot alpha decide "Is this text a greeting?" --options yes,no --evidence /tmp/ev.txt --json --timeout 60s; echo "wall_ms $(( ($(date +%s%N) - s) / 1000000 ))"'
}

# 2. Ollama with qwen3:1.7b (Q4_K_M).
step ollama-install 900 'curl -fsSL https://ollama.com/install.sh | sh && ollama --version'
ollama serve > $OUT/ollama-server.log 2>&1 &
OPID=$!
if ready http://127.0.0.1:11434/api/tags 60; then
  step ollama-pull 1200 'ollama pull qwen3:1.7b && ollama list && ollama show qwen3:1.7b'
  step ollama-setup 1500 'nav-pilot alpha local setup --yes; echo "exit $?"; cat ~/.nav-pilot/config.toml'
  peak
  step ollama-ps 30 'ollama ps'
  step ollama-doctor 1500 'nav-pilot alpha local doctor; echo "exit $?"'
  peak
  decide ollama
  session ollama qwen3:1.7b
  step ollama-ps-after 30 'ollama ps'
else
  log "ollama serve did not answer"
fi
kill $OPID 2>/dev/null; pkill -f 'ollama runner' 2>/dev/null; sleep 5
rm -f ~/.nav-pilot/config.toml.bak; cp ~/.nav-pilot/config.toml $OUT/config-after-ollama.toml 2>/dev/null

# 3. llama-server (llama.cpp b11227, ubuntu-arm64) with unsloth Qwen3-1.7B Q4_K_M, as the report's Reproduce section says.
step llama-install 900 'mkdir -p ~/llama ~/models && cd ~/llama && curl -fsSL -o l.tgz https://github.com/ggml-org/llama.cpp/releases/download/b11227/llama-b11227-bin-ubuntu-arm64.tar.gz && tar xzf l.tgz && rm l.tgz && curl -fsSL -o ~/models/Qwen3-1.7B-Q4_K_M.gguf https://huggingface.co/unsloth/Qwen3-1.7B-GGUF/resolve/main/Qwen3-1.7B-Q4_K_M.gguf && ls -la ~/models && find ~/llama -name llama-server'
LS=$(find ~/llama -name llama-server -type f | head -1)
LDIR=$(dirname "$LS"); export LD_LIBRARY_PATH="$LDIR:${LD_LIBRARY_PATH:-}"
start_llama() {  # start_llama <label> [extra args]
  local label=$1; shift
  "$LS" --version > $OUT/llama-version.txt 2>&1
  "$LS" --jinja -m ~/models/Qwen3-1.7B-Q4_K_M.gguf --alias qwen3-1.7b --port 8080 "$@" > $OUT/llama-server-$label.log 2>&1 &
  LPID=$!
  if ready http://127.0.0.1:8080/v1/models 180 && kill -0 $LPID 2>/dev/null; then log "    llama-server ($label: $*) up"; return 0; fi
  log "    llama-server ($label: $*) did not come up: $(tail -3 $OUT/llama-server-$label.log | tr '\n' ' ')"; kill $LPID 2>/dev/null; return 1
}
if [ -n "$LS" ]; then
  start_llama default || start_llama c16k -c 16384
  peak
  step llama-setup 1500 'nav-pilot alpha local setup --yes; echo "exit $?"; cat ~/.nav-pilot/config.toml'
  peak
  step llama-doctor 1500 'nav-pilot alpha local doctor; echo "exit $?"'
  peak
  if ! kill -0 $LPID 2>/dev/null; then log "    llama-server died during doctor; restarting at -c 16384"; start_llama c16k-after -c 16384; fi
  decide llama
  session llama qwen3-1.7b
  kill $LPID 2>/dev/null
fi
log "=== end"
bash /out/inner2.sh
