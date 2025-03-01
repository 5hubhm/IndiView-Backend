import multer from "multer";

const storage = multer.memoryStorage(); // Store file in memory (buffer)

export const upload = multer({
    storage,
    limits: { fileSize: 200 * 1024 * 1024 }, // 200MB limit
});
