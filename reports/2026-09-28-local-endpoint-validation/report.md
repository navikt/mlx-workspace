# nav-pilot's own-endpoint path on real servers, 2026-09-28

## Question
Do `local_endpoint` (navikt/copilot#998) and `alpha local setup` / `doctor` (#1000) work against a real `mlx_lm.server`, Ollama and llama.cpp `llama-server`? How does each one compare with nav-pilot's managed mlx server on decide accuracy and latency?

If all three work, the Linux and bring-your-own-server route in the docs can stand. If one does not, the docs have to warn about it or drop it.

## What shipped
- navikt/copilot#1100, merged 2026-09-28 at about 01:30 UTC. Two first-run setup/doctor fixes:
  - An empty Ollama (`"data": null`) was read as "not answering", so `--pull` was never offered.
  - An untagged model listed as `name:latest` gave a false "does not list" WARN, even right after setup's own `--fix-context`.
  - Docs correction on `/nav-pilot/guider/lokal` and in the README: Ollama "can give too little context" rather than "cuts silently".
- Filed:
  - #1101: decide waits about 2.5 s at exit when the telemetry host is unreachable.
  - #1102: `mlx_lm.server` is shown as "llama-server" and lists the whole HF cache.

## Method
- **Machine:** M5 Max, 128 GB, wired limit 48 GB, on AC power.
- **nav-pilot:** 6af7ffa7, with a scratch HOME.
- **Run:** 2026-09-28 01:25–03:00 CEST, unattended (`scripts/validate.sh`), holding the bench queue lock.
- **Servers:**

  | Server | Version | Model |
  |---|---|---|
  | `mlx_lm.server` | 0.32.0 | Qwen3.6-35B-A3B OptiQ-4bit |
  | Ollama | 0.34.4 | `qwen3.6:35b-gguf` |
  | llama.cpp `llama-server` | 0.5.0 | unsloth `Qwen3.6-35B-A3B-GGUF:UD-Q4_K_XL` (22.36 GB) |

  - Ollama's model is an import of the unsloth GGUF (`FROM <gguf>`). The library model `qwen3.6:35b` could not be pulled: registry.ollama.ai and ollama.com timed out at TLS all night, most likely the local firewall.
  - llama-server ran with `--jinja -c 65536`.
- **Decide sets:** `commit-explains-why` (96), `issue-type` (105) and the `limits` sets (lang-en 32, lang-no 152, options 180). They were run through `scripts/dec.py`, which wraps the workspace harness.
- **Managed baselines:** the night 64-4 optiq-64g files (`decide-why-…-20260927-164829`, `decide-sets-…-164102`, `decide-limits-…-171653`). Speed comes from `bench/np-e2e-qwen3.6-35b-a3b-optiq-64g-20260926-234608.json`.
- **Session check:** one opencode session per server: fix a typo, write a new test file and run it.

## Results
Accuracy is k/n with a 95 % Wilson interval. Where no interval is given, it equals the column to its left for the same k/n.

| | managed mlx optiq-64g | endpoint → mlx_lm.server | endpoint → Ollama | endpoint → llama-server |
|---|---|---|---|---|
| commit-explains-why | 89/96 = 0.93 [0.86–0.96] | 89/96 | 87/96 = 0.91 [0.83–0.95] | 87/96 |
| issue-type | 95/105 = 0.90 [0.83–0.95] | 95/105 | 94/105 = 0.90 [0.82–0.94] | 94/105 |
| limits lang-en | 26/32 = 0.81 | 26/32 | 24/32 = 0.75 [0.58–0.87] | 24/32 |
| limits lang-no | 118/152 = 0.78 | 118/152 | 117/152 = 0.77 | 117/152 |
| limits options | 179/180 | 179/180 | 180/180 | 180/180 |
| decide model ms p50/p95 | 380/887 | 300/624 | 159/605 | 157/687 |
| TTFT cold ~2k | 0.73 s | 2.23 s (first request after load) | 0.82 s | 0.87 s |
| TTFT cold ~30k | 10.23 s | 9.38 s | 17.52 s | 19.11 s |
| Prefill at 30k (tok/s) | 3,022 | 3,114 | 1,667 | 1,529 |
| Decode at 2k / 30k (tok/s) | 90.7 / 78.9 | 92.9 / 80.9 | 98.8 / 75.4 | 102.8 / 78.5 |
| Warm TTFT at 30k | 0.38 s | 0.26 s | 0.22 s | 0.16 s |
| Session | – | ok | ok, but claimed «Testen passa» without running the test | ok |

- **Errors:** 0 in 565 calls per server.
- **Agreement:** Ollama and llama-server agree call for call on all 364 limits calls.
- **Accuracy:** endpoint → mlx_lm.server reproduces the managed answers exactly. Every GGUF-vs-OptiQ difference is inside the intervals.
- **Wall time:** decide took about 2.7 s per call, against 0.65 s in the night runs. The cause is not endpoint mode: the process waits about 2.5 s at exit for a telemetry export that the firewall blocks for the new binary. With `DO_NOT_TRACK=1` the same call takes 0.03 s (#1101).

### Doctor
- **All three servers:** all five checks passed (server, tool calls, logprobs 11/11, context 30,042 tokens kept, TTFT). Doctor's 30k TTFT was 8–9 s on mlx, 15–17 s on Ollama and 17–18 s on llama-server.
- **The num_ctx trap did not show with defaults.** Ollama 0.34.4 on 128 GB picked a 262,144-token context by itself (28 GB resident).
- **With a small context forced** (`OLLAMA_CONTEXT_LENGTH=4096`), Ollama now answers 400 `exceed_context_size_error` instead of cutting silently. Doctor still reports FAIL context, with the right fix.
- **`--fix-context --yes`** created `qwen3.6-35b-gguf-navpilot` (64k, 24 GB), re-checked it (PASS) and saved it.

### Setup UX
- On Ollama 0.34, setup still says "Ollama cut the prompt", and the FAIL line dumps five lines of escaped JSON.
- Interactive runs worked:
  - the select appears only when there is more than one choice;
  - Enter takes the recommended choice;
  - Save defaults to yes.

## Verdict
The own-endpoint path works on all three servers.
- **mlx_lm.server:** decide through an endpoint gives exactly the managed decide answers.
- **The unsloth GGUF on Ollama or llama-server:** level on accuracy within the intervals and level on decode speed, but with half the prefill (TTFT 17–19 s against 9–10 s at 30k).
- **Setup:** the two first-run bugs that would have misled a new Ollama user are fixed in #1100.

## Limits
- n is 32–180 per set. There was one session and one latency sample per server.
- It ran on one 128 GB Mac, so small-VRAM behaviour (4k default context, `--n-cpu-moe`) was not reachable.
- The `--pull` flow against a real registry and Ollama's own library build are untested, because the registry was blocked.
- `mlx_lm.server` ran without nav-pilot's server flags.
- This was macOS only. Linux is still unmeasured (see [UNMEASURED.md](../UNMEASURED.md)).

## Reproduce
`scripts/validate.sh` (unattended runner), `scripts/dec.py`, `scripts/pty_drive.py` and `scripts/fixctx.sh`. Transcripts, decide and latency JSON, and `run.log` are in `data/`.

## Sources
- navikt/copilot #998, #1000, #1100, #1101, #1102
- [Linux and Ollama research](../2026-09-27-qwen38-linux-ollama/research.md)
- [The 64 GB tier](../2026-09-26-64gb-tier/plan.md)
