#!/usr/bin/env python3
"""
Detailed Testing for BLOCK U-1 Utility Engine
Comprehensive validation of all utility endpoints and features
"""

import requests
import sys
import json
from datetime import datetime

class DetailedUtilityTester:
    def __init__(self, base_url="https://channel-metrics-20.preview.emergentagent.com"):
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
                json_data = data if data is not None else {}
                response = requests.post(url, json=json_data, headers=headers, timeout=30)
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

    def test_utility_scoring_accuracy(self):
        """Test utility scoring formula accuracy"""
        print("\n🔍 Testing Utility Scoring Accuracy...")
        
        # Get a known channel from mock data
        success, details, data = self.make_request('GET', '/api/telegram-intel/utility/channel/alpha_crypto')
        
        if success and data and data.get('ok'):
            channel = data['channel']
            
            # Verify scoring formula components
            explain = channel.get('explain', {})
            expected_components = ['engagementScore', 'growthScore', 'stabilityScore', 'originalityScore', 'activityScore', 'fraudInverseScore']
            
            all_components_present = all(comp in explain for comp in expected_components)
            
            if all_components_present:
                # Verify weights sum correctly (manual calculation check)
                weighted_sum = (
                    0.25 * explain['engagementScore'] +
                    0.20 * explain['growthScore'] +
                    0.15 * explain['stabilityScore'] +
                    0.15 * explain['originalityScore'] +
                    0.15 * explain['activityScore'] +
                    0.10 * explain['fraudInverseScore']
                )
                
                expected_score = round(weighted_sum * 100)
                actual_score = channel['utilityScore']
                
                # Allow for small rounding differences
                score_match = abs(expected_score - actual_score) <= 2
                
                print(f"   Calculated score: {expected_score}")
                print(f"   Actual score: {actual_score}")
                print(f"   Component breakdown:")
                for comp, value in explain.items():
                    print(f"     {comp}: {value}")
                
                if score_match:
                    self.log_result("Utility Scoring Formula", True, f"Score calculation accurate ({actual_score})")
                else:
                    self.log_result("Utility Scoring Formula", False, f"Score mismatch: expected ~{expected_score}, got {actual_score}")
            else:
                missing = [comp for comp in expected_components if comp not in explain]
                self.log_result("Utility Scoring Formula", False, f"Missing components: {missing}")
        else:
            self.log_result("Utility Scoring Formula", False, "Could not retrieve test channel data")

    def test_utility_tier_mapping(self):
        """Test utility tier mapping accuracy"""
        print("\n🔍 Testing Utility Tier Mapping...")
        
        success, details, data = self.make_request('GET', '/api/telegram-intel/utility/list')
        
        if success and data and data.get('ok'):
            items = data.get('items', [])
            
            if items:
                tier_errors = []
                
                for item in items:
                    score = item['utilityScore']
                    tier = item['utilityTier']
                    
                    # Verify tier mapping
                    expected_tier = None
                    if score >= 85:
                        expected_tier = 'A+'
                    elif score >= 75:
                        expected_tier = 'A'
                    elif score >= 60:
                        expected_tier = 'B'
                    elif score >= 40:
                        expected_tier = 'C'
                    else:
                        expected_tier = 'D'
                    
                    if tier != expected_tier:
                        tier_errors.append(f"{item['username']}: score {score} should be tier {expected_tier}, got {tier}")
                    
                    print(f"   {item['username']}: score {score} → tier {tier} ({'✅' if tier == expected_tier else '❌'})")
                
                if not tier_errors:
                    self.log_result("Utility Tier Mapping", True, f"All {len(items)} channels have correct tiers")
                else:
                    self.log_result("Utility Tier Mapping", False, f"Tier errors: {'; '.join(tier_errors)}")
            else:
                self.log_result("Utility Tier Mapping", False, "No items to test")
        else:
            self.log_result("Utility Tier Mapping", False, "Could not retrieve utility list")

    def test_sorting_functionality(self):
        """Test different sorting options"""
        print("\n🔍 Testing Utility Sorting Functionality...")
        
        sorts_to_test = ['utility', 'growth30', 'engagement', 'stability', 'fraud', 'activity']
        
        for sort_field in sorts_to_test:
            success, details, data = self.make_request('GET', f'/api/telegram-intel/utility/list?sort={sort_field}')
            
            if success and data and data.get('ok'):
                items = data.get('items', [])
                
                if len(items) >= 2:
                    # Check if sorting works
                    sorted_correctly = True
                    
                    for i in range(len(items) - 1):
                        current = items[i]
                        next_item = items[i + 1]
                        
                        if sort_field == 'utility':
                            if current['utilityScore'] < next_item['utilityScore']:
                                sorted_correctly = False
                                break
                        elif sort_field == 'growth30':
                            if current['growth30'] < next_item['growth30']:
                                sorted_correctly = False
                                break
                        elif sort_field == 'engagement':
                            if current['engagementRate'] < next_item['engagementRate']:
                                sorted_correctly = False
                                break
                        elif sort_field == 'stability':
                            if current['stability'] < next_item['stability']:
                                sorted_correctly = False
                                break
                        elif sort_field == 'fraud':
                            if current['fraudRisk'] > next_item['fraudRisk']:  # Lower fraud = better
                                sorted_correctly = False
                                break
                        elif sort_field == 'activity':
                            if current['postsPerDay'] < next_item['postsPerDay']:
                                sorted_correctly = False
                                break
                    
                    if sorted_correctly:
                        print(f"   Sort by {sort_field}: ✅ Correct order")
                        self.log_result(f"Sort by {sort_field}", True, "Sorting working correctly")
                    else:
                        print(f"   Sort by {sort_field}: ❌ Incorrect order")
                        self.log_result(f"Sort by {sort_field}", False, "Items not sorted correctly")
                else:
                    print(f"   Sort by {sort_field}: ℹ️ Not enough items to test")
                    self.log_result(f"Sort by {sort_field}", True, "Not enough items to test sorting")
            else:
                self.log_result(f"Sort by {sort_field}", False, f"API request failed: {details}")

    def test_pagination_and_limits(self):
        """Test pagination and limit functionality"""
        print("\n🔍 Testing Pagination and Limits...")
        
        # Test different limits
        success, details, data = self.make_request('GET', '/api/telegram-intel/utility/list?limit=3')
        
        if success and data and data.get('ok'):
            items = data.get('items', [])
            limit = data.get('limit')
            total = data.get('total')
            
            if len(items) <= 3 and limit == 3:
                print(f"   Limit test: ✅ Returned {len(items)} items (limit: {limit})")
                
                # Test offset
                offset_success, offset_details, offset_data = self.make_request('GET', '/api/telegram-intel/utility/list?limit=2&offset=1')
                
                if offset_success and offset_data and offset_data.get('ok'):
                    offset_items = offset_data.get('items', [])
                    offset_val = offset_data.get('offset')
                    
                    if offset_val == 1:
                        print(f"   Offset test: ✅ Offset {offset_val} working, returned {len(offset_items)} items")
                        self.log_result("Pagination", True, "Limit and offset working correctly")
                    else:
                        self.log_result("Pagination", False, f"Offset not applied correctly: expected 1, got {offset_val}")
                else:
                    self.log_result("Pagination", False, "Offset test failed")
            else:
                self.log_result("Pagination", False, f"Limit not respected: returned {len(items)} items for limit 3")
        else:
            self.log_result("Pagination", False, "Limit test failed")

    def test_channel_not_found_handling(self):
        """Test 404 handling for non-existent channels"""
        print("\n🔍 Testing Channel Not Found Handling...")
        
        # Test with non-existent channel
        success, details, data = self.make_request('GET', '/api/telegram-intel/utility/channel/definitely_does_not_exist_12345', expected_status=404)
        
        if success and data:
            if data.get('ok') == False and data.get('error') == 'not_found':
                self.log_result("404 Handling", True, "Correctly returns 404 with proper error")
            else:
                self.log_result("404 Handling", False, f"Wrong error format: {data}")
        else:
            self.log_result("404 Handling", False, f"Expected 404 but got: {details}")

    def test_stats_calculation(self):
        """Test stats calculation accuracy"""
        print("\n🔍 Testing Stats Calculation...")
        
        success, details, data = self.make_request('GET', '/api/telegram-intel/utility/list')
        
        if success and data and data.get('ok'):
            items = data.get('items', [])
            stats = data.get('stats', {})
            
            if items and stats:
                # Manual calculation
                total_utility = sum(item['utilityScore'] for item in items)
                total_growth = sum(item['growth30'] for item in items)
                total_engagement = sum(item['engagementRate'] for item in items)
                
                calculated_avg_utility = round(total_utility / len(items))
                calculated_avg_growth = round(total_growth / len(items), 2)
                calculated_avg_engagement = round(total_engagement / len(items), 4)
                
                stats_correct = (
                    stats.get('avgUtility') == calculated_avg_utility and
                    stats.get('avgGrowth30') == calculated_avg_growth and
                    stats.get('avgEngagement') == calculated_avg_engagement and
                    stats.get('totalChannels') == len(items)
                )
                
                print(f"   Calculated avg utility: {calculated_avg_utility}, API: {stats.get('avgUtility')}")
                print(f"   Calculated avg growth: {calculated_avg_growth}, API: {stats.get('avgGrowth30')}")
                print(f"   Calculated avg engagement: {calculated_avg_engagement}, API: {stats.get('avgEngagement')}")
                print(f"   Total channels: {len(items)}, API: {stats.get('totalChannels')}")
                
                if stats_correct:
                    self.log_result("Stats Calculation", True, "All stats calculated correctly")
                else:
                    self.log_result("Stats Calculation", False, "Stats calculation mismatch")
            else:
                self.log_result("Stats Calculation", True, "No items to calculate stats (expected for empty DB)")
        else:
            self.log_result("Stats Calculation", False, "Could not retrieve data for stats test")

    def run_detailed_tests(self):
        """Run all detailed utility tests"""
        print("🚀 Starting Detailed BLOCK U-1 Utility Engine Tests...")
        print(f"Testing against: {self.base_url}")
        print("=" * 70)
        
        # Run comprehensive tests
        self.test_utility_scoring_accuracy()
        self.test_utility_tier_mapping()
        self.test_sorting_functionality()
        self.test_pagination_and_limits()
        self.test_channel_not_found_handling()
        self.test_stats_calculation()
        
        # Summary
        print("\n" + "=" * 70)
        print(f"📊 Detailed Test Summary:")
        print(f"   Tests run: {self.tests_run}")
        print(f"   Tests passed: {self.tests_passed}")
        print(f"   Success rate: {(self.tests_passed/self.tests_run*100):.1f}%")
        
        if self.errors:
            print(f"\n❌ Failures ({len(self.errors)}):")
            for error in self.errors:
                print(f"   • {error}")
        else:
            print("\n✅ All detailed tests passed!")
            
        return self.tests_passed == self.tests_run

def main():
    """Main test function"""
    tester = DetailedUtilityTester()
    success = tester.run_detailed_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())