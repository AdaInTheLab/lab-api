import request from "supertest";
import { createTestApp, api } from "./helpers/createTestApp.js";
const { app } = createTestApp();
describe("Lab Notes contract", () => {
    it("GET /ap/lab-notes returns preview objects", async () => {

        const res = await request(app).get(api("/lab-notes"));
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);

        if (res.body.length > 0) {
            const n = res.body[0];

            // ✅ Internal identity (uuid / DB key)
            expect(n).toHaveProperty("id");
            expect(typeof n.id).toBe("string");
            expect(n.id.length).toBeGreaterThan(0);

            // ✅ Public identity for URLs
            expect(n).toHaveProperty("slug");
            expect(typeof n.slug).toBe("string");
            expect(n.slug.length).toBeGreaterThan(0);

            expect(n).toHaveProperty("title");
            expect(typeof n.title).toBe("string");

            // Preview fields
            expect(n).toHaveProperty("summary");
            expect(typeof n.summary).toBe("string");

            expect(n).toHaveProperty("tags");
            expect(Array.isArray(n.tags)).toBe(true);

            // Preview payload should not include HTML (or should be empty string if present)
            expect(n.contentHtml ?? "").toBe("");

            // Optional: helps catch regressions where slug/id get swapped again
            expect(n.slug).not.toBe(n.id);
        }
    });

    it("GET /lab-notes/:slug returns 404 for unknown slug", async () => {
        const res = await request(app).get("/lab-notes/definitely-not-a-real-slug");
        expect(res.status).toBe(404);
    });
});
