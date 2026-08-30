# Monsterfilter

Statisk sida för att filtrera Tibias monster på element (strong/weakness/
immune/healed), hitpoints, experience och beteenden (paralyseras,
convinceas, summonas, ser invisible). Data hämtas från
[TibiaData API](https://docs.tibiadata.com/).

## Struktur

- `fetch_creatures.py` — hämtar alla creatures från TibiaData API och
  skriver `docs/data/creatures.json`.
- `.github/workflows/update-creatures.yml` — GitHub Action som kör
  scriptet varje måndag (och manuellt vid behov) och committar ny data
  om den ändrats.
- `docs/` — den statiska sidan (GitHub Pages).
  - `docs/data/creatures.json` innehåller just nu exempeldata för sex
    monster så sidan går att testa direkt. Actionen ersätter filen med
    riktig data vid första körningen.

## Komma igång

1. Skapa ett nytt repo på GitHub och pusha upp den här mappen.
2. Under **Settings → Pages**: välj **Deploy from a branch**, branch
   `main`, mapp `/docs`.
3. Under **Settings → Actions → General → Workflow permissions**: se
   till att "Read and write permissions" är valt, så att Action:en får
   committa `creatures.json`.
4. Kör workflowen manuellt en gång (**Actions → Update creature data →
   Run workflow**) för att fylla på med riktig data direkt, i stället
   för att vänta till måndag.

## Köra hämtningen lokalt

```bash
python3 fetch_creatures.py
```

Skriver `docs/data/creatures.json`. Tar ett tag (~600 anrop, ett per
monster, med en liten paus mellan varje för att vara snäll mot API:et).

## Testa sidan lokalt

```bash
cd docs
python3 -m http.server 8000
```

Öppna http://localhost:8000

## Vidareutveckling / idéer

- Lägg till sortering (t.ex. på hp eller exp) i resultatlistan.
- Länk till varje monsters TibiaWiki-sida.
- Spara valda filter i URL:en (query params) så man kan dela en länk.
- Om creature-listan växer mycket: överväg att skippa `is_lootable`/
  oanvända fält i `fetch_creatures.py` för att hålla JSON-filen liten.
