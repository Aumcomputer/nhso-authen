const mariadb = require('mariadb');
const config = require('./config');

// Support BigInt serialization in JSON responses
BigInt.prototype.toJSON = function () {
  const n = Number(this);
  return Number.isSafeInteger(n) ? n : this.toString();
};

const hosPool = mariadb.createPool({
  host: config.db.host,
  user: config.db.user,
  password: config.db.password,
  database: config.db.database,
  port: config.db.port,
  charset: config.db.charset,
  initSql: config.db.initSql,
  connectionLimit: config.db.connectionLimit
});

/**
 * Execute a query on HOSxP Database
 * @param {string} sql
 * @param {Array} [params]
 */
async function query(sql, params = []) {
  let conn;
  try {
    conn = await hosPool.getConnection();
    const rows = await conn.query(sql, params);
    return rows;
  } finally {
    if (conn) conn.release();
  }
}

/**
 * Test HOSxP Database Connection
 */
async function testConnection() {
  try {
    const result = await query('SELECT 1 AS connected, NOW() AS server_time');
    return {
      connected: true,
      data: result[0]
    };
  } catch (err) {
    return {
      connected: false,
      error: err.message
    };
  }
}

// D-Flow Database Pool
const dflowPool = mariadb.createPool({
  host: config.dflowDb.host,
  user: config.dflowDb.user,
  password: config.dflowDb.password,
  database: config.dflowDb.database,
  port: config.dflowDb.port,
  connectionLimit: config.dflowDb.connectionLimit
});

/**
 * Execute a query on D-Flow Database
 * @param {string} sql
 * @param {Array} [params]
 */
async function dflowQuery(sql, params = []) {
  let conn;
  try {
    conn = await dflowPool.getConnection();
    const rows = await conn.query(sql, params);
    return rows;
  } finally {
    if (conn) conn.release();
  }
}

/**
 * Test D-Flow Database Connection
 */
async function testDflowConnection() {
  try {
    const result = await dflowQuery('SELECT 1 AS connected, NOW() AS server_time');
    const tables = await dflowQuery('SHOW TABLES');
    return {
      connected: true,
      data: result[0],
      tables: tables.map(t => Object.values(t)[0])
    };
  } catch (err) {
    return {
      connected: false,
      error: err.message
    };
  }
}

module.exports = {
  hosPool,
  getHosConnection: () => hosPool.getConnection(),
  query,
  testConnection,
  dflowPool,
  getDflowConnection: () => dflowPool.getConnection(),
  dflowQuery,
  testDflowConnection
};
