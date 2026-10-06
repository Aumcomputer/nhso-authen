const path = require('path');
const envPath = path.resolve(__dirname, '../../.env');
require('dotenv').config({ path: envPath });

const config = {
  port: process.env.PORT || 4100,
  envPath,

  // Token endpoints
  tokenUrl: process.env.NHSO_TOKEN_URL || 'https://srmportal.nhso.go.th/api/scard/access-token',
  refreshToken: process.env.NHSO_REFRESH_TOKEN || '',
  accessToken: process.env.NHSO_ACCESS_TOKEN || '',

  // API 1: Right search
  rightSearchUrl: process.env.NHSO_RIGHT_SEARCH_URL || 'https://srm.nhso.go.th/api/ucws/v1/right-search',

  // API 2: Authencode history (Legacy & New Report)
  authenHistoryUrl: process.env.NHSO_AUTHEN_HISTORY_URL || 'https://authenservice.nhso.go.th/authencode/api/authencode-history',
  authenReportUrl: process.env.NHSO_AUTHEN_REPORT_URL || 'https://authenservice.nhso.go.th/authencode/api/authencode-report',
  authenCookie: process.env.AUTHEN_COOKIE || '',

  // Hospital & Zone configuration
  hcode: process.env.NHSO_HCODE || '10677',
  provinceCode: process.env.NHSO_PROVINCE_CODE || '7000',
  zoneCode: process.env.NHSO_ZONE_CODE || '05',

  // Agent Security Configuration
  agentSecret: process.env.AGENT_SECRET || 'nhso-agent-secret-10677-rbh',
  allowedSubnets: process.env.ALLOWED_SUBNETS || '10.,192.168.,172.,127.0.0.1,::1',

  // JWT Configuration
  jwtSecret: process.env.JWT_SECRET || 'nhso-authen-jwt-secret-key-rbh-10677',

  // HOSxP Database Configuration
  db: {
    host: process.env.HOS_DB_HOST || process.env.HIS_DB_HOST || '10.10.10.43',
    port: parseInt(process.env.HOS_DB_PORT || process.env.HIS_DB_PORT || '3306', 10),
    user: process.env.HOS_DB_USER || process.env.HIS_DB_USER || 'computercenter',
    password: process.env.HOS_DB_PASSWORD || process.env.HIS_DB_PASSWORD || '',
    database: process.env.HOS_DB_NAME || process.env.HIS_DB_NAME || 'hos',
    charset: 'tis620',
    initSql: 'SET NAMES tis620',
    connectionLimit: 10
  },

  // D-Flow Database Configuration
  dflowDb: {
    host: process.env.DFLOW_DB_HOST || '10.10.10.17',
    port: parseInt(process.env.DFLOW_DB_PORT || '3306', 10),
    user: process.env.DFLOW_DB_USER || 'd-flow',
    password: process.env.DFLOW_DB_PASSWORD || 'd-Flow#106789',
    database: process.env.DFLOW_DB_NAME || 'd-flow',
    connectionLimit: 10
  }
};

module.exports = config;
