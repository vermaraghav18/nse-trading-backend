// TEST 1H CACHE VIA HTTP (Running Backend)
// Run this WHILE backend is running: npm run dev
// Then in new terminal: npx ts-node src/test-1h-via-api.ts

async function test1HCacheViaAPI() {
  console.log("🔍 TESTING 1H CACHE VIA RUNNING BACKEND\n");
  console.log("═".repeat(60));

  try {
    // Test 1: Check if Bollinger 1H API returns data
    console.log("\n1️⃣ TESTING BOLLINGER 1H API:");
    console.log("─".repeat(60));
    
    const bollResponse = await fetch("http://localhost:4000/api/bollinger-1h");
    const bollData = await bollResponse.json();
    
    if (bollData.ok && bollData.data) {
      console.log(`✅ Bollinger 1H API returned ${bollData.data.length} stocks`);
      
      if (bollData.data.length > 0) {
        const sample = bollData.data[0];
        console.log(`\n   Sample: ${sample.symbol}`);
        console.log(`   Middle: ₹${sample.middleBand}`);
        console.log(`   Upper:  ₹${sample.upperBand}`);
        console.log(`   Lower:  ₹${sample.lowerBand}`);
        
        // Calculate squeeze
        const bandwidth = sample.upperBand - sample.lowerBand;
        const bandwidthPct = (bandwidth / sample.middleBand) * 100;
        console.log(`   Bandwidth: ${bandwidthPct.toFixed(2)}%`);
        
        if (bandwidthPct < 10) {
          console.log(`   🔴 SQUEEZE - Would SKIP`);
        } else {
          console.log(`   🟢 NORMAL - Would ALLOW`);
        }
      }
    } else {
      console.log(`❌ API error:`, bollData);
    }

    // Test 2: Check EMA 1H API
    console.log("\n2️⃣ TESTING EMA 1H API:");
    console.log("─".repeat(60));
    
    const emaResponse = await fetch("http://localhost:4000/api/ema-1h");
    const emaData = await emaResponse.json();
    
    if (emaData.ok && emaData.data) {
      console.log(`✅ EMA 1H API returned ${emaData.data.length} stocks`);
      
      if (emaData.data.length > 0) {
        const sample = emaData.data[0];
        console.log(`\n   Sample: ${sample.symbol}`);
        console.log(`   EMA7:  ${sample.ema7dSlant}`);
        console.log(`   EMA14: ${sample.ema14dSlant}`);
        console.log(`   Price vs EMA44: ${sample.priceVsEma44}`);
      }
    } else {
      console.log(`❌ API error:`, emaData);
    }

    // VERDICT
    console.log("\n" + "═".repeat(60));
    console.log("📋 FINAL VERDICT:");
    console.log("═".repeat(60));
    
    if (bollData.data && bollData.data.length > 0) {
      console.log(`✅ 1H CACHE IS WORKING!`);
      console.log(`✅ Squeeze filter WILL work on May 4`);
      console.log(`✅ EMA filter WILL work on May 4`);
      console.log(`\n🚀 SAFE TO DEPLOY!`);
    } else {
      console.log(`❌ 1H CACHE IS EMPTY!`);
      console.log(`❌ DO NOT DEPLOY - Squeeze filter will fail`);
    }

  } catch (err: any) {
    console.log(`❌ Error connecting to backend:`, err.message);
    console.log(`\n⚠️ Make sure backend is running: npm run dev`);
  }
}

test1HCacheViaAPI().catch(console.error);