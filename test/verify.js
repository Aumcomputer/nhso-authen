const http = require('http');
const { app, server } = require('../src/index');
const tokenManager = require('../src/services/tokenManager');

async function testEndpoint(path, options = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port: 4100,
      path,
      method: options.method || 'GET',
      headers: options.headers || {}
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('error', reject);

    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
}

async function runTests() {
  console.log('\n--- 🧪 Starting Verification Tests ---');

  try {
    // Test 1: Health check
    console.log('\n[Test 1] GET /health');
    const health = await testEndpoint('/health');
    console.log('Status:', health.status, 'Body:', health.body);

    // Test 2: Token Status
    console.log('\n[Test 2] GET /api/token/status');
    const statusRes = await testEndpoint('/api/token/status');
    console.log('Status:', statusRes.status, 'Has Access Token:', statusRes.body.data?.hasAccessToken);
    console.log('User Name:', statusRes.body.data?.accessToken?.name);
    console.log('Organization:', statusRes.body.data?.accessToken?.organization);

    // Test 3: API 1 - ตรวจสอบสิทธิ์ (Right Search)
    console.log('\n[Test 3] GET /api/rights/3240200361280 (ตรวจสอบสิทธิ์)');
    const rightRes = await testEndpoint('/api/rights/3240200361280');
    console.log('Status:', rightRes.status, 'Success:', rightRes.body.success);
    if (rightRes.body.data) {
      console.log('Patient Name:', `${rightRes.body.data.tname || ''}${rightRes.body.data.fname || ''} ${rightRes.body.data.lname || ''}`);
      console.log('Main Inscl:', rightRes.body.data.funds?.[0]?.mainInscl?.name);
      console.log('Sub Inscl:', rightRes.body.data.funds?.[0]?.subInscl?.name);
      console.log('Hospital:', rightRes.body.data.funds?.[0]?.hospMain?.hname);
    }

    // Test 4: API 2 - ดูประวัติ Authen (Authencode History)
    console.log('\n[Test 4] GET /api/authen-history/3240200361280 (ดูประวัติ authen)');
    const historyRes = await testEndpoint('/api/authen-history/3240200361280');
    console.log('Status:', historyRes.status, 'Success:', historyRes.body.success);
    if (historyRes.body.data) {
      console.log('Authen records found:', Array.isArray(historyRes.body.data) ? historyRes.body.data.length : 'N/A');
    }

    // Test 5: Verify Auto-Refresh on 401
    console.log('\n[Test 5] 💥 Simulating 401 Unauthorized with corrupted Access Token...');
    const oldAccessToken = tokenManager.accessToken;
    tokenManager.accessToken = 'corrupted_or_expired_mock_token_for_401_test';
    console.log('Current in-memory token set to invalid string.');

    console.log('Calling GET /api/rights/3240200361280 (should trigger 401 -> auto-refresh -> retry -> 200 OK)...');
    const autoRefreshRes = await testEndpoint('/api/rights/3240200361280');
    console.log('Result Status after auto-refresh:', autoRefreshRes.status, 'Success:', autoRefreshRes.body.success);
    console.log('New Access Token different from old:', tokenManager.accessToken !== oldAccessToken && tokenManager.accessToken !== 'corrupted_or_expired_mock_token_for_401_test');

    // Test 6: Specialties API
    console.log('\n[Test 6] GET /api/specialties');
    const spcltyRes = await testEndpoint('/api/specialties');
    console.log('Status:', spcltyRes.status, 'Specialties count:', spcltyRes.body.data?.length);

    // Test 7: Patient Visits Query (Matches user query for date 2026-09-28 and spclty 02)
    console.log('\n[Test 7] GET /api/visits?vstdate=2026-09-28&spclty=02');
    const visitRes = await testEndpoint('/api/visits?vstdate=2026-09-28&spclty=02');
    console.log('Status:', visitRes.status, 'Total visits:', visitRes.body.total);
    if (visitRes.body.data?.length > 0) {
      const v = visitRes.body.data[0];
      console.log('Sample Patient:', v.ptname, 'HN:', v.hn, 'CID:', v.cid, 'Auth Code:', v.auth_code);
    }

    // Test 8: D-Flow Database Health Check
    console.log('\n[Test 8] GET /api/db/dflow-health');
    const dflowHealthRes = await testEndpoint('/api/db/dflow-health');
    console.log('Status:', dflowHealthRes.status, 'Success:', dflowHealthRes.body.success, 'Database:', dflowHealthRes.body.database);
    console.log('D-Flow Tables:', dflowHealthRes.body.result?.tables?.join(', '));

    // Test 9: Check & Save to vn_nhso_authen
    console.log('\n[Test 9] POST /api/vn-authen/check-and-save');
    const saveRes = await testEndpoint('/api/vn-authen/check-and-save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { vn: '690928143344', cid: '3700800325930', vstdate: '2026-09-28' }
    });
    console.log('Status:', saveRes.status, 'Success:', saveRes.body.success, 'Already saved:', saveRes.body.alreadySaved);


  } catch (err) {
    console.error('Test error:', err);
  } finally {
    server.close(() => {
      console.log('\n--- 🏁 Verification Completed. Server Closed. ---');
      process.exit(0);
    });
  }
}

// Allow server 1s to initialize
setTimeout(runTests, 1000);
