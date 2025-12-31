// CommonJS shim so PM2 can "require" this file.
// It then bootstraps your real ESM app via dynamic import.
import("./dist/index.js").catch((err) => {
    console.error("Failed to start ESM app:", err);
    process.exit(1);
});
