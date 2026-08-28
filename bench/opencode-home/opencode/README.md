# Benchmark opencode config home

`XDG_CONFIG_HOME` points here for every benchmark run, so opencode loads this
directory instead of `~/.config/opencode`.

It is deliberately almost empty. The personal config carries a nav-pilot exported
`AGENTS.md` and 38 global skills, and opencode injects all of it into the system
prompt. Measured on the wire: 32,754 characters of instructions the benchmark
never chose, on top of the workspace `AGENTS.md` we did choose. That text tells
the model how to behave, changes between runs without anything in this repo
changing, and is charged to prefill on every task.

Provider, model and context limits come from the generated `opencode.json` in
each workspace, so nothing here is needed for the client to reach the server.

See issue #12.

## Setup on a fresh clone

opencode resolves its provider packages from `node_modules` next to this file, and
installing them needs network access the sandbox does not grant, so a run against an
empty config home hangs at startup. Link the personal install instead:

```bash
ln -sfn ~/.config/opencode/node_modules bench/opencode-home/opencode/node_modules
cp ~/.config/opencode/package.json bench/opencode-home/opencode/package.json
```

Neither file is tracked. `opencode.json` here is tracked deliberately, with `git add -f`,
because the repo's `.gitignore` excludes that filename everywhere else.
