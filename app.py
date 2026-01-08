from flask import Flask, render_template, request, jsonify
import os, json, random, time, datetime

app = Flask(__name__)

# ------------------ storage (Render-safe) ------------------
DATA_DIR = os.environ.get("DATA_DIR", ".")
USER_DATA_FILE = os.path.join(DATA_DIR, "user_data.json")

WINNING_SCORE = 10
MAX_HISTORY = 50

def _ensure_data_file():
    """Ensure DATA_DIR exists and user_data.json exists (important on Render)."""
    # DATA_DIR might be "." locally (dirname = ""), so guard it
    dirpath = os.path.dirname(USER_DATA_FILE)
    if dirpath:
        os.makedirs(dirpath, exist_ok=True)

    if not os.path.exists(USER_DATA_FILE):
        with open(USER_DATA_FILE, "w", encoding="utf-8") as f:
            json.dump({}, f)

def load_user_data():
    _ensure_data_file()
    try:
        with open(USER_DATA_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except (json.JSONDecodeError, FileNotFoundError):
        # If file is empty/corrupted, recover safely
        return {}

def save_user_data(data):
    _ensure_data_file()
    with open(USER_DATA_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=4)

def now_str():
    return datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")

def get_leaderboard(limit=None):
    """Return leaderboard rows sorted by score. If limit is None -> full list."""
    data = load_user_data()
    rows = []
    for u, p in data.items():
        rows.append({
            "username": u,
            "total_score": int(p.get("total_score", 0)),
            "wins": int(p.get("games_won", 0)),
            "games": int(p.get("total_games", 0)),
        })
    rows.sort(key=lambda x: x["total_score"], reverse=True)
    return rows if limit is None else rows[:limit]

# ------------------ history + sync helpers ------------------
def ensure_profile_shape(profile: dict):
    profile.setdefault("total_games", 0)
    profile.setdefault("games_won", 0)
    profile.setdefault("total_score", 0)
    profile.setdefault("date_created", now_str())
    profile.setdefault("last_played", now_str())
    profile.setdefault("history", [])

def append_history(profile: dict, won: bool, earned_score: int, time_taken: float, difficulty: str):
    ensure_profile_shape(profile)
    profile["history"].append({
        "ts": now_str(),
        "won": bool(won),
        "score": int(earned_score),
        "time_taken": round(float(time_taken), 1) if time_taken is not None else None,
        "difficulty": difficulty,
    })
    profile["history"] = profile["history"][-MAX_HISTORY:]

def resync_totals_from_history(profile: dict):
    ensure_profile_shape(profile)
    hist = profile.get("history", []) or []
    profile["total_games"] = len(hist)
    profile["games_won"] = sum(1 for h in hist if h.get("won") is True)

def compute_summary_from_history(profile: dict):
    ensure_profile_shape(profile)
    hist = profile.get("history", []) or []
    total = len(hist)
    wins = sum(1 for h in hist if h.get("won") is True)
    losses = total - wins

    win_pct = round((wins / total) * 100, 1) if total > 0 else 0.0
    lose_pct = round((losses / total) * 100, 1) if total > 0 else 0.0

    times = [h.get("time_taken") for h in hist if isinstance(h.get("time_taken"), (int, float))]
    avg_time = round(sum(times) / len(times), 1) if times else 0.0

    return {
        "total_games": total,
        "wins": wins,
        "losses": losses,
        "win_pct": win_pct,
        "lose_pct": lose_pct,
        "avg_time": avg_time,
    }

# ------------------ simple in-memory sessions ------------------
SESSIONS = {}

def require_session(client_id: str):
    if not client_id:
        return None, ("Missing client_id", 400)
    if client_id not in SESSIONS:
        SESSIONS[client_id] = {"username": None, "active_game": None}
    return SESSIONS[client_id], None

# ------------------ game helpers ------------------
def difficulty_settings(difficulty: str):
    if difficulty == "easy":
        return 1, 20, 5, 1
    if difficulty == "medium":
        return 1, 25, 4, 2
    if difficulty == "hard":
        return 1, 30, 3, 3
    if difficulty == "extreme":
        return 1, 40, 3, 4
    return 1, 20, 5, 1

def give_hint(guess, secret):
    diff = abs(guess - secret)
    if diff <= 3:
        return "Very close!"
    elif diff <= 10:
        return "Getting warm!"
    return "Cold. Far away."

# ------------------ routes ------------------
@app.route("/")
def index():
    return render_template("index.html")

@app.get("/api/leaderboard")
def api_leaderboard():
    # Full leaderboard by default
    return jsonify({"ok": True, "leaderboard": get_leaderboard(limit=None)})

@app.post("/api/player_history")
def api_player_history():
    body = request.get_json(force=True)
    client_id = body.get("client_id", "")

    session, err = require_session(client_id)
    if err:
        msg, code = err
        return jsonify({"ok": False, "error": msg}), code

    username = session.get("username")
    if not username:
        return jsonify({"ok": False, "error": "Please login first."}), 401

    data = load_user_data()
    profile = data.get(username)
    if not profile:
        return jsonify({"ok": False, "error": "User not found."}), 404

    ensure_profile_shape(profile)
    resync_totals_from_history(profile)
    data[username] = profile
    save_user_data(data)

    return jsonify({
        "ok": True,
        "username": username,
        "summary": compute_summary_from_history(profile),
        "history": profile.get("history", [])
    })

@app.post("/api/profile")
def api_profile():
    body = request.get_json(force=True)
    client_id = body.get("client_id", "")
    username = (body.get("username", "") or "").strip()

    session, err = require_session(client_id)
    if err:
        msg, code = err
        return jsonify({"ok": False, "error": msg}), code

    if not session.get("username"):
        return jsonify({"ok": False, "error": "Please login first."}), 401

    if not username:
        return jsonify({"ok": False, "error": "Missing username."}), 400

    data = load_user_data()
    profile = data.get(username)
    if not profile:
        return jsonify({"ok": False, "error": "User not found."}), 404

    ensure_profile_shape(profile)
    resync_totals_from_history(profile)

    # Save back (keeps totals consistent)
    data[username] = profile
    save_user_data(data)

    total_games = int(profile.get("total_games", 0))
    wins = int(profile.get("games_won", 0))
    losses = max(0, total_games - wins)

    win_pct = round((wins / total_games) * 100, 1) if total_games > 0 else 0.0
    lose_pct = round((losses / total_games) * 100, 1) if total_games > 0 else 0.0

    history = profile.get("history", []) or []
    history_last50 = history[-50:]
    recent10 = list(reversed(history_last50[-10:]))

    times = [h.get("time_taken") for h in history_last50 if isinstance(h.get("time_taken"), (int, float))]
    avg_time = round(sum(times) / len(times), 1) if times else 0.0

    # IMPORTANT: return "history" as the chart/list source (last 50 is enough)
    return jsonify({
        "ok": True,
        "username": username,
        "summary": {
            "total_score": int(profile.get("total_score", 0)),
            "total_games": total_games,
            "wins": wins,
            "losses": losses,
            "win_pct": win_pct,
            "lose_pct": lose_pct,
            "avg_time": avg_time,
            "date_created": profile.get("date_created", ""),
            "last_played": profile.get("last_played", ""),
        },
        "history": history_last50,
        "recent": recent10
    })

@app.post("/api/create")
def api_create():
    body = request.get_json(force=True)
    client_id = body.get("client_id", "")
    username = (body.get("username", "") or "").strip()

    session, err = require_session(client_id)
    if err:
        msg, code = err
        return jsonify({"ok": False, "error": msg}), code

    if not username:
        return jsonify({"ok": False, "error": "Username cannot be empty."}), 400

    data = load_user_data()
    if username in data:
        return jsonify({"ok": False, "error": "Username already exists. Use Login."}), 400

    data[username] = {
        "total_games": 0,
        "games_won": 0,
        "total_score": 0,
        "date_created": now_str(),
        "last_played": now_str(),
        "history": []
    }
    save_user_data(data)

    session["username"] = username
    session["active_game"] = None

    return jsonify({"ok": True, "username": username, "profile": data[username]})

@app.post("/api/login")
def api_login():
    body = request.get_json(force=True)
    client_id = body.get("client_id", "")
    username = (body.get("username", "") or "").strip()

    session, err = require_session(client_id)
    if err:
        msg, code = err
        return jsonify({"ok": False, "error": msg}), code

    if not username:
        return jsonify({"ok": False, "error": "Username cannot be empty."}), 400

    data = load_user_data()
    if username not in data:
        return jsonify({"ok": False, "error": "User not found. Create a new user."}), 404

    ensure_profile_shape(data[username])
    resync_totals_from_history(data[username])

    data[username]["last_played"] = now_str()
    save_user_data(data)

    session["username"] = username
    session["active_game"] = None

    return jsonify({"ok": True, "username": username, "profile": data[username]})

@app.post("/api/logout")
def api_logout():
    body = request.get_json(force=True)
    client_id = body.get("client_id", "")

    session, err = require_session(client_id)
    if err:
        msg, code = err
        return jsonify({"ok": False, "error": msg}), code

    session["username"] = None
    session["active_game"] = None
    return jsonify({"ok": True})

@app.post("/api/start")
def api_start():
    body = request.get_json(force=True)
    client_id = body.get("client_id", "")
    difficulty = body.get("difficulty", "easy")

    session, err = require_session(client_id)
    if err:
        msg, code = err
        return jsonify({"ok": False, "error": msg}), code

    if not session.get("username"):
        return jsonify({"ok": False, "error": "Please login first."}), 401

    rmin, rmax, max_guesses, mult = difficulty_settings(difficulty)
    secret = random.randint(rmin, rmax)

    session["active_game"] = {
        "difficulty": difficulty,
        "range_min": rmin,
        "range_max": rmax,
        "max_guesses": max_guesses,
        "mult": mult,
        "secret": secret,
        "guesses_taken": 0,
        "history": [],
        "start_time": time.time(),
    }

    base_points = WINNING_SCORE * mult
    return jsonify({
        "ok": True,
        "game": {
            "difficulty": difficulty,
            "range_min": rmin,
            "range_max": rmax,
            "max_guesses": max_guesses,
            "base_points": base_points
        }
    })

@app.post("/api/guess")
def api_guess():
    body = request.get_json(force=True)
    client_id = body.get("client_id", "")
    guess = body.get("guess", None)

    session, err = require_session(client_id)
    if err:
        msg, code = err
        return jsonify({"ok": False, "error": msg}), code

    username = session.get("username")
    game = session.get("active_game")
    if not username:
        return jsonify({"ok": False, "error": "Please login first."}), 401
    if not game:
        return jsonify({"ok": False, "error": "No active game. Start a new game."}), 400

    try:
        guess = int(guess)
    except Exception:
        return jsonify({"ok": False, "error": "Guess must be a number."}), 400

    if not (game["range_min"] <= guess <= game["range_max"]):
        return jsonify({"ok": False, "error": f"Enter a number between {game['range_min']} and {game['range_max']}."}), 400

    if game["guesses_taken"] >= game["max_guesses"]:
        return jsonify({"ok": False, "error": "No guesses left. Start a new game."}), 400

    game["guesses_taken"] += 1
    game["history"].append(guess)
    remaining = game["max_guesses"] - game["guesses_taken"]
    secret = game["secret"]

    # -------- WIN --------
    if guess == secret:
        time_taken = time.time() - game["start_time"]
        base_points = WINNING_SCORE * game["mult"]
        bonus = remaining * 2
        earned = base_points + bonus

        data = load_user_data()
        p = data.get(username)
        if not p:
            return jsonify({"ok": False, "error": "User profile missing."}), 500

        ensure_profile_shape(p)
        p["total_score"] += int(earned)
        p["last_played"] = now_str()

        append_history(p, True, earned, time_taken, game["difficulty"])
        resync_totals_from_history(p)

        data[username] = p
        save_user_data(data)
        session["active_game"] = None

        return jsonify({
            "ok": True,
            "status": "win",
            "message": "Correct!",
            "earned": int(earned),
            "time_taken": round(time_taken, 1),
            "profile": p,
            "leaderboard": get_leaderboard(limit=None),
        })

    # -------- AUTO LOSE --------
    if remaining == 0:
        time_taken = time.time() - game["start_time"]

        data = load_user_data()
        p = data.get(username)
        if p:
            ensure_profile_shape(p)
            p["last_played"] = now_str()
            append_history(p, False, 0, time_taken, game["difficulty"])
            resync_totals_from_history(p)
            data[username] = p
            save_user_data(data)

        session["active_game"] = None

        return jsonify({
            "ok": True,
            "status": "lose",
            "message": f"Game over! You ran out of guesses. The number was {secret}.",
            "history": game["history"],
            "remaining": 0,
            "profile": p or {},
            "leaderboard": get_leaderboard(limit=None),
        })

    if guess < secret:
        return jsonify({
            "ok": True,
            "status": "low",
            "message": "Too low.",
            "hint": give_hint(guess, secret),
            "history": game["history"],
            "remaining": remaining,
        })

    return jsonify({
        "ok": True,
        "status": "high",
        "message": "Too high.",
        "hint": give_hint(guess, secret),
        "history": game["history"],
        "remaining": remaining,
    })

@app.post("/api/delete")
def api_delete():
    body = request.get_json(force=True)
    username = (body.get("username", "") or "").strip()
    client_id = body.get("client_id", "")

    session, err = require_session(client_id)
    if err:
        msg, code = err
        return jsonify({"ok": False, "error": msg}), code

    data = load_user_data()
    if username not in data:
        return jsonify({"ok": False, "error": "User not found."}), 404

    del data[username]
    save_user_data(data)

    if session.get("username") == username:
        session["username"] = None
        session["active_game"] = None

    return jsonify({"ok": True})

@app.post("/api/forfeit")
def api_forfeit():
    body = request.get_json(force=True)
    client_id = body.get("client_id", "")

    session, err = require_session(client_id)
    if err:
        msg, code = err
        return jsonify({"ok": False, "error": msg}), code

    username = session.get("username")
    game = session.get("active_game")

    if not username:
        return jsonify({"ok": False, "error": "Please login first."}), 401
    if not game:
        return jsonify({"ok": False, "error": "No active game."}), 400

    secret = game["secret"]
    time_taken = time.time() - game["start_time"]

    session["active_game"] = None

    data = load_user_data()
    p = data.get(username)
    if p:
        ensure_profile_shape(p)
        p["last_played"] = now_str()
        append_history(p, False, 0, time_taken, game["difficulty"])
        resync_totals_from_history(p)
        data[username] = p
        save_user_data(data)

    return jsonify({
        "ok": True,
        "status": "lose",
        "message": f"Game over. The number was {secret}.",
        "profile": p or {}
    })

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
