#!/bin/bash
# Alle Einheitentests (tests/unit-*.js) nacheinander, ohne Browser. Rund 5 Minuten. Endet mit Fehlercode, sobald ein Test
# fehlschlägt (Exit-Code ≠ 0 oder eine ✗-Zeile). Läuft in der CI bei jedem PR und lokal vor jedem Commit: bash tests/run-unit.sh
cd "$(dirname "$0")"
failed=()
for f in unit-*.js; do
  pkill -f "node mock-binance.js" 2>/dev/null; sleep 0.2
  out=$(timeout 300 node "$f" 2>&1); rc=$?
  summary=$(printf '%s\n' "$out" | grep -E 'bestanden' | tail -1)
  bad=$(printf '%s\n' "$out" | grep -E '^\s*✗|Abbruch —' | head -5)
  if [ "$rc" -ne 0 ] || [ -n "$bad" ]; then
    failed+=("$f"); echo "✗ $f (Exit $rc) ${summary}"; [ -n "$bad" ] && printf '%s\n' "$bad" | cut -c1-300 | sed 's/^/    /'
    [ -z "$bad" ] && printf '%s\n' "$out" | tail -5 | cut -c1-300 | sed 's/^/    /'
  else
    echo "✓ $f ${summary}"
  fi
done
pkill -f "node mock-binance.js" 2>/dev/null
echo
if [ "${#failed[@]}" -gt 0 ]; then echo "${#failed[@]} Einheitentest(s) fehlgeschlagen: ${failed[*]}"; exit 1; fi
echo "Alle Einheitentests bestanden."
