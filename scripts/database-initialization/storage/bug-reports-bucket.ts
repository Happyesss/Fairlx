import { Storage, Permission, Role, Compression } from 'node-appwrite';
import { ensureBucket } from '../lib/storage-helpers';
import { logger } from '../lib/logger';

const BUCKET_ID = process.env.NEXT_PUBLIC_APPWRITE_BUG_REPORTS_BUCKET_ID || 'bug_reports_bucket';
const BUCKET_NAME = 'Bug Reports';

export async function setupBugReportsBucket(storage: Storage): Promise<void> {
    logger.collection(BUCKET_NAME);

    await ensureBucket(storage, BUCKET_ID, BUCKET_NAME, {
        permissions: [
            Permission.read(Role.any()),
            Permission.create(Role.users()),
            Permission.update(Role.users()),
            Permission.delete(Role.users()),
        ],
        fileSecurity: false,
        maximumFileSize: 10 * 1024 * 1024, // 10MB
        allowedFileExtensions: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
        compression: Compression.Gzip,
        encryption: true,
        antivirus: true,
    });
}
