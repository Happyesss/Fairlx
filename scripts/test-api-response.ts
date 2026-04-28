import app from "../src/features/usage/server/route";
import { Client, Databases } from "node-appwrite";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

async function run() {
    const res = await app.request("/dashboard?organizationId=69d2d018001d4f886254&period=2026-04", {
        method: "GET",
    });
    
    const json = await res.json();
    console.log("Dashboard Summary:", JSON.stringify(json.data.summary, null, 2));
    console.log("Daily Usage Sample:", JSON.stringify(json.data.summary.dailyUsage.slice(0, 5), null, 2));
}
run();
