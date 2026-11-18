'use strict';

const path = require('node:path');
const express = require('express');

const PAGE_SIZE = 24;
const SORTS = ['new', 'title', 'popular'];

function parseGrade(value) {
  const grade = parseInt(value, 10);
  return grade >= 1 && grade <= 12 ? grade : null;
}

/** Файлын нэрийг Content-Disposition толгойд (кирилл үсэгтэй) зөв бичнэ. */
function contentDisposition(type, filename) {
  const ascii = filename.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '');
  return `${type}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

function pdfFileName(book) {
  const safe = book.title.replace(/[\\/:*?"<>|\r\n]+/g, ' ').trim().slice(0, 120);
  return `${safe || 'nom'}.pdf`;
}

module.exports = function publicRoutes({ db, paths }) {
  const router = express.Router();

  // Ном хайх / жагсаалт
  router.get('/', (req, res) => {
    const filters = {
      q: String(req.query.q ?? '').trim().slice(0, 200),
      category: String(req.query.category ?? '').trim().slice(0, 100),
      grade: parseGrade(req.query.grade),
      sort: SORTS.includes(req.query.sort) ? req.query.sort : 'new',
    };
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const { books, total } = db.listBooks({
      ...filters,
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    });

    res.render('index', {
      title: '',
      books,
      total,
      filters,
      page,
      totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
      categories: db.listCategories(),
      isFiltered: Boolean(filters.q || filters.category || filters.grade),
    });
  });

  function findBook(req, res, next) {
    const id = parseInt(req.params.id, 10);
    const book = Number.isInteger(id) ? db.getBook(id) : null;
    if (!book) return next('router');
    req.book = book;
    next();
  }

  // Номын дэлгэрэнгүй
  router.get('/books/:id', findBook, (req, res) => {
    db.addView(req.book.id);
    const book = { ...req.book, views: req.book.views + 1 };
    res.render('book', {
      title: book.title,
      book,
      related: db.relatedBooks(book),
    });
  });

  // PDF-ийг хөтөч дээр шууд нээх (онлайн унших)
  router.get('/books/:id/file', findBook, (req, res, next) => {
    if (!req.book.file_name) return next('router');
    res.removeHeader('Content-Security-Policy');
    res.sendFile(path.join(paths.books, path.basename(req.book.file_name)), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': contentDisposition('inline', pdfFileName(req.book)),
      },
    }, (err) => {
      if (err && !res.headersSent) next(err.status === 404 ? 'router' : err);
    });
  });

  // PDF татаж авах
  router.get('/books/:id/download', findBook, (req, res, next) => {
    if (!req.book.file_name) return next('router');
    const filePath = path.join(paths.books, path.basename(req.book.file_name));
    res.download(filePath, pdfFileName(req.book), (err) => {
      if (err) {
        if (!res.headersSent) next(err.status === 404 ? 'router' : err);
        return;
      }
      db.addDownload(req.book.id);
    });
  });

  // Гадны холбоос руу шилжих (татсан тоог тоолохын тулд)
  router.get('/books/:id/link', findBook, (req, res, next) => {
    if (!req.book.external_url) return next('router');
    db.addDownload(req.book.id);
    res.redirect(req.book.external_url);
  });

  return router;
};
