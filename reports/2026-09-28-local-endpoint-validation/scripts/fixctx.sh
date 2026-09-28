#!/bin/bash
# Ollama's num_ctx trap, forced: OLLAMA_CONTEXT_LENGTH=4096, then doctor, setup --fix-context --yes, doctor.
set -u
S=/private/tmp/claude-501/-Users-hans-mlx-workspace/f869846d-5571-4e13-94f1-74f86278bb0b/scratchpad
OUT=$S/val/out; LOCK=/Users/hans/mlx-workspace/.bench-logs/.queue.lock
export NO_COLOR=1
mkdir "$LOCK" || exit 1; echo $$ > "$LOCK/pid"
mkdir -p $S/np-home
trap 'kill $P 2>/dev/null; sleep 3; pkill -f "ollama runner"; ollama rm qwen3.6-35b-gguf-navpilot >/dev/null 2>&1; rm -rf "$LOCK" $S/np-home' EXIT
OLLAMA_CONTEXT_LENGTH=4096 ollama serve > $OUT/ollama-4k-server.log 2>&1 & P=$!
sleep 5
$S/nps config set local_endpoint http://127.0.0.1:11434/v1 >/dev/null
$S/nps config set local_endpoint_model qwen3.6:35b-gguf >/dev/null
$S/nps alpha local doctor > $OUT/ollama-4k-doctor.txt 2>&1; echo "doctor exit $?" >> $OUT/ollama-4k-doctor.txt
ollama ps > $OUT/ollama-4k-ps.txt
$S/nps alpha local setup --model qwen3.6:35b-gguf --yes > $OUT/ollama-4k-setup-nofix.txt 2>&1; echo "exit $?" >> $OUT/ollama-4k-setup-nofix.txt
$S/nps alpha local setup --model qwen3.6:35b-gguf --fix-context --yes > $OUT/ollama-4k-setup-fix.txt 2>&1; echo "exit $?" >> $OUT/ollama-4k-setup-fix.txt
$S/nps alpha local doctor > $OUT/ollama-4k-doctor-after.txt 2>&1; echo "doctor exit $?" >> $OUT/ollama-4k-doctor-after.txt
ollama ps > $OUT/ollama-4k-ps-after.txt
