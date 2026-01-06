import request from "supertest";
import { createTestApp, api } from "./helpers/createTestApp.js";

describe("Auth routes", () => {

    beforeEach(() => {
        process.env.ADMIN_DEV_BYPASS = "true";
    })

    test("GET /auth/me returns 401 + user:null when unauthenticated", async () => {
        const { app } = createTestApp();

        const res = await request(app).get(api("/auth/me"));
        expect(res.status).toBe(401);
        expect(res.body).toEqual({ user: null });
    });

    test("POST /auth/logout always returns ok:true", async () => {
        const { app } = createTestApp();

        const res = await request(app).post(api("/auth/logout"));
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ ok: true });
    });

    test("GET /github/status returns enabled boolean", async () => {
        const { app } = createTestApp();

        const res = await request(app).get(api("/github/status"));
        expect(res.status).toBe(200);
        expect(typeof res.body?.enabled).toBe("boolean");
    });
});
