'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const multer = require('multer');

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];

class UserError extends Error {}

/** PDF болон нүүр зураг хүлээн авах multer middleware-ийг үүсгэнэ. */
function createUploader({ paths, maxUploadMb }) {
  const upload = multer({
    storage: multer.diskStorage({
      destination(req, file, cb) {
        cb(null, file.fieldname === 'pdf' ? paths.books : paths.covers);
      },
      filename(req, file, cb) {
        const ext = path.extname(file.originalname).toLowerCase().replace('.jpeg', '.jpg');
        cb(null, crypto.randomUUID() + ext);
      },
    }),
    limits: { fileSize: maxUploadMb * 1024 * 1024, files: 2, fields: 30 },
    fileFilter(req, file, cb) {
      const ext = path.extname(file.originalname).toLowerCase();
      if (file.fieldname === 'pdf') {
        if (ext !== '.pdf') return cb(new UserError('Номын файл зөвхөн PDF байх ёстой.'));
        return cb(null, true);
      }
      if (file.fieldname === 'cover') {
        if (!IMAGE_EXTENSIONS.includes(ext)) {
          return cb(new UserError('Нүүр зураг JPG, PNG эсвэл WEBP байх ёстой.'));
        }
        return cb(null, true);
      }
      return cb(new UserError('Тодорхойгүй файл илгээгдлээ.'));
    },
  }).fields([
    { name: 'pdf', maxCount: 1 },
    { name: 'cover', maxCount: 1 },
  ]);

  // Алдааг дараагийн handler руу req.uploadError болгон дамжуулна,
  // ингэснээр маягтыг алдааны мэдэгдэлтэй дахин харуулж чадна.
  return function handleUpload(req, res, next) {
    upload(req, res, (err) => {
      if (err) {
        removeUploadedFiles(req);
        if (err instanceof UserError) {
          req.uploadError = err.message;
        } else if (err.code === 'LIMIT_FILE_SIZE') {
          req.uploadError = `Файл хэт том байна. Дээд хэмжээ: ${maxUploadMb} МБ.`;
        } else if (err instanceof multer.MulterError) {
          req.uploadError = 'Файл хуулахад алдаа гарлаа. Дахин оролдоно уу.';
        } else {
          return next(err);
        }
      }
      req.body = req.body || {};
      next();
    });
  };
}

function uploadedFile(req, field) {
  return req.files && req.files[field] ? req.files[field][0] : null;
}

function removeUploadedFiles(req) {
  if (!req.files) return;
  for (const list of Object.values(req.files)) {
    for (const file of list) removeFile(file.path);
  }
}

function removeFile(filePath) {
  if (!filePath) return;
  try {
    fs.rmSync(filePath, { force: true });
  } catch (err) {
    console.error('Файл устгаж чадсангүй:', filePath, err.message);
  }
}

function readHeader(filePath, length = 12) {
  const fd = fs.openSync(filePath, 'r');
  try {
    const buffer = Buffer.alloc(length);
    const bytesRead = fs.readSync(fd, buffer, 0, length, 0);
    return buffer.subarray(0, bytesRead);
  } finally {
    fs.closeSync(fd);
  }
}

/** Файлын эхний байтуудыг шалгаж үнэхээр PDF эсэхийг тогтооно. */
function isRealPdf(filePath) {
  return readHeader(filePath, 5).toString('latin1') === '%PDF-';
}

/** Файлын эхний байтуудыг шалгаж үнэхээр зураг эсэхийг тогтооно. */
function isRealImage(filePath) {
  const h = readHeader(filePath, 12);
  const isJpeg = h[0] === 0xff && h[1] === 0xd8 && h[2] === 0xff;
  const isPng = h.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  const isWebp = h.subarray(0, 4).toString('latin1') === 'RIFF'
    && h.subarray(8, 12).toString('latin1') === 'WEBP';
  return isJpeg || isPng || isWebp;
}

module.exports = {
  createUploader,
  uploadedFile,
  removeUploadedFiles,
  removeFile,
  isRealPdf,
  isRealImage,
  UserError,
};
