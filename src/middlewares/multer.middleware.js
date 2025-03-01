// import multer from "multer";

// const storage = multer.diskStorage({
//     destination: function(req, file, cb){
//         cb(null, "./public/temp")
//     },
//     filename: function (req, file, cb){
//         cb(null, file.originalname)
//     }
// })

// export const upload = multer({
//     storage,
// })

import multer from "multer";

const storage = multer.memoryStorage(); // Store files in memory

export const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } }); // Limit to 50MB

