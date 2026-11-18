'use strict';

/**
 * Жишээ болон тестэд зориулсан энгийн нэг хуудастай PDF үүсгэнэ.
 * (Зөвхөн латин үсэг дэмжинэ.)
 */
function makeSamplePdf(lines) {
  const escape = (s) => String(s).replace(/[\\()]/g, (c) => '\\' + c);
  let content = `BT /F1 26 Tf 72 700 Td (${escape(lines[0] || '')}) Tj ET\n`;
  lines.slice(1).forEach((line, i) => {
    content += `BT /F1 14 Tf 72 ${660 - i * 22} Td (${escape(line)}) Tj ET\n`;
  });

  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] '
      + '/Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(content, 'latin1')} >>\nstream\n${content}endstream`,
  ];

  let pdf = '%PDF-1.4\n';
  const offsets = [];
  objects.forEach((obj, i) => {
    offsets.push(Buffer.byteLength(pdf, 'latin1'));
    pdf += `${i + 1} 0 obj\n${obj}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(pdf, 'latin1');
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('');
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(pdf, 'latin1');
}

module.exports = { makeSamplePdf };
