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
      padding: { DEFAULT: "1.25rem", sm: "2rem", lg: "2.5rem" },
      screens: { "2xl": "1400px" },
    },
    extend: {
      colors: {
        // ── Token-driven (light + dark) ──
        background:           "hsl(var(--background))",
        foreground:           "hsl(var(--foreground))",
        surface:              "hsl(var(--surface))",
        "surface-raised":     "hsl(var(--surface-raised))",
        line:                 "hsl(var(--line))",
        ring:                 "hsl(var(--ring))",
        border:               "hsl(var(--border))",
        input:                "hsl(var(--input))",
        muted: {
          DEFAULT:            "hsl(var(--muted))",
          foreground:         "hsl(var(--muted-foreground))",
        },
        "muted-2":            "hsl(var(--muted-2))",
        card: {
          DEFAULT:            "hsl(var(--card))",
          foreground:         "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT:            "hsl(var(--popover))",
          foreground:         "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT:            "hsl(var(--primary))",
          foreground:         "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT:            "hsl(var(--secondary))",
          foreground:         "hsl(var(--secondary-foreground))",
        },
        accent: {
          DEFAULT:            "hsl(var(--accent))",
          foreground:         "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT:            "hsl(var(--destructive))",
          foreground:         "hsl(var(--destructive-foreground))",
        },

        // ── Backward-compat aliases so legacy bg-void/bg-panel/bg-deep keep rendering until swept ──
        void:     "hsl(var(--background))",
        panel:    "hsl(var(--surface-raised))",
        deep:     "hsl(var(--surface-raised))",
        "af-muted": "hsl(var(--muted-foreground))",
        blank:    "hsl(var(--surface))",
        bg:       "hsl(var(--background))",
        bw:       "hsl(var(--foreground))",
        main:     "hsl(var(--primary))",
        text:     "hsl(var(--foreground))",

        // ── 0G purple ramp (brand constant) ──
        purple: {
          DEFAULT: '#9200E1',
          50:  '#FAF2FF',
          100: '#F0DBFF',
          200: '#E3C1FF',
          300: '#D5A3FF',
          400: '#CB8AFF',
          500: '#B75FFF',
          600: '#9200E1',
          700: '#7300B3',
          800: '#560086',
          900: '#3A005B',
        },
      },
      borderRadius: {
        // iWallet-style large radii
        none:  "0",
        xs:    "8px",
        sm:    "12px",
        md:    "16px",
        DEFAULT: "16px",
        lg:    "20px",
        xl:    "24px",
        "2xl": "1.6rem",   // 25.6px — StatCard
        "3xl": "1.8rem",   // 28.8px — inner Panels
        "4xl": "2.2rem",   // 35.2px — AppShell hero header
        "5xl": "2.4rem",   // 38.4px — Hero outer card
        pill:  "9999px",
      },
      fontFamily: {
        sans:    ['"Satoshi-Variable"', 'Inter', 'system-ui', 'sans-serif'],
        display: ['"Satoshi-Variable"', 'Inter', 'system-ui', 'sans-serif'],
        body:    ['"Satoshi-Variable"', 'Inter', 'system-ui', 'sans-serif'],
        mono:    ['"Geist Mono"', 'monospace'],
      },
      letterSpacing: {
        "tightest": "-0.06em",
        "title":    "-0.035em",
        "eyebrow":  "0.18em",
      },
      keyframes: {
        "accordion-down": { from: { height: "0" }, to: { height: "var(--radix-accordion-content-height)" } },
        "accordion-up":   { from: { height: "var(--radix-accordion-content-height)" }, to: { height: "0" } },
        blink:    { "0%, 100%": { opacity: "1" }, "50%": { opacity: "0.3" } },
        marquee:  { from: { transform: "translateX(0)" }, to: { transform: "translateX(-50%)" } },
        "fade-up": { from: { opacity: "0", transform: "translateY(20px)" }, to: { opacity: "1", transform: "translateY(0)" } },
        shimmer:  { from: { backgroundPosition: "-200% 0" }, to: { backgroundPosition: "200% 0" } },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up":   "accordion-up 0.2s ease-out",
        blink:    "blink 1.6s ease-in-out infinite",
        marquee:  "marquee 35s linear infinite",
        "fade-up": "fade-up 0.7s cubic-bezier(0.22,1,0.36,1) forwards",
        shimmer:  "shimmer 2.2s linear infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config

export default config
