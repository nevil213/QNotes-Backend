import multer from "multer";

// Use memory storage instead of disk storage for Vercel compatibility
const storage = multer.memoryStorage();

// Configure file size limits to prevent abuse
const fileFilter = (req, file, cb) => {
  // Accept audio files, images, PDFs, and text files
  if (file.mimetype.startsWith('audio/') || 
      file.mimetype.startsWith('image/') || 
      file.mimetype === 'application/pdf' ||
      file.mimetype === 'text/plain') {
    cb(null, true);
  } else {
    cb(new Error('Unsupported file format'), false);
  }
};

export const upload = multer({ 
  storage,
  fileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB max file size
  }
});