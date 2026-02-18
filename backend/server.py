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

# Telegram Intel public routes
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