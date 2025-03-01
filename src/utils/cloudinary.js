import { v2 as cloudinary } from "cloudinary";
import fs from "fs";

// Cloudinary Configuration
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const uploadOnCloudinary = async (file) => {
  try {
    if (!file) return null;

    let response;

    if (file.buffer) {
      // Upload buffer (Vercel)
      response = await cloudinary.uploader.upload_stream(
        { resource_type: "auto" },
        (error, result) => {
          if (error) {
            console.error("Cloudinary Upload Error:", error);
            return null;
          }
          return result;
        }
      ).end(file.buffer);
    } else {
      // Upload from local path (Local)
      response = await cloudinary.uploader.upload(file.path, {
        resource_type: "auto",
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
