import multer from "multer";

// Check if running on Vercel
const isVercel = process.env.VERCEL === "true";

const storage = isVercel
  ? multer.memoryStorage() // Vercel uses memory storage
  : multer.diskStorage({
      destination: "uploads/",
      filename: (req, file, cb) => {
        cb(null, file.fieldname + "-" + Date.now());
      },
    });

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
});

export { upload };
