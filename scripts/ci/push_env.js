#!/usr/bin/env node

/**
 * github-push-env.js
 * 
 * Selectively pushes environment variables from .env.local to GitHub Secrets or Variables
 * by automatically detecting their type from .github/workflows/deploy.yml.
 * 
 * Usage: node scripts/ci/push_env.js --repo=<username>/Fairlx <KEY_1> <KEY_2> ...
 */

const fs = require('fs');
const { execSync } = require('child_process');

const DEPLOY_YML_PATH = '.github/workflows/deploy.yml';
const ENV_LOCAL_PATH = '.env.local';

// 1. Load Files
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

// 2. Parse deploy.yml to build type map
const typeMap = new Map();
const secretMatches = deployYml.matchAll(/\$\{\{\s+secrets\.([A-Z0-9_]+)\s+\}\}/g);
for (const match of secretMatches) {
    typeMap.set(match[1], 'secret');
}
const varMatches = deployYml.matchAll(/\$\{\{\s+vars\.([A-Z0-9_]+)\s+\}\}/g);
for (const match of varMatches) {
    // Note: If a key is used as both (rare), the last one wins or we prioritize secret.
    if (!typeMap.has(match[1])) {
        typeMap.set(match[1], 'variable');
    }
}

// 3. Parse .env.local for values
const valueMap = new Map();
const envLines = envLocal.split('\n');
for (const line of envLines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
        const match = trimmed.match(/^([A-Z0-9_]+)=(['"]?)(.*)\2$/);
        if (match) {
            valueMap.set(match[1], match[3]);
        }
    }
}

// 4. Process CLI Arguments
const args = process.argv.slice(2);
let targetRepo = '';
const keysToPush = [];

for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--repo=')) {
        targetRepo = args[i].split('=')[1];
    } else if (args[i] === '--repo' && i + 1 < args.length) {
        targetRepo = args[++i];
    } else {
        keysToPush.push(args[i]);
    }
}

if (keysToPush.length === 0) {
    console.log('\n🚀 GH Environment Pusher');
    console.log('Usage: node scripts/ci/push_env.js [--repo=owner/repo] <KEY_1> <KEY_2> ...');
    console.log('\nExample: node scripts/ci/push_env.js --repo=myorg/myrepo GEMINI_API_KEY\n');
    process.exit(0);
}

const repoFlag = targetRepo ? `--repo ${targetRepo}` : '';
console.log(`\n📦 Initializing sync for ${keysToPush.length} keys...`);
if (targetRepo) console.log(`🎯 Target Repository: ${targetRepo}`);
console.log('');

for (const key of keysToPush) {
    const value = valueMap.get(key);
    if (value === undefined) {
        console.error(`❌ Skip: "${key}" not found in ${ENV_LOCAL_PATH}`);
        continue;
    }

    let type = typeMap.get(key);
    if (!type) {
        console.log(`⚠️  Warning: "${key}" not found in ${DEPLOY_YML_PATH}. Defaulting to SECRET.`);
        type = 'secret';
    }

    try {
        if (type === 'secret') {
            console.log(`🔒 Pushing Secret: ${key}...`);
            execSync(`gh secret set "${key}" --body "${value}" ${repoFlag}`, { stdio: 'inherit' });
        } else {
            console.log(`📝 Pushing Variable: ${key}...`);
            execSync(`gh variable set "${key}" --body "${value}" ${repoFlag}`, { stdio: 'inherit' });
        }
        console.log(`✅ Success: ${key}\n`);
    } catch (error) {
        console.error(`❌ Error: Failed to push "${key}". Make sure you are logged in (gh auth login) and have access to the repo.\n`);
    }
}

console.log('✨ Done!');
