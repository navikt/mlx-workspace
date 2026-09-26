# Posting about `nav-pilot alpha decide` internationally: research, 2026-09-25

Desk research on how to write about `alpha decide` for an international developer audience, with
draft posts. It is guidance for NAV employees who post in their own name, not an official NAV
communication plan. The research was done with web search. Claims about Jev, Hacker News and
LinkedIn come from the sources linked below and have not been re-checked by hand. Our own numbers
were checked against `bench/decide-cases/commit-explains-why-results.md` (#51) and
`bench/decide-limits-20260925-014512.md` (#44).

Labels: **[fact]** = a cited source says it. **[inference]** = the researcher's own reading.

## Top findings

1. **The Jev hype is real, and the backlash is about the wording.**
   - The HN launch thread has 1,980 points and 520 comments ([49717558](https://news.ycombinator.com/item?id=49717558)).
   - The main criticisms: "can't hallucinate" (a fixed output shape doesn't make the answer true), calibration that is claimed but not shown, and a closed model with no paper.
   - A post that measures limits fits exactly where the critics are.
2. **"System One model" is turning into a category term.**
   - Hub site [systemonemodels.org](https://systemonemodels.org/) lists six models.
   - Awesome-lists exist.
   - Together AI's Tev1 is a "Jev-like classifier" that cost $17 to train ([blog](https://www.together.ai/blog/how-to-train-your-own-jev)).
   - "Jev-like" or "Jev-style" is the informal developer term.
3. **LinkedIn's official ranking signals** ([engineering blog, 12 Mar 2026](https://www.linkedin.com/blog/engineering/feed/engineering-the-next-generation-of-linkedins-feed); arXiv:2602.12354) are dwell time, engagement actions, the author's profile and semantic relevance.
   - The link penalty, link-in-comments, the golden hour, best posting times and hashtag rules are practitioner data or folklore ([audit](https://fast-growth.fr/linkedin-algorithm-2026-proven-invented/)).
   - Practitioner data is consistent on one point: documents/carousels and dwell beat links ([van der Blom 2025 summary](https://www.dataslayer.ai/blog/linkedin-algorithm-february-2026-whats-working-now)).
4. **The English-language gap is the biggest practical blocker.** The article and the README section are Norwegian only. navikt/copilot is MIT; navikt/mlx-workspace had no licence (PR #54).
5. **The civil-service ethics guidelines allow the post.** *Etiske retningslinjer for statstjenesten*, revised Dec 2025, §2.3 ([PDF](https://www.regjeringen.no/contentassets/6febadef60054700aadd61535e979198/no/pdfs/etiske-retningslinjer-for-statstjenesten.pdf)):
   - Employees may speak in their own name about their agency's work.
   - Make clear you speak for yourself.
   - Never use the agency logo privately.
   - [Sivilombudet 2023/2202](https://www.sivilombudet.no/uttalelser/offentlig-ansattes-ytringsfrihet-i-sosiale-medier/) limits "ambassador" rules.
   - No public NAV-specific policy was found.

## Recommended angle

- **LinkedIn:** lead with honest limits (draft B) as a native PDF document built on the threshold chart, with the public-sector context in a sentence or two. Jev's critics are all about unverified claims, so publishing the injection flips and the 14% bound stands out without disparaging Jev.
- **Later in the week:** draft C.
- **X/Bluesky:** the short version, for reach.
- **Show HN:** hold it until there is an English page and outsiders can install it.

## 1. The Jev hype

- **Launch [fact].** On 15 Sep 2026 TypeSafe AI came out of stealth with a $40M seed round (DCVC) and Jev, "the first System One model". It returns typed decisions with probabilities, not text. Access is by waitlist ([blog](https://typesafe.ai/blog/introducing-system-one-models-and-jev)).
  - Vendor claims: 70–500 ms per call, "40x–200x faster", $0.042/MTok input with output "FREE", RL for Calibrated Decisions, "never makes type errors".
  - Founder Diogo Almeida (ex-OpenAI) on Latent Space ([21 Sep](https://www.latent.space/p/jev)): "Prod, not God", "intelligence per dollar", "more like a database than a coworker".
- **HN [fact].**
  - Criticised: "can't hallucinate" confuses type safety with correctness; calibration not shown; closed model, no paper; soft demos; BERT and GLiClass already do this.
  - Praised: latency, and triage and routing use cases.
  - Other threads: a separate attack on the launch wording ([49767192](https://news.ycombinator.com/item?id=49767192)); the OpenJev thread ([49752041](https://news.ycombinator.com/item?id=49752041)).
  - Unverified: the claim that the terms forbid publishing benchmarks.
- **Press [fact].**
  - News: Forbes, The Register, SiliconANGLE, TechCrunch, Tom's Hardware ("claims to be 193x faster and 445x cheaper"), MarkTechPost, Business Standard.
  - Sceptical: [O'Reilly Radar, 23 Sep](https://www.oreilly.com/radar/will-typesafes-jev-change-how-we-build-ai-applications/) calls "can't hallucinate" an overreach, and [pearpages](https://pearpages.com/blog/2026/09/16/jev-sorted-what-typesafes-system-one-model-actually-is-and-what-is-still-just-a-claim) separates what is shown from what is only claimed.
- **Independent measurements [fact].**
  - [OpenRouter](https://openrouter.ai/blog/insights/jev-vs-claude-opus-5-classification/), Banking77: Jev 81.0% vs Opus 5 84.4%, 13× faster.
  - [LiteLLM](https://docs.litellm.ai/blog/jev-auto-router-benchmark): 127 ms vs 688 ms for Haiku.
- **Don't repeat:** the "40M views" launch video and "Vercel's fastest-adopted model". Both are second-hand.
- **Phrases:** "System One model", "typed decisions", "calibrated confidence", "smart if-statements", "Jev-like", "OpenJev". There is no dominant hashtag. Use `#Jev` and spell out the term. `#SystemOne` collides with other brands.

## 2. What performs (and what is folklore)

**What to do [inference]:**
- a hook line that stands alone above "…see more"
- short paragraphs
- concrete numbers early
- a native image or a 3–5 page PDF rather than a link card
- a repo link in the body is fine for developers
- 0–3 hashtags
- tag only people or orgs really involved, not TypeSafe for reach
- reply to comments promptly
- no "Agree?" call to action

**Other platforms:**
- **X:** 280 characters.
- **Bluesky:** 300 characters.
- **Mastodon:** CamelCase hashtags and alt text.
- **Show HN** ([rules](https://news.ycombinator.com/showhn.html)): something people can try without signups, a backstory comment from the maker, no marketing language, never ask for upvotes.

**Developer audiences.**
- Reads as authentic: numbers with their denominators, published failures, code, modest scope, credit to the source of the idea.
- Reads as fluff: "game-changer", "X× faster" without a baseline, emoji bullets, engagement questions.

## 3. Skills and tools

| Repo | What | Fit |
|---|---|---|
| [sergebulaev/linkedin-skills](https://github.com/sergebulaev/linkedin-skills) | 11 Claude Code/Codex skills (3.5k★, MIT) | Most mature. Growth-oriented, so run unslop after it |
| [blader/humanizer](https://github.com/blader/humanizer) | Removes AI tells (52k★) | Second opinion next to unslop |
| [hardikpandya/stop-slop](https://github.com/hardikpandya/stop-slop) | Catches predictable AI phrasing (17.6k★) | Same |
| [marian-kamenistak/linkedin-post-writing-skill](https://github.com/marian-kamenistak/linkedin-post-writing-skill) | Voice calibration plus a quality gate (42★) | Its checklist is useful; its algorithm advice is folklore |
| [anthropics/skills](https://github.com/anthropics/skills) | Official. No social-post skill; `doc-coauthoring` is closest | For iterating a draft with a reviewer |

Recommendation: draft by hand from the facts, then run unslop.

## 4. Positioning

**Ranked angles:**
1. **Measured honesty.** 0/24 gives a two-sided 95% Clopper-Pearson upper bound of 14.2%.
2. **A public agency shipping open-source local AI.**
3. **Code and tool output never leave the Mac.** Do not imply it processes welfare or citizen data, and do not say "GDPR-compliant".
4. **Nine days from Jev's launch (15 Sep) to #949 (24 Sep).** Frame it as borrowing one idea, and credit TypeSafe.
5. **Zero credits and Apple Silicon/MLX.** State the requirement: 48 GB RAM and about 26 GB disk.

**Avoid:**
- "open-source Jev" or "Jev alternative"
- "System One model" as a label for this tool
- "can't hallucinate" or "calibrated" (calibration was not measured)
- "X× faster than Jev" (there's no head-to-head test, and Jev is roughly 0.1–0.2 s against our 0.35–0.45 s)
- "99%" without "one question, 96 answers"
- "production-ready" (it's alpha)
- contrasting with a "US-hosted, closed" model

**Norms:**
- Write "I" and "the team", not "NAV launches".
- No NAV logo in the images.
- Add "views my own".
- Let your line manager or the communications team know before posting, as a courtesy.

**Language:** add an English landing page before posting. It is in progress in navikt/copilot.

## 5. Drafts (edited for AI tells; not reviewed by NAV's communications team)

**A: curiosity.** Visual: the System 1 vs System 2 diagram.

```
A model that answers in one token.

Ten days ago TypeSafe AI launched Jev and called it a "System One model": you ask a multiple-choice question and get probabilities back instead of prose.

The core idea also runs on a laptop. Ask a local model the question, let it produce one token, and read the probability of each option.

On 24 September we shipped that as nav-pilot alpha decide, in NAV's open-source Copilot tooling. It runs Qwen3.6-35B-A3B on Apple Silicon with MLX. A warm call takes 0.35–0.45 s. Nothing leaves the machine, and it spends no cloud credits.

The first use is a commit-msg hook that asks whether the message explains why:
• 93% correct on the default model, 99% on Qwen3.8 (96 answers each)
• at p ≥ 0.7 it warned on 40 of 48 messages that gave no reason, and on 0 of 24 good ones

It warns. It never blocks a commit.

This is not Jev. We took one idea from the launch and tried it on hardware we already had.

Code and numbers: github.com/navikt/copilot (PR #949)
```

**B: honest limits (recommended).** Visual: the threshold chart, best as a 3–4 page PDF.

```
We published where our local classifier fails.

nav-pilot alpha decide asks a local model a multiple-choice question and reads the answer as probabilities from one token. It's the idea behind Jev, on a Mac with MLX.

Before recommending it, we ran 974 cases on three models: English and Norwegian, up to 14 options, position bias, prompt injection, and evidence up to 30,000 characters.

What held up:
• "Does this commit message explain why?" 93% on the default model, 99% on Qwen3.8
• As a warning at p ≥ 0.7: 40 of 48 reason-free messages caught, 0 of 24 good commits flagged

What did not:
• 0 of 24 is not 0%. With 24 samples, the 95% upper bound on false alarms is 14%.
• Injected claims in the evidence flipped up to 33% of answers on the default model and 58% on Qwen3.8.
• Telling a stuck agent from one making slow progress: 55% on the default model. Not usable.

So we use it where a wrong answer is cheap: a commit-msg hook that warns and never blocks.

All public: navikt/copilot PR #949, navikt/mlx-workspace PR #44.
```

**C: public sector.** Visual: terminal output and the diagram. No NAV logo.

```
A welfare agency shipping local AI tooling, in the open.

I build developer tools at NAV, the Norwegian Labour and Welfare Administration. Our code is public, AI tooling included.

This week we shipped nav-pilot alpha decide. It asks a model on the developer's own Mac a multiple-choice question and returns a probability for each option, read from one token. A warm call takes under half a second. No data leaves the machine, and it costs no cloud credits.

In a public agency, sending code and tool output to a new external service needs a risk assessment first. A model on the laptop stays on our side of that line.

We measured it before recommending it (974 cases, 3 models) and published the weak spots too. Injected claims in the evidence flipped up to 33% of answers on the default model.

The first use is modest: a commit-msg hook that warns when a message says what changed but not why. It caught 40 of 48 such messages and flagged none of 24 good ones.

The idea came from TypeSafe AI's Jev launch on 15 September. Nine days later it ran on our laptops.

Views my own. Code: github.com/navikt/copilot
```

**X/Bluesky** (under 280 characters, attach the chart with alt text):

```
Jev-style typed decisions on a Mac: nav-pilot alpha decide asks a local MLX model a multiple-choice question and reads option probabilities from one token. ~0.4 s warm, no cloud.

We published the limits too: injected claims flip up to 33% of answers.

github.com/navikt/copilot
```

**Show HN** (only after an English page exists and outsiders can install it).

Title: `Show HN: Typed decisions from a local LLM in one token (Jev-style, MLX)`

First comment:

```
I work on developer tooling at NAV (Norway's labour and welfare agency). After TypeSafe's Jev launch I wanted to know how far the core trick goes on a laptop: ask a multiple-choice question, generate one token, read the probability of each option letter. It's an old trick (logprobs over option tokens), and there's nothing new in the model.

nav-pilot alpha decide does that against a local MLX model (default Qwen3.6-35B-A3B, 4-bit). A warm call takes 0.35–0.45 s on Apple Silicon. It needs a Mac with 48 GB RAM, runs offline, and costs nothing per call.

We benchmarked it before using it: 974 cases × 3 models (English/Norwegian, up to 14 options, position bias, injection, evidence up to 30k characters). Results, bad ones included:
- "Does this commit message explain why?": 93% (default), 99% (Qwen3.8), 96 answers each
- As a warning at p ≥ 0.7: 40/48 reason-free messages caught, 0/24 good ones flagged (95% upper bound on false alarms: 14%)
- Injected claims in the evidence flip up to 33% of answers (default) and 58% (Qwen3.8)
- Telling a stuck agent from slow progress: 55%. We don't use it for that.

The only use we ship is a commit-msg hook that warns and never blocks. We haven't measured calibration formally, so treat p as a ranking signal.

Code: navikt/copilot PR #949. Benchmarks: navikt/mlx-workspace PR #44.
```
