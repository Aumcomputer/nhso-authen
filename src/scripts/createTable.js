const { dflowQuery } = require('../config/database');

const createTableSql = `
CREATE TABLE IF NOT EXISTS \`vn_nhso_authen\` (
  -- 1. Identifier จากระบบโรงพยาบาล (ฟิลด์เดียว)
  \`vn\` varchar(13) NOT NULL COMMENT 'รหัสการรับบริการ (Visit Number จาก ovst.vn)',

  -- 2. ข้อมูลบุคคลจาก API สปสช. (Demographics)
  \`pid\` varchar(13) DEFAULT NULL COMMENT 'เลขประจำตัวประชาชน 13 หลัก',
  \`title_name\` varchar(50) DEFAULT NULL COMMENT 'คำนำหน้าชื่อ (tname / titleName)',
  \`fname\` varchar(100) DEFAULT NULL COMMENT 'ชื่อผู้รับบริการ',
  \`lname\` varchar(100) DEFAULT NULL COMMENT 'นามสกุลผู้รับบริการ',
  \`birth_date\` varchar(50) DEFAULT NULL COMMENT 'วันเกิดตามระบบ สปสช.',
  \`sex\` varchar(20) DEFAULT NULL COMMENT 'เพศ (ชาย / หญิง จาก sex.name)',
  \`nation\` varchar(50) DEFAULT NULL COMMENT 'สัญชาติ (เช่น ไทย จาก nation.name)',

  -- 3. ข้อมูลสิทธิการรักษาจาก API Right Search (UCWS)
  \`right_check_date\` datetime DEFAULT NULL COMMENT 'วันเวลาที่ระบบ สปสช. ตรวจสอบสิทธิ (checkDate)',
  \`maininscl_id\` varchar(20) DEFAULT NULL COMMENT 'รหัสสิทธิหลัก (funds[0].mainInscl.id เช่น OFC, WEL, UCS, SSS)',
  \`maininscl_name\` varchar(200) DEFAULT NULL COMMENT 'ชื่อสิทธิหลัก (funds[0].mainInscl.name)',
  \`subinscl_id\` varchar(20) DEFAULT NULL COMMENT 'รหัสสิทธิย่อย (funds[0].subInscl.id เช่น O1, 77, S1)',
  \`subinscl_name\` varchar(255) DEFAULT NULL COMMENT 'ชื่อสิทธิย่อย (funds[0].subInscl.name)',
  \`hospmain_code\` varchar(10) DEFAULT NULL COMMENT 'รหัส รพ.หลัก (funds[0].hospMain.hcode)',
  \`hospmain_name\` varchar(200) DEFAULT NULL COMMENT 'ชื่อ รพ.หลัก (funds[0].hospMain.hname)',
  \`hospsub_code\` varchar(10) DEFAULT NULL COMMENT 'รหัส รพ.รอง (funds[0].hospSub.hcode)',
  \`hospsub_name\` varchar(200) DEFAULT NULL COMMENT 'ชื่อ รพ.รอง (funds[0].hospSub.hname)',
  \`hospmain_op_code\` varchar(10) DEFAULT NULL COMMENT 'รหัส รพ.หลัก OPD (funds[0].hospMainOp.hcode)',
  \`hospmain_op_name\` varchar(200) DEFAULT NULL COMMENT 'ชื่อ รพ.หลัก OPD (funds[0].hospMainOp.hname)',
  \`purchase_province\` varchar(100) DEFAULT NULL COMMENT 'จังหวัดที่ขึ้นทะเบียนสิทธิ (purchaseProvince.name)',
  \`right_start_date\` datetime DEFAULT NULL COMMENT 'วันที่เริ่มใช้สิทธิตาม สปสช. (startDateTime)',
  \`card_id\` varchar(50) DEFAULT NULL COMMENT 'เลขที่บัตรประกันสุขภาพ (cardId)',
  \`paid_model\` varchar(10) DEFAULT NULL COMMENT 'รูปแบบการจ่ายเงิน (paidModel เช่น 1)',

  -- 4. ข้อมูลการ Authen ครั้งปัจจุบันจาก API Authencode History
  \`claim_code\` varchar(50) DEFAULT NULL COMMENT 'รหัส Claim Code (เช่น PP2534423136)',
  \`claim_type\` varchar(30) DEFAULT NULL COMMENT 'รหัสประเภทบริการ (claimType เช่น PG0060001)',
  \`claim_type_name\` varchar(255) DEFAULT NULL COMMENT 'ชื่อประเภทบริการ (claimTypeName เช่น เข้ารับบริการรักษาทั่วไป)',
  \`received_datetime\` datetime DEFAULT NULL COMMENT 'วันเวลาที่ขอ Authen สำเร็จ (receivedDateTime)',
  \`source_channel\` varchar(50) DEFAULT NULL COMMENT 'ช่องทางการขอ Authen (sourceChannel เช่น AUTHENCODE, ENDPOINT, KIOSK)',
  \`claim_authen\` varchar(50) DEFAULT NULL COMMENT 'ประเภท Authen (claimAuthen เช่น KOS)',
  \`claim_status\` varchar(20) DEFAULT NULL COMMENT 'สถานะเคลม (claimStatus เช่น E)',
  \`authen_status\` varchar(50) DEFAULT NULL COMMENT 'สถานะการบันทึก (status เช่น SAVE, ยืนยันแล้ว)',
  \`authen_hcode\` varchar(10) DEFAULT NULL COMMENT 'รหัสหน่วยบริการที่ออก Authen (hcode เช่น 10677)',
  \`authen_hname\` varchar(200) DEFAULT NULL COMMENT 'ชื่อหน่วยบริการที่ออก Authen (hname เช่น รพ.ราชบุรี)',
  \`authen_age\` varchar(50) DEFAULT NULL COMMENT 'อายุขณะขอ Authen (age เช่น 37 ปี 8 เดือน 19 วัน)',
  \`hn_code\` varchar(50) DEFAULT NULL COMMENT 'HN ที่ผูกกับ Authen (hnCode)',

  -- 5. Raw JSON Payload เต็ม (เก็บบันทึกข้อมูลดิบจาก API ทั้ง 2 เส้น 100%)
  \`right_json\` longtext DEFAULT NULL COMMENT 'Raw JSON เต็มจาก API ตรวจสอบสิทธิ',
  \`authen_json\` longtext DEFAULT NULL COMMENT 'Raw JSON เต็มจาก API Authen ครั้งนี้',

  -- 6. Timestamps
  \`created_at\` datetime DEFAULT current_timestamp() COMMENT 'วันเวลาที่บันทึกลง d-flow',
  \`updated_at\` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp() COMMENT 'วันเวลาที่อัปเดตล่าสุด',

  PRIMARY KEY (\`vn\`),
  KEY \`ix_pid\` (\`pid\`),
  KEY \`ix_claim_code\` (\`claim_code\`),
  KEY \`ix_received_datetime\` (\`received_datetime\`),
  KEY \`ix_created_at\` (\`created_at\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='ตารางเก็บผลตรวจสิทธิและ Authen สปสช. ครั้งปัจจุบันราย VN';
`;

async function run() {
  try {
    console.log('[Migration] Creating table vn_nhso_authen in d-flow database...');
    await dflowQuery(createTableSql);
    console.log('[Migration] 🎉 Table vn_nhso_authen created successfully!');

    const desc = await dflowQuery('DESCRIBE vn_nhso_authen');
    console.log(`[Migration] Total columns: ${desc.length}`);
    console.log(desc.map(d => `${d.Field} (${d.Type})`).join('\n'));

    const indexes = await dflowQuery('SHOW INDEX FROM vn_nhso_authen');
    console.log('\n[Migration] Indexes:');
    console.log([...new Set(indexes.map(idx => `${idx.Key_name} on (${idx.Column_name})`))].join('\n'));

    process.exit(0);
  } catch (err) {
    console.error('[Migration] ❌ Error creating table:', err);
    process.exit(1);
  }
}

run();
