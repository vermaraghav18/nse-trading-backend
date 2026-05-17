/**
 * Zerodha Authentication Service
 * Handles token management and session persistence
 */

import { env } from "../../config/env";
import { 
  generateSession, 
  getLoginUrl, 
  setAccessToken,
  isZerodhaAuthenticated,
  isZerodhaEnabled 
} from "./zerodha.client";
import { ZerodhaSessionData } from "./zerodha.types";

// In-memory token storage (in production, use Redis or database)
let currentAccessToken: string | null = null;
let currentRequestToken: string | null = null;
let sessionData: ZerodhaSessionData | null = null;

/**
 * Check if we have a valid session
 */
export function hasValidSession(): boolean {
  return currentAccessToken !== null && isZerodhaAuthenticated();
}

/**
 * Get current access token
 */
export function getCurrentAccessToken(): string | null {
  return currentAccessToken;
}

/**
 * Initialize authentication flow
 * Returns login URL that user must visit
 */
export function startAuthFlow(): string {
  if (!isZerodhaEnabled()) {
    throw new Error("Zerodha is disabled - set ZERODHA_ENABLED=true in .env");
  }

  const loginUrl = getLoginUrl();
  console.log("\n╔════════════════════════════════════════════════════════════════╗");
  console.log("║  🔐 ZERODHA AUTHENTICATION REQUIRED                            ║");
  console.log("╚════════════════════════════════════════════════════════════════╝");
  console.log(`\n📍 Login URL:\n${loginUrl}\n`);
  console.log("Instructions:");
  console.log("1. Open the URL above in your browser");
  console.log("2. Login with your Zerodha credentials");
  console.log("3. Copy the request_token from redirect URL");
  console.log("4. Call completeAuthFlow(requestToken) with the token\n");
  
  return loginUrl;
}

/**
 * Complete authentication with request token
 */
export async function completeAuthFlow(requestToken: string): Promise<ZerodhaSessionData> {
  if (!isZerodhaEnabled()) {
    throw new Error("Zerodha is disabled");
  }

  console.log("[zerodha-auth] Completing authentication flow...");
  
  currentRequestToken = requestToken;
  sessionData = await generateSession(requestToken);
  currentAccessToken = sessionData.access_token;

  console.log("[zerodha-auth] ✅ Authentication successful!");
  console.log(`[zerodha-auth] User: ${sessionData.user_name} (${sessionData.user_id})`);
  
  return sessionData;
}

/**
 * Use existing access token (for server restarts)
 */
export function useExistingToken(token: string): void {
  if (!isZerodhaEnabled()) {
    throw new Error("Zerodha is disabled");
  }

  currentAccessToken = token;
  setAccessToken(token);
  console.log("[zerodha-auth] Using existing access token");
}

/**
 * Get current session data
 */
export function getSessionData(): ZerodhaSessionData | null {
  return sessionData;
}

/**
 * Clear session (logout)
 */
export function clearSession(): void {
  currentAccessToken = null;
  currentRequestToken = null;
  sessionData = null;
  console.log("[zerodha-auth] Session cleared");
}