import type { Config } from 'tailwindcss';
import animate from 'tailwindcss-animate';

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: { '2xl': '1440px' },
    },
    extend: {
      colors: {
        bg: 'hsl(var(--bg))',
        surface: {
          DEFAULT: 'hsl(var(--surface))',
          2: 'hsl(var(--surface-2))',
        },
        border: {
          DEFAULT: 'hsl(var(--border))',
          strong: 'hsl(var(--border-strong))',
        },
        ol: {
          blue: 'hsl(var(--ol-blue))',
          'blue-bright': 'hsl(var(--ol-blue-bright))',
          red: 'hsl(var(--ol-red))',
          'red-bright': 'hsl(var(--ol-red-bright))',
        },
        fg: {
          DEFAULT: 'hsl(var(--fg))',
          muted: 'hsl(var(--fg-muted))',
          dim: 'hsl(var(--fg-dim))',
          bright: 'hsl(var(--fg-bright))',
        },
        win: 'hsl(var(--win))',
        draw: 'hsl(var(--draw))',
        loss: 'hsl(var(--loss))',
        live: 'hsl(var(--live))',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Manrope', 'Inter', 'sans-serif'],
        mono: ['"Geist Mono"', '"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        'display-xl': ['96px', { lineHeight: '1', letterSpacing: '-0.02em' }],
        'display-lg': ['56px', { lineHeight: '1.05', letterSpacing: '-0.015em' }],
        'display-md': ['32px', { lineHeight: '1.1', letterSpacing: '-0.01em' }],
      },
      borderRadius: {
        sm: '4px',
        DEFAULT: '6px',
        md: '8px',
      },
      keyframes: {
        'pulse-live': {
          '0%, 100%': { opacity: '1', boxShadow: '0 0 0 0 rgba(239, 68, 68, 0.6)' },
          '50%': { opacity: '0.85', boxShadow: '0 0 0 6px rgba(239, 68, 68, 0)' },
        },
      },
      animation: {
        'pulse-live': 'pulse-live 1.6s ease-in-out infinite',
      },
    },
  },
  plugins: [animate],
} satisfies Config;
