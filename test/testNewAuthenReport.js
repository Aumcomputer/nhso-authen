const axios = require('axios');
const { dflowQuery } = require('../src/config/database');

async function runVerification() {
  console.log('====================================================');
  console.log('🧪 Testing New Authen Report & DB Persistence');
  console.log('====================================================');

  const pid = '3770600769826';
  const vn = '690928075126';
  const vstdate = '2026-09-28';

  // 1. Test GET /api/authen-history/:pid?vstdate=2026-09-28
  console.log(`\n[Test 1] GET /api/authen-history/${pid}?vstdate=${vstdate}`);
  const historyRes = await axios.get(`http://localhost:4100/api/authen-history/${pid}?vstdate=${vstdate}`);
  console.log('HTTP Status:', historyRes.status);
  console.log('Success:', historyRes.data.success);
  console.log('Total elements:', historyRes.data.totalElements);
  console.log('Items returned:', historyRes.data.data.length);

  if (historyRes.data.data.length === 0) {
    throw new Error('Expected items in authen history, got 0');
  }

  const sample = historyRes.data.data[0];
  console.log('Sample item:', {
    transId: sample.transId,
    claimCode: sample.claimCode,
    claimDate: sample.claimDate,
    createDate: sample.createDate,
    sourceChannel: sample.sourceChannel,
    claimAuthen: sample.claimAuthen
  });

  // 2. Verify rows in nhso_authen_history
  console.log(`\n[Test 2] Querying nhso_authen_history table for personal_id = '${pid}'...`);
  const historyRows = await dflowQuery(
    'SELECT trans_id, personal_id, claim_code, claim_date, create_date, source_channel, claim_authen, LENGTH(raw_json) as raw_len FROM nhso_authen_history WHERE personal_id = ? ORDER BY claim_date DESC, create_date DESC',
    [pid]
  );
  console.log(`✅ Found ${historyRows.length} rows in nhso_authen_history`);
  historyRows.forEach((r, idx) => {
    console.log(`  Row ${idx + 1}: transId=${r.trans_id}, code=${r.claim_code}, date=${r.claim_date?.toISOString()}, createDate=${r.create_date?.toISOString()}, ch=${r.source_channel}, auth=${r.claim_authen}, rawLen=${r.raw_len} bytes`);
  });

  const channels = new Set(historyRows.map(r => r.source_channel));
  console.log(`Distinct sourceChannels saved in DB:`, Array.from(channels));

  // 3. Test check-and-save for VN
  console.log(`\n[Test 3] POST /api/vn-authen/check-and-save for VN: ${vn}...`);
  const saveRes = await axios.post('http://localhost:4100/api/vn-authen/check-and-save', {
    vn,
    cid: pid,
    vstdate,
    force: true
  });
  console.log('HTTP Status:', saveRes.status);
  console.log('Success:', saveRes.data.success);
  console.log('hasTodayAuthen:', saveRes.data.hasTodayAuthen);
  console.log('Primary Saved Authen:', {
    vn: saveRes.data.data.vn,
    cid: saveRes.data.data.pid,
    claim_code: saveRes.data.data.claim_code,
    trans_id: saveRes.data.data.trans_id,
    create_date: saveRes.data.data.create_date,
    source_channel: saveRes.data.data.source_channel,
    claim_authen: saveRes.data.data.claim_authen,
    tel: saveRes.data.data.tel
  });

  if (saveRes.data.data.source_channel !== 'AUTHENCODE') {
    throw new Error(`Expected source_channel 'AUTHENCODE', got '${saveRes.data.data.source_channel}'`);
  }

  // 4. Verify DB row in vn_nhso_authen
  console.log(`\n[Test 4] Querying vn_nhso_authen table for VN: ${vn}...`);
  const vnRows = await dflowQuery('SELECT vn, pid, claim_code, trans_id, create_date, source_channel, claim_authen, tel FROM vn_nhso_authen WHERE vn = ?', [vn]);
  if (vnRows.length === 0) {
    throw new Error(`VN ${vn} not found in vn_nhso_authen`);
  }
  console.log('✅ vn_nhso_authen DB record:', vnRows[0]);

  console.log('\n====================================================');
  console.log('🎉 ALL TESTS PASSED SUCCESSFULLY!');
  console.log('====================================================');
  process.exit(0);
}

runVerification().catch(err => {
  console.error('\n❌ Test failed:', err.message, err.response?.data);
  process.exit(1);
});
