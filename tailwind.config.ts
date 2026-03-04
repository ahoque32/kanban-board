import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx,js,jsx,mdx}"],
  theme: {
    extend: {
      boxShadow: {
        glass: "0 12px 40px -20px rgba(56, 189, 248, 0.45)",
      },
      borderRadius: {
        glass: "1.25rem",
      },
    },
  },
};

export default config;
