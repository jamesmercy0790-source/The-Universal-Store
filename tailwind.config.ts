import type { Config } from "tailwindcss";

// Brand tokens derived from the reference video: near-black ground, restrained
// gold/bronze accent, warm off-white type. Keep gold as an accent, not a fill —
// see Section 68 ("avoid excessive gold") in the architecture plan.
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#0a0908", // primary background
          900: "#121110",
          800: "#1c1a18",
          700: "#2a2724"
        },
        bone: {
          100: "#f6f3ee", // primary text on dark
          300: "#d8d2c7",
          500: "#9c9488"
        },
        brass: {
          400: "#d8b26a", // accent — links, active states, small highlights
          500: "#c69a4c", // primary accent — buttons, borders
          600: "#a37c37" // pressed/hover, deeper accent
        },
        signal: {
          success: "#4f9d69",
          warning: "#d9a441",
          danger: "#c25450"
        }
      },
      fontFamily: {
        display: ["var(--font-display)", "serif"],
        body: ["var(--font-body)", "sans-serif"]
      },
      borderRadius: {
        sm: "2px",
        md: "4px",
        lg: "8px"
      }
    }
  },
  plugins: []
};

export default config;
