/** @type {import('jest').Config} */
module.exports = {
    testEnvironment: "node",

    // Make Jest treat TS files as ESM
    extensionsToTreatAsEsm: [".ts"],

    transform: {
        "^.+\\.ts$": ["ts-jest", { useESM: true, tsconfig: "./tsconfig.json" }],
    },

    moduleNameMapper: {
        // keep your existing "strip relative .js" helper
        "^(\\.{1,2}/.*)\\.js$": "$1",

        // ✅ map alias imports that end in .js to the TS source file
        "^@/(.*)\\.js$": "<rootDir>/src/$1.ts",

        // ✅ map alias imports without extension (or other)
        "^@/(.*)$": "<rootDir>/src/$1",
    },
};
