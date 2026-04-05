// Usage : node ./scripts/ci/audit_env.js

const fs = require('fs');
const path = require('path');

const DEPLOY_YML_PATH = '.github/workflows/deploy.yml';
const ENV_LOCAL_PATH = '.env.local';

if (!fs.existsSync(DEPLOY_YML_PATH)) {
    console.error(`❌ Error: ${DEPLOY_YML_PATH} not found.`);
    process.exit(1);
}

if (!fs.existsSync(ENV_LOCAL_PATH)) {
    console.error(`❌ Error: ${ENV_LOCAL_PATH} not found.`);
    process.exit(1);
}

const deployYml = fs.readFileSync(DEPLOY_YML_PATH, 'utf8');
const envLocal = fs.readFileSync(ENV_LOCAL_PATH, 'utf8');

// Extraction for deploy.yml: Find all ${{ secrets.NAME }} and ${{ vars.NAME }}
const workflowMatches = deployYml.matchAll(/\$\{\{\s+(secrets|vars)\.([A-Z0-9_]+)\s+\}\}/g);
const requiredKeys = new Set();
for (const match of workflowMatches) {
    requiredKeys.add(match[2]);
}

// Extraction for .env.local: Find all lines starting with NAME=VALUE
const envLines = envLocal.split('\n');
const providedKeys = new Set();
for (const line of envLines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
        const match = trimmed.match(/^([A-Z0-9_]+)=/);
        if (match) {
            providedKeys.add(match[1]);
        }
    }
}

const missingInEnv = [...requiredKeys].filter(key => !providedKeys.has(key)).sort();
const missingInDeploy = [...providedKeys].filter(key => !requiredKeys.has(key)).sort();

console.log('\n--- 🔍 ENV AUDIT RESULTS ---');

// 1. Missing in .env.local (Required for CI/Deploy but not found locally)
if (missingInEnv.length === 0) {
    console.log('✅ .env.local: All keys from deploy.yml are present.');
} else {
    console.log(`⚠️  MISSING in .env.local (${missingInEnv.length} keys):`);
    console.log('   (These are used in deploy.yml but missing in your local .env.local)');
    missingInEnv.forEach(key => console.log(`   - ${key}`));
}

console.log('');

// 2. Missing in deploy.yml (Found locally but not used in CI/Deploy)
if (missingInDeploy.length === 0) {
    console.log('✅ deploy.yml: All local keys are used in deployment sync.');
} else {
    console.log(`ℹ️  MISSING in deploy.yml (${missingInDeploy.length} keys):`);
    console.log('   (These are in .env.local but NOT mentioned in deploy.yml)');
    missingInDeploy.forEach(key => console.log(`   - ${key}`));
}

console.log('\n---------------------------\n');

if (missingInEnv.length === 0) {
    console.log('🎉 Audit passed successfully!');
} else {
    console.log('❌ Audit found missing required keys in .env.local.');
}