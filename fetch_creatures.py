#!/usr/bin/env python3
"""
Hämtar alla creatures från TibiaData API (https://docs.tibiadata.com/)
och skriver ut en sammanslagen JSON-fil (docs/data/creatures.json)
med de fält vi vill kunna filtrera på i UI:t.
"""
import json
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

API_BASE = "https://api.tibiadata.com/v4"
OUTPUT_PATH = Path(__file__).parent / "docs" / "data" / "creatures.json"
REQUEST_DELAY_SECONDS = 0.25  # var snäll mot API:et
MAX_RETRIES = 3


def fetch_json(url: str) -> dict:
    last_error = None
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            req = urllib.request.Request(
                url, headers={"User-Agent": "monsterfilter-fetch-script/1.0"}
            )
            with urllib.request.urlopen(req, timeout=30) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError) as e:
            last_error = e
            print(f"  ! Fel vid hämtning av {url} (försök {attempt}/{MAX_RETRIES}): {e}", file=sys.stderr)
            time.sleep(1.5 * attempt)
    raise RuntimeError(f"Misslyckades hämta {url}: {last_error}")


def main() -> None:
    print("Hämtar creature-listan...")
    overview = fetch_json(f"{API_BASE}/creatures")
    creature_list = overview["creatures"]["creature_list"]
    print(f"Hittade {len(creature_list)} creatures. Hämtar detaljer...")

    results = []
    errors = []
    for i, entry in enumerate(creature_list, start=1):
        race = entry["race"]
        try:
            detail = fetch_json(f"{API_BASE}/creature/{race}")
            c = detail["creature"]
            results.append(
                {
                    "name": c.get("name"),
                    "race": c.get("race"),
                    "image_url": c.get("image_url"),
                    "hitpoints": c.get("hitpoints"),
                    "experience_points": c.get("experience_points"),
                    "strong": c.get("strong") or [],
                    "weakness": c.get("weakness") or [],
                    "immune": c.get("immune") or [],
                    "healed": c.get("healed") or [],
                    "be_paralysed": c.get("be_paralysed", False),
                    "be_convinced": c.get("be_convinced", False),
                    "be_summoned": c.get("be_summoned", False),
                    "see_invisible": c.get("see_invisible", False),
                    "is_lootable": c.get("is_lootable", False),
                }
            )
        except Exception as e:
            errors.append(race)
            print(f"  ! Kunde inte hämta '{race}': {e}", file=sys.stderr)

        if i % 25 == 0 or i == len(creature_list):
            print(f"  {i}/{len(creature_list)}")
        time.sleep(REQUEST_DELAY_SECONDS)

    results.sort(key=lambda c: (c["name"] or "").lower())

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "count": len(results),
        "failed_races": errors,
        "creatures": results,
    }
    OUTPUT_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\nKlar. Skrev {len(results)} creatures till {OUTPUT_PATH}")
    if errors:
        print(f"OBS: {len(errors)} misslyckades: {errors}")


if __name__ == "__main__":
    main()
