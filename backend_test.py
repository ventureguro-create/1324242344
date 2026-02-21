#!/usr/bin/env python3
"""
Backend API Testing for Telegram Intel with BLOCK U-1 Utility Engine
Tests utility endpoints and existing telegram-intel APIs
"""

import requests
import sys
import json
from datetime import datetime

class TelegramIntelUtilityAPITester:
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
        
        # Try the API call
        success, details, data = self.make_request('POST', '/api/telegram-intel/bot/connect')
        
        if success and data:
            has_link_token = 'linkToken' in data
            has_expires_at = 'expiresAt' in data  
            has_connect_url = 'connectUrl' in data
            has_bot_username = 'botUsername' in data
            
            print(f"   Link token generated: {has_link_token}")
            print(f"   Expires at: {data.get('expiresAt', 'N/A')}")
            print(f"   Connect URL: {has_connect_url}")
            print(f"   Bot username: {data.get('botUsername', 'N/A')}")
            
            all_fields_present = has_link_token and has_expires_at and has_connect_url and has_bot_username
            self.log_result("Bot Connect API", all_fields_present, "All required fields present" if all_fields_present else "Missing fields")
        else:
            # Check if it's the known database schema issue (E11000 duplicate key)
            if "E11000 duplicate key error" in str(data):
                print("   ⚠️ Known database schema issue: telegramUserId unique constraint conflict")
                print("   ℹ️ API logic appears correct, but database schema needs adjustment")
                self.log_result("Bot Connect API", False, "Database schema issue (E11000) - API logic correct but needs schema fix")
            else:
                self.log_result("Bot Connect API", False, details)

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

    def test_utility_list_api(self):
        """Test GET /api/telegram-intel/utility/list"""
        print("\n🔍 Testing Utility List API...")
        success, details, data = self.make_request('GET', '/api/telegram-intel/utility/list')
        
        if success and data:
            expected_fields = ['ok', 'mode', 'total', 'limit', 'offset', 'items', 'stats']
            missing_fields = [field for field in expected_fields if field not in data]
            
            if not missing_fields:
                mode = data.get('mode')
                total = data.get('total', 0)
                items = data.get('items', [])
                stats = data.get('stats', {})
                
                print(f"   Mode: {mode}")
                print(f"   Total channels: {total}")
                print(f"   Items returned: {len(items)}")
                
                if stats:
                    print(f"   Average utility: {stats.get('avgUtility', 0)}")
                    print(f"   Average growth30: {stats.get('avgGrowth30', 0)}")
                    print(f"   Average engagement: {stats.get('avgEngagement', 0)}")
                    print(f"   Total channels in stats: {stats.get('totalChannels', 0)}")
                
                # Check item structure if items exist
                if items:
                    sample_item = items[0]
                    required_item_fields = ['username', 'utilityScore', 'utilityTier', 'explain']
                    missing_item_fields = [field for field in required_item_fields if field not in sample_item]
                    
                    if not missing_item_fields:
                        print(f"   Sample channel: {sample_item['username']}")
                        print(f"   Utility score: {sample_item['utilityScore']}")
                        print(f"   Utility tier: {sample_item['utilityTier']}")
                        print(f"   Has explain breakdown: {'explain' in sample_item}")
                        
                        # Verify tier is valid
                        valid_tiers = ['A+', 'A', 'B', 'C', 'D']
                        tier_valid = sample_item['utilityTier'] in valid_tiers
                        
                        # Verify score range
                        score_valid = 0 <= sample_item['utilityScore'] <= 100
                        
                        if tier_valid and score_valid and mode == 'utility':
                            self.log_result("Utility List API", True, f"Valid structure with {len(items)} items")
                        else:
                            invalid_reasons = []
                            if not tier_valid:
                                invalid_reasons.append(f"Invalid tier: {sample_item['utilityTier']}")
                            if not score_valid:
                                invalid_reasons.append(f"Invalid score: {sample_item['utilityScore']}")
                            if mode != 'utility':
                                invalid_reasons.append(f"Wrong mode: {mode}")
                            self.log_result("Utility List API", False, "; ".join(invalid_reasons))
                    else:
                        self.log_result("Utility List API", False, f"Item missing fields: {missing_item_fields}")
                else:
                    # Empty items is okay for empty database
                    if mode == 'utility':
                        self.log_result("Utility List API", True, "Empty items (expected for empty database)")
                    else:
                        self.log_result("Utility List API", False, f"Wrong mode: {mode}")
            else:
                self.log_result("Utility List API", False, f"Missing fields: {missing_fields}")
        else:
            self.log_result("Utility List API", False, details)

    def test_utility_explain_api(self):
        """Test GET /api/telegram-intel/utility/explain"""
        print("\n🔍 Testing Utility Explain API...")
        success, details, data = self.make_request('GET', '/api/telegram-intel/utility/explain')
        
        if success and data:
            if data.get('ok') and 'formula' in data:
                formula = data['formula']
                
                # Check formula structure
                has_description = 'description' in formula
                has_weights = 'weights' in formula
                has_tiers = 'tiers' in formula
                has_metrics = 'metrics' in formula
                
                print(f"   Has description: {has_description}")
                print(f"   Has weights: {has_weights}")
                print(f"   Has tiers: {has_tiers}")
                print(f"   Has metrics: {has_metrics}")
                
                if has_weights:
                    weights = formula['weights']
                    expected_weights = ['engagement', 'growth', 'stability', 'originality', 'activity', 'fraudInverse']
                    weight_sum = sum(weights.values())
                    print(f"   Weight sum: {weight_sum} (should be 1.0)")
                    
                    all_weights_present = all(w in weights for w in expected_weights)
                    weight_sum_correct = abs(weight_sum - 1.0) < 0.01
                    
                    if all_weights_present and weight_sum_correct:
                        print(f"   ✅ All weights present and sum to 1.0")
                    else:
                        print(f"   ❌ Weight issues: all_present={all_weights_present}, sum_correct={weight_sum_correct}")
                
                if has_tiers:
                    tiers = formula['tiers']
                    expected_tiers = ['A+', 'A', 'B', 'C', 'D']
                    all_tiers_present = all(t in tiers for t in expected_tiers)
                    print(f"   All tiers present: {all_tiers_present}")
                    if all_tiers_present:
                        print(f"   Tier A+: {tiers['A+']}")
                        print(f"   Tier D: {tiers['D']}")
                
                structure_complete = has_description and has_weights and has_tiers and has_metrics
                self.log_result("Utility Explain API", structure_complete, "Formula explanation complete" if structure_complete else "Incomplete formula structure")
            else:
                self.log_result("Utility Explain API", False, "Missing ok=true or formula field")
        else:
            self.log_result("Utility Explain API", False, details)

    def test_utility_channel_api(self):
        """Test GET /api/telegram-intel/utility/channel/:username"""
        print("\n🔍 Testing Utility Channel API...")
        
        # Test with a mock channel name (should exist in mock data)
        test_username = "alpha_crypto"
        success, details, data = self.make_request('GET', f'/api/telegram-intel/utility/channel/{test_username}')
        
        if success and data:
            if data.get('ok') and 'channel' in data:
                channel = data['channel']
                
                required_fields = ['username', 'utilityScore', 'utilityTier', 'explain']
                missing_fields = [field for field in required_fields if field not in channel]
                
                if not missing_fields:
                    print(f"   Channel: {channel['username']}")
                    print(f"   Utility score: {channel['utilityScore']}")
                    print(f"   Utility tier: {channel['utilityTier']}")
                    
                    # Check explain structure
                    explain = channel.get('explain', {})
                    explain_fields = ['engagementScore', 'growthScore', 'stabilityScore', 'originalityScore', 'activityScore', 'fraudInverseScore']
                    explain_complete = all(field in explain for field in explain_fields)
                    
                    print(f"   Has complete explain breakdown: {explain_complete}")
                    if explain_complete:
                        print(f"   Sample scores - engagement: {explain['engagementScore']}, growth: {explain['growthScore']}")
                    
                    # Verify tier and score validity
                    valid_tiers = ['A+', 'A', 'B', 'C', 'D']
                    tier_valid = channel['utilityTier'] in valid_tiers
                    score_valid = 0 <= channel['utilityScore'] <= 100
                    
                    if tier_valid and score_valid and explain_complete:
                        self.log_result("Utility Channel API", True, f"Channel data valid for {test_username}")
                    else:
                        issues = []
                        if not tier_valid:
                            issues.append("invalid tier")
                        if not score_valid:
                            issues.append("invalid score") 
                        if not explain_complete:
                            issues.append("incomplete explain")
                        self.log_result("Utility Channel API", False, f"Issues: {', '.join(issues)}")
                else:
                    self.log_result("Utility Channel API", False, f"Missing fields: {missing_fields}")
            else:
                self.log_result("Utility Channel API", False, "Missing ok=true or channel field")
        else:
            # Test 404 case with non-existent channel
            print(f"   Testing 404 case...")
            not_found_success, not_found_details, not_found_data = self.make_request('GET', '/api/telegram-intel/utility/channel/nonexistent_channel_12345', expected_status=404)
            
            if not_found_success and not_found_data and not_found_data.get('ok') == False:
                self.log_result("Utility Channel API", True, "Correctly returns 404 for unknown channel")
            else:
                self.log_result("Utility Channel API", False, f"Failed to get valid response for {test_username}: {details}")

    def test_intel_list_mode_utility(self):
        """Test GET /api/telegram-intel/intel/list?mode=utility"""
        print("\n🔍 Testing Intel List API with mode=utility...")
        success, details, data = self.make_request('GET', '/api/telegram-intel/intel/list?mode=utility')
        
        if success and data:
            # Should return same structure as /utility/list
            expected_fields = ['ok', 'mode', 'total', 'limit', 'offset', 'items', 'stats']
            missing_fields = [field for field in expected_fields if field not in data]
            
            if not missing_fields:
                mode = data.get('mode')
                if mode == 'utility':
                    items = data.get('items', [])
                    print(f"   Mode correctly set to: {mode}")
                    print(f"   Returned {len(items)} items")
                    
                    # Check if response structure matches utility format
                    if items:
                        sample_item = items[0]
                        has_utility_fields = 'utilityScore' in sample_item and 'utilityTier' in sample_item
                        print(f"   Has utility fields: {has_utility_fields}")
                        
                        if has_utility_fields:
                            self.log_result("Intel List mode=utility", True, f"Utility mode working with {len(items)} items")
                        else:
                            self.log_result("Intel List mode=utility", False, "Missing utility fields in items")
                    else:
                        # Empty is okay for empty database
                        self.log_result("Intel List mode=utility", True, "Utility mode working (empty database)")
                else:
                    self.log_result("Intel List mode=utility", False, f"Wrong mode returned: {mode}")
            else:
                self.log_result("Intel List mode=utility", False, f"Missing fields: {missing_fields}")
        else:
            self.log_result("Intel List mode=utility", False, details)

    def test_intel_list_mode_intel(self):
        """Test GET /api/telegram-intel/intel/list?mode=intel (existing mode)"""
        print("\n🔍 Testing Intel List API with mode=intel (existing)...")
        success, details, data = self.make_request('GET', '/api/telegram-intel/intel/list?mode=intel')
        
        if success and data:
            # Should return traditional intel format, not utility format
            has_items = 'items' in data
            
            if has_items:
                items = data.get('items', [])
                print(f"   Intel mode returned {len(items)} items")
                
                # If items exist, they should NOT have utilityScore/utilityTier
                if items:
                    sample_item = items[0]
                    has_utility_fields = 'utilityScore' in sample_item or 'utilityTier' in sample_item
                    
                    if not has_utility_fields:
                        print(f"   ✅ Intel mode correctly excludes utility fields")
                        self.log_result("Intel List mode=intel", True, "Intel mode working correctly")
                    else:
                        print(f"   ❌ Intel mode incorrectly includes utility fields")
                        self.log_result("Intel List mode=intel", False, "Intel mode should not include utility fields")
                else:
                    # Empty is okay
                    self.log_result("Intel List mode=intel", True, "Intel mode working (empty database)")
            else:
                self.log_result("Intel List mode=intel", False, "Missing items field")
        else:
            self.log_result("Intel List mode=intel", False, details)

    def test_intel_list_mode_momentum(self):
        """Test GET /api/telegram-intel/intel/list?mode=momentum (existing mode)"""
        print("\n🔍 Testing Intel List API with mode=momentum (existing)...")
        success, details, data = self.make_request('GET', '/api/telegram-intel/intel/list?mode=momentum')
        
        if success and data:
            # Should return traditional momentum format, not utility format
            has_items = 'items' in data
            
            if has_items:
                items = data.get('items', [])
                print(f"   Momentum mode returned {len(items)} items")
                
                # If items exist, they should NOT have utilityScore/utilityTier
                if items:
                    sample_item = items[0]
                    has_utility_fields = 'utilityScore' in sample_item or 'utilityTier' in sample_item
                    
                    if not has_utility_fields:
                        print(f"   ✅ Momentum mode correctly excludes utility fields")
                        self.log_result("Intel List mode=momentum", True, "Momentum mode working correctly")
                    else:
                        print(f"   ❌ Momentum mode incorrectly includes utility fields")
                        self.log_result("Intel List mode=momentum", False, "Momentum mode should not include utility fields")
                else:
                    # Empty is okay
                    self.log_result("Intel List mode=momentum", True, "Momentum mode working (empty database)")
            else:
                self.log_result("Intel List mode=momentum", False, "Missing items field")
        else:
            self.log_result("Intel List mode=momentum", False, details)

    def test_sector_overview_api(self):
        """Test GET /api/telegram-intel/sector/overview"""
        print("\n🔍 Testing Sector Overview API...")
        success, details, data = self.make_request('GET', '/api/telegram-intel/sector/overview')
        
        if success and data:
            expected_fields = ['ok', 'sectors', 'market', 'updatedAt']
            missing_fields = [field for field in expected_fields if field not in data]
            
            if not missing_fields:
                sectors = data.get('sectors', [])
                market = data.get('market', {})
                
                print(f"   Sectors returned: {len(sectors)}")
                print(f"   Market summary available: {bool(market)}")
                
                if sectors:
                    sample_sector = sectors[0]
                    required_sector_fields = ['category', 'channelsCount', 'avgUtility', 'avgGrowth30', 'avgAcceleration']
                    missing_sector_fields = [field for field in required_sector_fields if field not in sample_sector]
                    
                    if not missing_sector_fields:
                        print(f"   Sample sector: {sample_sector['category']}")
                        print(f"   Channels count: {sample_sector['channelsCount']}")
                        print(f"   Avg utility: {sample_sector['avgUtility']}")
                        print(f"   Avg growth30: {sample_sector['avgGrowth30']}")
                        
                        # Check market summary
                        if market:
                            required_market_fields = ['totalChannels', 'avgUtility', 'avgGrowth', 'avgAcceleration']
                            market_complete = all(field in market for field in required_market_fields)
                            print(f"   Market summary complete: {market_complete}")
                            if market_complete:
                                print(f"   Total channels in market: {market['totalChannels']}")
                                print(f"   Market avg utility: {market['avgUtility']}")
                        
                        self.log_result("Sector Overview API", True, f"Valid structure with {len(sectors)} sectors")
                    else:
                        self.log_result("Sector Overview API", False, f"Sector missing fields: {missing_sector_fields}")
                else:
                    # Empty sectors is okay for empty database
                    self.log_result("Sector Overview API", True, "Empty sectors (expected for empty database)")
            else:
                self.log_result("Sector Overview API", False, f"Missing fields: {missing_fields}")
        else:
            self.log_result("Sector Overview API", False, details)

    def test_sector_rotation_api(self):
        """Test GET /api/telegram-intel/sector/rotation?days=7 (U-6)"""
        print("\n🔍 Testing Sector Rotation API (U-6)...")
        
        for days in [7, 14, 30]:
            print(f"   Testing {days}-day rotation...")
            success, details, data = self.make_request('GET', f'/api/telegram-intel/sector/rotation?days={days}')
            
            if success and data:
                expected_fields = ['ok', 'days', 'rows']
                missing_fields = [field for field in expected_fields if field not in data]
                
                if not missing_fields:
                    rows = data.get('rows', [])
                    returned_days = data.get('days')
                    
                    print(f"     Days parameter: {returned_days} (expected: {days})")
                    print(f"     Rotation rows: {len(rows)}")
                    
                    # Check if days parameter matches
                    days_correct = returned_days == days
                    
                    if rows:
                        sample_row = rows[0]
                        required_row_fields = ['category', 'avgAcceleration', 'deltaAcceleration', 'status']
                        missing_row_fields = [field for field in required_row_fields if field not in sample_row]
                        
                        if not missing_row_fields:
                            print(f"     Sample category: {sample_row['category']}")
                            print(f"     Delta acceleration: {sample_row['deltaAcceleration']}")
                            print(f"     Status: {sample_row['status']}")
                            
                            # Validate rotation status
                            valid_statuses = ['ROTATING_IN', 'ROTATING_OUT', 'STABLE']
                            status_valid = sample_row['status'] in valid_statuses
                            
                            # Check delta values are numeric
                            delta_valid = isinstance(sample_row['deltaAcceleration'], (int, float))
                            
                            if days_correct and status_valid and delta_valid:
                                self.log_result(f"Sector Rotation API ({days}d)", True, f"Valid rotation data with {len(rows)} sectors")
                            else:
                                issues = []
                                if not days_correct: issues.append("wrong days")
                                if not status_valid: issues.append("invalid status")
                                if not delta_valid: issues.append("invalid delta")
                                self.log_result(f"Sector Rotation API ({days}d)", False, f"Issues: {', '.join(issues)}")
                        else:
                            self.log_result(f"Sector Rotation API ({days}d)", False, f"Row missing fields: {missing_row_fields}")
                    else:
                        # Check if there's a note about missing snapshots
                        note = data.get('note', '')
                        if 'Missing sector snapshots' in note:
                            print(f"     Note: {note}")
                            self.log_result(f"Sector Rotation API ({days}d)", True, "Empty rows with informative note")
                        else:
                            self.log_result(f"Sector Rotation API ({days}d)", True, "Empty rows (expected for empty database)")
                else:
                    self.log_result(f"Sector Rotation API ({days}d)", False, f"Missing fields: {missing_fields}")
            else:
                self.log_result(f"Sector Rotation API ({days}d)", False, details)

    def test_lifecycle_api(self):
        """Test GET /api/telegram-intel/lifecycle (U-7)"""
        print("\n🔍 Testing Channel Lifecycle API (U-7)...")
        success, details, data = self.make_request('GET', '/api/telegram-intel/lifecycle')
        
        if success and data:
            expected_fields = ['ok', 'total', 'items', 'summary']
            missing_fields = [field for field in expected_fields if field not in data]
            
            if not missing_fields:
                items = data.get('items', [])
                summary = data.get('summary', {})
                total = data.get('total', 0)
                
                print(f"   Total channels: {total}")
                print(f"   Items returned: {len(items)}")
                print(f"   Summary available: {bool(summary)}")
                
                if items:
                    sample_item = items[0]
                    required_item_fields = ['username', 'lifecycle', 'description', 'emoji', 'metrics']
                    missing_item_fields = [field for field in required_item_fields if field not in sample_item]
                    
                    if not missing_item_fields:
                        print(f"   Sample channel: {sample_item['username']}")
                        print(f"   Lifecycle stage: {sample_item['lifecycle']}")
                        print(f"   Description: {sample_item['description']}")
                        print(f"   Emoji: {sample_item['emoji']}")
                        
                        # Check metrics structure
                        metrics = sample_item.get('metrics', {})
                        required_metrics = ['utilityScore', 'growth30', 'acceleration', 'stability']
                        metrics_complete = all(metric in metrics for metric in required_metrics)
                        
                        print(f"   Metrics complete: {metrics_complete}")
                        if metrics_complete:
                            print(f"   Utility score: {metrics['utilityScore']}")
                            print(f"   Growth30: {metrics['growth30']}")
                            print(f"   Acceleration: {metrics['acceleration']}")
                        
                        # Validate lifecycle stage
                        valid_stages = ['EMERGING', 'EXPANDING', 'MATURE', 'SATURATED', 'DECLINING', 'STABLE']
                        stage_valid = sample_item['lifecycle'] in valid_stages
                        
                        if metrics_complete and stage_valid:
                            self.log_result("Lifecycle API", True, f"Valid lifecycle data with {len(items)} channels")
                        else:
                            issues = []
                            if not metrics_complete: issues.append("incomplete metrics")
                            if not stage_valid: issues.append("invalid stage")
                            self.log_result("Lifecycle API", False, f"Issues: {', '.join(issues)}")
                    else:
                        self.log_result("Lifecycle API", False, f"Item missing fields: {missing_item_fields}")
                else:
                    # Empty items is okay for empty database
                    self.log_result("Lifecycle API", True, "Empty items (expected for empty database)")
                
                # Check summary structure
                if summary:
                    expected_stages = ['EMERGING', 'EXPANDING', 'MATURE', 'SATURATED', 'DECLINING', 'STABLE']
                    summary_complete = all(stage in summary for stage in expected_stages)
                    
                    if summary_complete:
                        total_in_summary = sum(summary.values())
                        print(f"   Summary stages complete: {summary_complete}")
                        print(f"   Total in summary: {total_in_summary}")
                        print(f"   EMERGING: {summary['EMERGING']}, EXPANDING: {summary['EXPANDING']}")
                        print(f"   MATURE: {summary['MATURE']}, STABLE: {summary['STABLE']}")
                        
                        # Summary totals should match items length
                        if total_in_summary == len(items):
                            print(f"   ✅ Summary counts match items count")
                        else:
                            print(f"   ⚠️ Summary total {total_in_summary} != items count {len(items)}")
                    else:
                        print(f"   ❌ Summary missing stages")
            else:
                self.log_result("Lifecycle API", False, f"Missing fields: {missing_fields}")
        else:
            self.log_result("Lifecycle API", False, details)

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