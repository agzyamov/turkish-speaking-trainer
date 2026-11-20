"""English source text of preset phrases, keyed by the Russian source; derived from app.db.catalog_tr."""
from app.db.catalog_tr import CATALOG

TOPIC_PHRASES_EN: dict[str, str] = {p.ru: p.en for phrases in CATALOG.values() for p in phrases}
