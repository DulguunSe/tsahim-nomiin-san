'use strict';

// Админ хэсэг: GitHub token-оор нэвтэрч ном нэмэх, засах, устгах.
document.addEventListener('DOMContentLoaded', async () => {
  const { CONFIG, esc, gradeLabel, formatSize, coverHtml } = Lib;
  const root = document.getElementById('admin-root');
  const TOKEN_KEY = 'nomsan-github-token';
  const PAGES_URL = `https://${CONFIG.owner.toLowerCase()}.github.io/${CONFIG.repo}/`;
  const ACTIONS_URL = `https://github.com/${CONFIG.owner}/${CONFIG.repo}/actions`;

  let gh = null;
  let branch = null;
  let library = { schoolName: '', books: [] };
  let flash = null;
  let adminQuery = '';

  const repoPath = (p) => `${CONFIG.siteDir}/${p}`;
  const newId = () => Math.random().toString(36).slice(2, 10);
  const stamp = () => Date.now().toString(36);

  function getToken() {
    try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
  }
  function setToken(token) {
    try {
      if (token) localStorage.setItem(TOKEN_KEY, token);
      else localStorage.removeItem(TOKEN_KEY);
    } catch {
      // хадгалах боломжгүй хөтөч
    }
  }

  async function fetchRemoteLibrary() {
    const text = await gh.readText(repoPath('library.json'), branch);
    const data = text ? JSON.parse(text) : {};
    return { schoolName: data.schoolName || '', books: Array.isArray(data.books) ? data.books : [] };
  }

  /**
   * Өөрчлөлтийг нэг commit-оор хадгална. Өөр хүн зэрэг хадгалсан бол
   * хамгийн сүүлийн хувилбар дээр дахин хэрэгжүүлнэ.
   */
  async function commitChange(message, uploads, mutate) {
    let lastError;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const remote = await fetchRemoteLibrary();
      const deletes = (mutate(remote) || []).filter(Boolean);
      const files = [
        ...uploads,
        ...deletes.map((p) => ({ path: repoPath(p), delete: true })),
        { path: repoPath('library.json'), text: `${JSON.stringify(remote, null, 2)}\n` },
      ];
      try {
        await gh.commit({ branch, message, files });
        library = remote;
        return;
      } catch (err) {
        lastError = err;
        if (err.status !== 409 && err.status !== 422) throw err;
      }
    }
    throw lastError;
  }

  function errorMessage(err) {
    if (err.status === 401) return 'Token хүчингүй болсон байна. Дахин нэвтэрнэ үү.';
    if (err.status === 403 || err.status === 404) {
      return 'Энэ token-д репо руу бичих эрх алга. Token үүсгэхдээ "Contents: Read and write" эрх өгсөн эсэхээ шалгана уу.';
    }
    return `Алдаа гарлаа: ${err.message}`;
  }

  // ---------------- Нэвтрэх ----------------

  function renderLogin(error) {
    root.innerHTML = `
      <div class="auth">
        <form class="card auth-card" id="login-form">
          <h1>Админ нэвтрэх</h1>
          <p class="muted">Ном нэмэх, засахын тулд GitHub token хэрэгтэй. Үүнийг нэг л удаа үүсгэнэ.</p>
          ${error ? `<div class="alert alert-error" role="alert">${esc(error)}</div>` : ''}
          <details class="help-box">
            <summary>Token хэрхэн үүсгэх вэ?</summary>
            <ol>
              <li><strong>${esc(CONFIG.owner)}</strong> бүртгэлээр GitHub-д нэвтэрнэ.</li>
              <li><a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">Энэ холбоосыг</a> нээнэ.</li>
              <li><b>Token name</b>: <code>nomiin-san</code>, <b>Expiration</b>: 1 жил.</li>
              <li><b>Repository access</b> → <b>Only select repositories</b> → <code>${esc(CONFIG.repo)}</code>.</li>
              <li><b>Permissions</b> → <b>Contents</b> → <b>Read and write</b>.</li>
              <li><b>Generate token</b> дараад гарсан <code>github_pat_…</code> кодыг доор буулгана.</li>
            </ol>
          </details>
          <div class="field">
            <label for="token">GitHub token</label>
            <input type="password" id="token" required autocomplete="off" placeholder="github_pat_…">
          </div>
          <button type="submit" class="btn btn-primary btn-block">Нэвтрэх</button>
          <p class="hint">Token зөвхөн энэ хөтөч дээр хадгалагдана. Хамтын компьютер дээр ажилласны дараа заавал “Гарах” дарна уу.</p>
        </form>
      </div>`;

    root.querySelector('#login-form').addEventListener('submit', async (event) => {
      event.preventDefault();
      const button = event.target.querySelector('button');
      button.disabled = true;
      button.textContent = 'Шалгаж байна…';
      const token = root.querySelector('#token').value.trim();
      const error = await connect(token);
      if (error) {
        renderLogin(error);
      } else {
        setToken(token);
        renderDashboard();
      }
    });
  }

  /** Token-оор холбогдож, алдаа байвал мессеж буцаана. */
  async function connect(token) {
    gh = new GitHubRepo({ owner: CONFIG.owner, repo: CONFIG.repo, token });
    try {
      const info = await gh.repoInfo();
      if (info.permissions && !info.permissions.push) {
        return 'Энэ GitHub бүртгэлд репо руу бичих эрх алга.';
      }
      branch = info.default_branch;
      library = await fetchRemoteLibrary();
      Lib.applySchoolName(library.schoolName);
      return null;
    } catch (err) {
      gh = null;
      if (err.status === 401) return 'Token буруу байна. Дахин хуулж оруулна уу.';
      if (err.status === 404 || err.status === 403) return 'Энэ token-д репогийн эрх алга. Repository access хэсгээ шалгана уу.';
      return `Холбогдож чадсангүй: ${err.message}`;
    }
  }

  // ---------------- Самбар ----------------

  function renderDashboard() {
    Lib.setTitle('Админ самбар', Lib.applySchoolName(library.schoolName));
    const books = library.books
      .filter((b) => Lib.matchesQuery(b, adminQuery))
      .sort((a, b) => String(b.addedAt || '').localeCompare(String(a.addedAt || '')));
    const categories = Lib.categoriesOf(library.books).length;

    root.innerHTML = `
      ${flash ? `<div class="alert alert-${flash.type}" role="status">${flash.html}</div>` : ''}
      <div class="page-head">
        <h1>Админ самбар</h1>
        <div class="head-actions">
          <button type="button" class="btn btn-primary" data-action="new">+ Шинэ ном нэмэх</button>
          <button type="button" class="btn btn-ghost" data-action="logout">Гарах</button>
        </div>
      </div>

      <div class="stats">
        <div class="stat"><span class="stat-value">${library.books.length}</span><span class="stat-label">Нийт ном</span></div>
        <div class="stat"><span class="stat-value">${categories}</span><span class="stat-label">Ангилал</span></div>
        <div class="stat stat-wide">
          <span class="stat-label">Сайтын хаяг</span>
          <a class="stat-link" href="${esc(PAGES_URL)}" target="_blank" rel="noopener">${esc(PAGES_URL)}</a>
        </div>
      </div>

      <form class="card settings-form" id="settings-form">
        <label for="school-name">Сургуулийн нэр</label>
        <input type="text" id="school-name" maxlength="120" value="${esc(library.schoolName)}" placeholder="${esc(CONFIG.schoolName)}">
        <button type="submit" class="btn btn-outline">Хадгалах</button>
      </form>

      <form class="admin-search" id="admin-search" role="search">
        <input type="search" id="admin-q" value="${esc(adminQuery)}" placeholder="Номын нэр, зохиогчоор хайх…" aria-label="Ном хайх">
      </form>

      ${books.length ? `
        <div class="table-wrap">
          <table class="table">
            <thead><tr>
              <th>Ном</th><th>Ангилал</th><th>Анги</th><th>Төрөл</th><th>Нэмсэн</th>
              <th><span class="visually-hidden">Үйлдэл</span></th>
            </tr></thead>
            <tbody>
              ${books.map((b) => `
                <tr>
                  <td><div class="table-book">
                    <div class="table-thumb">${coverHtml(b)}</div>
                    <div>
                      <a class="table-title" href="book.html?id=${encodeURIComponent(b.id)}">${esc(b.title)}</a>
                      ${b.author ? `<div class="muted small">${esc(b.author)}</div>` : ''}
                    </div>
                  </div></td>
                  <td>${esc(b.category || '—')}</td>
                  <td class="nowrap">${b.grade ? esc(gradeLabel(b.grade)) : '—'}</td>
                  <td class="nowrap">
                    ${b.file ? `<span class="tag">PDF · ${esc(formatSize(b.fileSize))}</span>` : ''}
                    ${b.url ? '<span class="tag tag-soft">Холбоос</span>' : ''}
                  </td>
                  <td class="nowrap muted">${esc(String(b.addedAt || '').slice(0, 10))}</td>
                  <td class="nowrap actions-cell">
                    <button type="button" class="btn btn-ghost btn-sm" data-action="edit" data-id="${esc(b.id)}">Засах</button>
                    <button type="button" class="btn btn-danger-ghost btn-sm" data-action="delete" data-id="${esc(b.id)}">Устгах</button>
                  </td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>` : `
        <div class="empty">
          <h2>${adminQuery ? 'Хайлтад тохирох ном олдсонгүй' : 'Одоогоор ном алга'}</h2>
          ${adminQuery ? '' : '<p><button type="button" class="btn btn-primary" data-action="new">+ Эхний номоо нэмэх</button></p>'}
        </div>`}
    `;
    flash = null;

    root.querySelector('#admin-q').addEventListener('input', (event) => {
      adminQuery = event.target.value;
      const pos = event.target.selectionStart;
      renderDashboard();
      const input = root.querySelector('#admin-q');
      input.focus();
      input.setSelectionRange(pos, pos);
    });
    root.querySelector('#admin-search').addEventListener('submit', (e) => e.preventDefault());

    root.querySelector('#settings-form').addEventListener('submit', async (event) => {
      event.preventDefault();
      const button = event.target.querySelector('button');
      const name = root.querySelector('#school-name').value.trim();
      button.disabled = true;
      button.textContent = 'Хадгалж байна…';
      try {
        await commitChange('Сургуулийн нэрийг өөрчлөв', [], (lib) => { lib.schoolName = name; });
        showSaved('Сургуулийн нэр хадгалагдлаа.');
      } catch (err) {
        handleError(err);
      }
    });
  }

  function showSaved(text) {
    flash = {
      type: 'success',
      html: `${esc(text)} Сайтад <strong>1–2 минутын дараа</strong> харагдана.
        <a href="${esc(ACTIONS_URL)}" target="_blank" rel="noopener">Явцыг харах ↗</a>`,
    };
    renderDashboard();
    window.scrollTo({ top: 0 });
  }

  function handleError(err) {
    if (err.status === 401) {
      setToken(null);
      renderLogin(errorMessage(err));
      return;
    }
    flash = { type: 'error', html: esc(errorMessage(err)) };
    renderDashboard();
    window.scrollTo({ top: 0 });
  }

  // ---------------- Ном нэмэх / засах ----------------

  function renderForm(book, errors = []) {
    const isEdit = Boolean(book.id);
    const categoryOptions = [...new Set([
      ...Lib.categoriesOf(library.books).map((c) => c.name),
      ...Lib.SUGGESTED_CATEGORIES,
    ])];
    const maxYear = new Date().getFullYear() + 1;
    Lib.setTitle(isEdit ? 'Ном засах' : 'Шинэ ном нэмэх', Lib.applySchoolName(library.schoolName));

    root.innerHTML = `
      <div class="narrow-wrap">
        <div class="page-head"><h1>${isEdit ? 'Ном засах' : 'Шинэ ном нэмэх'}</h1></div>
        ${errors.length ? `<div class="alert alert-error" role="alert"><ul class="error-list">${errors.map((e) => `<li>${esc(e)}</li>`).join('')}</ul></div>` : ''}

        <form class="card form" id="book-form" novalidate>
          <div class="field">
            <label for="f-title">Номын нэр <span class="req">*</span></label>
            <input type="text" id="f-title" maxlength="300" required value="${esc(book.title)}">
          </div>
          <div class="grid-2">
            <div class="field">
              <label for="f-author">Зохиогч</label>
              <input type="text" id="f-author" maxlength="200" value="${esc(book.author)}">
            </div>
            <div class="field">
              <label for="f-category">Ангилал</label>
              <input type="text" id="f-category" maxlength="100" list="category-list" value="${esc(book.category)}" placeholder="Жишээ нь: Уран зохиол">
              <datalist id="category-list">${categoryOptions.map((c) => `<option value="${esc(c)}"></option>`).join('')}</datalist>
            </div>
            <div class="field">
              <label for="f-grade">Анги</label>
              <select id="f-grade">
                <option value="">Бүх анги</option>
                ${Lib.GRADES.map((g) => `<option value="${g}"${Number(book.grade) === g ? ' selected' : ''}>${esc(gradeLabel(g))}</option>`).join('')}
              </select>
            </div>
            <div class="field">
              <label for="f-year">Хэвлэгдсэн он</label>
              <input type="number" id="f-year" min="1000" max="${maxYear}" value="${esc(book.year || '')}">
            </div>
            <div class="field">
              <label for="f-language">Хэл</label>
              <select id="f-language">
                ${Lib.LANGUAGES.map((l) => `<option${(book.language || 'Монгол') === l ? ' selected' : ''}>${esc(l)}</option>`).join('')}
              </select>
            </div>
          </div>
          <div class="field">
            <label for="f-description">Товч агуулга</label>
            <textarea id="f-description" rows="5" maxlength="5000">${esc(book.description)}</textarea>
          </div>

          <fieldset class="fieldset">
            <legend>Номын файл</legend>
            ${book.file ? `
              <div class="current-file">
                Одоогийн файл: <a href="${esc(book.file)}" target="_blank" rel="noopener">PDF (${esc(formatSize(book.fileSize))})</a>
                <label class="checkbox"><input type="checkbox" id="f-remove-pdf"> Файлыг устгах</label>
              </div>` : ''}
            <div class="field">
              <label for="f-pdf">PDF файл${book.file ? ' (солих бол шинээр сонгоно уу)' : ''}</label>
              <input type="file" id="f-pdf" accept="application/pdf,.pdf">
              <small class="hint">Дээд хэмжээ: ${CONFIG.maxPdfMb} МБ. Үүнээс том бол PDF-ээ шахаж (жишээ нь ilovepdf.com) эсвэл доорх холбоосыг ашиглана уу.</small>
            </div>
            <div class="field">
              <label for="f-url">Эсвэл гадны холбоос</label>
              <input type="url" id="f-url" maxlength="1000" placeholder="https://…" value="${esc(book.url)}">
              <small class="hint">PDF оруулахгүй бол номын онлайн хаягийг (Google Drive г.м.) бичиж болно.</small>
            </div>
          </fieldset>

          <fieldset class="fieldset">
            <legend>Нүүр зураг</legend>
            <div class="cover-field">
              <div class="cover-preview" id="cover-preview">${coverHtml({ ...book, id: book.id || 'new', title: book.title || 'Номын нэр' })}</div>
              <div class="cover-inputs">
                <div class="field">
                  <label for="f-cover">Зураг сонгох (JPG, PNG, WEBP · ${CONFIG.maxCoverMb} МБ хүртэл)</label>
                  <input type="file" id="f-cover" accept="image/jpeg,image/png,image/webp">
                  <small class="hint">Зураг оруулахгүй бол номын нэрээр өнгөт нүүр автоматаар үүснэ.</small>
                </div>
                ${book.cover ? '<label class="checkbox"><input type="checkbox" id="f-remove-cover"> Нүүр зургийг устгах</label>' : ''}
              </div>
            </div>
          </fieldset>

          <div class="form-actions">
            <button type="submit" class="btn btn-primary btn-lg">Хадгалах</button>
            <button type="button" class="btn btn-ghost btn-lg" data-action="cancel">Цуцлах</button>
          </div>
          <p class="hint" id="saving-hint" hidden>Хадгалж байна… Том файл бол хэдэн минут болж магадгүй, хуудсаа хаалгүй хүлээнэ үү.</p>
        </form>
      </div>`;

    const coverInput = root.querySelector('#f-cover');
    coverInput.addEventListener('change', () => {
      const file = coverInput.files[0];
      if (!file) return;
      const img = document.createElement('img');
      img.className = 'cover-img';
      img.alt = 'Нүүр зургийн урьдчилсан харагдац';
      img.src = URL.createObjectURL(file);
      root.querySelector('#cover-preview').replaceChildren(img);
    });

    root.querySelector('#book-form').addEventListener('submit', (event) => {
      event.preventDefault();
      saveBook(book);
    });
  }

  async function saveBook(existing) {
    const $ = (id) => root.querySelector(id);
    const value = (id) => ($(id) ? $(id).value.trim() : '');
    const errors = [];
    const maxYear = new Date().getFullYear() + 1;

    const fields = {
      title: value('#f-title').slice(0, 300),
      author: value('#f-author').slice(0, 200),
      category: value('#f-category').slice(0, 100),
      grade: parseInt(value('#f-grade'), 10) || null,
      year: parseInt(value('#f-year'), 10) || null,
      language: value('#f-language') || 'Монгол',
      description: value('#f-description').slice(0, 5000),
      url: value('#f-url'),
    };
    const pdf = $('#f-pdf').files[0] || null;
    const cover = $('#f-cover').files[0] || null;
    const removePdf = Boolean($('#f-remove-pdf') && $('#f-remove-pdf').checked);
    const removeCover = Boolean($('#f-remove-cover') && $('#f-remove-cover').checked);

    if (!fields.title) errors.push('Номын нэрийг заавал бичнэ үү.');
    if (fields.year && (fields.year < 1000 || fields.year > maxYear)) {
      errors.push(`Хэвлэгдсэн он 1000-${maxYear} хооронд байх ёстой.`);
    }
    if (fields.url && !/^https?:\/\/\S+$/i.test(fields.url)) {
      errors.push('Холбоос http:// эсвэл https:// -ээр эхэлсэн зөв хаяг байх ёстой.');
    }
    if (pdf) {
      if (!/\.pdf$/i.test(pdf.name)) errors.push('Номын файл зөвхөн PDF байх ёстой.');
      else if (pdf.size > CONFIG.maxPdfMb * 1024 * 1024) errors.push(`PDF файл хэт том байна (${formatSize(pdf.size)}). Дээд хэмжээ: ${CONFIG.maxPdfMb} МБ.`);
      else if ((await pdf.slice(0, 5).text()) !== '%PDF-') errors.push('Оруулсан файл жинхэнэ PDF биш байна.');
    }
    if (cover) {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(cover.type)) errors.push('Нүүр зураг JPG, PNG эсвэл WEBP байх ёстой.');
      else if (cover.size > CONFIG.maxCoverMb * 1024 * 1024) errors.push(`Нүүр зураг ${CONFIG.maxCoverMb} МБ-аас бага байх ёстой.`);
    }
    const keepsPdf = pdf || (existing.file && !removePdf);
    if (!keepsPdf && !fields.url) errors.push('PDF файл эсвэл гадны холбоосын аль нэгийг оруулна уу.');

    if (errors.length) {
      renderForm({ ...existing, ...fields }, errors);
      window.scrollTo({ top: 0 });
      return;
    }

    const form = $('#book-form');
    form.querySelectorAll('input, select, textarea, button').forEach((el) => { el.disabled = true; });
    form.querySelector('button[type="submit"]').textContent = 'Хадгалж байна…';
    $('#saving-hint').hidden = false;

    try {
      const id = existing.id || newId();
      const uploads = [];
      let newFile = null;
      let newCover = null;
      if (pdf) {
        newFile = `books/${id}-${stamp()}.pdf`;
        uploads.push({ path: repoPath(newFile), base64: await fileToBase64(pdf) });
      }
      if (cover) {
        const ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[cover.type];
        newCover = `covers/${id}-${stamp()}.${ext}`;
        uploads.push({ path: repoPath(newCover), base64: await fileToBase64(cover) });
      }

      await commitChange(`${existing.id ? 'Ном засав' : 'Ном нэмэв'}: ${fields.title}`, uploads, (lib) => {
        const index = lib.books.findIndex((b) => b.id === id);
        const current = index >= 0 ? lib.books[index] : { id, addedAt: new Date().toISOString() };
        const deletes = [];
        const updated = { ...current, ...fields };
        if (!updated.url) delete updated.url;

        if (newFile || removePdf) {
          deletes.push(current.file);
          updated.file = newFile || undefined;
          updated.fileSize = newFile ? pdf.size : undefined;
        }
        if (newCover || removeCover) {
          deletes.push(current.cover);
          updated.cover = newCover || undefined;
        }
        for (const key of Object.keys(updated)) {
          if (updated[key] === undefined || updated[key] === null || updated[key] === '') delete updated[key];
        }

        if (index >= 0) lib.books[index] = updated;
        else lib.books.push(updated);
        return deletes;
      });

      showSaved(`“${fields.title}” хадгалагдлаа.`);
    } catch (err) {
      handleError(err);
    }
  }

  async function deleteBook(id) {
    const book = library.books.find((b) => b.id === id);
    if (!book) return;
    if (!window.confirm(`“${book.title}” номыг устгах уу? Энэ үйлдлийг буцаах боломжгүй.`)) return;
    flash = { type: 'warning', html: 'Устгаж байна…' };
    renderDashboard();
    try {
      await commitChange(`Ном устгав: ${book.title}`, [], (lib) => {
        const target = lib.books.find((b) => b.id === id);
        lib.books = lib.books.filter((b) => b.id !== id);
        return target ? [target.file, target.cover] : [];
      });
      showSaved(`“${book.title}” устгагдлаа.`);
    } catch (err) {
      handleError(err);
    }
  }

  // ---------------- Үйлдлүүд ----------------

  root.addEventListener('click', (event) => {
    const target = event.target.closest('[data-action]');
    if (!target) return;
    const { action, id } = target.dataset;
    if (action === 'new') {
      renderForm({ language: 'Монгол' });
      window.scrollTo({ top: 0 });
    } else if (action === 'edit') {
      renderForm({ ...library.books.find((b) => b.id === id) });
      window.scrollTo({ top: 0 });
    } else if (action === 'delete') {
      deleteBook(id);
    } else if (action === 'cancel') {
      renderDashboard();
    } else if (action === 'logout') {
      setToken(null);
      gh = null;
      renderLogin();
    }
  });

  // Эхлэх: хадгалсан token байвал шууд нэвтэрнэ
  Lib.applySchoolName();
  const saved = getToken();
  if (saved) {
    const error = await connect(saved);
    if (error) {
      setToken(null);
      renderLogin(error);
    } else {
      renderDashboard();
    }
  } else {
    renderLogin();
  }
});
