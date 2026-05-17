const KiteConnect = require('kiteconnect').KiteConnect;

const API_KEY = '0fjdhpb9dc5d8i67';
const API_SECRET = 'jdfyp917dob530394aoivw0j95fes7xi';

const requestToken = process.argv[2];

if (!requestToken) {
  console.error('❌ Error: Please provide request_token as argument');
  console.log('Usage: node scripts/exchange-token.js YOUR_REQUEST_TOKEN');
  process.exit(1);
}

const kc = new KiteConnect({
  api_key: API_KEY
});

kc.generateSession(requestToken, API_SECRET)
  .then(response => {
    console.log('\n✅ SUCCESS! Your access token:\n');
    console.log(response.access_token);
    console.log('\n📝 Add this to your .env file:');
    console.log(`ZERODHA_ACCESS_TOKEN=${response.access_token}\n`);
  })
  .catch(error => {
    console.error('❌ Error:', error);
  });