// tests/admin.routes.test.ts
import request from "supertest";
import { createTestApp, api } from "./helpers/createTestApp.js";

describe("Admin routes", () => {
    const OLD_ENV = { ...process.env };

    beforeEach(() => {
        // Reset env between tests
        process.env = { ...OLD_ENV };
        // ✅ OFF by default for all tests unless explicitly enabled
        delete process.env.ADMIN_DEV_BYPASS;
        // Ensure allowlist exists so we don't hit "Admin not configured"
        if (!(process.env.ADMIN_GITHUB_USERS ?? "").trim()) {
            process.env.ADMIN_GITHUB_USERS = "ada";
        }
    });

    afterEach(() => {
        process.env = { ...OLD_ENV };
    });

    test("GET /admin/notes returns 401 when unauthenticated", async () => {
        const { app } = createTestApp();

        const res = await request(app).get(api("/admin/notes"));
        expect(res.status).toBe(401);
        expect(res.body?.error).toBe("Unauthorized");
    });

    test("POST /admin/notes returns 401 when unauthenticated", async () => {
        const { app } = createTestApp();

        const res = await request(app).post(api("/admin/notes")).send({
            title: "X",
            slug: "x",
            locale: "en",
        });

        expect(res.status).toBe(401);
        expect(res.body?.error).toBe("Unauthorized");
    });

    describe("with ADMIN_DEV_BYPASS", () => {
        beforeEach(() => {
            process.env.ADMIN_DEV_BYPASS = "true";
            process.env.NODE_ENV = "test";
        });

        afterEach(() => {
            delete process.env.ADMIN_DEV_BYPASS;
        });

        test("POST /admin/notes returns 400 if title is missing", async () => {
            const { app } = createTestApp();

            const res = await request(app).post(api("/admin/notes")).send({
                slug: "missing-title",
                locale: "en",
            });

            expect(res.status).toBe(400);
            expect(res.body?.error).toBe("title is required");
        });

        test("POST /admin/notes returns 400 if slug is missing", async () => {
            const { app } = createTestApp();

            const res = await request(app).post(api("/admin/notes")).send({
                title: "Missing slug",
                locale: "en",
            });

            expect(res.status).toBe(400);
            expect(res.body?.error).toBe("slug is required");
        });

        test("POST /admin/notes creates a draft when published_at not provided", async () => {
            const { app } = createTestApp();

            const res = await request(app).post(api("/admin/notes")).send({
                title: "Draft Note",
                slug: "draft-note",
                locale: "en",
                status: "draft",
            });

            expect(res.status).toBe(201);

            const list = await request(app).get(api("/admin/notes"));
            expect(list.status).toBe(200);

            const note = list.body.find((n: any) => n.slug === "draft-note" && n.locale === "en");
            expect(note).toBeTruthy();
            expect(note.status).toBe("draft");
            expect(note.published_at).toBeNull();
        });
    });
});