// tests/jest.setup.ts

// Keep test URLs unprefixed unless a specific test overrides it.
delete process.env.API_PREFIX; // or: process.env.API_PREFIX = "";

// Make admin “configured” so unauthenticated calls return 401 instead of 403.
process.env.ADMIN_GITHUB_USERS ||= "ada";

process.env.NODE_ENV ||= "test";

