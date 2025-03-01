import { v2 as cloudinary } from "cloudinary";
import streamifier from "streamifier";

// Cloudinary Configuration
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Upload File to Cloudinary (Supports Buffers)
const uploadOnCloudinary = async (file) => {
    try {
        if (!file) return null;

        // Upload file from buffer if using memory storage
        const response = await cloudinary.uploader.upload_stream(
            { resource_type: "auto" },
            (error, result) => {
                if (error) throw new Error("Cloudinary Upload Failed");
                return result;
            }
        ).end(file.buffer); // Use buffer instead of file path

        return response;
    } catch (error) {
        console.error("Cloudinary Upload Error:", error);
        return null;
    }
};


export { uploadOnCloudinary };
