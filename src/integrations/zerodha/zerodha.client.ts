/**
 * Main Zerodha Kite Connect API Client
 * This file handles authentication and provides the base client
 */

import { KiteConnect } from "kiteconnect";
import { env } from "../../config/env";
import { ZerodhaCredentials, ZerodhaSessionData } from "./zerodha.types";

let kiteClient: any = null;
let isAuthenticated = false;

/**
 * Initialize Zerodha client with credentials
 */
export function initializeZerodhaClient(): any {
  if (!env.zerodha.enabled) {
    throw new Error("Zerodha is disabled in configuration");
  }

  if (!env.zerodha.apiKey || !env.zerodha.apiSecret) {
    throw new Error("Zerodha credentials not configured");
  }

  console.log("[zerodha-client] Initializing Zerodha client...");
  kiteClient = new KiteConnect({
    api_key: env.zerodha.apiKey,
  });

  // Auto-load access token if available in .env
  if (env.zerodha.accessToken) {
    console.log("[zerodha-client] Access token found in .env, authenticating...");
    kiteClient.setAccessToken(env.zerodha.accessToken);
    isAuthenticated = true;
    console.log("[zerodha-client] ✅ Authenticated with saved token");
  } else {
    console.log("[zerodha-client] ⚠️ No access token in .env - authentication required");
  }

  return kiteClient;
}

/**
 * Get the Kite client instance
 */
export function getZerodhaClient(): any {
  if (!kiteClient) {
    kiteClient = initializeZerodhaClient();
  }
  return kiteClient;
}

/**
 * Generate login URL for manual authentication
 */
export function getLoginUrl(): string {
  const client = getZerodhaClient();
  return client.getLoginURL();
}

/**
 * Generate session using request token
 * This must be called after user completes login flow
 */
export async function generateSession(requestToken: string): Promise<ZerodhaSessionData> {
  if (!env.zerodha.enabled) {
    throw new Error("Zerodha is disabled in configuration");
  }

  const client = getZerodhaClient();
  
  try {
    const session = await client.generateSession(
      requestToken,
      env.zerodha.apiSecret
    );

    // Set access token for future requests
    client.setAccessToken(session.access_token);
    isAuthenticated = true;

    console.log("[zerodha-client] Session generated successfully");
    console.log("[zerodha-client] User:", session.user_name);
    
    return session as ZerodhaSessionData;
  } catch (error) {
    console.error("[zerodha-client] Failed to generate session:", error);
    throw error;
  }
}

/**
 * Set access token directly (for stored tokens)
 */
export function setAccessToken(token: string): void {
  const client = getZerodhaClient();
  client.setAccessToken(token);
  isAuthenticated = true;
  console.log("[zerodha-client] Access token set");
}

/**
 * Check if client is authenticated
 */
export function isZerodhaAuthenticated(): boolean {
  return isAuthenticated && kiteClient !== null;
}

/**
 * Get user profile (requires authentication)
 */
export async function getProfile(): Promise<any> {
  if (!isAuthenticated) {
    throw new Error("Not authenticated - call generateSession first");
  }

  const client = getZerodhaClient();
  return await client.getProfile();
}

/**
 * Check if Zerodha is enabled in config
 */
export function isZerodhaEnabled(): boolean {
  return env.zerodha.enabled;
}