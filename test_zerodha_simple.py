#!/usr/bin/env python3
from kiteconnect import KiteConnect
import webbrowser

API_KEY = "0fjdhpb9dc5d8167"
API_SECRET = "jdfyp917dob530394aoivw0j95fes7xi"

kite = KiteConnect(api_key=API_KEY)
login_url = kite.login_url()

print("\n" + "="*70)
print("ZERODHA KITE CONNECT - TEST")
print("="*70)
print(f"\nLogin URL:\n{login_url}\n")
print("INSTRUCTIONS:")
print("1. Open the URL above in your browser")
print("2. Login with your Zerodha credentials (FXD975)")
print("3. After login, you'll be redirected to a URL like:")
print("   http://localhost:3000/callback?request_token=XXXXX&action=login")
print("4. Copy ONLY the 'request_token' value (the XXXXX part)")
print("="*70 + "\n")

request_token = input("Paste the request_token here: ").strip()

if not request_token:
    print("\nError: No token provided!")
    exit(1)

print(f"\nReceived token: {request_token[:20]}...")
print("Generating access token...\n")

try:
    # Generate session
    data = kite.generate_session(request_token, api_secret=API_SECRET)
    access_token = data["access_token"]
    
    print("="*70)
    print("SUCCESS! ZERODHA API IS WORKING!")
    print("="*70)
    print(f"\nUser ID: {data.get('user_id')}")
    print(f"User Name: {data.get('user_name')}")
    print(f"Email: {data.get('email')}")
    print(f"Access Token: {access_token[:30]}...")
    
    # Test API call - Get profile
    print("\nTesting API call...")
    kite.set_access_token(access_token)
    profile = kite.profile()
    
    print(f"\nProfile Retrieved:")
    print(f"  Name: {profile.get('user_name')}")
    print(f"  Email: {profile.get('email')}")
    print(f"  Broker: {profile.get('broker')}")
    
    print("\n" + "="*70)
    print("ALL TESTS PASSED!")
    print("="*70)
    print("\nZerodha Kite Connect is working perfectly!")
    print("Ready to integrate with your trading system.")
    print("\n" + "="*70)
    
except Exception as e:
    print("="*70)
    print("ERROR OCCURRED")
    print("="*70)
    print(f"\nError: {str(e)}\n")
    
    if "Invalid" in str(e):
        print("POSSIBLE REASONS:")
        print("1. Request token expired (they expire in ~5 minutes)")
        print("2. Request token not copied correctly")
        print("3. App still not activated by Zerodha")
        print("\nTRY AGAIN:")
        print("- Make sure you login quickly after opening the URL")
        print("- Copy the ENTIRE request_token value")
        print("- Don't include the '&action=login' part")
    else:
        print("POSSIBLE REASONS:")
        print("1. Network issue")
        print("2. Zerodha API temporary problem")
        print("3. Try again in a few minutes")
    
    print("\n" + "="*70)