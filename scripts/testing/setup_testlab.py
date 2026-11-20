"""Generate local fixture credentials without printing them."""
import secrets
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
target = ROOT / ".env.testlab"
if not target.exists():
    target.write_text(
        "TESTLAB_EMAIL=testlab@example.invalid\n"
        f"TESTLAB_PASSWORD={secrets.token_urlsafe(32)}\n"
        f"TESTLAB_SIGNING_SECRET={secrets.token_urlsafe(48)}\n",
        encoding="utf-8",
    )
print("Local credentials ready; values are not displayed.")
