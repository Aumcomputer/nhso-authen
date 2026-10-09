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

class VnAuthenService {
  /**
   * Save or Update NHSO right & authen data for a specific VN
   * @param {Object} params
   * @param {string} params.vn - Visit number (Primary Key)
   * @param {Object} [params.rightData] - Data from right search API
   * @param {Object} [params.authenData] - Current authen record from authen report/history API
   */
  async upsertVnData({ vn, rightData = null, authenData = null }) {
    if (!vn) {
      throw new Error('vn is required');
    }

    // Extract Demographics & Rights from rightData or authenData
    const fund = rightData?.funds?.[0] || null;
    const pid = rightData?.pid || authenData?.personalId || authenData?.pid || null;
    const titleName = rightData?.tname || authenData?.titleName || null;
    const fname = rightData?.fname || authenData?.fname || null;
    const lname = rightData?.lname || authenData?.lname || null;
    const birthDate = rightData?.birthDate || authenData?.birthdate || authenData?.displayBirthDate || null;
    const sex = rightData?.sex?.name || authenData?.sexDesc || null;
    const nation = rightData?.nation?.name || null;
    const tel = authenData?.tel || rightData?.tel || null;

    const rightCheckDate = rightData?.checkDate ? parseToDate(rightData.checkDate) : null;
    const maininsclId = fund?.mainInscl?.id || (typeof authenData?.mainInscl === 'object' ? (authenData.mainInscl.id || authenData.mainInscl.rightId) : authenData?.mainInscl) || null;
    const maininsclName = fund?.mainInscl?.name || (typeof authenData?.mainInscl === 'object' ? (authenData.mainInscl.name || authenData.mainInscl.rightName) : authenData?.mainInsclName) || null;
    const subinsclId = fund?.subInscl?.id || (typeof authenData?.subInscl === 'object' ? (authenData.subInscl.id || authenData.subInscl.inscl) : authenData?.subInscl) || null;
    const subinsclName = fund?.subInscl?.name || (typeof authenData?.subInscl === 'object' ? (authenData.subInscl.name || authenData.subInscl.insclName) : authenData?.subInsclName) || null;
    const hospmainCode = fund?.hospMain?.hcode || authenData?.hmain || authenData?.hcode || null;
    const hospmainName = fund?.hospMain?.hname || authenData?.hname || null;
    const hospsubCode = fund?.hospSub?.hcode || null;
    const hospsubName = fund?.hospSub?.hname || null;
    const hospmainOpCode = fund?.hospMainOp?.hcode || null;
    const hospmainOpName = fund?.hospMainOp?.hname || null;
    const purchaseProvince = fund?.purchaseProvince?.name || null;
    const rightStartDate = fund?.startDateTime ? parseToDate(fund.startDateTime) : null;
    const cardId = fund?.cardId || null;
    const paidModel = fund?.paidModel || null;

    // Extract Authen details from authenData
    const transId = authenData?.transId || authenData?.trans_id || null;
    const claimCode = authenData?.claimCode || null;
    const claimType = authenData?.claimType || null;
    const claimTypeName = authenData?.claimTypeName || authenData?.claimTypePackage || null;
    const receivedDatetime = parseToDate(authenData?.claimDate || authenData?.receivedDateTime);
    const createDate = parseToDate(authenData?.createDate);
    const sourceChannel = authenData?.sourceChannel || authenData?.claimAuthen || null;
    const claimAuthen = authenData?.claimAuthen || null;
    const claimStatus = authenData?.claimStatus || null;
    const authenStatus = (authenData?.status === 'SAVE' || authenData?.claimStatus === 'E') ? 'ยืนยันแล้ว' : (authenData?.status || null);
    const authenHcode = authenData?.hmain || authenData?.hcode || null;
    const authenHname = authenData?.hname || null;
    const authenAge = authenData?.age || null;
    const hnCode = authenData?.hnCode || null;

    const rightJson = rightData ? JSON.stringify(rightData) : null;
    const authenJson = authenData ? JSON.stringify(authenData) : null;

    const sql = `
      INSERT INTO \`vn_nhso_authen\` (
        \`vn\`, \`pid\`, \`title_name\`, \`fname\`, \`lname\`, \`birth_date\`, \`sex\`, \`nation\`, \`tel\`,
        \`right_check_date\`, \`maininscl_id\`, \`maininscl_name\`, \`subinscl_id\`, \`subinscl_name\`,
        \`hospmain_code\`, \`hospmain_name\`, \`hospsub_code\`, \`hospsub_name\`,
        \`hospmain_op_code\`, \`hospmain_op_name\`, \`purchase_province\`, \`right_start_date\`,
        \`card_id\`, \`paid_model\`,
        \`claim_code\`, \`trans_id\`, \`claim_type\`, \`claim_type_name\`, \`received_datetime\`, \`create_date\`,
        \`source_channel\`, \`claim_authen\`, \`claim_status\`, \`authen_status\`,
        \`authen_hcode\`, \`authen_hname\`, \`authen_age\`, \`hn_code\`,
        \`right_json\`, \`authen_json\`
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?
      )
      ON DUPLICATE KEY UPDATE
        \`pid\` = COALESCE(VALUES(\`pid\`), \`pid\`),
        \`title_name\` = COALESCE(VALUES(\`title_name\`), \`title_name\`),
        \`fname\` = COALESCE(VALUES(\`fname\`), \`fname\`),
        \`lname\` = COALESCE(VALUES(\`lname\`), \`lname\`),
        \`birth_date\` = COALESCE(VALUES(\`birth_date\`), \`birth_date\`),
        \`sex\` = COALESCE(VALUES(\`sex\`), \`sex\`),
        \`nation\` = COALESCE(VALUES(\`nation\`), \`nation\`),
        \`tel\` = COALESCE(VALUES(\`tel\`), \`tel\`),
        \`right_check_date\` = COALESCE(VALUES(\`right_check_date\`), \`right_check_date\`),
        \`maininscl_id\` = COALESCE(VALUES(\`maininscl_id\`), \`maininscl_id\`),
        \`maininscl_name\` = COALESCE(VALUES(\`maininscl_name\`), \`maininscl_name\`),
        \`subinscl_id\` = COALESCE(VALUES(\`subinscl_id\`), \`subinscl_id\`),
        \`subinscl_name\` = COALESCE(VALUES(\`subinscl_name\`), \`subinscl_name\`),
        \`hospmain_code\` = COALESCE(VALUES(\`hospmain_code\`), \`hospmain_code\`),
        \`hospmain_name\` = COALESCE(VALUES(\`hospmain_name\`), \`hospmain_name\`),
        \`hospsub_code\` = COALESCE(VALUES(\`hospsub_code\`), \`hospsub_code\`),
        \`hospsub_name\` = COALESCE(VALUES(\`hospsub_name\`), \`hospsub_name\`),
        \`hospmain_op_code\` = COALESCE(VALUES(\`hospmain_op_code\`), \`hospmain_op_code\`),
        \`hospmain_op_name\` = COALESCE(VALUES(\`hospmain_op_name\`), \`hospmain_op_name\`),
        \`purchase_province\` = COALESCE(VALUES(\`purchase_province\`), \`purchase_province\`),
        \`right_start_date\` = COALESCE(VALUES(\`right_start_date\`), \`right_start_date\`),
        \`card_id\` = COALESCE(VALUES(\`card_id\`), \`card_id\`),
        \`paid_model\` = COALESCE(VALUES(\`paid_model\`), \`paid_model\`),
        \`claim_code\` = CASE 
          WHEN UPPER(TRIM(COALESCE(VALUES(\`source_channel\`), ''))) = 'AUTHENCODE' THEN VALUES(\`claim_code\`)
          WHEN UPPER(TRIM(COALESCE(\`source_channel\`, ''))) != 'AUTHENCODE' THEN NULL
          ELSE \`claim_code\`
        END,
        \`trans_id\` = CASE 
          WHEN UPPER(TRIM(COALESCE(VALUES(\`source_channel\`), ''))) = 'AUTHENCODE' THEN VALUES(\`trans_id\`)
          WHEN UPPER(TRIM(COALESCE(\`source_channel\`, ''))) != 'AUTHENCODE' THEN NULL
          ELSE \`trans_id\`
        END,
        \`claim_type\` = CASE 
          WHEN UPPER(TRIM(COALESCE(VALUES(\`source_channel\`), ''))) = 'AUTHENCODE' THEN VALUES(\`claim_type\`)
          WHEN UPPER(TRIM(COALESCE(\`source_channel\`, ''))) != 'AUTHENCODE' THEN NULL
          ELSE \`claim_type\`
        END,
        \`claim_type_name\` = CASE 
          WHEN UPPER(TRIM(COALESCE(VALUES(\`source_channel\`), ''))) = 'AUTHENCODE' THEN VALUES(\`claim_type_name\`)
          WHEN UPPER(TRIM(COALESCE(\`source_channel\`, ''))) != 'AUTHENCODE' THEN NULL
          ELSE \`claim_type_name\`
        END,
        \`received_datetime\` = CASE 
          WHEN UPPER(TRIM(COALESCE(VALUES(\`source_channel\`), ''))) = 'AUTHENCODE' THEN VALUES(\`received_datetime\`)
          WHEN UPPER(TRIM(COALESCE(\`source_channel\`, ''))) != 'AUTHENCODE' THEN NULL
          ELSE \`received_datetime\`
        END,
        \`create_date\` = CASE 
          WHEN UPPER(TRIM(COALESCE(VALUES(\`source_channel\`), ''))) = 'AUTHENCODE' THEN VALUES(\`create_date\`)
          WHEN UPPER(TRIM(COALESCE(\`source_channel\`, ''))) != 'AUTHENCODE' THEN NULL
          ELSE \`create_date\`
        END,
        \`source_channel\` = CASE 
          WHEN UPPER(TRIM(COALESCE(VALUES(\`source_channel\`), ''))) = 'AUTHENCODE' THEN VALUES(\`source_channel\`)
          WHEN UPPER(TRIM(COALESCE(\`source_channel\`, ''))) != 'AUTHENCODE' THEN NULL
          ELSE \`source_channel\`
        END,
        \`claim_authen\` = CASE 
          WHEN UPPER(TRIM(COALESCE(VALUES(\`source_channel\`), ''))) = 'AUTHENCODE' THEN VALUES(\`claim_authen\`)
          WHEN UPPER(TRIM(COALESCE(\`source_channel\`, ''))) != 'AUTHENCODE' THEN NULL
          ELSE \`claim_authen\`
        END,
        \`claim_status\` = CASE 
          WHEN UPPER(TRIM(COALESCE(VALUES(\`source_channel\`), ''))) = 'AUTHENCODE' THEN VALUES(\`claim_status\`)
          WHEN UPPER(TRIM(COALESCE(\`source_channel\`, ''))) != 'AUTHENCODE' THEN NULL
          ELSE \`claim_status\`
        END,
        \`authen_status\` = CASE 
          WHEN UPPER(TRIM(COALESCE(VALUES(\`source_channel\`), ''))) = 'AUTHENCODE' THEN VALUES(\`authen_status\`)
          WHEN UPPER(TRIM(COALESCE(\`source_channel\`, ''))) != 'AUTHENCODE' THEN NULL
          ELSE \`authen_status\`
        END,
        \`authen_hcode\` = CASE 
          WHEN UPPER(TRIM(COALESCE(VALUES(\`source_channel\`), ''))) = 'AUTHENCODE' THEN VALUES(\`authen_hcode\`)
          WHEN UPPER(TRIM(COALESCE(\`source_channel\`, ''))) != 'AUTHENCODE' THEN NULL
          ELSE \`authen_hcode\`
        END,
        \`authen_hname\` = CASE 
          WHEN UPPER(TRIM(COALESCE(VALUES(\`source_channel\`), ''))) = 'AUTHENCODE' THEN VALUES(\`authen_hname\`)
          WHEN UPPER(TRIM(COALESCE(\`source_channel\`, ''))) != 'AUTHENCODE' THEN NULL
          ELSE \`authen_hname\`
        END,
        \`authen_age\` = CASE 
          WHEN UPPER(TRIM(COALESCE(VALUES(\`source_channel\`), ''))) = 'AUTHENCODE' THEN VALUES(\`authen_age\`)
          WHEN UPPER(TRIM(COALESCE(\`source_channel\`, ''))) != 'AUTHENCODE' THEN NULL
          ELSE \`authen_age\`
        END,
        \`hn_code\` = COALESCE(VALUES(\`hn_code\`), \`hn_code\`),
        \`right_json\` = COALESCE(VALUES(\`right_json\`), \`right_json\`),
        \`authen_json\` = CASE 
          WHEN UPPER(TRIM(COALESCE(VALUES(\`source_channel\`), ''))) = 'AUTHENCODE' THEN VALUES(\`authen_json\`)
          WHEN UPPER(TRIM(COALESCE(\`source_channel\`, ''))) != 'AUTHENCODE' THEN NULL
          ELSE \`authen_json\`
        END,
        \`updated_at\` = NOW();
    `;

    const params = [
      vn, pid, titleName, fname, lname, birthDate, sex, nation, tel,
      rightCheckDate, maininsclId, maininsclName, subinsclId, subinsclName,
      hospmainCode, hospmainName, hospsubCode, hospsubName,
      hospmainOpCode, hospmainOpName, purchaseProvince, rightStartDate,
      cardId, paidModel,
      claimCode, transId, claimType, claimTypeName, receivedDatetime, createDate,
      sourceChannel, claimAuthen, claimStatus, authenStatus,
      authenHcode, authenHname, authenAge, hnCode,
      rightJson, authenJson
    ];

    await dflowQuery(sql, params);
    return { success: true, vn };
  }

  /**
   * Get record by VN
   */
  async getByVn(vn) {
    const rows = await dflowQuery('SELECT * FROM `vn_nhso_authen` WHERE `vn` = ?', [vn]);
    return rows[0] || null;
  }
}

module.exports = new VnAuthenService();
