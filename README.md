# NHSO Token Manager & API Service (Express.js)

ระบบ REST API สร้างด้วย Express.js สำหรับเชื่อมต่อกับระบบ สปสช. (SRM Portal & Authen Service) โดยใช้กลไก **Refresh Token เพื่อขอ Access Token (Bearer Token)** พร้อมระบบ **Auto-Refresh on 401 Unauthorized** อัตโนมัติ

---

## 🌟 จุดเด่นของระบบ (Key Features)

1. **Auto Token Management**: รับ `refresh_token` และยิงขอ `access_token` อัตโนมัติ ไม่ต้องคัดลอก Access Token เองบ่อยๆ
2. **Auto Token Rotation**: สปสช. มีการส่ง Refresh Token ตัวใหม่กลับมาพร้อม Access Token ระบบจะบันทึกอัปเดตลง `.env` ให้อัตโนมัติ
3. **Auto-Refresh on 401**: หาก Access Token หมดอายุและ upstream API ตอบกลับมาเป็น `401 Unauthorized` ระบบจะดักจับและยิง Refresh Token ใหม่ทันที พร้อม Retry คำขอเดิมให้อัตโนมัติ (Seamless Retry) โดยที่ผู้เรียกใช้งานไม่ต้องยิงซ้ำ
4. **Concurrency Safe**: ป้องกันการยิง Refresh Token ซ้ำซ้อนพร้อมกันในเสี้ยววินาทีด้วย Mutex Promise Lock

---

## ⚙️ การติดตั้งและการตั้งค่า (Setup)

1. ติดตั้ง Dependencies:
   ```bash
   npm install
   ```

2. ตั้งค่าไฟล์ `.env` (รันพอร์ต `4100` เป็นค่าเริ่มต้น):
   ```ini
   PORT=4100
   NHSO_TOKEN_URL=https://srmportal.nhso.go.th/api/scard/access-token
   NHSO_REFRESH_TOKEN=eyJhbGciOiJIUzUxMiIsInR5cCI...
   NHSO_RIGHT_SEARCH_URL=https://srm.nhso.go.th/api/ucws/v1/right-search
   NHSO_AUTHEN_HISTORY_URL=https://authenservice.nhso.go.th/authencode/api/authencode-history
   AUTHEN_COOKIE=SESSION=...; NSXLB...=...; cookiesession1=...
   ```

3. เริ่มต้นรันเซิร์ฟเวอร์:
   ```bash
   npm start
   ```

---

## 🚀 API Endpoints

### 1. ตรวจสอบสิทธิ์ (Right Search)
- **Method:** `GET` หรือ `POST`
- **URL:** `http://localhost:4100/api/rights/:pid`
- **ตัวอย่าง:**
  ```bash
  curl http://localhost:4100/api/rights/3240200361280
  ```
  หรือผ่าน Query:
  ```bash
  curl "http://localhost:4100/api/rights?pid=3240200361280"
  ```
- **ตัวอย่างผลลัพธ์ (Response):**
  ```json
  {
    "success": true,
    "pid": "3240200361280",
    "data": {
      "checkDate": "2026-09-28T12:35:58",
      "pid": "3240200361280",
      "tname": "นาง",
      "fname": "อำพันธ์",
      "lname": "ตั๊นเจริญ",
      "funds": [
        {
          "mainInscl": {
            "id": "WEL",
            "name": "สิทธิหลักประกันสุขภาพแห่งชาติ (ยกเว้นการร่วมจ่ายค่าบริการ 30 บาท)"
          },
          "subInscl": {
            "id": "77",
            "name": "ผู้มีอายุเกิน 60 ปีบริบูรณ์"
          },
          "hospMain": {
            "hcode": "10677",
            "hname": "รพ.ราชบุรี"
          }
        }
      ]
    }
  }
  ```

---

### 2. ดูประวัติ Authen (Authencode History)
- **Method:** `GET` หรือ `POST`
- **URL:** `http://localhost:4100/api/authen-history/:pid`
- **ตัวอย่าง:**
  ```bash
  curl http://localhost:4100/api/authen-history/3240200361280
  ```
  หรือผ่าน Query:
  ```bash
  curl "http://localhost:4100/api/authen-history?pid=3240200361280"
  ```

---

### 3. การจัดการ Token (Token Management)

#### ตรวจสอบสถานะ Token
- **URL:** `GET http://localhost:4100/api/token/status`
- แสดงข้อมูลเจ้าหน้าที่, หน่วยบริการ, วันหมดอายุของ Access Token และ Refresh Token

#### สั่ง Refresh Token ทันที
- **URL:** `POST http://localhost:4100/api/token/refresh`

#### อัปเดต Refresh Token ตัวใหม่
- **URL:** `POST http://localhost:4100/api/token/update`
- **Body:**
  ```json
  {
    "refresh_token": "eyJhbGciOiJIUzUxMiIsIn..."
  }
  ```

---

### 4. ฐานข้อมูล HOSxP (Database Connection)
ระบบเชื่อมต่อกับฐานข้อมูล HOSxP (MySQL/MariaDB) โหมด Read-Only จากคอนฟิกใน `.env`:
- **Host:** `10.10.10.43:3306`
- **Database:** `hos` (User: `computercenter`, Charset: `tis620`)
- **ทดสอบสถานะการเชื่อมต่อฐานข้อมูล:**
  ```bash
  curl http://localhost:4100/api/db/health
  ```
- **การเรียกใช้งานในโค้ด:**
  ```javascript
  const db = require('./config/database');
  const rows = await db.query('SELECT hn, fname, lname FROM patient WHERE cid = ?', [cid]);
  ```

---

### 5. หน้าเว็บ Dashboard สำหรับดูข้อมูลผู้รับบริการและตรวจสิทธิ์ 🌟
สามารถเปิดใช้งานผ่าน Web Browser ได้ทันทีที่:
```
http://localhost:4100
```
- **เลือกวันที่ (vstdate):** กำหนดวันที่ต้องการดูข้อมูล (เช่น `2026-09-28`)
- **เลือกแผนก (spclty):** เลือกรหัสแผนก เช่น `02 - ศัลยกรรม` หรือเลือกทุกแผนก
- **ปุ่ม "ตรวจสิทธิ์ สปสช. (🔍)":** ยิงตรวจสิทธิ์รายคน และแสดงสิทธิหลัก/รอง, รพ.หลัก สปสช. ทันที
- **ปุ่ม "ตรวจ สปสช. ทั้งหมด (⚡)":** Batch ตรวจสอบผู้ป่วยในตารางทั้งหมด พร้อม Progress Bar แสดงสถานะ
- **ปุ่ม "ดูประวัติ Authen (📜)":** เปิด Modal แสดงประวัติการ Authen ในอดีตของคนไข้
- **ช่องค้นหาด่วน:** พิมพ์ค้นหาด้วย HN, CID หรือชื่อคนไข้ได้ทันที


