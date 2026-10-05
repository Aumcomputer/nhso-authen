/**
 * Validate Thai Citizen ID format (13 digits)
 * @param {string} pid
 * @returns {boolean}
 */
function isValidPid(pid) {
  if (!pid || typeof pid !== 'string') return false;
  return /^[0-9]{13}$/.test(pid.trim());
}

/**
 * Validate Thai National ID Checksum (Mod 11)
 * @param {string} pid
 * @returns {boolean}
 */
function validateChecksum(pid) {
  if (!isValidPid(pid)) return false;
  const digits = pid.trim().split('').map(Number);
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += digits[i] * (13 - i);
  }
  const checkDigit = (11 - (sum % 11)) % 10;
  return checkDigit === digits[12];
}

module.exports = {
  isValidPid,
  validateChecksum
};
