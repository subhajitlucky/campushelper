/**
 * Production Authentication Test Script
 * 
 * This script helps test if the authentication fix is working in production.
 * 
 * Usage:
 * 1. Open browser developer tools
 * 2. Go to https://campushelper.vercel.app
 * 3. Log in successfully
 * 4. Open console and paste this script
 * 5. Run the test to verify authentication is working
 */

async function testProductionAuth() {
    console.log('🔍 Testing Production Authentication...');
    
    try {
        // Test 1: Check if user is logged in by fetching dashboard
        console.log('\n1️⃣ Testing dashboard access...');
        const dashboardResponse = await fetch('/api/auth/session');
        const sessionData = await dashboardResponse.json();
        
        if (sessionData?.user) {
            console.log('✅ User is logged in:', {
                name: sessionData.user.name,
                email: sessionData.user.email,
                id: sessionData.user.id
            });
        } else {
            console.log('❌ No session found - user not logged in');
            return;
        }
        
        // Test 2: Test comments API with authenticated session
        console.log('\n2️⃣ Testing comments API with authentication...');
        const commentsResponse = await fetch('/api/comments?itemId=test-item-id', {
            credentials: 'include'  // This should include the session cookies
        });
        
        if (commentsResponse.status === 401) {
            console.log('❌ Authentication failed - got 401 status');
            console.log('Response:', await commentsResponse.json());
            console.log('\n🔧 The fix may not be deployed yet or environment variables are missing');
        } else if (commentsResponse.status === 400) {
            console.log('⚠️ Got 400 status - this is expected for invalid itemId, but authentication passed!');
            console.log('✅ Authentication is working! (400 is expected for invalid itemId)');
        } else {
            console.log('✅ Comments API responded with status:', commentsResponse.status);
            console.log('Response:', await commentsResponse.json());
        }
        
        // Test 3: Check cookies
        console.log('\n3️⃣ Checking authentication cookies...');
        const cookies = document.cookie.split(';').filter(cookie => 
            cookie.includes('next-auth') || cookie.includes('campushelper')
        );
        
        if (cookies.length > 0) {
            console.log('✅ Found authentication cookies:', cookies.length);
            cookies.forEach((cookie, index) => {
                console.log(`  ${index + 1}. ${cookie.split('=')[0]}: ${cookie.includes('session-token') ? '[SESSION TOKEN PRESENT]' : '[OTHER COOKIE]'}`);
            });
        } else {
            console.log('❌ No authentication cookies found');
        }
        
    } catch (error) {
        console.error('❌ Test failed with error:', error);
    }
}

// Export for manual testing
if (typeof window !== 'undefined') {
    window.testProductionAuth = testProductionAuth;
    console.log('📋 Test script loaded! Run testProductionAuth() to test authentication.');
    console.log('💡 Or paste this in console: testProductionAuth()');
}

// Auto-run if this is the only script
if (typeof window !== 'undefined' && !window.testProductionAuth) {
    testProductionAuth();
}
