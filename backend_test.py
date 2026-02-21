#!/usr/bin/env python3
"""
Backend API Testing for U-9 (Lifecycle Transitions) and U-10 (Signal Engine)
Tests Telegram Intelligence module endpoints
"""

import requests
import sys
import json
from datetime import datetime

class TelegramIntelTester:
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
            
    def test_lifecycle_transitions_api(self):
        """Test U-9: Lifecycle Transitions API endpoint"""
        try:
            url = f"{self.base_url}/api/telegram-intel/lifecycle/transitions"
            response = requests.get(url, timeout=15)
            
            success = response.status_code == 200
            self.log_test("U-9: Lifecycle Transitions API", success, 
                         f"Status: {response.status_code}")
            
            if not success:
                print(f"   Response: {response.text[:500]}")
                return False
                
            data = response.json()
            
            # Test response structure
            required_fields = ['ok', 'days', 'limit', 'items']
            structure_valid = all(field in data for field in required_fields)
            self.log_test("U-9: Response Structure", structure_valid,
                         f"Required fields present: {required_fields}")
            
            # Test that items are returned (should have mock data)
            items_present = isinstance(data['items'], list)
            items_count = len(data.get('items', []))
            self.log_test("U-9: Items Present", items_present and items_count > 0, 
                         f"Items count: {items_count}")
                         
            return success and structure_valid and items_present and items_count > 0
            
        except Exception as e:
            self.log_test("U-9: Lifecycle Transitions API", False, f"Error: {str(e)}")
            return False
            
    def test_lifecycle_transitions_item_structure(self):
        """Test U-9: Individual transition item structure"""
        try:
            url = f"{self.base_url}/api/telegram-intel/lifecycle/transitions"
            response = requests.get(url, params={'limit': 5}, timeout=15)
            
            if response.status_code != 200:
                self.log_test("U-9: Transition Items Structure", False, 
                             f"API call failed: {response.status_code}")
                return False
                
            data = response.json()
            items = data.get('items', [])
            
            if not items:
                self.log_test("U-9: Transition Items Structure", False, "No items returned")
                return False
                
            # Test first item structure
            item = items[0]
            expected_fields = [
                'username', 'from', 'to', 'impactScore', 
                'deltaUtility', 'deltaAcceleration', 'deltaGrowth30', 'toDay'
            ]
            
            fields_present = all(field in item for field in expected_fields)
            self.log_test("U-9: Transition Item Fields", fields_present,
                         f"Fields in item: {list(item.keys())}")
                         
            # Test transition values
            valid_lifecycle_stages = ['EMERGING', 'EXPANDING', 'MATURE', 'SATURATED', 'DECLINING', 'STABLE']
            from_valid = item.get('from') in valid_lifecycle_stages
            to_valid = item.get('to') in valid_lifecycle_stages
            self.log_test("U-9: Lifecycle Stage Values", from_valid and to_valid,
                         f"From: {item.get('from')}, To: {item.get('to')}")
            
            return fields_present and from_valid and to_valid
            
        except Exception as e:
            self.log_test("U-9: Transition Items", False, f"Error: {str(e)}")
            return False
            
    def test_signals_api(self):
        """Test U-10: Signal Engine API endpoint"""
        try:
            url = f"{self.base_url}/api/telegram-intel/signals"
            response = requests.get(url, timeout=15)
            
            success = response.status_code == 200
            self.log_test("U-10: Signals API", success, 
                         f"Status: {response.status_code}")
            
            if not success:
                print(f"   Response: {response.text[:500]}")
                return False
                
            data = response.json()
            
            # Test response structure
            required_fields = ['ok', 'days', 'limit', 'items']
            structure_valid = all(field in data for field in required_fields)
            self.log_test("U-10: Response Structure", structure_valid,
                         f"Required fields present: {required_fields}")
            
            # Test that items are returned (should have mock data)
            items_present = isinstance(data['items'], list)
            items_count = len(data.get('items', []))
            self.log_test("U-10: Items Present", items_present and items_count > 0, 
                         f"Items count: {items_count}")
                         
            return success and structure_valid and items_present and items_count > 0
            
        except Exception as e:
            self.log_test("U-10: Signals API", False, f"Error: {str(e)}")
            return False
            
    def test_signals_item_structure(self):
        """Test U-10: Individual signal item structure"""
        try:
            url = f"{self.base_url}/api/telegram-intel/signals"
            response = requests.get(url, params={'limit': 5}, timeout=15)
            
            if response.status_code != 200:
                self.log_test("U-10: Signal Items Structure", False, 
                             f"API call failed: {response.status_code}")
                return False
                
            data = response.json()
            items = data.get('items', [])
            
            if not items:
                self.log_test("U-10: Signal Items Structure", False, "No items returned")
                return False
                
            # Test first item structure
            item = items[0]
            expected_fields = [
                'title', 'type', 'severity', 'score', 'confidence', 'reasons', 'username'
            ]
            
            fields_present = all(field in item for field in expected_fields)
            self.log_test("U-10: Signal Item Fields", fields_present,
                         f"Fields in item: {list(item.keys())}")
                         
            # Test signal values
            valid_severities = ['HIGH', 'MED', 'LOW']
            valid_types = ['SUBSCRIBE_CANDIDATE', 'RISING_UTILITY', 'LIFECYCLE_PROMOTION', 'QUALITY_ALERT', 'ROTATION_IN_OPPORTUNITY']
            severity_valid = item.get('severity') in valid_severities
            type_valid = item.get('type') in valid_types
            self.log_test("U-10: Signal Type/Severity Values", severity_valid and type_valid,
                         f"Type: {item.get('type')}, Severity: {item.get('severity')}")
                         
            # Test reasons array
            reasons_valid = isinstance(item.get('reasons'), list) and len(item.get('reasons', [])) > 0
            self.log_test("U-10: Reasons Array", reasons_valid,
                         f"Reasons count: {len(item.get('reasons', []))}")
            
            return fields_present and severity_valid and type_valid and reasons_valid
            
        except Exception as e:
            self.log_test("U-10: Signal Items", False, f"Error: {str(e)}")
            return False
            
    def test_lifecycle_transitions_with_params(self):
        """Test U-9: API with parameters (days, limit, filter)"""
        try:
            url = f"{self.base_url}/api/telegram-intel/lifecycle/transitions"
            params = {'days': 14, 'limit': 10, 'filter': 'EMERGING_TO_EXPANDING'}
            response = requests.get(url, params=params, timeout=15)
            
            success = response.status_code == 200
            if not success:
                self.log_test("U-9: API Parameters", False, f"Status: {response.status_code}")
                return False
                
            data = response.json()
            params_respected = (
                data.get('days') == 14 and 
                data.get('limit') == 10 and 
                data.get('filter') == 'EMERGING_TO_EXPANDING'
            )
            
            self.log_test("U-9: API Parameters", params_respected,
                         f"Days: {data.get('days')}, Limit: {data.get('limit')}, Filter: {data.get('filter')}")
            
            return success and params_respected
            
        except Exception as e:
            self.log_test("U-9: API Parameters", False, f"Error: {str(e)}")
            return False
            
    def test_signals_with_params(self):
        """Test U-10: API with parameters (days, limit, type, severity)"""
        try:
            url = f"{self.base_url}/api/telegram-intel/signals"
            params = {'days': 14, 'limit': 20, 'type': 'SUBSCRIBE_CANDIDATE', 'severity': 'HIGH'}
            response = requests.get(url, params=params, timeout=15)
            
            success = response.status_code == 200
            if not success:
                self.log_test("U-10: API Parameters", False, f"Status: {response.status_code}")
                return False
                
            data = response.json()
            params_respected = (
                data.get('days') == 14 and 
                data.get('limit') == 20 and 
                data.get('type') == 'SUBSCRIBE_CANDIDATE' and
                data.get('severity') == 'HIGH'
            )
            
            self.log_test("U-10: API Parameters", params_respected,
                         f"Days: {data.get('days')}, Limit: {data.get('limit')}, Type: {data.get('type')}, Severity: {data.get('severity')}")
            
            return success and params_respected
            
        except Exception as e:
            self.log_test("U-10: API Parameters", False, f"Error: {str(e)}")
            return False

    def test_signals_single_item(self):
        """Test U-10: Get single signal by ID"""
        try:
            # First get list to find an ID
            url = f"{self.base_url}/api/telegram-intel/signals"
            response = requests.get(url, params={'limit': 1}, timeout=15)
            
            if response.status_code != 200:
                self.log_test("U-10: Single Signal Setup", False, f"List API failed: {response.status_code}")
                return False
                
            data = response.json()
            items = data.get('items', [])
            
            if not items or not items[0].get('_id'):
                self.log_test("U-10: Single Signal", False, "No signals with ID found")
                return True  # Not a failure if no items
                
            signal_id = items[0]['_id']
            
            # Test single signal endpoint
            single_url = f"{self.base_url}/api/telegram-intel/signals/{signal_id}"
            single_response = requests.get(single_url, timeout=15)
            
            success = single_response.status_code == 200
            self.log_test("U-10: Single Signal API", success,
                         f"Status: {single_response.status_code}")
            
            if success:
                single_data = single_response.json()
                item_present = 'item' in single_data
                self.log_test("U-10: Single Signal Structure", item_present,
                             f"Item field present: {item_present}")
                return success and item_present
            
            return success
            
        except Exception as e:
            self.log_test("U-10: Single Signal", False, f"Error: {str(e)}")
            return False

    def run_all_tests(self):
        """Run all API tests for U-9 and U-10"""
        print("🚀 Starting U-9 (Lifecycle Transitions) and U-10 (Signal Engine) Backend API Tests...")
        print(f"Testing against: {self.base_url}")
        print("=" * 60)
        
        # Test U-9 Lifecycle Transitions APIs
        print("\n📊 Testing U-9: Lifecycle Transitions")
        u9_tests = [
            self.test_lifecycle_transitions_api,
            self.test_lifecycle_transitions_item_structure,
            self.test_lifecycle_transitions_with_params,
        ]
        
        for test in u9_tests:
            try:
                test()
            except Exception as e:
                print(f"❌ Test {test.__name__} crashed: {str(e)}")
                self.errors.append(f"{test.__name__}: Crashed - {str(e)}")
        
        print("\n🔄 Testing U-10: Signal Engine")
        u10_tests = [
            self.test_signals_api,
            self.test_signals_item_structure,
            self.test_signals_with_params,
            self.test_signals_single_item,
        ]
        
        for test in u10_tests:
            try:
                test()
            except Exception as e:
                print(f"❌ Test {test.__name__} crashed: {str(e)}")
                self.errors.append(f"{test.__name__}: Crashed - {str(e)}")
                
        return self.generate_report()
        
    def generate_report(self):
        """Generate test report"""
        success_rate = (self.tests_passed / self.tests_run * 100) if self.tests_run > 0 else 0
        
        print("\n" + "=" * 60)
        print(f"📊 Test Summary: {self.tests_passed}/{self.tests_run} passed ({success_rate:.1f}%)")
        
        if self.errors:
            print(f"\n❌ Failures ({len(self.errors)}):")
            for error in self.errors:
                print(f"   • {error}")
        else:
            print("\n✅ All tests passed!")
            
        if success_rate >= 80:
            print("✅ Backend API tests mostly successful")
            return 0
        else:
            print("❌ Backend API tests failed")
            return 1

def main():
    """Main test function"""
    tester = TelegramIntelTester()
    return tester.run_all_tests()

if __name__ == "__main__":
    sys.exit(main())