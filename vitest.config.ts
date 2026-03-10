import { defineConfig } from "vitest/config";
import react from "@testing-library/react";
import { resolve } from "path";

export default defineConfig({
    test: {
        globals: true,
        environment: "jsdom",
        setupFiles: ["./app/test/setup.ts"],
        include: ["app/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
        coverage: {
            reporter: ["text", "json", "html"],
            exclude: [
                "node_modules/",
                "app/test/",
                "**/*.d.ts",
                "**/*.config.*",
                "**/types/**",
            ],
        },
    },
    resolve: {
        alias: {
            "~": resolve(__dirname, "./app"),
        },
    },
});