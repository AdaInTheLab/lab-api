import request from "supertest";
import app from "../src/index.js";

describe("Lab Notes contract", () => {
    it("GET /api/lab-notes returns preview objects", async () => {
        const res = await request(app).get("/api/lab-notes");
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);

        if (res.body.length > 0) {
            const n = res.body[0];

            expect(n).toHaveProperty("id");
            expect(typeof n.id).toBe("string");

            expect(n).toHaveProperty("title");
            expect(typeof n.title).toBe("string");

            // Preview fields
            expect(n).toHaveProperty("summary");
            expect(typeof n.summary).toBe("string");

            expect(n).toHaveProperty("tags");
            expect(Array.isArray(n.tags)).toBe(true);

            expect(n.contentHtml ?? "").toBe(""); // if present, should be empty
        }
    });

    it("GET /api/lab-notes/:slug returns 404 for unknown slug", async () => {
        const res = await request(app).get("/api/lab-notes/definitely-not-a-real-slug");
        expect(res.status).toBe(404);
    });
});
