"""Quality frontier: graded task ladders, their verifiers and the statistics.

Design and reasons: reports/2026-09-25-quality-frontier/design.md. Used by
`bench-frontier` (generate, validate, run, summary, selftest). Read only by
anything else; nothing in the existing suites imports this.

Difficulty is a number taken from the code, never an opinion: a rung is a range
of call sites (edit classes), of files to find (read-qa), or a hint level with the
break held fixed (debug). Every task carries its own deterministic verifier and a
reference solution, so a generator bug shows up as a reference that fails its own
verifier before any GPU time is spent.

Kotlin only for now. The scanner is regex over source with comments and string
literals blanked out. It is not a parser: anything it gets wrong about call sites
shows up as a reference solution that does not compile, which `validate` drops.
# ponytail: regex scanner, a real Kotlin PSI/tree-sitter pass if a second
# language or a family needing types arrives.
"""
import hashlib
import json
import math
import re
from pathlib import Path
from statistics import NormalDist

Z90 = NormalDist().inv_cdf(0.90)  # one-sided 90%, as bench-capabilities

# The bar, reused from reports/2026-09-24-local-vs-cloud-routing/design.md §2.1.
SILENT = {"read-qa", "debug"}
X_CAUGHT, X_SILENT = 0.90, 0.95
MIN_RUNS, MIN_TASKS = 5, 2

PARAM = "origin"
# (rung, lowest, highest) on the family's difficulty number.
BINS = {
    "edit-multi-mechanical": [(1, 1, 2), (2, 3, 4), (3, 5, 8), (4, 9, 16), (5, 17, 40), (6, 41, 10**6)],
    "edit-single": [(1, 1, 1), (2, 2, 3), (3, 4, 8), (4, 9, 24), (5, 25, 10**6)],
    "read-qa": [(1, 1, 1), (2, 2, 2), (3, 3, 4), (4, 5, 7), (5, 8, 10**6)],
}
PER_RUNG = 3          # generated per rung: two are run, one is the spare validation falls back to
USE_PER_RUNG = 2
MODIFIERS_EXCLUDED = {"override", "abstract", "open", "operator", "infix", "expect", "actual"}

# Debug breaks: hand-picked sites, single occurrence, validated by running the suite.
# Adjacent = its unit test sits in the mirrored package; far = the failing tests are
# elsewhere. The hint level is the rung, the break is held fixed across rungs.
DEBUG_BREAKS = [
    {"id": "b1", "distance": "adjacent", "func": "hasManySykefravar",
     "file": "src/main/kotlin/no/nav/syfo/domain/OppfolgingstilfellePerson.kt",
     "find": "return tilfeller >= 5 && sykedager >= 100", "replace": "return tilfeller > 5 && sykedager >= 100"},
    {"id": "b2", "distance": "adjacent", "func": "isLongTilfelle",
     "file": "src/main/kotlin/no/nav/syfo/domain/OppfolgingstilfellePerson.kt",
     "find": "private const val MIN_DAYS_IN_LONG_TILFELLE = 16", "replace": "private const val MIN_DAYS_IN_LONG_TILFELLE = 17"},
    {"id": "b3", "distance": "adjacent", "func": "calculateCurrentVarighetUker",
     "file": "src/main/kotlin/no/nav/syfo/domain/OppfolgingstilfellePerson.kt",
     "find": "return currentVarighetDays.toInt() / DAYS_IN_WEEK", "replace": "return (currentVarighetDays.toInt() + 1) / DAYS_IN_WEEK"},
    {"id": "b4", "distance": "far", "func": "toOppfolgingstilfelleList",
     "file": "src/main/kotlin/no/nav/syfo/domain/OppfolgingstilfelleDag.kt",
     "find": "notSykedagSinceLastSykedagCounter >= 16 &&", "replace": "notSykedagSinceLastSykedagCounter > 16 &&"},
    {"id": "b5", "distance": "far", "func": "toOppfolgingstilfelle",
     "file": "src/main/kotlin/no/nav/syfo/domain/OppfolgingstilfelleDag.kt",
     "find": "this.durationDays() > 118", "replace": "this.durationDays() >= 118"},
    {"id": "b6", "distance": "far", "func": "hasSendtSykmeldingMedVirksomhetsnummer",
     "file": "src/main/kotlin/no/nav/syfo/domain/OppfolgingstilfelleDag.kt",
     "find": "return !harBekreftetEtterSisteSendt", "replace": "return harBekreftetEtterSisteSendt"},
]
# rung: (hint level, distance). The break is the same across rungs 1-3.
DEBUG_RUNGS = {1: (1, "adjacent"), 2: (2, "adjacent"), 3: (3, "adjacent"), 4: (3, "far")}
DEBUG_PROMPTS = {
    1: "A unit test in this repository fails because of a bug in the function {func} in {file}. "
       "Find the bug and fix it in the source. Do not modify any test file.",
    2: "The test class {failing_test} fails. Find the cause in the source code under src/main and fix it. "
       "Do not modify any test file.",
    3: "The test suite is failing. Run the tests to see which ones fail, find the cause in the source "
       "and fix it. Do not modify any test file.",
}

# Create-file: write a new test file. Curated rather than generated, because what
# makes a test hard to write (constructing the domain objects, finding the boundary)
# is not countable from call sites. d is the rung. Each function carries a mutant;
# the new test must go red on every one, which is the only instrument here for
# "the test tests something": one August submission passed with its assertions
# inside a catch block that swallowed them.
T = "src/test/kotlin/no/nav/syfo/frontier/"
_DATE = "src/main/kotlin/no/nav/syfo/util/DateUtil.kt"
_PERSON = "src/main/kotlin/no/nav/syfo/domain/OppfolgingstilfellePerson.kt"
MUTANTS = {
    "dagerMellomDatoer": (_DATE, "ChronoUnit.DAYS.between(startDato, sluttDato).toInt() + 1",
                          "ChronoUnit.DAYS.between(startDato, sluttDato).toInt()"),
    "isBeforeOrEqual": (_DATE, "fun LocalDate.isBeforeOrEqual(date: LocalDate) = !this.isAfter(date)",
                        "fun LocalDate.isBeforeOrEqual(date: LocalDate) = this.isBefore(date)"),
    "isAfterOrEqual": (_DATE, "fun LocalDate.isAfterOrEqual(date: LocalDate) = !this.isBefore(date)",
                       "fun LocalDate.isAfterOrEqual(date: LocalDate) = this.isAfter(date)"),
    "isLongTilfelle": (_PERSON, "daysInTilfelle() >= MIN_DAYS_IN_LONG_TILFELLE",
                       "daysInTilfelle() > MIN_DAYS_IN_LONG_TILFELLE"),
    "daysInTilfelle": (_PERSON, "fun daysInTilfelle(): Int = antallSykedager ?: dagerMellomDatoer(start, end)",
                       "fun daysInTilfelle(): Int = dagerMellomDatoer(start, end)"),
    "calculateCurrentVarighetUker": (_PERSON, "return currentVarighetDays.toInt() / DAYS_IN_WEEK",
                                     "return currentVarighetDays.toInt() / (DAYS_IN_WEEK - 1)"),
    "hasGjentakendeSykefravar": (_PERSON, "return tilfeller >= 5 && sykedager >= 100",
                                 "return tilfeller > 5 && sykedager >= 100"),
}
_HEAD = ("package no.nav.syfo.frontier\n\n{imports}import org.junit.jupiter.api.Assertions.assertEquals\n"
         "import org.junit.jupiter.api.Assertions.assertFalse\nimport org.junit.jupiter.api.Assertions.assertTrue\n"
         "import org.junit.jupiter.api.Test\nimport java.time.LocalDate\n{extra}\nclass {cls} {{\n"
         "    private val day = LocalDate.of(2024, 3, 1)\n\n{body}}}\n")
_BODIES = {
    "dagerMellomDatoer": ("import no.nav.syfo.util.dagerMellomDatoer\n",
        "    @Test\n    fun `same day is one day`() {\n        assertEquals(1, dagerMellomDatoer(day, day))\n    }\n\n"
        "    @Test\n    fun `counts both ends`() {\n        assertEquals(10, dagerMellomDatoer(day, day.plusDays(9)))\n    }\n\n"),
    "isBeforeOrEqual": ("import no.nav.syfo.util.isBeforeOrEqual\n",
        "    @Test\n    fun `a day is before or equal to itself`() {\n        assertTrue(day.isBeforeOrEqual(day))\n    }\n\n"
        "    @Test\n    fun `before and after`() {\n        assertTrue(day.isBeforeOrEqual(day.plusDays(1)))\n"
        "        assertFalse(day.plusDays(1).isBeforeOrEqual(day))\n    }\n\n"),
    "isAfterOrEqual": ("import no.nav.syfo.util.isAfterOrEqual\n",
        "    @Test\n    fun `a day is after or equal to itself`() {\n        assertTrue(day.isAfterOrEqual(day))\n    }\n\n"
        "    @Test\n    fun `after and before`() {\n        assertTrue(day.plusDays(1).isAfterOrEqual(day))\n"
        "        assertFalse(day.isAfterOrEqual(day.plusDays(1)))\n    }\n\n"),
    "isLongTilfelle": ("import testhelper.generator.generateOppfolgingstilfelle\n",
        "    @Test\n    fun `sixteen days is long, fifteen is not`() {\n"
        "        assertTrue(generateOppfolgingstilfelle(day, day.plusDays(15)).isLongTilfelle())\n"
        "        assertFalse(generateOppfolgingstilfelle(day, day.plusDays(14)).isLongTilfelle())\n    }\n\n"),
    "daysInTilfelle": ("import testhelper.generator.generateOppfolgingstilfelle\n",
        "    @Test\n    fun `antallSykedager wins over the calendar span`() {\n"
        "        assertEquals(5, generateOppfolgingstilfelle(day, day.plusDays(20), antallSykedager = 5).daysInTilfelle())\n"
        "        assertEquals(21, generateOppfolgingstilfelle(day, day.plusDays(20)).daysInTilfelle())\n    }\n\n"),
    "calculateCurrentVarighetUker": ("import no.nav.syfo.domain.calculateCurrentVarighetUker\n"
                                     "import testhelper.generator.generateOppfolgingstilfelle\n",
        "    @Test\n    fun `six full weeks in the past`() {\n"
        "        assertEquals(6, generateOppfolgingstilfelle(day, day.plusDays(41)).calculateCurrentVarighetUker())\n    }\n\n"),
    "hasGjentakendeSykefravar": ("import no.nav.syfo.domain.hasGjentakendeSykefravar\n"
                                 "import testhelper.generator.generateOppfolgingstilfelle\n",
        "    private fun ago(days: Long) = LocalDate.now().minusDays(days)\n\n"
        "    @Test\n    fun `five tilfeller adding up to 100 days is gjentakende`() {\n"
        "        val tilfeller = listOf(\n"
        "            generateOppfolgingstilfelle(ago(500), ago(482)),\n"
        "            generateOppfolgingstilfelle(ago(450), ago(431)),\n"
        "            generateOppfolgingstilfelle(ago(400), ago(381)),\n"
        "            generateOppfolgingstilfelle(ago(350), ago(331)),\n"
        "            generateOppfolgingstilfelle(ago(300), ago(280)),\n"
        "        )\n        assertTrue(tilfeller.hasGjentakendeSykefravar())\n    }\n\n"),
}
# (rung, letter, test class, functions)
CREATE_LADDER = [
    (1, "a", "DagerMellomDatoerTest", ["dagerMellomDatoer"]),
    (1, "b", "IsBeforeOrEqualTest", ["isBeforeOrEqual"]),
    (2, "a", "LocalDateComparisonTest", ["isBeforeOrEqual", "isAfterOrEqual"]),
    (2, "b", "DateUtilFrontierTest", ["dagerMellomDatoer", "isAfterOrEqual"]),
    (3, "a", "LongTilfelleTest", ["isLongTilfelle"]),
    (3, "b", "DaysInTilfelleTest", ["daysInTilfelle"]),
    (4, "a", "OppfolgingstilfelleFrontierTest", ["isLongTilfelle", "daysInTilfelle", "calculateCurrentVarighetUker"]),
    (4, "b", "GjentakendeSykefravarTest", ["hasGjentakendeSykefravar"]),
]
_WHERE = {"dagerMellomDatoer": _DATE, "isBeforeOrEqual": _DATE, "isAfterOrEqual": _DATE,
          "isLongTilfelle": _PERSON + " (a member of Oppfolgingstilfelle)",
          "daysInTilfelle": _PERSON + " (a member of Oppfolgingstilfelle)",
          "calculateCurrentVarighetUker": _PERSON, "hasGjentakendeSykefravar": _PERSON}


def reference_test(cls, funcs):
    imports = "".join(sorted({line + "\n" for f in funcs for line in _BODIES[f][0].splitlines()}))
    return _HEAD.format(imports=imports, extra="", cls=cls, body="".join(_BODIES[f][1] for f in funcs))


def vacuous_test(code):
    """The known-bad fixture: the same test with every assertion turned into a no-op.
    It compiles and runs green; only the mutants can tell it from the real one."""
    code = re.sub(r"^import org\.junit\.jupiter\.api\.Assertions\.\w+\n", "", code, flags=re.M)
    return code.replace("\nclass ", "\nprivate fun assertEquals(a: Any?, b: Any?) {}\n"
                        "private fun assertTrue(b: Boolean) {}\nprivate fun assertFalse(b: Boolean) {}\n\nclass ", 1)


def create_prompt(cls, funcs):
    what = "; ".join(f"{f} in {_WHERE[f]}" for f in funcs)
    return (f"Write a new JUnit 5 test file {T}{cls}.kt, package no.nav.syfo.frontier, with one test class "
            f"{cls}. Test {what}. Cover each function's edge and boundary cases, so that a wrong comparison "
            f"or an off-by-one in it would make a test fail. Match the style of the existing tests under "
            f"src/test/kotlin; you may use the helpers in src/test/kotlin/testhelper. Do not change any other file.")


# ── scanning Kotlin ───────────────────────────────────────────────────────────

DEF_RE = re.compile(
    r"^[ \t]*((?:(?:private|internal|public|protected|suspend|inline|override|open|abstract|operator|"
    r"infix|tailrec|expect|actual)\s+)*)fun\s+(?:<[^>]+>\s+)?(?:[\w.<>?]+\.)?(\w+)\s*\(", re.M)


def mask(text):
    """Blank comments and string literals, keeping every offset and newline."""
    out, i, n = list(text), 0, len(text)

    def blank(a, b):
        for j in range(a, b):
            if out[j] != "\n":
                out[j] = " "
    while i < n:
        if text.startswith("//", i):
            j = text.find("\n", i)
            j = n if j < 0 else j
            blank(i, j)
            i = j
        elif text.startswith("/*", i):
            j = text.find("*/", i + 2)
            j = n if j < 0 else j + 2
            blank(i, j)
            i = j
        elif text.startswith('"""', i):
            j = text.find('"""', i + 3)
            j = n if j < 0 else j + 3
            blank(i + 1, j - 1)
            i = j
        elif text[i] == '"':
            j = i + 1
            while j < n and text[j] != '"' and text[j] != "\n":
                j += 2 if text[j] == "\\" else 1
            blank(i + 1, j)
            i = j + 1
        elif text[i] == "'":
            j = text.find("'", i + 1 + (text[i + 1:i + 2] == "\\"))
            j = i + 1 if j < 0 else j
            blank(i + 1, j)
            i = j + 1
        else:
            i += 1
    return "".join(out)


def sources(repo):
    """{relative path: text} for every .kt file under src."""
    repo = Path(repo)
    return {str(p.relative_to(repo)): p.read_text(errors="replace")
            for p in sorted((repo / "src").rglob("*.kt"))}


def defs_of(masked, name=None):
    """[(name, offset of the name, modifiers)] in one masked file."""
    return [(m.group(2), m.start(2), set(m.group(1).split()))
            for m in DEF_RE.finditer(masked) if name is None or m.group(2) == name]


def call_offsets(masked, name):
    """Offsets of '(' for each call of `name`, definitions excluded."""
    at_def = {off for _, off, _ in defs_of(masked, name)}
    return [m.end() - 1 for m in re.finditer(r"(?<![\w:$`])" + re.escape(name) + r"\s*\(", masked)
            if m.start() not in at_def]


def first_arg_span(masked, lpar):
    """(start, end) of the first argument after the '(' at lpar; end is the top-level ',' or ')'."""
    depth, j = 0, lpar + 1
    while j < len(masked):
        c = masked[j]
        if c in "([{":
            depth += 1
        elif c in ")]}":
            if depth == 0:
                return lpar + 1, j
            depth -= 1
        elif c == "," and depth == 0:
            return lpar + 1, j
        j += 1
    return lpar + 1, j


def args_span(masked, lpar):
    depth, j = 0, lpar + 1
    while j < len(masked):
        if masked[j] in "([{":
            depth += 1
        elif masked[j] in ")]}":
            if depth == 0:
                return lpar + 1, j
            depth -= 1
        j += 1
    return lpar + 1, j


def stem(rel):
    return Path(rel).stem


def survey(files):
    """Every function that has exactly one definition in the repo and at least one call.

    Returns [{name, def_file, sites: {file: n}, total, files, lines}], dropping
    anything a mechanical signature change cannot handle: overrides and the like,
    function references (::name) and names shorter than 6 characters.
    """
    masked = {f: mask(t) for f, t in files.items()}
    defs = {}
    for f, m in masked.items():
        for name, _off, mods in defs_of(m):
            defs.setdefault(name, []).append((f, mods))
    out = []
    for name, ds in sorted(defs.items()):
        if len(ds) != 1 or len(name) < 6 or ds[0][1] & MODIFIERS_EXCLUDED:
            continue
        if any("::" + name in m for m in masked.values()):
            continue
        sites = {f: len(call_offsets(m, name)) for f, m in masked.items()}
        sites = {f: n for f, n in sites.items() if n}
        if not sites:
            continue
        def_file = ds[0][0]
        out.append({"name": name, "def_file": def_file, "sites": sites, "total": sum(sites.values()),
                    "files": len(sites), "lines": files[def_file].count("\n") + 1})
    return out


# ── the families ─────────────────────────────────────────────────────────────

def _pick(cands, bins, key):
    """PER_RUNG candidates per bin, nearest the bin's geometric middle; ties go to more files."""
    picked = []
    for rung, lo, hi in bins:
        mid = math.sqrt(lo * min(hi, max(lo, 64)))
        inbin = [c for c in cands if lo <= key(c) <= hi]
        inbin.sort(key=lambda c: (abs(math.log(key(c)) - math.log(mid)), -c["files"], c["name"]))
        picked += [(rung, c) for c in inbin[:PER_RUNG]]
    return picked


def thread_arg_prompt(c, single):
    other = sorted(f for f in c["sites"] if f != c["def_file"])
    ex = other[0] if other else c["def_file"]
    where = ("The function is only called from the file that defines it." if single else
             f"For example, a call in {ex} passes \"{stem(ex)}\".")
    return (f"Add a new first parameter `{PARAM}: String` to the function {c['name']} defined in "
            f"{c['def_file']}. Do not give it a default value. Update every call to {c['name']} in this "
            f"repository, in main and test code, to pass the name of the file the call is in, without the "
            f".kt extension, as a string literal. {where} Change nothing else.")


def decompose_prompts(c):
    """The oracle decomposition: one fresh session per file, definition first."""
    first = (f"In {c['def_file']}, add a new first parameter `{PARAM}: String` to the function {c['name']}. "
             f"Do not give it a default value.")
    if c["def_file"] in c["sites"]:
        first += f" Update the calls to {c['name']} in that same file to pass \"{stem(c['def_file'])}\"."
    first += " Do not change any other file."
    rest = [f"The function {c['name']} (defined in {c['def_file']}) now takes a first parameter "
            f"`{PARAM}: String`. In {f}, update every call to {c['name']} to pass \"{stem(f)}\" as that "
            f"first argument. Change nothing else." for f in sorted(c["sites"]) if f != c["def_file"]]
    return [first] + rest


def generate(repo, meta):
    """The whole task set for one repository, deterministic for a given checkout."""
    files = sources(repo)
    cands = survey(files)
    tasks = []
    multi = [c for c in cands if set(c["sites"]) != {c["def_file"]}]
    single = [c for c in cands if set(c["sites"]) == {c["def_file"]}]
    for cls, pool, is_single in (("edit-multi-mechanical", multi, False), ("edit-single", single, True)):
        seen = {}
        for rung, c in _pick(pool, BINS[cls], lambda c: c["total"]):
            letter = "abc"[seen.setdefault(rung, 0)]
            seen[rung] += 1
            allowed = sorted(set(c["sites"]) | {c["def_file"]})
            tasks.append({
                "id": f"{'fm' if not is_single else 'fs'}-r{rung}-{letter}", "class": cls,
                "family": "thread-arg", "rung": rung,
                "difficulty": {"d": c["total"], "sites": c["total"], "files": c["files"],
                               "def_file_lines": c["lines"]},
                "prompt": thread_arg_prompt(c, is_single),
                "decompose": decompose_prompts(c),
                "verify": {"kind": "thread-arg", "name": c["name"], "def_file": c["def_file"],
                           "sites": c["sites"], "allowed_files": allowed, "build": "compile"},
            })
    # read-qa: the files that call a function. Only distinctive names, because the
    # gold answer is the scanner's and a common name would also match library calls.
    distinct = [c for c in cands if re.search(r"[a-z][A-Z]", c["name"])]
    seen = {}
    for rung, c in _pick(distinct, BINS["read-qa"], lambda c: c["files"]):
        letter = "abc"[seen.setdefault(rung, 0)]
        seen[rung] += 1
        tasks.append({
            "id": f"rq-r{rung}-{letter}", "class": "read-qa", "family": "callers", "rung": rung,
            "difficulty": {"d": c["files"], "files": c["files"], "sites": c["total"]},
            "prompt": (f"List every file in this repository, main and test code, that contains a call to the "
                       f"function {c['name']}. Count the defining file only if it also calls the function. "
                       f"Do not change any files. End your reply with one line of the form "
                       f"`ANSWER: File1.kt, File2.kt` listing the file names."),
            "verify": {"kind": "answer-set", "expected": sorted(stem(f) + ".kt" for f in c["sites"]),
                       "name": c["name"]},
        })
    if (Path(repo) / _DATE).exists():  # the curated ladder needs the real target
        for rung, letter, cls, funcs in CREATE_LADDER:
            tasks.append({
                "id": f"cf-r{rung}-{letter}", "class": "create-file", "family": "new-test", "rung": rung,
                "difficulty": {"d": rung, "functions": len(funcs),
                               "domain_objects": any(MUTANTS[f][0] == _PERSON for f in funcs)},
                "prompt": create_prompt(cls, funcs),
                "reference": reference_test(cls, funcs),
                "verify": {"kind": "new-test", "path": T + cls + ".kt", "test_class": "no.nav.syfo.frontier." + cls,
                           "functions": funcs, "build": "test",
                           "mutants": [{"function": f, "file": MUTANTS[f][0], "find": MUTANTS[f][1],
                                        "replace": MUTANTS[f][2]} for f in funcs]},
            })
    for rung, (hint, distance) in DEBUG_RUNGS.items():
        pool = [b for b in DEBUG_BREAKS if b["distance"] == distance and (Path(repo) / b["file"]).exists()]
        for b in pool:
            tasks.append({
                "id": f"db-r{rung}-{b['id']}", "class": "debug", "family": "break", "rung": rung,
                "difficulty": {"d": rung, "hint": hint, "distance": distance},
                "prompt": DEBUG_PROMPTS[hint].format(func=b["func"], file=b["file"],
                                                     failing_test="{failing_test}"),
                "break": {"file": b["file"], "find": b["find"], "replace": b["replace"]},
                "break_id": b["id"],
                "verify": {"kind": "debug", "build": "test"},
            })
    return {**meta, "generated_from": meta.get("ref"), "tasks": tasks}


def tasks_sha(doc):
    return hashlib.sha256(json.dumps(doc, sort_keys=True).encode()).hexdigest()[:12]


# ── reference solutions and known-bad fixtures ──────────────────────────────

def apply_thread_arg(repo, v, skip=None, literal=None, default=False, def_only=False):
    """The reference edit, or a deliberately broken one for the known-bad fixtures.

    skip: (file, index) of a call site left untouched; literal: (file, index, text)
    for a wrong literal; default: give the parameter a default and touch no call;
    def_only: change the definition and nothing else.
    """
    repo = Path(repo)
    for rel in sorted(set(v["sites"]) | {v["def_file"]}):
        p = repo / rel
        text = p.read_text()
        m = mask(text)
        edits = []  # (offset, insertion)
        if rel == v["def_file"]:
            (_, off, _), = defs_of(m, v["name"])
            lpar = m.index("(", off)
            empty = m[lpar + 1:args_span(m, lpar)[1]].strip() == ""
            decl = f"{PARAM}: String" + (' = "x"' if default else "")
            edits.append((lpar + 1, decl + sep(text, lpar, empty)))
        if not (default or def_only):
            for i, lpar in enumerate(call_offsets(m, v["name"])):
                if skip == (rel, i):
                    continue
                lit = literal[2] if literal and literal[:2] == (rel, i) else stem(rel)
                empty = m[lpar + 1:args_span(m, lpar)[1]].strip() == ""
                edits.append((lpar + 1, f'"{lit}"' + sep(text, lpar, empty)))
        for off, ins in sorted(edits, reverse=True):
            text = text[:off] + ins + text[off:]
        p.write_text(text)


def sep(text, lpar, empty):
    """What goes after an inserted first argument: nothing before ')', a bare comma
    before a line break (multi-line calls keep their layout), else ', '."""
    return "" if empty else ("," if text[lpar + 1:lpar + 2] == "\n" else ", ")


def known_bad(v):
    """(label, kwargs for apply_thread_arg) that the verifier must reject."""
    f0 = sorted(v["sites"])[0]
    return [("untouched", None),
            ("one call site left", {"skip": (f0, 0)}),
            ("wrong literal", {"literal": (f0, 0, "Wrong")}),
            ("default value instead of call sites", {"default": True}),
            ("definition only", {"def_only": True})]


# ── verifiers ────────────────────────────────────────────────────────────────

def verify_thread_arg(repo, v, changed):
    """(ok, note). Static half; the runner adds the build."""
    files = sources(repo)
    masked = {f: mask(t) for f, t in files.items()}
    found = [(f, off) for f, m in masked.items() for _, off, _ in defs_of(m, v["name"])]
    if len(found) != 1:
        return False, f"{len(found)} definitions of {v['name']} (want exactly 1: no overload, no removal)"
    f, off = found[0]
    m, text = masked[f], files[f]
    lpar = m.index("(", off)
    a, b = first_arg_span(m, lpar)
    if not re.fullmatch(rf"\s*(?:@\w+\s+)?{PARAM}\s*:\s*String\s*", text[a:b]):
        return False, f"first parameter is {text[a:b].strip()[:60]!r}, want `{PARAM}: String` with no default"
    wrong, counts = [], {}
    for rel, mk in masked.items():
        for lpar in call_offsets(mk, v["name"]):
            counts[rel] = counts.get(rel, 0) + 1
            a, b = first_arg_span(mk, lpar)
            s, e = args_span(mk, lpar)
            want = f'"{stem(rel)}"'
            first = files[rel][a:b].strip()
            if first not in (want, f"{PARAM} = {want}") and not re.search(
                    rf"\b{PARAM}\s*=\s*{re.escape(want)}", files[rel][s:e]):
                wrong.append(f"{Path(rel).name}: {first[:30]!r}")
    if counts != v["sites"]:
        diff = {Path(k).name: (v["sites"].get(k, 0), counts.get(k, 0))
                for k in set(counts) | set(v["sites"]) if counts.get(k, 0) != v["sites"].get(k, 0)}
        return False, f"call sites moved (file: want, have): {diff}"
    if wrong:
        return False, f"{len(wrong)} call site(s) without the file-name literal: {', '.join(wrong[:3])}"
    stray = sorted(set(changed) - set(v["allowed_files"]))
    if stray:
        return False, f"changed files outside the task: {', '.join(stray[:3])}"
    return True, f"{sum(counts.values())} call sites in {len(counts)} files"


def verify_new_test_static(repo, v, changed):
    """The file part of a create-file task: one new file, where asked, testing what was asked."""
    if changed != [v["path"]]:
        return False, f"want exactly {v['path']} new, changed: {', '.join(changed[:3]) or 'nothing'}"
    code = (Path(repo) / v["path"]).read_text(errors="replace")
    missing = [f for f in v["functions"] if f not in code]
    if missing:
        return False, f"the test never mentions {', '.join(missing)}"
    if code.count("@Test") < len(v["functions"]):
        return False, f"{code.count('@Test')} @Test for {len(v['functions'])} functions"
    return True, f"{code.count('@Test')} tests"


ANSWER_RE = re.compile(r"ANSWER:\s*(.+)", re.I)


def verify_answer_set(reply, v):
    lines = ANSWER_RE.findall(reply or "")
    if not lines:
        return False, "no ANSWER line"
    got = {Path(t).name for t in re.findall(r"[\w./-]+\.kt\b", lines[-1])}
    want = set(v["expected"])
    if got == want:
        return True, f"all {len(want)} files, nothing extra"
    return False, f"missing {sorted(want - got)[:3]}, extra {sorted(got - want)[:3]}"


def is_test_path(p):
    return "/src/test/" in "/" + p or p.endswith("Test.kt")


# ── statistics ───────────────────────────────────────────────────────────────

def wilson(k, n, z=Z90):
    """(lower, upper), one-sided 90% each; None for n = 0."""
    if n == 0:
        return None
    p, d = k / n, 1 + z * z / n
    c = p + z * z / (2 * n)
    h = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n))
    return (c - h) / d, (c + h) / d


def bar_for(cls, p_cloud=1.0):
    return (X_SILENT if cls in SILENT else X_CAUGHT) * p_cloud


def rung_verdict(k, n, runs, tasks, bar, lb=None):
    """trusted / not-yet / cloud, bench-capabilities' rule applied to one rung.

    lb defaults to the rung's own Wilson lower bound; the summary passes the
    monotone pooled one (monotone_lower)."""
    if n == 0:
        return "no-data"
    if k / n < bar:
        return "cloud"
    lb = wilson(k, n)[0] if lb is None else lb
    if runs < MIN_RUNS or tasks < MIN_TASKS or lb < bar:
        return "not-yet"
    return "trusted"


def monotone_lower(counts):
    """{rung: (k, n)} -> {rung: lower bound on p(rung)} assuming harder is never easier.

    If the pass rate does not rise with difficulty, the pooled rate over rungs
    r..s is at most p(r), so the Wilson bound of that pool bounds p(r) from below.
    This lets rung 1 borrow rungs 2 and 3's samples, which is how ten samples a
    rung can clear a 0.90 bar that needs fifteen on its own.
    # ponytail: max over s is a small multiple-comparison optimism (at most 6
    # windows); a Bonferroni z if a verdict ever hinges on it.
    """
    rungs = sorted(r for r in counts if counts[r][1])
    out = {}
    for i, r in enumerate(rungs):
        best, k, n = 0.0, 0, 0
        for s in rungs[i:]:
            k, n = k + counts[s][0], n + counts[s][1]
            best = max(best, wilson(k, n)[0])
        out[r] = best
    return out


def frontiers(verdicts):
    """verdicts: {rung: verdict}. trusted: highest rung with it and every rung below
    trusted. open: the same for 'not ruled out' (trusted or not-yet). first_break:
    the lowest rung already below the bar."""
    out = {"trusted": 0, "open": 0, "first_break": None}
    for key, ok in (("trusted", {"trusted"}), ("open", {"trusted", "not-yet"})):
        for r in sorted(verdicts):
            if verdicts[r] not in ok:
                break
            out[key] = r
    breaks = [r for r in sorted(verdicts) if verdicts[r] == "cloud"]
    out["first_break"] = breaks[0] if breaks else None
    return out


def logistic_fit(points, lam=(0.01, 0.1)):
    """Penalised logistic regression of pass on x = log2(d): points [(d, ok)].

    Newton-Raphson with a small ridge so a ladder where everything passes (or
    nothing does) still gives a finite answer instead of an infinite slope.
    Returns {a, b, cov} or None with fewer than 4 points.
    """
    if len(points) < 4:
        return None
    xs = [math.log2(max(d, 1)) for d, _ in points]
    ys = [1.0 if ok else 0.0 for _, ok in points]
    a = b = 0.0
    for _ in range(100):
        ga, gb = -lam[0] * a, -lam[1] * b
        haa, hab, hbb = lam[0], 0.0, lam[1]
        for x, y in zip(xs, ys):
            p = 1 / (1 + math.exp(-(a + b * x)))
            w = p * (1 - p)
            ga += y - p
            gb += (y - p) * x
            haa += w
            hab += w * x
            hbb += w * x * x
        det = haa * hbb - hab * hab
        da, db = (hbb * ga - hab * gb) / det, (haa * gb - hab * ga) / det
        a, b = a + da, b + db
        if abs(da) + abs(db) < 1e-9:
            break
    return {"a": a, "b": b, "cov": [[hbb / det, -hab / det], [-hab / det, haa / det]]}


def fit_summary(fit, bar, ds):
    """Where the fitted curve crosses 0.5 (d50) and the bar (d_bar), within the observed
    range ds. Point estimates that describe the shape; the verdicts come from the
    rung counts. beyond: the curve is above the bar at the hardest rung measured."""
    if not fit:
        return {"d50": None, "d_bar": None, "beyond": False}
    a, b = fit["a"], fit["b"]
    p = lambda d: 1 / (1 + math.exp(-(a + b * math.log2(max(d, 1)))))  # noqa: E731
    lo, hi = min(ds), max(ds)
    d50 = 2 ** (-a / b) if b < -1e-6 else None
    grid = [lo * (hi / lo) ** (i / 200) for i in range(201)] if hi > lo else [lo]
    above = [d for d in grid if p(d) >= bar]
    return {"d50": round(d50, 1) if d50 and d50 <= 4 * hi else None,
            "d_bar": round(max(above), 1) if above else None,
            "beyond": bool(above) and p(hi) >= bar, "a": round(a, 3), "b": round(b, 3)}


def self_check():
    """Pure-function checks; the fixture-repo checks live in bench-frontier selftest."""
    lo, hi = wilson(15, 15)
    assert round(lo, 3) == 0.901 and hi == 1.0
    assert round(wilson(10, 11)[0], 3) == 0.739
    assert wilson(0, 0) is None
    assert rung_verdict(15, 15, 5, 2, 0.90) == "trusted"
    assert rung_verdict(10, 10, 5, 2, 0.90) == "not-yet"   # 0.859: the floor n=15 is real
    assert rung_verdict(8, 10, 5, 2, 0.90) == "cloud"
    assert rung_verdict(15, 15, 5, 1, 0.90) == "not-yet"   # one task is not a class
    assert frontiers({1: "trusted", 2: "trusted", 3: "not-yet", 4: "cloud", 5: "not-yet"}) == \
        {"trusted": 2, "open": 3, "first_break": 4}
    assert frontiers({1: "cloud"}) == {"trusted": 0, "open": 0, "first_break": 1}
    # a synthetic ladder breaking at d = 16 is found there
    pts = [(d, i < n) for d, n in ((1, 10), (2, 10), (4, 10), (8, 9), (16, 5), (32, 1), (64, 0))
           for i in range(10)]
    s = fit_summary(logistic_fit(pts), 0.90, [d for d, _ in pts])
    assert 11 < s["d50"] < 23 and 4 <= s["d_bar"] < 11 and not s["beyond"], s
    # everything passing gives a finite fit, no d50, and "beyond the ladder"
    s = fit_summary(logistic_fit([(d, True) for d in (1, 2, 4, 8) for _ in range(10)]), 0.90, [1, 8])
    assert s["d50"] is None and s["beyond"], s
    # monotone pooling: 10/10 on three rungs clears 0.90 at rung 1, not at rung 3
    lbs = monotone_lower({1: (10, 10), 2: (10, 10), 3: (10, 10), 4: (3, 10)})
    assert lbs[1] > 0.90 > lbs[3], lbs
    assert rung_verdict(10, 10, 5, 2, 0.90, lb=lbs[1]) == "trusted"
    # mask keeps offsets and hides strings and comments
    src = 'val a = foo("x(") // foo(\n/* foo( */ foo(1)'
    assert len(mask(src)) == len(src) and len(call_offsets(mask(src), "foo")) == 2
    assert verify_answer_set("blah\nANSWER: `src/a/Foo.kt`, Bar.kt", {"expected": ["Bar.kt", "Foo.kt"]})[0]
    assert not verify_answer_set("ANSWER: Foo.kt", {"expected": ["Bar.kt", "Foo.kt"]})[0]
    assert not verify_answer_set("ANSWER: Foo.kt, Bar.kt, Baz.kt", {"expected": ["Bar.kt", "Foo.kt"]})[0]
    assert not verify_answer_set("Foo.kt, Bar.kt", {"expected": ["Bar.kt", "Foo.kt"]})[0]
    print("✓ _frontier self-check passed")


if __name__ == "__main__":
    self_check()
