#!/bin/bash
# Pass 3, fresh container: the configurations that fit in 5 GB, saved, then doctor, decide and one opencode session.
set -u
OUT=/out; cd ~
export NO_COLOR=1 PATH="$HOME/.local/bin:$HOME/.opencode/bin:$PATH"
log() { echo "$(date '+%F %T') $*" >> $OUT/run.log; }
step() { local name=$1 t=$2; shift 2; log "--- $name"; local t0=$(date +%s); timeout -k 20 "$t" bash -c "$*" > "$OUT/$name.txt" 2>&1 < /dev/null; local rc=$?; log "    $name exit $rc ($(( $(date +%s) - t0 )) s)"; return $rc; }
mem() { log "    cgroup memory.current $(( $(cat /sys/fs/cgroup/memory.current) / 1048576 )) MiB, peak $(( $(cat /sys/fs/cgroup/memory.peak) / 1048576 )) MiB, $(grep -E 'oom_kill' /sys/fs/cgroup/memory.events | tr '\n' ' ')"; }
ready() { for ((i = 0; i < $2; i += 5)); do [ "$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "$1")" = 200 ] && return 0; sleep 5; done; return 1; }
session() {
  local key=$1 model=$2 repo=$HOME/smoke-$1
  rm -rf "$repo"; mkdir -p "$repo"
  printf 'def greet(name):\n    return "Helo, " + name\n\n\nif __name__ == "__main__":\n    print(greet("world"))\n' > "$repo/greet.py"
  (cd "$repo" && git init -q && git add . && git -c user.name=smoke -c user.email=smoke@example.invalid commit -qm init)
  local prompt='greet.py has a typo: greet should return "Hello, " + name. Fix it. Then create test_greet.py that imports greet and asserts greet("Ada") == "Hello, Ada", and run it with python3 test_greet.py.'
  step "$key-session" 1200 "cd $repo && nav-pilot --client opencode --model '$model' -- run --format json '$prompt'"
  { echo "greet.py:"; cat "$repo/greet.py"; echo "test_greet.py:"; cat "$repo/test_greet.py" 2>&1
    echo "run: $(cd "$repo" && python3 test_greet.py >/dev/null 2>&1 && echo pass || echo fail)"
    echo "tool calls:"; grep -o '"tool":"[a-z_]*"' "$OUT/$key-session.txt" | sort | uniq -c; } > "$OUT/$key-session-check.txt" 2>&1
  mem
}
decide() { step "$1-decide" 180 'echo "Hello there, how are you today?" > /tmp/ev.txt; for i in 1 2 3; do s=$(date +%s%N); nav-pilot alpha decide "Is this text a greeting?" --options yes,no --evidence /tmp/ev.txt --json --timeout 60s; echo " rc $? wall_ms $(( ($(date +%s%N) - s) / 1000000 ))"; done'; }
log "=== pass 3 $(uname -m), cgroup max $(( $(cat /sys/fs/cgroup/memory.max) / 1048576 )) MiB"
step p3-apt 600 'curl -fsSL https://navikt.github.io/apt/keyring/navikt-archive-keyring.gpg | sudo tee /usr/share/keyrings/navikt-archive-keyring.gpg >/dev/null && echo "deb [signed-by=/usr/share/keyrings/navikt-archive-keyring.gpg] https://navikt.github.io/apt stable main" | sudo tee /etc/apt/sources.list.d/navikt.list && sudo apt-get update -qq && sudo apt-get install -y nav-pilot cplt libgomp1 && nav-pilot --version && cplt --version'
step p3-np-install 900 'nav-pilot install --user --all --yes'
step p3-opencode-install 600 'curl -fsSL https://opencode.ai/install | bash && opencode --version'
step p3-llama-install 900 'mkdir -p ~/llama ~/models && cd ~/llama && curl -fsSL -o l.tgz https://github.com/ggml-org/llama.cpp/releases/download/b11227/llama-b11227-bin-ubuntu-arm64.tar.gz && tar xzf l.tgz && rm l.tgz && curl -fsSL -o ~/models/Qwen3-1.7B-Q4_K_M.gguf https://huggingface.co/unsloth/Qwen3-1.7B-GGUF/resolve/main/Qwen3-1.7B-Q4_K_M.gguf'
LS=$(find ~/llama -name llama-server -type f | head -1); export LD_LIBRARY_PATH="$(dirname "$LS")"
# 32k: 3.5 GiB of f16 KV plus ~1 GiB of weights, the largest that should fit 5 GiB and still hold doctor's 30k probe.
"$LS" --jinja -m ~/models/Qwen3-1.7B-Q4_K_M.gguf --alias qwen3-1.7b --port 8080 -c 32768 > $OUT/p3-llama-server.log 2>&1 &
LPID=$!
if ready http://127.0.0.1:8080/v1/models 180 && kill -0 $LPID 2>/dev/null; then
  log "    llama-server -c 32768 up"; mem
  step p3-llama-setup 1500 'nav-pilot alpha local setup --yes; echo "exit $?"; cat ~/.nav-pilot/config.toml'
  mem
  grep -q 8080 ~/.nav-pilot/config.toml 2>/dev/null || step p3-llama-config 30 'nav-pilot config set local_endpoint http://127.0.0.1:8080/v1 && nav-pilot config set local_endpoint_model qwen3-1.7b && nav-pilot config set local_enabled true'
  step p3-llama-doctor 1500 'nav-pilot alpha local doctor; echo "exit $?"'
  mem
  decide p3-llama
  session p3-llama qwen3-1.7b
else
  log "    llama-server -c 32768 did not come up: $(tail -2 $OUT/p3-llama-server.log | tr '\n' ' ')"; mem
fi
kill $LPID 2>/dev/null; sleep 3
step p3-ollama-install 900 'curl -fsSL https://ollama.com/install.sh | sh && ollama --version'
ollama serve > $OUT/p3-ollama-server.log 2>&1 &
OPID=$!
ready http://127.0.0.1:11434/api/tags 60
step p3-ollama-pull 900 'ollama pull qwen3:1.7b'
rm -f ~/.nav-pilot/config.toml
step p3-ollama-config 30 'nav-pilot config set local_endpoint http://127.0.0.1:11434/v1 && nav-pilot config set local_endpoint_model qwen3:1.7b && nav-pilot config set local_enabled true'
step p3-ollama-doctor 1500 'nav-pilot alpha local doctor; echo "exit $?"; ollama ps'
mem
decide p3-ollama
session p3-ollama qwen3:1.7b
step p3-ollama-ps 30 'ollama ps'
kill $OPID 2>/dev/null
log "=== pass 3 end"
