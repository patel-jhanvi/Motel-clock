// tailwind.config.ts
import type { Config } from "tailwindcss";

const config: Config = {
    theme: {
        extend: {
            colors: {
                brand: {
                    navy: "#1E3A8A",    // Deep navy blue – trust, strength
                    blue: "#2563EB",    // Accent blue – CTA, hover
                    light: "#F9FAFB",   // Soft gray-white background
                    gray: "#6B7280",    // Neutral gray for text
                    border: "#E5E7EB",  // Border gray
                },
                accent: {
                    yellow: "#FACC15",  // Warm highlight for alerts, More Time
                    beige: "#F5F5DC",   // Soft beige background or highlight
                },
            },
        },
    },
    plugins: [],
};
export default config;
