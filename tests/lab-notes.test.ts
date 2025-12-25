import request from 'supertest';
import app from '../src/index';

describe('Lab Notes', () => {
    it('should return all notes', async () => {
        const res = await request(app).get('/api/lab-notes');
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        if (res.body.length > 0) {
            expect(res.body[0]).toHaveProperty('title');
            expect(res.body[0]).toHaveProperty('slug');
        }
    });
});