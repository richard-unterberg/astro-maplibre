## do not use - implementation ongoing

### Place-Seiten beim Build

```sh
nvm use
pnpm install
pnpm build
pnpm preview
```

Das Projekt verwendet Node.js 24 (siehe `.nvmrc`).

Die Datenquellen liegen unter `public/data/` im Repository und werden beim Build
vom `main`-Branch auf GitHub geladen. Die lokalen Dateien werden für diese Seiten nicht eingelesen.

1. `lib/places.ts` lädt die Overview mit `fetch()`. Zod prüft die Daten zur Laufzeit,
   inklusive übersetzter Titel, gültiger Koordinaten und eindeutiger, URL-sicherer IDs.
   Ein gemeinsames Promise hält den Datenstand für die Seitengenerierung dieses Builds fest.
2. `pages/[...locale]/place/[...place].astro` ruft den Loader in
   `getStaticPaths()` auf und kombiniert jeden Ort mit `getLocaleStaticPaths()`.
   Für jeden Ort lädt `getPlace(id)` die vollständige Datei `markers/<id>.json`
   und löst die Kategorien aus `categories.json` auf. Details und Kategorien werden
   ebenfalls validiert und über beide Sprachen hinweg zwischengespeichert.
   Fehlende Kategorien oder abweichende IDs brechen den Build ab.
   `params.place` kommt aus der stabilen `id`; `props.place` enthält die vollständigen Daten.
3. Das Template rendert die übersetzte Beschreibung und die Titel und Beschreibungen
   der Kategorien als HTML. `map/overview.astro` zeigt Links
   auf alle Orte. `getRelativeLocaleUrl()` berücksichtigt Sprache, Base-Pfad und abschließenden Slash.
   Die Übersicht verwendet weiterhin ausschließlich `overview.json`.

Aus 22 Orten und zwei Sprachen entstehen aktuell 44 Place-Seiten, zum Beispiel:

```text
/astro-maplibre/place/karl-marx-monument/
/astro-maplibre/de/place/karl-marx-monument/
```

Die Dateien liegen unter `dist/place/<id>/index.html` und
`dist/de/place/<id>/index.html`. Der konfigurierte Base-Pfad ist Teil der URL,
kein zusätzlicher Ordner in `dist`.

Der Browser benötigt dafür keinen Daten-Fetch; auch ein SSR-Adapter ist nicht nötig.
Änderungen an den Daten werden mit einem neuen Build veröffentlicht.
Die Karte erhält auf Detailseiten nur Titel, Koordinaten und Detailzoom.
Beim Aufruf wird ein Marker gesetzt und die Karte auf den Detailzoom bewegt.
Das untere Panel belegt 50 % der Kartenhöhe; ein Versatz um 25 % nach oben
zentriert den Marker in der freien oberen Hälfte. Das funktioniert auch bei
Navigation mit persistierter Karte und wird bei Größenänderungen neu berechnet.
Beim Verlassen der Detailseite wird der Marker entfernt.

HTTP-, Netzwerk-, Timeout-, JSON- und Validierungsfehler brechen den Build mit
Quell-URL und Fehlerursache ab. Das Timeout beträgt 15 Sekunden. Es gibt keinen
stillen Rückgriff auf lokale Daten und kein Überspringen fehlerhafter Orte.
Der `main`-Branch liefert den aktuellen Datenstand; für reproduzierbare Releases
kann die URL in `lib/places.ts` stattdessen auf einen Commit-SHA zeigen.

Prüfen: `pnpm test`, `pnpm typecheck` und `pnpm build`.
