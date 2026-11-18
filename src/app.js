'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const express = require('express');
const cookieSession = require('cookie-session');

const { openDatabase } = require('./db');
const helpers = require('./helpers');
const publicRoutes = require('./routes/public');
const adminRoutes = require('./routes/admin');

const ROOT = path.join(__dirname, '..');

const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "img-src 'self' data: blob:",
  "style-src 'self'",
  "script-src 'self'",
  "frame-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
].join('; ');

function createApp(config) {
  const paths = {
    db: path.join(config.dataDir, 'library.db'),
    books: path.join(config.dataDir, 'uploads', 'books'),
    covers: path.join(config.dataDir, 'uploads', 'covers'),
  };
  fs.mkdirSync(paths.books, { recursive: true });
  fs.mkdirSync(paths.covers, { recursive: true });

  const db = openDatabase(paths.db);
  const app = express();

  app.set('view engine', 'ejs');
  app.set('views', path.join(ROOT, 'views'));
  app.disable('x-powered-by');
  if (config.trustProxy) app.set('trust proxy', 1);

  app.locals.schoolName = config.schoolName;
  app.locals.h = helpers;
  app.locals.db = db;

  // Аюулгүй байдлын HTTP толгойнууд
  app.use((req, res, next) => {
    res.set({
      'Content-Security-Policy': CONTENT_SECURITY_POLICY,
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'SAMEORIGIN',
      'Referrer-Policy': 'same-origin',
    });
    next();
  });

  app.use('/static', express.static(path.join(ROOT, 'public'), { maxAge: '1d' }));
  app.use('/covers', express.static(paths.covers, { maxAge: '7d', index: false }));

  app.use(express.urlencoded({ extended: false, limit: '100kb' }));
  app.use(
    cookieSession({
      name: 'nomsan',
      keys: [config.sessionSecret],
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 8 * 60 * 60 * 1000, // 8 цаг
    }),
  );

  // CSRF токен, flash мэдэгдэл, загварт хэрэгтэй хувьсагчид
  app.use((req, res, next) => {
    if (!req.session.csrf) req.session.csrf = crypto.randomBytes(24).toString('hex');
    res.locals.csrfToken = req.session.csrf;
    res.locals.isAdmin = Boolean(req.session.isAdmin);
    res.locals.currentPath = req.path;
    res.locals.flash = req.session.flash || null;
    if (req.session.flash) req.session.flash = null;
    next();
  });

  app.use('/', publicRoutes({ db, paths }));
  app.use('/admin', adminRoutes({ db, paths, config }));

  app.use((req, res) => {
    res.status(404).render('error', {
      title: 'Хуудас олдсонгүй',
      message: 'Таны хайсан хуудас олдсонгүй. Холбоос буруу эсвэл ном устгагдсан байж магадгүй.',
    });
  });

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).render('error', {
      title: 'Алдаа гарлаа',
      message: 'Серверт алдаа гарлаа. Хэсэг хугацааны дараа дахин оролдоно уу.',
    });
  });

  return app;
}

module.exports = { createApp };
