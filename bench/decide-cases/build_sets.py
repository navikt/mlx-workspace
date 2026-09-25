#!/usr/bin/env python3
"""Build issue-type.jsonl, aksel-kind.jsonl and pr-motivation.jsonl from hand-picked public navikt issues and
PRs, fetched with `gh api`. Labels and selection rules: README.md. Same bytes as long as nobody edits the
issues or PRs upstream; a label that no longer matches stops the build.

  python3 bench/decide-cases/build_sets.py
"""
import json, re, subprocess
from pathlib import Path

OUT = Path(__file__).resolve().parent
MAX = 8000

# issue-type: the class is the human-applied label (bug; enhancement or feature; question), and the issue carries
# exactly one of them. Read and kept only when the text fits the label: "question" issues that are really a
# feature request or a plain task were left out, as were bugs/features that read as the other class.
ISSUE_Q = ("Is this GitHub issue a bug report (something does not work as intended), a feature request (new or "
           "changed functionality), or a question (something to clarify, investigate or decide)?")
ISSUE_LABELS = {"bug": {"bug"}, "feature": {"enhancement", "feature"}, "question": {"question"}}
ISSUES = {
    "bug": ["mock-oauth2-server#33", "stub-oidc-provider#5", "nav-dekoratoren_legacy#383", "nav-enonicxp#889",
            "nav-enonicxp#659", "copilot#419", "circleci-nais-orb#14", "cplt#190", "cplt#242", "copilot#517",
            "mock-oauth2-server#825", "nav-enonicxp-frontend#1584", "mangfold-i-mai#45", "cplt#417",
            "nav-dekoratoren_legacy#443", "melosys-eessi#29", "dagpenger#226", "forenklet-deploy#15",
            "Designsystemet-old#28", "nav-dekoratoren#860", "nav-enonicxp-frontend#350", "nav-dekoratoren_legacy#412",
            "ebxml-processor#274", "nks-bob-frontend#235", "copilot#514", "dagpenger#1010", "nav-dekoratoren#160",
            "mock-oauth2-server#794", "nytt-sykefravaer#38", "ghep#119", "tiltakspenger-meldekort#128",
            "Designsystemet-old#148", "helved-peisen#7", "remove-package-versions#3", "nav-enonicxp-frontend#2134"],
    "feature": ["copilot#168", "copilot#171", "aksel-arcade#31", "tilbakemeldingsmottak-api#361", "copilot#314",
                "helsemelding-message-generator#11", "nav-dekoratoren_legacy#645", "nav-enonicxp-frontend#1176",
                "innbyggerpanelet#3", "helsemelding-attachment-service#22", "nav-enonicxp-search#169", "g#83",
                "ghep#104", "helsemelding-payload-signing-service#32", "dinesykmeldte#696", "skjemabygging-formio#2215",
                "cplt#9", "nav-enonicxp-search#133", "gandalf#30", "mock-oauth2-server#918",
                "nav-enonicxp-frontend#2501", "nav-enonicxp#2058", "nav-enonicxp#1060", "mock-oauth2-server#252",
                "nav-enonicxp#2240", "farskapsportal-ui#11", "nais-env#15", "cplt#144", "nav-dekoratoren_legacy#456",
                "lumi#255", "data-catalog-policies#34", "aksel-arcade#37", "token-support#179", "lumi#262",
                "dbt-dvh-macros#12"],
    "question": ["copilot#471", "copilot#500", "copilot#604", "copilot#740", "cplt#3", "cplt#206", "cplt#424",
                 "cplt#472", "esyfo-narmesteleder#516", "g#3", "g#4", "helsemelding-inbound-message-service#7",
                 "helsemelding-inbound-message-service#8", "helsemelding-issues#10", "helsemelding-issues#11",
                 "helsemelding-issues#16", "helsemelding-issues#17", "helsemelding-issues#30",
                 "helsemelding-message-converter#17", "helsemelding-outbound-message-service#76", "helseopplysninger#21",
                 "mock-oauth2-server#306", "mock-oauth2-server#435", "mock-oauth2-server#460", "mock-oauth2-server#513",
                 "mock-oauth2-server#573", "modiapersonoversikt#126", "nav-dekoratoren_legacy#387",
                 "nav-dekoratoren_legacy#397", "react-intl-bundler#3", "standbot#8", "syfo-budstikka#166",
                 "syfo-budstikka#167", "sykmeldinger#38", "token-support#83"],
}

# aksel-kind: navikt/aksel's own labels, five classes, two of them a fine split (new icon vs feedback on one).
AKSEL_Q = ("This issue was filed against Nav's design system Aksel. Which kind is it? bug: something in a component, "
           "the icons or the website is broken; component-feedback: a request or suggestion about an existing "
           "component or its documentation; new-icon: a request for an icon that does not exist yet; icon-feedback: "
           "feedback on an existing icon; discussion: an open technical discussion or proposal about the design system.")
AKSEL = {
    "bug": [1987, 987, 13, 2441, 2645, 634, 1631, 288, 4157, 2390, 1767, 3133, 2281],
    "component-feedback": [1918, 2324, 4825, 3576, 3021, 3943, 2747, 1861, 1969, 4311, 3632, 1986, 4086],
    "new-icon": [3942, 3040, 1784, 5283, 1937, 2254, 2103, 3141, 3058, 1897, 2133, 2625, 3564],
    "icon-feedback": [2352, 4148, 3609, 2901, 2263, 2194, 1920, 1799, 4110, 1839, 2627, 2600, 3731],
    "discussion": [332, 603, 78, 651, 441, 588, 778, 42, 309, 70, 622, 559, 194],
}
IGNORED = {"Besvart", "no-issue-activity", "beta 🧪"}
AKSEL_LABELS = {"bug": [{"bug 🐛"}, {"bug 🐛", "komponenter 🧩"}],
                "component-feedback": [{"forespørsel 🥰", "komponenter 🧩"}],
                "new-icon": [{"forespørsel 🥰", "ikoner 🖼", "nytt ✨"}],
                "icon-feedback": [{"forespørsel 🥰"}, {"forespørsel 🥰", "ikoner 🖼"}],
                "discussion": [{"diskusjon 🧐"}]}

# pr-motivation: merged PRs, labelled by reading. yes = the description states a reason the change is needed
# (a bug and its effect, a measurement, a gap someone hit); no = it only says what changed, or is empty.
PR_Q = "Does this pull request description explain why the change is needed?"
C, M = "copilot", "mlx-workspace"
PR_YES = [(M, 53), (C, 431), (C, 824), (C, 600), (C, 421), (C, 698), (C, 684), (C, 694), (C, 700), (M, 42),
          (C, 822), (C, 524), (C, 916), (C, 738), (C, 444), (C, 675), (C, 757), (C, 764), (C, 758), (C, 756),
          (C, 510), (C, 680), (C, 766), (C, 954)]
PR_NO = [(C, 405), (C, 924), (M, 52), (C, 430), (C, 761), (M, 45), (M, 26), (C, 427), (C, 417), (C, 944),
         (C, 927), (M, 44)]
# controlled: a PR_YES description with the reason taken out of title and body, padded with more of what changed
# so the length stays close. Only facts the original states (or its diff shows) are used.
PR_CONTROLLED = {
    (M, 53): ("fix(night-run-3): make the cloud probe's log path absolute",
              "The probe now resolves DIR to an absolute path before it cd's into its directory, and the log "
              "redirect uses that absolute path. The rest of the probe, its timeout and the log format are "
              "unchanged. Two lines changed, one removed."),
    (C, 824): ("ci: add an attestation step for the .deb",
               "Adds an `actions/attest-build-provenance` step to the package job in release-nav-pilot.yaml, after "
               "the `dpkg-deb --info` and `--contents` checks, with the .deb as its subject. The job gets "
               "`id-token: write` and `attestations: write` next to `contents: read`."),
    (C, 600): ("docs: reword the comment on allowedBackends",
               "Follow-up to #599.\n\nThe comment on `allowedBackends` in `internal/local/local.go` said an empty "
               "value is \"accepted as mlx-lm\". It now says that an empty value passes the check without being "
               "rewritten to anything, and that whatever starts to read the field decides for itself what a blank "
               "one means. Only the comment changes; the list of backends and the check are the same."),
    (C, 698): ("feat(web): link the English articles from the front page",
               "The \"Siste nytt\" heading on the front page now carries an \"In English (n)\" link to `/en/news`, "
               "with `hrefLang` and `lang` set on the anchor. The count is `getNewsItems({ lang: \"en\" })` filtered "
               "to items of type `article`, passed to `NewsFeed` as a new optional `englishCount` prop, and the link "
               "is rendered only when that count is above zero.\n\nThree new tests in `news-feed.test.tsx`: a link "
               "for a count of 2, no link for 0, and no link when the prop is absent.\n\nVerified on a production "
               "build: front page renders `In English (1)` linking to `/en/news`, tests still 515 pass."),
    (C, 684): ("fix(pricing): match any whitespace in the date guard",
               "`DOC_DATE_RE` in `scripts/sync-model-pricing.mjs` looks for the pricing-date sentence in "
               "`docs/modellvalg.md`. It had a literal space between `slik de sto` and the bolded date, and now has "
               "`\\s+` there, so a space or a line break between the two parts both match. The error message and "
               "the sync logic are unchanged.\n\nA new test feeds the sentence split over two lines, with the date "
               "on the second, and checks that the date is replaced and the first line is left as it was.\n\n"
               "`mise run pricing:check` and `pricing:test` (10 pass, 0 fail) both green."),
    (C, 694): ("fix(web): redirect the bare news path to the front page",
               "Adds one entry to the redirects in `apps/my-copilot/next.config.ts`: `/nyheter` to `/`, with "
               "`permanent: false`, so it answers 307. It sits next to the existing `/en` to `/en/news` redirect. "
               "Paths under `/nyheter/` keep their current routes, and nothing else in the app changes.\n\n"
               "Verified on a production build:\n\n```\n/nyheter      307 -> /\n/en           307 -> /en/news\n"
               "/en/news      200\n/nyheter/zzz  404\n```\n\nSplit out of #693."),
    (C, 700): ("feat(news): redirect link-only slugs to their url",
               "For a news item whose frontmatter carries `url:` and has no body, `/nyheter/<slug>` now redirects "
               "to that url. 99 of 152 news items have that shape.\n\n`getLinkTarget` is added to the loader next "
               "to `getArticle`. It reads only that slug's file and returns the url, or nothing for a draft, an item "
               "in the other language or an item with a body. Both language routes call it before `notFound()`. "
               "`news-card.tsx` is unchanged and still links to `item.url`.\n\nVerified against a production "
               "build:\n\n```\n/nyheter/agent-hq                    307 -> https://github.blog/news-insights/"
               "company-news/pick-your-agent-use-claude-and-codex-on-agent-hq/\n/nyheter/agent-based-observability   "
               "200\n/nyheter/zzz                         404\n```\n\n515 tests pass."),
    (C, 444): ("docs(nav-pilot): fjern avsnittet om argument-passthrough",
               "Fjerner punktet «Ingen passthrough av argumenter til Copilot CLI» fra Kjente begrensninger i "
               "`DESIGN.md`, sammen med kodeeksempelet under det, som viste `launchCopilotWithAgent()` fra "
               "`interactive.go`, og avsnittet om å kjøre `copilot`/`cplt` direkte. Til sammen 16 linjer.\n\n"
               "Den etterfølgende **Status:**-linja om OTel er beholdt, og de andre punktene under Kjente "
               "begrensninger er uendret. Ingen kode endres.\n\nCloses #214."),
    (C, 675): ("docs(agents): bruk Closes eller Fixes i PR-bodyen",
               "Legger til en regel under PR-konvensjonene i AGENTS.md om lukkereferanser i PR-bodyen: de skrives "
               "med de engelske nøkkelordene, `Closes #NNN` eller `Fixes #NNN`, og ikke som «Lukker #NNN». Regelen "
               "ber også om å sjekke PR-ens `closingIssuesReferences` når det betyr noe.\n\nSeks linjer lagt til i "
               "AGENTS.md. Ingen andre filer endres, og de genererte docs er ikke berørt."),
    (C, 510): ("fix(pricing): kjør --check før prissynkroniseringen regenererer",
               "Arbeidsflyten kjører nå `node scripts/sync-model-pricing.mjs --check` før regenereringen. `--check` "
               "sammenligner med de to tidsstemplene normalisert bort og skriver ingenting. Exit 0 gir «Only the "
               "timestamp would move» og ingen PR, exit 2 regenererer og åpner PR som før, og andre koder stopper "
               "kjøringen med en feilmelding. Etter regenereringen kjøres samme sjekk mot grenens egen fil. "
               "GH_TOKEN tømmes for kallene til generatoren.\n\nVerifisert mot den faktiske diffen i #499: kun dato "
               "gjør at jobben hopper over, mens en påført prisendring slipper gjennom. `bash -n` er ren på run-blokken."),
    (C, 756): ("fix(telemetry): device-id og cache følger NAV_PILOT_CONFIG",
               "tierCachePath, staleness og telemetry bruker nå samme regel for katalogen de skriver til: er "
               "NAV_PILOT_CONFIG satt, brukes katalogen til den fila som nav-pilot sin tilstandskatalog. Uten "
               "variabelen brukes ~/.nav-pilot som før.\n\ntierCachePath tok filepath.Dir(configPath()), staleness "
               "hadde en egen CacheHome-variabel, og telemetry leste $HOME direkte. staleness.go returnerer nå "
               "cache.json i config-katalogen når variabelen er satt, og telemetry sin GetConfigDir gjør det samme "
               "for device-id.\n\nTo nye tester i telemetry/config_dir_test.go: én med isolert config, og én "
               "kontroll uten variabelen som faller tilbake på hjemmekatalogen. Med isolert HOME og config ligger "
               "cache.json og device-id nå i den isolerte katalogen."),
    (C, 764): ("fix(prompts): velg manifeststi etter appnavn",
               "Første setning i nais-manifest-prompten nevner ikke lenger stien. Standardstien .nais/app.yaml står "
               "nå i en egen setning, og finnes den fila og gjelder en annen app, skriver prompten "
               ".nais/<app-navn>.yaml i stedet og sier hvilken sti den valgte.\n\ngolang-service-prompten har fått "
               "samme regel i punkt 7 i fillista, der .nais/app.yaml står. Innholdshashene for de to promptene er "
               "oppdatert i de genererte manifestene for mcp-onboarding og my-copilot.\n\nIngen andre prompter "
               "endres."),
}

FNR = re.compile(r"\b\d{6} ?\d{5}\b")
EMAIL = re.compile(r"[\w.+-]+@[\w-]+\.[a-z]{2,}", re.I)
SECRET = re.compile(r"\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_\w{82}|(?:AKIA|ASIA)[A-Z0-9]{16})\b|\beyJ[\w-]{10,}\.eyJ"
                    r"|PRIVATE KEY-----")
NO_WORDS = re.compile(r"\b(og|ikke|det|som|på|er|en|jeg|vi|for|skal|kan|hvis|når|må)\b", re.I)
EN_WORDS = re.compile(r"\b(the|and|not|is|it|that|we|for|to|of|when|this|with)\b", re.I)


def gh(path):
    return json.loads(subprocess.run(["gh", "api", path], capture_output=True, text=True, check=True).stdout)


def lang(s):
    return "no" if len(NO_WORDS.findall(s)) > len(EN_WORDS.findall(s)) else "en"


def clip(s):
    return s if len(s) <= MAX else s[:MAX - 40].rsplit("\n", 1)[0] + f"\n[truncated: {len(s) - MAX + 40}+ chars]"


def clean_pii(ev, cid):
    if FNR.search(ev) or EMAIL.search(ev) or SECRET.search(ev):
        raise SystemExit(f"✗ {cid}: fnr, email or secret pattern in the evidence; take it out of the list")
    return ev


def strip_comments(s):
    return re.sub(r"<!--.*?-->", "", s or "", flags=re.S).strip()


def issue_rows():
    for cls, refs in ISSUES.items():
        for ref in refs:
            repo, n = ref.split("#")
            i = gh(f"repos/navikt/{repo}/issues/{n}")
            labels = {l["name"] for l in i["labels"]}
            got = {c for c, ls in ISSUE_LABELS.items() if labels & ls}
            if got != {cls}:
                raise SystemExit(f"✗ {ref}: labels {sorted(labels)} no longer say only {cls}")
            ev = clip(f"Title: {i['title']}\n\n{strip_comments(i['body'])}")
            cid = f"issue-type-{repo}-{n}"
            yield {"id": cid, "set": "issue-type", "question": ISSUE_Q, "options": ["bug", "feature", "question"],
                   "evidence": clean_pii(ev, cid), "expect": cls,
                   "meta": {"repo": f"navikt/{repo}", "number": int(n), "labels": sorted(labels), "lang": lang(ev),
                            "chars": len(ev)}}


def aksel_rows():
    for cls, nums in AKSEL.items():
        for n in nums:
            i = gh(f"repos/navikt/aksel/issues/{n}")
            labels = {l["name"] for l in i["labels"]} - IGNORED
            if labels not in AKSEL_LABELS[cls]:
                raise SystemExit(f"✗ aksel#{n}: labels {sorted(labels)} no longer match {cls}")
            # The issue forms put the class in the title ("[Nytt ikon]: ...") and in fixed headings
            # ("### Navn på ikonet"); both go, so the text the reporter wrote is what is left.
            title = re.sub(r"^\s*\[[^\]]*\]:?\s*", "", i["title"])
            body = "\n".join(l for l in strip_comments(i["body"]).splitlines()
                             if not re.match(r"\s*#{1,6}\s", l) and l.strip() != "_No response_")
            ev = clip(f"Title: {title}\n\n{body.strip()}")
            cid = f"aksel-kind-{n}"
            yield {"id": cid, "set": "aksel-kind", "question": AKSEL_Q, "options": list(AKSEL),
                   "evidence": clean_pii(ev, cid), "expect": cls,
                   "meta": {"repo": "navikt/aksel", "number": n, "labels": sorted(labels), "lang": lang(ev),
                            "original_title": i["title"], "chars": len(ev)}}


def pr_body(s):
    return "\n".join(l for l in (s or "").splitlines()
                     if not re.match(r"(?i)^\s*(co-authored-by|signed-off-by):", l)).strip()


def pr_evidence(title, body):
    return clip(f"Pull request title: {title}\n\nDescription:\n-----\n{body or '(empty)'}\n-----")


def pr_rows():
    yes = set(PR_YES)
    for kind, items in (("real-why", PR_YES), ("real-what", PR_NO), ("controlled", list(PR_CONTROLLED))):
        for repo, n in items:
            assert kind != "controlled" or (repo, n) in yes
            p = gh(f"repos/navikt/{repo}/pulls/{n}")
            if not p.get("merged_at"):
                raise SystemExit(f"✗ {repo}#{n} is not merged")
            orig = pr_body(p["body"])
            title, body = PR_CONTROLLED[(repo, n)] if kind == "controlled" else (p["title"], orig)
            ev = pr_evidence(title, body)
            cid = f"pr-motivation-{kind}-{repo}-{n}"
            meta = {"repo": f"navikt/{repo}", "number": n, "construction": kind, "lang": lang(ev),
                    "body_chars": len(body)}
            if kind == "controlled":
                meta.update(original_title=p["title"], original_body=orig)
            yield {"id": cid, "set": "pr-motivation", "question": PR_Q, "options": ["yes", "no"],
                   "evidence": clean_pii(ev, cid), "expect": "yes" if kind == "real-why" else "no", "meta": meta}


for name, rows in (("issue-type", issue_rows), ("aksel-kind", aksel_rows), ("pr-motivation", pr_rows)):
    rows = list(rows())
    ids = [r["id"] for r in rows]
    assert len(ids) == len(set(ids)), f"duplicate ids in {name}"
    (OUT / f"{name}.jsonl").write_text("".join(json.dumps(r, ensure_ascii=False) + "\n" for r in rows))
    print(OUT / f"{name}.jsonl", len(rows))
