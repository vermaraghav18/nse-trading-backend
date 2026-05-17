/**
 * Loads environment variables for the backend.
 * This file keeps config reading in one place.
 */
import * as dotenv from "dotenv";

dotenv.config();

function getRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export const env = {
  port: Number(process.env.PORT || 4000),
  nodeEnv: process.env.NODE_ENV || "development",
  
  // Upstox configuration (existing)
  upstoxAnalyticsToken: getRequiredEnv("UPSTOX_ANALYTICS_TOKEN"),
  upstoxOhlcPollIntervalMs: Number(
    process.env.UPSTOX_OHLC_POLL_INTERVAL_MS || 15000
  ),
  
  // Zerodha Kite Connect configuration
  zerodha: {
    enabled: process.env.ZERODHA_ENABLED === "true",
    apiKey: process.env.ZERODHA_API_KEY || "",
    apiSecret: process.env.ZERODHA_API_SECRET || "",
    clientId: process.env.ZERODHA_CLIENT_ID || "",
    redirectUrl: process.env.ZERODHA_REDIRECT_URL || "http://localhost:3000/callback",
    dailyCallLimit: Number(process.env.ZERODHA_DAILY_CALL_LIMIT || 5000),
    requestToken: process.env.ZERODHA_REQUEST_TOKEN || "",
    accessToken: process.env.ZERODHA_ACCESS_TOKEN || "",
  },
  
  // Dhan API configuration
  dhan: {
    enabled: process.env.DHAN_ENABLED === "true",
    apiKey: process.env.DHAN_API_KEY || "",
    apiSecret: process.env.DHAN_API_SECRET || "",
  },
};