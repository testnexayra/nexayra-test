/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        // Lato is the default body font
        body: ["var(--font-lato)", "system-ui", "sans-serif"],
        sans: ["var(--font-lato)", "system-ui", "sans-serif"],
        // Poppins for display / headings (alias `font-display`, `font-heading`, `font-poppins`)
        display: ["var(--font-poppins)", "system-ui", "sans-serif"],
        heading: ["var(--font-poppins)", "system-ui", "sans-serif"],
        poppins: ["var(--font-poppins)", "system-ui", "sans-serif"],
        lato: ["var(--font-lato)", "system-ui", "sans-serif"],
      },
      colors: {
        // Brand navy — full scale, defined as CSS variables so we can theme dark mode
        navy: {
          DEFAULT: "rgb(var(--c-navy) / <alpha-value>)",
          50: "rgb(var(--c-navy-50) / <alpha-value>)",
          100: "rgb(var(--c-navy-100) / <alpha-value>)",
          200: "rgb(var(--c-navy-200) / <alpha-value>)",
          300: "rgb(var(--c-navy-300) / <alpha-value>)",
          400: "rgb(var(--c-navy-400) / <alpha-value>)",
          500: "rgb(var(--c-navy-500) / <alpha-value>)",
          600: "rgb(var(--c-navy-600) / <alpha-value>)",
          700: "rgb(var(--c-navy-700) / <alpha-value>)",
          800: "rgb(var(--c-navy-800) / <alpha-value>)",
          900: "rgb(var(--c-navy-900) / <alpha-value>)",
        },
        // Brand gold — also CSS-variable driven for dark mode tweaking
        gold: {
          DEFAULT: "rgb(var(--c-gold) / <alpha-value>)",
          50: "rgb(var(--c-gold-50) / <alpha-value>)",
          100: "rgb(var(--c-gold-100) / <alpha-value>)",
          200: "rgb(var(--c-gold-200) / <alpha-value>)",
          300: "rgb(var(--c-gold-300) / <alpha-value>)",
          400: "rgb(var(--c-gold-400) / <alpha-value>)",
          500: "rgb(var(--c-gold-500) / <alpha-value>)",
          600: "rgb(var(--c-gold-600) / <alpha-value>)",
          700: "rgb(var(--c-gold-700) / <alpha-value>)",
        },
        slate: {
    DEFAULT: "rgb(var(--c-slate) / <alpha-value>)",
    50:  "rgb(var(--c-slate-50) / <alpha-value>)",
    100: "rgb(var(--c-slate-100) / <alpha-value>)",
    200: "rgb(var(--c-slate-200) / <alpha-value>)",
    300: "rgb(var(--c-slate-300) / <alpha-value>)",
    400: "rgb(var(--c-slate-400) / <alpha-value>)",
    500: "rgb(var(--c-slate-500) / <alpha-value>)",
  },
        // Semantic tokens — use these instead of hardcoded white/navy where possible
        bg:        "rgb(var(--c-bg) / <alpha-value>)",
        fg:        "rgb(var(--c-fg) / <alpha-value>)",
        surface:   "rgb(var(--c-surface) / <alpha-value>)",
        "surface-2": "rgb(var(--c-surface-2) / <alpha-value>)",
        border:    "rgb(var(--c-border) / <alpha-value>)",
        muted:     "rgb(var(--c-muted) / <alpha-value>)",
      },
      animation: {
        "fade-in-up": "fadeInUp 0.4s ease-out forwards",
        "fade-in":    "fadeIn 0.3s ease-out forwards",
      },
      keyframes: {
        fadeInUp: {
          "0%":   { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        fadeIn: {
          "0%":   { opacity: "0" },
          "100%": { opacity: "1" },
        },
      },
    },
  },
  plugins: [],
};