#!/usr/bin/env python3
"""
Backend API Testing for U-8 Recommendation Engine
Tests the Similar Channels API endpoint
"""

import requests
import sys
import json
from datetime import datetime

class U8RecommendationTester:
    def __init__(self, base_url="https://20f31160-bba4-489a-bca3-9360eb80f264.preview.emergentagent.com"):
        self.base_url = base_url
        self.tests_run = 0
        self.tests_passed = 0
        self.errors = []

    def log_test(self, name, success, details=None):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name} - PASSED")
        else:
            print(f"❌ {name} - FAILED")
            self.errors.append(f"{name}: {details or 'No details'}")
        if details:
            print(f"   Details: {details}")
            
    def test_health_check(self):
        """Test basic connectivity"""
        try:
            response = requests.get(f"{self.base_url}/api/telegram-intel/health", timeout=10)
            success = response.status_code == 200
            self.log_test("Health Check", success, f"Status: {response.status_code}")
            return success
        except Exception as e:
            self.log_test("Health Check", False, f"Error: {str(e)}")
            return False
            
    def test_similar_channels_api_structure(self):
        """Test the similar channels API endpoint structure and response"""
        # Use one of the mock channels from MockUtilityDataAdapter
        test_username = "alpha_crypto"  # From the mock data
        
        try:
            url = f"{self.base_url}/api/telegram-intel/channel/{test_username}/similar"
            response = requests.get(url, timeout=15)
            
            success = response.status_code == 200
            self.log_test(f"Similar Channels API Response ({test_username})", success, 
                         f"Status: {response.status_code}")
            
            if not success:
                print(f"   Response: {response.text[:500]}")
                return False
                
            data = response.json()
            
            # Test response structure
            required_fields = ['ok', 'username', 'limit', 'items', 'targetChannel']
            structure_valid = all(field in data for field in required_fields)
            self.log_test("API Response Structure", structure_valid,
                         f"Required fields present: {required_fields}")
            
            if not structure_valid:
                print(f"   Missing fields from: {list(data.keys())}")
                return False
                
            # Test that items are returned
            items_present = isinstance(data['items'], list)
            self.log_test("Items Array Present", items_present, 
                         f"Items type: {type(data['items'])}, Count: {len(data.get('items', []))}")
                         
            # Test targetChannel structure
            target_valid = isinstance(data.get('targetChannel'), dict)
            self.log_test("Target Channel Structure", target_valid,
                         f"targetChannel present: {bool(data.get('targetChannel'))}")
            
            return success and structure_valid and items_present and target_valid
            
        except Exception as e:
            self.log_test("Similar Channels API", False, f"Error: {str(e)}")
            return False
            
    def test_similar_channels_item_structure(self):
        """Test individual similar channel item structure"""
        test_username = "defi_news"  # Another mock channel
        
        try:
            url = f"{self.base_url}/api/telegram-intel/channel/{test_username}/similar"
            response = requests.get(url, params={'limit': 3}, timeout=15)
            
            if response.status_code != 200:
                self.log_test("Similar Channel Items Structure", False, 
                             f"API call failed: {response.status_code}")
                return False
                
            data = response.json()
            items = data.get('items', [])
            
            if not items:
                self.log_test("Similar Channel Items Structure", False, "No items returned")
                return False
                
            # Test first item structure
            item = items[0]
            expected_fields = [
                'username', 'category', 'lifecycle', 'utilityScore', 
                'growth30', 'engagementRate', 'fraudRisk', 'similarityScore', 'reasons'
            ]
            
            fields_present = all(field in item for field in expected_fields)
            self.log_test("Channel Item Fields", fields_present,
                         f"Fields in item: {list(item.keys())}")
                         
            # Test reasons array
            reasons_valid = isinstance(item.get('reasons'), list) and len(item.get('reasons', [])) > 0
            self.log_test("Reasons Array", reasons_valid,
                         f"Reasons: {item.get('reasons', [])[0] if item.get('reasons') else 'None'}")
            
            return fields_present and reasons_valid
            
        except Exception as e:
            self.log_test("Similar Channel Items", False, f"Error: {str(e)}")
            return False
            
    def test_api_with_limit_parameter(self):
        """Test API with limit parameter"""
        test_username = "whale_alerts"
        
        try:
            url = f"{self.base_url}/api/telegram-intel/channel/{test_username}/similar"
            response = requests.get(url, params={'limit': 3}, timeout=15)
            
            success = response.status_code == 200
            if not success:
                self.log_test("API Limit Parameter", False, f"Status: {response.status_code}")
                return False
                
            data = response.json()
            limit_respected = len(data.get('items', [])) <= 3
            returned_limit = data.get('limit') == 3
            
            self.log_test("API Limit Parameter", limit_respected and returned_limit,
                         f"Requested: 3, Returned: {len(data.get('items', []))}, Limit field: {data.get('limit')}")
            
            return success and limit_respected and returned_limit
            
        except Exception as e:
            self.log_test("API Limit Parameter", False, f"Error: {str(e)}")
            return False
            
    def test_nonexistent_channel(self):
        """Test API response for nonexistent channel"""
        test_username = "nonexistent_channel_12345"
        
        try:
            url = f"{self.base_url}/api/telegram-intel/channel/{test_username}/similar"
            response = requests.get(url, timeout=10)
            
            # Should return 200 with empty items, not 404
            success = response.status_code == 200
            if success:
                data = response.json()
                empty_items = len(data.get('items', [])) == 0
                self.log_test("Nonexistent Channel Handling", success and empty_items,
                             f"Empty items for nonexistent channel: {empty_items}")
                return success and empty_items
            else:
                self.log_test("Nonexistent Channel Handling", False, f"Status: {response.status_code}")
                return False
                
        except Exception as e:
            self.log_test("Nonexistent Channel", False, f"Error: {str(e)}")
            return False

    def run_all_tests(self):
        """Run all API tests"""
        print("🚀 Starting Telegram Intel U-6 & U-7 Sector Rotation + Lifecycle API Tests...")
        print(f"Testing against: {self.base_url}")
        print("=" * 60)
        
        # Test BLOCK U-2 to U-5 Utility APIs (Primary focus)
        self.test_utility_list_api()
        self.test_utility_explain_api()
        self.test_utility_channel_api()
        self.test_intel_list_mode_utility()
        self.test_sector_overview_api()
        
        # Test NEW U-6 and U-7 Features  
        self.test_sector_rotation_api()
        self.test_lifecycle_api()
        
        # Test Existing Mode Compatibility
        self.test_intel_list_mode_intel()
        self.test_intel_list_mode_momentum()
        
        # Test Some Legacy APIs (Basic check)
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
    tester = TelegramIntelUtilityAPITester()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())