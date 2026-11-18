'use strict';

// Нүүр хуудас: ном хайх, шүүх, жагсаах.
document.addEventListener('DOMContentLoaded', async () => {
  const { esc, gradeLabel, GRADES, SORT_LABELS } = Lib;
  const PAGE_SIZE = 24;

  const els = {
    form: document.getElementById('search-form'),
    q: document.getElementById('q'),
    grade: document.getElementById('grade'),
    sort: document.getElementById('sort'),
    chips: document.getElementById('chips'),
    count: document.getElementById('result-count'),
    grid: document.getElementById('grid'),
    pagination: document.getElementById('pagination'),
    empty: document.getElementById('empty'),
    emptyTitle: document.getElementById('empty-title'),
    emptyText: document.getElementById('empty-text'),
  };

  els.grade.insertAdjacentHTML('beforeend',
    GRADES.map((g) => `<option value="${g}">${esc(gradeLabel(g))}</option>`).join(''));
  els.sort.innerHTML = Object.entries(SORT_LABELS)
    .map(([value, label]) => `<option value="${value}">${esc(label)}</option>`).join('');

  // Хайлт, шүүлтүүрийн төлөвийг URL-д хадгална (холбоосоор хуваалцаж болно)
  const params = new URLSearchParams(location.search);
  const state = {
    q: params.get('q') || '',
    category: params.get('category') || '',
    grade: parseInt(params.get('grade'), 10) || null,
    sort: SORT_LABELS[params.get('sort')] ? params.get('sort') : 'new',
    page: Math.max(1, parseInt(params.get('page'), 10) || 1),
  };
  els.q.value = state.q;
  els.grade.value = state.grade || '';
  els.sort.value = state.sort;

  let library;
  try {
    library = await Lib.loadLibrary();
  } catch (err) {
    Lib.applySchoolName();
    els.count.textContent = err.message;
    return;
  }
  const schoolName = Lib.applySchoolName(library.schoolName);
  Lib.setTitle('', schoolName);
  const books = library.books;
  const categories = Lib.categoriesOf(books);

  function updateUrl() {
    const p = new URLSearchParams();
    if (state.q) p.set('q', state.q);
    if (state.category) p.set('category', state.category);
    if (state.grade) p.set('grade', state.grade);
    if (state.sort !== 'new') p.set('sort', state.sort);
    if (state.page > 1) p.set('page', state.page);
    const qs = p.toString();
    history.replaceState(null, '', qs ? `?${qs}` : location.pathname);
  }

  function render() {
    let list = books.filter((b) => Lib.matchesQuery(b, state.q)
      && (!state.category || b.category === state.category)
      && (!state.grade || Number(b.grade) === state.grade));

    if (state.sort === 'title') {
      list = list.slice().sort((a, b) => Lib.mnCompare(a.title, b.title));
    } else {
      list = list.slice().sort((a, b) => String(b.addedAt || '').localeCompare(String(a.addedAt || '')));
    }

    const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
    state.page = Math.min(state.page, totalPages);
    const pageItems = list.slice((state.page - 1) * PAGE_SIZE, state.page * PAGE_SIZE);
    const filtered = Boolean(state.q || state.category || state.grade);

    // Ангиллын чипүүд
    els.chips.innerHTML = categories.length
      ? [`<button type="button" class="chip${state.category ? '' : ' active'}" data-category="">Бүгд</button>`]
        .concat(categories.map((c) => `<button type="button" class="chip${state.category === c.name ? ' active' : ''}" data-category="${esc(c.name)}">${esc(c.name)} <span class="chip-count">${c.count}</span></button>`))
        .join('')
      : '';

    els.count.innerHTML = filtered
      ? `<strong>${list.length}</strong> ном олдлоо${state.q ? ` · “${esc(state.q)}”` : ''} <button type="button" class="clear-link link-button" data-clear>Шүүлтүүр арилгах</button>`
      : `Нийт <strong>${books.length}</strong> ном`;

    els.grid.innerHTML = pageItems.map(Lib.bookCardHtml).join('');
    els.empty.hidden = list.length > 0;
    if (!list.length) {
      els.emptyTitle.textContent = filtered ? 'Тохирох ном олдсонгүй' : 'Одоогоор ном нэмэгдээгүй байна';
      els.emptyText.innerHTML = filtered
        ? 'Өөр үгээр хайж үзнэ үү, эсвэл <button type="button" class="link-button clear-link" data-clear>бүх номыг харах</button>.'
        : 'Удахгүй номууд нэмэгдэнэ.';
    }

    // Хуудаслалт
    if (totalPages > 1) {
      const pages = [];
      for (let p = 1; p <= totalPages; p += 1) {
        if (p === 1 || p === totalPages || Math.abs(p - state.page) <= 1) pages.push(p);
        else if (pages[pages.length - 1] !== null) pages.push(null);
      }
      els.pagination.innerHTML = [
        state.page > 1 ? `<button type="button" class="page-link" data-page="${state.page - 1}">‹ Өмнөх</button>` : '',
        ...pages.map((p) => (p === null
          ? '<span class="page-gap">…</span>'
          : `<button type="button" class="page-link${p === state.page ? ' current' : ''}" data-page="${p}"${p === state.page ? ' aria-current="page"' : ''}>${p}</button>`)),
        state.page < totalPages ? `<button type="button" class="page-link" data-page="${state.page + 1}">Дараах ›</button>` : '',
      ].join('');
    } else {
      els.pagination.innerHTML = '';
    }

    updateUrl();
  }

  // Үйлдлүүд
  let typingTimer;
  els.q.addEventListener('input', () => {
    clearTimeout(typingTimer);
    typingTimer = setTimeout(() => {
      state.q = els.q.value.trim();
      state.page = 1;
      render();
    }, 200);
  });
  els.form.addEventListener('submit', (event) => {
    event.preventDefault();
    state.q = els.q.value.trim();
    state.page = 1;
    render();
  });
  els.grade.addEventListener('change', () => {
    state.grade = parseInt(els.grade.value, 10) || null;
    state.page = 1;
    render();
  });
  els.sort.addEventListener('change', () => {
    state.sort = els.sort.value;
    state.page = 1;
    render();
  });
  document.addEventListener('click', (event) => {
    const chip = event.target.closest('[data-category]');
    if (chip) {
      state.category = chip.dataset.category;
      state.page = 1;
      render();
      return;
    }
    const pageBtn = event.target.closest('[data-page]');
    if (pageBtn) {
      state.page = parseInt(pageBtn.dataset.page, 10);
      render();
      window.scrollTo({ top: els.chips.offsetTop - 80, behavior: 'smooth' });
      return;
    }
    if (event.target.closest('[data-clear]')) {
      Object.assign(state, { q: '', category: '', grade: null, page: 1 });
      els.q.value = '';
      els.grade.value = '';
      render();
    }
  });

  render();
});
