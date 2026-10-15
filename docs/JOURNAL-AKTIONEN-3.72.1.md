# Journalaktionen und Löschbestätigung – 3.72.1

Nutzerkorrektur zum iPhone-Screenshot: € / Foto / Stift / × sollen gleichmäßig in einer Zeile stehen, jeder Knopf mit eigenem Rahmen. Ja und Nein sollen nebeneinander bleiben.

Die Aktionsgruppe verwendet feste 44 × 44 px große Knöpfe, jeweils mit sichtbarem Rahmen und 8 px Abstand. Flex-Umbruch innerhalb der Gruppe ist ausgeschlossen. Der vorhandene Versandstatus kann weiterhin separat darüber stehen. Reihenfolge, Symbole, Vorlesebeschriftungen und Funktionen bleiben erhalten.

Die Trade-Löschbestätigung bekommt eine eigene Klasse `trade-delete-confirm`: Die Frage belegt eine volle Zeile, darunter stehen Ja und Nein in zwei gleich breiten Grid-Spalten. Beide Antworten haben mindestens 44 px Höhe und bleiben auch bei schmalem Panel nebeneinander. Der übrige Euro-/Notizdialog bleibt unverändert. Nein bricht weiterhin ab; erst Ja führt die bestehende Löschung aus. Es gibt keine Änderung der Handels-, Signal- oder Versandlogik.

## Validierung

`m116` prüft die tatsächliche Zeilengeometrie, sichtbare Rahmen auf allen vier Seiten, gleichmäßige Abstände, Reihenfolge und große Touchflächen bei 320/390/430/768/1440 px. Die Löschfrage wird dabei mit derselben zusätzlichen Chart-Warnmeldung wie im Nutzerscreenshot geöffnet. Frage und Antworten müssen vollständig im Panel liegen; Ja und Nein müssen dieselbe Höhe haben und nebeneinander stehen. Zusätzlicher Fall mit großer Monospace-Ersatzschrift bei 320 px. Nein muss beide Testtrades erhalten; Ja darf nur den bestätigten Testtrade löschen.

Der unveränderte Ausgangsstand 3.72.0 besteht die ergänzte Absicherung nur mit 33/43; die korrigierte Fassung einschließlich zusätzlichem Schriftfall mit 44/44. Gezielte serielle Nachprüfung bestehender Journal-, Trade-Bild-, Modellvergleichs- und Offline-/Releasewege; kein echter Telegram-Versand. Ein neuer vollständiger Gesamtlauf ist für diese begrenzte CSS-/Klassenänderung nicht erforderlich; der frühere Lauf bleibt 3.71.1 zugeordnet. Abschließend **165/165 Einzelprüfungen** in acht Programmen bestanden; Lint 0 Fehler/3 bekannte Warnungen und reproduzierbarer Release-Abgleich. Einzelresultate im [Testnachweis](JOURNAL-AKTIONEN-3.72.1-TESTS.json), isolierte Vorabprüfung bei 320/390 px ebenfalls bestanden (Rahmen, gleichmäßige Zeile, Ja/Nein nebeneinander, Nein erhält Trade, kein Überlauf/JavaScript-Fehler). Abschließender öffentlicher Hash-/Browsernachweis im Release-PR.

App/Service Worker 3.72.1, neues Bündel mit 86 PWA-Dateien. Bestehende Module und alte Bündel bleiben unverändert; Dienstversion 2.15.0. Chromium prüft mobile Touch-Darstellung, ein echtes iPhone/Safari bleibt separat zu kontrollieren.

## Kontrolle auf dem iPhone

- Version 3.72.1 neu laden, Journal öffnen: € / Foto / Stift / × in einer Zeile, jeder Knopf einzeln umrahmt.
- × antippen: Frage darüber, Ja und Nein nebeneinander. Mit Nein abbrechen und prüfen, dass der Trade erhalten bleibt.
- Mit vorhandenem Versandstatus, Chart-Warnung und größerer Textdarstellung wiederholen. €-, Foto- und Notizfunktion bleiben erreichbar.
