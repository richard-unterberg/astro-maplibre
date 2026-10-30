Effort: 5
Uncertainty: 1

# [Plan] Karten-Bounds, Kategorienavigation und klickbare Marker im Astro-MapShell umsetzen

## Umgesetzt

Die Implementierung liegt auf dem lokalen Branch `agent-map-category-markers`, Commit `5cffcc6` (Implement category navigation, clickable markers and measured map bounds). Es wurde kein anderes Ticket begonnen. Push, Pull Request und Merge waren nicht beauftragt; das Ticket bleibt für die Veröffentlichung und Review erhalten.

- Kategorien-Loader mit gemeinsamem Promise-Cache und Schema-Typen; lokalisierte Kartenkonfiguration aus dem Overview.
- Kategorie-Routen in beiden Sprachen, Kategorienavigation mit aktiver Auswahl, echte Ortslinks und flexibles Header-/Viewport-Layout.
- GeoJSON-Kreise mit Primärkategorien-Farben, Auswahlring, Touch-Trefferflächen und aktuellen lokalisierten Navigationszielen.
- Gemeinsame Kamera für Bounds und Details, gemessene Overlay-Paddings, ResizeObserver/RAF, Detailzoom-Erhalt und sichere leere/einzelne Bounds.
- Persistente MapShell mit aktueller Seitenkonfiguration, Wiederherstellung bei Style-Wechsel und Bereinigung von Listenern/Observern.

## Prüfung

`pnpm test`: 53 Tests erfolgreich. `pnpm typecheck` und `pnpm build`: erfolgreich, 62 Seiten. Generierte 12 Kategorie-, 44 Place- und 4 Karten-Seiten zusätzlich auf URLs, Titel, Auswahl und passende Ortsmengen geprüft. Biome-Format/Lint erfolgreich, bestehende Spezifitätswarnung in `map/map-controls.css` bleibt.

Knip erfolgreich mit `KNIP_DISABLE_RAW_TRANSFER=1 pnpm run check:knip`. Ohne Flag scheitert der OXC-Parser auf diesem 4-GB-VPS an einem 6-GiB-Puffer. Nach dem VPS-Neustart wurden alle Prüfungen einzeln und mit niedrigerer Priorität ausgeführt.

Production-Preview in Chromium auf 1280×900 und 360×780 erfolgreich geprüft: direkte Einstiege/Reloads, Kategorie-/Sprachwechsel, Marker-Klick/Tap, Back/Forward, Theme-Wechsel, Resize/Panelhöhe, Detailzoom-Erhalt, Padding-Rücksetzung, freies Pannen und stabile Listener/Bereinigung. Keine Browserfehler. Dokumentation und Screenshots: `docs/map-smoke.md`.

Mangels MapTiler-Konfiguration im Checkout lief der Browser-Smoke mit einem einfachen abgefangenen Hintergrundstil und einem ausschließlich im Test verwendeten Inspektions-Hook. Die echte MapTiler-Basiskarte/Attribution bleibt mit der Deployment-Konfiguration visuell zu prüfen.
