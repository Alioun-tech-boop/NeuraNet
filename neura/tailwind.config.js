/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        neura: {
          bg: '#090A0E',
          surface: '#111318',
          panel: '#151821',
          elevated: '#1B1F2A',
          border: '#1F242F',
          muted: '#6B7280',
          sub: '#9CA3AF',
          hi: '#F3F4F6',
          accent: '#6C7CFF',
          accentHover: '#818CF8',
        },
        ok: '#22C55E',
        err: '#EF4444',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        neura: '0 8px 32px rgba(0,0,0,0.45)',
        card: '0 1px 3px rgba(0,0,0,0.3)',
      },
    },
  },
  plugins: [],
};
