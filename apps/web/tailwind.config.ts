import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-noto-sans)", "system-ui", "sans-serif"],
      },
      colors: {
        brand: {
          300: "#7c91ff",
          500: "#465fff",
          600: "#3641f5",
          800: "#1c2434",
        },
        dark: {
          900: "#111928",
        },
        tokyo: {
          red: "var(--color-red)",
          orange: "var(--color-orange)",
          yellow: "var(--color-yellow)",
          green: "var(--color-green)",
          teal: "var(--color-teal)",
          blue: "var(--color-blue)",
          magenta: "var(--color-magenta)",
          cyan: "var(--color-cyan)",
          night: "var(--bg-night)",
          storm: "var(--bg-storm)",
          panel: "var(--bg-panel)",
          sidebar: "var(--bg-sidebar)",
          fg: "var(--fg-editor)",
          variable: "var(--fg-variable)",
          comment: "var(--fg-comments)",
          border: "var(--border-terminal)",
        },
      },
      boxShadow: {
        "theme-xs": "0px 1px 2px 0px rgba(16, 24, 40, 0.05)",
      },
      animation: {
        "gradient-x": "gradient-x 3s ease infinite",
      },
      keyframes: {
        "gradient-x": {
          "0%, 100%": {
            "background-size": "200% 200%",
            "background-position": "left center",
          },
          "50%": {
            "background-size": "200% 200%",
            "background-position": "right center",
          },
        },
        "fade-in-up": {
          "0%": {
            opacity: "0",
            transform: "translateY(20px)",
          },
          "100%": {
            opacity: "1",
            transform: "translateY(0)",
          },
        },
      },
    },
  },
  plugins: [],
};

export default config;
