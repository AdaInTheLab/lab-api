// tests/helpers/api.ts
export const API_PREFIX = process.env.API_PREFIX ?? "";
export const api = (path: string) =>
    `${API_PREFIX}${path.startsWith("/") ? path : `/${path}`}`;