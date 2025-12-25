/** @type {import('jest').Config} */
module.exports = {
    testEnvironment: "node",

    // Make Jest treat TS files as ESM
    extensionsToTreatAsEsm: [".ts"],

    transform: {
        "^.+\\.ts$": ["ts-jest", { useESM: true, tsconfig: "./tsconfig.json" }],
    },

    moduleNameMapper: {
        "^(\\.{1,2}/.*)\\.js$": "$1",
    },
};
