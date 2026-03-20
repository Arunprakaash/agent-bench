"""
Create (or reuse) a user and assign existing agents/scenarios/suites/runs ownership
so the data becomes user-specific.

Usage (from host, against published port):
  API_BASE=http://localhost:8000/api python scripts/assign_existing_data_to_user.py

Inside the backend container (same network as the API process):
  docker compose exec -e API_BASE=http://127.0.0.1:8000/api backend \\
    python scripts/assign_existing_data_to_user.py

Flow: try login first (user already exists), then register if unknown, then login on 409.
"""

import os
import sys

import httpx
from sqlalchemy import text

from app.database import engine


DEFAULT_EMAIL = "prakaasharun50@gmail.com"
DEFAULT_PASSWORD = "123456"
DEFAULT_DISPLAY_NAME = "Prakash Arunjun"

BASE = os.environ.get("API_BASE", "http://127.0.0.1:8000/api").rstrip("/")


def _fail(msg: str, response: httpx.Response | None = None) -> None:
    print(msg, file=sys.stderr)
    if response is not None:
        print(f"  HTTP {response.status_code}: {response.text}", file=sys.stderr)
    raise SystemExit(1)


async def main_async() -> None:
    async with httpx.AsyncClient(timeout=30) as client:
        # Prefer login when the user already exists; avoids relying on 409 from register.
        login = await client.post(
            f"{BASE}/auth/login",
            json={"email": DEFAULT_EMAIL, "password": DEFAULT_PASSWORD},
        )
        if login.status_code == 200:
            token = login.json()["token"]
        elif login.status_code == 401:
            reg = await client.post(
                f"{BASE}/auth/register",
                json={
                    "email": DEFAULT_EMAIL,
                    "password": DEFAULT_PASSWORD,
                    "display_name": DEFAULT_DISPLAY_NAME,
                },
            )
            if reg.status_code == 200:
                token = reg.json()["token"]
            elif reg.status_code == 409:
                retry = await client.post(
                    f"{BASE}/auth/login",
                    json={"email": DEFAULT_EMAIL, "password": DEFAULT_PASSWORD},
                )
                if retry.status_code != 200:
                    _fail("Login after register conflict failed", retry)
                token = retry.json()["token"]
            else:
                _fail("Register failed", reg)
        else:
            _fail("Unexpected login response", login)

        me = await client.get(
            f"{BASE}/auth/me",
            headers={"Authorization": f"Bearer {token}"},
        )
        me.raise_for_status()
        user_id = me.json()["id"]

    async with engine.begin() as conn:
        # Assign ownership only where it's still unset.
        await conn.execute(
            text("UPDATE agents SET owner_user_id = :uid WHERE owner_user_id IS NULL"),
            {"uid": user_id},
        )
        await conn.execute(
            text(
                "UPDATE scenarios SET owner_user_id = :uid WHERE owner_user_id IS NULL"
            ),
            {"uid": user_id},
        )
        await conn.execute(
            text("UPDATE suites SET owner_user_id = :uid WHERE owner_user_id IS NULL"),
            {"uid": user_id},
        )
        await conn.execute(
            text(
                "UPDATE test_runs SET owner_user_id = :uid WHERE owner_user_id IS NULL"
            ),
            {"uid": user_id},
        )


def main() -> None:
    import asyncio

    asyncio.run(main_async())


if __name__ == "__main__":
    main()

