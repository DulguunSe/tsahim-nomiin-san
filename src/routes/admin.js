'use strict';

const path = require('node:path');
const crypto = require('node:crypto');
const express = require('express');

const { LANGUAGES } = require('../helpers');
const {
  createUploader,
  uploadedFile,
  removeUploadedFiles,
  removeFile,
  isRealPdf,
  isRealImage,
} = require('../upload');

const PAGE_SIZE = 50;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 10;

function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

function str(value, max) {
  return String(value ?? '').trim().slice(0, max);
}

/** Маягтаас ирсэн утгуудыг цэвэрлэж, алдааны жагсаалт буцаана. */
function readBookForm(body) {
  const errors = [];
  const currentYear = new Date().getFullYear();

  const book = {
    title: str(body.title, 300),
    author: str(body.author, 200),
    category: str(body.category, 100),
    grade: null,
    year: null,
    language: str(body.language, 50) || 'Монгол',
    description: str(body.description, 5000),
    external_url: str(body.external_url, 1000) || null,
  };

  if (!book.title) errors.push('Номын нэрийг заавал бичнэ үү.');

  if (body.grade) {
    const grade = parseInt(body.grade, 10);
    if (grade >= 1 && grade <= 12) book.grade = grade;
    else errors.push('Анги 1-12 хооронд байх ёстой.');
  }

  if (body.year) {
    const year = parseInt(body.year, 10);
    if (year >= 1000 && year <= currentYear + 1) book.year = year;
    else errors.push(`Хэвлэгдсэн он 1000-${currentYear + 1} хооронд байх ёстой.`);
  }

  if (book.external_url) {
    let url = null;
    try {
      url = new URL(book.external_url);
    } catch {
      // доор алдаа нэмнэ
    }
    if (!url || !['http:', 'https:'].includes(url.protocol)) {
      errors.push('Холбоос http:// эсвэл https:// -ээр эхэлсэн зөв хаяг байх ёстой.');
    }
  }

  return { book, errors };
}

module.exports = function adminRoutes({ db, paths, config }) {
  const router = express.Router();
  const handleUpload = createUploader({ paths, maxUploadMb: config.maxUploadMb });
  const loginAttempts = new Map();

  router.use((req, res, next) => {
    res.locals.usingDefaultPassword = config.usingDefaultPassword;
    res.locals.maxUploadMb = config.maxUploadMb;
    next();
  });

  function verifyCsrf(req) {
    const token = req.body && req.body._csrf;
    return typeof token === 'string' && token.length > 0 && safeEqual(token, req.session.csrf);
  }

  function requireCsrf(req, res, next) {
    if (verifyCsrf(req)) return next();
    removeUploadedFiles(req);
    res.status(403).render('error', {
      title: 'Хүсэлт хүчингүй',
      message: 'Хуудасны хугацаа дууссан байна. Хуудсаа дахин ачаалаад оролдоно уу.',
    });
  }

  function requireAdmin(req, res, next) {
    if (req.session.isAdmin) return next();
    removeUploadedFiles(req);
    res.redirect('/admin/login');
  }

  function setFlash(req, type, message) {
    req.session.flash = { type, message };
  }

  // ---------- Нэвтрэх / гарах ----------

  router.get('/login', (req, res) => {
    if (req.session.isAdmin) return res.redirect('/admin');
    res.render('admin/login', { title: 'Админ нэвтрэх', error: null });
  });

  router.post('/login', requireCsrf, (req, res) => {
    const key = req.ip || 'unknown';
    const now = Date.now();
    const record = loginAttempts.get(key);
    if (record && now - record.first > LOGIN_WINDOW_MS) loginAttempts.delete(key);
    const attempts = loginAttempts.get(key);

    if (attempts && attempts.count >= LOGIN_MAX_ATTEMPTS) {
      return res.status(429).render('admin/login', {
        title: 'Админ нэвтрэх',
        error: 'Хэт олон удаа буруу оролдлоо. 15 минутын дараа дахин оролдоно уу.',
      });
    }

    if (!safeEqual(req.body.password || '', config.adminPassword)) {
      if (attempts) attempts.count += 1;
      else loginAttempts.set(key, { count: 1, first: now });
      return res.status(401).render('admin/login', {
        title: 'Админ нэвтрэх',
        error: 'Нууц үг буруу байна.',
      });
    }

    loginAttempts.delete(key);
    req.session.isAdmin = true;
    req.session.csrf = crypto.randomBytes(24).toString('hex');
    setFlash(req, 'success', 'Амжилттай нэвтэрлээ.');
    res.redirect('/admin');
  });

  router.post('/logout', requireCsrf, (req, res) => {
    req.session = null;
    res.redirect('/');
  });

  // ---------- Самбар ----------

  router.get('/', requireAdmin, (req, res) => {
    const q = str(req.query.q, 200);
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const { books, total } = db.listBooks({
      q,
      sort: 'new',
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    });
    res.render('admin/dashboard', {
      title: 'Админ самбар',
      books,
      total,
      q,
      page,
      totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
      stats: db.stats(),
    });
  });

  // ---------- Ном нэмэх / засах ----------

  function renderForm(res, { book, errors = [], status = 200 }) {
    const known = new Set(db.listCategories().map((c) => c.name));
    res.status(status).render('admin/form', {
      title: book.id ? 'Ном засах' : 'Шинэ ном нэмэх',
      book,
      errors,
      languages: LANGUAGES,
      knownCategories: [...known],
    });
  }

  router.get('/books/new', requireAdmin, (req, res) => {
    renderForm(res, { book: { language: 'Монгол' } });
  });

  router.post('/books', requireAdmin, handleUpload, requireCsrf, (req, res) => {
    const { book, errors } = readBookForm(req.body);
    const pdf = uploadedFile(req, 'pdf');
    const cover = uploadedFile(req, 'cover');

    if (req.uploadError) errors.unshift(req.uploadError);
    if (pdf && !isRealPdf(pdf.path)) errors.push('Оруулсан файл жинхэнэ PDF биш байна.');
    if (cover && !isRealImage(cover.path)) errors.push('Нүүр зураг буруу форматтай байна.');
    if (!req.uploadError && !pdf && !book.external_url) {
      errors.push('PDF файл эсвэл гадны холбоосын аль нэгийг оруулна уу.');
    }

    if (errors.length) {
      removeUploadedFiles(req);
      return renderForm(res, { book, errors, status: 400 });
    }

    const id = db.createBook({
      ...book,
      file_name: pdf ? pdf.filename : null,
      file_size: pdf ? pdf.size : null,
      cover_name: cover ? cover.filename : null,
    });
    setFlash(req, 'success', `“${book.title}” ном амжилттай нэмэгдлээ.`);
    res.redirect(`/books/${id}`);
  });

  function findBook(req, res, next) {
    const id = parseInt(req.params.id, 10);
    const book = Number.isInteger(id) ? db.getBook(id) : null;
    if (!book) {
      removeUploadedFiles(req);
      return next('router');
    }
    req.book = book;
    next();
  }

  router.get('/books/:id/edit', requireAdmin, findBook, (req, res) => {
    renderForm(res, { book: req.book });
  });

  router.post('/books/:id', requireAdmin, findBook, handleUpload, requireCsrf, (req, res) => {
    const existing = req.book;
    const { book, errors } = readBookForm(req.body);
    const pdf = uploadedFile(req, 'pdf');
    const cover = uploadedFile(req, 'cover');
    const removePdf = req.body.remove_pdf === '1';
    const removeCover = req.body.remove_cover === '1';

    if (req.uploadError) errors.unshift(req.uploadError);
    if (pdf && !isRealPdf(pdf.path)) errors.push('Оруулсан файл жинхэнэ PDF биш байна.');
    if (cover && !isRealImage(cover.path)) errors.push('Нүүр зураг буруу форматтай байна.');

    const keepsPdf = pdf || (existing.file_name && !removePdf);
    if (!req.uploadError && !keepsPdf && !book.external_url) {
      errors.push('PDF файл эсвэл гадны холбоосын аль нэгийг үлдээнэ үү.');
    }

    if (errors.length) {
      removeUploadedFiles(req);
      return renderForm(res, {
        book: { ...existing, ...book, id: existing.id },
        errors,
        status: 400,
      });
    }

    const updated = {
      ...book,
      file_name: existing.file_name,
      file_size: existing.file_size,
      cover_name: existing.cover_name,
    };
    const filesToDelete = [];

    if (pdf || removePdf) {
      if (existing.file_name) filesToDelete.push(path.join(paths.books, existing.file_name));
      updated.file_name = pdf ? pdf.filename : null;
      updated.file_size = pdf ? pdf.size : null;
    }
    if (cover || removeCover) {
      if (existing.cover_name) filesToDelete.push(path.join(paths.covers, existing.cover_name));
      updated.cover_name = cover ? cover.filename : null;
    }

    db.updateBook(existing.id, updated);
    filesToDelete.forEach(removeFile);
    setFlash(req, 'success', 'Өөрчлөлт хадгалагдлаа.');
    res.redirect(`/books/${existing.id}`);
  });

  router.post('/books/:id/delete', requireAdmin, findBook, requireCsrf, (req, res) => {
    const { book } = req;
    db.deleteBook(book.id);
    if (book.file_name) removeFile(path.join(paths.books, book.file_name));
    if (book.cover_name) removeFile(path.join(paths.covers, book.cover_name));
    setFlash(req, 'success', `“${book.title}” ном устгагдлаа.`);
    res.redirect('/admin');
  });

  return router;
};
