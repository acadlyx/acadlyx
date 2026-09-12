import type { Config } from "tailwindcss";

/**
 * Institution branding is applied at runtime via CSS variables
 * (see globals.css) so white-labeling later doesn't require
 * touching this config. Extend here only with structural tokens.
 */
const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        "acadlyx-primary": "var(--acadlyx-primary)",
        "acadlyx-secondary": "var(--acadlyx-secondary)",
      },
    },
  },
  plugins: [],
};

export default config;
