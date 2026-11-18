'use strict';

// node:sqlite нь Node.js-д суурилагдсан SQLite. Түүний "experimental"
// анхааруулгыг консолд гаргахгүйн тулд шүүнэ.
const originalEmitWarning = process.emitWarning;
process.emitWarning = function emitWarning(warning, ...args) {
  const type = typeof args[0] === 'string' ? args[0] : args[0] && args[0].type;
  if (type === 'ExperimentalWarning' && /SQLite/i.test(String(warning))) return;
  return originalEmitWarning.call(process, warning, ...args);
};

const { DatabaseSync } = require('node:sqlite');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS books (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  title        TEXT    NOT NULL,
  author       TEXT    NOT NULL DEFAULT '',
  category     TEXT    NOT NULL DEFAULT '',
  grade        INTEGER,                       -- 1-12, NULL бол бүх ангид
  year         INTEGER,
  language     TEXT    NOT NULL DEFAULT 'Монгол',
  description  TEXT    NOT NULL DEFAULT '',
  file_name    TEXT,                          -- uploads/books доторх PDF
  file_size    INTEGER,
  external_url TEXT,                          -- PDF-ийн оронд гадны холбоос
  cover_name   TEXT,                          -- uploads/covers доторх зураг
  views        INTEGER NOT NULL DEFAULT 0,
  downloads    INTEGER NOT NULL DEFAULT 0,
  search_text  TEXT    NOT NULL DEFAULT '',   -- жижиг үсгээр хайлтын текст
  created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_books_category ON books(category);
CREATE INDEX IF NOT EXISTS idx_books_grade ON books(grade);
`;

// Монгол цагаан толгойн дараалал (кирилл үсгийн Unicode дараалал Ө, Ү, Ё-г
// буруу байрлуулдаг тул нэрээр эрэмбэлэхэд өөрсдөө түлхүүр үүсгэнэ).
const MN_ALPHABET = 'абвгдеёжзийклмноөпрстуүфхцчшщъыьэюя';

function mongolianSortKey(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[а-яёөү]/g, (ch) => String.fromCharCode(0x0400 + MN_ALPHABET.indexOf(ch)));
}

const mnCollator = new Intl.Collator('mn');

function buildSearchText(book) {
  return [book.title, book.author, book.category, book.description, book.year ?? '']
    .join(' ')
    .toLowerCase();
}

function escapeLike(text) {
  return text.replace(/[\\%_]/g, (ch) => '\\' + ch);
}

const SORT_ORDERS = {
  new: 'created_at DESC, id DESC',
  title: 'mn_key(title) ASC, id ASC',
  popular: '(views + downloads) DESC, id DESC',
};

const BOOK_FIELDS = [
  'title', 'author', 'category', 'grade', 'year', 'language',
  'description', 'file_name', 'file_size', 'external_url', 'cover_name',
];

function openDatabase(file) {
  const db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode = WAL;');
  db.function('mn_key', { deterministic: true }, mongolianSortKey);
  db.exec(SCHEMA);

  const columns = BOOK_FIELDS.join(', ');
  const placeholders = BOOK_FIELDS.map((f) => ':' + f).join(', ');
  const assignments = BOOK_FIELDS.map((f) => `${f} = :${f}`).join(', ');

  const stmt = {
    get: db.prepare('SELECT * FROM books WHERE id = ?'),
    insert: db.prepare(
      `INSERT INTO books (${columns}, search_text) VALUES (${placeholders}, :search_text)`,
    ),
    update: db.prepare(
      `UPDATE books SET ${assignments}, search_text = :search_text,
       updated_at = datetime('now') WHERE id = :id`,
    ),
    remove: db.prepare('DELETE FROM books WHERE id = ?'),
    addView: db.prepare('UPDATE books SET views = views + 1 WHERE id = ?'),
    addDownload: db.prepare('UPDATE books SET downloads = downloads + 1 WHERE id = ?'),
    categories: db.prepare(
      `SELECT category AS name, COUNT(*) AS count FROM books
       WHERE category <> '' GROUP BY category`,
    ),
    related: db.prepare(
      `SELECT * FROM books WHERE category = ? AND id <> ?
       ORDER BY (views + downloads) DESC, id DESC LIMIT ?`,
    ),
    stats: db.prepare(
      `SELECT COUNT(*) AS books,
              COALESCE(SUM(views), 0) AS views,
              COALESCE(SUM(downloads), 0) AS downloads,
              COUNT(DISTINCT NULLIF(category, '')) AS categories
       FROM books`,
    ),
  };

  function toParams(book) {
    const params = {};
    for (const field of BOOK_FIELDS) params[field] = book[field] ?? null;
    params.search_text = buildSearchText(book);
    return params;
  }

  return {
    raw: db,

    listBooks({ q = '', category = '', grade = null, sort = 'new', limit = 24, offset = 0 } = {}) {
      const where = [];
      const params = [];
      const words = q.toLowerCase().split(/\s+/).filter(Boolean).slice(0, 8);
      for (const word of words) {
        where.push("search_text LIKE ? ESCAPE '\\'");
        params.push(`%${escapeLike(word)}%`);
      }
      if (category) {
        where.push('category = ?');
        params.push(category);
      }
      if (grade) {
        where.push('grade = ?');
        params.push(grade);
      }
      const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
      const order = SORT_ORDERS[sort] || SORT_ORDERS.new;

      const { n: total } = db.prepare(`SELECT COUNT(*) AS n FROM books ${whereSql}`).get(...params);
      const books = db
        .prepare(`SELECT * FROM books ${whereSql} ORDER BY ${order} LIMIT ? OFFSET ?`)
        .all(...params, limit, offset);
      return { books, total };
    },

    getBook(id) {
      return stmt.get.get(id) || null;
    },

    createBook(book) {
      const result = stmt.insert.run(toParams(book));
      return Number(result.lastInsertRowid);
    },

    updateBook(id, book) {
      stmt.update.run({ ...toParams(book), id });
    },

    deleteBook(id) {
      stmt.remove.run(id);
    },

    addView(id) {
      stmt.addView.run(id);
    },

    addDownload(id) {
      stmt.addDownload.run(id);
    },

    listCategories() {
      return stmt.categories.all().sort((a, b) => mnCollator.compare(a.name, b.name));
    },

    relatedBooks(book, limit = 6) {
      if (!book.category) return [];
      return stmt.related.all(book.category, book.id, limit);
    },

    stats() {
      return stmt.stats.get();
    },

    close() {
      db.close();
    },
  };
}

module.exports = { openDatabase, mongolianSortKey };
