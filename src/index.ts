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

const isTest = process.env.NODE_ENV === "test";

// Passenger detection (these env vars are commonly present under Passenger)
const isPassenger =
    !!process.env.PASSENGER_APP_ENV ||
    !!process.env.PASSENGER_APP_ROOT ||
    !!process.env.PASSENGER_ENVIRONMENT ||
    !!process.env.PASSENGER_BASE_URI;

// If Passenger is NOT in charge (ex: PM2), we must listen — even in production.
if (!isTest && !isPassenger) {
    const port = Number(process.env.PORT) || 8001;
    const host = process.env.HOST || "127.0.0.1"; // use 0.0.0.0 if you need external access
    app.listen(port, host, () => {
        console.log(`🏮 Lab API listening on http://${host}:${port} (passenger=${isPassenger})`);
    });
}