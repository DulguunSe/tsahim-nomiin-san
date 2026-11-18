'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// .env файл байвал уншина
const envFile = path.join(__dirname, '.env');
if (fs.existsSync(envFile)) process.loadEnvFile(envFile);

const { loadConfig, DEFAULT_ADMIN_PASSWORD } = require('./src/config');
const { createApp } = require('./src/app');

const config = loadConfig();
const app = createApp(config);

app.listen(config.port, () => {
  console.log('');
  console.log(`📚 ${config.schoolName} — цахим номын сан ажиллаж байна`);
  console.log(`   Энэ компьютер дээр:  http://localhost:${config.port}`);

  // Сургуулийн дотоод сүлжээнд байгаа бусад компьютерээс хандах хаягууд
  for (const addresses of Object.values(os.networkInterfaces())) {
    for (const addr of addresses || []) {
      if (addr.family === 'IPv4' && !addr.internal) {
        console.log(`   Бусад компьютерээс:  http://${addr.address}:${config.port}`);
      }
    }
  }

  console.log(`   Админ хэсэг:         http://localhost:${config.port}/admin`);
  if (config.usingDefaultPassword) {
    console.log('');
    console.log(`⚠️  Админы нууц үг анхдагч "${DEFAULT_ADMIN_PASSWORD}" байна.`);
    console.log('   .env файлд ADMIN_PASSWORD=... гэж өөрийн нууц үгийг тохируулна уу.');
  }
  console.log('');
});
