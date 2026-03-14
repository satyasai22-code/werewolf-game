"""
FastAPI application entry point and route definitions.
"""
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, Dict
import logging

from app.services import game_service
from app.websocket import manager, init_handler

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="Werewolf Game API",
    description="Real-time multiplayer Werewolf game server",
    version="1.0.0"
)

import os

# Configure CORS for frontend
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "*").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize message handler
message_handler = init_handler(game_service)


# Request/Response models
class CreateRoomRequest(BaseModel):
    player_name: str


class JoinRoomRequest(BaseModel):
    room_code: str
    player_name: str


class RoomResponse(BaseModel):
    room_code: str
    player_id: str
    player_name: str
    is_admin: bool


class RoleConfigRequest(BaseModel):
    role_counts: Dict[str, int]


# HTTP Routes
@app.get("/")
async def root():
    """Health check endpoint."""
    return {"status": "ok", "game": "Werewolf"}


@app.get("/api/roles")
async def get_roles():
    """Get information about all available roles."""
    return game_service.get_available_roles()


@app.post("/api/rooms", response_model=RoomResponse)
async def create_room(request: CreateRoomRequest):
    """Create a new game room."""
    if not request.player_name.strip():
        raise HTTPException(status_code=400, detail="Player name required")
    
    room, player = game_service.create_room(request.player_name.strip())
    
    return RoomResponse(
        room_code=room.code,
        player_id=player.id,
        player_name=player.name,
        is_admin=player.is_admin
    )


@app.post("/api/rooms/join", response_model=RoomResponse)
async def join_room(request: JoinRoomRequest):
    """Join an existing room."""
    if not request.player_name.strip():
        raise HTTPException(status_code=400, detail="Player name required")
    
    if not request.room_code.strip():
        raise HTTPException(status_code=400, detail="Room code required")
    
    result = game_service.join_room(
        request.room_code.strip().upper(),
        request.player_name.strip()
    )
    
    if not result:
        raise HTTPException(status_code=404, detail="Room not found or game already started")
    
    room, player = result
    
    return RoomResponse(
        room_code=room.code,
        player_id=player.id,
        player_name=player.name,
        is_admin=player.is_admin
    )


@app.get("/api/rooms/{room_code}")
async def get_room(room_code: str):
    """Get room state."""
    room = game_service.get_room(room_code)
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    
    return room.game.to_lobby_dict()


class ReconnectRequest(BaseModel):
    room_code: str
    player_id: str


@app.post("/api/rooms/reconnect")
async def reconnect_to_room(request: ReconnectRequest):
    """Reconnect to an existing game session."""
    room = game_service.get_room(request.room_code)
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    
    player = room.game.players.get(request.player_id)
    if not player:
        raise HTTPException(status_code=404, detail="Player not found in this room")
    
    # Mark as reconnecting (actual connection happens via WebSocket)
    return RoomResponse(
        room_code=room.code,
        player_id=player.id,
        player_name=player.name,
        is_admin=player.is_admin
    )


@app.post("/api/rooms/{room_code}/config")
async def update_role_config(room_code: str, request: RoleConfigRequest):
    """Update role configuration for a room."""
    success, message = game_service.set_role_configuration(
        room_code,
        request.role_counts
    )
    
    if not success:
        raise HTTPException(status_code=400, detail=message)
    
    return {"success": True, "message": message}


@app.get("/api/roles/random/{player_count}")
async def get_random_roles(player_count: int):
    """Generate a random balanced role configuration for the given player count."""
    if player_count < 4:
        raise HTTPException(status_code=400, detail="Minimum 4 players required")
    if player_count > 15:
        raise HTTPException(status_code=400, detail="Maximum 15 players supported")
    
    role_counts = game_service.generate_random_roles(player_count)
    return {"role_counts": role_counts, "player_count": player_count}


# WebSocket endpoint
@app.websocket("/ws/{room_code}/{player_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    room_code: str,
    player_id: str
):
    """WebSocket connection for real-time game communication."""
    # Verify player belongs to room
    room = game_service.get_room(room_code)
    if not room or player_id not in room.game.players:
        await websocket.close(code=4001)
        return
    
    # Connect player
    await manager.connect(websocket, room_code, player_id)
    
    # Mark player as connected (handles reconnection)
    player = room.game.players.get(player_id)
    if player:
        player.is_connected = True
    
    # Send initial state based on game phase
    from app.models import GamePhase
    current_phase = room.game.state_machine.current_phase
    
    if current_phase == GamePhase.LOBBY:
        # In lobby - send lobby state
        await manager.send_personal_message(
            {
                "type": "room_state",
                "data": room.game.to_lobby_dict()
            },
            player_id
        )
    else:
        # Game in progress - send personalized game state (RECONNECTION!)
        if player:
            await manager.send_personal_message(
                {
                    "type": "game_state",
                    "data": player.get_game_view(room.game)
                },
                player_id
            )
            # Also send a reconnection notification
            await manager.send_personal_message(
                {
                    "type": "reconnected",
                    "data": {
                        "phase": current_phase.value,
                        "round": room.game.state_machine.round_number,
                        "message": "Welcome back! You've been reconnected to the game."
                    }
                },
                player_id
            )
    
    # Notify others
    await manager.broadcast_to_room(
        {
            "type": "player_joined" if current_phase == GamePhase.LOBBY else "player_reconnected",
            "data": {
                "player_id": player_id,
                "player_name": player.name if player else "Unknown"
            }
        },
        room_code,
        exclude={player_id}
    )
    
    try:
        while True:
            # Receive and handle messages
            data = await websocket.receive_json()
            await message_handler.handle_message(
                websocket, room_code, player_id, data
            )
    except WebSocketDisconnect:
        # Handle disconnection
        await manager.disconnect(player_id)
        game_service.disconnect_player(player_id)
        
        # Notify others
        await manager.broadcast_to_room(
            {
                "type": "player_left",
                "data": {
                    "player_id": player_id,
                    "player_name": player.name if player else "Unknown"
                }
            },
            room_code
        )
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        await manager.disconnect(player_id)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
