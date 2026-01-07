// tests/helpers/api.ts
export const api = (p: string) => {
    if (process.env.NODE_ENV === "test") {
        return p.startsWith("/") ? p : `/${p}`;
    }
    const prefix = process.env.API_PREFIX ?? "";
    return `${prefix}${p.startsWith("/") ? p : `/${p}`}`;
};
