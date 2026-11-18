'use strict';

document.addEventListener('DOMContentLoaded', () => {
  // Шүүлтүүр сонгоход хайлтыг автоматаар илгээх
  document.querySelectorAll('[data-autosubmit]').forEach((select) => {
    select.addEventListener('change', () => {
      const form = select.form;
      if (form) form.requestSubmit ? form.requestSubmit() : form.submit();
    });
  });

  // Устгахын өмнө баталгаажуулах
  document.querySelectorAll('form[data-confirm]').forEach((form) => {
    form.addEventListener('submit', (event) => {
      if (!window.confirm(form.dataset.confirm)) event.preventDefault();
    });
  });

  // Онлайн уншигч: компьютер дээр хуудсан дотор нээнэ, гар утсанд шинэ цонхонд
  const reader = document.getElementById('reader');
  const openButton = document.querySelector('[data-reader-open]');
  const isTouchDevice = window.matchMedia('(pointer: coarse)').matches;
  if (reader && openButton && !isTouchDevice) {
    const frame = reader.querySelector('iframe');
    openButton.addEventListener('click', (event) => {
      event.preventDefault();
      if (!frame.src) frame.src = frame.dataset.src;
      reader.hidden = false;
      reader.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    reader.querySelector('[data-reader-close]').addEventListener('click', () => {
      reader.hidden = true;
      openButton.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }

  // Нүүр зураг сонгоход урьдчилан харуулах
  const coverInput = document.querySelector('[data-cover-input]');
  const coverPreview = document.querySelector('[data-cover-preview]');
  if (coverInput && coverPreview) {
    coverInput.addEventListener('change', () => {
      const file = coverInput.files && coverInput.files[0];
      if (!file) return;
      const img = document.createElement('img');
      img.className = 'cover-img';
      img.alt = 'Нүүр зургийн урьдчилсан харагдац';
      img.src = URL.createObjectURL(file);
      coverPreview.replaceChildren(img);
    });
  }
});
