/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        film: {
          paper: '#F5F2EA',
          paperRaised: '#FFFCF6',
          ink: '#143238',
          teal: '#075E68',
          dark: '#071F24',
          card: '#0D2C33',
          border: '#1C424A',
          warm: '#D5A36A',
        },
        slate: {
          950: '#071F24',
          900: '#0D2C33',
          800: '#1C424A',
          700: '#315761',
        },
        amber: {
          200: '#F8E5C8',
          300: '#EBCB9F',
          400: '#E0B47E',
          500: '#D5A36A',
        },
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace']
      }
    },
  },
  plugins: [],
}
