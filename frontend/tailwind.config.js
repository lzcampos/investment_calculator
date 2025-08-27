/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eaf9f2',
          100: '#d4f3e5',
          200: '#a9e7cb',
          300: '#7edbb1',
          400: '#53cf97',
          500: '#28c37d',
          600: '#209c64',
          700: '#18754b',
          800: '#104e32',
          900: '#082719',
        },
        ink: '#0f172a',
      },
    },
  },
  plugins: [],
}


