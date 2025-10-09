/**
 * Environment variable validation for Appwrite Sites deployment
 * This ensures all required environment variables are present and valid
 */

export function validateEnvironmentVariables() {
  const required = [
    'NEXT_PUBLIC_APPWRITE_ENDPOINT',
    'NEXT_PUBLIC_APPWRITE_PROJECT',
    'NEXT_PUBLIC_APPWRITE_DATABASE_ID',
  ];

  const missing: string[] = [];
  
  required.forEach(varName => {
    const value = process.env[varName];
    if (!value || value.trim() === '') {
      missing.push(varName);
    }
  });

  if (missing.length > 0) {
    console.warn('Missing environment variables:', missing);
    // Don't throw error in production to prevent crashes
    // Instead, provide default values or graceful degradation
  }
}

// Default values for missing environment variables
export const getEnvVar = (name: string, defaultValue: string = ''): string => {
  return process.env[name] || defaultValue;
};

// Check if we're in a server environment with all required variables
export const isAppwriteConfigured = (): boolean => {
  try {
    const endpoint = getEnvVar('NEXT_PUBLIC_APPWRITE_ENDPOINT');
    const project = getEnvVar('NEXT_PUBLIC_APPWRITE_PROJECT');
    
    return !!(endpoint && project);
  } catch {
    return false;
  }
};