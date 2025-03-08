import mongoose, { isValidObjectId } from "mongoose";
import { Video } from "../models/video.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";

const getAllVideos = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    query = "",
    sortBy = "createdAt",
    sortType = "desc",
    userId, // optional: filter by specific user ID
  } = req.query;

  if (!req.user) {
    throw new ApiError(401, "User needs to be logged in");
  }

  // If userId is not provided, default to fetching logged-in user's videos
  const filterUserId = userId || req.user._id;

  console.log("Logged-in User ID:", req.user._id);
  console.log("Filter User ID:", filterUserId);


  // Constructing the match object
  const match = {
    ...(query ? { title: { $regex: query, $options: "i" } } : {}),
    owner: new mongoose.Types.ObjectId(filterUserId),// Only fetch logged-in user's videos
  };

  const videos = await Video.aggregate([
    { $match: match },
    {
      $lookup: {
        from: "users",
        localField: "owner",
        foreignField: "_id",
        as: "videosByOwner",
      },
    },
    {
      $project: {
        videoFile: 1,
        thumbnail: 1,
        title: 1,
        description: 1,
        duration: 1,
        views: 1,
        isPublished: 1,
        owner: { $arrayElemAt: ["$videosByOwner", 0] },
      },
    },
    { $sort: { [sortBy]: sortType === "desc" ? -1 : 1 } },
    { $skip: (page - 1) * parseInt(limit) },
    { $limit: parseInt(limit) },
  ]);

  if (!videos.length) {
    throw new ApiError(404, "Videos not found");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, videos, "Videos fetched successfully"));
});


const publishAVideo = asyncHandler(async (req, res) => {
  const { title, description, videoFile, thumbnail } = req.body; // Get URLs directly from frontend

  if (!title) throw new ApiError(400, "Title should not be empty");
  if (!description) throw new ApiError(400, "Description should not be empty");
  if (!videoFile) throw new ApiError(400, "Video URL is required");
  if (!thumbnail) throw new ApiError(400, "Thumbnail URL is required");

  try {
    // Save video details in the database
    const videoDoc = await Video.create({
      videoFile, // Already a URL
      thumbnail, // Already a URL
      title,
      description,
      owner: req.user?._id,
    });

    return res.status(201).json(new ApiResponse(201, videoDoc, "Video published successfully"));
  } catch (error) {
    throw new ApiError(500, error.message || "Server error");
  }
});


const getVideoById = asyncHandler(async (req, res) => {
  // Extract the videoId from request parameters
  const { videoId } = req.params;

  // Validate if the provided videoId is a valid MongoDB ObjectId
  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "Invalid video ID");
  }

  const video = await Video.findById(videoId).populate("owner", "name email");

  // If the video does not exist, return a 404 error.
  if (!video) {
    throw new ApiError(404, "Video not found");
  }

  // Send a success response with the video details.
  return res
    .status(200)
    .json(new ApiResponse(200, video, "Video fetched successfully"));

});

const updateVideo = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  const { title, description } = req.body;

  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "Invalid video ID");
  }

  // Fetch the existing video to ensure it exists
  const existingVideo = await Video.findById(videoId);
  if (!existingVideo) {
    throw new ApiError(404, "Video not found");
  }

  // Get files from Multer
  const thumbnailFile = req.files?.thumbnail?.[0];

  console.log("Request Files:", req.files);
  console.log("Request Body:", req.body);

  try {
    let uploadedThumbnail;

    // Upload new thumbnail if provided
    if (thumbnailFile) {
      uploadedThumbnail = await uploadOnCloudinary(thumbnailFile, "image");
      if (!uploadedThumbnail) {
        throw new ApiError(400, "Cloudinary Error: Thumbnail upload failed");
      }
    }

    // Prepare update data dynamically
    let updateData = {};
    if (title) updateData.title = title;
    if (description) updateData.description = description;
    if (uploadedThumbnail?.url) updateData.thumbnail = uploadedThumbnail.url;

    // Update video in database
    const updatedVideo = await Video.findByIdAndUpdate(
      videoId,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    return res.status(200).json(new ApiResponse(200, updatedVideo, "Video updated successfully"));
  } catch (error) {
    throw new ApiError(500, error.message || "Server error");
  }
});

const deleteVideo = asyncHandler(async (req, res) => {
  // Extract the videoId from the request parameters
  const { videoId } = req.params;

  // Validate if the provided videoId is a valid MongoDB ObjectId
  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "Invalid video ID");
  }


  const deletedVideo = await Video.findByIdAndDelete(videoId);

  // If no video was found to delete, return a 404 error.
  if (!deletedVideo) {
    throw new ApiError(404, "Video not found");
  }

  // Send a success response with the deleted video details.
  return res
    .status(200)
    .json(new ApiResponse(200, deletedVideo, "Video deleted successfully"));


});


export {
  getAllVideos,
  publishAVideo,
  getVideoById,
  updateVideo,
  deleteVideo,
};