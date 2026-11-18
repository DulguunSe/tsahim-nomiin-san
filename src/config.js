'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const DEFAULT_ADMIN_PASSWORD = 'admin123';

/**
 * Орчны хувьсагчдаас (environment variables) тохиргоог уншина.
 */
function loadConfig(env = process.env) {
  const isProduction = env.NODE_ENV === 'production';
  const dataDir = path.resolve(env.DATA_DIR || path.join(__dirname, '..', 'data'));

  let adminPassword = (env.ADMIN_PASSWORD || '').trim();
  const usingDefaultPassword = !adminPassword;
  if (usingDefaultPassword) {
    if (isProduction) {
      throw new Error('ADMIN_PASSWORD тохируулаагүй байна. .env файл эсвэл хостингийн Environment тохиргоонд нууц үгээ бичнэ үү.');
    }
    adminPassword = DEFAULT_ADMIN_PASSWORD;
  }

  return {
    port: parseInt(env.PORT, 10) || 3000,
    schoolName: (env.SCHOOL_NAME || 'Манай сургууль').trim(),
    adminPassword,
    usingDefaultPassword,
    sessionSecret: env.SESSION_SECRET || loadOrCreateSecret(dataDir),
    dataDir,
    maxUploadMb: parseInt(env.MAX_UPLOAD_MB, 10) || 100,
    trustProxy: Boolean(env.TRUST_PROXY),
    cookieSecure: Boolean(env.COOKIE_SECURE),
  };
}

/**
 * Сессийн нууц түлхүүрийг data хавтсанд хадгална. Ингэснээр сервер
 * дахин ачаалахад админ хэрэглэгч гарчихгүй.
 */
function loadOrCreateSecret(dataDir) {
  fs.mkdirSync(dataDir, { recursive: true });
  const file = path.join(dataDir, '.session-secret');
  try {
    const existing = fs.readFileSync(file, 'utf8').trim();
    if (existing.length >= 32) return existing;
  } catch {
    // файл байхгүй бол шинээр үүсгэнэ
  }
  const secret = crypto.randomBytes(32).toString('hex');
  fs.writeFileSync(file, secret, { mode: 0o600 });
  return secret;
}

module.exports = { loadConfig, DEFAULT_ADMIN_PASSWORD };
