#!/usr/bin/env python3
from kiteconnect import KiteConnect
import urllib.parse
import hashlib

API_KEY = "0fjdhpb9dc5d8i67"
API_SECRET = "jdfyp917dob530394aoivw0j95fes7xi"

print("\n" + "="*70)
print("ZERODHA KITE CONNECT - DEBUG TEST")
print("="*70)
print(f"\nAPI Key: {API_KEY}")
print(f"API Secret: {API_SECRET[:10]}...")

kite = KiteConnect(api_key=API_KEY)
login_url = kite.login_url()

print(f"\nLogin URL:\n{login_url}\n")
print("="*70)
print("INSTRUCTIONS:")
print("1. Open the URL above")
print("2. Login with FXD975")
print("3. Paste the FULL redirect URL")
print("="*70 + "\n")

# Get redirect URL
redirect_url = input("Paste redirect URL: ").strip()

try:
    # Extract token
    parsed = urllib.parse.urlparse(redirect_url)
    params = urllib.parse.parse_qs(parsed.query)
    
    if 'request_token' not in params:
        print("\n❌ No request_token in URL!")
        exit(1)
    
    request_token = params['request_token'][0]
    
    print(f"\n✓ Token extracted: {request_token}")
    print(f"\nGenerating checksum...")
    
    # Generate checksum manually
    checksum_string = f"{API_KEY}{request_token}{API_SECRET}"
    checksum = hashlib.sha256(checksum_string.encode()).hexdigest()
    
    print(f"Checksum string: {API_KEY} + {request_token} + {API_SECRET[:10]}...")
    print(f"Checksum: {checksum}")
    
    print(f"\nCalling generate_session...")
    
    # Try to generate session
    data = kite.generate_session(request_token, api_secret=API_SECRET)
    
    print("\n" + "="*70)
    print("🎉 SUCCESS!")
    print("="*70)
    print(f"\nUser: {data.get('user_name')}")
    print(f"User ID: {data.get('user_id')}")
    print(f"Email: {data.get('email')}")
    print(f"Access Token: {data.get('access_token')[:30]}...")
    
    # Test API
    print("\nTesting API call...")
    kite.set_access_token(data['access_token'])
    profile = kite.profile()
    
    print(f"✓ Profile: {profile.get('user_name')}")
    print(f"✓ Broker: {profile.get('broker')}")
    
    print("\n" + "="*70)
    print("✅ ZERODHA API FULLY WORKING!")
    print("="*70)
    print("\nReady for 322 stocks integration!")
    
except Exception as e:
    print("\n" + "="*70)
    print("❌ ERROR")
    print("="*70)
    print(f"\nError: {str(e)}")
    print(f"\nFull error details:")
    import traceback
    traceback.print_exc()
    
    print("\n" + "="*70)
    print("DEBUG INFO:")
    print("="*70)
    print(f"API Key: {API_KEY}")
    print(f"API Secret: {API_SECRET}")
    print(f"Token: {request_token if 'request_token' in locals() else 'N/A'}")
    print("="*70)