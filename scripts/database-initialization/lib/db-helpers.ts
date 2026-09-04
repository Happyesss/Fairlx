import { Databases, IndexType, type Models } from 'node-appwrite';
import { logger } from './logger';

/** Sleep helper for rate limiting */
export function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Check if an error is an Appwrite "already exists" or "not found" error */
function isAppwriteError(err: unknown, code: number): boolean {
    if (err && typeof err === 'object' && 'code' in err) {
        return (err as { code: number }).code === code;
    }
    return false;
}

export function errorMessage(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
}

/** Appwrite attributes stay in processing for a few seconds after create. */
export function isAttributeNotReady(err: unknown): boolean {
    const message = errorMessage(err);
    return (
        /not yet available/i.test(message) ||
        /still processing/i.test(message) ||
        /attribute .+ is not available/i.test(message)
    );
}

export async function waitForAttributesAvailable(
    databases: Databases,
    databaseId: string,
    collectionId: string,
    keys: string[],
    timeoutMs = 45_000,
): Promise<void> {
    if (!keys.length) return;
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
        const statuses = await Promise.all(
            keys.map(async (key) => {
                try {
                    const attr = await databases.getAttribute(databaseId, collectionId, key);
                    return String((attr as { status?: string }).status || "available");
                } catch {
                    return "missing";
                }
            }),
        );
        if (statuses.every((status) => status === "available")) return;
        await sleep(1500);
    }
    logger.info(`Timed out waiting for attributes in ${collectionId}: ${keys.join(", ")}`);
}

// ─── Database ────────────────────────────────────────────────

export async function ensureDatabase(
    databases: Databases,
    databaseId: string,
    name: string
): Promise<void> {
    try {
        await databases.get(databaseId);
        logger.skipped('database', name);
    } catch (err) {
        if (isAppwriteError(err, 404)) {
            try {
                await databases.create(databaseId, name);
                logger.created('database', name);
                await sleep(300);
            } catch (createErr) {
                if (isAppwriteError(createErr, 409)) {
                    logger.skipped('database', name);
                } else {
                    logger.error('database', name, createErr);
                    throw createErr;
                }
            }
        } else {
            logger.error('database', name, err);
            throw err;
        }
    }
}

// ─── Collection ──────────────────────────────────────────────

export async function ensureCollection(
    databases: Databases,
    databaseId: string,
    collectionId: string,
    name: string,
    permissions?: string[]
): Promise<void> {
    try {
        await databases.getCollection(databaseId, collectionId);
        // Important: Update permissions even if collection exists
        if (permissions) {
            await databases.updateCollection(databaseId, collectionId, name, permissions);
            logger.updated('collection permissions', name);
        } else {
            logger.skipped('collection', name);
        }
    } catch (err) {
        if (isAppwriteError(err, 404)) {
            try {
                await databases.createCollection(
                    databaseId,
                    collectionId,
                    name,
                    permissions,
                    undefined, // documentSecurity
                    true       // enabled
                );
                logger.created('collection', name);
                await sleep(300);
            } catch (createErr) {
                if (isAppwriteError(createErr, 409)) {
                    logger.skipped('collection', name);
                } else {
                    logger.error('collection', name, createErr);
                    throw createErr;
                }
            }
        } else {
            logger.error('collection', name, err);
            throw err;
        }
    }
}

// ─── String Attribute ────────────────────────────────────────

export async function ensureStringAttribute(
    databases: Databases,
    databaseId: string,
    collectionId: string,
    key: string,
    size: number,
    required: boolean,
    defaultValue?: string,
    array: boolean = false
): Promise<void> {
    try {
        await databases.getAttribute(databaseId, collectionId, key);
        logger.skipped('attribute', key);
    } catch (err) {
        if (isAppwriteError(err, 404)) {
            try {
                await databases.createStringAttribute(
                    databaseId,
                    collectionId,
                    key,
                    size,
                    required,
                    defaultValue ?? undefined,
                    array,
                    false // encrypt
                );
                logger.created('attribute', key);
                await sleep(200);
            } catch (createErr) {
                if (isAppwriteError(createErr, 409)) {
                    logger.skipped('attribute', key);
                } else {
                    logger.error('attribute', key, createErr);
                }
            }
        } else {
            logger.error('attribute', key, err);
        }
    }
}

// ─── Integer Attribute ───────────────────────────────────────

export async function ensureIntegerAttribute(
    databases: Databases,
    databaseId: string,
    collectionId: string,
    key: string,
    required: boolean,
    defaultValue?: number,
    min?: number,
    max?: number,
    array: boolean = false
): Promise<void> {
    try {
        await databases.getAttribute(databaseId, collectionId, key);
        logger.skipped('attribute', key);
    } catch (err) {
        if (isAppwriteError(err, 404)) {
            try {
                await databases.createIntegerAttribute(
                    databaseId,
                    collectionId,
                    key,
                    required,
                    min,
                    max,
                    defaultValue,
                    array
                );
                logger.created('attribute', key);
                await sleep(200);
            } catch (createErr) {
                if (isAppwriteError(createErr, 409)) {
                    logger.skipped('attribute', key);
                } else {
                    logger.error('attribute', key, createErr);
                }
            }
        } else {
            logger.error('attribute', key, err);
        }
    }
}

// ─── Float Attribute ─────────────────────────────────────────

export async function ensureFloatAttribute(
    databases: Databases,
    databaseId: string,
    collectionId: string,
    key: string,
    required: boolean,
    defaultValue?: number,
    min?: number,
    max?: number,
    array: boolean = false
): Promise<void> {
    try {
        await databases.getAttribute(databaseId, collectionId, key);
        logger.skipped('attribute', key);
    } catch (err) {
        if (isAppwriteError(err, 404)) {
            try {
                await databases.createFloatAttribute(
                    databaseId,
                    collectionId,
                    key,
                    required,
                    min,
                    max,
                    defaultValue,
                    array
                );
                logger.created('attribute', key);
                await sleep(200);
            } catch (createErr) {
                if (isAppwriteError(createErr, 409)) {
                    logger.skipped('attribute', key);
                } else {
                    logger.error('attribute', key, createErr);
                }
            }
        } else {
            logger.error('attribute', key, err);
        }
    }
}

// ─── Boolean Attribute ───────────────────────────────────────

export async function ensureBooleanAttribute(
    databases: Databases,
    databaseId: string,
    collectionId: string,
    key: string,
    required: boolean,
    defaultValue?: boolean,
    array: boolean = false
): Promise<void> {
    try {
        await databases.getAttribute(databaseId, collectionId, key);
        logger.skipped('attribute', key);
    } catch (err) {
        if (isAppwriteError(err, 404)) {
            try {
                await databases.createBooleanAttribute(
                    databaseId,
                    collectionId,
                    key,
                    required,
                    defaultValue,
                    array
                );
                logger.created('attribute', key);
                await sleep(200);
            } catch (createErr) {
                if (isAppwriteError(createErr, 409)) {
                    logger.skipped('attribute', key);
                } else {
                    logger.error('attribute', key, createErr);
                }
            }
        } else {
            logger.error('attribute', key, err);
        }
    }
}

// ─── Datetime Attribute ──────────────────────────────────────

export async function ensureDatetimeAttribute(
    databases: Databases,
    databaseId: string,
    collectionId: string,
    key: string,
    required: boolean,
    defaultValue?: string,
    array: boolean = false
): Promise<void> {
    try {
        await databases.getAttribute(databaseId, collectionId, key);
        logger.skipped('attribute', key);
    } catch (err) {
        if (isAppwriteError(err, 404)) {
            try {
                await databases.createDatetimeAttribute(
                    databaseId,
                    collectionId,
                    key,
                    required,
                    defaultValue,
                    array
                );
                logger.created('attribute', key);
                await sleep(200);
            } catch (createErr) {
                if (isAppwriteError(createErr, 409)) {
                    logger.skipped('attribute', key);
                } else {
                    logger.error('attribute', key, createErr);
                }
            }
        } else {
            logger.error('attribute', key, err);
        }
    }
}

// ─── Enum Attribute ──────────────────────────────────────────

export async function ensureEnumAttribute(
    databases: Databases,
    databaseId: string,
    collectionId: string,
    key: string,
    elements: string[],
    required: boolean,
    defaultValue?: string,
    array: boolean = false
): Promise<void> {
    try {
        const existing = await databases.getAttribute(databaseId, collectionId, key) as Models.AttributeEnum;

        // Check if elements match — if not, recreate the attribute
        const existingElements = (existing as unknown as { elements?: string[] }).elements || [];
        const desired = [...elements].sort();
        const current = [...existingElements].sort();
        const needsUpdate = desired.length !== current.length || desired.some((v, i) => v !== current[i]);

        if (needsUpdate) {
            logger.info(`Enum attribute '${key}' has stale values [${current.join(',')}], recreating with [${desired.join(',')}]...`);

            // Delete old attribute, wait for Appwrite to process, then recreate
            await databases.deleteAttribute(databaseId, collectionId, key);
            await sleep(2000); // Appwrite needs time to fully remove the attribute

            await databases.createEnumAttribute(
                databaseId,
                collectionId,
                key,
                elements,
                required,
                defaultValue,
                array
            );
            logger.created('attribute', `${key} (updated enum values)`);
            await sleep(200);
        } else {
            logger.skipped('attribute', key);
        }
    } catch (err) {
        if (isAppwriteError(err, 404)) {
            try {
                await databases.createEnumAttribute(
                    databaseId,
                    collectionId,
                    key,
                    elements,
                    required,
                    defaultValue,
                    array
                );
                logger.created('attribute', key);
                await sleep(200);
            } catch (createErr) {
                if (isAppwriteError(createErr, 409)) {
                    logger.skipped('attribute', key);
                } else {
                    logger.error('attribute', key, createErr);
                }
            }
        } else {
            logger.error('attribute', key, err);
        }
    }
}

// ─── URL Attribute ───────────────────────────────────────────

export async function ensureUrlAttribute(
    databases: Databases,
    databaseId: string,
    collectionId: string,
    key: string,
    required: boolean,
    defaultValue?: string,
    array: boolean = false
): Promise<void> {
    try {
        await databases.getAttribute(databaseId, collectionId, key);
        logger.skipped('attribute', key);
    } catch (err) {
        if (isAppwriteError(err, 404)) {
            try {
                await databases.createUrlAttribute(
                    databaseId,
                    collectionId,
                    key,
                    required,
                    defaultValue,
                    array
                );
                logger.created('attribute', key);
                await sleep(200);
            } catch (createErr) {
                if (isAppwriteError(createErr, 409)) {
                    logger.skipped('attribute', key);
                } else {
                    logger.error('attribute', key, createErr);
                }
            }
        } else {
            logger.error('attribute', key, err);
        }
    }
}

// ─── Email Attribute ─────────────────────────────────────────

export async function ensureEmailAttribute(
    databases: Databases,
    databaseId: string,
    collectionId: string,
    key: string,
    required: boolean,
    defaultValue?: string,
    array: boolean = false
): Promise<void> {
    try {
        await databases.getAttribute(databaseId, collectionId, key);
        logger.skipped('attribute', key);
    } catch (err) {
        if (isAppwriteError(err, 404)) {
            try {
                await databases.createEmailAttribute(
                    databaseId,
                    collectionId,
                    key,
                    required,
                    defaultValue,
                    array
                );
                logger.created('attribute', key);
                await sleep(200);
            } catch (createErr) {
                if (isAppwriteError(createErr, 409)) {
                    logger.skipped('attribute', key);
                } else {
                    logger.error('attribute', key, createErr);
                }
            }
        } else {
            logger.error('attribute', key, err);
        }
    }
}

// ─── Index ───────────────────────────────────────────────────

export async function ensureIndex(
    databases: Databases,
    databaseId: string,
    collectionId: string,
    key: string,
    type: IndexType,
    attributes: string[],
    orders?: string[]
): Promise<void> {
    const maxAttempts = 8;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        try {
            await databases.getIndex(databaseId, collectionId, key);
            logger.skipped('index', key);
            return;
        } catch (err) {
            if (!isAppwriteError(err, 404)) {
                logger.error('index', key, err);
                return;
            }
            try {
                await waitForAttributesAvailable(databases, databaseId, collectionId, attributes);
                await databases.createIndex(
                    databaseId,
                    collectionId,
                    key,
                    type,
                    attributes,
                    orders
                );
                logger.created('index', key);
                await sleep(500);
                return;
            } catch (createErr) {
                if (isAppwriteError(createErr, 409)) {
                    logger.skipped('index', key);
                    return;
                }
                if (isAttributeNotReady(createErr) && attempt < maxAttempts) {
                    logger.info(`Waiting for attributes before index ${key} (${attempt}/${maxAttempts})`);
                    await sleep(1500 * attempt);
                    continue;
                }
                logger.error('index', key, createErr);
                return;
            }
        }
    }
}
