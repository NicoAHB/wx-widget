#!/bin/bash
# ESLint über das JavaScript-Modul der App (Erwartung: 0 Fehler; bekannte Warnungen: usableFx, base, ALARM_ICON, fx)
cd "$(dirname "$0")"
F=../weather-widget-v2.html
S=$(grep -n '<script type="module">' $F | cut -d: -f1); E=$(awk -v s=$S 'NR>s && /<\/script>/ {print NR; exit}' $F)
sed -n "$((S+1)),$((E-1))p" $F > lint-g01.mjs
ESL=$(npm root -g)/eslint/bin/eslint.js; [ -f "$ESL" ] || ESL=/opt/node22/lib/node_modules/eslint/bin/eslint.js
NODE_PATH=$(npm root -g) node "$ESL" -c eslint-g01.config.mjs lint-g01.mjs; rc=$?; rm -f lint-g01.mjs; exit $rc
