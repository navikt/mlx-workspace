# Partial runs

A run in here was cut off before the suite finished. It is out of the results
directory rather than renamed inside it, because every analysis globs
`bench/results-*.json` and a partial file that matches the glob is counted as a
run that scored badly. That is the same shape as the fault that quarantined
four files on 1 September.

- `results-qwen3.8-27b-4bit-20260902-081512-02.json` — 9 of 11 tasks. The
  machine was shut down at 08:51 while run 03 was starting. Tasks D3 and G2
  were never attempted; the nine that ran are sound and were measured on the
  repaired harness, but a run scored on nine tasks is not comparable with one
  scored on eleven.
