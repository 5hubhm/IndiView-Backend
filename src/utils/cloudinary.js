import { v2 as cloudinary } from "cloudinary";
import fs from "fs";

// Cloudinary Configuration
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Helper function to upload buffers to Cloudinary
const uploadBufferToCloudinary = (buffer, resourceType) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { resource_type: resourceType },
      (error, result) => {
        if (error) {
          console.error("Cloudinary Upload Error:", error);
          reject(error);
        } else {
          resolve(result);
        }
      }
    );
    uploadStream.end(buffer);
  });
};

// Main Upload Function
const uploadOnCloudinary = async (file, resourceType = "auto") => {
  try {
    if (!file) return null;

    let response;

    if (file.buffer) {
      // Upload buffer (Vercel)
      response = await uploadBufferToCloudinary(file.buffer, resourceType);
    } else {
      // Upload from local path (Local)
      response = await cloudinary.uploader.upload(file.path, {
        resource_type: resourceType,
        chunk_size: 6000000, // 6MB chunks to allow large file uploads
      });
      fs.unlinkSync(file.path); // Remove local temp file after upload
    }

    return response;
  } catch (error) {
    console.error("Cloudinary Error:", error);
    return null;
  }
};


export { uploadOnCloudinary };
