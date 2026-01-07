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

    // ✅ add this
    setupFiles: ["<rootDir>/tests/jest.setup.ts"],

    moduleNameMapper: {
        "^@/(.*)$": path.join(__dirname, "src/$1"),
        "^(\\.{1,2}/.*)\\.js$": "$1",
    },
};

