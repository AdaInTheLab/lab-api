// jest.config.mjs
import { fileURLToPath } from "node:url";
import path from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default {
    testEnvironment: "node",
    testMatch: ["**/tests/**/*.test.ts"],
    extensionsToTreatAsEsm: [".ts"],
    transform: {
        "^.+\\.ts$": ["ts-jest", { useESM: true, tsconfig: "tsconfig.json" }],
    },

    moduleNameMapper: {
        // ✅ Path alias: "@/x" -> "<rootDir>/src/x"
        "^@/(.*)$": path.join(__dirname, "src/$1"),

        // ✅ ESM ".js" import fix (keep this)
        "^(\\.{1,2}/.*)\\.js$": "$1",
    },
};
