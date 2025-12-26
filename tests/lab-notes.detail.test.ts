import request from "supertest";
import app from "../src/index.js";

describe("Lab Note detail", () => {
    it("GET /lab-notes/:slug returns a note with contentHtml", async () => {
        const res = await request(app).get("/lab-notes/api-marker-note");

        expect(res.status).toBe(200);

        // ✅ NEW: id is uuid/internal
        expect(res.body).toHaveProperty("id", "api-marker");

        // ✅ NEW: slug is URL identity
        expect(res.body).toHaveProperty("slug", "api-marker-note");

        expect(res.body).toHaveProperty("title");
        expect(typeof res.body.title).toBe("string");

        expect(res.body).toHaveProperty("contentHtml");
        expect(typeof res.body.contentHtml).toBe("string");
        expect(res.body.contentHtml.length).toBeGreaterThan(0);
    });

});
