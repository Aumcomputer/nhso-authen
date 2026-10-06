const { dflowPool, hosPool } = require('../config/database');

async function setupNoAuthenExemptTable() {
  try {
    console.log('[Setup] Creating nhso_no_authen_exempt_pttypes table in d-flow database...');

    const createTableSql = `
      CREATE TABLE IF NOT EXISTS nhso_no_authen_exempt_pttypes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        pttype VARCHAR(10) NOT NULL UNIQUE,
        name VARCHAR(255) NULL,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        note VARCHAR(255) NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        created_by VARCHAR(100) NULL,
        INDEX idx_pttype (pttype),
        INDEX idx_active (is_active)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;

    await dflowPool.query(createTableSql);
    console.log('[Setup] Table nhso_no_authen_exempt_pttypes created or already exists.');

    // Seed default pttypes: 78, 79, 80, 88
    const defaultCodes = ['78', '79', '80', '88'];

    for (const code of defaultCodes) {
      const existing = await dflowPool.query(
        'SELECT id FROM nhso_no_authen_exempt_pttypes WHERE UPPER(pttype) = UPPER(?)',
        [code]
      );
      if (existing.length === 0) {
        let pttypeName = '';
        try {
          const hosRows = await hosPool.query(
            'SELECT name FROM pttype WHERE UPPER(pttype) = UPPER(?) LIMIT 1',
            [code]
          );
          if (hosRows.length > 0) pttypeName = hosRows[0].name;
        } catch (err) {
          console.warn('[Setup] Could not fetch name from HOSxP for', code);
        }

        await dflowPool.query(
          `INSERT INTO nhso_no_authen_exempt_pttypes (pttype, name, is_active, note, created_by) VALUES (?, ?, 1, 'ยกเว้นการบอกว่ายังไม่มี Authen ตามเงื่อนไขเริ่มต้น', 'system')`,
          [code, pttypeName || code]
        );
        console.log(`[Setup] Inserted default no-authen exempt pttype: ${code} (${pttypeName})`);
      }
    }

    const currentRows = await dflowPool.query(
      'SELECT id, pttype, name, is_active FROM nhso_no_authen_exempt_pttypes ORDER BY id ASC'
    );
    console.log('[Setup] Current nhso_no_authen_exempt_pttypes records:', currentRows);
    console.log('[Setup] Done setupNoAuthenExemptTable successfully.');
  } catch (error) {
    console.error('[Setup Error] Failed to setup nhso_no_authen_exempt_pttypes:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

setupNoAuthenExemptTable();
