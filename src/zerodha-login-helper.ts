/**
 * Zerodha Login Helper
 * Guides you through authentication process
 */

import { startAuthFlow, completeAuthFlow } from "./integrations/zerodha/zerodha-auth.service";
import { getProfile } from "./integrations/zerodha/zerodha.client";

async function authenticateZerodha() {
  console.log("\n╔════════════════════════════════════════════════════════════════╗");
  console.log("║  🔐 ZERODHA AUTHENTICATION HELPER                              ║");
  console.log("╚════════════════════════════════════════════════════════════════╝\n");

  try {
    // Step 1: Get login URL
    console.log("STEP 1: Get Login URL\n");
    const loginUrl = startAuthFlow();
    
    console.log("\n╔════════════════════════════════════════════════════════════════╗");
    console.log("║  📋 MANUAL STEPS REQUIRED:                                     ║");
    console.log("╚════════════════════════════════════════════════════════════════╝\n");
    console.log("1. Open this URL in your browser:");
    console.log(`\n   ${loginUrl}\n`);
    console.log("2. Login with your Zerodha credentials");
    console.log("3. You'll be redirected to: http://localhost:3000/callback?request_token=XXXXX");
    console.log("4. Copy the 'request_token' value from the URL\n");
    console.log("Example redirect URL:");
    console.log("http://localhost:3000/callback?request_token=abc123xyz456&action=login&status=success");
    console.log("                                             ^^^^^^^^^^^^^\n");
    console.log("Copy ONLY the request_token value (the random string after request_token=)\n");
    
    // Wait for user input
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    rl.question('Paste the request_token here and press Enter: ', async (requestToken: string) => {
      rl.close();
      
      console.log("\n\nSTEP 2: Generating Access Token...\n");
      
      try {
        const token = requestToken.trim();
        const session = await completeAuthFlow(token);
        
        console.log("\n╔════════════════════════════════════════════════════════════════╗");
        console.log("║  ✅ AUTHENTICATION SUCCESSFUL!                                 ║");
        console.log("╚════════════════════════════════════════════════════════════════╝\n");
        
        console.log("User Details:");
        console.log(`  Name: ${session.user_name}`);
        console.log(`  ID: ${session.user_id}`);
        console.log(`  Email: ${session.email}\n`);
        
        console.log("Access Token:");
        console.log(`  ${session.access_token}\n`);
        
        console.log("╔════════════════════════════════════════════════════════════════╗");
        console.log("║  📝 NEXT STEPS:                                                ║");
        console.log("╚════════════════════════════════════════════════════════════════╝\n");
        console.log("1. Copy the access token above");
        console.log("2. Add it to your .env file:");
        console.log(`   ZERODHA_ACCESS_TOKEN=${session.access_token}`);
        console.log("3. Set ZERODHA_ENABLED=true in .env");
        console.log("4. Restart your server\n");
        
        // Test the token
        console.log("STEP 3: Testing Token...\n");
        const profile = await getProfile();
        console.log("✅ Token works! Profile fetched successfully.\n");
        
      } catch (error) {
        console.error("\n❌ Authentication failed:");
        console.error(error);
        console.error("\nPlease try again or check your API credentials.\n");
      }
    });
    
  } catch (error) {
    console.error("\n❌ Error:");
    console.error(error);
  }
}

authenticateZerodha();