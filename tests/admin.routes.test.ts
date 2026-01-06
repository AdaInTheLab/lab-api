import request from "supertest";
import { createTestApp, api } from "./helpers/createTestApp.js";

describe("Admin routes", () => {
    const OLD_ENV = { ...process.env };

    beforeEach(() => {
        process.env = { ...OLD_ENV };

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

        test("POST /admin/notes returns 400 if title missing", async () => {
            const { app } = createTestApp();

            const res = await request(app).post(api("/admin/notes")).send({
                slug: "missing-title",
                locale: "en",
            });

            expect(res.status).toBe(400);
            expect(res.body?.error).toBe("title is required");
        });

        test("POST /admin/notes returns 400 if slug missing", async () => {
            const { app } = createTestApp();

            const res = await request(app).post(api("/admin/notes")).send({
                title: "Missing slug",
                locale: "en",
            });

            expect(res.status).toBe(400);
            expect(res.body?.error).toBe("slug is required");
        });

        test("POST /admin/notes creates a draft when not publishing", async () => {
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

        test("POST /admin/notes auto-fills published_at when publishing", async () => {
            const { app } = createTestApp();

            const res = await request(app).post(api("/admin/notes")).send({
                title: "Publish Me",
                slug: "publish-me",
                locale: "en",
                status: "published",
            });

            expect(res.status).toBe(201);

            const list = await request(app).get(api("/admin/notes"));
            expect(list.status).toBe(200);
            const note = list.body.find((n: any) => n.slug === "publish-me" && n.locale === "en");
            expect(note).toBeTruthy();
            expect(note.status).toBe("published");
            expect(note.published_at).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        });

        test("POST /admin/notes upserts by (slug, locale)", async () => {
            const { app } = createTestApp();

            await request(app).post(api("/admin/notes")).send({
                title: "Version 1",
                slug: "upsert-me",
                locale: "en",
                status: "draft",
                summary: "one",
            });

            await request(app).post(api("/admin/notes")).send({
                title: "Version 2",
                slug: "upsert-me",
                locale: "en",
                status: "draft",
                summary: "two",
            });

            const list = await request(app).get(api("/admin/notes"));
            const matches = list.body.filter((n: any) => n.slug === "upsert-me" && n.locale === "en");
            expect(matches.length).toBe(1);
            expect(matches[0].title).toBe("Version 2");
            expect(matches[0].summary).toBe("two");
        });
    });
});
