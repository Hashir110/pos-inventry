/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // Stitch & AsaanPOS Modern Retail Design Tokens
        primary: {
          DEFAULT: "#ea580c", // Action Orange
          hover: "#c2410c",
          active: "#9a3412",
          light: "#fff7ed",
          container: "#cc4900",
          "on-container": "#fffbff",
          fixed: "#ffdbce",
          "fixed-dim": "#ffb599",
        },
        surface: {
          DEFAULT: "#f8fafc", // Canvas background
          dim: "#e2e8f0",
          bright: "#ffffff",
          low: "#f1f5f9",
          container: "#ffffff",
          high: "#e2e8f0",
          highest: "#cbd5e1",
          lowest: "#ffffff",
          variant: "#e2e8f0",
        },
        "on-surface": {
          DEFAULT: "#0f172a", // Text primary
          variant: "#64748b", // Text muted
        },
        secondary: {
          DEFAULT: "#0f172a", // Slate Anchor
          50: "#f8fafc",
          100: "#f1f5f9",
          200: "#e2e8f0",
          300: "#cbd5e1",
          400: "#94a3b8",
          500: "#64748b",
          600: "#475569",
          700: "#334155",
          800: "#1e293b",
          900: "#0f172a",
          container: "#e2e8f0",
          "on-container": "#0f172a",
        },
        tertiary: {
          DEFAULT: "#16a34a", // Success / Cash In
          hover: "#15803d",
          light: "#f0fdf4",
          container: "#dcfce7",
          "on-container": "#14532d",
          fixed: "#bbf7d0",
          "on-fixed": "#052e16",
        },
        error: {
          DEFAULT: "#dc2626", // Danger / Return / Void
          hover: "#b91c1c",
          light: "#fef2f2",
          container: "#fee2e2",
          "on-container": "#7f1d1d",
        },
        warning: {
          DEFAULT: "#d97706", // Alert / Low Stock / Due
          hover: "#b45309",
          light: "#fffbeb",
          container: "#fef3c7",
          "on-container": "#78350f",
        },

        // Legacy compatibility
        brand: {
          50: "#fff6ec",
          100: "#ffe9d0",
          200: "#ffd2a1",
          300: "#ffb86f",
          400: "#ffa957",
          500: "#ea580c",
          600: "#c2410c",
          700: "#9a3412",
          800: "#7c2d12",
          900: "#431407",
          950: "#270b04",
        },
        ink: {
          DEFAULT: "#0f172a",
          800: "#1e293b",
          700: "#334155",
          600: "#475569",
        },
        canvas: "#f8fafc",
      },
      fontFamily: {
        sans: ["Inter", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["Inter", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "ui-sans-serif", "sans-serif"],
        urdu: ["Noto Sans Arabic", "system-ui", "sans-serif"],
      },
      borderRadius: {
        sm: "0.25rem", // 4px
        DEFAULT: "0.5rem", // 8px
        md: "0.5rem", // 8px
        lg: "0.75rem", // 12px
        xl: "1rem", // 16px
        "2xl": "1.25rem", // 20px
        full: "9999px",
      },
      boxShadow: {
        card: "0 1px 2px 0 rgba(15, 23, 42, 0.05)",
        pop: "0 10px 15px -3px rgba(15, 23, 42, 0.08), 0 4px 6px -4px rgba(15, 23, 42, 0.04)",
        dialog: "0 20px 25px -5px rgba(15, 23, 42, 0.12), 0 8px 10px -6px rgba(15, 23, 42, 0.04)",
      },
    },
  },
  plugins: [],
};
