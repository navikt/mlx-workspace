# Linux smoke test of nav-pilot's local endpoint path, 2026-09-27

## Question
Can a developer on Ubuntu LTS install nav-pilot and cplt with the official command, and then get `alpha local setup`, `alpha local doctor`, a trivial `alpha decide` and an opencode session working? The test covers both Ollama and llama.cpp's `llama-server`. It is a functional check with a small model, and it measures no performance.

## What shipped
Nothing. The run stopped at step 1 when the container lost outbound network. It turned up one docs bug: [navikt/copilot#1099](https://github.com/navikt/copilot/issues/1099).

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

## Verdict
Not tested. Only the first step ran, and it failed on a local network outage. The only finding that holds regardless is #1099. Setup, doctor, decide and opencode on Linux are all still unverified, and so is Ollama's `num_ctx` trap on a real Ollama.

## Limits
- **Rerun:** do it once the Colima VM and the Mac can reach github.com, navikt.github.io, ollama.com and huggingface.co.
- **Coverage:** a rerun in Colima is still arm64 on CPU. x86_64, and x86_64 with NVIDIA, stay unmeasured ([UNMEASURED.md](../UNMEASURED.md)).
- **Memory:** the 6 GB VM fits a 1.7B Q4 model, but not doctor's ~30k-token context probe at f16. That probe needs about 3.4 GB of KV cache on top of about 1 GB of weights, and setup's `--fix-context` 65,536 needs about 7 GB. A rerun should expect doctor's context check to fail on memory, and record that.

## Reproduce
1. Start a fresh `ubuntu:24.04` container, add `sudo` and `curl`, and switch to a non-root sudo user.
2. Paste the Linux block from the setup wizard on `/nav-pilot`.
3. Run `nav-pilot alpha local setup` and `nav-pilot alpha local doctor` against each server:
   - `ollama serve` with `qwen3:1.7b`
   - `llama-server --jinja -m Qwen3-1.7B-Q4_K_M.gguf --alias qwen3-1.7b`

Hold `.bench-logs/.queue.lock` for the run.

## Sources
- [Linux/Ollama research](../2026-09-27-qwen38-linux-ollama/research.md) §3–4
- [Local endpoint validation on macOS](../2026-09-28-local-endpoint-validation/report.md)
- navikt/copilot #998, #1000, #1099
