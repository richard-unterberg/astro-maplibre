Priority: 5
Issue: [#1](https://github.com/richard-unterberg/astro-maplibre/issues/1)

# Karten-Bounds, Kategorienavigation und klickbare Marker im Astro-MapShell umsetzen

## TLDR

Die bestehende Astro-/MapLibre-Karte soll auf `/map/`, `/map/overview/` und Kategorie-Seiten die jeweils passenden Orte als klickbare Marker zeigen und deren Bounds in den tatsächlich freien Kartenbereich einpassen. Kategorienavigation, lokalisierte Place-Links und die bestehende persistente MapShell sollen sauber integriert werden.

## Warum es wichtig ist

Das Ticket beschreibt einen konkreten agentischen Umsetzungsplan für die Karten-, Kategorie- und Navigationsansichten. Es gibt bisher keine Overview-Marker oder implementierte Kategorie-Routen; die Karte soll in allen Ansichten zur jeweiligen sichtbaren Ortsmenge passen.

## Geprüfter Ausgangsstand

- Astro `main`: [`f575c36`](https://github.com/richard-unterberg/astro-maplibre/commit/f575c363fb886dee82335c89340f32e2057a6df5).
- Designreferenz Vike `master`: [`ff66451`](https://github.com/richard-unterberg/maplibre-vike/commit/ff664513546d67d15b14c8936ad706fecbfad049).
- `lib/places.ts` lädt Overview und Details mit validiertem, gecachtem Build-Fetch. `getPlaces()` liefert IDs, Koordinaten, Kategorien, Detailzoom und übersetzte Titel. Kategorien sind bisher nur intern im Detail-Loader verfügbar.
- `layouts/MapShell.astro` persistiert den Karten-DOM und aktualisiert auf `astro:page-load`; `map/placeFocus.ts` nutzt einen Standard-Pin und festen Offset.
- Overview- und Place-Seiten haben untenliegende Container; die Kategorie-Route ist angelegt, aber leer. Header hat Logo, Locale- und Theme-Switch.

Vor Implementierung aktuellen Branch und Repository-Anweisungen erneut lesen.

## Verbindliches Verhalten

| Ansicht | Sichtbare Marker | Kameraziel |
| --- | --- | --- |
| `/map/` | Alle Overview-Orte | Bounds aller Orte, mit Rücksicht auf vorhandene untere Bedienelemente |
| `/map/overview/` | Alle Overview-Orte | Dieselben Bounds, angepasst an den freien Bereich über dem Info-Container |
| `/category/{categoryId}/` | Orte mit `categoryIds.includes(categoryId)` | Bounds der Teilmenge mit Kategorie-Info-/Listencontainer |
| `/place/{placeId}/` | Mindestens ausgewählter Ort | Bestehender Detailzoom, ausgewählter Marker oberhalb des Detailcontainers |

Routen folgen Base-Pfad und Sprachlogik (Englisch ohne Präfix, Deutsch mit `/de/`). In diesem Schritt auf Detailseiten nur den ausgewählten Marker zeigen.

### Kategorien und Navigation

- Alle Kategorien aus `categories.json` im Header mit übersetztem Titel, plus übersetzter „Alle“-Link zur `/map/`-Ansicht.
- Echte Links, ausgewählte Kategorie sichtbar und mit `aria-current="page"` markiert.
- Eine aktive Kategorie ohne Mehrfachfilter oder Query-Parameter.
- Kategorie-Seiten zeigen Titel, Beschreibung und Liste derselben Ortsmenge wie die Karte.
- Mehrfach kategorisierte Orte gehören zu jeder Kategorie; nicht nur `categoryIds[0]` zum Filtern verwenden.
- Ansichtswechsel hinterlassen keine alten Marker oder Kamera-Paddings. Sprachwechsel behält Kategorie-/Place-ID.
- Header bleibt auf kleinen Displays nutzbar, ohne Overflow oder verdeckte Schalter.

## Umsetzungsschritte

### 1. Daten und Seitenmodell

1. Öffentlichen Kategorien-Loader in `lib/places.ts` ergänzen, Schema-/Fehlerbehandlung und Promise-Cache mit Detail-Loader teilen.
2. Typen aus vorhandenen Schemas exportieren; keine divergierenden Marker-Typkopien.
3. Gemeinsamen Kategorie-Filter und typisierten Vertrag für Bounds-/Detail-Kartenansichten definieren.
4. Nur nötige lokalisierte Karteninfos an Browser übertragen: IDs, Titel, Koordinaten, Kategorien/Farbe, Detailzoom, fertige Place-URLs. Browser braucht keinen Zod-/Build-Loader.
5. Build-Fetches und Overview als Quelle für Marker/Bounds behalten; keine neuen Runtime-Queries oder Detaildatei-Fetches.

### 2. Kategorie-Routen und Header

1. `pages/[...locale]/category/[...category].astro` mit `getStaticPaths()` für Kategorien × Locale-Params umsetzen.
2. Kategorie-Metadaten und gefilterte Orte aus denselben Loadern beziehen; Titel/Beschreibung auch für Seiteninhalt und Metadaten nutzen.
3. Header-Navigation mit Kategorien, „Alle“ und aktivem Zustand versorgen.
4. URLs mit `getRelativeLocaleUrl()` generieren, keine hart codierten Root-URLs oder manuell angehängten Sprachpräfixe.
5. Bei höherem Header `layouts/AppShell.astro` und die Viewport-Höhenrechnung anpassen.

### 3. Marker

- GeoJSON-Point-Source und Circle-Layer gemäß [MapLibre-Vike-Referenz](https://github.com/richard-unterberg/maplibre-vike/blob/ff664513546d67d15b14c8936ad706fecbfad049/components/map/MapLibreMap.tsx) nutzen, ohne React-/Zustandsarchitektur zu übernehmen.
- Primärkategorien-Farben: culture `#7c3aed`, history `#b45309`, nature `#15803d`, mobility `#0369a1`, food `#be123c`, workspace `#0f766e`; definierte neutrale Ersatzfarbe für neue gültige IDs.
- Normaler Radius 7 px, aktiv 9 px; weißer Rand 2 px; innerer Punkt 2,5/3,5 px; Auswahlring 18 px mit Referenz-Opacity/-Stroke.
- Primärkategorie-Farbe bleibt stabil, auch bei Filterung nach weiterer Kategorie.
- Standard-Pin ersetzen, damit Detailmarker nicht doppelt erscheinen. Nach Theme-/Style-Wechsel aktuelle Source, Layer und Daten wiederherstellen.

### 4. Kamera und Layout

1. Gemeinsame Kamera-Logik für Overview, Kategorie und Detail; keine konkurrierenden Fokuscontroller.
2. Bounds aus tatsächlichen Koordinaten (`[longitude, latitude]`, Min/Max oder `LngLatBounds.extend`) bilden, nicht aus arithmetischem Markermittel.
3. Mehrere Punkte mit `fitBounds()` und asymmetrischem Padding einpassen; `maxZoom` begrenzt Zoom.
4. Untere überlagernde Container mit `data-map-occluder` kennzeichnen und tatsächliche Überlappung mit dem Kartenrechteck messen. Überdeckte Höhe zum unteren Padding addieren; Sicherheitsabstand zentral definieren.
5. Auf `/map/` keine nicht vorhandene halbe Bildschirmhöhe reservieren. Für Overview, Kategorie und Place tatsächliche Containerhöhe nutzen.
6. Header liegt außerhalb der Karte; nur echte Überlagerungen zählen. Panelhöhe nicht doppelt per Padding/Offset kompensieren.
7. Detailzoom und Auswahl behalten; bisherigen `-height / 4`-Offset durch Messung der freien Fläche ersetzen. Bei Resize Nutzerzoom wie bisher erhalten.
8. `ResizeObserver` für Karte und Overlays; Aktualisierungen per `requestAnimationFrame` bündeln. Erst bei gültigem Layout messen, keine willkürlichen Timer.
9. Initiale Kamera ohne störenden Flug; kurze Animation bei Wechsel, reduzierte Bewegung respektieren und vorherige Animation stoppen.
10. Bounds bei Ansicht-/Größenwechsel anwenden, nie in `move`-/`render`-Schleifen; manuelles Pannen/Zoomen muss möglich bleiben.
11. Einzelner/identischer Punkt erhält definierten begrenzten Zoom. Leere Kategorie zeigt leere Liste und keine Marker; sichere Kamera, etwa Overview-Bounds. Validierung für insgesamt leeren Overview nicht unnötig lockern.

### 5. Persistenz und Klicks

- `layouts/MapShell.astro` bleibt Besitzer der MapLibre-Instanz; persistierte Karte vollständig mit neuer Seitenkonfiguration synchronisieren.
- Neue Konfiguration aus nicht persistiertem Seitenwrapper lesen, nicht aus alten Map-DOM-Attributen.
- Marker-Klick navigiert genau einmal zur serverseitig generierten lokalisierten Place-URL (z. B. über Astros `navigate()`); nur sichtbare Marker anklickbar, freie Karte ohne Navigation, Touch-taugliche Trefferfläche und Pointer-Cursor.
- Handler nutzen aktuelle Marker/URLs nach Kategorie- und Sprachwechsel.
- `load`/`style.load` und schnelle Navigation gegen verspätete alte Callbacks absichern.
- Event-Listener/Observer bei persistierter Navigation nicht duplizieren; bei tatsächlichem Austausch Karte und Ressourcen bereinigen.
- Listen bleiben echte tastaturbedienbare Place-Links.

## Prüfung und Abnahme

Gezielte Logiktests ergänzen/anpassen: Mehrfach-Kategorie-Filter/Deduplizierung; normale, einzelne/identische und leere Bounds; Padding ohne doppelten Header-/Panelversatz; Zustandswechsel und Detailbereinigung; Kategorien-Cache und Loader-Fehlerbehandlung. Bestehende `tests/placeFocus.test.mjs` anpassen, keine veraltete `height / 4`-Annahme.

Ausführen: `pnpm test`, `pnpm typecheck`, `pnpm build` und relevante Format-/Lint-/Knip-Prüfungen. Build-Ausgabe für Kategorie-/Place-Seiten beider Sprachen prüfen.

Browser-Smoke via Production-Preview auf Desktop und schmalem/mobilem Viewport: direkte Einstiege/Reload; Bounds in freier Fläche; korrekte Teilmenge/Navigation; Marker- und Sprachwechsel; Back/Forward; Theme-Wechsel; Resize/Panelhöhe; Listener-/Observer-Stabilität; keine Rezentrierungsschleife. Screenshots dokumentieren; falls kein Browser verfügbar, offenen visuellen Smoke benennen.

## Nicht Teil dieses Tickets

Kein React-Wechsel, keine neue State-/Animationsbibliothek, kein SSR-Adapter, kein Query-/Hash-Routing, keine zusätzlichen Laufzeit-Fetches und kein Clustering.

Technische Referenzen: [MapLibre FitBoundsOptions](https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/FitBoundsOptions/), [Astro ClientRouter](https://docs.astro.build/en/guides/view-transitions/).
