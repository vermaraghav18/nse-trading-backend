import { KiteConnect } from "kiteconnect";

const client = new KiteConnect({
  api_key: "0fjdhpb9dc5d8i67"
});

client.setAccessToken("PLx9pqrT3CMaLxRQ4iSlh0zqW3bQBh9e");

async function testFormats() {
  try {
    console.log("Testing different instrument formats...\n");
    
    // Test format 1: Exchange:Symbol
    console.log("Test 1: NSE:RELIANCE");
    try {
      const data1 = await client.getHistoricalData(
        "NSE:RELIANCE",
        "day",
        "2024-12-01",
        "2024-12-31",
        false
      );
      console.log("✅ Works! Got", data1.length, "candles\n");
    } catch (e: any) {
      console.log("❌ Failed:", e.message, "\n");
    }
    
    // Test format 2: Instrument token (we need to get this first)
    console.log("Test 2: Getting instrument token for RELIANCE...");
    const instruments = await client.getInstruments("NSE");
    const reliance = instruments.find((i: any) => i.tradingsymbol === "RELIANCE");
    
    if (reliance) {
      console.log("Found RELIANCE token:", reliance.instrument_token);
      
      try {
        const data2 = await client.getHistoricalData(
          reliance.instrument_token,
          "day",
          "2024-12-01",
          "2024-12-31",
          false
        );
        console.log("✅ Works with token! Got", data2.length, "candles\n");
      } catch (e: any) {
        console.log("❌ Failed:", e.message, "\n");
      }
    }
    
  } catch (error) {
    console.error("Overall error:", error);
  }
}

testFormats();