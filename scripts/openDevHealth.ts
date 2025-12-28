// scripts/openDevHealth.ts
import http from "node:http";
import { exec } from "node:child_process";

const url = "http://localhost:8001/health";

function waitForServer(retries = 20) {
    http
        .get(url, () => {
            exec('start "" chrome --incognito ' + url);
        })
        .on("error", () => {
            if (retries <= 0) {
                console.error("Server did not start in time.");
                return;
            }
            setTimeout(() => waitForServer(retries - 1), 500);
        });
}

waitForServer();
