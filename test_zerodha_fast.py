#!/usr/bin/env python3
from kiteconnect import KiteConnect
import urllib.parse

API_KEY = "0fjdhpb9dc5d8167"
API_SECRET = "jdfyp917dob530394aoivw0j95fes7xi"

kite = KiteConnect(api_key=API_KEY)
login_url = kite.login_url()

print("\n" + "="*70)
print("ZERODHA KITE CONNECT - QUICK TEST")
print("="*70)
print(f"\nLogin URL:\n{login_url}\n")
print("INSTRUCTIONS:")
print("1. Open the URL above in your browser")
print("2. Login with Zerodha (FXD975)")
print("3. After redirect, paste the COMPLETE URL from browser")
print("   Example: http://localhost:3000/callback?request_token=XXX&action=login")
print("="*70 + "\n")

# Get the full redirect URL
redirect_url = input("Paste the FULL redirect URL here: ").strip()

# Parse the URL to extract request_token
try:
    parsed_url = urllib.parse.urlparse(redirect_url)
    params = urllib.parse.parse_qs(parsed_url.query)
    
    if 'request_token' in params:
        request_token = params['request_token'][0]
    else:
        print("\n❌ Error: No request_token found in URL!")
        print("Make sure you pasted the complete redirect URL.")
        exit(1)
    
    print(f"\n✓ Extracted token: {request_token[:20]}...")
    print("Generating access token...\n")
    
    # Generate session
    data = kite.generate_session(request_token, api_secret=API_SECRET)
    access_token = data["access_token"]
    
    print("="*70)
    print("✅ SUCCESS! ZERODHA API IS WORKING!")
    print("="*70)
    print(f"\nUser ID: {data.get('user_id')}")
    print(f"User Name: {data.get('user_name')}")
    print(f"Email: {data.get('email')}")
    print(f"Access Token: {access_token[:30]}...")
    
    # Test API call
    print("\nTesting API call...")
    kite.set_access_token(access_token)
    profile = kite.profile()
    
    print(f"\n✓ Profile Retrieved:")
    print(f"  Name: {profile.get('user_name')}")
    print(f"  Email: {profile.get('email')}")
    print(f"  Broker: {profile.get('broker')}")
    
    print("\n" + "="*70)
    print("🎉 ALL TESTS PASSED!")
    print("="*70)
    print("\nZerodha Kite Connect is 100% working!")
    print("Ready to integrate with your 322 stocks system.")
    print("\n" + "="*70)
    
except Exception as e:
    print("="*70)
    print("❌ ERROR")
    print("="*70)
    print(f"\nError: {str(e)}\n")
    print("Debug info:")
    print(f"  API Key: {API_KEY}")
    print(f"  Token: {request_token if 'request_token' in locals() else 'Not extracted'}")
    print("\nTry again - make sure to:")
    print("1. Login IMMEDIATELY after opening URL")
    print("2. Copy the COMPLETE redirect URL within 1 minute")
    print("3. Paste the ENTIRE URL (including http://localhost...)")
    print("\n" + "="*70)