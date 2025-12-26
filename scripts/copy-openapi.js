// scripts/copy-openapi.js
import fs from "fs";
import path from "path";

const src = "openapi";
const dest = path.join("dist", "openapi");

if (fs.existsSync(src)) {
    fs.mkdirSync(dest, { recursive: true });
    fs.cpSync(src, dest, { recursive: true });
    console.log("✅ OpenAPI spec copied");
} else {
    console.log("ℹ️ No OpenAPI spec to copy");
}
