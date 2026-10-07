// Prüft den tatsächlichen ES-Modul-Import im Browser-Worker, ohne eigene Rechenkopie.
import { parityFixture } from './confluence.mjs';
self.postMessage(parityFixture());
