/**
 * L.A. STORE — Middleware de Upload de Imagens
 * Usa multer com armazenamento em memória para repassar ao Supabase Storage.
 * Validações: MIME Type real, extensão, tamanho (10 MB).
 */

const multer = require('multer');

const ALLOWED_MIME = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const ALLOWED_EXT  = ['.jpg', '.jpeg', '.png', '.webp'];
const MAX_SIZE_MB   = 10;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

// Validação de extensão via nome do arquivo
function getExtension(filename) {
  return filename.slice(filename.lastIndexOf('.')).toLowerCase();
}

// Filtro de arquivo: valida MIME e extensão
function fileFilter(req, file, cb) {
  const ext = getExtension(file.originalname);
  if (!ALLOWED_MIME.includes(file.mimetype)) {
    return cb(new Error(`Tipo de arquivo não permitido: ${file.mimetype}. Use JPG, PNG ou WEBP.`));
  }
  if (!ALLOWED_EXT.includes(ext)) {
    return cb(new Error(`Extensão não permitida: ${ext}. Use .jpg, .jpeg, .png ou .webp.`));
  }
  cb(null, true);
}

const upload = multer({
  storage: multer.memoryStorage(), // Armazena em memória para enviar ao Supabase
  limits: {
    fileSize: MAX_SIZE_BYTES,
    files: 1,
  },
  fileFilter,
});

/**
 * Middleware de tratamento de erros do multer.
 * Deve ser usado após o multer para capturar seus erros específicos.
 */
function handleUploadError(err, req, res, next) {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: `Arquivo muito grande. O limite é ${MAX_SIZE_MB} MB.` });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({ error: 'Envie apenas um arquivo por vez.' });
    }
    return res.status(400).json({ error: `Erro no upload: ${err.message}` });
  }
  if (err) {
    return res.status(400).json({ error: err.message });
  }
  next();
}

module.exports = { upload, handleUploadError, ALLOWED_MIME, ALLOWED_EXT, MAX_SIZE_BYTES };
