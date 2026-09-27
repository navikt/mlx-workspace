# cheap-ops failure types per profile, D2 and the three invalid 2026-09-23 runs excluded.
# Run from the repo root: python3 reports/2026-09-27-qwen38-linux-ollama/failtypes.py
import json,glob,re,collections,sys
INVALID=['qwen3.8-27b-4bit-20260923-125734-03','qwen3.8-27b-4bit-20260923-134745-02','qwen3.8-27b-8bit-mlx-20260923-125734-02']
rows=collections.defaultdict(lambda: collections.Counter())
tos=collections.defaultdict(list); fails=collections.defaultdict(list); secs=collections.defaultdict(list); files=collections.defaultdict(list)
for f in sorted(glob.glob('bench/results-*-202609[2-3]?-*.json')):
    m=re.match(r'bench/results-(.+)-(202609\d\d)-(\d{6})-(\d\d)\.json',f)
    if not m: continue
    key=m.group(1)
    if not re.search(r'qwen3\.8|qwen3\.6-35b-a3b-optiq|qwen3\.6-35b-a3b-8bit',key): continue
    if m.group(2)<'20260923': continue
    if any(x in f for x in INVALID): continue
    d=json.load(open(f)); files[key].append(f.split('results-')[1][len(key)+1:-5])
    for t,r in d.items():
        if not isinstance(r,dict) or 'verified' not in r or t=='D2': continue
        c=rows[key]; c['n']+=1
        if r.get('verified') is True: c['pass']+=1
        elif r.get('timed_out'): c['timeout']+=1
        elif r.get('looped_on') or (r.get('longest_identical_run') or 0)>=4: c['loop']+=1
        elif r['kind']=='edit' and not r.get('files_changed'): c['no_change']+=1
        elif r['kind']=='edit': c['edit_fails_check']+=1
        else: c['read_wrong']+=1
        if r.get('seconds') is not None: secs[key].append(r['seconds'])
        if r.get('timed_out'): tos[key].append(t)
        if r.get('verified') is not True and not r.get('timed_out'): fails[key].append(t)
import statistics as s
print('| profile | runs | n | pass | timeout | no-change | edit fails check | read wrong | loop | median s/task |')
print('|'+'---|'*10)
for k in sorted(rows):
    c=rows[k]; print(f"| {k} | {len(files[k])} | {c['n']} | {c['pass']} | {c['timeout']} | {c['no_change']} | {c['edit_fails_check']} | {c['read_wrong']} | {c['loop']} | {s.median(secs[k]):.0f} |")
print()
for k in sorted(files): print(k, files[k])

for k in sorted(tos): print('TO',k,tos[k])
for k in sorted(fails): print('FAIL',k,collections.Counter(fails[k]))
