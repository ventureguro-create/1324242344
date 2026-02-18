#!/usr/bin/env python3
"""
Backend API Testing for Telegram Intel Bot (PHASE 6)
Tests all bot API endpoints and existing telegram-intel APIs
"""

import requests
import sys
import json
from datetime import datetime

class TelegramIntelAPITester:
    def __init__(self, base_url="https://tg-isolated.preview.emergentagent.com"):
        self.base_url = base_url
        self.tests_run = 0
        self.tests_passed = 0
        self.errors = []

    def log_result(self, test_name, success, details=""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {test_name}: PASSED")
        else:
            print(f"❌ {test_name}: FAILED - {details}")
            self.errors.append(f"{test_name}: {details}")

    def make_request(self, method, endpoint, data=None, expected_status=200):
        """Make HTTP request and return response"""
        url = f"{self.base_url}{endpoint}"
        headers = {'Content-Type': 'application/json'}
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=30)
            elif method == 'POST':
                # Ensure we send at least empty JSON object for POST requests
                json_data = data if data is not None else {}
                response = requests.post(url, json=json_data, headers=headers, timeout=30)
            elif method == 'PATCH':
                response = requests.patch(url, json=data, headers=headers, timeout=30)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=30)
            else:
                return False, f"Unsupported method: {method}", None
                
            # Parse JSON response
            try:
                response_data = response.json()
            except:
                response_data = {"error": "Invalid JSON response", "text": response.text[:200]}

            success = response.status_code == expected_status
            details = f"Status: {response.status_code}" if success else f"Expected {expected_status}, got {response.status_code}"
            
            return success, details, response_data
            
        except requests.exceptions.RequestException as e:
            return False, f"Request error: {str(e)}", None

    def test_bot_status_api(self):
        """Test GET /api/telegram-intel/bot/status"""
        print("\n🔍 Testing Bot Status API...")
        success, details, data = self.make_request('GET', '/api/telegram-intel/bot/status')
        
        if success and data:
            # Check response structure
            has_bot_info = 'bot' in data and 'configured' in data.get('bot', {})
            has_connection_info = 'connection' in data
            
            if has_bot_info:
                bot_configured = data['bot']['configured']
                print(f"   Bot configured: {bot_configured}")
                print(f"   Bot username: {data['bot'].get('username', 'N/A')}")
                
            if has_connection_info:
                print(f"   Connection status: {data['connection']}")
            else:
                print("   No active connection (expected for new user)")
                
            # Bot should not be configured (as noted by main agent)
            expected_not_configured = not data.get('bot', {}).get('configured', True)
            if expected_not_configured:
                print("   ✅ Bot correctly not configured (TG_BOT_TOKEN missing)")
            else:
                print("   ⚠️ Bot appears configured (unexpected)")
                
            self.log_result("Bot Status API", True, "Response structure valid")
        else:
            self.log_result("Bot Status API", False, details)

    def test_bot_connect_api(self):
        """Test POST /api/telegram-intel/bot/connect"""
        print("\n🔍 Testing Bot Connect API...")
        
        # Try multiple actor identification methods
        headers_variations = [
            {},  # Default anonymous
            {'X-Actor-Id': 'test_user_123', 'X-Actor-Type': 'anonymous'},
            {'X-Actor-Id': 'anon_test123', 'X-Actor-Type': 'anonymous'}
        ]
        
        success = False
        for i, extra_headers in enumerate(headers_variations):
            print(f"   Attempt {i+1}: {extra_headers if extra_headers else 'default headers'}")
            
            try:
                url = f"{self.base_url}/api/telegram-intel/bot/connect"
                headers = {'Content-Type': 'application/json', **extra_headers}
                
                response = requests.post(url, json={}, headers=headers, timeout=30)
                
                print(f"     Status: {response.status_code}")
                
                if response.status_code == 200:
                    try:
                        data = response.json()
                        has_link_token = 'linkToken' in data
                        has_expires_at = 'expiresAt' in data  
                        has_connect_url = 'connectUrl' in data
                        has_bot_username = 'botUsername' in data
                        
                        print(f"     Link token generated: {has_link_token}")
                        print(f"     Expires at: {data.get('expiresAt', 'N/A')}")
                        print(f"     Connect URL: {has_connect_url}")
                        print(f"     Bot username: {data.get('botUsername', 'N/A')}")
                        
                        all_fields_present = has_link_token and has_expires_at and has_connect_url and has_bot_username
                        if all_fields_present:
                            self.log_result("Bot Connect API", True, f"Success with headers: {extra_headers}")
                            success = True
                            break
                        else:
                            print(f"     Missing fields in response")
                    except Exception as e:
                        print(f"     JSON parse error: {e}")
                elif response.status_code >= 500:
                    print(f"     Server error (5xx) - backend issue")
                else:
                    try:
                        error_data = response.json()
                        print(f"     Error response: {error_data}")
                    except:
                        print(f"     Non-JSON error response")
                        
            except Exception as e:
                print(f"     Request failed: {e}")
        
        if not success:
            self.log_result("Bot Connect API", False, "All attempts failed")

    def test_bot_preferences_api(self):
        """Test PATCH /api/telegram-intel/bot/preferences"""
        print("\n🔍 Testing Bot Preferences API...")
        
        # Test updating preferences
        test_prefs = {
            "enabled": True,
            "minSeverity": "HIGH",
            "alertTypes": ["INTEL_SPIKE", "MOMENTUM_SPIKE"],
            "quietHours": {
                "enabled": True,
                "start": 23,
                "end": 7
            }
        }
        
        success, details, data = self.make_request('PATCH', '/api/telegram-intel/bot/preferences', test_prefs)
        
        if success and data:
            if data.get('ok'):
                print(f"   Preferences updated successfully")
                print(f"   Updated preferences: {json.dumps(data.get('preferences', {}), indent=2)}")
                self.log_result("Bot Preferences API", True, "Preferences updated")
            else:
                error = data.get('error', 'Unknown error')
                if error == 'not_connected':
                    print("   ℹ️ Not connected yet (expected for new user)")
                    self.log_result("Bot Preferences API", True, "Correctly requires connection")
                else:
                    self.log_result("Bot Preferences API", False, f"API error: {error}")
        else:
            self.log_result("Bot Preferences API", False, details)

    def test_admin_bot_stats_api(self):
        """Test GET /api/admin/telegram-intel/bot/stats"""
        print("\n🔍 Testing Admin Bot Stats API...")
        success, details, data = self.make_request('GET', '/api/admin/telegram-intel/bot/stats')
        
        if success and data:
            has_bot_info = 'bot' in data
            has_connections_stats = 'connections' in data
            
            if has_bot_info:
                bot_info = data['bot']
                print(f"   Bot configured: {bot_info.get('configured', False)}")
                print(f"   Bot username: {bot_info.get('username', 'N/A')}")
                
            if has_connections_stats:
                conn_stats = data['connections']
                print(f"   Total connections: {conn_stats.get('total', 0)}")
                print(f"   Active connections: {conn_stats.get('active', 0)}")
                print(f"   Total alerts sent: {conn_stats.get('totalAlertsSent', 0)}")
                
            all_fields_present = has_bot_info and has_connections_stats
            self.log_result("Admin Bot Stats API", all_fields_present, "Stats structure valid" if all_fields_present else "Missing fields")
        else:
            self.log_result("Admin Bot Stats API", False, details)

    def test_intel_list_api(self):
        """Test GET /api/telegram-intel/intel/list (leaderboard)"""
        print("\n🔍 Testing Intel List API...")
        success, details, data = self.make_request('GET', '/api/telegram-intel/intel/list')
        
        if success and data:
            has_items = 'items' in data
            has_total = 'total' in data
            
            if has_items:
                items_count = len(data.get('items', []))
                print(f"   Intel items returned: {items_count}")
                if items_count > 0:
                    sample_item = data['items'][0]
                    print(f"   Sample item keys: {list(sample_item.keys())}")
                    
            print(f"   Total count: {data.get('total', 0)}")
            
            structure_valid = has_items and has_total
            self.log_result("Intel List API", structure_valid, f"Returned {data.get('total', 0)} items" if structure_valid else "Invalid structure")
        else:
            self.log_result("Intel List API", False, details)

    def test_watchlist_api(self):
        """Test GET /api/telegram-intel/watchlist"""
        print("\n🔍 Testing Watchlist API...")
        success, details, data = self.make_request('GET', '/api/telegram-intel/watchlist')
        
        if success and data:
            has_items = 'items' in data
            has_stats = 'stats' in data
            
            if has_items:
                items_count = len(data.get('items', []))
                print(f"   Watchlist items: {items_count}")
                
            if has_stats:
                stats = data.get('stats', {})
                print(f"   Watchlist stats: {json.dumps(stats, indent=2)}")
                
            structure_valid = has_items
            self.log_result("Watchlist API", structure_valid, f"Returned {len(data.get('items', []))} watchlist items" if structure_valid else "Invalid structure")
        else:
            self.log_result("Watchlist API", False, details)

    def test_user_alerts_api(self):
        """Test GET /api/telegram-intel/user/alerts"""
        print("\n🔍 Testing User Alerts API...")
        success, details, data = self.make_request('GET', '/api/telegram-intel/user/alerts')
        
        if success and data:
            has_items = 'items' in data
            has_stats = 'stats' in data
            
            if has_items:
                items_count = len(data.get('items', []))
                print(f"   User alerts: {items_count}")
                
            if has_stats:
                stats = data.get('stats', {})
                print(f"   Alert stats: {json.dumps(stats, indent=2)}")
                
            structure_valid = has_items
            self.log_result("User Alerts API", structure_valid, f"Returned {len(data.get('items', []))} user alerts" if structure_valid else "Invalid structure")
        else:
            self.log_result("User Alerts API", False, details)

    def run_all_tests(self):
        """Run all API tests"""
        print("🚀 Starting Telegram Intel Bot API Tests...")
        print(f"Testing against: {self.base_url}")
        print("=" * 60)
        
        # Test Bot APIs (PHASE 6)
        self.test_bot_status_api()
        self.test_bot_connect_api()  
        self.test_bot_preferences_api()
        self.test_admin_bot_stats_api()
        
        # Test Existing APIs
        self.test_intel_list_api()
        self.test_watchlist_api()
        self.test_user_alerts_api()
        
        # Summary
        print("\n" + "=" * 60)
        print(f"📊 Test Summary:")
        print(f"   Tests run: {self.tests_run}")
        print(f"   Tests passed: {self.tests_passed}")
        print(f"   Success rate: {(self.tests_passed/self.tests_run*100):.1f}%")
        
        if self.errors:
            print(f"\n❌ Failures ({len(self.errors)}):")
            for error in self.errors:
                print(f"   • {error}")
        else:
            print("\n✅ All tests passed!")
            
        return self.tests_passed == self.tests_run

def main():
    """Main test function"""
    tester = TelegramIntelAPITester()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())