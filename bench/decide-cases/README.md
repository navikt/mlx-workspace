# Cases for `nav-pilot alpha decide --eval`

Each file is one JSONL case per line in the `--eval` format (`question`, `options`, `evidence`, `expect`).
Extra fields (`id`, `set`, `meta`) are ignored by nav-pilot.

| File | n | Question | How the label is known |
|---|---|---|---|
| `commit-conventional.jsonl` | 20 | Does this subject follow Conventional Commits? | the regex in `_decide.py`, re-checked by `--check-cases` |
| `loop-vs-progress.jsonl` | 12 | Is this agent stuck in a loop or making progress? | construction |
| `commit-explains-why.jsonl` | 48 (24 yes, 24 no) | Does the commit message explain why the change was made, beyond describing what the diff already shows? | hand labels plus construction, below |
| `commit-explains-why-no.jsonl` | 48 (24 ja, 24 nei) | The same in Norwegian: *Forklarer commit-meldingen hvorfor endringen ble gjort, utover å beskrive det diffen allerede viser?* | twin of the English file: same evidence, same order, `yes`→`ja` |

The first question is a poor use of `decide`: a regex answers it exactly and in microseconds. The
"explains why" question is one no rule can answer, and it is the one `bench-decide-why` measures.

## `commit-explains-why`

The evidence is the commit message followed by its diff (`git show --format=`), each between `-----`
lines, capped at 8,000 characters (no case needed truncating; the longest diff is 5,786
characters). Every case comes from a real commit in navikt/copilot or navikt/mlx-workspace, and
`meta` records the repository, full SHA and how the case was built:

| Construction | n | Label | What it is |
|---|---|---|---|
| `real-why` | 24 | yes | The message as committed, and its body states a reason the diff does not show: the bug it fixes (a crash, a 0 % cache hit rate, a 401, a NameError), a measurement (~15 token exchanges per page view, OOM at 51k tokens), or an outside constraint (a collector that only accepts metrics, a CLI that dropped model arrays). |
| `real-what` | 12 | no | The message as committed, and it only says what changed: a subject alone (3), or a subject and a body that lists the changes (9). |
| `controlled` | 12 | no | A `real-why` commit with the same diff, and the reason taken out of its message. Where the subject carried the reason (`… to fix standalone output nesting`, `… silently swallow failures due to set -e …`) it is rewritten to the plain change. The body is padded with more of what the diff shows, so the message stays as long as the original (median 291 characters against 299). The original message is kept in `meta.original_message`. |

The controlled negatives are there so a model cannot score by message length or by "has a body".
The real negatives are shorter (median 260 characters) and the real positives longer (317), so on
the real cases alone length would already separate them fairly well.

Labels were set by reading each message against its diff, never by a model, and strictly both ways:

- A `real-why` message had to state a reason a reviewer could not read from the diff. Messages that
  only hint at one (`fix: … to not inflate metrics` in the subject, a bare `Refs #231`, "for
  contrast") were left out of both classes.
- A `real-what` message had to carry no reason at all. Commits whose body or subject gave a
  purpose in passing ("to silence browser noise", "to bypass macOS noexec restrictions") were left out.
- Controlled bases were only commits whose diff has no comment or string that states the
  reason. `1bb4555676`, `2460e89835`, `5e3d3eb437`, `f0c8c7739a`, `2a16a87f3e`, `3108eb84cc`
  and `ba5bb16f78` all explain themselves in a code comment or step name, so they appear only
  as `real-why`. One borderline case is kept on purpose: in `controlled-5645c3e64f` the diff adds
  UI text saying that GitHub does not report consumption for the default budget, and the message
  repeats that text. It restates the diff, so the label is `no`.

Four commits have Norwegian messages (two `real-why`, both also used as `controlled`; two `real-what`).

Spot check: after building, ten cases drawn with `random.seed(7)` (`cae99c1155`,
`5dcfba0094`, `a7fddfee02`, controlled `e010946182`, `16a967d9dc`, `2460e89835`, `d9ef6889db`,
`5645c3e64f`, `a387e4b6ce`, controlled `06f6c00d33`) were reread against their diffs. All ten labels held.

Rebuild (same bytes): `COPILOT_REPO=<clone of navikt/copilot> python3 bench/decide-cases/build_why.py`.
Check: `python3 .mise/tasks/_decide_why.py --check-cases`. Measure: `mise run bench-decide-why`, which
takes the queue lock and runs optiq and Qwen3.8 OptiQ-4bit in turn. Results:
`bench/decide-cases/commit-explains-why-results.md`.
