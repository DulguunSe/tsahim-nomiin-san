'use strict';

// Жишээ номуудыг мэдээллийн санд нэмнэ:  npm run seed
// Дахин нэмэх бол:                        npm run seed -- --force

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const envFile = path.join(__dirname, '..', '.env');
if (fs.existsSync(envFile)) process.loadEnvFile(envFile);

const { loadConfig } = require('../src/config');
const { openDatabase } = require('../src/db');
const { makeSamplePdf } = require('./sample-pdf');

const NOTE = '\n\n(Энэ бол жишээ ном. Админ хэсгээс засах эсвэл устгах боломжтой.)';

const SAMPLE_BOOKS = [
  { title: 'Математик — 5-р анги', author: 'Б. Болд', category: 'Математик', grade: 5, year: 2023,
    description: 'Бутархай, аравтын бутархай, геометрийн анхан шатны ойлголтуудыг жишээ, дасгалын хамт тайлбарласан сурах бичиг.' },
  { title: 'Монгол хэл, уран зохиол', author: 'Д. Сарнай', category: 'Монгол хэл', grade: 9, year: 2022,
    description: 'Монгол хэлний дүрэм, найруулга зүй болон уран зохиолын шилдэг бүтээлүүдийн шинжилгээ.' },
  { title: 'Физикийн үндэс', author: 'Г. Тэмүүлэн', category: 'Физик', grade: 10, year: 2021,
    description: 'Механик, дулаан, цахилгааны үндсэн хуулиудыг өдөр тутмын жишээгээр ойлгомжтой тайлбарлана.' },
  { title: 'Англи хэлний дасгал ажил', author: 'С. Номин', category: 'Англи хэл', grade: 7, year: 2024, language: 'Англи',
    description: 'Үгсийн сан, дүрмийн дасгал, унших чадварыг хөгжүүлэх даалгаврууд.' },
  { title: 'Монголын түүхийн товчоон', author: 'Ч. Эрдэнэ', category: 'Түүх', grade: null, year: 2020,
    description: 'Эртний нүүдэлчдээс орчин үе хүртэлх Монголын түүхийн гол үйл явдлуудын товч тойм.' },
  { title: 'Үлгэрийн түүвэр', author: 'Эмхэтгэсэн: Ж. Оюун', category: 'Хүүхдийн ном', grade: 3, year: 2019,
    description: 'Бага ангийн сурагчдад зориулсан монгол ардын үлгэрүүдийн түүвэр.' },
  { title: 'Програмчлалын анхан шат', author: 'Т. Анар', category: 'Мэдээлэл зүй', grade: 11, year: 2024,
    description: 'Алгоритм, хувьсагч, нөхцөл, давталт зэрэг програмчлалын үндсэн ойлголтууд.' },
  { title: 'Байгаль ба бид', author: 'О. Ундрах', category: 'Биологи', grade: 6, year: 2022,
    description: 'Ургамал, амьтан, экосистем болон байгаль хамгааллын тухай сонирхолтой мэдээлэл.' },
];

function main() {
  const config = loadConfig();
  const booksDir = path.join(config.dataDir, 'uploads', 'books');
  fs.mkdirSync(booksDir, { recursive: true });
  fs.mkdirSync(path.join(config.dataDir, 'uploads', 'covers'), { recursive: true });

  const db = openDatabase(path.join(config.dataDir, 'library.db'));
  if (db.stats().books > 0 && !process.argv.includes('--force')) {
    console.log('Мэдээллийн санд аль хэдийн ном байна. Дахин нэмэх бол: npm run seed -- --force');
    db.close();
    return;
  }

  SAMPLE_BOOKS.forEach((sample, i) => {
    const pdf = makeSamplePdf([
      `Sample book #${i + 1}`,
      'Tsahim nomiin san - demo PDF',
      'Replace this file with a real book from the admin panel.',
    ]);
    const fileName = `${crypto.randomUUID()}.pdf`;
    fs.writeFileSync(path.join(booksDir, fileName), pdf);
    db.createBook({
      language: 'Монгол',
      ...sample,
      description: sample.description + NOTE,
      file_name: fileName,
      file_size: pdf.length,
    });
  });

  console.log(`${SAMPLE_BOOKS.length} жишээ ном нэмэгдлээ.`);
  db.close();
}

main();
