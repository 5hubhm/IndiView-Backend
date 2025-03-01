import { v2 as cloudinary } from "cloudinary";
import streamifier from "streamifier";
import fs from "fs";

// Cloudinary Configuration
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Universal Cloudinary Upload Function (Supports Both Paths & Buffers)
const uploadOnCloudinary = async (file, resourceType = "auto") => {
    if (!file) return null;

    return new Promise((resolve, reject) => {
        const uploadCallback = (error, result) => {
            if (error) return reject(error);
            resolve(result);
        };

        // Handle Buffer Upload (For Vercel, Video, Thumbnail)
        if (Buffer.isBuffer(file)) {
            const stream = cloudinary.uploader.upload_stream({ resource_type: resourceType }, uploadCallback);
            streamifier.createReadStream(file).pipe(stream);
        } 
        // Handle File Path Upload (For Existing Avatar, Cover Image)
        else {
            cloudinary.uploader.upload(file, { resource_type: resourceType }, (error, result) => {
                if (error) return reject(error);
                resolve(result);
                fs.unlinkSync(file); // Delete file after upload
            });
        }
    });
};

export { uploadOnCloudinary };
