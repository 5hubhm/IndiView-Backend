import { v2 as cloudinary } from "cloudinary";
import streamifier from "streamifier";

// Cloudinary Configuration
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Upload File to Cloudinary (Supports Buffers)
const uploadOnCloudinary = async (fileBuffer, resourceType = "auto") => {
    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            { resource_type: resourceType },
            (error, result) => {
                if (error) reject(error);
                else resolve(result);
            }
        );
        streamifier.createReadStream(fileBuffer).pipe(stream);
    });
};

export { uploadOnCloudinary };
