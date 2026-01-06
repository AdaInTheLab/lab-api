// tests/requireAdmin.http.test.ts
import request from "supertest";
import { createTestApp, api } from "./helpers/createTestApp.js";

describe("requireAdmin (integration via routes)", () => {
    const prevEnv = process.env;

    beforeEach(() => {
        process.env = { ...prevEnv };
        process.env.NODE_ENV = "test";
        delete process.env.API_PREFIX;
        // createTestApp sets ADMIN_GITHUB_USERS="ada" if missing
    });

    afterEach(() => {
        process.env = prevEnv;
    });

    test("401 when bypass off and unauthenticated (admin route)", async () => {
        delete process.env.ADMIN_DEV_BYPASS; // bypass OFF
        const { app } = createTestApp();

        const res = await request(app).get(api("/admin/notes"));
        expect(res.status).toBe(401);
    });

    test("200 when bypass on (admin route)", async () => {
        process.env.ADMIN_DEV_BYPASS = "true";
        const { app } = createTestApp();

        const res = await request(app).get(api("/admin/notes"));
        expect(res.status).toBe(200);
    });
});
