import request from "supertest";
import { createTestApp, api } from "./helpers/createTestApp.js"; // or wherever
const { app } = createTestApp();
describe("Lab Notes", () => {
    it("should return all notes", async () => {
        const res = await request(app).get(api("/lab-notes"));

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
    });
});
