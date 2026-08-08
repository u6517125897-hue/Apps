"""Backend tests for MacroLens gym/calorie tracking API."""
import json
import requests


def _no_mongo_id(obj):
    """Recursively assert no '_id' key present anywhere."""
    if isinstance(obj, dict):
        assert "_id" not in obj, f"MongoDB _id leaked: {obj}"
        for v in obj.values():
            _no_mongo_id(v)
    elif isinstance(obj, list):
        for i in obj:
            _no_mongo_id(i)


# --------- Auth ---------
class TestAuth:
    def test_me_without_bearer_returns_401(self, base_url):
        r = requests.get(f"{base_url}/api/auth/me")
        assert r.status_code == 401, r.text

    def test_me_with_invalid_bearer_returns_401(self, base_url):
        r = requests.get(f"{base_url}/api/auth/me", headers={"Authorization": "Bearer invalid_xyz"})
        assert r.status_code == 401

    def test_auth_session_invalid_session_id_returns_401(self, base_url):
        r = requests.post(f"{base_url}/api/auth/session", json={"session_id": "invalid_bogus_session_id"})
        assert r.status_code == 401, r.text

    def test_auth_me_seeded_session(self, base_url, auth_headers, seeded_session):
        r = requests.get(f"{base_url}/api/auth/me", headers=auth_headers)
        assert r.status_code == 200, r.text
        data = r.json()
        _no_mongo_id(data)
        assert data["user_id"] == seeded_session["user_id"]
        assert data["email"] == seeded_session["email"]


# --------- Goals ---------
class TestGoals:
    def test_get_goals(self, base_url, auth_headers):
        r = requests.get(f"{base_url}/api/goals", headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        _no_mongo_id(data)
        assert data["daily_calories"] == 2000
        assert data["protein_g"] == 150

    def test_put_goals_updates_and_persists(self, base_url, auth_headers):
        payload = {"daily_calories": 2400, "protein_g": 180, "carbs_g": 260, "fat_g": 75, "water_glasses": 10, "target_weight_kg": 72.5}
        r = requests.put(f"{base_url}/api/goals", headers=auth_headers, json=payload)
        assert r.status_code == 200, r.text
        _no_mongo_id(r.json())
        # verify persistence
        g = requests.get(f"{base_url}/api/goals", headers=auth_headers).json()
        assert g["daily_calories"] == 2400
        assert g["target_weight_kg"] == 72.5


# --------- Foods ---------
class TestFoods:
    def test_create_get_delete_food(self, base_url, auth_headers):
        payload = {"name": "TEST_Oats", "meal": "breakfast", "calories": 300, "protein_g": 12, "carbs_g": 55, "fat_g": 5, "servings": 1.0}
        r = requests.post(f"{base_url}/api/foods", headers=auth_headers, json=payload)
        assert r.status_code == 200, r.text
        food = r.json()
        _no_mongo_id(food)
        assert food["name"] == "TEST_Oats"
        assert "id" in food and food["id"]
        fid = food["id"]

        r = requests.get(f"{base_url}/api/foods", headers=auth_headers)
        assert r.status_code == 200
        arr = r.json()
        _no_mongo_id(arr)
        assert any(f["id"] == fid for f in arr)

        r = requests.delete(f"{base_url}/api/foods/{fid}", headers=auth_headers)
        assert r.status_code == 200
        arr2 = requests.get(f"{base_url}/api/foods", headers=auth_headers).json()
        assert not any(f["id"] == fid for f in arr2)


# --------- Summary ---------
class TestSummary:
    def test_summary_today(self, base_url, auth_headers):
        # Add food and workout, verify totals
        requests.post(f"{base_url}/api/foods", headers=auth_headers, json={"name": "TEST_Chicken", "meal": "lunch", "calories": 500, "protein_g": 40, "carbs_g": 30, "fat_g": 15, "servings": 2.0})
        requests.post(f"{base_url}/api/workouts", headers=auth_headers, json={"name": "TEST_Run", "duration_min": 30, "calories_burned": 250})
        r = requests.get(f"{base_url}/api/summary/today", headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        _no_mongo_id(data)
        assert "totals" in data and "date" in data
        assert data["totals"]["calories"] >= 1000  # 500*2
        assert data["totals"]["calories_burned"] >= 250


# --------- Water ---------
class TestWater:
    def test_get_water_default_zero(self, base_url, auth_headers):
        r = requests.get(f"{base_url}/api/water", headers=auth_headers)
        assert r.status_code == 200
        _no_mongo_id(r.json())

    def test_increment_water(self, base_url, auth_headers):
        r1 = requests.post(f"{base_url}/api/water/increment?delta=1", headers=auth_headers)
        assert r1.status_code == 200
        g1 = r1.json()["glasses"]
        r2 = requests.post(f"{base_url}/api/water/increment?delta=2", headers=auth_headers)
        assert r2.status_code == 200
        g2 = r2.json()["glasses"]
        assert g2 == g1 + 2
        # Decrement should not go negative
        r3 = requests.post(f"{base_url}/api/water/increment?delta=-100", headers=auth_headers)
        assert r3.json()["glasses"] == 0


# --------- Weight ---------
class TestWeight:
    def test_create_and_list_weight(self, base_url, auth_headers):
        r = requests.post(f"{base_url}/api/weight", headers=auth_headers, json={"weight_kg": 75.5})
        assert r.status_code == 200
        entry = r.json()
        _no_mongo_id(entry)
        assert entry["weight_kg"] == 75.5
        r2 = requests.get(f"{base_url}/api/weight", headers=auth_headers)
        assert r2.status_code == 200
        arr = r2.json()
        _no_mongo_id(arr)
        assert any(e["id"] == entry["id"] for e in arr)


# --------- Workouts ---------
class TestWorkouts:
    def test_workout_crud(self, base_url, auth_headers):
        r = requests.post(f"{base_url}/api/workouts", headers=auth_headers, json={"name": "TEST_Squats", "duration_min": 20, "calories_burned": 180})
        assert r.status_code == 200
        w = r.json()
        _no_mongo_id(w)
        wid = w["id"]
        arr = requests.get(f"{base_url}/api/workouts", headers=auth_headers).json()
        _no_mongo_id(arr)
        assert any(x["id"] == wid for x in arr)
        r2 = requests.delete(f"{base_url}/api/workouts/{wid}", headers=auth_headers)
        assert r2.status_code == 200
        arr2 = requests.get(f"{base_url}/api/workouts", headers=auth_headers).json()
        assert not any(x["id"] == wid for x in arr2)


# --------- Barcode ---------
class TestBarcode:
    def test_barcode_nutella(self, base_url, auth_headers):
        r = requests.get(f"{base_url}/api/barcode/3017620422003", headers=auth_headers, timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        _no_mongo_id(data)
        assert data["name"]
        assert "calories" in data and "protein_g" in data

    def test_barcode_not_found(self, base_url, auth_headers):
        r = requests.get(f"{base_url}/api/barcode/0000000000000", headers=auth_headers, timeout=20)
        assert r.status_code == 404


# --------- AI Food Analyze ---------
class TestAIFood:
    def test_analyze_food_gemini(self, base_url, auth_headers, food_image_b64):
        r = requests.post(
            f"{base_url}/api/ai/analyze-food",
            headers=auth_headers,
            json={"image_base64": food_image_b64},
            timeout=90,
        )
        assert r.status_code == 200, r.text[:400]
        data = r.json()
        _no_mongo_id(data)
        for k in ["name", "calories", "protein_g", "carbs_g", "fat_g", "servings"]:
            assert k in data
        assert isinstance(data["calories"], (int, float))
        assert data["calories"] > 0
