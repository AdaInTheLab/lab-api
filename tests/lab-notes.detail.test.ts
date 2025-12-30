import request from "supertest";

import { createTestApp, api } from "./helpers/createTestApp.js";
const { app } = createTestApp();
describe("Lab Note detail", () => {
    it("GET /api/lab-notes/:slug returns a note with contentHtml", async () => {

        const res = await request(app).get(api("/lab-notes/api-marker-note"));

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
