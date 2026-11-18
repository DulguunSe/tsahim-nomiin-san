'use strict';

// Бүх хуудсанд хэрэглэгдэх туслах функцууд.
window.Lib = (() => {
  const CONFIG = window.SITE_CONFIG;

  const GRADES = Array.from({ length: 12 }, (_, i) => i + 1);
  const LANGUAGES = ['Монгол', 'Англи', 'Орос', 'Хятад', 'Солонгос', 'Япон', 'Герман', 'Бусад'];
  const SUGGESTED_CATEGORIES = [
    'Уран зохиол', 'Сурах бичиг', 'Монгол хэл', 'Англи хэл', 'Математик',
    'Физик', 'Хими', 'Биологи', 'Түүх', 'Газарзүй', 'Мэдээлэл зүй',
    'Хүүхдийн ном', 'Шинжлэх ухаан', 'Нэвтэрхий толь',
  ];
  const SORT_LABELS = { new: 'Шинээр нэмэгдсэн', title: 'Нэрээр (А–Я)' };

  const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, (ch) => ESCAPES[ch]);
  }

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

  // Монгол цагаан толгойн дарааллаар эрэмбэлэх түлхүүр (Ө, Ү, Ё зөв байрандаа)
  const MN_ALPHABET = 'абвгдеёжзийклмноөпрстуүфхцчшщъыьэюя';
  function mnKey(value) {
    return String(value ?? '')
      .toLowerCase()
      .replace(/[а-яёөү]/g, (ch) => String.fromCharCode(0x0400 + MN_ALPHABET.indexOf(ch)));
  }
  function mnCompare(a, b) {
    const ka = mnKey(a);
    const kb = mnKey(b);
    return ka < kb ? -1 : ka > kb ? 1 : 0;
  }

  /** Зөвхөн сайтын books/, covers/ хавтсын файлыг зөвшөөрнө. */
  function localPath(path) {
    return /^(books|covers)\/[\w.-]+$/.test(String(path || '')) ? path : '';
  }

  /** Зөвхөн http(s) холбоосыг зөвшөөрнө. */
  function httpUrl(url) {
    return /^https?:\/\/\S+$/i.test(String(url || '')) ? url : '';
  }

  function hash(text) {
    let h = 0;
    for (const ch of String(text)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return h;
  }

  function coverHtml(book) {
    if (localPath(book.cover)) {
      return `<img class="cover-img" src="${esc(book.cover)}" alt="“${esc(book.title)}” номын нүүр" loading="lazy">`;
    }
    return `<div class="cover-placeholder cover-c${hash(book.id) % 8}" aria-hidden="true">
      <span class="cover-ph-title">${esc(book.title)}</span>
      ${book.author ? `<span class="cover-ph-author">${esc(book.author)}</span>` : ''}
    </div>`;
  }

  function bookCardHtml(book) {
    return `<a class="book-card" href="book.html?id=${encodeURIComponent(book.id)}">
      <div class="book-cover">${coverHtml(book)}</div>
      <div class="book-info">
        <h3 class="book-title">${esc(book.title)}</h3>
        ${book.author ? `<p class="book-author">${esc(book.author)}</p>` : ''}
        <div class="book-tags">
          ${book.grade ? `<span class="tag">${esc(gradeLabel(book.grade))}</span>` : ''}
          ${book.category ? `<span class="tag tag-soft">${esc(book.category)}</span>` : ''}
        </div>
      </div>
    </a>`;
  }

  function searchText(book) {
    return [book.title, book.author, book.category, book.description, book.year ?? '']
      .join(' ')
      .toLowerCase();
  }

  function matchesQuery(book, query) {
    const words = String(query || '').toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return true;
    const text = searchText(book);
    return words.every((w) => text.includes(w));
  }

  function categoriesOf(books) {
    const counts = new Map();
    for (const b of books) {
      if (b.category) counts.set(b.category, (counts.get(b.category) || 0) + 1);
    }
    return [...counts].map(([name, count]) => ({ name, count })).sort((a, b) => mnCompare(a.name, b.name));
  }

  // Нүүр зураг ачаалагдахгүй бол (жишээ нь сайт шинэчлэгдэж амжаагүй) өнгөт нүүр харуулна
  document.addEventListener('error', (event) => {
    const img = event.target;
    if (img instanceof HTMLImageElement && img.classList.contains('cover-img') && !img.src.startsWith('blob:')) {
      const placeholder = document.createElement('div');
      placeholder.className = `cover-placeholder cover-c${hash(img.getAttribute('src')) % 8}`;
      img.replaceWith(placeholder);
    }
  }, true);

  async function loadLibrary() {
    const res = await fetch('library.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error('Номын жагсаалтыг ачаалж чадсангүй.');
    const data = await res.json();
    data.books = Array.isArray(data.books) ? data.books : [];
    return data;
  }

  /** Толгой, хөл хэсэгт сургуулийн нэрийг бичнэ. */
  function applySchoolName(name) {
    const schoolName = name || CONFIG.schoolName;
    document.querySelectorAll('[data-school-name]').forEach((el) => {
      el.textContent = schoolName;
    });
    document.querySelectorAll('[data-year]').forEach((el) => {
      el.textContent = new Date().getFullYear();
    });
    return schoolName;
  }

  function setTitle(title, schoolName) {
    document.title = `${title ? `${title} · ` : ''}Цахим номын сан · ${schoolName}`;
  }

  return {
    CONFIG,
    GRADES,
    LANGUAGES,
    SUGGESTED_CATEGORIES,
    SORT_LABELS,
    esc,
    gradeLabel,
    formatSize,
    localPath,
    httpUrl,
    mnKey,
    mnCompare,
    coverHtml,
    bookCardHtml,
    matchesQuery,
    categoriesOf,
    loadLibrary,
    applySchoolName,
    setTitle,
  };
})();
