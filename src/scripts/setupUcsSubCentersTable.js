const { dflowPool, hosPool } = require('../config/database');

async function setupUcsSubCentersTable() {
  try {
    console.log('[Setup] Creating nhso_ucs_sub_centers table in d-flow database...');

    const createTableSql = `
      CREATE TABLE IF NOT EXISTS nhso_ucs_sub_centers (
        id INT AUTO_INCREMENT PRIMARY KEY,
        hospcode VARCHAR(10) NOT NULL UNIQUE,
        name VARCHAR(255) NULL,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        note VARCHAR(255) NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        created_by VARCHAR(100) NULL,
        INDEX idx_hospcode (hospcode),
        INDEX idx_active (is_active)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;

    await dflowPool.query(createTableSql);
    console.log('[Setup] Table nhso_ucs_sub_centers created or already exists.');

    // Seed default sub centers: 14317, 08003, 80554, 08005
    const defaultCodes = ['14317', '08003', '80554', '08005'];

    for (const code of defaultCodes) {
      const existing = await dflowPool.query(
        'SELECT id FROM nhso_ucs_sub_centers WHERE UPPER(hospcode) = UPPER(?)',
        [code]
      );
      if (existing.length === 0) {
        let hospName = '';
        try {
          const hosRows = await hosPool.query(
            'SELECT name FROM hospcode WHERE hospcode = ? LIMIT 1',
            [code]
          );
          if (hosRows.length > 0) {
            hospName = hosRows[0].name;
          } else {
            // Check vn_nhso_authen
            const dflowSub = await dflowPool.query(
              'SELECT hospsub_name FROM vn_nhso_authen WHERE hospsub_code = ? AND hospsub_name IS NOT NULL LIMIT 1',
              [code]
            );
            if (dflowSub.length > 0) hospName = dflowSub[0].hospsub_name;
          }
        } catch (err) {
          console.warn('[Setup] Could not fetch name for', code);
        }

        await dflowPool.query(
          `INSERT INTO nhso_ucs_sub_centers (hospcode, name, is_active, note, created_by) VALUES (?, ?, 1, 'รพ.สต. ที่หาก hospmain เป็น 10677 ให้กำหนดสิทธิ UCS เป็น 92', 'system')`,
          [code, hospName || code]
        );
        console.log(`[Setup] Inserted default UCS sub center: ${code} (${hospName})`);
      }
    }

    const currentRows = await dflowPool.query(
      'SELECT id, hospcode, name, is_active FROM nhso_ucs_sub_centers ORDER BY id ASC'
    );
    console.log('[Setup] Current nhso_ucs_sub_centers records:', currentRows);
    console.log('[Setup] Done setupUcsSubCentersTable successfully.');
  } catch (error) {
    console.error('[Setup Error] Failed to setup nhso_ucs_sub_centers:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

if (require.main === module) {
  setupUcsSubCentersTable();
}

module.exports = { setupUcsSubCentersTable };
