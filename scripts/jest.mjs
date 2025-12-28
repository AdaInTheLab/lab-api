// scripts/jest.mjs
process.env.NODE_ENV = "test";

// Forward to Jest’s CLI entrypoint
import "../node_modules/jest/bin/jest.js";