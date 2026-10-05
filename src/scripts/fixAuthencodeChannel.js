const { dflowQuery } = require('../config/database');
const nhsoClient = require('../services/nhsoClient');

async function fixAuthencodeChannel() {
  console.log('--- Starting migration for existing ENDPOINT records in vn_nhso_authen ---');

  const rows = await dflowQuery(
    "SELECT vn, pid, SUBSTRING(received_datetime, 1, 10) as vstdate, claim_code FROM vn_nhso_authen WHERE source_channel = 'ENDPOINT'"
  );

  console.log(`Found ${rows.length} records with source_channel = 'ENDPOINT' to process.`);

  let updatedCount = 0;
  let clearedCount = 0;
  let skippedCount = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const { vn, pid, vstdate } = row;

    try {
      const authenList = await nhsoClient.getAuthenHistory(pid);
      if (!Array.isArray(authenList) || authenList.length === 0) {
        skippedCount++;
        continue;
      }

      // Filter matching target date with sourceChannel = 'AUTHENCODE'
      const matchingAuths = authenList.filter(item => {
        if (!item.receivedDateTime) return false;
        if (vstdate && !item.receivedDateTime.startsWith(vstdate)) return false;
        const channel = String(item.sourceChannel || item.source_channel || '').trim().toUpperCase();
        if (channel === 'AUTHENCODE') return true;
        if (!channel && item.claimAuthen && ['SMC', 'KOS', 'INP'].includes(String(item.claimAuthen).trim().toUpperCase())) {
          return true;
        }
        return false;
      });

      if (matchingAuths.length > 0) {
        // Sort descending by receivedDateTime
        matchingAuths.sort((a, b) => new Date(b.receivedDateTime) - new Date(a.receivedDateTime));
        const auth = matchingAuths[0];

        const claimCode = auth.claimCode || null;
        const claimType = auth.claimType || null;
        const claimTypeName = auth.claimTypeName || auth.claimTypePackage || null;
        const receivedDatetime = auth.receivedDateTime ? new Date(auth.receivedDateTime.replace(' ', 'T')) : null;
        const sourceChannel = 'AUTHENCODE';
        const claimAuthen = auth.claimAuthen || null;
        const claimStatus = auth.claimStatus || null;
        const authenStatus = (auth.status === 'SAVE' || auth.claimStatus === 'E') ? 'ยืนยันแล้ว' : (auth.status || null);
        const authenHcode = auth.hcode || null;
        const authenHname = auth.hname || null;
        const authenAge = auth.age || null;
        const hnCode = auth.hnCode || null;
        const authenJson = JSON.stringify(auth);

        await dflowQuery(
          `UPDATE vn_nhso_authen SET
            claim_code = ?,
            claim_type = ?,
            claim_type_name = ?,
            received_datetime = ?,
            source_channel = ?,
            claim_authen = ?,
            claim_status = ?,
            authen_status = ?,
            authen_hcode = ?,
            authen_hname = ?,
            authen_age = ?,
            hn_code = COALESCE(?, hn_code),
            authen_json = ?,
            updated_at = NOW()
          WHERE vn = ?`,
          [
            claimCode, claimType, claimTypeName, receivedDatetime,
            sourceChannel, claimAuthen, claimStatus, authenStatus,
            authenHcode, authenHname, authenAge, hnCode,
            authenJson, vn
          ]
        );

        updatedCount++;
        console.log(`[${i + 1}/${rows.length}] VN ${vn}: Replaced ${row.claim_code} -> ${claimCode} (AUTHENCODE)`);
      } else {
        // No AUTHENCODE found on visit date: clear the ENDPOINT claim code
        await dflowQuery(
          `UPDATE vn_nhso_authen SET
            claim_code = NULL,
            claim_type = NULL,
            claim_type_name = NULL,
            source_channel = NULL,
            claim_authen = NULL,
            claim_status = NULL,
            authen_status = NULL,
            authen_json = NULL,
            updated_at = NOW()
          WHERE vn = ?`,
          [vn]
        );
        clearedCount++;
        console.log(`[${i + 1}/${rows.length}] VN ${vn}: Cleared ENDPOINT (${row.claim_code}) as no AUTHENCODE was found`);
      }
    } catch (err) {
      console.error(`Error processing VN ${vn}:`, err.message);
      skippedCount++;
    }
  }

  console.log('--- Migration Finished ---');
  console.log(`Total: ${rows.length} | Updated to AUTHENCODE: ${updatedCount} | Cleared: ${clearedCount} | Skipped: ${skippedCount}`);
}

if (require.main === module) {
  fixAuthencodeChannel()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('Migration failed:', err);
      process.exit(1);
    });
}

module.exports = fixAuthencodeChannel;
