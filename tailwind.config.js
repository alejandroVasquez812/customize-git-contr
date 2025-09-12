/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./public/index.html"
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          light: '#60a5fa', // blue-400
          DEFAULT: '#2563eb', // blue-600
          dark: '#1e40af', // blue-800
        },
        card: 'rgba(255,255,255,0.05)',
        border: '#374151', // gray-700
        gradientFrom: '#111827', // gray-900
        gradientVia: '#1f2937', // gray-800
        gradientTo: '#374151', // gray-700
      },
      boxShadow: {
        card: '0 8px 32px 0 rgba(31, 41, 55, 0.37)',
      },
      borderRadius: {
        xl: '1.5rem',
        '3xl': '2rem',
      },
      fontFamily: {
        display: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
