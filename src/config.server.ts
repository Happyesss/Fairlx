/**
 * Server-Only Configuration
 * 
 * This module contains sensitive credentials that should NEVER be exposed to client bundles.
 * The "server-only" import ensures a build error if this file is accidentally imported
 * from a client component.
 */
import "server-only";

// ===============================
// Landing Page Supabase (GitHub Star Rewards)
// ===============================
// SECURITY: Service role key bypasses Row-Level Security
// Only use in trusted server-side code
export const LANDING_SUPABASE_URL = process.env.LANDING_SUPABASE_URL!;
export const LANDING_SUPABASE_SERVICE_ROLE_KEY = process.env.LANDING_SUPABASE_SERVICE_ROLE_KEY!;
