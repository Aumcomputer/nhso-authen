const { dflowQuery } = require('../config/database');

async function setupAuthenHistoryTable() {
  console.log('--- Setting up nhso_authen_history and updating vn_nhso_authen columns ---');

  // 1. Update vn_nhso_authen columns
  const cols = await dflowQuery('DESCRIBE vn_nhso_authen');
  const colNames = cols.map(c => c.Field);

  if (!colNames.includes('create_date')) {
    await dflowQuery("ALTER TABLE vn_nhso_authen ADD COLUMN create_date DATETIME DEFAULT NULL COMMENT 'วันที่บันทึก authen createDate' AFTER received_datetime");
    console.log('✅ Added create_date column to vn_nhso_authen');
  }

  if (!colNames.includes('trans_id')) {
    await dflowQuery("ALTER TABLE vn_nhso_authen ADD COLUMN trans_id BIGINT DEFAULT NULL COMMENT 'รหัสธุรกรรม สปสช transId' AFTER claim_code");
    console.log('✅ Added trans_id column to vn_nhso_authen');
  }

  if (!colNames.includes('tel')) {
    await dflowQuery("ALTER TABLE vn_nhso_authen ADD COLUMN tel VARCHAR(30) DEFAULT NULL COMMENT 'เบอร์โทรศัพท์ tel' AFTER nation");
    console.log('✅ Added tel column to vn_nhso_authen');
  }

  // 2. Create nhso_authen_history table
  const sql = `
    CREATE TABLE IF NOT EXISTS \`nhso_authen_history\` (
      \`id\` BIGINT AUTO_INCREMENT PRIMARY KEY,
      \`trans_id\` BIGINT NOT NULL,
      \`personal_id\` VARCHAR(13) NOT NULL,
      \`hmain\` VARCHAR(10) DEFAULT NULL,
      \`hname\` VARCHAR(200) DEFAULT NULL,
      \`patient_name\` VARCHAR(150) DEFAULT NULL,
      \`birthdate\` VARCHAR(50) DEFAULT NULL,
      \`tel\` VARCHAR(30) DEFAULT NULL,
      \`main_inscl\` VARCHAR(20) DEFAULT NULL,
      \`main_inscl_name\` VARCHAR(200) DEFAULT NULL,
      \`sub_inscl\` VARCHAR(20) DEFAULT NULL,
      \`sub_inscl_name\` VARCHAR(255) DEFAULT NULL,
      \`claim_status\` VARCHAR(20) DEFAULT NULL,
      \`patient_type\` VARCHAR(20) DEFAULT NULL,
      \`claim_code\` VARCHAR(50) DEFAULT NULL,
      \`claim_type\` VARCHAR(30) DEFAULT NULL,
      \`claim_type_name\` VARCHAR(255) DEFAULT NULL,
      \`hn_code\` VARCHAR(50) DEFAULT NULL,
      \`claim_date\` DATETIME DEFAULT NULL,
      \`create_date\` DATETIME DEFAULT NULL COMMENT 'วันที่บันทึก',
      \`source_channel\` VARCHAR(50) DEFAULT NULL COMMENT 'ช่องทางการขอ Authen เช่น AUTHENCODE, ENDPOINT',
      \`claim_authen\` VARCHAR(50) DEFAULT NULL COMMENT 'วิธีการพิสูจน์ตัวตน เช่น KOS, SMC, API, INP',
      \`create_by\` VARCHAR(100) DEFAULT NULL,
      \`update_by\` VARCHAR(100) DEFAULT NULL,
      \`update_date\` DATETIME DEFAULT NULL,
      \`raw_json\` LONGTEXT DEFAULT NULL COMMENT 'Raw Response ทุก object',
      \`created_at\` DATETIME DEFAULT CURRENT_TIMESTAMP,
      \`updated_at\` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY \`uk_trans_id\` (\`trans_id\`),
      KEY \`idx_personal_id\` (\`personal_id\`),
      KEY \`idx_claim_date\` (\`claim_date\`),
      KEY \`idx_create_date\` (\`create_date\`),
      KEY \`idx_claim_code\` (\`claim_code\`),
      KEY \`idx_source_channel\` (\`source_channel\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `;

  await dflowQuery(sql);
  console.log('✅ Created / Verified nhso_authen_history table');
  console.log('--- Database Setup Completed ---');
}

if (require.main === module) {
  setupAuthenHistoryTable()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('Setup failed:', err);
      process.exit(1);
    });
}

module.exports = setupAuthenHistoryTable;
