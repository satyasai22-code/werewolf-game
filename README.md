# Werewolf Game - Real-Time Multiplayer

A full-stack, real-time multiplayer Werewolf (Mafia) game built with React, FastAPI, and WebSockets.

## 🎮 Features

- **Real-time multiplayer** gameplay via WebSockets
- **Room-based** matchmaking with shareable room codes
- **6 unique roles** with extensible architecture:
  - 🐺 **Werewolf** - Hunt villagers at night
  - 👤 **Villager** - Find and eliminate werewolves
  - 🔮 **Seer** - Reveal one player's role each night
  - 💉 **Doctor** - Protect one player from death
  - 🧪 **Witch** - One save potion and one kill potion
  - ⚔️ **Avenger** - Take someone with you when you die
- **Day/Night cycle** with discussion and voting phases
- **Blind game state** - players only see information relevant to their role
- **Admin ownership transfer** when the room creator leaves

## 🛠 Tech Stack

### Backend
- **FastAPI** - Modern Python web framework
- **WebSockets** - Real-time bidirectional communication
- **Pydantic** - Data validation and serialization
- **Finite State Machine** - Robust game phase management

### Frontend
- **React 18** - UI framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **Zustand** - State management
- **Vite** - Build tool

## 📁 Project Structure

```
werewolf/
├── backend/
│   ├── app/
│   │   ├── models/
│   │   │   ├── roles.py       # Role system with Strategy Pattern
│   │   │   ├── state_machine.py # Game phase FSM
│   │   │   └── game.py        # Core game models
│   │   ├── services/
│   │   │   └── game_service.py # Game & room management
│   │   ├── websocket/
│   │   │   ├── connection_manager.py
│   │   │   └── handlers.py    # WebSocket message handling
│   │   └── main.py            # FastAPI application
│   └── requirements.txt
│
└── frontend/
    ├── src/
    │   ├── components/
    │   │   ├── game/          # Game phase components
    │   │   ├── PlayerList.tsx
    │   │   └── RoleConfig.tsx
    │   ├── pages/
    │   │   ├── Home.tsx       # Landing/join page
    │   │   ├── Lobby.tsx      # Pre-game lobby
    │   │   └── Game.tsx       # Main game view
    │   ├── store/
    │   │   └── gameStore.ts   # Zustand state management
    │   └── types/
    │       └── game.ts        # TypeScript interfaces
    ├── package.json
    └── tailwind.config.js
```

## 🚀 Getting Started

### Prerequisites
- Python 3.9+
- Node.js 18+
- npm or yarn

### Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run the server
uvicorn app.main:app --reload --port 8000
```

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Run development server
npm run dev
```

The frontend will be available at `http://localhost:3000` and will proxy API/WebSocket requests to the backend.

## 🎯 How to Play

1. **Create a Room**: Enter your name and click "Create New Game"
2. **Share the Code**: Give the 6-character room code to your friends
3. **Configure Roles**: The admin sets how many of each role to include
4. **Ready Up**: All players must click "Ready" before the game can start
5. **Play!**: Follow the day/night cycle and try to win!

### Win Conditions
- **Village Team**: Eliminate all werewolves
- **Werewolf Team**: Equal or outnumber the villagers

## 🔧 Architecture

### Role System (Strategy Pattern)

New roles can be added by extending the `BaseRole` class:

```python
from app.models.roles import BaseRole, RoleType, Team

class Hunter(BaseRole):
    role_type = RoleType.HUNTER  # Add to RoleType enum
    team = Team.VILLAGE
    name = "Hunter"
    description = "When you die, take one player with you."
    priority = 25
    has_night_action = False
    
    def perform_action(self, game, target_id=None, action_type="primary"):
        # Implement action logic
        pass
    
    def on_death(self, game, killer_id=None):
        # Implement death trigger
        pass
```

### Game State Machine

The FSM ensures valid phase transitions:

```
LOBBY → STARTING → NIGHT → NIGHT_RESOLUTION → DAY_ANNOUNCEMENT
                     ↑                              ↓
                     └── VOTE_RESOLUTION ← DAY_VOTING ← DAY_DISCUSSION
                              ↓
                          GAME_OVER
```

### Blind State System

Players receive personalized game views via `player.get_game_view(game)`:
- Each player only sees their own role
- Werewolves can see other werewolves
- Dead players' roles are revealed during day phase
- Night actions and targets are hidden appropriately

## 📝 API Reference

### HTTP Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/roles` | Get all available roles |
| POST | `/api/rooms` | Create a new room |
| POST | `/api/rooms/join` | Join an existing room |
| GET | `/api/rooms/{code}` | Get room state |

### WebSocket Messages

| Type | Direction | Description |
|------|-----------|-------------|
| `toggle_ready` | Client→Server | Toggle ready status |
| `start_game` | Client→Server | Admin starts game |
| `night_action` | Client→Server | Submit night action |
| `cast_vote` | Client→Server | Cast elimination vote |
| `game_state` | Server→Client | Personalized game state |
| `phase_changed` | Server→Client | Phase transition |

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Implement your changes
4. Add tests if applicable
5. Submit a pull request

## 🌐 Deployment

### Deploy Backend to Railway

1. **Create Railway Account**: Go to [railway.app](https://railway.app) and sign up

2. **Deploy from GitHub**:
   ```bash
   # Push your code to GitHub first
   cd backend
   git init
   git add .
   git commit -m "Initial commit"
   ```

3. **In Railway Dashboard**:
   - Click "New Project" → "Deploy from GitHub Repo"
   - Select your repository
   - Railway auto-detects the Dockerfile
   - Your backend will be live at `https://your-app.railway.app`

4. **Set Environment Variables** (optional):
   - `ALLOWED_ORIGINS`: Your frontend URL (e.g., `https://werewolf.vercel.app`)

### Deploy Frontend to Vercel

1. **Create Vercel Account**: Go to [vercel.com](https://vercel.com) and sign up

2. **Deploy**:
   ```bash
   # Install Vercel CLI
   npm i -g vercel
   
   # Deploy
   cd frontend
   vercel
   ```

3. **Set Environment Variable**:
   - In Vercel Dashboard → Project Settings → Environment Variables
   - Add: `VITE_API_URL` = `https://your-backend.railway.app`

4. **Redeploy** to apply the environment variable:
   ```bash
   vercel --prod
   ```

### Quick Deploy Commands

```bash
# Backend (Railway)
cd backend
railway login
railway init
railway up

# Frontend (Vercel)  
cd frontend
vercel --prod
```

## 📄 License

MIT License - feel free to use this project for learning or as a base for your own game!
