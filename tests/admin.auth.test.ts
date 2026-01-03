import request from "supertest";
import { createTestApp, api } from "./helpers/createTestApp.js";

// Make admin middleware "configured" for tests
process.env.ADMIN_GITHUB_USERS = "ada";

describe("Admin auth", () => {
    it("POST /admin/notes rejects unauthenticated", async () => {
        const { app } = createTestApp();
        const res = await request(app)
            .post(api("/admin/notes"))
            .send({ title: "Nope", slug: "nope", excerpt: "nope" });

        expect(res.status).toBe(401);
    });
});
