// src/index.ts
import { createApp } from "./app";

const app = createApp();
export default app;

const port = Number(process.env.PORT) || 8001;

// Don’t listen during tests
if (process.env.NODE_ENV !== "test") {
    app.listen(port, () => {
        console.log(`🏮 Lab API running on http://localhost:${port}`);
    });
}
