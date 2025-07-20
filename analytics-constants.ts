/**
 * Analytics configuration using environment variables
 * Both server and client components use NEXT_PUBLIC_* variables for consistency
 */
export const ANALYTICS_CONFIG = {
  SERVER_URL: process.env.NEXT_PUBLIC_ANALYTICS_SERVER_URL || "",
  SITE_ID: process.env.NEXT_PUBLIC_ANALYTICS_SITE_ID || "",
} as const;

// Track if we've already logged missing environment variables
let hasLoggedMissingEnvVars = false;

/**
 * Validate that required environment variables are set
 */
export function validateAnalyticsConfig() {
  const { SERVER_URL, SITE_ID } = ANALYTICS_CONFIG;
  
  if (!SERVER_URL || !SITE_ID) {
    // Only log once to avoid spam
    if (!hasLoggedMissingEnvVars) {
      console.error("[Jillen.Analytics] Missing required environment variables:", {
        SERVER_URL: SERVER_URL ? "✓" : "✗ NEXT_PUBLIC_ANALYTICS_SERVER_URL",
        SITE_ID: SITE_ID ? "✓" : "✗ NEXT_PUBLIC_ANALYTICS_SITE_ID"
      });
      hasLoggedMissingEnvVars = true;
    }
    return false;
  }
  
  return true;
} 