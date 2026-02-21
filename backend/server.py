"""
Telegram Intelligence Proxy Server
Routes all /api/telegram-intel/* requests to Node.js backend
"""
from fastapi import FastAPI, APIRouter, Request, Response
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List
import uuid
from datetime import datetime, timezone
import httpx
import subprocess
import signal
import atexit
import time

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Node.js backend URL (runs on different port)
NODE_BACKEND_URL = "http://localhost:8002"
node_process = None

def start_node_backend():
    global node_process
    env = os.environ.copy()
    env['PORT'] = '8002'
    node_process = subprocess.Popen(
        ['npx', 'tsx', 'src/server-telegram.ts'],
        cwd=ROOT_DIR,
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE
    )
    logging.info(f"[PROXY] Started Node.js backend on port 8002, PID: {node_process.pid}")
    time.sleep(3)  # Wait for Node.js to start

def stop_node_backend():
    global node_process
    if node_process:
        node_process.terminate()
        node_process.wait()
        logging.info("[PROXY] Stopped Node.js backend")

atexit.register(stop_node_backend)

# Start Node.js backend
start_node_backend()

# Create the main app
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Define Models
class StatusCheck(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class StatusCheckCreate(BaseModel):
    client_name: str

@api_router.get("/")
async def root():
    return {"message": "Hello World"}

@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(input: StatusCheckCreate):
    status_dict = input.model_dump()
    status_obj = StatusCheck(**status_dict)
    doc = status_obj.model_dump()
    doc['timestamp'] = doc['timestamp'].isoformat()
    _ = await db.status_checks.insert_one(doc)
    return status_obj

@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
    status_checks = await db.status_checks.find({}, {"_id": 0}).to_list(1000)
    for check in status_checks:
        if isinstance(check['timestamp'], str):
            check['timestamp'] = datetime.fromisoformat(check['timestamp'])
    return status_checks

# Proxy for Telegram Intel routes
async def proxy_to_node(request: Request, path: str):
    """Proxy request to Node.js backend"""
    url = f"{NODE_BACKEND_URL}/api/{path}"
    
    async with httpx.AsyncClient(timeout=60.0) as client:
        # Forward headers
        headers = dict(request.headers)
        headers.pop('host', None)
        
        # Get body if present
        body = await request.body()
        
        try:
            response = await client.request(
                method=request.method,
                url=url,
                headers=headers,
                content=body if body else None,
                params=dict(request.query_params)
            )
            return Response(
                content=response.content,
                status_code=response.status_code,
                headers=dict(response.headers),
                media_type=response.headers.get('content-type')
            )
        except Exception as e:
            logging.error(f"[PROXY] Error proxying to {url}: {e}")
            return Response(
                content=f'{{"ok": false, "error": "proxy_error", "message": "{str(e)}"}}',
                status_code=502,
                media_type="application/json"
            )

# ==================== MOCK DATA FOR FRONTEND (while Node rebuilds) ====================

import random
import math

MOCK_CHANNELS = [
    {"username": "alpha_crypto", "growth7": 12.2, "growth30": 18.5, "stability": 0.85, "fraud": 0.12, "engagement": 0.15, "posts": 4},
    {"username": "nft_insider", "growth7": 22.5, "growth30": 35.2, "stability": 0.72, "fraud": 0.22, "engagement": 0.19, "posts": 3},
    {"username": "whale_alerts", "growth7": 5.2, "growth30": 8.1, "stability": 0.91, "fraud": 0.08, "engagement": 0.125, "posts": 5},
    {"username": "defi_news", "growth7": 8.5, "growth30": 12.3, "stability": 0.78, "fraud": 0.18, "engagement": 0.14, "posts": 2},
    {"username": "shitcoin_casino", "growth7": -8.5, "growth30": -15.2, "stability": 0.25, "fraud": 0.78, "engagement": 0.033, "posts": 1},
    {"username": "trading_signals", "growth7": 15.3, "growth30": 22.1, "stability": 0.82, "fraud": 0.15, "engagement": 0.17, "posts": 4},
    {"username": "crypto_news_daily", "growth7": 6.8, "growth30": 11.2, "stability": 0.88, "fraud": 0.09, "engagement": 0.13, "posts": 3},
    {"username": "airdrop_hunter", "growth7": 28.5, "growth30": 45.2, "stability": 0.65, "fraud": 0.32, "engagement": 0.22, "posts": 2},
    {"username": "defi_degen", "growth7": 18.2, "growth30": 28.5, "stability": 0.71, "fraud": 0.25, "engagement": 0.18, "posts": 3},
    {"username": "nft_alpha", "growth7": 9.5, "growth30": 14.2, "stability": 0.79, "fraud": 0.14, "engagement": 0.16, "posts": 4},
]

AVATAR_COLORS = ['#1976D2', '#E53935', '#8E24AA', '#43A047', '#1E88E5', '#546E7A', '#00897B', '#F4511E', '#3949AB', '#D81B60']

def compute_utility_score(ch):
    return round(
        25 * ch["engagement"] / 0.2 +
        20 * max(0, min(1, (ch["growth30"] + 20) / 60)) +
        15 * ch["stability"] +
        15 * 0.5 +  # originality
        15 * min(1, ch["posts"] / 5) +
        10 * (1 - ch["fraud"])
    )

def get_activity_label(posts):
    if posts >= 3: return "High"
    if posts >= 1: return "Medium"
    return "Low"

def get_lifecycle(growth7, growth30, utility):
    if growth7 > 15 and growth30 > 20: return "EXPANDING"
    if growth7 > 5 and utility > 60: return "EMERGING"
    if growth7 < 0: return "DECLINING"
    if utility > 70 and growth7 < 5: return "MATURE"
    return "STABLE"

def build_entity_list(q="", type_filter="", min_growth=None, max_growth=None, activity_filter="", max_red_flags=None, sort="utility", page=1, limit=20):
    items = []
    for i, ch in enumerate(MOCK_CHANNELS):
        utility = compute_utility_score(ch)
        activity = get_activity_label(ch["posts"])
        red_flags = round(ch["fraud"] * 5)
        title = ch["username"].replace("_", " ").title()
        
        item = {
            "username": ch["username"],
            "title": title,
            "avatarUrl": None,
            "avatarColor": AVATAR_COLORS[i % len(AVATAR_COLORS)],
            "type": "Channel" if i % 3 != 1 else "Group",
            "members": round(utility * 500 + random.randint(1000, 50000)),
            "avgReach": round(utility * 300 + random.randint(500, 30000)),
            "growth7": ch["growth7"],
            "growth30": ch["growth30"],
            "activity": activity,
            "activityLabel": activity,
            "redFlags": red_flags,
            "fomoScore": utility,
            "utilityScore": utility,
            "engagement": round(ch["engagement"] * 10000),
            "engagementRate": ch["engagement"],
            "lifecycle": get_lifecycle(ch["growth7"], ch["growth30"], utility),
            "fraudRisk": ch["fraud"],
            "stability": ch["stability"],
            "updatedAt": datetime.now(timezone.utc).isoformat(),
        }
        
        # Apply filters
        if q and q.lower() not in item["username"].lower() and q.lower() not in item["title"].lower():
            continue
        if type_filter and item["type"].lower() != type_filter.lower():
            continue
        if min_growth is not None and item["growth7"] < min_growth:
            continue
        if max_growth is not None and item["growth7"] > max_growth:
            continue
        if activity_filter and item["activity"] != activity_filter:
            continue
        if max_red_flags is not None and item["redFlags"] > max_red_flags:
            continue
            
        items.append(item)
    
    # Sort
    if sort == "growth":
        items.sort(key=lambda x: x["growth7"], reverse=True)
    elif sort == "members":
        items.sort(key=lambda x: x["members"], reverse=True)
    elif sort == "reach":
        items.sort(key=lambda x: x["avgReach"], reverse=True)
    else:  # utility
        items.sort(key=lambda x: x["fomoScore"], reverse=True)
    
    total = len(items)
    start = (page - 1) * limit
    paginated = items[start:start + limit]
    
    return {
        "ok": True,
        "items": paginated,
        "total": total,
        "page": page,
        "limit": limit,
        "stats": {
            "tracked": total,
            "avgUtility": round(sum(i["fomoScore"] for i in items) / max(1, len(items))),
            "highGrowth": len([i for i in items if i["growth7"] >= 10]),
            "highRisk": len([i for i in items if i["redFlags"] >= 3]),
        }
    }

def build_channel_overview(username):
    ch = next((c for c in MOCK_CHANNELS if c["username"] == username), None)
    if not ch:
        ch = {"username": username, "growth7": 5.0, "growth30": 8.0, "stability": 0.75, "fraud": 0.15, "engagement": 0.12, "posts": 2}
    
    utility = compute_utility_score(ch)
    activity = get_activity_label(ch["posts"])
    title = ch["username"].replace("_", " ").title()
    members = round(utility * 500 + 5000)
    views_per_post = round(utility * 150 + 1000)
    
    return {
        "ok": True,
        "profile": {
            "username": username,
            "title": title,
            "type": "Channel",
            "avatarUrl": None,
            "avatarColor": AVATAR_COLORS[hash(username) % len(AVATAR_COLORS)],
            "description": f"{title} is a Telegram channel with {members:,} subscribers. Activity level is {activity.lower()}.",
            "telegramUrl": f"https://t.me/{username}",
            "updatedAt": "30 min ago",
        },
        "topCards": {
            "subscribers": members,
            "subscribersChange": f"+{round(members * ch['growth7'] / 100)} last 7D",
            "viewsPerPost": views_per_post,
            "viewsSubtitle": f"View rate {50 + round(ch['engagement'] * 100)}%",
            "messagesPerDay": "3-5" if ch["posts"] >= 3 else "1-2" if ch["posts"] >= 1 else "< 1",
            "messagesSubtitle": "Incl. posts & pinned threads",
            "activity": activity,
            "activitySubtitle": "Views, replies & forwards",
        },
        "aiSummary": {
            "text": f"{title} is in the {'upper' if utility >= 60 else 'middle'} tier of Telegram channels. Growth is {ch['growth7']:.1f}% over 7 days. Fraud risk is {'low' if ch['fraud'] < 0.3 else 'moderate' if ch['fraud'] < 0.6 else 'elevated'}.",
            "spamLevel": "Low" if ch["fraud"] < 0.3 else "Medium" if ch["fraud"] < 0.6 else "High",
            "signalNoise": round(10 - ch["fraud"] * 5),
            "contentExposure": ["General Topics", "Trading", "Research"],
        },
        "activityOverview": {
            "postsPerDay": "3-5" if ch["posts"] >= 3 else "1-2",
            "viewRateStability": "High" if ch["stability"] >= 0.7 else "Moderate",
            "viewRateValue": round(ch["stability"] * 100),
            "forwardVolatility": "Low" if ch["stability"] >= 0.6 else "Moderate",
            "forwardValue": round((1 - ch["stability"]) * 60 + 20),
        },
        "audienceSnapshot": {
            "directFollowers": 72,
            "crossPost": 18,
            "searchHashtags": 6,
            "externalShares": 4,
        },
        "productOverview": {
            "type": "Information Channel",
            "rating": round((utility / 20) * 10) / 10,
            "tags": ["Updates", "Research", "Community"],
            "feedback": "Users highlight clear market insights and growing community.",
            "trustIndicators": [
                "Stable engagement patterns" if ch["stability"] >= 0.6 else "Growing engagement",
                "Low spam" if ch["fraud"] < 0.4 else "Some automated activity detected",
                "Positive growth trajectory" if ch["growth7"] >= 0 else "Audience stabilizing",
            ],
            "refundRate": "N/A",
        },
        "channelSnapshot": {
            "onlineNow": round(members * 0.05 + random.randint(50, 150)),
            "peak24h": round(members * 0.1 + random.randint(100, 300)),
            "activeSenders": round(members * 0.02 + random.randint(20, 80)),
            "retention7d": round(60 + ch["stability"] * 30),
        },
        "healthSafety": {
            "spamLevel": {"label": "Low" if ch["fraud"] < 0.3 else "Medium", "value": round(ch["fraud"] * 100)},
            "raidRisk": {"label": "Low" if ch["stability"] >= 0.6 else "Medium", "value": round((1 - ch["stability"]) * 70 + 10)},
            "modCoverage": {"label": "Good" if ch["fraud"] < 0.4 else "Medium", "value": round(80 - ch["fraud"] * 40)},
            "note": "Activity patterns are stable." if ch["stability"] >= 0.5 else "Activity shows some volatility.",
        },
        "relatedChannels": [
            {"title": "Related Channel 1", "activity": "Medium"},
            {"title": "Related Channel 2", "activity": "High"},
            {"title": "Related Channel 3", "activity": "Low"},
        ],
        "timeline": [
            {"time": t, "views": round(100 + math.sin(i * 0.8) * 800 + random.randint(0, 500)), "reactions": round(20 + math.sin(i * 0.8) * 30), "joins": random.randint(0, 5)}
            for i, t in enumerate(["00:00", "04:00", "08:00", "12:00", "16:00", "20:00", "24:00"])
        ],
        "recentPosts": [
            {"id": 1, "text": f"Update from {title}: Important market developments.", "likes": 200 + random.randint(0, 200), "comments": 50 + random.randint(0, 100), "views": 50000 + random.randint(0, 100000), "date": "Today 4:12 pm"},
            {"id": 2, "text": f"{title} community insights and analysis.", "likes": 150 + random.randint(0, 150), "comments": 40 + random.randint(0, 80), "views": 40000 + random.randint(0, 80000), "date": "Yesterday 2:30 pm"},
        ],
        "metrics": {
            "utilityScore": utility,
            "growth7": ch["growth7"],
            "growth30": ch["growth30"],
        },
    }

# Mock endpoints (fallback when Node.js is down)
@api_router.get("/telegram-intel/utility/list")
async def mock_utility_list(
    q: str = "",
    type: str = "",
    minGrowth7: float = None,
    maxGrowth7: float = None,
    activity: str = "",
    maxRedFlags: int = None,
    sort: str = "utility",
    page: int = 1,
    limit: int = 20
):
    return build_entity_list(q, type, minGrowth7, maxGrowth7, activity, maxRedFlags, sort, page, limit)

@api_router.get("/telegram-intel/channel/{username}/overview")
async def mock_channel_overview(username: str):
    return build_channel_overview(username)

@api_router.get("/telegram-intel/compare")
async def mock_compare(left: str, right: str):
    return {
        "ok": True,
        "left": build_channel_overview(left),
        "right": build_channel_overview(right),
    }

# Telegram Intel public routes (proxy to Node if available)
@api_router.api_route("/telegram-intel/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH"])
async def proxy_telegram_intel(request: Request, path: str):
    return await proxy_to_node(request, f"telegram-intel/{path}")

# Telegram Intel admin routes
@api_router.api_route("/admin/telegram-intel/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH"])
async def proxy_admin_telegram_intel(request: Request, path: str):
    return await proxy_to_node(request, f"admin/telegram-intel/{path}")

# Health check that includes Node.js status
@api_router.get("/health")
async def health_check():
    node_healthy = False
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(f"{NODE_BACKEND_URL}/api/health")
            node_healthy = response.status_code == 200
    except:
        pass
    
    return {
        "ok": True,
        "python": True,
        "node": node_healthy,
        "module": "telegram-intel-proxy",
        "timestamp": datetime.now(timezone.utc).isoformat()
    }

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
    stop_node_backend()