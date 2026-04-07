// ANSI color codes
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    red: '\x1b[31m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    magenta: '\x1b[35m',
    dim: '\x1b[2m',
    bold: '\x1b[1m',
};

export const logger = {
    created(resource: string, name: string) {
        console.log(`  ${colors.green}✅ Created${colors.reset} ${resource}: ${colors.bold}${name}${colors.reset}`);
        stats.created++;
    },
    updated(resource: string, name: string) {
        console.log(`  ${colors.blue}🔄 Updated${colors.reset} ${resource}: ${colors.bold}${name}${colors.reset}`);
        stats.created++; // Treat updates similarly to successful creations for stats
    },
    skipped(resource: string, name: string) {
        console.log(`  ${colors.yellow}⏭️  Skipped${colors.reset} ${resource}: ${colors.dim}${name} (exists)${colors.reset}`);
        stats.skipped++;
    },
    error(resource: string, name: string, err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.log(`  ${colors.red}❌ Error${colors.reset} ${resource}: ${name} — ${message}`);
        stats.errors++;
        stats.errorDetails.push(`${resource}: ${name} — ${message}`);
    },
    collection(name: string) {
        console.log(`\n${colors.blue}📦 Collection: ${colors.bold}${name}${colors.reset}`);
        stats.collectionsProcessed++;
    },
    database(name: string) {
        console.log(`\n${colors.magenta}🗄️  Database: ${colors.bold}${name}${colors.reset}`);
    },
    info(message: string) {
        console.log(`${colors.cyan}ℹ️  ${message}${colors.reset}`);
    },
    separator() {
        console.log(`${colors.dim}${'─'.repeat(60)}${colors.reset}`);
    },
};

// Stats tracking
export const stats = {
    collectionsProcessed: 0,
    created: 0,
    skipped: 0,
    errors: 0,
    errorDetails: [] as string[],
};

export function printSummary() {
    console.log('\n');
    logger.separator();
    console.log(`${colors.bold}${colors.cyan}📊 DATABASE SETUP SUMMARY${colors.reset}`);
    logger.separator();
    console.log(`  📦 Collections processed: ${colors.bold}${stats.collectionsProcessed}${colors.reset}`);
    console.log(`  ${colors.green}✅ Resources created:    ${colors.bold}${stats.created}${colors.reset}`);
    console.log(`  ${colors.yellow}⏭️  Resources skipped:    ${colors.bold}${stats.skipped}${colors.reset}`);
    console.log(`  ${colors.red}❌ Errors encountered:   ${colors.bold}${stats.errors}${colors.reset}`);

    if (stats.errorDetails.length > 0) {
        console.log(`\n${colors.red}${colors.bold}Error Details:${colors.reset}`);
        stats.errorDetails.forEach((detail, i) => {
            console.log(`  ${colors.red}${i + 1}. ${detail}${colors.reset}`);
        });
    }

    logger.separator();

    if (stats.errors === 0) {
        console.log(`\n${colors.green}${colors.bold}🎉 Database setup completed successfully!${colors.reset}\n`);
    } else {
        console.log(`\n${colors.yellow}${colors.bold}⚠️  Database setup completed with ${stats.errors} error(s).${colors.reset}\n`);
    }
}
