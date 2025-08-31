import multer from "multer";

// Use memory storage instead of disk storage for Vercel compatibility
const storage = multer.memoryStorage();

// Configure file size limits to prevent abuse
const fileFilter = (req, file, cb) => {
  // Accept audio files and images
  if (file.mimetype.startsWith('audio/') || 
      file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Unsupported file format'), false);
  }
};

export const upload = multer({ 
  storage,
  fileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024, // 10MB max file size
  }
});