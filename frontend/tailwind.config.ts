import type { Config } from "tailwindcss"

const config = {
  darkMode: ["class"],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        main: "var(--main)",
        overlay: "rgba(0,0,0,0.8)",
        bg: "var(--bg)",
        bw: "var(--bw)",
        blank: "var(--blank)",
        border: "var(--border)",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        text: "var(--text)",
        ring: "hsl(var(--ring))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        void: '#000000',
        surface: '#0A0A0A',
        panel: '#111111',
        deep: '#1A1A1A',
        purple: '#9200E1',
        'purple-1': '#B75FFF',
        'purple-2': '#CB8AFF',
        'purple-3': '#D5A3FF',
        'purple-4': '#E3C1FF',
        'af-muted': '#4a4a5a',
        white: '#FEFEFE',
        gray: '#E5E5E5',
      },
      borderRadius: {
        base: "5px",
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      boxShadow: {
        light: "4px 4px 0px 0px #000",
        dark: "4px 4px 0px 0px #151515",
      },
      translate: {
        boxShadowX: "4px",
        boxShadowY: "4px",
        reverseBoxShadowX: "-4px",
        reverseBoxShadowY: "-4px",
      },
      fontWeight: {
        base: "500",
        heading: "700",
      },
      fontFamily: {
        sans: ['"Regola Pro"', "Inter", "sans-serif"],
        mono: ['"Geist Mono"', "monospace"],
        display: ['"Regola Pro"', '"Neue Haas Grotesk"', 'sans-serif'],
        body: ['"Regola Pro"', '"Neue Haas Grotesk"', 'sans-serif'],
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        blink: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0" },
        },
        gridDrift: { from: { transform: 'translateY(0)' }, to: { transform: 'translateY(80px)' } },
        blobFloat: { '0%,100%': { transform: 'translate(0,0) scale(1)' }, '50%': { transform: 'translate(20px,-15px) scale(1.04)' } },
        ticker: { from: { transform: 'translateX(0)' }, to: { transform: 'translateX(-50%)' } },
        marqueeScroll: { from: { transform: 'translateX(0)' }, to: { transform: 'translateX(-50%)' } },
        spinSlow: { from: { transform: 'rotate(0deg)' }, to: { transform: 'rotate(360deg)' } },
        spinSlower: { from: { transform: 'rotate(0deg)' }, to: { transform: 'rotate(360deg)' } },
        spinReverse: { from: { transform: 'rotate(0deg)' }, to: { transform: 'rotate(-360deg)' } },
        pulseGlow: { '0%,100%': { boxShadow: '0 0 20px rgba(146,0,225,0.4)' }, '50%': { boxShadow: '0 0 60px rgba(146,0,225,0.8)' } },
        fadeUp: { from: { opacity: '0', transform: 'translateY(28px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        blink: "blink 1.5s infinite",
        'grid-drift': 'gridDrift 25s linear infinite',
        'blob-float': 'blobFloat 8s ease-in-out infinite',
        ticker: 'ticker 35s linear infinite',
        'marquee-scroll': 'marqueeScroll 25s linear infinite',
        'spin-slow': 'spinSlow 5s linear infinite',
        'spin-slower': 'spinSlower 10s linear infinite',
        'spin-reverse': 'spinReverse 16s linear infinite',
        'spin-slowest': 'spinSlower 24s linear infinite',
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
        'fade-up': 'fadeUp 0.6s ease-out forwards',
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config

export default config
