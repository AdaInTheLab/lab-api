import request from "supertest";
import app from "../src/index.js";

describe("Lab Notes", () => {
    it("should return all notes", async () => {
        const res = await request(app).get("/lab-notes");

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);

        if (res.body.length > 0) {
            const note = res.body[0];

            // contract: id is the slug
            expect(note).toHaveProperty("id");
            expect(typeof note.id).toBe("string");

            expect(note).toHaveProperty("title");
            expect(typeof note.title).toBe("string");

            // preview fields (optional but valuable)
            expect(note).toHaveProperty("tags");
            expect(Array.isArray(note.tags)).toBe(true);

            // if you added summary in the mapper, assert it exists (can be empty string)
            expect(note).toHaveProperty("summary");
            expect(typeof note.summary).toBe("string");

            // list endpoint should not be required to return full content
            // (so we explicitly do NOT assert contentHtml is non-empty)
        }
    });
});
