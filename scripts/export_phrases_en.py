"""Write frontend/src/locales/phrases.en.json from the Turkish catalogue (backend/app/db/catalog_tr).

The frontend shows the English source and English hints of preset phrases without a
request. The catalogue is the single source; this file is generated. Run after any
catalogue change: `just content-export`. `--check` fails if the file is out of date.
"""
import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from app.db.catalog_tr import CATALOG, ordered_hints, phrase_id  # noqa: E402

TARGET = ROOT / "frontend/src/locales/phrases.en.json"


def render() -> str:
    items = [
        {
            "id": phrase_id(topic_id, position),
            "source_ru": p.ru,
            "source_en": p.en,
            "canonical_tr": p.tr,
            "word_hints": {h["word_ru"]: {"translation_tr": h["translation_tr"]} for h in ordered_hints(p.en, p.hints_en)},
        }
        for topic_id, phrases in CATALOG.items()
        for position, p in enumerate(phrases, start=1)
    ]
    return json.dumps(items, ensure_ascii=False, indent=2) + "\n"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true", help="fail if the file is out of date")
    args = parser.parse_args()
    content = render()
    if args.check:
        if TARGET.read_text(encoding="utf-8") != content:
            print(f"{TARGET.relative_to(ROOT)} is out of date; run `just content-export`", file=sys.stderr)
            return 1
        return 0
    TARGET.write_text(content, encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
