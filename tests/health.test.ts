import request from "supertest";
import { createTestApp, api } from "./helpers/createTestApp.js";
const { app } = createTestApp();
describe("Health Check", () => {
    it("should return 200 and status ok", async () => {

        const res = await request(app).get(api("/health"))

        expect(res.status).toBe(200);
        expect(res.body.status).toBe("ok");
        expect(res.body.dbPath).toBeDefined();
    });
});
