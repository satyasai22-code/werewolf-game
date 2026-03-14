import { Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import Lobby from './pages/Lobby'
import Game from './pages/Game'

function App() {
  return (
    <div className="min-h-screen">
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/lobby/:roomCode" element={<Lobby />} />
        <Route path="/game/:roomCode" element={<Game />} />
      </Routes>
    </div>
  )
}

export default App
