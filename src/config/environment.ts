/**
 * Configuration management for MoCo API connection
 * Handles environment variables validation and provides typed configuration
 */

export interface MocoConfig {
  /** API key for MoCo authentication */
  apiKey: string;
  /** MoCo subdomain (e.g., 'yourcompany' for 'yourcompany.mocoapp.com') */
  subdomain: string;
  /** Complete base URL for MoCo API requests */
  baseUrl: string;
  /** Optional: Current user ID for filtering activities (set via MOCO_USER_ID env var) */
  userId?: number;
}

/**
 * Retrieves and validates MoCo configuration from environment variables
 * @returns {MocoConfig} Validated configuration object
 * @throws {Error} When required environment variables are missing
 */
export function getMocoConfig(): MocoConfig {
  const apiKey = process.env.MOCO_API_KEY;
  const subdomain = process.env.MOCO_SUBDOMAIN;
  
  if (!apiKey) {
    throw new Error('MOCO_API_KEY environment variable is required');
  }
  
  if (!subdomain) {
    throw new Error('MOCO_SUBDOMAIN environment variable is required');
  }
  
  // Validate subdomain format - should not contain protocol or domain parts
  if (subdomain.includes('.') || subdomain.includes('http')) {
    throw new Error('MOCO_SUBDOMAIN should only contain the subdomain name (e.g., "yourcompany", not "yourcompany.mocoapp.com")');
  }
  
  // Optional user ID for automatic activity filtering
  const userIdRaw = process.env.MOCO_USER_ID;
  const userId = userIdRaw ? parseInt(userIdRaw, 10) : undefined;

  return {
    apiKey,
    subdomain,
    baseUrl: `https://${subdomain}.mocoapp.com/api/v1`,
    userId
  };
}