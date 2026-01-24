#!/usr/bin/env tsx
/**
 * Quick utility to create a test Bearer token
 *
 * Requirements:
 * - API must be running on http://127.0.0.1:8001
 * - ADMIN_DEV_BYPASS=1 must be set (dev mode)
 *
 * Usage:
 *   npx tsx scripts/create-test-token.ts
 *
 * This will:
 * 1. Create a token via POST /admin/tokens
 * 2. Print the raw token (only shown once!)
 * 3. Show you how to use it with the CLI
 */

const API_BASE = "http://127.0.0.1:8001";

async function createTestToken() {
    console.log("🔑 Creating test Bearer token...\n");

    // In dev mode with ADMIN_DEV_BYPASS=1, we can call admin endpoints
    // The server will treat us as authenticated
    const response = await fetch(`${API_BASE}/admin/tokens`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            label: `CLI Test Token (${new Date().toISOString()})`,
            scopes: ["admin"],
            expires_at: null, // Never expires
        }),
    });

    if (!response.ok) {
        const text = await response.text();
        console.error("❌ Failed to create token:");
        console.error(`Status: ${response.status}`);
        console.error(`Response: ${text}`);
        console.error("\n💡 Make sure:");
        console.error("   1. API is running on http://127.0.0.1:8001");
        console.error("   2. ADMIN_DEV_BYPASS=1 is set in your .env");
        console.error("   3. You've restarted the API after changing .env");
        process.exit(1);
    }

    const result = await response.json();

    if (!result.ok || !result.data?.token) {
        console.error("❌ Unexpected response:", result);
        process.exit(1);
    }

    const token = result.data.token;
    const tokenId = result.data.id;

    console.log("✅ Token created successfully!\n");
    console.log("📋 Token Details:");
    console.log(`   ID: ${tokenId}`);
    console.log(`   Label: CLI Test Token`);
    console.log(`   Scopes: admin`);
    console.log(`   Expires: Never\n`);

    console.log("🔐 Your Bearer Token (save this!):");
    console.log(`   ${token}\n`);

    console.log("🚀 How to use with CLI:\n");
    console.log("   # Export as environment variable:");
    console.log(`   export HPL_TOKEN="${token}"`);
    console.log(`   export HPL_BASE_URL="${API_BASE}"\n`);

    console.log("   # Or add to ~/.humanpatternlab/hpl.json:");
    console.log(`   {`);
    console.log(`     "apiBaseUrl": "${API_BASE}",`);
    console.log(`     "token": "${token}"`);
    console.log(`   }\n`);

    console.log("   # Test it:");
    console.log(`   cd ../the-human-pattern-lab-cli`);
    console.log(`   npm run dev -- notes create --title "Test" --slug "test-$(date +%s)" --markdown "# Hello!"\n`);

    console.log("✨ Ready to test! 🦊");
}

createTestToken().catch((err) => {
    console.error("❌ Error:", err.message);
    process.exit(1);
});