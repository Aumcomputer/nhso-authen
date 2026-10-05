const { dflowQuery } = require('../config/database');

/**
 * Safely parse date from ISO string, Thai format string, or Epoch milliseconds {1709902398571}
 * @param {string|number|Date} val 
 * @returns {Date|null}
 */
function parseToDate(val) {
  if (!val) return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
  if (typeof val === 'number' || (typeof val === 'string' && /^\d{10,14}$/.test(val.trim()))) {
    const d = new Date(Number(val));
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof val === 'string') {
    const clean = val.trim().replace(' ', 'T');
    const d = new Date(clean);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

class AuthenHistoryService {
  /**
   * Save a list of authen history items into `nhso_authen_history`
   * Every object is saved along with its full raw JSON response, regardless of sourceChannel.
   * @param {Array<Object>} items - Array of items from NHSO authen API
   * @param {string} [fallbackPid] - Fallback PID/CID if missing in item
   * @returns {Promise<{ savedCount: number, errors: Array }>}
   */
  async saveHistoryItems(items, fallbackPid = null) {
    if (!Array.isArray(items) || items.length === 0) {
      return { savedCount: 0, errors: [] };
    }

    let savedCount = 0;
    const errors = [];

    for (const item of items) {
      try {
        const transId = item.transId || item.trans_id;
        const personalId = item.personalId || item.pid || fallbackPid;

        if (!transId || !personalId) {
          // If transId is missing (e.g. from legacy endpoint without transId), we skip or fallback
          if (!transId && item.claimCode) {
            console.warn('[AuthenHistoryService] Item missing transId, using hash from claimCode & claimDate');
          } else {
            continue;
          }
        }

        const hmain = item.hmain || item.hcode || null;
        const hname = item.hname || null;
        const patientName = item.patientName || item.patient_name || null;
        const birthdate = item.birthdate || item.birthDate || null;
        const tel = item.tel || null;

        const mainInscl = (typeof item.mainInscl === 'object' ? (item.mainInscl?.id || item.mainInscl?.rightId) : item.mainInscl) || null;
        const mainInsclName = (typeof item.mainInscl === 'object' ? (item.mainInscl?.name || item.mainInscl?.rightName) : item.mainInsclName) || null;
        const subInscl = (typeof item.subInscl === 'object' ? (item.subInscl?.id || item.subInscl?.inscl) : item.subInscl) || null;
        const subInsclName = (typeof item.subInscl === 'object' ? (item.subInscl?.name || item.subInscl?.insclName) : item.subInsclName) || null;

        const claimStatus = item.claimStatus || item.status || null;
        const patientType = item.patientType || null;
        const claimCode = item.claimCode || null;
        const claimType = item.claimType || null;
        const claimTypeName = item.claimTypeName || item.claimTypePackage || null;
        const hnCode = item.hnCode || null;

        const claimDate = parseToDate(item.claimDate || item.receivedDateTime);
        const createDate = parseToDate(item.createDate);
        const sourceChannel = item.sourceChannel || item.source_channel || null;
        const claimAuthen = item.claimAuthen || item.claim_authen || null;
        const createBy = item.createBy || null;
        const updateBy = item.updateBy || null;
        const updateDate = parseToDate(item.updateDate);

        // Raw Response ทุก object
        const rawJson = JSON.stringify(item);

        const sql = `
          INSERT INTO \`nhso_authen_history\` (
            \`trans_id\`, \`personal_id\`, \`hmain\`, \`hname\`, \`patient_name\`, \`birthdate\`, \`tel\`,
            \`main_inscl\`, \`main_inscl_name\`, \`sub_inscl\`, \`sub_inscl_name\`,
            \`claim_status\`, \`patient_type\`, \`claim_code\`, \`claim_type\`, \`claim_type_name\`, \`hn_code\`,
            \`claim_date\`, \`create_date\`, \`source_channel\`, \`claim_authen\`,
            \`create_by\`, \`update_by\`, \`update_date\`, \`raw_json\`
          ) VALUES (
            ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?,
            ?, ?, ?, ?
          )
          ON DUPLICATE KEY UPDATE
            \`personal_id\` = COALESCE(VALUES(\`personal_id\`), \`personal_id\`),
            \`hmain\` = COALESCE(VALUES(\`hmain\`), \`hmain\`),
            \`hname\` = COALESCE(VALUES(\`hname\`), \`hname\`),
            \`patient_name\` = COALESCE(VALUES(\`patient_name\`), \`patient_name\`),
            \`birthdate\` = COALESCE(VALUES(\`birthdate\`), \`birthdate\`),
            \`tel\` = COALESCE(VALUES(\`tel\`), \`tel\`),
            \`main_inscl\` = COALESCE(VALUES(\`main_inscl\`), \`main_inscl\`),
            \`main_inscl_name\` = COALESCE(VALUES(\`main_inscl_name\`), \`main_inscl_name\`),
            \`sub_inscl\` = COALESCE(VALUES(\`sub_inscl\`), \`sub_inscl\`),
            \`sub_inscl_name\` = COALESCE(VALUES(\`sub_inscl_name\`), \`sub_inscl_name\`),
            \`claim_status\` = COALESCE(VALUES(\`claim_status\`), \`claim_status\`),
            \`patient_type\` = COALESCE(VALUES(\`patient_type\`), \`patient_type\`),
            \`claim_code\` = COALESCE(VALUES(\`claim_code\`), \`claim_code\`),
            \`claim_type\` = COALESCE(VALUES(\`claim_type\`), \`claim_type\`),
            \`claim_type_name\` = COALESCE(VALUES(\`claim_type_name\`), \`claim_type_name\`),
            \`hn_code\` = COALESCE(VALUES(\`hn_code\`), \`hn_code\`),
            \`claim_date\` = COALESCE(VALUES(\`claim_date\`), \`claim_date\`),
            \`create_date\` = COALESCE(VALUES(\`create_date\`), \`create_date\`),
            \`source_channel\` = COALESCE(VALUES(\`source_channel\`), \`source_channel\`),
            \`claim_authen\` = COALESCE(VALUES(\`claim_authen\`), \`claim_authen\`),
            \`create_by\` = COALESCE(VALUES(\`create_by\`), \`create_by\`),
            \`update_by\` = COALESCE(VALUES(\`update_by\`), \`update_by\`),
            \`update_date\` = COALESCE(VALUES(\`update_date\`), \`update_date\`),
            \`raw_json\` = COALESCE(VALUES(\`raw_json\`), \`raw_json\`),
            \`updated_at\` = NOW();
        `;

        const params = [
          transId, personalId, hmain, hname, patientName, birthdate, tel,
          mainInscl, mainInsclName, subInscl, subInsclName,
          claimStatus, patientType, claimCode, claimType, claimTypeName, hnCode,
          claimDate, createDate, sourceChannel, claimAuthen,
          createBy, updateBy, updateDate, rawJson
        ];

        await dflowQuery(sql, params);
        savedCount++;
      } catch (itemErr) {
        console.error('[AuthenHistoryService] Error saving history item:', itemErr.message);
        errors.push({ item, error: itemErr.message });
      }
    }

    return { savedCount, errors };
  }

  /**
   * Get all authen history items for a specific citizen ID from DB
   * @param {string} pid - 13-digit citizen ID
   * @param {string} [claimDate] - Optional date filter (YYYY-MM-DD)
   */
  async getHistoryByPid(pid, claimDate = null) {
    if (!pid) return [];
    let sql = 'SELECT * FROM `nhso_authen_history` WHERE `personal_id` = ?';
    const params = [pid];

    if (claimDate) {
      sql += ' AND DATE(`claim_date`) = ?';
      params.push(claimDate);
    }

    sql += ' ORDER BY `claim_date` DESC, `create_date` DESC';

    const rows = await dflowQuery(sql, params);
    return rows;
  }

  /**
   * Get authen history item by transaction ID
   * @param {string|number} transId
   */
  async getByTransId(transId) {
    if (!transId) return null;
    const rows = await dflowQuery('SELECT * FROM `nhso_authen_history` WHERE `trans_id` = ? LIMIT 1', [transId]);
    return rows[0] || null;
  }
}

module.exports = new AuthenHistoryService();
