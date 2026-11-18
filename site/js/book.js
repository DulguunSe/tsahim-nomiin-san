'use strict';

// Номын дэлгэрэнгүй хуудас: book.html?id=...
document.addEventListener('DOMContentLoaded', async () => {
  const { esc, gradeLabel, formatSize, coverHtml } = Lib;
  const root = document.getElementById('book-root');
  const id = new URLSearchParams(location.search).get('id');

  let library;
  try {
    library = await Lib.loadLibrary();
  } catch (err) {
    Lib.applySchoolName();
    root.innerHTML = `<div class="empty"><h1>Алдаа гарлаа</h1><p>${esc(err.message)}</p></div>`;
    return;
  }
  const schoolName = Lib.applySchoolName(library.schoolName);
  const book = library.books.find((b) => b.id === id);

  if (!book) {
    Lib.setTitle('Ном олдсонгүй', schoolName);
    root.innerHTML = `<div class="empty">
      <h1>Ном олдсонгүй</h1>
      <p>Холбоос буруу эсвэл ном устгагдсан байж магадгүй.</p>
      <p><a class="btn btn-primary" href="./">Бүх номыг харах</a></p>
    </div>`;
    return;
  }
  Lib.setTitle(book.title, schoolName);
  const file = Lib.localPath(book.file);
  const url = Lib.httpUrl(book.url);

  const categoryLink = (cls) => `<a class="${cls}" href="./?category=${encodeURIComponent(book.category)}">${esc(book.category)}</a>`;
  const downloadName = `${book.title.replace(/[\\/:*?"<>|]+/g, ' ').trim() || 'nom'}.pdf`;
  const related = book.category
    ? library.books.filter((b) => b.category === book.category && b.id !== book.id).slice(0, 6)
    : [];

  root.innerHTML = `
    <nav class="breadcrumb" aria-label="Байршил">
      <a href="./">Номууд</a>
      ${book.category ? `<span aria-hidden="true">/</span>${categoryLink('')}` : ''}
      <span aria-hidden="true">/</span>
      <span aria-current="page">${esc(book.title)}</span>
    </nav>

    <article class="book-detail">
      <div class="book-detail-cover">${coverHtml(book)}</div>
      <div class="book-detail-info">
        ${book.category ? categoryLink('tag tag-primary') : ''}
        <h1 class="book-detail-title">${esc(book.title)}</h1>
        ${book.author ? `<p class="book-detail-author">${esc(book.author)}</p>` : ''}

        <dl class="meta">
          <div><dt>Анги</dt><dd>${esc(gradeLabel(book.grade))}</dd></div>
          ${book.year ? `<div><dt>Хэвлэгдсэн он</dt><dd>${esc(book.year)}</dd></div>` : ''}
          <div><dt>Хэл</dt><dd>${esc(book.language || 'Монгол')}</dd></div>
          ${book.fileSize ? `<div><dt>Хэмжээ</dt><dd>${esc(formatSize(book.fileSize))}</dd></div>` : ''}
          ${book.addedAt ? `<div><dt>Нэмсэн</dt><dd>${esc(book.addedAt)}</dd></div>` : ''}
        </dl>

        <div class="actions">
          ${file ? `
            <a class="btn btn-primary btn-lg" href="${esc(file)}" target="_blank" rel="noopener" data-reader-open>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>
              Онлайн унших
            </a>
            <a class="btn btn-outline btn-lg" href="${esc(file)}" download="${esc(downloadName)}">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/></svg>
              Татаж авах
            </a>` : ''}
          ${url ? `<a class="btn ${file ? 'btn-outline' : 'btn-primary'} btn-lg" href="${esc(url)}" target="_blank" rel="noopener noreferrer">Холбоосоор нээх ↗</a>` : ''}
        </div>

        ${book.description ? `
          <section class="description">
            <h2>Товч агуулга</h2>
            <p>${esc(book.description)}</p>
          </section>` : ''}
      </div>
    </article>

    ${file ? `
      <section id="reader" class="reader" hidden>
        <div class="reader-head">
          <h2>Онлайн унших</h2>
          <div class="reader-actions">
            <a href="${esc(file)}" target="_blank" rel="noopener">Шинэ цонхонд нээх ↗</a>
            <button type="button" class="link-button" data-reader-close>Хаах ✕</button>
          </div>
        </div>
        <iframe class="reader-frame" title="${esc(book.title)}"></iframe>
        <p class="reader-note">Ном харагдахгүй байвал “Шинэ цонхонд нээх” эсвэл “Татаж авах” товчийг дарна уу.</p>
      </section>` : ''}

    ${related.length ? `
      <section class="related">
        <h2 class="section-title">Ижил ангиллын номууд</h2>
        <div class="book-grid">${related.map(Lib.bookCardHtml).join('')}</div>
      </section>` : ''}
  `;

  // Компьютер дээр хуудсан дотор нээнэ, гар утсанд шинэ цонхонд нээгдэнэ
  const reader = document.getElementById('reader');
  const openButton = root.querySelector('[data-reader-open]');
  if (reader && openButton && !window.matchMedia('(pointer: coarse)').matches) {
    const frame = reader.querySelector('iframe');
    openButton.addEventListener('click', (event) => {
      event.preventDefault();
      if (!frame.getAttribute('src')) frame.src = file;
      reader.hidden = false;
      reader.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    reader.querySelector('[data-reader-close]').addEventListener('click', () => {
      reader.hidden = true;
      openButton.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }
});
