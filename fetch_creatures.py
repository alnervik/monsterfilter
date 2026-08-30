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
REQUEST_DELAY_SECONDS = 1.0  # var snäll mot API:et (delad GitHub Actions-IP)
MAX_RETRIES = 4
RETRYABLE_STATUS_CODES = {429, 500, 502, 503, 504}


def fetch_json(url: str) -> dict:
    last_error = None
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            req = urllib.request.Request(
                url, headers={"User-Agent": "monsterfilter-fetch-script/1.0"}
            )
            with urllib.request.urlopen(req, timeout=30) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            last_error = e
            if e.code in RETRYABLE_STATUS_CODES:
                # Längre, exponentiell backoff för överbelastning/rate-limit
                wait = min(4 * (2 ** (attempt - 1)), 60)
                print(
                    f"  ! HTTP {e.code} för {url} (försök {attempt}/{MAX_RETRIES}), väntar {wait}s...",
                    file=sys.stderr,
                )
                time.sleep(wait)
            else:
                # T.ex. 404 — inget att vinna på att försöka igen
                raise
        except (urllib.error.URLError, TimeoutError) as e:
            last_error = e
            wait = min(4 * (2 ** (attempt - 1)), 60)
            print(f"  ! Nätverksfel för {url} (försök {attempt}/{MAX_RETRIES}): {e}, väntar {wait}s...", file=sys.stderr)
            time.sleep(wait)
    raise RuntimeError(f"Misslyckades hämta {url}: {last_error}")


def to_record(c: dict) -> dict:
    return {
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


def fetch_all(races: list[str], results: dict, errors: list[str], label: str) -> None:
    total = len(races)
    for i, race in enumerate(races, start=1):
        try:
            detail = fetch_json(f"{API_BASE}/creature/{race}")
            results[race] = to_record(detail["creature"])
            errors[:] = [r for r in errors if r != race]
        except Exception as e:
            if race not in errors:
                errors.append(race)
            print(f"  ! Kunde inte hämta '{race}': {e}", file=sys.stderr)

        if i % 25 == 0 or i == total:
            print(f"  [{label}] {i}/{total}")
        time.sleep(REQUEST_DELAY_SECONDS)


def main() -> None:
    print("Hämtar creature-listan...")
    overview = fetch_json(f"{API_BASE}/creatures")
    creature_list = overview["creatures"]["creature_list"]
    all_races = [entry["race"] for entry in creature_list]
    print(f"Hittade {len(all_races)} creatures. Hämtar detaljer...")

    results: dict = {}
    errors: list = []

    fetch_all(all_races, results, errors, "första varvet")

    if errors:
        print(f"\n{len(errors)} misslyckades första varvet, väntar 30s och försöker igen: {errors}")
        time.sleep(30)
        fetch_all(list(errors), results, errors, "andra varvet")

    records = list(results.values())
    records.sort(key=lambda c: (c["name"] or "").lower())

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "count": len(records),
        "failed_races": errors,
        "creatures": records,
    }
    OUTPUT_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\nKlar. Skrev {len(records)} creatures till {OUTPUT_PATH}")
    if errors:
        print(f"OBS: {len(errors)} misslyckades permanent: {errors}")


if __name__ == "__main__":
    main()
