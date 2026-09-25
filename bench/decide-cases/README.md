# Cases for `nav-pilot alpha decide --eval`

Each file is one JSONL case per line in the `--eval` format (`question`, `options`, `evidence`, `expect`).
Extra fields (`id`, `set`, `meta`) are ignored by nav-pilot.

| File | n | Question | How the label is known |
|---|---|---|---|
| `commit-conventional.jsonl` | 20 | Does this subject follow Conventional Commits? | the regex in `_decide.py`, re-checked by `--check-cases` |
| `loop-vs-progress.jsonl` | 12 | Is this agent stuck in a loop or making progress? | construction |
| `commit-explains-why.jsonl` | 48 (24 yes, 24 no) | Does the commit message explain why the change was made, beyond describing what the diff already shows? | hand labels plus construction, below |
| `commit-explains-why-no.jsonl` | 48 (24 ja, 24 nei) | The same in Norwegian: *Forklarer commit-meldingen hvorfor endringen ble gjort, utover å beskrive det diffen allerede viser?* | twin of the English file: same evidence, same order, `yes`→`ja` |
| `issue-type.jsonl` | 105 (35 per class) | Is this GitHub issue a bug report, a feature request, or a question? | the label a person put on the issue, below |
| `aksel-kind.jsonl` | 65 (13 per class) | Which of five kinds is this navikt/aksel issue? | navikt/aksel's own labels, below |
| `pr-motivation.jsonl` | 48 (24 yes, 24 no) | Does this pull request description explain why the change is needed? | hand labels plus construction, below |

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

## The §8.5 recipe sets: `issue-type`, `aksel-kind`, `pr-motivation`

Built by `build_sets.py` from public navikt repositories with `gh api` (`python3 bench/decide-cases/build_sets.py`,
about two minutes). The lists of issues and PRs are hand-picked and hard-coded, and the builder stops if a label
no longer matches, so the bytes stay the same until someone edits an issue upstream. Every case records `repo` and
`number` in `meta`, plus a `lang` guessed from common words (`no` or `en`). The builder refuses evidence that
matches an fnr (the nav-pilot redaction regex `\b\d{6} ?\d{5}\b`), an email address or a token/private-key
pattern. Issues were also read for names in a data context and left out when they had one (`nav-enonicxp#1041`,
`nav-dekoratoren#360`, `ghep#59` and `nav-dekoratoren_legacy#404` name a person; `dagpenger#546` describes one
user's case). Evidence is capped at 8,000 characters (one issue, `cplt#144`, is truncated) and HTML comments from
issue templates are removed.

Check: `python3 .mise/tasks/_decide_sets.py --check-cases`. Measure: `mise run bench-decide-sets`, which takes the
queue lock, waits for AC power, and runs optiq and Qwen3.8 OptiQ-4bit in turn. Results:
`bench/decide-sets-<stamp>.md`.

First run, 25 September ([`decide-sets-20260925-225356.md`](../decide-sets-20260925-225356.md), nav-pilot 2e1e8ee1,
no errors):

| | optiq | Qwen3.8 OptiQ-4bit |
|---|---|---|
| issue-type (3 classes) | 95/105 = 0.90 | 96/105 = 0.91 |
| issue-type, answered at p ≥ 0.9 | 71/71 correct (68 % answered) | 70/70 correct (67 % answered) |
| aksel-kind (5 classes) | 51/65 = 0.78 | 46/65 = 0.71 |
| aksel-kind, answered at p ≥ 0.9 | 38/42 = 0.90 (65 %) | 40/40 (62 %) |
| pr-motivation | 36/48 = 0.75 | 39/48 = 0.81 |
| pr-motivation, controlled no-why caught | 3/12 | 7/12 |
| p50 ms per call | ~400 | ~670–820 |

Three coarse classes work well, and a high threshold makes them exact on this set. With five, the model keeps
the clearly different classes apart, but the fine ones mix: Qwen3.8 calls 6 of 13 icon-feedback issues `bug`, and
both models call most of the old discussion issues `component-feedback` (they are proposals about components).
The PR question never flags a description that does explain why, but it answers `yes` to most descriptions that
only list what changed in detail, so it misses half or more of them.

### `issue-type`: bug, feature or question

Options `bug`, `feature`, `question`. The label is the one a person applied: `bug`; `enhancement` or `feature`;
`question`. Only issues with exactly one of them, no bot authors, and at most three issues per repository per
class, from 49 public navikt repositories (not navikt/aksel, which has its own set). Evidence is `Title: …` and the
body. 73 cases are Norwegian and 32 English, as they occurred.

`question` is the scarce class (56 candidates in the whole org), so all usable ones are in, and it is a class people
use for more than questions: in navikt it mostly marks something to clarify, investigate or decide (helsemelding's
"Kartlegge …", cplt's "Decide …"). The question text says so. Every candidate was read, and 21 were left out
because the text fits another class better: feature requests labelled `question` (`mock-oauth2-server#46`, `#575`,
`#590`, `token-support#31`), plain tasks (`nytt-sykefravaer#32`, `#61`, `aksel-arcade#68`, `k9-sak-web#21`), a
review report (`copilot#583`), and mixed ones. From bugs and features, issues that read as the other class were
left out too (`Designsystemet-old#73` is labelled bug and asks for an improvement, `innsending-api#419` is labelled
bug and asks for new APIs, `cplt#166` is labelled enhancement and reports a failure), as were empty Trello
imports. Some titles carry the author's own tag (`feat:`, `BUG:`); that is part of what a triage hook would see,
so it stays.

### `aksel-kind`: five kinds of design-system issue

The nuanced variant: how many options can decide separate, and how fine can they be? Options `bug`,
`component-feedback`, `new-icon`, `icon-feedback`, `discussion`, each described in the question. Two pairs are
deliberately close: a new icon against feedback on an existing icon, and feedback on a component against a bug in
one. From navikt/aksel (784 issues), where the design-system team labels every issue:

| Class | Labels (ignoring `Besvart`, `beta 🧪`, `no-issue-activity`) |
|---|---|
| `bug` | `bug 🐛`, optionally `komponenter 🧩` |
| `component-feedback` | `forespørsel 🥰` + `komponenter 🧩`, without `nytt ✨` (with `nytt` it is sometimes a new component, sometimes not, so those are left out) |
| `new-icon` | `forespørsel 🥰` + `ikoner 🖼` + `nytt ✨`, and the reporter chose the new-icon form |
| `icon-feedback` | `forespørsel 🥰`, optionally `ikoner 🖼`, and the reporter chose the icon-feedback form |
| `discussion` | `diskusjon 🧐` alone |

The issue forms put the class in the title (`[Nytt ikon]: …`) and in fixed headings (`### Navn på ikonet`), so the
builder removes the bracketed title prefix and every markdown heading line; what is left is what the reporter
wrote. Candidates were read and left out when the label does not fit the text (`#4629` is a bug in the icon page's
copy button filed as icon feedback; `#4297`, `#1980` and `#1981` ask for new icons through the feedback form;
`#3290` and `#4651` are bugs filed as component feedback; `#16` and `#772` are bugs labelled discussion).
`icon-feedback` had 20 candidates and `discussion` 24, which sets 13 per class. `aksel-kind-3731` is kept although
its body is only "Absolutely unusable /s" and two images: it is how feedback on the `Bagde` icon was filed.
Known confound: all `discussion` issues are from 2017–2020, before the forms, and the median evidence length
differs by class (154 characters for `icon-feedback`, 539 for `bug`). All but two cases are Norwegian.

### `pr-motivation`: does the PR description explain why

Options `yes`, `no`. Merged PRs from navikt/copilot and navikt/mlx-workspace, no bots; evidence is `Pull request
title: …` and the description between `-----` lines (`(empty)` for an empty one), with `Co-authored-by` lines
removed. Labels were set by reading, strictly both ways, as for the commit set:

| Construction | n | Label | What it is |
|---|---|---|---|
| `real-why` | 24 | yes | The description states a reason a reviewer could not read from the change: a bug and its effect (every cloud check failed, a 404 for 99 of 152 news items, a PR opened every morning), a gap someone hit (a review thread, CodeQL alert #94), or an outside change (Jackson 3.1). 12 English, 12 Norwegian. |
| `real-what` | 12 | no | The description only says what changed or what a report contains, or is empty (3). |
| `controlled` | 12 | no | A `real-why` PR with the reason taken out of title and description, padded with more of what changed, taken from the description and the diff. Median 454 characters against 532 for the originals, so still a little shorter. The original is in `meta.original_title` and `meta.original_body`. |

Left out as borderline: descriptions whose only reason is a phrase like "for clarity and consistency"
(`copilot#508`), a deprecation link with no more said (`copilot#448`), status updates whose reason is that
something merged (`mlx-workspace#22`), and a follow-up whose reason is one clause (`mlx-workspace#33`). The
real negatives are much shorter than the real positives (median 209 against 555 characters), which is what the
controlled cases are for.

Spot-check list for the labels (reread against the PR; the reason is what makes a `yes`):

| Case | Label | Why |
|---|---|---|
| mlx-workspace#53 | yes | relative DIR made every cloud check fail; preflight said unreachable while a session worked |
| copilot#431 | yes | Jackson 3.1 change breaks code silently |
| copilot#824 | yes | the .deb was unattested, weaker provenance than the direct download |
| copilot#600 | yes | the comment promised a normalisation that does not exist |
| copilot#421 | yes | Why section: flexible, cost-aware model choice |
| copilot#698 | yes | nothing on the site linked to /en/news |
| copilot#684 | yes | `mise run check` failed on main; the date guard broke on a reflow |
| copilot#694 | yes | old links to /nyheter now hit a hard 404 |
| copilot#700 | yes | 99 of 152 news slugs answered 404 |
| mlx-workspace#42 | yes | killpg EPERM lost night 2's result file |
| copilot#822 | yes | the bug in #813: the built-in agent materialized instead of the configured one |
| copilot#524 | yes | the table made the reader do the arithmetic; images overflowed a phone |
| copilot#916 | yes | the article still used the wrong production label |
| copilot#738 | yes | the review showed the sentence could be misread |
| copilot#444 | yes | passthrough is implemented, so the limitation is out of date |
| copilot#675 | yes | «Lukker #NNN» linked nothing; issues stayed open for months |
| copilot#757 | yes | the old test passes even with the regression it should catch |
| copilot#764 | yes | the prompt edited another app's manifest, the only real damage in #618 |
| copilot#758 | yes | the advice given to path sources can never be followed |
| copilot#756 | yes | an isolated run still wrote device-id into the real home directory |
| copilot#510 | yes | a PR opened every morning with only the date changed |
| copilot#680 | yes | CodeQL alert #94 open; the one unsanitised log point |
| copilot#766 | yes | shared video links previewed as "website" with the site's generic text |
| copilot#954 | yes | review threads: plain-text arguments in the state file, acting on a stale count |
| copilot#405, #924, mlx-workspace#52 | no | empty description |
| copilot#430 | no | version bump, nothing on why |
| copilot#761 | no | two commit subjects |
| mlx-workspace#45, #26 | no | what a docs section or roadmap contains |
| copilot#427, #417 | no | what the guideline now says |
| copilot#944, #927 | no | what the articles now cover |
| mlx-workspace#44 | no | the results table and what it shows, not why the PR |
| controlled: mlx-workspace#53, copilot#824, #600, #698, #684, #694, #700, #444, #675, #510, #756, #764 | no | reason removed; compare with `meta.original_body` |
