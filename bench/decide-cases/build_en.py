#!/usr/bin/env python3
"""Build issue-type-en.jsonl: 120 English issues (40 per class) from oauth2-proxy/oauth2-proxy, for Kev's English
triage test (reports/2026-09-30-kev-english/plan.md). Same question, options and evidence format as issue-type.jsonl.
Labels and selection: README.md, "issue-type-en". A label or labeler that no longer matches stops the build.

  python3 bench/decide-cases/build_en.py
"""
import re
from build_sets import ISSUE_Q, ISSUE_LABELS, clean_pii, clip, gh, lang, strip_comments, write

REPO = "oauth2-proxy/oauth2-proxy"
# Drawn in a fixed shuffled order (random.Random(30)) from issues that carry exactly one class label, English
# text of 80-7,500 characters, no bot author, and whose class label was applied by someone other than the author.
# Every candidate was read; ones whose text fits another class better were skipped (README), then the first 40 kept.
ISSUES = {
    "bug": [1508, 1205, 1946, 1482, 1681, 1666, 2066, 1163, 2287, 1209, 1686, 1516, 1178, 1132, 1365, 1442, 1724,
            1813, 1669, 2275, 1526, 1646, 1769, 1663, 2801, 1878, 1157, 2264, 1626, 1841, 1544, 1356, 1716, 1467,
            1260, 1732, 2061, 1396, 2020, 1745],
    "feature": [1834, 1475, 1134, 1537, 1696, 1372, 1148, 1483, 1295, 1162, 2304, 1908, 1092, 1714, 1656, 1896, 1602,
                1228, 1140, 1678, 1081, 2383, 1319, 1628, 1609, 1837, 1231, 2146, 1804, 1384, 1542, 1593, 1287, 1871,
                1659, 1186, 1314, 1865, 1281, 1361],
    "question": [1223, 1484, 1735, 1346, 1034, 935, 390, 809, 815, 1351, 1823, 1367, 1363, 1035, 857, 1042, 1634, 359,
                 1440, 1322, 910, 2263, 1085, 726, 1909, 2257, 1143, 315, 2027, 602, 1737, 868, 1257, 1188, 2326, 516,
                 1566, 1625, 1528, 517],
}
# Nav-internal domains: an issue that names one is not a public case.
HOST = re.compile(r"(?i)\b(?:nav\.no|adeo\.no|nais\.io|oera\.no|preprod\.local|devillo\.no)\b")


def labeler(n, cls, author):
    """Who applied the class label: must be someone other than the author, and not a bot."""
    ev = gh(f"repos/{REPO}/issues/{n}/events?per_page=100")
    who = [e["actor"] for e in ev if e["event"] == "labeled" and e.get("actor") and e["label"]["name"] in ISSUE_LABELS[cls]]
    if not who or any(a["login"] == author or a["type"] == "Bot" or a["login"].endswith("[bot]") for a in who):
        raise SystemExit(f"✗ {REPO}#{n}: the {cls} label was not applied by a maintainer ({[a['login'] for a in who]})")
    return who[-1]["login"]


def rows():
    for cls, nums in ISSUES.items():
        for n in nums:
            i = gh(f"repos/{REPO}/issues/{n}")
            labels = {l["name"] for l in i["labels"]}
            if {c for c, ls in ISSUE_LABELS.items() if labels & ls} != {cls}:
                raise SystemExit(f"✗ {REPO}#{n}: labels {sorted(labels)} no longer say only {cls}")
            ev = clip(f"Title: {i['title']}\n\n{strip_comments(i['body'])}")
            cid = f"issue-type-en-oauth2-proxy-{n}"
            if lang(ev) != "en" or HOST.search(ev):
                raise SystemExit(f"✗ {cid}: not English, or names an internal domain")
            yield {"id": cid, "set": "issue-type-en", "question": ISSUE_Q, "options": ["bug", "feature", "question"],
                   "evidence": clean_pii(ev, cid), "expect": cls,
                   "meta": {"repo": REPO, "number": n, "labels": sorted(labels), "lang": "en", "chars": len(ev),
                            "labeled_by_maintainer": bool(labeler(n, cls, i["user"]["login"]))}}


if __name__ == "__main__":
    write("issue-type-en", rows())
