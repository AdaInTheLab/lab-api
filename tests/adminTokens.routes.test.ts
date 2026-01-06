import request from "supertest";
import { createTestApp, api } from "./helpers/createTestApp.js";

describe("Admin token routes (with ADMIN_DEV_BYPASS)", () => {
    const prevEnv = process.env;

    beforeEach(() => {
        process.env = { ...prevEnv };
        process.env.NODE_ENV = "test";
        process.env.ADMIN_DEV_BYPASS = "true";
        process.env.TOKEN_PEPPER = "unit-test-pepper";
        delete process.env.API_PREFIX;
    });

    afterEach(() => {
        process.env = prevEnv;
    });

    test("POST /admin/tokens mints a token and returns raw token", async () => {
        const { app } = createTestApp();

        const res = await request(app)
            .post(api("/admin/tokens"))
            .send({ label: "CI", scopes: ["notes:write"] });

        expect([200, 201]).toContain(res.status);

        expect(res.body).toHaveProperty("ok", true);
        expect(res.body).toHaveProperty("data");

        expect(res.body.data).toHaveProperty("id");
        expect(res.body.data).toHaveProperty("token");

        expect(typeof res.body.data.id).toBe("string");
        expect(typeof res.body.data.token).toBe("string");
        expect(res.body.data.token.startsWith("hpl_")).toBe(true);
    });

    test("GET /admin/tokens lists tokens and does not return raw token", async () => {
        const { app } = createTestApp();

        const minted = await request(app)
            .post(api("/admin/tokens"))
            .send({ label: "Agent", scopes: ["notes:read"] });

        expect([200, 201]).toContain(minted.status);

        const mintedId = minted.body?.data?.id;
        expect(typeof mintedId).toBe("string");

        const list = await request(app).get(api("/admin/tokens"));
        expect(list.status).toBe(200);

        expect(list.body).toHaveProperty("ok", true);
        expect(Array.isArray(list.body.data)).toBe(true);

        const row = list.body.data.find((t: any) => t.id === mintedId);
        expect(row).toBeTruthy();
        expect(row.label).toBe("Agent");

        // never leak raw token in list
        expect(row.token).toBeUndefined();

        // scopes should be normalized onto the output rows
        if ("scopes" in row) {
            expect(Array.isArray(row.scopes)).toBe(true);
        }
    });

    test("POST /admin/tokens/:id/revoke disables token", async () => {
        const { app } = createTestApp();

        const minted = await request(app)
            .post(api("/admin/tokens"))
            .send({ label: "RevokeMe", scopes: ["notes:read"] });

        expect([200, 201]).toContain(minted.status);

        const mintedId = minted.body?.data?.id;
        expect(typeof mintedId).toBe("string");

        const revoke = await request(app).post(api(`/admin/tokens/${mintedId}/revoke`));
        expect(revoke.status).toBe(200);
        expect(revoke.body).toHaveProperty("ok", true);

        const list = await request(app).get(api("/admin/tokens"));
        expect(list.status).toBe(200);
        expect(list.body).toHaveProperty("ok", true);
        expect(Array.isArray(list.body.data)).toBe(true);

        const row = list.body.data.find((t: any) => t.id === mintedId);
        expect(row).toBeTruthy();

        if ("is_active" in row) expect(row.is_active).toBe(0);
    });

    test("POST /admin/tokens rejects missing label", async () => {
        const { app } = createTestApp();

        const res = await request(app)
            .post(api("/admin/tokens"))
            .send({ scopes: ["notes:write"] });

        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty("ok", false);
    });
});