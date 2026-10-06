require('dotenv').config();
const { dflowPool } = require('../config/database');

async function setupAuthUsersTable() {
  console.log('--- Setting up nhso_auth_users table in dflow database ---');
  try {
    const createTableSql = `
      CREATE TABLE IF NOT EXISTS nhso_auth_users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        loginname VARCHAR(100) NOT NULL UNIQUE,
        name VARCHAR(250) DEFAULT NULL,
        role ENUM('admin', 'user') DEFAULT 'user',
        is_active TINYINT(1) DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        created_by VARCHAR(100) DEFAULT NULL,
        INDEX idx_loginname (loginname),
        INDEX idx_is_active (is_active)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;
    await dflowPool.query(createTableSql);
    console.log('Table nhso_auth_users created or already exists.');

    const count = await dflowPool.query('SELECT COUNT(*) as cnt FROM nhso_auth_users');
    console.log(`Current users in nhso_auth_users: ${count[0].cnt}`);
  } catch (err) {
    console.error('Error creating nhso_auth_users table:', err);
  } finally {
    process.exit(0);
  }
}

setupAuthUsersTable();
