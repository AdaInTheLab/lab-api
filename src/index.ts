// src/index.ts
import "./env.js";
import { createApp } from "./app.js";

const app = createApp();

/**
 * DreamHost Passenger:
 * - Passenger expects you to export the Express app.
 * - Passenger manages the port and the listening socket.
 * - If we call app.listen() in production, we can create a second server
 *   that is NOT the one handling web traffic, leading to confusing 404s.
 */
export default app;

// Local/dev only: run a standalone server when Passenger is not in charge.
const isTest = process.env.NODE_ENV === "test";
const isProd = process.env.NODE_ENV === "production";

if (!isTest && !isProd) {
    const port = Number(process.env.PORT) || 8001;
    app.listen(port, () => {
        console.log(`🏮 Lab API running on http://localhost:${port}`);
    });
}
