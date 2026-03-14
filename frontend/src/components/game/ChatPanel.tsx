import { useState, useRef, useEffect } from 'react';
import { useGameStore } from '../../store';

export default function ChatPanel() {
  const { gameState, playerId, chatMessages, send } = useGameStore();
  const [message, setMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  if (!gameState) return null;

  const isWerewolf = gameState.role?.role_type === 'werewolf';
  const isNight = gameState.phase === 'night';
  const canChat = gameState.is_alive || gameState.phase === 'game_over';

  const handleSend = () => {
    if (!message.trim() || !canChat) return;
    
    send('chat_message', { message: message.trim() });
    setMessage('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-700">
        <h3 className="font-bold text-gray-300">
          {isNight && isWerewolf ? '🐺 Pack Chat' : '💬 Chat'}
        </h3>
        {isNight && !isWerewolf && (
          <p className="text-xs text-gray-500 mt-1">Chat disabled during night</p>
        )}
        {isNight && isWerewolf && (
          <p className="text-xs text-red-400 mt-1">Only werewolves can see this</p>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {chatMessages.length === 0 && (
          <div className="text-center text-gray-500 text-sm py-8">
            No messages yet
          </div>
        )}
        
        {chatMessages.map((msg, index) => (
          <div
            key={index}
            className={`${
              msg.sender_id === playerId ? 'text-right' : ''
            }`}
          >
            <div
              className={`inline-block max-w-[80%] rounded-lg px-3 py-2 ${
                msg.sender_id === playerId
                  ? 'bg-werewolf-accent text-white'
                  : msg.is_werewolf_chat
                  ? 'bg-red-900/50 text-red-100'
                  : msg.is_dead
                  ? 'bg-gray-800 text-gray-400 italic'
                  : 'bg-werewolf-dark text-white'
              }`}
            >
              <div className="text-xs opacity-70 mb-1">
                {msg.sender_name}
                {msg.is_werewolf_chat && ' 🐺'}
                {msg.is_dead && ' 💀'}
              </div>
              <div className="text-sm">{msg.message}</div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-gray-700">
        {canChat && (!isNight || isWerewolf) ? (
          <div className="flex gap-2">
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={isNight ? "Message pack..." : "Type a message..."}
              className="input flex-1"
              maxLength={200}
            />
            <button
              onClick={handleSend}
              disabled={!message.trim()}
              className="btn btn-primary px-4"
            >
              Send
            </button>
          </div>
        ) : (
          <div className="text-center text-gray-500 text-sm">
            {!gameState.is_alive && gameState.phase !== 'game_over'
              ? "Dead players cannot chat"
              : "Chat disabled"}
          </div>
        )}
      </div>
    </div>
  );
}
