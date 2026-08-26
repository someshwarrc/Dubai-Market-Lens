import csv
import json
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
TRANSACTIONS_PATH = ROOT / "source-data" / "transactions-2026-08-17.csv"
PROJECTS_PATH = ROOT / "files" / "projects-2026-08-26.csv"
OUTPUT_PATH = ROOT / "source-data" / "area-locations-2026-08-26.csv"
CACHE_PATH = ROOT / "source-data" / "area-geocode-cache-2026-08-26.json"

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
USER_AGENT = "DubaiMarketLens/0.1 (one-time area centroid enrichment)"
REQUEST_INTERVAL_SECONDS = 1.1

AREA_ALIASES = {
    "al yelayiss 1": "Al Yalayis",
    "al yelayiss 2": "Al Yalayis",
    "al yelayiss 5": "Al Yalayis",
    "jabal ali first": "Jebel Ali Village",
    "jabal ali industrial second": "Jebel Ali Industrial Area",
    "al hebiah fifth": "Al Hebiah 5",
    "dubai investment park first": "Dubai Investments Park 1",
    "dubai investment park second": "Dubai Investments Park 2",
    "al khairan first": "Dubai Creek Harbour",
    "down town jabal ali": "Downtown Jebel Ali",
    "international city ph 2 & 3": "Dubai International City Phase 2",
    "madinat dubai almelaheyah": "Dubai Maritime City",
    "al thanyah fifth": "Al Thanyah 5",
    "sobha heartland": "Sobha Hartland",
    "sama al jadaf": "Al Jaddaf",
    "tecom site a": "Barsha Heights",
    "zaabeel second": "Zabeel 2",
    "me'aisem first": "Dubai Production City",
    "me'aisem second": "Dubai Production City",
    "nad al shiba first": "Nad Al Sheba 1",
}


def normalize_key(value: str) -> str:
    return " ".join((value or "").strip().lower().split())


def load_areas():
    areas = {}
    for path in (TRANSACTIONS_PATH, PROJECTS_PATH):
        with path.open("r", encoding="utf-8-sig", newline="") as stream:
            for row in csv.DictReader(stream):
                label = (row.get("AREA_EN") or "").strip()
                key = normalize_key(label)
                if key and key not in areas:
                    areas[key] = label.title()
    return areas


def load_cache():
    if not CACHE_PATH.exists():
        return {}
    return json.loads(CACHE_PATH.read_text(encoding="utf-8"))


def save_cache(cache):
    CACHE_PATH.write_text(
        json.dumps(cache, ensure_ascii=False, indent=2, sort_keys=True),
        encoding="utf-8",
    )


def fetch_candidate(area: str):
    queries = (
        (f"{area}, Dubai, United Arab Emirates", True),
        (f"{area}, United Arab Emirates", False),
    )
    for query, bounded in queries:
        parameters = {
            "q": query,
            "format": "jsonv2",
            "limit": 1,
            "countrycodes": "ae",
            "addressdetails": 1,
        }
        if bounded:
            parameters.update({
                "viewbox": "54.7,25.6,56.2,24.5",
                "bounded": 1,
            })
        request = urllib.request.Request(
            f"{NOMINATIM_URL}?{urllib.parse.urlencode(parameters)}",
            headers={"User-Agent": USER_AGENT, "Accept": "application/json"},
        )
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                payload = json.load(response)
        except (urllib.error.URLError, TimeoutError) as error:
            print(f"Request failed for {area}: {error}")
            payload = []
        time.sleep(REQUEST_INTERVAL_SECONDS)
        if payload:
            result = payload[0]
            result["query"] = query
            return result
    return None


def confidence_for(area: str, candidate) -> str:
    if not candidate:
        return "Unavailable"
    normalized_area = normalize_key(area)
    normalized_display = normalize_key(candidate.get("display_name", ""))
    if normalized_area and normalized_area in normalized_display:
        return "High"
    return "Approximate"


def write_output(areas, cache):
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with OUTPUT_PATH.open("w", encoding="utf-8", newline="") as stream:
        writer = csv.DictWriter(
            stream,
            fieldnames=(
                "AREA_KEY", "AREA_EN", "LATITUDE", "LONGITUDE",
                "DISPLAY_NAME", "SOURCE", "CONFIDENCE",
            ),
        )
        writer.writeheader()
        for key, label in sorted(areas.items(), key=lambda item: item[1]):
            candidate = cache.get(key)
            if not candidate:
                continue
            writer.writerow({
                "AREA_KEY": key,
                "AREA_EN": label,
                "LATITUDE": candidate.get("lat", ""),
                "LONGITUDE": candidate.get("lon", ""),
                "DISPLAY_NAME": candidate.get("display_name", ""),
                "SOURCE": "OpenStreetMap Nominatim",
                "CONFIDENCE": confidence_for(label, candidate),
            })


def main():
    for path in (TRANSACTIONS_PATH, PROJECTS_PATH):
        if not path.exists():
            raise FileNotFoundError(f"Missing area source: {path}")

    areas = load_areas()
    cache = load_cache()
    unresolved = [
        (key, label)
        for key, label in areas.items()
        if key not in cache or (cache[key] is None and key in AREA_ALIASES)
    ]
    print(f"Loaded {len(areas)} unique area names; {len(unresolved)} require lookup")

    for index, (key, label) in enumerate(unresolved, start=1):
        cache[key] = fetch_candidate(AREA_ALIASES.get(key, label))
        save_cache(cache)
        if index % 10 == 0 or index == len(unresolved):
            resolved = sum(1 for value in cache.values() if value)
            print(f"Processed {index}/{len(unresolved)} new areas; {resolved} resolved overall")

    write_output(areas, cache)
    output_rows = sum(1 for value in cache.values() if value)
    print(f"Created {OUTPUT_PATH.name} with {output_rows} cached approximate locations")


if __name__ == "__main__":
    main()
