module.exports = {
  content: ['./src/**/*.{html,ts,scss}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0fdfa',
          100: '#ccfbf1',
          200: '#99f6e4',
          300: '#5eead4',
          400: '#2dd4bf',
          500: '#14b8a6',
          600: '#0d9488',
          700: '#0f766e',
          800: '#115e59',
          900: '#134e4a'
        },
        ink: {
          850: '#172554',
          900: '#0f172a',
          950: '#020617'
        }
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', 'sans-serif']
      },
      boxShadow: {
        soft: '0 22px 60px -28px rgba(15, 23, 42, 0.28)',
        panel: '0 1px 0 rgba(15, 23, 42, 0.06), 0 18px 48px -32px rgba(15, 23, 42, 0.2)'
      }
    }
  },
  plugins: [],
};
