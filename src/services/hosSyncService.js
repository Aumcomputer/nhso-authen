const { hosPool, dflowPool } = require('../config/database');
const exemptPttypeService = require('./exemptPttypeService');

/**
 * List of 11 district hospitals in Ratchaburi (Out CUP)
 */
const RBR_OUT_CUP_MAIN_HOSPITALS = [
  '11276', // รพ.ปากท่อ
  '11458', // รพ.สมเด็จพระยุพราชจอมบึง
  '11273', // รพ.สวนผึ้ง
  '10730', // รพ.โพธาราม
  '10728', // รพ.ดำเนินสะดวก
  '28858', // รพ.บ้านคา
  '10729', // รพ.บ้านโป่ง
  '11277', // รพ.วัดเพลง
  '11274', // รพ.บางแพ
  '11275', // รพ.เจ็ดเสมียน
  '11519'  // รพ.ค่ายภาณุรังษี
];

function isRbrOutCup(hcode) {
  if (!hcode) return false;
  const clean = String(hcode).trim();
  return RBR_OUT_CUP_MAIN_HOSPITALS.includes(clean);
}

/**
 * รหัสสถานพยาบาลระดับปฐมภูมิ/รพ.สต. ที่แม้ hospmain จะเป็น 10677 แต่ต้องให้สิทธิเป็น 92 (นอก CUP ในจังหวัด)
 */
const RBR_UCS_OUT_CUP_SUB_CENTERS = ['14317', '08003', '08004', '08005'];

/**
 * Format CID into 1-4-5-2-1 hyphenated format (e.g. 3-8015-00050-24-2)
 */
function formatCid(cid) {
  if (!cid) return null;
  const clean = String(cid).replace(/\D/g, '');
  if (clean.length === 13) {
    return clean.replace(/^(\d{1})(\d{4})(\d{5})(\d{2})(\d{1})$/, '$1-$2-$3-$4-$5');
  }
  return clean;
}

/**
 * Map NHSO Right from API to HOSxP pttype code
 */
function mapNhsoToHosPttype(mainId, subId, hospmain, hospsub = '', currentHosPttype = '', dynamicSubCenters = null) {
  const main = (mainId || '').trim().toUpperCase();
  const sub = (subId || '').trim().toUpperCase();
  const hcode = (hospmain || '').trim();
  const subcode = (hospsub || '').trim();
  const isOwnHosp = (hcode === '10677');
  const isOutCup = isRbrOutCup(hcode);

  const subCentersList = dynamicSubCenters && Array.isArray(dynamicSubCenters) && dynamicSubCenters.length > 0
    ? dynamicSubCenters
    : RBR_UCS_OUT_CUP_SUB_CENTERS;

  // 1. คนพิการ (DIS)
  if (main === 'DIS' || sub === '74') {
    if (sub === 'D1') return '64';
    if (isOwnHosp) return '74';
    if (isOutCup) return '89';
    return '90';
  }

  // 2. บัตรทอง (UCS / WEL)
  if (main === 'UCS' || main === 'WEL') {
    // ข้อยกเว้นพิเศษ: hospmain 10677 แต่ hospsub เป็น รพ.สต. ในกลุ่ม ให้เป็น 92
    if (isOwnHosp && subCentersList.includes(subcode)) {
      return '92';
    }
    if (isOwnHosp) return '91';
    if (isOutCup) return '92';
    return '93';
  }

  // 3. ข้าราชการ กรมบัญชีกลาง & กรุงเทพมหานคร (OFC)
  if (main === 'OFC') {
    const ofcMap = {
      'O1': '2A',
      'O2': '2B',
      'O3': '2C',
      'O4': '2D',
      'O5': '2E',
      'B1': '2F', // ข้าราชการ กทม.
      'B2': '2G', // ลูกจ้างประจำ กทม.
      'B3': '2H', // ผู้รับบำนาญ กทม.
      'B4': '2I', // บุคคลในครอบครัว กทม.
      'B5': '2J', // ครอบครัวผู้รับบำนาญ กทม.
      'E1': '5B',
      'E2': '5D',
      'G3': '2V',
      'G4': '2W',
      'T1': '2M',
      'T2': '2N',
      'T3': '2O',
      'T4': '2P',
      'T5': '2Q',
      'C4': '2S',
      'G1': '20'
    };
    return ofcMap[sub] || '2A';
  }

  // 4. ข้าราชการท้องถิ่น (LGO)
  if (main === 'LGO') {
    const lgoMap = {
      'L1': '6A',
      'L2': '6B',
      'L3': '6C',
      'L4': '6D'
    };
    return lgoMap[sub] || '6A';
  }

  // 5. ประกันสังคม (SSS / SSI)
  if (main === 'SSS' || main === 'SSI' || main === '34' || sub === '34') {
    if (sub === 'S6') return '33';
    if (isOwnHosp || main === '34' || sub === '34') {
      // หากใน HOSxP บันทึกเป็น 35 (จนท. รพ.ราชบุรี) ไว้อยู่แล้ว ให้คงเป็น 35
      if (currentHosPttype === '35') return '35';
      return '34';
    }
    return '36';
  }

  // 6. บุคคลที่มีปัญหาสถานะและสิทธิ (ST / STP)
  if (sub === 'ST' || main === 'STP') {
    return isOwnHosp ? '79' : '80';
  }

  // 7. สิทธิครูเอกชน (PVT)
  if (main === 'PVT' || sub === 'P1') {
    return '25'; // ครูเอกชน (สำรองจ่าย)
  }

  // Fallback
  return currentHosPttype || '10';
}

/**
 * Format Date to YYYY-MM-DD
 */
function formatDateOnly(val) {
  if (!val) return null;
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return null;
    return val.toISOString().slice(0, 10);
  }
  const str = String(val).trim();
  if (str.length >= 10 && /^\d{4}-\d{2}-\d{2}/.test(str)) {
    return str.slice(0, 10);
  }
  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    return d.toISOString().slice(0, 10);
  }
  return null;
}

class HosSyncService {
  /**
   * Preview data before saving into HOSxP
   * @param {string} vn
   */
  async previewSyncData(vn) {
    if (!vn) throw new Error('กรุณาระบุ VN');

    // 1. Fetch current HOSxP visit
    const [hosRows] = await Promise.all([
      hosPool.query(`
        SELECT o.vn, o.hn, o.vstdate, o.vsttime, o.pttype, p.name as pttypename,
               o.pttypeno, o.hospmain, o.hospsub, pt.cid,
               CONCAT(pt.pname, pt.fname, ' ', pt.lname) as ptname,
               vp.pttype as vp_pttype, vpp.name as vp_pttypename,
               vp.pttypeno as vp_pttypeno, vp.hospmain as vp_hospmain,
               vp.hospsub as vp_hospsub, vp.auth_code as vp_auth_code,
               vp.begin_date as vp_begin_date, vp.expire_date as vp_expire_date
        FROM ovst o
        LEFT JOIN patient pt ON o.hn = pt.hn
        LEFT JOIN pttype p ON o.pttype = p.pttype
        LEFT JOIN visit_pttype vp ON o.vn = vp.vn
        LEFT JOIN pttype vpp ON vp.pttype = vpp.pttype
        WHERE o.vn = ?
      `, [vn])
    ]);

    if (!hosRows || hosRows.length === 0) {
      throw new Error(`ไม่พบข้อมูล VN ${vn} ในตาราง ovst ของ HOSxP`);
    }

    const currentHos = hosRows[0];

    // 2. Fetch D-Flow data
    const dflowRows = await dflowPool.query(`SELECT * FROM vn_nhso_authen WHERE vn = ?`, [vn]);
    const dflowData = dflowRows.length > 0 ? dflowRows[0] : null;

    let rightJson = null;
    let authenJson = null;

    if (dflowData?.right_json) {
      try {
        rightJson = typeof dflowData.right_json === 'string' ? JSON.parse(dflowData.right_json) : dflowData.right_json;
      } catch (e) { }
    }

    if (dflowData?.authen_json) {
      try {
        authenJson = typeof dflowData.authen_json === 'string' ? JSON.parse(dflowData.authen_json) : dflowData.authen_json;
      } catch (e) { }
    }

    const fund = (rightJson?.funds && rightJson.funds[0]) || {};

    // 3. Prepare target values
    const mainInsclId = fund?.mainInscl?.id || dflowData?.maininscl_id || authenJson?.mainInscl || null;
    const subInsclId = fund?.subInscl?.id || dflowData?.subinscl_id || authenJson?.subInscl || null;
    const hospmainTarget = fund?.hospMainOp?.hcode || dflowData?.hospmain_op_code || fund?.hospMain?.hcode || dflowData?.hospmain_code || authenJson?.hmain || currentHos.hospmain || null;
    const hospsubTarget = fund?.hospSub?.hcode || dflowData?.hospsub_code || currentHos.hospsub || null;

    // Query active UCS sub centers from d-flow database
    let dynamicSubCenters = null;
    try {
      const subRows = await dflowPool.query('SELECT UPPER(hospcode) as code FROM nhso_ucs_sub_centers WHERE is_active = 1');
      if (Array.isArray(subRows) && subRows.length > 0) {
        dynamicSubCenters = subRows.map(r => r.code);
      }
    } catch (e) { }

    // Check if patient's current HOSxP pttype is in exempt list
    let isExempt = false;
    let exemptTargetPttype = null;
    let exemptTargetPttypeName = '-';

    try {
      const exemptCodes = await exemptPttypeService.getActiveCodes();
      const currentVpPttype = (currentHos.vp_pttype || '').trim().toUpperCase();
      const currentOvstPttype = (currentHos.pttype || '').trim().toUpperCase();

      if (currentVpPttype && exemptCodes.includes(currentVpPttype)) {
        isExempt = true;
        exemptTargetPttype = currentHos.vp_pttype;
        exemptTargetPttypeName = currentHos.vp_pttypename;
      } else if (currentOvstPttype && exemptCodes.includes(currentOvstPttype)) {
        isExempt = true;
        exemptTargetPttype = currentHos.pttype;
        exemptTargetPttypeName = currentHos.pttypename;
      }
    } catch (e) {
      console.warn('[HosSyncService] Failed to check exempt pttypes:', e.message);
    }

    let mappedPttype = null;
    let targetPttypeName = '-';

    if (isExempt) {
      // สิทธิที่ยกเว้นการตรวจสอบความตรงกัน ไม่ต้องเปลี่ยน pttype ให้ใช้ pttype เดิมใน hos
      mappedPttype = exemptTargetPttype;
      targetPttypeName = exemptTargetPttypeName;
      if (!targetPttypeName || targetPttypeName === '-') {
        if (mappedPttype) {
          const ptRows = await hosPool.query(`SELECT name FROM pttype WHERE pttype = ?`, [mappedPttype]);
          if (Array.isArray(ptRows) && ptRows.length > 0) targetPttypeName = ptRows[0].name;
        }
      }
    } else {
      mappedPttype = mapNhsoToHosPttype(mainInsclId, subInsclId, hospmainTarget, hospsubTarget, currentHos.pttype, dynamicSubCenters);
      if (mappedPttype) {
        const ptRows = await hosPool.query(`SELECT name FROM pttype WHERE pttype = ?`, [mappedPttype]);
        if (Array.isArray(ptRows) && ptRows.length > 0) targetPttypeName = ptRows[0].name;
      }
    }

    // pttypeno rule: cardId if present, else formatted cid
    let pttypenoTarget = null;
    if (fund?.cardId && String(fund.cardId).trim() !== '') {
      pttypenoTarget = String(fund.cardId).trim();
    } else if (dflowData?.card_id && String(dflowData.card_id).trim() !== '') {
      pttypenoTarget = String(dflowData.card_id).trim();
    } else {
      const rawCid = dflowData?.pid || currentHos.cid || rightJson?.pid || authenJson?.personalId;
      pttypenoTarget = formatCid(rawCid) || currentHos.pttypeno;
    }

    // Dates
    const beginDateTarget = formatDateOnly(fund?.startDateTime || dflowData?.right_start_date) || formatDateOnly(currentHos.vp_begin_date) || null;
    const expireDateTarget = formatDateOnly(fund?.expireDateTime) || formatDateOnly(currentHos.vp_expire_date) || null;

    // Authen Code from authen_json or dflow claim_code
    const authCodeTarget = authenJson?.claimCode || dflowData?.claim_code || currentHos.vp_auth_code || null;

    return {
      vn,
      hn: currentHos.hn,
      ptname: currentHos.ptname,
      cid: currentHos.cid,
      current: {
        ovst_pttype: currentHos.pttype,
        ovst_pttypename: currentHos.pttypename,
        ovst_pttypeno: currentHos.pttypeno,
        ovst_hospmain: currentHos.hospmain,
        ovst_hospsub: currentHos.hospsub,
        vp_pttype: currentHos.vp_pttype,
        vp_pttypename: currentHos.vp_pttypename,
        vp_pttypeno: currentHos.vp_pttypeno,
        vp_hospmain: currentHos.vp_hospmain,
        vp_hospsub: currentHos.vp_hospsub,
        vp_auth_code: currentHos.vp_auth_code,
        vp_begin_date: currentHos.vp_begin_date,
        vp_expire_date: currentHos.vp_expire_date
      },
      target: {
        pttype: mappedPttype,
        pttypename: targetPttypeName,
        pttypeno: pttypenoTarget,
        hospmain: hospmainTarget,
        hospsub: hospsubTarget,
        begin_date: beginDateTarget,
        expire_date: expireDateTarget,
        auth_code: authCodeTarget,
        claim_code: null, // visit_pttype.claim_code ให้เป็นค่าว่าง
        is_exempt: isExempt
      }
    };
  }

  /**
   * Execute actual Save / Update into HOSxP (ovst and visit_pttype)
   * Safely wrapped in a database Transaction.
   * @param {Object} params
   * @param {string} params.vn
   * @param {Object} [params.overrideData]
   * @param {string} [params.staff]
   */
  async syncVisitToHos({ vn, overrideData = null, staff = null }) {
    if (!vn) throw new Error('กรุณาระบุ VN');

    // 1. Get preview / prepared target data
    const preview = await this.previewSyncData(vn);
    const target = {
      ...preview.target,
      ...(overrideData || {})
    };

    if (!target.pttype) {
      throw new Error('ไม่พบรหัสสิทธิ (pttype) ที่จะบันทึกลง HOSxP');
    }

    // 2. Open dedicated connection for Transaction
    const conn = await hosPool.getConnection();

    try {
      await conn.beginTransaction();

      // 2.1 Verify and Lock row in ovst
      const ovstRows = await conn.query(`
        SELECT vn, hn, pttype, pttypeno, hospmain, hospsub 
        FROM ovst 
        WHERE vn = ? 
        FOR UPDATE
      `, [vn]);

      if (!ovstRows || ovstRows.length === 0) {
        throw new Error(`ไม่พบข้อมูล VN ${vn} ในตาราง ovst ของ HOSxP`);
      }

      // 2.2 Update ovst (เฉพาะ 4 คอลัมน์ที่เกี่ยวข้องกับสิทธิ)
      await conn.query(`
        UPDATE ovst 
        SET 
          pttype = ?,
          pttypeno = ?,
          hospmain = ?,
          hospsub = ?
        WHERE vn = ?
      `, [
        target.pttype,
        target.pttypeno || null,
        target.hospmain || null,
        target.hospsub || null,
        vn
      ]);

      // 2.3 Inspect visit_pttype
      const vpRows = await conn.query(`
        SELECT vn, pttype, pttype_number, auth_code, hospmain, hospsub 
        FROM visit_pttype 
        WHERE vn = ? 
        ORDER BY pttype_number ASC
      `, [vn]);

      let visitPttypeAction = 'none';

      if (!vpRows || vpRows.length === 0) {
        // CASE A: ไม่มีแถวใน visit_pttype -> INSERT แถวใหม่
        await conn.query(`
          INSERT INTO visit_pttype (
            vn,
            pttype,
            pttypeno,
            hospmain,
            hospsub,
            begin_date,
            expire_date,
            pttype_number,
            contract_id,
            auth_code,
            claim_code,
            staff
          ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, 0, ?, NULL, ?)
        `, [
          vn,
          target.pttype,
          target.pttypeno || null,
          target.hospmain || null,
          target.hospsub || null,
          target.begin_date || null,
          target.expire_date || null,
          target.auth_code || null,
          staff || null
        ]);
        visitPttypeAction = 'inserted';
      } else {
        // CASE B: มีแถวใน visit_pttype อยู่แล้ว
        // ตรวจสอบว่ามีแถวที่ pttype ตรงกับ target.pttype อยู่แล้วหรือไม่
        const exactMatchRow = vpRows.find(r => r.pttype === target.pttype);

        if (exactMatchRow) {
          // มีแถวสิทธิตรงกันอยู่แล้ว -> UPDATE ข้อมูลประกอบ
          await conn.query(`
            UPDATE visit_pttype 
            SET 
              pttypeno = ?,
              hospmain = ?,
              hospsub = ?,
              begin_date = COALESCE(?, begin_date),
              expire_date = COALESCE(?, expire_date),
              auth_code = COALESCE(?, auth_code),
              claim_code = NULL,
              staff = COALESCE(?, staff)
            WHERE vn = ? AND pttype = ?
          `, [
            target.pttypeno || null,
            target.hospmain || null,
            target.hospsub || null,
            target.begin_date || null,
            target.expire_date || null,
            target.auth_code || null,
            staff || null,
            vn,
            target.pttype
          ]);
          visitPttypeAction = 'updated_exact';
        } else {
          // แถวเดิมมี pttype ไม่ตรงกับ target.pttype (ต้องการเปลี่ยนสิทธิหลัก)
          // ให้ update แถวสิทธิหลัก (pttype_number = 1 หรือแถวแรก)
          const primaryRow = vpRows[0];
          await conn.query(`
            UPDATE visit_pttype 
            SET 
              pttype = ?,
              pttypeno = ?,
              hospmain = ?,
              hospsub = ?,
              begin_date = COALESCE(?, begin_date),
              expire_date = COALESCE(?, expire_date),
              auth_code = COALESCE(?, auth_code),
              claim_code = NULL,
              staff = COALESCE(?, staff)
            WHERE vn = ? AND pttype = ?
          `, [
            target.pttype,
            target.pttypeno || null,
            target.hospmain || null,
            target.hospsub || null,
            target.begin_date || null,
            target.expire_date || null,
            target.auth_code || null,
            staff || null,
            vn,
            primaryRow.pttype
          ]);
          visitPttypeAction = 'updated_changed_pttype';
        }
      }

      // 2.4 Commit Transaction
      await conn.commit();

      // 2.5 บันทึกเวลาที่ซิงค์ลง dflow (ถ้ามีเรคคอร์ดใน vn_nhso_authen)
      try {
        await dflowPool.query(`
          UPDATE vn_nhso_authen 
          SET updated_at = NOW() 
          WHERE vn = ?
        `, [vn]);
      } catch (err) { }

      return {
        success: true,
        message: 'บันทึกข้อมูลสิทธิและการ Authen ลงระบบ HOSxP เรียบร้อยแล้ว',
        vn,
        hn: preview.hn,
        ptname: preview.ptname,
        action: {
          ovst: 'updated',
          visit_pttype: visitPttypeAction
        },
        savedData: target
      };

    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }
}

module.exports = new HosSyncService();
