const { dflowQuery } = require('../config/database');

async function setupClientTokensTable() {
  console.log('--- Setting up nhso_client_tokens table in d-flow database ---');

  const sql = `
    CREATE TABLE IF NOT EXISTS \`nhso_client_tokens\` (
      \`id\` INT AUTO_INCREMENT PRIMARY KEY,
      \`client_ip\` VARCHAR(45) NOT NULL COMMENT 'IP เครื่องลูกข่าย',
      \`client_hostname\` VARCHAR(100) DEFAULT NULL COMMENT 'ชื่อเครื่องคอมพิวเตอร์',
      \`username\` VARCHAR(100) DEFAULT NULL COMMENT 'username ในระบบ SRM',
      \`officer_cid\` VARCHAR(13) DEFAULT NULL COMMENT 'เลขบัตร ปชช. เจ้าหน้าที่',
      \`officer_name\` VARCHAR(150) DEFAULT NULL COMMENT 'ชื่อ-นามสกุล เจ้าหน้าที่',
      \`hcode\` VARCHAR(10) DEFAULT NULL COMMENT 'รหัสหน่วยบริการ',
      \`access_token\` TEXT DEFAULT NULL,
      \`refresh_token\` TEXT NOT NULL,
      \`access_expires_at\` DATETIME DEFAULT NULL COMMENT 'วันหมดอายุ Access Token',
      \`refresh_expires_at\` DATETIME DEFAULT NULL COMMENT 'วันหมดอายุ Refresh Token',
      \`status\` ENUM('ACTIVE', 'EXPIRED', 'ERROR') DEFAULT 'ACTIVE',
      \`error_message\` TEXT DEFAULT NULL,
      \`last_sync_at\` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      \`created_at\` DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY \`uk_client_officer\` (\`client_ip\`, \`officer_cid\`),
      KEY \`idx_status\` (\`status\`),
      KEY \`idx_refresh_exp\` (\`refresh_expires_at\`),
      KEY \`idx_hcode\` (\`hcode\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='คลัง Token สปสช. จากเครื่องเจ้าหน้าที่เวชระเบียน';
  `;

  await dflowQuery(sql);
  console.log('✅ Created / Verified nhso_client_tokens table successfully');
}

if (require.main === module) {
  setupClientTokensTable()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('Setup failed:', err);
      process.exit(1);
    });
}

module.exports = setupClientTokensTable;
