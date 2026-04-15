/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        sky: {
          950: '#0a0e1a',
          900: '#0f1629',
          850: '#141d36',
          800: '#1a2744',
          700: '#243660',
          600: '#2e4a80',
          500: '#3b6cb5',
          400: '#5a9ce6',
          300: '#7cb8f2',
          200: '#a8d4fa',
          100: '#d4ecfd',
        },
        ember: {
          500: '#f97316',
          400: '#fb923c',
          300: '#fdba74',
        },
        gold: {
          500: '#eab308',
          400: '#facc15',
        },
      },
      fontFamily: {
        display: ['"Outfit"', 'sans-serif'],
        body: ['"DM Sans"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      animation: {
        'float': 'float 6s ease-in-out infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
        'slide-up': 'slideUp 0.5s ease-out',
        'fade-in': 'fadeIn 0.3s ease-out',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        glow: {
          '0%': { boxShadow: '0 0 20px rgba(59, 108, 181, 0.3)' },
          '100%': { boxShadow: '0 0 40px rgba(59, 108, 181, 0.6)' },
        },
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};
