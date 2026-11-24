# Fork: deutsche Zeit und Ferraris-Bilanz

Dieser Fork basiert auf msucimaker3112/energy-cockpit v0.45.2. Die ursprüngliche MIT-Lizenz und Autorenhinweise bleiben erhalten.

## Installation

Im Home-Assistant-Marketplace/HACS das benutzerdefinierte Repository `wekog/energy-cockpit` als Dashboard-Karte hinzufügen und dessen Release installieren. Original und Fork verwenden denselben Dateinamen und dieselben Kartennamen: nur eine Variante installieren. Nach dem Wechsel Browser neu laden. Bestehende Dashboard-Konfigurationen werden durch die Installation nicht ersetzt.

## Feste deutsche Zeit

Kalendertage, Zeitbeschriftungen und Statistikabfragen der Karten verwenden `Europe/Berlin`, einschließlich Sommerzeit. Der Standort und die Zeitzone des Browsers ändern die Tagesgrenzen nicht. Home Assistant sollte ebenfalls auf `Europe/Berlin` eingestellt sein, damit serverseitige Tagesstatistiken dazu passen. Die globale JavaScript-Date-Klasse anderer Karten wird nicht verändert.

## Zusätzliche Karte

```yaml
type: custom:energy-cockpit-ferraris-card
title: Ferraris-Bilanz
grid_import_total: sensor.netzbezug_gesamt
grid_export_total: sensor.einspeisung_gesamt
pv_totals:
  - sensor.pv_ertrag_gesamt
price_ct: 40
billing_month: 1
billing_day: 1
start_period: day
```

Die Sensor-IDs und der Preis sind Beispiele. Persönliche Konfigurationen gehören ausschließlich nach Home Assistant.

Die drei Energiequellen müssen voneinander getrennte, positive Energie-Gesamtzähler mit Langzeitstatistik sein; jede PV-Anlage genau einmal auswählen. Die Statistik wird von Home Assistant in kWh angefordert. Die Karte bietet Heute, Monat, Jahr und Abrechnung. Arbeitspreis (Cent/kWh), Beginn des jährlichen Abrechnungszeitraums und Startansicht sind im Karteneditor jederzeit änderbar. Ein 29. Februar wird in Nichtschaltjahren als 28. Februar behandelt.

- Nettoänderung Ferraris = Netzbezug − Einspeisung.
- Hausverbrauch = Solarproduktion + Netzbezug − Einspeisung.
- Netto-Arbeitskosten = Nettoänderung × Arbeitspreis.
- Wert der Solarproduktion = gesamte Solarproduktion × Arbeitspreis.

Dieses Modell bildet eine vom Anwender vorausgesetzte vollständige Verrechnung von Bezug und Einspeisung ab. Es liest keinen mechanischen Zählerstand aus und verspricht keine Auszahlung bei negativem Saldo. Grundpreise und historische Tarifwechsel werden nicht berechnet. Die physische Direktnutzung von Solarstrom bleibt in den Originalkarten separat sichtbar.

Es werden ausschließlich gemeinsam vorhandene Statistikintervalle addiert. Fehlende Werte werden nicht als null behandelt. Fehlende abgeschlossene Intervalle ergeben einen deutlichen Teilbilanz-Hinweis; vorhandene Daten ab Herbst ergeben somit keine vollständige Jahresabrechnung ab Januar.

## Zwei PV-Anlagen in der Verbraucherkarte

Im erweiterten YAML-Bereich `home_energy` unterstützt dieser Fork neben `pv` auch `pv2` als zweiten PV-Ertragszähler. Beide werden für den physischen Strommix summiert; bei identischer ID wird nur einmal gezählt. Bezug und Einspeisung stehen weiterhin unter `import` und `export`. Die Originalkarten und ihre Gestaltung bleiben erhalten. Die neue Bilanzkarte nutzt dieselben Farbschemen (`theme`) und Kacheloberflächen wie das Original.

## Entwicklerupdates übernehmen

Das Original bleibt als Git-Remote `upstream` bestehen. Vor einer Übernahme neue Upstream-Commits in einem Arbeitsbranch zusammenführen, Konflikte in den fünf Karten/Common-Zeitadaptern, Editor-Kit und Build-Reihenfolge prüfen, anschließend `npm test`, `npm run build` und `npm run check` ausführen. Die eigenständigen Dateien `german-time.js`, `ferraris.js` und `ferraris-card.js` begrenzen die Eingriffe in den Originalcode. Erst nach Prüfung ein eigenes Release mit `dist/energy-cockpit.js` veröffentlichen und dieses in HA installieren.

Die zusätzliche Bilanzkarte hat deutsche Beschriftungen. Die Übersetzungen der Originalkarten bleiben erhalten.
