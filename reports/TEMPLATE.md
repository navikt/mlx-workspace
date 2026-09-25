# <Title: the question in a few words>, <YYYY-MM-DD>

Copy into `reports/<YYYY-MM-DD>-<topic>/report.md`, then add a row to the right section of
[README.md](README.md), and to "In nav-pilot" if something shipped.

## Question
One or two sentences. What would each possible answer change?

## What shipped
PR, setting or manifest value, with its merge date. "Nothing" is a valid answer.

## Method
Model, profile, nav-pilot commit, machine and wired limit, cases and how their labels are known, and what was fixed before the first sample.

## Results
Every figure as k/n with a 95 % interval (Wilson for a rate), and the source file for each table. List discarded samples and why.

## Verdict
One paragraph: what the numbers support, and what they do not.

## Limits
What was not measured, where n is too small, and what would change the verdict.

## Reproduce
`mise run <task> -- <args>`, and `python3 bench/analyse.py` where it covers the figures.

## Sources
Relative links to `bench/*.json` and `*.md`, PRs and earlier reports.
