import { KiteConnect } from "kiteconnect";

const client = new KiteConnect({
  api_key: "0fjdhpb9dc5d8i67"
});

client.setAccessToken("PLx9pqrT3CMaLxRQ4iSlh0zqW3bQBh9e");

async function test() {
  try {
    console.log("Testing Zerodha API...");
    
    // Test 1: Get profile
    const profile = await client.getProfile();
    console.log("✅ Profile:", profile.user_id);
    
    // Test 2: Get historical data
    const data = await client.getHistoricalData(
      "NSE:RELIANCE",
      "day",
      "2024-01-01",
      "2024-12-31",
      false
    );
    console.log("✅ Historical data:", data.length, "candles");
    
  } catch (error) {
    console.error("❌ Error:", error);
  }
}

test();