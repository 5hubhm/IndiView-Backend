import multer from "multer";

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

const storage = multer.diskStorage({
    destination: function(req, file, cb) {
        cb(null, "/tmp"); // ✅ Use /tmp for temporary storage on Vercel
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + "-" + file.originalname); // Unique filenames
    }
});

export const upload = multer({ storage });
