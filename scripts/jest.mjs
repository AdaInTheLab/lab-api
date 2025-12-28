import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";

process.env.NODE_ENV = "test";

const require = createRequire(import.meta.url);

// Resolve the actual jest executable regardless of CWD
const jestBin = require.resolve("jest/bin/jest.js");

const result = spawnSync(process.execPath, ["--experimental-vm-modules", jestBin, ...process.argv.slice(2)], {
    stdio: "inherit",
    env: process.env
});

process.exit(result.status ?? 1);
