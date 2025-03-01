import multer from "multer";
import path from "path";

// Detect if running on Vercel
const isVercel = Boolean(process.env.VERCEL);

let storage;

if (isVercel) {
  // Use memory storage on Vercel
  storage = multer.memoryStorage();
} else {
  // Use disk storage locally
  storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, "./public/temp"); // Local temp storage
    },
    filename: function (req, file, cb) {
      cb(null, Date.now() + path.extname(file.originalname));
    },
  });
}

export const upload = multer({ storage });
