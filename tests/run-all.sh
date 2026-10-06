#!/bin/bash
cd "$(dirname "$0")"
echo "== unit-m8"; timeout 120 node unit-m8.js 2>&1 | grep -E "✗|bestanden"
echo "== unit-zz"; timeout 60 node unit-zz.js 2>&1 | grep -E "✗|bestanden"
echo "== unit-zzp"; timeout 120 node unit-zzp.js 2>&1 | grep -E "✗|bestanden"
echo "== unit-div"; timeout 60 node unit-div.js 2>&1 | grep -E "✗|bestanden"
echo "== unit-ew"; timeout 60 node unit-ew.js 2>&1 | grep -E "✗|bestanden"
echo "== unit-fib"; timeout 60 node unit-fib.js 2>&1 | grep -E "✗|bestanden"
echo "== unit-ob"; timeout 60 node unit-ob.js 2>&1 | grep -E "✗|bestanden"
echo "== unit-cd"; timeout 60 node unit-cd.js 2>&1 | grep -E "✗|bestanden"
echo "== unit-hl"; timeout 60 node unit-hl.js 2>&1 | grep -E "✗|bestanden"
echo "== unit-ec"; timeout 60 node unit-ec.js 2>&1 | grep -E "✗|bestanden|Abbruch"
echo "== unit-cn"; timeout 60 node unit-cn.js 2>&1 | grep -E "✗|bestanden|Abbruch"
echo "== unit-wl"; timeout 60 node unit-wl.js 2>&1 | grep -E "✗|bestanden|Abbruch"
echo "== unit-fmt"; timeout 120 node unit-fmt.js 2>&1 | grep -E "✗|bestanden|Abbruch"
echo "== unit-vola"; timeout 120 node unit-vola.js 2>&1 | grep -E "✗|bestanden|Abbruch"
echo "== unit-247"; timeout 120 node unit-247.js 2>&1 | grep -E "✗|bestanden|Abbruch"
echo "== unit-247b"; timeout 180 node unit-247b.js 2>&1 | grep -E "✗|bestanden|Abbruch"
echo "== unit-247c"; timeout 180 node unit-247c.js 2>&1 | grep -E "✗|bestanden|Abbruch"
echo "== unit-pulse"; timeout 120 node unit-pulse.js 2>&1 | grep -E "✗|bestanden|Abbruch"
echo "== unit-lots"; timeout 180 node unit-lots.js 2>&1 | grep -E "✗|bestanden|Abbruch"
echo "== unit-acct"; timeout 180 node unit-acct.js 2>&1 | grep -E "✗|bestanden|Abbruch"
echo "== inst-247"; timeout 300 bash inst-247.sh 2>&1 | grep -E "✗|bestanden"
for s in m58 m57 m56 m55 m54 m53 m52 m51 m50 m49 m48 m47 m46 m45 m44 m43 m42 m41 m40 m39 m38 m37 m36 m35 m34 m33 m32 m31 m30 m29 m28 m27 m26 m25 m24 m23 m22 m21 m20 m19 m18 m17 m16 m15 m14 m13 m12 m11 m10 m9 m8 m7 m6 m5 m4 m3 ui functional; do echo "== $s"; timeout 900 node $s.js 2>&1 | grep -E "✗|bestanden|Abbruch"; done
echo "== statuscheck"; timeout 300 node statuscheck.js 2>&1 | grep -E "verdict|no errors" | head -3
echo "== smoke"; timeout 400 node smoke.js 2>&1 | tail -2 | cut -c1-200
echo "== visual"; timeout 300 node visual.js 2>&1 | tail -2
echo "== ENDE"
