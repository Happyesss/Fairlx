#!/bin/bash

# ==============================================================================
# Fairlx GitHub Config Synchronizer
# 
# Usage: ../scripts/ci/github-sync.sh .env.local --repo={UserName}/Fairlx

#
# Prerequisites:
# 1. Install GitHub CLI: brew install gh
# 2. Authenticate: gh auth login
# ==============================================================================

ENV_FILE=${1:-.env.local}

if [ ! -f "$ENV_FILE" ]; then
    echo "❌ Error: File $ENV_FILE not found."
    exit 1
fi

# List of keys that MUST be stored as SECRETS (everything else becomes a VARIABLE)
SECRETS_LIST=(
    "NEXT_APPWRITE_KEY"
    "CASHFREE_SECRET_KEY"
    "CASHFREE_WEBHOOK_SECRET"
    "EXCHANGE_RATE_API_KEY"
    "CRON_SECRET"
    "WALLET_SIG_SECRET"
    "GH_PERSONAL_TOKEN"
    "GEMINI_API_KEY"
    "LANDING_SUPABASE_SERVICE_ROLE_KEY"
    "SOCKET_PUSH_SECRET"
    "R2_ACCOUNT_ID"
    "R2_ACCESS_KEY_ID"
    "R2_SECRET_ACCESS_KEY"
    "TWO_FACTOR_ENCRYPTION_SECRET"
    "BYOB_ENCRYPTION_SECRET"
    "REDIS_URL"
    "REDIS_PASSWORD"
    "EMAIL_API_KEY"
    "DO_SSH_PRIVATE_KEY"
)

# Fetch target repo from git or argument
TARGET_REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null)

# Override with --repo flag if provided
for i in "$@"; do
  case $i in
    --repo=*)
      TARGET_REPO="${i#*=}"
      shift
      ;;
  esac
done

if [ -z "$TARGET_REPO" ]; then
    echo "❌ Error: Could not detect GitHub repository. Please run inside a git repo or use --repo=owner/repo"
    exit 1
fi

# Robust parsing using a temporary script to source and print
# This is the most reliable way to handle .env files with quotes and multi-lines
echo "📦 Target Repository: $TARGET_REPO"
echo "🚀 Starting GitHub Sync from $ENV_FILE..."

# Create a small python script to parse .env correctly (Python's dotenv logic is very standard)
# If python isn't available, we'll fallback to a better perl script.
# Actually, let's use Perl but with a better logic: split by lines and look for "KEY="
cat << 'EOF' > /tmp/env_parser.pl
use strict;
use warnings;

my $env_file = $ARGV[0];
my $target_key = $ARGV[1];
open(my $fh, '<', $env_file) or die "Could not open file: $!";
my $content = do { local $/; <$fh> };
close($fh);

# Regex to match KEY=VALUE where VALUE can be quoted or multi-line
# This looks for the key at the start of a line or after a newline
if ($content =~ /^$target_key=(['"]?)(.*?)\1(?=^\w+=|\z)/ms) {
    print $2;
}
EOF

# Extract all keys first
KEYS=$(grep -E '^[A-Z0-9_]+=' "$ENV_FILE" | cut -d'=' -f1)

for key in $KEYS; do
    # Extract value correctly even if multi-line using our robust perl parser
    value=$(perl /tmp/env_parser.pl "$ENV_FILE" "$key")
    
    if [ -z "$value" ]; then
        continue
    fi

    IS_SECRET=false
    for s in "${SECRETS_LIST[@]}"; do
        if [ "$s" == "$key" ]; then
            IS_SECRET=true
            break
        fi
    done

    if [ "$IS_SECRET" = true ]; then
        echo "🔒 Setting Secret: $key"
        echo "$value" | gh secret set "$key" --repo "$TARGET_REPO"
    else
        echo "📝 Setting Variable: $key"
        gh variable set "$key" --body "$value" --repo "$TARGET_REPO"
    fi
done

rm /tmp/env_parser.pl
echo "✅ Sync complete! Your GitHub Actions environment is now ready."