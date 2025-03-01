import mongoose, { isValidObjectId } from "mongoose";
import { Video } from "../models/video.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { getVideoDuration } from "../utils/ffmpeg.js";

const getAllVideos = asyncHandler(async (req, res) => {
  // Extracting query parameters from the request
  const {
    page = 1,
    limit = 10,
    query = "",
    sortBy = "createdAt",
    sortType = "desc",
    userId, // User ID (optional, to filter videos by a specific user)
  } = req.query;

  if (!req.user) {
    throw new ApiError(401, "User needs to be logged in");
  }

  // Constructing the match object to filter videos
  const match = {
    ...(query ? { title: { $regex: query, $options: "i" } } : {}), // If query exists, match titles that contain the search term (case-insensitive)
    ...(userId ? { owner: mongoose.Types.ObjectId(userId) } : {}), // If userId exists, filter videos by that owner
  };

  const videos = await Video.aggregate([
    {
      $match: match, // Filtering videos based on the match criteria
    },

    {
      $lookup: {
        from: "users", // Collection to join with
        localField: "owner", // Matching "owner" field in the videos collection
        foreignField: "_id", // Matching "_id" field in the users collection
        as: "videosByOwner", // The resulting user data will be stored under "videosByOwner"
      },
    },

    {
      /*
        $project: Selecting only the necessary fields to return in the response

      */
      $project: {
        videoFile: 1, // Video file link
        thumbnail: 1, // Thumbnail image link
        title: 1, // Video title
        description: 1, // Video description
        duration: 1, // Video duration
        views: 1, // Number of views
        isPublished: 1, // Whether the video is published or not
        owner: {
          $arrayElemAt: ["$videosByOwner", 0], // Extracts the first user object from the array
        },
      },
    },

    {
      $sort: {
        [sortBy]: sortType === "desc" ? -1 : 1,
      },
    },

    {
      $skip: (page - 1) * parseInt(limit),
    },

    {
      $limit: parseInt(limit),
    },
  ]);

  // If no videos are found, throw an error
  if (!videos?.length) {
    throw new ApiError(404, "Videos are not found");
  }

  // Sending the response with a success message
  return res
    .status(200)
    .json(new ApiResponse(200, videos, "Videos fetched successfully"));

});

const publishAVideo = asyncHandler(async (req, res) => {
  const { title, description } = req.body;

  if (!title) throw new ApiError(400, "Title should not be empty");
  if (!description) throw new ApiError(400, "Description should not be empty");

  // Get files from Multer
  const videoFile = req.files?.videoFile?.[0];
  const thumbnailFile = req.files?.thumbnail?.[0];

  console.log("Request Files:", req.files);
  console.log("Request Body:", req.body);

  if (!videoFile) throw new ApiError(400, "Video file is required");
  if (!thumbnailFile) throw new ApiError(400, "Thumbnail is required");

  try {
    // Upload video
    const uploadedVideo = await uploadOnCloudinary(videoFile, "video");
    if (!uploadedVideo) throw new ApiError(400, "Cloudinary Error: Video upload failed");

    // Upload thumbnail
    const uploadedThumbnail = await uploadOnCloudinary(thumbnailFile, "image");
    if (!uploadedThumbnail) throw new ApiError(400, "Cloudinary Error: Thumbnail upload failed");

    // Save video details in the database
    const videoDoc = await Video.create({
      videoFile: uploadedVideo.url,
      thumbnail: uploadedThumbnail.url,
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
  // Extract videoId from request parameters
  const { videoId } = req.params;

  // Extract title and description from request body
  const { title, description } = req.body;

  // Validate if the provided videoId is a valid MongoDB ObjectId
  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "Invalid video ID");
  }

  // Create an object to hold updateData for updating title, description and thumbnail(thumbnail will be appended later)
  let updateData = { title, description };

  if (req.file) {
    const thumbnailLocalPath = req.file.path;

    if (!thumbnailLocalPath) {
      throw new ApiError(400, "Thumbnail file is missing");
    }

    // Upload the thumbnail to Cloudinary
    const thumbnail = await uploadOnCloudinary(thumbnailLocalPath);

    if (!thumbnail.url) {
      throw new ApiError(400, "Error while uploading thumbnail");
    }

    // Add the new thumbnail URL to the updateData
    updateData.thumbnail = thumbnail.url;
  }

  const updatedVideo = await Video.findByIdAndUpdate(
    videoId,
    { $set: updateData },
    { new: true, runValidators: true }
  );

  // If the video is not found, return error.
  if (!updatedVideo) {
    throw new ApiError(404, "Video not found");
  }

  // Send a success response with the updated video details.
  return res
    .status(200)
    .json(new ApiResponse(200, updatedVideo, "Video updated successfully"));


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

const togglePublishStatus = asyncHandler(async (req, res) => {
  /*
    Extract the videoId from the request parameters.
    - This is the ID of the video whose publish status we want to toggle.
  */
  const { videoId } = req.params;

  // Validate if the provided videoId is a valid MongoDB ObjectId.
  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "Invalid video ID");
  }

  /*
    Find the video by its ID.
    - `findById(videoId)`: Fetches the video document if it exists.
    - If the video is not found, we throw a 404 error.
  */
  const video = await Video.findById(videoId);

  if (!video) {
    throw new ApiError(404, "Video not found");
  }

  /*
    Toggle the `isPublished` status of the video.
    - If it's `true`, set it to `false`.
    - If it's `false`, set it to `true`.
  */
  video.isPublished = !video.isPublished;

  // Save the updated video status in the database.
  await video.save();

  /*
    Send a success response with the updated video details.
    - `video` contains the updated publish status.
  */
  return res
    .status(200)
    .json(
      new ApiResponse(200, video, "Video publish status toggled successfully")
    );


});

export {
  getAllVideos,
  publishAVideo,
  getVideoById,
  updateVideo,
  deleteVideo,
  togglePublishStatus,
};