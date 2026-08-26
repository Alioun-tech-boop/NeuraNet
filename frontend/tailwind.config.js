/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#07080B',
          900: '#0B0D11',
          850: '#0F1218',
          800: '#131720',
          750: '#171C26',
          700: '#1D2330',
        },
        line: '#21273333',
        hi: '#EDF0F4',
        mid: '#9AA3B0',
        low: '#5B6472',
        ok: '#3ECF8E',
        sem: '#7C8CF8',
        semdeep: '#5570F1',
        err: '#F0655A',
        warn: '#E0A83C',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      borderRadius: { xl2: '14px' },
    },
  },
  plugins: [],
};
