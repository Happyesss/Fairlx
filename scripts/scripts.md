# Developing and Running Scripts in Fairlx

This directory contains standalone TypeScript scripts used for database initialization, data migrations, testing queries, and performing batch operations. 

Since the project uses TypeScript, we use [`tsx`](https://github.com/privatenumber/tsx) to execute these scripts directly without needing a separate compilation step.

## How to Create a New Script

### 1. Basic Template

When creating a new script, you need to set up your environment variables first, then initialize the Appwrite client. Here is a boilerplate template you can copy to start any new script:

```typescript
// scripts/my-new-script.ts

// 1. Load environment variables from .env.local
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

// 2. Import node-appwrite (Server SDK)
import { Client, Databases, Query } from "node-appwrite";

// 3. Initialize the Appwrite Client using Admin Key
const client = new Client()
    .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
    .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT!)
    .setKey(process.env.NEXT_APPWRITE_KEY!); // Admin key for full access

// 4. Initialize services you need (e.g., Databases, Users, Storage)
const databases = new Databases(client);

// 5. Main execution function
async function run() {
    const dbId = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID || "fairlx";
    
    // Example: Reference a specific collection ID from env vars
    // const workspacesId = process.env.NEXT_PUBLIC_APPWRITE_WORKSPACES_ID || "workspaces";
    
    console.log("Starting script...");
    
    // Your logic here...
    
    console.log("Script completed successfully!");
}

// 6. Execute and handle errors
run().catch((error) => {
    console.error("Script failed:", error);
    process.exit(1);
});
```

### 2. Environment Variables

Always include `dotenv.config({ path: ".env.local" })` at the very top of your script (before any other imports). This ensures your script runs with the exact same configuration as your local Next.js application, including your specific Appwrite endpoints and API keys.

### 3. Appwrite SDK

Make sure to import from `node-appwrite` (the server-side SDK), **not** `appwrite` (the client-side SDK). 
The server SDK uses the `NEXT_APPWRITE_KEY` which grants admin privileges, bypassing standard permissions. This is necessary for migration and administrative scripts to have full read/write access to the database.

## Initializing the Database

If you want to completely initialize your database environment, you only need to run a single command from the root of the project:

```bash
npm run db:setup
```

This single command handles everything at once, including:
- **Checking Health & Status:** Verifies the connection and status of your Appwrite instance.
- **Permissions:** Configures correct default read/write permissions for all collections.
- **Initialization & Migrations:** Creates all necessary databases and collections, and applies required schema changes if any migrations are needed.
- **Storage Buckets:** Creates and configures the required storage buckets (Images, Attachments, Project Documents, etc.).
- **Messaging:** Configures Appwrite messaging topics and SMTP provider references.
- **Testing:** Runs internal checks to ensure everything was created successfully.

You generally only need to run this command when setting up the project for the first time or if the underlying database schema has been updated by the team.

## How to Run a Custom Script

To run your script, use `tsx` via `npx` from the root of the project:

```bash
npx tsx scripts/my-new-script.ts
```

If you are dealing with large datasets or heavy migrations and run into memory limits, you can pass additional Node options to increase memory allocation:

```bash
NODE_OPTIONS='--max-old-space-size=8192' npx tsx scripts/my-new-script.ts
```

## Best Practices

1. **Idempotency:** Try to write your scripts so they can be run multiple times safely without creating duplicate data or breaking state (e.g., check if a document exists before creating it).
2. **Batching:** When processing many documents, use `Query.limit()` and `Query.cursorAfter()` to batch process records instead of loading everything into memory at once.
3. **Helper Libraries:** Before writing complex setup logic from scratch, check the `scripts/lib/` or `scripts/database-initialization/lib/` directories for reusable helpers (e.g., logging, database wrappers).
