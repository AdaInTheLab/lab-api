import request from "supertest";
import { createTestApp, api } from "./helpers/createTestApp.js";

describe("Lab Note detail", () => {
    it("GET /lab-notes/:slug returns a note with contentHtml", async () => {
        const { app } = createTestApp();

        const res = await request(app).get(api("/lab-notes/api-marker-note?locale=en"));
        expect(res.status).toBe(200);

        // URL identity
        expect(res.body).toHaveProperty("slug", "api-marker-note");

        // internal identity exists (don’t hardcode unless you truly want it stable)
        expect(res.body).toHaveProperty("id");
        expect(typeof res.body.id).toBe("string");

        expect(res.body).toHaveProperty("title");
        expect(typeof res.body.title).toBe("string");

        expect(res.body).toHaveProperty("contentHtml");
        expect(typeof res.body.contentHtml).toBe("string");
        expect(res.body.contentHtml.length).toBeGreaterThan(0);
    });
});
