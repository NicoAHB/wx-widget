# Übersicht, ruhigere Vorauswahl und Krypto-Termine

## Weniger Erklärungstext im Alltag

Die vollständigen historischen Backtest-Texte bei RSI-Divergenz und Fibonacci stehen jetzt hinter **ⓘ Backtest & Grenzen**. Die bestehenden Erklärungen zu aktuellen Levels und die Bedienknöpfe bleiben erreichbar. **Modellhinweise** in der KI-Übersicht sowie lange Erläuterungen zum Datenstrom, Sprung-Rekorder und Gewinn-/Verlust-Alarm sind ebenfalls standardmäßig eingeklappt. Antippen oder Enter öffnet und schließt die Erklärung; kein Hover nötig. Aktuelle Messwerte, Fehler, Stop-/Ziel- und Schutzwarnungen bleiben sichtbar.

## Vorauswahl: 1 Tag mit 2h-Kerzen

Ohne gespeicherte manuelle Auswahl gilt **1 Tag**, berechnet aus **2-Stunden-Kerzen**. Zwölf Kerzen bilden einen Tag ab. Der Live-Kurs läuft weiter in Echtzeit; nur die Bewertung und Musterbestätigung verwenden die ruhigere Ebene. Das Chart-Intervall bleibt unabhängig davon.

Das fasst mehr Marktbewegung zusammen und verringert die Zahl kurzlebiger Muster gegenüber 5m. Es reagiert später und garantiert keine höhere Trefferquote. **4 Stunden / 15m** bleibt eine auswählbare Alternative.

Der Standard steht an einer einzigen Stelle in `weather-widget-v2.html`:

```js
function wlDefaultSpan() { return '1d'; }
```

Für **4 Stunden / 15m** ausschließlich diesen Wert auf `'4h'` ändern. Die bestehende Zuordnung in `wlSpans()` lautet:

```js
'4h': { iv: '15m', n: 16, ms: 144e5, /* Beschriftungen */ },
'1d': { iv: '2h', n: 12, ms: 864e5, /* Beschriftungen */ }
```

`wlSpanKey()` und `wlSpan()` verwenden denselben Standard auch bei ungültiger Einstellung und frühem Start. Eine gültige gespeicherte Auswahl wird respektiert. Falls die App weiterhin „1 Std.“ zeigt: Coin-Kachel öffnen, im Detailfeld den Zeitraum auf **den letzten Tag** stellen. Nicht alle Browserdaten löschen.

### Bestehender Oracle-Dienst

Die neue App verändert eine bereits am Server übernommene Konfiguration nicht automatisch. Wenn dort noch `5m` hinterlegt ist, bleiben auch die Benachrichtigungen auf dieser Ebene.

- **HTTPS-Dienst:** In der App den Tageszeitraum wählen, die Vorauswahl vollständig laden lassen und unter Chartmuster **Vorauswahl/Zeitraum am Dienst übernehmen**. Der Export/die Übergabe enthält dann `iv: '2h'`.
- **Reiner SSH-Musterdienst:** Die Coin-Auswahl erneut herunterladen und anhand [ORACLE_24-7.md](ORACLE_24-7.md) ersetzen. Für einen bereits so eingerichteten Dienst nach dem Hochladen in der VM:

```bash
sudo install -o scalpdesk-patterns -g scalpdesk-patterns -m 600 ~/scalpdesk-patterns-watch.json /etc/scalpdesk-patterns-watch.json
sudo systemctl restart scalpdesk-patterns
```

Die Befehle gelten ausschließlich für den in dieser Anleitung eingerichteten `scalpdesk-patterns`-Dienst. Ein bestehender `scalpdesk-247`-Dienst hat einen anderen Konfigurationsweg; keine Dateien oder Tokens blind austauschen. Für diese App-Erweiterungen ist kein Oracle-Code-Update nötig.

## Kostenloser Krypto-Kalender

Unter **Analysen → Wirtschaftskalender → Krypto-Termine · kostenfrei** gibt es einen separaten öffentlichen Kalenderauszug. Drei Termine sind sichtbar, **Alle Termine** öffnet den Rest. Filter: alle Coins, eigene Vorauswahl oder geöffneter Coin. Jede Karte nennt Datum/Zeitraum, betroffene Coins und einen Link zum konkreten Ereignis.

Es wird die frei zugängliche, öffentlich gerenderte Kalenderseite von CoinMarketCal gelesen, **nicht die API mit Schlüssel**. Der GitHub-Job **Krypto-Kalender** holt sie alle drei Stunden und veröffentlicht ausschließlich normalisierte öffentliche Termine im eigenen Zweig `krypto-kalender`. Forex Factory im Zweig `kalender` bleibt unverändert. Die App lädt den Auszug beim Aufklappen, danach frühestens nach 30 Minuten. Kein Konto, zusätzlicher API-Schlüssel oder eigenes Secret nötig; der Job verwendet nur GitHubs automatisch bereitgestellten Repository-Zugriff.

Der Auszug ist **keine vollständige Kalender-API**. Ethereum-Upgrades, ETF-Verfahren oder Mt.-Gox-Termine können fehlen; es werden keine Termine erfunden oder aus älteren Nachrichten abgeleitet. Die zunächst geprüfte öffentliche Seite lieferte 13 noch laufende/kommende Termine mit konkretem Datum. Ein ebenfalls geprüfter kostenloser CoinPaprika-Endpunkt enthielt überwiegend 2019–2021 und wurde dafür nicht übernommen.

Tagesangaben werden als **Uhrzeit offen**, mehrere Tage als **Zeitraum** gekennzeichnet. Monat/Quartal ohne konkreten Tag wird verworfen. Deshalb entstehen daraus keine 15-Minuten-Alarme, Telegram-Nachrichten oder automatischen Bot-Sperren. Die bestehenden Forex-Factory-Warnungen bleiben erhalten.

Bei Ausfall, ungültigem Format oder einer geänderten Website bleibt der letzte gültige Stand. Nach zwölf Stunden wird er als veraltet markiert. Beim ersten fehlenden Auszug: Repository → **Actions → Krypto-Kalender → Run workflow**; danach **Aktualisieren** in der App. Der öffentliche Auszug ist auch separat unter `https://raw.githubusercontent.com/NicoAHB/wx-widget/krypto-kalender/crypto-calendar.json` erreichbar.

## Kurze Kontrolle

1. RSI/Fibonacci-Erklärung öffnen: ausführliche Backtests zunächst zu, über ⓘ vollständig lesbar.
2. Frisches Gerät ohne gespeicherte Auswahl: Kacheln zeigen „1 Tag“; Chart-Intervall wird nicht umgestellt. Eigene ältere Auswahl bleibt erhalten.
3. Krypto-Termine öffnen, alle drei Filter und Quellenlinks prüfen; danach schließen und erneut öffnen. Kein Bildschirmüberlauf auf dem iPhone.
4. Bestehende Oracle-Auswahl bei Bedarf einmal bewusst auf 2h übergeben. Diese App-Anpassung allein ändert den laufenden Server nicht.
