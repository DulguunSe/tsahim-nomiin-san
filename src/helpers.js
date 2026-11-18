'use strict';

// EJS загварууд дотор ашиглах туслах функцууд (res.locals.h).

const GRADES = Array.from({ length: 12 }, (_, i) => i + 1);

const LANGUAGES = ['Монгол', 'Англи', 'Орос', 'Хятад', 'Солонгос', 'Япон', 'Герман', 'Бусад'];

const SUGGESTED_CATEGORIES = [
  'Уран зохиол', 'Сурах бичиг', 'Монгол хэл', 'Англи хэл', 'Математик',
  'Физик', 'Хими', 'Биологи', 'Түүх', 'Газарзүй', 'Мэдээлэл зүй',
  'Хүүхдийн ном', 'Шинжлэх ухаан', 'Нэвтэрхий толь',
];

const SORT_LABELS = {
  new: 'Шинээр нэмэгдсэн',
  title: 'Нэрээр (А–Я)',
  popular: 'Их уншигдсан',
};

function gradeLabel(grade) {
  return grade ? `${grade}-р анги` : 'Бүх анги';
}

function formatSize(bytes) {
  if (!bytes) return '';
  const units = ['Б', 'КБ', 'МБ', 'ГБ'];
  let size = bytes;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}

function formatDate(sqliteDate) {
  return sqliteDate ? String(sqliteDate).slice(0, 10) : '';
}

function formatNumber(n) {
  return Number(n || 0).toLocaleString('en-US').replace(/,/g, ' ');
}

/** Номын нүүр зураг байхгүй үед ашиглах өнгө (8 хувилбараас). */
function coverClass(book) {
  return `cover-c${(Number(book.id) || 0) % 8}`;
}

/** Хайлт, шүүлтүүрийг хадгалсан холбоос үүсгэнэ. */
function queryString(params, overrides = {}) {
  const merged = { ...params, ...overrides };
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(merged)) {
    if (value !== undefined && value !== null && value !== '' && !(key === 'page' && value === 1)) {
      search.set(key, value);
    }
  }
  const str = search.toString();
  return str ? `?${str}` : '';
}

/** Хуудаслалтын дугааруудыг (1 … 4 5 6 … 20) буцаана. */
function pageNumbers(current, total) {
  const pages = new Set([1, total, current - 1, current, current + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const result = [];
  let prev = 0;
  for (const p of sorted) {
    if (p - prev > 1) result.push(null);
    result.push(p);
    prev = p;
  }
  return result;
}

module.exports = {
  GRADES,
  LANGUAGES,
  SUGGESTED_CATEGORIES,
  SORT_LABELS,
  gradeLabel,
  formatSize,
  formatDate,
  formatNumber,
  coverClass,
  queryString,
  pageNumbers,
};
