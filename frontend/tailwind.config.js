/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        werewolf: {
          dark: '#1a1a2e',
          darker: '#16213e',
          accent: '#e94560',
          gold: '#ffd700',
          blood: '#8b0000',
          moon: '#f5f5dc',
          forest: '#228b22',
        }
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        glow: {
          '0%': { boxShadow: '0 0 5px #e94560, 0 0 10px #e94560' },
          '100%': { boxShadow: '0 0 20px #e94560, 0 0 30px #e94560' },
        }
      }
    },
  },
  plugins: [],
}
