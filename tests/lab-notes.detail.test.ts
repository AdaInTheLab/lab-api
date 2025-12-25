import request from "supertest";
import app from "../src/index.js";

describe("Lab Note detail", () => {
    it("GET /api/lab-notes/:slug returns a note with contentHtml", async () => {
        // You seed "api-marker-note" in the API — perfect stable fixture
        const res = await request(app).get("/api/lab-notes/api-marker-note");
        expect(res.status).toBe(200);

        expect(res.body).toHaveProperty("id", "api-marker-note");
        expect(res.body).toHaveProperty("title");
        expect(typeof res.body.title).toBe("string");

        // Detail includes contentHtml (even if it's excerpt-based right now)
        expect(res.body).toHaveProperty("contentHtml");
        expect(typeof res.body.contentHtml).toBe("string");
        expect(res.body.contentHtml.length).toBeGreaterThan(0);

        expect(res.body).toHaveProperty("tags");
        expect(Array.isArray(res.body.tags)).toBe(true);
    });
});
