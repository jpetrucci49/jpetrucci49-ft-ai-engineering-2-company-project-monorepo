#!/usr/bin/env python3
"""Seed the ephemeral public demo, then serve the API on port 7860.

Hugging Face Spaces wipe the container disk on sleep. This script recreates the
demo user, suppliers, inventory, and incidents on every boot. The knowledge
index stays in Qdrant Cloud; this script does not call the embedding API.

Local compose and `npm run dev` do not run this file.
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
API = ROOT / "services" / "api"

DEMO_EMAIL = "demo@healthcore.example"
DEMO_PASSWORD = "healthcore-demo"
DEMO_NAME = "Desk Demo"


def _prepare_env() -> None:
    os.chdir(API)
    os.environ.setdefault("HEALTHCORE_DEMO", "1")
    os.environ.setdefault("SUPABASE_DATABASE_URL", "sqlite:///./inventory.db")
    os.environ.setdefault("HEALTHCORE_REPO_ROOT", str(ROOT))
    os.environ.setdefault("PYTHONPATH", f"{ROOT}{os.pathsep}{API}")
    for path in (str(ROOT), str(API)):
        if path not in sys.path:
            sys.path.insert(0, path)


def seed_public_demo() -> None:
    """Idempotent demo data. Role stays ``user``. Does not print secrets other than the published login."""
    from auth.models import UserRegister
    from auth.services.users import create_user, get_user_by_email
    from seed import run_seed as seed_suppliers
    from seed_inventory import run_seed as seed_inventory

    existing = get_user_by_email(DEMO_EMAIL)
    if existing is None:
        create_user(
            UserRegister(email=DEMO_EMAIL, password=DEMO_PASSWORD, name=DEMO_NAME)
        )
        print(f"Demo user created: {DEMO_EMAIL} role=user")
    else:
        print(f"Demo user already present: {DEMO_EMAIL} role={existing.role}")

    if seed_suppliers() != 0:
        raise RuntimeError("Supplier seed failed.")
    if seed_inventory(reset=False) != 0:
        raise RuntimeError("Inventory seed failed.")

    scripts = str(ROOT / "scripts")
    if scripts not in sys.path:
        sys.path.insert(0, scripts)
    from seed_incidents import main as seed_incidents

    if seed_incidents() != 0:
        raise RuntimeError("Incident seed failed.")

    print(f"Demo login: {DEMO_EMAIL} / {DEMO_PASSWORD}")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Seed and optionally serve the public HealthCore demo.")
    parser.add_argument(
        "--seed-only",
        action="store_true",
        help="Create demo data and exit. The container command serves after seeding.",
    )
    args = parser.parse_args(argv)
    _prepare_env()
    try:
        seed_public_demo()
    except Exception as exc:
        print(f"Demo seed failed ({type(exc).__name__}).", file=sys.stderr)
        return 1
    if args.seed_only:
        return 0
    port = os.environ.get("PORT", "7860").strip() or "7860"
    os.execvp(
        "uvicorn",
        ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", port],
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
