# Deutsche Anzeigezeit · 3.77.7

Zeitangaben im Chart, auf der Zeitachse, beim Fadenkreuz, in Prognose-Labels, MACD-Erklärungen, Orderflow, Signalgründen, Radar und Modellvergleich verwenden ausdrücklich `Europe/Berlin`. Sommer- und Winterzeit folgen den Zeitzonenregeln des Browsers; es wird kein fester Stundenaufschlag verwendet. Die Umstellung funktioniert auch, wenn das Gerät eine andere Zeitzone hat. Reine Datums-/Zeitdarstellungen weiterer App-Ansichten folgen ebenfalls der deutschen Anzeigezeit.

Die Achse erkennt den deutschen Tageswechsel. Beim Zurückstellen der Uhr wird eine wiederholte Stunde mit dem Zeitzonenkürzel unterschieden. Formatierer und Achsen-Zeitwerte werden wiederverwendet, damit Live-Neuzeichnungen nicht jedes Mal neue Formatierer erstellen.

**Unverändert bleiben:** gespeicherte Millisekunden, UTC-Kerzenanker und Monatsgrenzen, API-Parameter, Sortierung, Zeitabstände, Countdown bis Börsen-Kerzenschluss, Datenfrische und Synchronisation mit der Börsenuhr. Kein `setHours`, kein Verschieben von Kursreihen und keine Änderung der Gerätezeitzone. Eingabe-/Filterlogik, Handelssignale, BTC-Puls-Zeitgruppen und der 24/7-Dienst werden nicht umgestellt. Technische ISO-Zeitstempel bleiben technische Zeitstempel.

Eine Binance-Tageskerze startet weiterhin um 00:00 UTC. Derselbe Zeitpunkt wird im Winter als 01:00 MEZ und im Sommer als 02:00 MESZ angezeigt. Das ist die korrekte Anzeige derselben Kerze.

Prüfungen decken Winter/Sommer, beide Zeitumstellungen 2026, deutschen Tages-/Jahreswechsel und unveränderte Eingaben ab. Rechen-/Abrufmodule werden bytegenau mit 3.77.6 verglichen. Native Chromium-/WebKit-Prüfungen mit einer amerikanischen Gerätezeitzone prüfen deutsche Anzeige, UTC-Verankerung der Stundenkerzen und unveränderte Börsen-Zeitstempel. Zusätzlich Prognose-Label/-Punkt, MACD/Fadenkreuz/Live/Vollbild und PWA-Update/Offline. Keine echten Telegram-Testnachrichten, keine physischen iOS-Geräte.

Nach dem Update auf 3.77.7: Achse, Fadenkreuz und ein Prognose-Label öffnen. Angezeigte Uhrzeit mit der deutschen Uhr vergleichen. Countdown und gewählten Kerzenzeitraum kontrollieren. Bei Tageskerzen den unveränderten Börsenstart um 01:00/02:00 deutscher Zeit beachten.
