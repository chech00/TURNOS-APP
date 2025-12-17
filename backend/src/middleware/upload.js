const multer = require("multer");
const { validateFileType, ALLOWED_EXTENSIONS } = require("../utils/validators");

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

const storage = multer.memoryStorage();
const upload = multer({
    storage,
    limits: {
        fileSize: MAX_FILE_SIZE
    },
    fileFilter: (req, file, cb) => {
        if (!validateFileType(file.originalname)) {
            return cb(new Error(`Tipo de archivo no permitido. Extensiones válidas: ${ALLOWED_EXTENSIONS.join(', ')}`), false);
        }
        cb(null, true);
    }
});

module.exports = { upload, MAX_FILE_SIZE };
