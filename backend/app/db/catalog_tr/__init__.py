"""The curated Turkish phrase catalogue, one module per preset topic."""
import re

from app.db.catalog_tr import bank, cafe, doctor, job_interview, misc, rent, transport, vacation, work
from app.db.catalog_tr.model import P

# Topic order defines positions in the preset list shown to learners.
CATALOG: dict[str, tuple[P, ...]] = {
    "job-interview": job_interview.PHRASES,
    "bank": bank.PHRASES,
    "vacation": vacation.PHRASES,
    "cafe": cafe.PHRASES,
    "work": work.PHRASES,
    "doctor": doctor.PHRASES,
    "rent": rent.PHRASES,
    "transport": transport.PHRASES,
    "misc": misc.PHRASES,
}

# Same tokenisation as app.services.hint_alignment; duplicated because the db
# layer must not import services (C-01). The catalogue test checks they agree.
_WORD = re.compile(r"[^\W_]+(?:[-'’][^\W_]+)*", re.UNICODE)


def ordered_hints(source: str, hints: dict[str, str]) -> list[dict[str, str]]:
    """Hints as stored records, in the order their keys first appear in the source."""
    source_words = [word.casefold() for word in _WORD.findall(source)]

    def position(key: str) -> int:
        fragment = [word.casefold() for word in _WORD.findall(key)]
        for index in range(len(source_words)):
            if source_words[index:index + len(fragment)] == fragment:
                return index
        return len(source_words)

    keys = sorted(hints, key=lambda key: position(key.casefold()))
    return [{"word_ru": key.strip().casefold(), "translation_tr": hints[key].strip()} for key in keys]


def phrase_id(topic_id: str, position: int) -> str:
    return f"{topic_id}-{position:02d}"


__all__ = ["CATALOG", "P", "ordered_hints", "phrase_id"]
