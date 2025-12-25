import request from "supertest";
import app from "../src/index.js";

describe("Admin auth", () => {
    it("POST /api/admin/notes rejects unauthenticated", async () => {
        const res = await request(app)
            .post("/api/admin/notes")
            .send({ title: "Nope", slug: "nope", excerpt: "nope" });

        expect(res.status).toBe(401);
    });
});
