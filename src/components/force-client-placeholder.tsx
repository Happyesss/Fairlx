"use client";

/**
 * ForceClientPlaceholder - A component that forces client-side rendering
 * This is useful in pages that need to ensure certain components are rendered
 * on the client side only, particularly to handle hydration mismatches
 * or when server-side and client-side rendered content might differ.
 */
export const ForceClientPlaceholder = () => {
  // Return null since this is just a placeholder to force client rendering
  return null;
};