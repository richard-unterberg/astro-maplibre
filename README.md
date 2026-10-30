## do not use - implementation ongoing

### Place-Seiten beim Build

```sh
nvm use
pnpm install
pnpm build
pnpm preview
```

Das Projekt verwendet Node.js 24 (siehe `.nvmrc`).

Die Datenquelle ist die [Overview auf GitHub](https://raw.githubusercontent.com/richard-unterberg/astro-maplibre/refs/heads/main/public/data/markers/overview.json).
Die lokale Datei `public/data/markers/overview.json` wird für diese Seiten nicht eingelesen.

1. `lib/places.ts` lädt die Overview mit `fetch()`. Zod prüft die Daten zur Laufzeit,
   inklusive übersetzter Titel, gültiger Koordinaten und eindeutiger, URL-sicherer IDs.
   Ein gemeinsames Promise hält den Datenstand für die Seitengenerierung dieses Builds fest.
2. `pages/[...locale]/place/[...place].astro` ruft den Loader in
   `getStaticPaths()` auf und kombiniert jeden Ort mit `getLocaleStaticPaths()`.
   `params.place` kommt aus der stabilen `id`; `props.place` enthält die geprüften Daten.
3. Das Template rendert `Astro.props.place` als HTML. `map/index.astro` zeigt Links
   auf alle Orte. `getRelativeLocaleUrl()` berücksichtigt Sprache, Base-Pfad und abschließenden Slash.

Aus 22 Orten und zwei Sprachen entstehen aktuell 44 Place-Seiten, zum Beispiel:

```text
/astro-maplibre/place/karl-marx-monument/
/astro-maplibre/de/place/karl-marx-monument/
```

Die Dateien liegen unter `dist/place/<id>/index.html` und
`dist/de/place/<id>/index.html`. Der konfigurierte Base-Pfad ist Teil der URL,
kein zusätzlicher Ordner in `dist`.

Der Browser benötigt dafür keinen Daten-Fetch; auch ein SSR-Adapter ist nicht nötig.
Änderungen an der Overview werden mit einem neuen Build veröffentlicht.
Die Overview enthält keine Beschreibungen aus den einzelnen Marker-Dateien;
das Beispiel zeigt ausschließlich ihre vorhandenen Felder.

HTTP-, Netzwerk-, Timeout-, JSON- und Validierungsfehler brechen den Build mit
Quell-URL und Fehlerursache ab. Das Timeout beträgt 15 Sekunden. Es gibt keinen
stillen Rückgriff auf lokale Daten und kein Überspringen fehlerhafter Orte.
Der `main`-Branch liefert den aktuellen Datenstand; für reproduzierbare Releases
kann die URL in `lib/places.ts` stattdessen auf einen Commit-SHA zeigen.

Prüfen: `pnpm test`, `pnpm typecheck` und `pnpm build`.
