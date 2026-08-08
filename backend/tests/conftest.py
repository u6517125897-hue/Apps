import os
import uuid
import base64
import asyncio
from datetime import datetime, timezone, timedelta
from pathlib import Path

import pytest
import requests
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

# Load backend env for Mongo access
load_dotenv(Path(__file__).resolve().parents[1] / ".env")

BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"] if "EXPO_PUBLIC_BACKEND_URL" in os.environ else None
if not BASE_URL:
    # Read from frontend .env
    fe = Path(__file__).resolve().parents[2] / "frontend" / ".env"
    for line in fe.read_text().splitlines():
        if line.startswith("EXPO_PUBLIC_BACKEND_URL="):
            BASE_URL = line.split("=", 1)[1].strip().strip('"')
            break
BASE_URL = BASE_URL.rstrip("/")

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]


@pytest.fixture(scope="session")
def base_url():
    return BASE_URL


@pytest.fixture(scope="session")
def seeded_session():
    """Seed a test user + session directly in Mongo. Return token + user_id."""
    async def _seed():
        client = AsyncIOMotorClient(MONGO_URL)
        db = client[DB_NAME]
        user_id = f"user_TEST_{uuid.uuid4().hex[:8]}"
        token = f"TEST_tok_{uuid.uuid4().hex}"
        email = f"TEST_{uuid.uuid4().hex[:6]}@example.com"
        await db.users.insert_one({
            "user_id": user_id,
            "email": email,
            "name": "Test User",
            "picture": None,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        await db.goals.insert_one({
            "user_id": user_id,
            "daily_calories": 2000,
            "protein_g": 150,
            "carbs_g": 220,
            "fat_g": 65,
            "water_glasses": 8,
            "target_weight_kg": None,
        })
        await db.user_sessions.insert_one({
            "session_token": token,
            "user_id": user_id,
            "expires_at": datetime.now(timezone.utc) + timedelta(days=1),
            "created_at": datetime.now(timezone.utc),
        })
        client.close()
        return {"token": token, "user_id": user_id, "email": email}

    info = asyncio.get_event_loop().run_until_complete(_seed()) if not asyncio.get_event_loop().is_closed() else asyncio.run(_seed())
    yield info

    # Cleanup
    async def _cleanup():
        client = AsyncIOMotorClient(MONGO_URL)
        db = client[DB_NAME]
        uid = info["user_id"]
        await db.users.delete_many({"user_id": uid})
        await db.user_sessions.delete_many({"user_id": uid})
        await db.goals.delete_many({"user_id": uid})
        await db.food_logs.delete_many({"user_id": uid})
        await db.water_logs.delete_many({"user_id": uid})
        await db.weight_entries.delete_many({"user_id": uid})
        await db.workouts.delete_many({"user_id": uid})
        client.close()
    try:
        asyncio.run(_cleanup())
    except Exception:
        pass


@pytest.fixture(scope="session")
def auth_headers(seeded_session):
    return {"Authorization": f"Bearer {seeded_session['token']}", "Content-Type": "application/json"}


@pytest.fixture(scope="session")
def food_image_b64():
    """Fetch a real food image (JPEG) with real features. Returns base64 string."""
    urls = [
        "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400&q=70&fm=jpg",  # pizza
        "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&q=70&fm=jpg",  # food
    ]
    for u in urls:
        try:
            r = requests.get(u, timeout=15)
            if r.status_code == 200 and len(r.content) > 5000 and r.content[:3] == b"\xff\xd8\xff":
                return base64.b64encode(r.content).decode("ascii")
        except Exception:
            continue
    pytest.skip("Could not fetch real food JPEG for AI test")
