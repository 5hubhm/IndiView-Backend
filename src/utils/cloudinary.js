import { v2 as cloudinary } from "cloudinary";
import fs from "fs";

// Cloudinary Configuration
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const uploadOnCloudinary = async (localFilePath) => {
  try {
    if (!localFilePath) return null;

    // Upload the file to Cloudinary
    const response = await cloudinary.uploader.upload(localFilePath, {
      resource_type: "auto",  // Automatically detect the resource type (image/video/etc.)
    });

    // File uploaded successfully, now delete the local temporary file
    fs.unlinkSync(localFilePath);
    return response; // Return the response containing the URL or other data

  } catch (error) {
    // Remove the temporary file even if the upload failed
    fs.unlinkSync(localFilePath);

    // Log the error for debugging
    console.error("Cloudinary Upload Failed:", error);

    // You can optionally return a custom error message to the caller
    throw new Error("File upload to Cloudinary failed.");
  }
};

export { uploadOnCloudinary };
