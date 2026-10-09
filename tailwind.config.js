/** @type {import('tailwindcss').Config} */
export default {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // Brand: Dreams POS wala orange (#FE9F43) — buttons, active menu, links
        brand: {
          50: "#fff6ec",
          100: "#ffe9d0",
          200: "#ffd2a1",
          300: "#ffb86f",
          400: "#ffa957",
          500: "#fe9f43",
          600: "#f08a24",
          700: "#cc6f12",
          800: "#9f560f",
          900: "#7a4310",
          950: "#452306",
        },
        // Navy: dark buttons, login panel
        ink: {
          DEFAULT: "#092c4c",
          800: "#0f3a63",
          700: "#1b4a78",
          600: "#2c5d8f",
        },
        // Page background
        canvas: "#f7f7f7",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "var(--font-sans)", "ui-sans-serif", "sans-serif"],
      },
      // Dreams POS ke chhote, seedhe corners
      borderRadius: {
        lg: "6px",
        xl: "8px",
        "2xl": "10px",
        "3xl": "14px",
      },
      boxShadow: {
        card: "0 1px 2px rgba(33, 43, 54, 0.04)",
        pop: "0 8px 24px -8px rgba(33, 43, 54, 0.22)",
      },
    },
  },
  plugins: [],
};
