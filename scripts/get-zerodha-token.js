const KiteConnect = require('kiteconnect').KiteConnect;

const API_KEY = '0fjdhpb9dc5d8i67';
const API_SECRET = 'jdfyp917dob530394aoivw0j95fes7xi';

const kc = new KiteConnect({
  api_key: API_KEY
});

console.log('\n🔐 ZERODHA TOKEN GENERATOR\n');
console.log('Step 1: Visit this URL in your browser:\n');
console.log(kc.getLoginURL());
console.log('\nStep 2: After login, copy the "request_token" from the redirected URL');
console.log('Step 3: Run: node scripts/exchange-token.js YOUR_REQUEST_TOKEN\n');