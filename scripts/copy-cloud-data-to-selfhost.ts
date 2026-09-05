/**
 * Copy Cloud *data* (documents + files) onto the self-host project.
 * Schema/users are assumed to already exist from the earlier migration.
 *
 * Source: commented Cloud keys in .env.local (or CLOUD_APPWRITE_*).
 * Dest: current NEXT_PUBLIC_APPWRITE_* (self-host).
 *
 *   npx tsx scripts/copy-cloud-data-to-selfhost.ts
 */
import * as dotenv from "dotenv";
import * as fs from "fs";
import { Client, Databases, Storage, Query } from "node-appwrite";
import { InputFile } from "node-appwrite/file";

dotenv.config({ path: ".env.local" });

const CLOUD_PROD_PROJECT = "69b1b0640035b8ff70ef";

function parseCommentedCloud(): { endpoint: string; project: string; key: string } {
  const fromEnv = {
    endpoint: process.env.CLOUD_APPWRITE_ENDPOINT,
    project: process.env.CLOUD_APPWRITE_PROJECT,
    key: process.env.CLOUD_APPWRITE_KEY,
  };
  if (fromEnv.endpoint && fromEnv.project && fromEnv.key) {
    return fromEnv as { endpoint: string; project: string; key: string };
  }

  const text = fs.readFileSync(".env.local", "utf8");
  const block = text.split("# Cloud prod (rollback)")[1] || text;
  const projectMatch = block.match(
    /^#\s*NEXT_PUBLIC_APPWRITE_PROJECT=(69b1b0640035b8ff70ef)\s*$/m,
  );
  const keyMatch = block.match(/^#\s*NEXT_APPWRITE_KEY=(standard_[a-z0-9]+)\s*$/m);
  const endpointMatch = text.match(
    /^#\s*NEXT_PUBLIC_APPWRITE_ENDPOINT=(https:\/\/sgp\.cloud\.appwrite\.io\/v1)\s*$/m,
  );
  const project = projectMatch?.[1] || CLOUD_PROD_PROJECT;
  const key = keyMatch?.[1] || "";
  const endpoint = endpointMatch?.[1] || "https://sgp.cloud.appwrite.io/v1";
  if (!key) {
    throw new Error("Could not find Cloud prod API key in .env.local");
  }
  return { endpoint, project, key };
}

function client(endpoint: string, project: string, key: string) {
  return new Client().setEndpoint(endpoint).setProject(project).setKey(key);
}

function stripMeta(doc: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(doc)) {
    if (k.startsWith("$")) continue;
    out[k] = v;
  }
  return out;
}

async function copyDocuments(src: Databases, dst: Databases, databaseId: string) {
  const collections = await src.listCollections(databaseId, [Query.limit(100)]);
  console.log(`Collections: ${collections.collections.length} (total ${collections.total})`);

  for (const col of collections.collections) {
    let copied = 0;
    let skipped = 0;
    let failed = 0;
    let cursor: string | undefined;
    for (;;) {
      const page = await src.listDocuments(
        databaseId,
        col.$id,
        cursor
          ? [Query.limit(100), Query.cursorAfter(cursor)]
          : [Query.limit(100)],
      );
      if (!page.documents.length) break;
      for (const doc of page.documents) {
        const data = stripMeta(doc as unknown as Record<string, unknown>);
        try {
          await dst.createDocument(
            databaseId,
            col.$id,
            doc.$id,
            data,
            doc.$permissions,
          );
          copied++;
        } catch (err) {
          const code = (err as { code?: number }).code;
          if (code === 409) {
            skipped++;
          } else {
            failed++;
            if (failed <= 5) {
              const msg = err instanceof Error ? err.message : String(err);
              console.warn(`  ${col.$id}/${doc.$id}: ${msg}`);
            }
          }
        }
      }
      process.stdout.write(
        `\r  ${col.$id}: copied=${copied} skipped=${skipped} failed=${failed} / ${page.total}   `,
      );
      if (page.documents.length < 100) break;
      cursor = page.documents[page.documents.length - 1].$id;
    }
    console.log(
      `\r  ${col.$id}: copied=${copied} skipped=${skipped} failed=${failed}                    `,
    );
  }
}

async function copyFiles(
  src: Storage,
  dst: Storage,
  cloud: { endpoint: string; project: string; key: string },
) {
  const buckets = await src.listBuckets([Query.limit(100)]);
  console.log(`Buckets: ${buckets.buckets.length}`);

  for (const bucket of buckets.buckets) {
    try {
      await dst.getBucket(bucket.$id);
    } catch {
      console.warn(`  dest missing bucket ${bucket.$id} — skip files`);
      continue;
    }

    let copied = 0;
    let skipped = 0;
    let failed = 0;
    let cursor: string | undefined;
    for (;;) {
      const page = await src.listFiles(
        bucket.$id,
        cursor
          ? [Query.limit(100), Query.cursorAfter(cursor)]
          : [Query.limit(100)],
      );
      if (!page.files.length) break;
      for (const file of page.files) {
        try {
          const downloadUrl = `${cloud.endpoint}/storage/buckets/${bucket.$id}/files/${file.$id}/download`;
          const response = await fetch(downloadUrl, {
            headers: {
              "x-appwrite-project": cloud.project,
              "x-appwrite-key": cloud.key,
            },
          });
          if (!response.ok) {
            throw new Error(`download ${response.status} ${await response.text()}`);
          }
          const buffer = Buffer.from(await response.arrayBuffer());
          const input = InputFile.fromBuffer(buffer, file.name);
          await dst.createFile(bucket.$id, file.$id, input, file.$permissions);
          copied++;
        } catch (err) {
          const code = (err as { code?: number }).code;
          if (code === 409) {
            skipped++;
          } else {
            failed++;
            if (failed <= 8) {
              const msg = err instanceof Error ? err.message : String(err);
              console.warn(`  ${bucket.$id}/${file.$id} (${file.name}, ${file.sizeOriginal}b): ${msg}`);
            }
          }
        }
      }
      process.stdout.write(
        `\r  ${bucket.$id}: copied=${copied} skipped=${skipped} failed=${failed} / ${page.total}   `,
      );
      if (page.files.length < 100) break;
      cursor = page.files[page.files.length - 1].$id;
    }
    console.log(
      `\r  ${bucket.$id}: copied=${copied} skipped=${skipped} failed=${failed}                    `,
    );
  }
}

async function main() {
  const cloud = parseCommentedCloud();
  const destEndpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!;
  const destProject = process.env.NEXT_PUBLIC_APPWRITE_PROJECT!;
  const destKey = process.env.NEXT_APPWRITE_KEY!;
  const databaseId = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID || "fairlx";

  if (destEndpoint.includes("cloud.appwrite.io")) {
    throw new Error("Dest endpoint still points at Cloud. Aborting.");
  }

  console.log(`Cloud  ${cloud.endpoint} / ${cloud.project}`);
  console.log(`Self   ${destEndpoint} / ${destProject}`);
  console.log(`DB     ${databaseId}`);

  const srcDb = new Databases(client(cloud.endpoint, cloud.project, cloud.key));
  const dstDb = new Databases(client(destEndpoint, destProject, destKey));
  const srcSt = new Storage(client(cloud.endpoint, cloud.project, cloud.key));
  const dstSt = new Storage(client(destEndpoint, destProject, destKey));

  const skipDocs = process.env.SKIP_DOCUMENTS === "1";
  if (!skipDocs) {
    console.log("\n=== Documents ===");
    try {
      await copyDocuments(srcDb, dstDb, databaseId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`Documents blocked: ${msg}`);
      if (msg.includes("402") || msg.toLowerCase().includes("billing")) {
        console.error(
          "Cloud database reads are exhausted. Re-run after quota resets or after a plan upgrade:",
        );
        console.error("  npx tsx scripts/copy-cloud-data-to-selfhost.ts");
      }
    }
  } else {
    console.log("\n=== Documents === skipped (SKIP_DOCUMENTS=1)");
  }

  console.log("\n=== Files ===");
  await copyFiles(srcSt, dstSt, cloud);

  console.log("\nDone.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
