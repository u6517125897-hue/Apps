import os
import uuid
import json
import logging
from pathlib import Path
from datetime import datetime, timezone, timedelta
from typing import Optional, List

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, APIRouter, HTTPException, Header, Depends
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field

from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

app = FastAPI()
api = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("macrolens")


# ---------- Models ----------
class User(BaseModel):
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    created_at: str


class Goals(BaseModel):
    daily_calories: int = 2000
    protein_g: int = 150
    carbs_g: int = 220
    fat_g: int = 65
    water_glasses: int = 8
    target_weight_kg: Optional[float] = None


class FoodLog(BaseModel):
    id: str
    user_id: str
    name: str
    meal: str  # breakfast, lunch, dinner, snack
    calories: float
    protein_g: float
    carbs_g: float
    fat_g: float
    servings: float = 1.0
    date: str  # YYYY-MM-DD
    created_at: str
    image_base64: Optional[str] = None


class FoodLogCreate(BaseModel):
    name: str
    meal: str
    calories: float
    protein_g: float
    carbs_g: float
    fat_g: float
    servings: float = 1.0
    date: Optional[str] = None
    image_base64: Optional[str] = None


class WaterLog(BaseModel):
    user_id: str
    date: str
    glasses: int


class WeightEntry(BaseModel):
    id: str
    user_id: str
    weight_kg: float
    date: str
    created_at: str


class WeightCreate(BaseModel):
    weight_kg: float
    date: Optional[str] = None


class WorkoutLog(BaseModel):
    id: str
    user_id: str
    name: str
    duration_min: int
    calories_burned: float
    date: str
    created_at: str


class WorkoutCreate(BaseModel):
    name: str
    duration_min: int
    calories_burned: float
    date: Optional[str] = None


class SessionRequest(BaseModel):
    session_id: str


class AiFoodRequest(BaseModel):
    image_base64: str


# ---------- Auth helpers ----------
async def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")
    token = authorization.split(" ", 1)[1].strip()
    session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")
    exp = session.get("expires_at")
    if isinstance(exp, datetime):
        if exp.tzinfo is None:
            exp = exp.replace(tzinfo=timezone.utc)
        if exp < datetime.now(timezone.utc):
            raise HTTPException(status_code=401, detail="Session expired")
    user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


def today_str() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


# ---------- Auth endpoints ----------
@api.post("/auth/session")
async def auth_session(body: SessionRequest):
    async with httpx.AsyncClient(timeout=15) as http:
        r = await http.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": body.session_id},
        )
    if r.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid session_id")
    data = r.json()
    email = data["email"]
    name = data.get("name", email.split("@")[0])
    picture = data.get("picture")
    session_token = data["session_token"]

    existing = await db.users.find_one({"email": email}, {"_id": 0})
    if existing:
        user_id = existing["user_id"]
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {"name": name, "picture": picture}},
        )
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        await db.users.insert_one({
            "user_id": user_id,
            "email": email,
            "name": name,
            "picture": picture,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        # Default goals
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
        "session_token": session_token,
        "user_id": user_id,
        "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
        "created_at": datetime.now(timezone.utc),
    })

    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    return {"session_token": session_token, "user": user}


@api.get("/auth/me")
async def auth_me(user: dict = Depends(get_current_user)):
    return user


@api.post("/auth/logout")
async def auth_logout(authorization: Optional[str] = Header(None)):
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ", 1)[1].strip()
        await db.user_sessions.delete_one({"session_token": token})
    return {"ok": True}


# ---------- Goals ----------
@api.get("/goals")
async def get_goals(user: dict = Depends(get_current_user)):
    goals = await db.goals.find_one({"user_id": user["user_id"]}, {"_id": 0, "user_id": 0})
    if not goals:
        goals = {"daily_calories": 2000, "protein_g": 150, "carbs_g": 220, "fat_g": 65, "water_glasses": 8, "target_weight_kg": None}
    return goals


@api.put("/goals")
async def update_goals(goals: Goals, user: dict = Depends(get_current_user)):
    await db.goals.update_one(
        {"user_id": user["user_id"]},
        {"$set": goals.dict()},
        upsert=True,
    )
    return goals


# ---------- Food logs ----------
@api.get("/foods")
async def list_foods(date: Optional[str] = None, user: dict = Depends(get_current_user)):
    d = date or today_str()
    logs = await db.food_logs.find(
        {"user_id": user["user_id"], "date": d}, {"_id": 0}
    ).sort("created_at", 1).to_list(500)
    return logs


@api.post("/foods")
async def create_food(body: FoodLogCreate, user: dict = Depends(get_current_user)):
    d = body.date or today_str()
    doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["user_id"],
        "name": body.name,
        "meal": body.meal,
        "calories": body.calories,
        "protein_g": body.protein_g,
        "carbs_g": body.carbs_g,
        "fat_g": body.fat_g,
        "servings": body.servings,
        "date": d,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "image_base64": body.image_base64,
    }
    await db.food_logs.insert_one(doc.copy())
    doc.pop("_id", None)
    return doc


@api.delete("/foods/{food_id}")
async def delete_food(food_id: str, user: dict = Depends(get_current_user)):
    await db.food_logs.delete_one({"id": food_id, "user_id": user["user_id"]})
    return {"ok": True}


# ---------- Water ----------
@api.get("/water")
async def get_water(date: Optional[str] = None, user: dict = Depends(get_current_user)):
    d = date or today_str()
    doc = await db.water_logs.find_one(
        {"user_id": user["user_id"], "date": d}, {"_id": 0}
    )
    return doc or {"user_id": user["user_id"], "date": d, "glasses": 0}


@api.post("/water/increment")
async def increment_water(delta: int = 1, user: dict = Depends(get_current_user)):
    d = today_str()
    doc = await db.water_logs.find_one({"user_id": user["user_id"], "date": d}, {"_id": 0})
    current = (doc or {}).get("glasses", 0)
    new_val = max(0, current + delta)
    await db.water_logs.update_one(
        {"user_id": user["user_id"], "date": d},
        {"$set": {"glasses": new_val, "user_id": user["user_id"], "date": d}},
        upsert=True,
    )
    return {"date": d, "glasses": new_val}


# ---------- Weight ----------
@api.get("/weight")
async def list_weight(user: dict = Depends(get_current_user)):
    entries = await db.weight_entries.find(
        {"user_id": user["user_id"]}, {"_id": 0}
    ).sort("date", 1).to_list(500)
    return entries


@api.post("/weight")
async def create_weight(body: WeightCreate, user: dict = Depends(get_current_user)):
    d = body.date or today_str()
    doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["user_id"],
        "weight_kg": body.weight_kg,
        "date": d,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    # Replace same day entry if exists
    await db.weight_entries.delete_many({"user_id": user["user_id"], "date": d})
    await db.weight_entries.insert_one(doc.copy())
    doc.pop("_id", None)
    return doc


# ---------- Workouts ----------
@api.get("/workouts")
async def list_workouts(date: Optional[str] = None, user: dict = Depends(get_current_user)):
    q = {"user_id": user["user_id"]}
    if date:
        q["date"] = date
    entries = await db.workouts.find(q, {"_id": 0}).sort("created_at", -1).to_list(500)
    return entries


@api.post("/workouts")
async def create_workout(body: WorkoutCreate, user: dict = Depends(get_current_user)):
    d = body.date or today_str()
    doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["user_id"],
        "name": body.name,
        "duration_min": body.duration_min,
        "calories_burned": body.calories_burned,
        "date": d,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.workouts.insert_one(doc.copy())
    doc.pop("_id", None)
    return doc


@api.delete("/workouts/{workout_id}")
async def delete_workout(workout_id: str, user: dict = Depends(get_current_user)):
    await db.workouts.delete_one({"id": workout_id, "user_id": user["user_id"]})
    return {"ok": True}


# ---------- AI Food Recognition ----------
@api.post("/ai/analyze-food")
async def analyze_food(body: AiFoodRequest, user: dict = Depends(get_current_user)):
    if not EMERGENT_LLM_KEY:
        raise HTTPException(status_code=500, detail="LLM key not configured")

    system = (
        "You are a nutrition expert. Analyze the food image and return ONLY a JSON object "
        "with keys: name (string, short dish name), calories (number, kcal per serving), "
        "protein_g (number), carbs_g (number), fat_g (number), servings (number, default 1). "
        "No prose, no markdown, just the JSON."
    )
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"food-{uuid.uuid4().hex[:8]}",
        system_message=system,
    ).with_model("gemini", "gemini-3-flash-preview")

    image = ImageContent(image_base64=body.image_base64)
    msg = UserMessage(
        text="Analyze this food and return the JSON.",
        file_contents=[image],
    )

    text = ""
    try:
        from emergentintegrations.llm.chat import TextDelta, StreamDone
        async for ev in chat.stream_message(msg):
            if isinstance(ev, TextDelta):
                text += ev.content
            elif isinstance(ev, StreamDone):
                break
    except Exception as e:
        logger.exception("Gemini call failed")
        raise HTTPException(status_code=502, detail=f"AI analysis failed: {str(e)}")

    # Clean output
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`")
        if cleaned.lower().startswith("json"):
            cleaned = cleaned[4:]
        cleaned = cleaned.strip()
    # Try to find JSON block
    try:
        start = cleaned.index("{")
        end = cleaned.rindex("}") + 1
        cleaned = cleaned[start:end]
        parsed = json.loads(cleaned)
    except Exception:
        raise HTTPException(status_code=502, detail=f"Could not parse AI response: {text[:200]}")

    return {
        "name": str(parsed.get("name", "Meal")),
        "calories": float(parsed.get("calories", 0)),
        "protein_g": float(parsed.get("protein_g", 0)),
        "carbs_g": float(parsed.get("carbs_g", 0)),
        "fat_g": float(parsed.get("fat_g", 0)),
        "servings": float(parsed.get("servings", 1)),
    }


# ---------- Barcode lookup (OpenFoodFacts, no key) ----------
@api.get("/barcode/{code}")
async def barcode_lookup(code: str, user: dict = Depends(get_current_user)):
    url = f"https://world.openfoodfacts.org/api/v2/product/{code}.json"
    try:
        async with httpx.AsyncClient(timeout=10) as http:
            r = await http.get(url)
        data = r.json()
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Barcode lookup failed: {str(e)}")

    if data.get("status") != 1:
        raise HTTPException(status_code=404, detail="Product not found")

    p = data.get("product", {})
    nutriments = p.get("nutriments", {})
    return {
        "name": p.get("product_name") or p.get("generic_name") or "Unknown product",
        "brand": p.get("brands", ""),
        "calories": float(nutriments.get("energy-kcal_100g", 0)),
        "protein_g": float(nutriments.get("proteins_100g", 0)),
        "carbs_g": float(nutriments.get("carbohydrates_100g", 0)),
        "fat_g": float(nutriments.get("fat_100g", 0)),
        "serving_size": p.get("serving_size", "100g"),
    }


# ---------- Summary ----------
@api.get("/summary/today")
async def today_summary(user: dict = Depends(get_current_user)):
    d = today_str()
    foods = await db.food_logs.find(
        {"user_id": user["user_id"], "date": d}, {"_id": 0}
    ).to_list(500)
    workouts = await db.workouts.find(
        {"user_id": user["user_id"], "date": d}, {"_id": 0}
    ).to_list(500)
    water = await db.water_logs.find_one(
        {"user_id": user["user_id"], "date": d}, {"_id": 0}
    )
    totals = {
        "calories": sum(f["calories"] * f.get("servings", 1) for f in foods),
        "protein_g": sum(f["protein_g"] * f.get("servings", 1) for f in foods),
        "carbs_g": sum(f["carbs_g"] * f.get("servings", 1) for f in foods),
        "fat_g": sum(f["fat_g"] * f.get("servings", 1) for f in foods),
        "calories_burned": sum(w["calories_burned"] for w in workouts),
        "water_glasses": (water or {}).get("glasses", 0),
        "meals_count": len(foods),
    }
    return {"date": d, "totals": totals}


app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.users.create_index("user_id", unique=True)
    await db.user_sessions.create_index("session_token", unique=True)
    await db.user_sessions.create_index("user_id")
    await db.user_sessions.create_index("expires_at", expireAfterSeconds=0)
    await db.food_logs.create_index([("user_id", 1), ("date", 1)])
    await db.workouts.create_index([("user_id", 1), ("date", 1)])
    await db.weight_entries.create_index([("user_id", 1), ("date", 1)])
    await db.water_logs.create_index([("user_id", 1), ("date", 1)], unique=True)
    logger.info("MacroLens backend ready")


@app.on_event("shutdown")
async def shutdown():
    client.close()
