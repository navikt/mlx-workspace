# workspaces

Where benchmark runs happen. **Almost nothing here is tracked**, and that is deliberate.

Each directory is a checkout the harnesses clone, edit, verify and reset. A model is handed
one of these, told to make a change, and the result is judged by the target's own compiler and
test suite. Between samples the tree is reset to a pinned commit, so no sample sees another's
work.

| Shape | What it is |
|---|---|
| `<model-key>/` | One per model build that has run the capability ladder. Holds the checkout it was measured against. |
| `hybrid-bench/<target>/` | One per target for the cost ladder, which compares a cloud orchestrator against a dispatch-disabled control. |
| `_prime-*/` | Scratch checkouts used to validate a target before it is measured: `_prime-ts`, `_prime-next`, `_prime-py`. |

All three shapes are gitignored. The `.gitignore` carries two rounds of getting that wrong:
covering only `workspaces/*/kotlin/` let the hybrid-bench directories in as embedded git
repositories, twice.

## If `git status` shows changes in here

It is a benchmark checkout mid-run, or one that was not reset after a run was interrupted. It
is not your repository being broken. Reset it:

```
git -C workspaces/<the-directory> reset --hard -q
```

The harnesses do this themselves before every sample. A leftover only appears when a run was
killed between the edit and the reset.
