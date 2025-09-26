import type { Config } from "tailwindcss";

const config: Config = {
    content: [
        "./app/**/*.{js,ts,jsx,tsx}",
        "./components/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                "brand-blue": "#002B5C",
                "brand-accent": "#FACC15",
            },
        },
    },
    plugins: [],
};
export default config;
