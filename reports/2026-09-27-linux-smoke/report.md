---
verdict: "pass"
---

# Linux smoke test of nav-pilot's local endpoint path, 2026-09-27

## Question
Can a developer on Ubuntu LTS install nav-pilot and cplt with the official command, and then get `alpha local setup`, `alpha local doctor`, a trivial `alpha decide` and an opencode session working? The test covers both Ollama and llama.cpp's `llama-server`. It is a functional check with a small model, and it measures no performance.

## What shipped
Nothing. The first run on 2026-09-28 at 00:50 stopped at step 1 when the container lost outbound network, and it found [navikt/copilot#1099](https://github.com/navikt/copilot/issues/1099). The rerun on 2026-09-28 at 11:58–12:14 (below) found four more:
- [#1126](https://github.com/navikt/copilot/issues/1126): setup saves nothing when a check fails.
- [#1127](https://github.com/navikt/copilot/issues/1127): an OOM during `--fix-context` shows as "connection refused".
- [#1128](https://github.com/navikt/copilot/issues/1128): the apt snippet aborts without a terminal.
- [#1129](https://github.com/navikt/copilot/issues/1129): llama.cpp's ubuntu-arm64 build needs libgomp1.

## Method
- **Where.** The plan was a GCP spot VM. That was dropped because both gcloud accounts needed an interactive login, and the user has since ruled out running GCP infrastructure. The test ran in the local Colima Docker VM (Ubuntu 24.04, aarch64, 4 CPUs, 6 GB):
  - in a fresh `ubuntu:24.04` container capped at 5 GB and 4 CPUs;
  - as a non-root user with passwordless sudo;
  - with only a scratch output directory mounted, and no Nav code or secrets.
- **Contention.** The run held the bench queue lock and started only after night 64-5 had finished (00:49 CEST, 2026-09-28).
- **Planned model.** Qwen3 1.7B Q4_K_M. Neither copy of it was downloaded.
- **Install command.** The Linux block from the setup wizard on `/nav-pilot`. On Ubuntu this is the apt branch: keyring, sources entry, `sudo apt install nav-pilot cplt`. `install.sh` is the fallback.

## Results
All runs were arm64 Linux on CPU, in a container.

| Step | Result | Exact error line |
|---|---|---|
| 1a. Official install, apt branch | **FAIL** (network) | `E: Unable to locate package nav-pilot` (after `W: Failed to fetch https://navikt.github.io/apt/dists/stable/InRelease  Could not connect to navikt.github.io:443 ..., connection timed out`) |
| 1b. Fallback, `install.sh` | **FAIL** (network) | `curl: (28) Failed to connect to raw.githubusercontent.com port 443 after 300117 ms: Timeout was reached` |
| 2. `alpha local setup` against Ollama | not run | – |
| 3. `alpha local setup` against `llama-server` | not run | – |
| 4. `alpha local doctor` | not run | – |
| 5. Trivial `alpha decide` | not run | – |
| 6. opencode session | not run | – |

**Network:**
- **Container and Colima VM:** outbound TCP worked at 00:50. From about 00:52 every connection timed out, though DNS still resolved.
- **The Mac host:** it could reach github.com, raw.githubusercontent.com and huggingface.co, but not navikt.github.io, ollama.com, registry.ollama.ai or ports.ubuntu.com.
- **Recovery:** none in 15 minutes of polling.
- **Cause:** local, this Mac's network that night. The same night's endpoint validation saw the Ollama registry blocked too. It is not a nav-pilot fault.

### UX friction found
1. **The apt snippet hides a failed keyring download** ([#1099](https://github.com/navikt/copilot/issues/1099)). `curl -fsSL ... | sudo tee keyring` returns `tee`'s status, so a failed download leaves a 0-byte keyring and the block keeps going.
   - The user's last line is then `E: Unable to locate package nav-pilot`, which points at the wrong cause.
   - The `install.sh` fallback never runs.
   - The empty keyring and the sources entry stay behind.
2. **Linux installs depend on GitHub Pages.** The apt archive is on `navikt.github.io`. Behind a proxy that blocks GitHub Pages but not github.com, only `install.sh` works, and the page offers it only to distros that aren't Debian-based.
3. **`ubuntu:24.04` has no `sudo` or `curl`.** This matters for containers and CI only.

## Rerun, 2026-09-28 11:58–12:14

The firewall had been opened, and the Mac reached every host.
- **Setup:** the same container setup: ubuntu:24.04 arm64, 4 CPUs, a 5 GiB cgroup, a non-root sudo user. It held the queue lock and used nav-pilot 6efd04e, which has #1100.
- **Two passes** ran in one container. Pass 1 ran [`inner.sh`](data/inner.sh). Pass 2 ran [`inner2.sh`](data/inner2.sh), which repeated what pass 1 lost to the network and to setup saving nothing.
- **Logs:** step outputs are in `data/`, and `run.log` has the times in UTC.

| Step | Result | Evidence |
|---|---|---|
| 1a. Wizard's apt block, verbatim | **FAIL without a tty**: the keyring and archive work, but apt asks "[Y/n]" because it pulls in bubblewrap, and aborts. With `-y`: nav-pilot 6efd04e and cplt f21c8e1 installed | `1a-apt.txt`, `1a-apt-yes.txt`, #1128 |
| 1b. `install.sh` | **FAIL, transient network**: `curl` to github.com timed out after 134 s. github.com answered from the same container two minutes later | `1b-installsh.txt` |
| `nav-pilot install --user --all --yes` | first try FAIL: `git clone` gnutls handshake error at the same time as 1b. Retry PASS, 63 items | `np-install.txt`, `p2-np-install.txt` |
| 2. Setup against Ollama (latest `install.sh`), `qwen3:1.7b` | **FAIL context, nothing saved**: PASS server, tool calls and logprobs, then "about 30k tokens went in and 2050 were kept: the server cuts prompts". TTFT 9.8 s. `ollama ps`: 1.9 GB, 100 % CPU, context 4096 | `ollama-setup.txt`, `ollama-ps.txt` |
| 2b. `setup --fix-context --yes` | **FAIL on memory, reported as a network error**: the 64k copy (capped at 40,960, with 4,480 MiB of KV) got the whole of `ollama serve` OOM-killed (`oom_kill 4`), and setup said "connection refused" | `p2-ollama-fix.txt`, #1127 |
| 3. llama-server b11227 ubuntu-arm64, unsloth Qwen3-1.7B Q4_K_M | **FAIL to start**: `libgomp.so.1` missing. After `apt install libgomp1`, the default context (40,960) was OOM-killed at load | `run.log`, `p2-llama-server-default-tail.txt`, #1129 |
| 3b. llama-server `-c 16384` | starts. Setup: **FAIL context**, a clean 400 `exceed_context_size_error` (30,042 > 16,384), nothing saved | `llama-setup.txt` |
| 4.–6. doctor, trivial decide, opencode session | **not reached**: with nothing saved, doctor says `local_endpoint is not set`, decide says no server is running, and the opencode session ends with "UnknownError" | `p2-llama-session.txt`, #1126 |

What this shows:
- **Ollama's `num_ctx` trap is real on Linux CPU.** Same Ollama version (0.34.4) as the Mac run. On the Mac, with `OLLAMA_CONTEXT_LENGTH=4096` set, it answered 400. Here, with the 4k it picked by itself on CPU, it cut the prompt without saying so. Doctor caught it. Which difference causes this, the explicit setting or the CPU runner, is not isolated.
- **On a 6 GB machine, doctor's context check cannot pass, as expected.** The 30k probe needs about 3.4 GB of KV. Setup then saves nothing, so a small machine has no usable config unless you run `nav-pilot config set` by hand (#1126). Setup never says so.
- **The failures are clear except for the OOM** (#1127).

## Pass 3, 2026-09-28 19:00–19:19 (saved config)

[`inner3.sh`](data/inner3.sh) ran in a fresh container with the same setup: ubuntu:24.04 arm64, 4 CPUs and a 5 GiB cgroup. It used nav-pilot b10a4ba and cplt 0014b78 from apt, and Qwen3 1.7B Q4 on both servers. `data/p3-run.txt` has the times in UTC.

| Step | llama-server b11227, `-c 32768` | Ollama 0.34.4, `qwen3:1.7b` |
|---|---|---|
| Install (apt with `-y` and `libgomp1`, `nav-pilot install`, opencode) | PASS | PASS |
| Server up | PASS: it started in 5 GiB | PASS |
| `alpha local setup --yes` | FAIL context, nothing saved: PASS server, tool calls and logprobs, then "no answer within 10m0s". The average prefill rate on 4 CPUs fell from 167 to 43 tokens/s as the prompt grew, and it had reached 24,576 of about 30k tokens when setup gave up | not run: config set by hand |
| Config saved by hand (`config set`) | PASS | PASS |
| `alpha local doctor` | exit 1. llama-server was OOM-killed (`oom_kill 1`) on doctor's first chat request, right after setup's 24.5k-token prompt had left the cgroup at 5,069 of 5,120 MiB. Doctor's own 30k probe never reached it. Doctor reported FAIL tool calls (`EOF`, with a `--jinja` fix that does not apply, navikt/copilot#1223), WARN logprobs and FAIL context ("most likely out of memory") | exit 1, FAIL context: "about 30k tokens went in and 2050 were kept". PASS server, tool calls, logprobs, and "TTFT 30.3 s", which is for the 2,047 tokens kept, not for 30k. `ollama ps`: context 4096, 100 % CPU |
| `alpha decide`, 3 calls | not reached: the server was dead, and each call exits 2 with "the local endpoint is not answering" | **PASS**: 3/3 answer `yes` (p = 1.0), 21–398 ms |
| opencode session through nav-pilot | not reached: "launch failed: the local endpoint is not answering" | **launches and runs** (1 min 52 s, exit 0), but does no work. Each step's input was cut to about 2,046 tokens. The model called `write` without `content`, then wrote `/path/to/file.txt`, which was rejected as outside the project. greet.py was unchanged, and no test was written |

What this shows:
- **On Linux, with a saved config, the plumbing works on Ollama.** Doctor runs and names the right fault. Decide answers from the local model in milliseconds. `nav-pilot --client opencode` launches opencode in cplt against the local endpoint, and the model makes tool calls.
- **A 6 GB CPU box cannot run a real session.** At Ollama's default 4k context, the session prompt (15,322 tokens by Ollama's log) is cut to about 2k tokens, and the model works blind. llama-server at 32k started without being killed, at 5,119 of 5,120 MiB, page cache included. After a 24.5k-token prompt it died on the next request. Both are the context and memory limits this report already names. Doctor caught Ollama's cut exactly. For the dead llama-server it blamed the chat template first (navikt/copilot#1223).
- **The context probe does not suit a CPU-only machine.** At that rate a 30k prompt needs more than 10 minutes (24,576 tokens after 571 s), so setup's limit ran out first. A user on a CPU-only Linux laptop waits 10 minutes for a FAIL (navikt/copilot#1222).
- **The llama-server column never reached decide or a session.** A run with `-c 16384`, where doctor fails the probe but the server lives, would cover it. The Ollama column already shows that the path works.

## Verdict
**The Linux path works, with limits.** With a saved config on Ollama:
- the install works (apt, with `-y` in CI);
- doctor runs and gives the right diagnosis;
- `alpha decide` answers;
- an opencode session launches through nav-pilot and cplt against the local model.

On a 6 GB CPU-only machine, no coding session succeeds. The context either fits in memory and is cut to 4k (Ollama), or it is large enough and gets OOM-killed (llama-server at 32k, after a long prompt). The minimum RAM for a working session on CPU is still unmeasured. The llama-server path was verified up to doctor, not beyond it.

## Limits
- **Rerun:** done on 2026-09-28 at 11:58, and pass 3 at 19:00. github.com dropped out from the VM for about two minutes during the 11:58 rerun.
- **Coverage:** a rerun in Colima is still arm64 on CPU. x86_64, and x86_64 with NVIDIA, stay unmeasured ([UNMEASURED.md](../UNMEASURED.md)).
- **Memory:** the 6 GB VM fits a 1.7B Q4 model, but not doctor's ~30k-token context probe at f16. That probe needs about 3.4 GB of KV cache on top of about 1 GB of weights, and setup's `--fix-context` 65,536 needs about 7 GB. Confirmed by the rerun: `--fix-context` and llama-server's default 40,960 were both OOM-killed in 5 GiB.

## Reproduce
1. Start a fresh `ubuntu:24.04` container, add `sudo` and `curl`, and switch to a non-root sudo user.
2. Paste the Linux block from the setup wizard on `/nav-pilot`. Add `-y` without a tty. For llama.cpp's ubuntu-arm64 build, `apt install libgomp1`.
3. Run `nav-pilot alpha local setup` and `nav-pilot alpha local doctor` against each server:
   - `ollama serve` with `qwen3:1.7b`
   - `llama-server --jinja -m Qwen3-1.7B-Q4_K_M.gguf --alias qwen3-1.7b`

Hold `.bench-logs/.queue.lock` for the run. Colima mounts only the home directory, so mount an output directory from there. The scripts are `data/inner.sh`, `data/inner2.sh` and `data/inner3.sh`.

## Sources
- [Linux/Ollama research](../2026-09-27-qwen38-linux-ollama/research.md) §3–4
- [Local endpoint validation on macOS](../2026-09-28-local-endpoint-validation/report.md)
- navikt/copilot #998, #1000, #1099
