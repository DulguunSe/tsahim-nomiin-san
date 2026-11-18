'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { loadConfig } = require('../src/config');
const { createApp } = require('../src/app');
const { mongolianSortKey } = require('../src/db');
const { makeSamplePdf } = require('../scripts/sample-pdf');

const PASSWORD = 'test-nuuts-ug';
let server;
let baseUrl;
let dataDir;
let app;

/** Энгийн хөтөч: cookie хадгалж, redirect-ийг дагахгүй. */
class Browser {
  constructor() {
    this.cookies = new Map();
  }

  async request(urlPath, options = {}) {
    const headers = { ...(options.headers || {}) };
    if (this.cookies.size) {
      headers.cookie = [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ');
    }
    const res = await fetch(baseUrl + urlPath, { ...options, headers, redirect: 'manual' });
    for (const cookie of res.headers.getSetCookie()) {
      const [pair] = cookie.split(';');
      const index = pair.indexOf('=');
      this.cookies.set(pair.slice(0, index), pair.slice(index + 1));
    }
    return res;
  }

  async csrf(urlPath) {
    const html = await (await this.request(urlPath)).text();
    const match = html.match(/name="_csrf" value="([^"]+)"/);
    assert.ok(match, `CSRF токен олдсонгүй: ${urlPath}`);
    return match[1];
  }

  async login() {
    const token = await this.csrf('/admin/login');
    const res = await this.request('/admin/login', {
      method: 'POST',
      body: new URLSearchParams({ _csrf: token, password: PASSWORD }),
    });
    assert.equal(res.status, 302);
    assert.equal(res.headers.get('location'), '/admin');
  }

  async addBook(fields, files = {}) {
    const token = await this.csrf('/admin/books/new');
    const form = new FormData();
    form.set('_csrf', token);
    for (const [key, value] of Object.entries(fields)) form.set(key, value);
    for (const [key, file] of Object.entries(files)) form.set(key, file.blob, file.name);
    return this.request('/admin/books', { method: 'POST', body: form });
  }
}

const pdfBlob = () => new Blob([makeSamplePdf(['Test book'])], { type: 'application/pdf' });

before(async () => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nomsan-test-'));
  const config = loadConfig({ DATA_DIR: dataDir, ADMIN_PASSWORD: PASSWORD, SCHOOL_NAME: 'Туршилтын сургууль' });
  app = createApp(config);
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  app.locals.db.close();
  fs.rmSync(dataDir, { recursive: true, force: true });
});

test('нүүр хуудас сургуулийн нэртэй нээгдэнэ', async () => {
  const res = await fetch(baseUrl + '/');
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /Туршилтын сургууль/);
  assert.match(html, /Одоогоор ном нэмэгдээгүй байна/);
});

test('нэвтрээгүй хүн админ хэсэгт орж чадахгүй', async () => {
  const browser = new Browser();
  for (const url of ['/admin', '/admin/books/new']) {
    const res = await browser.request(url);
    assert.equal(res.status, 302, url);
    assert.equal(res.headers.get('location'), '/admin/login');
  }
});

test('буруу нууц үгээр нэвтрэхгүй', async () => {
  const browser = new Browser();
  const token = await browser.csrf('/admin/login');
  const res = await browser.request('/admin/login', {
    method: 'POST',
    body: new URLSearchParams({ _csrf: token, password: 'buruu' }),
  });
  assert.equal(res.status, 401);
  assert.equal((await browser.request('/admin')).status, 302);
});

test('CSRF токенгүй хүсэлтийг хүлээж авахгүй', async () => {
  const browser = new Browser();
  await browser.login();
  const form = new FormData();
  form.set('title', 'Токенгүй ном');
  form.set('pdf', pdfBlob(), 'nom.pdf');
  const res = await browser.request('/admin/books', { method: 'POST', body: form });
  assert.equal(res.status, 403);
  assert.equal(fs.readdirSync(path.join(dataDir, 'uploads', 'books')).length, 0);
});

test('PDF-тэй ном нэмж, хайж, уншиж, татаж, устгана', async () => {
  const browser = new Browser();
  await browser.login();

  const res = await browser.addBook(
    { title: 'Математикийн бодлогууд', author: 'Б. Болд', category: 'Математик', grade: '5', year: '2024' },
    { pdf: { blob: pdfBlob(), name: 'Математик.pdf' } },
  );
  assert.equal(res.status, 302);
  const bookUrl = res.headers.get('location');
  assert.match(bookUrl, /^\/books\/\d+$/);

  // Номын хуудас
  const page = await (await fetch(baseUrl + bookUrl)).text();
  assert.match(page, /Математикийн бодлогууд/);
  assert.match(page, /5-р анги/);

  // Кирилл том үсгээр хайхад олдоно (том, жижиг үсэг ялгахгүй)
  const search = await (await fetch(baseUrl + '/?q=' + encodeURIComponent('МАТЕМАТИК болд'))).text();
  assert.match(search, /Математикийн бодлогууд/);
  const miss = await (await fetch(baseUrl + '/?q=' + encodeURIComponent('физик'))).text();
  assert.match(miss, /Тохирох ном олдсонгүй/);

  // Ангиар шүүх
  assert.match(await (await fetch(baseUrl + '/?grade=5')).text(), /Математикийн бодлогууд/);
  assert.doesNotMatch(await (await fetch(baseUrl + '/?grade=6')).text(), /Математикийн бодлогууд/);

  // Онлайн унших
  const file = await fetch(baseUrl + bookUrl + '/file');
  assert.equal(file.status, 200);
  assert.equal(file.headers.get('content-type'), 'application/pdf');
  assert.match(file.headers.get('content-disposition'), /^inline;/);

  // Татах
  const download = await fetch(baseUrl + bookUrl + '/download');
  assert.equal(download.status, 200);
  assert.match(download.headers.get('content-disposition'), /^attachment;/);
  assert.equal((await download.arrayBuffer()).byteLength > 0, true);

  // Статистик шинэчлэгдсэн
  const dashboard = await (await browser.request('/admin')).text();
  assert.match(dashboard, /Математикийн бодлогууд/);

  // Устгах
  const id = bookUrl.split('/').pop();
  const token = await browser.csrf(`/admin/books/${id}/edit`);
  const del = await browser.request(`/admin/books/${id}/delete`, {
    method: 'POST',
    body: new URLSearchParams({ _csrf: token }),
  });
  assert.equal(del.status, 302);
  assert.equal((await fetch(baseUrl + bookUrl)).status, 404);
  assert.equal(fs.readdirSync(path.join(dataDir, 'uploads', 'books')).length, 0);
});

test('PDF биш файлыг хүлээж авахгүй', async () => {
  const browser = new Browser();
  await browser.login();

  const wrongExt = await browser.addBook(
    { title: 'Буруу файл' },
    { pdf: { blob: new Blob(['hello']), name: 'virus.exe' } },
  );
  assert.equal(wrongExt.status, 400);
  assert.match(await wrongExt.text(), /зөвхөн PDF/);

  const fakePdf = await browser.addBook(
    { title: 'Хуурамч PDF' },
    { pdf: { blob: new Blob(['<html>not a pdf</html>']), name: 'fake.pdf' } },
  );
  assert.equal(fakePdf.status, 400);
  assert.match(await fakePdf.text(), /жинхэнэ PDF биш/);

  assert.equal(fs.readdirSync(path.join(dataDir, 'uploads', 'books')).length, 0);
});

test('файлгүй бол гадны холбоос шаардана, холбоостой ном нэмэгдэнэ', async () => {
  const browser = new Browser();
  await browser.login();

  const missing = await browser.addBook({ title: 'Файлгүй ном' });
  assert.equal(missing.status, 400);
  assert.match(await missing.text(), /PDF файл эсвэл гадны холбоос/);

  const badUrl = await browser.addBook({ title: 'Муу холбоос', external_url: 'javascript:alert(1)' });
  assert.equal(badUrl.status, 400);

  const ok = await browser.addBook({ title: 'Онлайн ном', external_url: 'https://example.org/book.pdf' });
  assert.equal(ok.status, 302);
  const link = await fetch(baseUrl + ok.headers.get('location') + '/link', { redirect: 'manual' });
  assert.equal(link.status, 302);
  assert.equal(link.headers.get('location'), 'https://example.org/book.pdf');
});

test('HTML тэмдэгтүүд escape хийгдэнэ', async () => {
  const browser = new Browser();
  await browser.login();
  const res = await browser.addBook({ title: '<script>alert(1)</script>', external_url: 'https://example.org' });
  const html = await (await fetch(baseUrl + res.headers.get('location'))).text();
  assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/);
  assert.match(html, /&lt;script&gt;/);
});

test('монгол цагаан толгойн дарааллаар эрэмбэлнэ', () => {
  const titles = ['Үлгэр', 'Өдөр', 'Анар', 'Хүүхэд', 'Оюун', 'Ус', 'Ёс'];
  const sorted = [...titles].sort((a, b) => (mongolianSortKey(a) < mongolianSortKey(b) ? -1 : 1));
  assert.deepEqual(sorted, ['Анар', 'Ёс', 'Оюун', 'Өдөр', 'Ус', 'Үлгэр', 'Хүүхэд']);
});

test('номыг засах: нэр солих, PDF-ийг холбоосоор солих', async () => {
  const browser = new Browser();
  await browser.login();
  const created = await browser.addBook(
    { title: 'Хуучин нэр' },
    { pdf: { blob: pdfBlob(), name: 'a.pdf' } },
  );
  const id = created.headers.get('location').split('/').pop();
  const booksDir = path.join(dataDir, 'uploads', 'books');
  const before = fs.readdirSync(booksDir).length;

  // PDF-ийг устгаад холбоос үлдээхгүй бол алдаа
  let token = await browser.csrf(`/admin/books/${id}/edit`);
  let form = new FormData();
  form.set('_csrf', token);
  form.set('title', 'Шинэ нэр');
  form.set('remove_pdf', '1');
  let res = await browser.request(`/admin/books/${id}`, { method: 'POST', body: form });
  assert.equal(res.status, 400);

  // Холбоос өгвөл PDF устаж, нэр солигдоно
  token = await browser.csrf(`/admin/books/${id}/edit`);
  form = new FormData();
  form.set('_csrf', token);
  form.set('title', 'Шинэ нэр');
  form.set('remove_pdf', '1');
  form.set('external_url', 'https://example.org/new.pdf');
  res = await browser.request(`/admin/books/${id}`, { method: 'POST', body: form });
  assert.equal(res.status, 302);

  const html = await (await fetch(`${baseUrl}/books/${id}`)).text();
  assert.match(html, /Шинэ нэр/);
  assert.doesNotMatch(html, /Татаж авах/);
  assert.equal(fs.readdirSync(booksDir).length, before - 1);
  assert.equal((await fetch(`${baseUrl}/books/${id}/file`)).status, 404);
});
