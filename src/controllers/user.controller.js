import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { v2 as cloudinary } from "cloudinary";

const generateAccessAndRefereshTokens = async (userId) => {
  // Function to generate new access & refresh tokens for a user
  try {
    const user = await User.findById(userId);
    // Find the user in the database using their ID

    const accessToken = user.generateAccessToken();
    // Generate a new access token

    const refreshToken = user.generateRefreshToken();
    // Generate a new refresh token

    user.refreshToken = refreshToken; // Store the refresh token in the database
    await user.save({ validateBeforeSave: false });
    // Save the user without triggering other validation rules

    return { accessToken, refreshToken }; // Return the tokens
  } catch (error) {
    throw new ApiError(
      500,
      "Something went wrong while generating refresh and access token"
    );
  }
};

const registerUser = asyncHandler(async (req, res) => {
  const { fullName, email, username, password } = req.body;

  if ([fullName, email, username, password].some((field) => field?.trim() === "")) {
    throw new ApiError(400, "All fields are required");
  }

  const existedUser = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (existedUser) {
    throw new ApiError(409, "User with email or username already exists");
  }

  const avatarLocalPath = req.files?.avatar?.[0]?.path;
  const coverImageLocalPath = req.files?.coverImage?.[0]?.path || null;

  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar file is required");
  }

  const avatar = await uploadOnCloudinary(avatarLocalPath);
  const coverImage = coverImageLocalPath ? await uploadOnCloudinary(coverImageLocalPath) : null;

  if (!avatar) {
    throw new ApiError(400, "Avatar upload failed");
  }

  const user = await User.create({
    fullName,
    avatar: avatar.url,
    coverImage: coverImage?.url || "",
    email,
    password,
    username: username.toLowerCase(),
  });

  const createdUser = await User.findById(user._id).select("-password -refreshToken");

  if (!createdUser) {
    throw new ApiError(500, "Something went wrong while registering the user");
  }

  return res.status(201).json(new ApiResponse(200, createdUser, "User registered successfully"));
});


const loginUser = asyncHandler(async (req, res) => {
  // This function handles user login requests
  // It checks user credentials and returns access & refresh tokens

  const { email, username, password } = req.body; // Extract email, username & password from request
  console.log(email); // Debugging: logs email to see if it was received

  if (!username && !email) {
    // If neither username nor email is provided, throw an error
    throw new ApiError(400, "username or email is required");
  }

  const user = await User.findOne({
    $or: [{ username }, { email }], // Search for user by either email or username
  });


  if (!user) {
    // If user isn't found, send a 404 error
    throw new ApiError(404, "User does not exist");
  }

  const isPasswordValid = await user.isPasswordCorrect(password);
  // Check if provided password matches the stored hashed password

  if (!isPasswordValid) {
    // If password is wrong, send a 401 error (Unauthorized)
    throw new ApiError(401, "Invalid user credentials");
  }

  // Generate new access & refresh tokens for the user
  const { accessToken, refreshToken } = await generateAccessAndRefereshTokens(
    user._id
  );

  const loggedInUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );
  // Fetch user details but exclude sensitive fields (password, refresh token)

  const options = {
    httpOnly: true, // Prevents JavaScript access to cookies for security or simply users cannot modify the cookies when we set this flag
    secure: true, // Ensures cookies are sent only over HTTPS
  };

  return res
    .status(200)
    .cookie("accessToken", accessToken, options) // Store access token in HTTP-only cookie
    .cookie("refreshToken", refreshToken, options) // Store refresh token in HTTP-only cookie
    .json(
      new ApiResponse(
        200,
        {
          user: loggedInUser,
          accessToken,
          refreshToken,
        },
        "User logged In Successfully"
      )
    );

  });

const logoutUser = asyncHandler(async (req, res) => {
  // This function logs out the user by removing their refresh token from the database

  await User.findByIdAndUpdate(
    req.user._id, // Find the user by their ID in MongoDB
    {
      $unset: {
        refreshToken: 1, // Removes the refreshToken field from the user document
      },
    },
    {
      new: true, // Ensures the updated document is returned
    }
  );

 
  const options = {
    httpOnly: true, // Ensures cookies can't be accessed via JavaScript (security measure)
    secure: true, 
    sameSite: "None",// Ensures cookies are only sent over HTTPS
  };

  return res
    .status(200)
    .clearCookie("accessToken", options) // Remove accessToken cookie
    .clearCookie("refreshToken", options) // Remove refreshToken cookie
    .json(new ApiResponse(200, {}, "User logged Out"));

});

const refreshAccessToken = asyncHandler(async (req, res) => {
  // This function helps users stay logged in by refreshing their access token.
  // It checks if the refresh token is valid, then issues a new access token.

  const incomingRefreshToken =
    req.cookies.refreshToken || req.body.refreshToken; // Tries to get refresh token from cookies first, then from request body

  if (!incomingRefreshToken) {
    // If there's no refresh token, the request is not allowed
    throw new ApiError(401, "Unauthorized request");
  }

  try {
    // Step 1: Verify the refresh token using JWT (JSON Web Token)
    const decodedToken = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET // Uses a secret key to check if the token is valid
    );

    // Step 2: Find the user in the database using the user ID from the token
    const user = await User.findById(decodedToken?._id); // Finds user based on ID stored in the refresh token

    if (!user) {
      // If no user is found, the token is invalid
      throw new ApiError(401, "Invalid refresh token");
    }

    // Step 3: Check if the refresh token provided matches the one stored in the database
    if (incomingRefreshToken !== user?.refreshToken) {
      throw new ApiError(401, "Refresh token is expired or used");
    }

    // Step 4: Set options for cookies (security settings)
    const options = {
      httpOnly: true,
      secure: true,
    };

    // Step 5: Generate new access & refresh tokens for the user
    const { accessToken, newRefreshToken } =
      await generateAccessAndRefereshTokens(user._id);

    // Step 6: Send the new tokens back to the client
    return res
      .status(200)
      .cookie("accessToken", accessToken, options) // Stores new access token in secure cookie
      .cookie("refreshToken", newRefreshToken, options) // Stores new refresh token in secure cookie
      .json(
        new ApiResponse(
          200,
          { accessToken, refreshToken: newRefreshToken },
          "Access token refreshed"
        )
      );
  } catch (error) {
    throw new ApiError(401, error?.message || "Invalid refresh token"); // Handles token verification errors
  }

});

const changeCurrentPassword = asyncHandler(async (req, res) => {
  // Extract oldPassword and newPassword from the request body
  const { oldPassword, newPassword } = req.body;

  // Find the user in the database using their ID from the authenticated request
  const user = await User.findById(req.user?._id);

  // Check if the provided old password matches the stored hashed password
  const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);

  if (!isPasswordCorrect) {
    // If old password is incorrect, throw an error and prevent update
    throw new ApiError(400, "Invalid old password");
  }

  // If old password is correct, update the user's password with the new one
  user.password = newPassword;

  // Save the updated user object in the database without running validations
  await user.save({ validateBeforeSave: false });

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Password changed successfully"));

});

const getCurrentUser = asyncHandler(async (req, res) => {
  // This function gets the current logged-in user's details and sends them in response
  return res
    .status(200)
    .json(new ApiResponse(200, req.user, "User fetched successfully"));
});

const updateAccountDetails = asyncHandler(async (req, res) => {
  /*
  Function to update user's account details (like full name and email)
  It takes data from the request body, updates it in the database, and returns the updated user details
*/

  const { fullName, email } = req.body; // Extracting fullName and email from request body

  // If fullName or email is missing, throw an error
  if (!fullName || !email) {
    throw new ApiError(400, "All fields are required"); // 400 means "Bad Request" (user did something wrong)
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id, // Find user by ID
    {
      $set: {
        // Update only the fullName and email fields
        fullName,
        email: email, // Can just be "email" instead of "email: email", but writing it explicitly for clarity
      },
    },
    { new: true } // Ensures we get the updated user details
  ).select("-password"); // Do NOT send the password back in response (security matters!)



  // Send back the updated user data with a success message
  return res
    .status(200)
    .json(new ApiResponse(200, user, "Account details updated successfully"));


});

const updateUserAvatar = asyncHandler(async (req, res) => {
  // Function to update the user's avatar (profile picture)

  const avatarLocalPath = req.file?.path; // Getting the local path of the uploaded file

  // If no file is uploaded, throw an error (we need an image to update the avatar!)
  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar file is missing"); // 400 means "Bad Request"
  }

  // Find the user in the database using their ID
  const user = await User.findById(req.user?._id);
  if (!user) {
    throw new ApiError(404, "User not found"); // 404 means "User does not exist"
  }

  if (user.avatar) {
    const publicId = user.avatar.split("/").pop().split(".")[0]; // Extract Cloudinary public_id
    await cloudinary.uploader.destroy(publicId); // Delete old avatar from Cloudinary
  }

  // Upload the new avatar to Cloudinary
  const avatar = await uploadOnCloudinary(avatarLocalPath);

  // If the upload fails for some reason, throw an error
  if (!avatar.url) {
    throw new ApiError(400, "Error while uploading on avatar");
  }

  const userDoc = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        avatar: avatar.url,
      },
    },
    { new: true }
  ).select("-password");



  // Sending a success response with the updated user details
  return res
    .status(200)
    .json(new ApiResponse(200, userDoc, "Avatar image updated successfully"));

});

const updateUserCoverImage = asyncHandler(async (req, res) => {
  //This has same explanation as above controller, you can refer 'updateUserAvatar' notes from above.

  const coverImageLocalPath = req.file?.path;

  if (!coverImageLocalPath) {
    throw new ApiError(400, "Cover image file is missing");
  }

  const user = await User.findById(req.user?._id);
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  // Delete old cover image if exists
  if (user.coverImage) {
    const publicId = user.coverImage.split("/").pop().split(".")[0]; // Extract Cloudinary public_id
    await cloudinary.uploader.destroy(publicId);
  }

  const coverImage = await uploadOnCloudinary(coverImageLocalPath);

  if (!coverImage.url) {
    throw new ApiError(400, "Error while uploading on avatar");
  }

  const userDoc = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        coverImage: coverImage.url,
      },
    },
    { new: true }
  ).select("-password");

  return res
    .status(200)
    .json(new ApiResponse(200, userDoc, "Cover image updated successfully"));
});


const getUserChannelProfile = asyncHandler(async (req, res) => {
  // Function to get the profile details of a user's channel
  // This function retrieves user info, subscriber count, subscription count and checks if the logged-in user is subscribed

  const { username } = req.params; // Extracting the username from request parameters

  // If username is missing or just empty spaces, throw an error
  if (!username?.trim()) {
    throw new ApiError(400, "username is missing");
  }

  /*
    Aggregation Pipeline: A powerful way to process data in MongoDB
    - Here, we're fetching user details along with subscriber and subscription information
  */
  const channel = await User.aggregate([
    {
      /*
        Step 1: Find the user by username
        - 'match' operator filters the documents to only include users with the given username.
      */
      $match: {
        username: username?.toLowerCase(),
      },
    },
    {
      /*
        Step 2: Fetch all people who have subscribed to this user's channel
        - Think of it like checking who follows you on a social media platform.

        'lookup' operator: Joins data from another collection (like SQL JOIN)
        - Fetching all subscriptions where this user is the "channel"
        - This gives us all the people who have subscribed to this user's channel
      */
      $lookup: {
        from: "subscriptions", // Collection name to join with
        localField: "_id", // Matching user ID in User collection
        foreignField: "channel", // Matching with "channel" field in Subscriptions collection

        as: "subscribers", // The result is stored in "subscribers"
      },
    },
    {
      /*
        Step 3: Fetch all the channels this user has subscribed to
        - This is like checking which YouTube channels you are following.
      */
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "subscriber", // Match where this user appears as a "subscriber"
        as: "subscribedTo", // Store the result in a field called "subscribedTo"
      },
    },
    {
      /*
        Step 4: Calculate extra details using 'addFields' operator
        - Count total subscribers
        - Count total channels the user has subscribed to
        - Check if the logged-in user is already subscribed to this channel
      */
      $addFields: {
        subscribersCount: {
          $size: "$subscribers", // Count how many documents (subscribers) are in the "subscribers" array
        },
        channelsSubscribedToCount: {
          $size: "$subscribedTo", // Count how many channels this user is following
        },
        isSubscribed: {
          $cond: {
            if: { $in: [req.user?._id, "$subscribers.subscriber"] }, // Check if logged-in user's ID exists in the subscriber list
            then: true, // If found, return true (user is subscribed)
            else: false, // Otherwise, return false (user is NOT subscribed)
          },
        },
      },
    },
    {
      /*
        Step 5: Project (select) only the necessary fields to return
        - This reduces data load and keeps responses efficient.
      */
      $project: {
        fullName: 1, // Include full name of the user
        username: 1, // Include username
        subscribersCount: 1, // Include total subscriber count
        channelsSubscribedToCount: 1, // Include total subscribed-to count
        isSubscribed: 1, // Include whether logged-in user is subscribed
        avatar: 1, // Include avatar image
        coverImage: 1, // Include cover image
        email: 1, // Include email
      },
    },
  ]);

  // If no channel is found, return an error
  if (!channel?.length) {
    throw new ApiError(404, "channel does not exist");
  }

  // Sending a success response with the channel data
  return res
    .status(200)
    .json(
      new ApiResponse(200, channel[0], "User channel fetched successfully")
    );

});

const getWatchHistory = asyncHandler(async (req, res) => {
  // Function to get the watch history of a user
  // This function retrieves the videos a user has watched along with the details of the video owner

  /*
    Step 1: Find the user in the database using aggregation
  */
  const user = await User.aggregate([
    {
      $match: {
        _id: new mongoose.Types.ObjectId(req.user._id), // Convert user ID to ObjectId and match it in the database
      },
    },

    /*
        Step 1.1: Convert user ID to ObjectId and match it in the database
        - req.user._id is a string representation of the user's ID.
        - MongoDB stores IDs as ObjectId (a special type of ID used for indexing and efficiency).
        - We use 'new mongoose.Types.ObjectId()' to convert the string into an ObjectId.
        - This ensures we can correctly match the user in the database.
        - If we don't do this conversion, MongoDB might not find the user because it's expecting an ObjectId.
      */

    {
      /*
        Step 2: Fetch user's watch history using $lookup
        - The 'watchHistory' field in User contains an array of video IDs the user has watched
        - We use $lookup to match these IDs with actual videos in the 'videos' collection
      */
      $lookup: {
        from: "videos", // Collection where videos are stored
        localField: "watchHistory", // Field in 'User collection' that stores watched video IDs

        foreignField: "_id", // Field in 'Videos collection' that matches the video IDs
        as: "watchHistory", // Store the result in 'watchHistory'
        pipeline: [
          // A sub-pipeline to fetch additional details
          {
            /*
              Step 3: Fetch video owner details
              - Each video has an 'owner' field that stores the ID of the uploader
              - We use $lookup again to match this ID with the 'users' collection
              - This allows us to fetch the owner's details (name, username, avatar)
            */
            $lookup: {
              from: "users", // Collection where user details are stored
              localField: "owner", // Field in 'Users collection' storing owner ID
              foreignField: "_id", // Field in 'Videos collection' to match the owner ID
              as: "owner", // Store the result in 'owner'
              pipeline: [
                // Another sub-pipeline to filter required fields
                {
                  $project: {
                    fullName: 1, // Include owner's full name
                    username: 1, // Include owner's username
                    avatar: 1, // Include owner's avatar
                  },
                },
              ],
            },
          },
          {
            /*
              Step 4: Convert 'owner' array into a single object using $addFields
              - $lookup returns an array, even if there is only one owner
              - We extract the first (and only) owner using $first
            */
            $addFields: {
              owner: {
                $first: "$owner", // Extract first element from 'owner' array
              },
            },
          },
        ],
      },
    },
  ]);

  // Step 5: Send the response with the watch history
  return res
    .status(200) 
    .json(
      new ApiResponse(
        200,
        user[0].watchHistory, // Extract watch history from the first (and only) user in the result
        "Watch history fetched successfully"
      )
    );

});

export {
  registerUser,
  loginUser,
  logoutUser,
  refreshAccessToken,
  changeCurrentPassword,
  getCurrentUser,
  updateAccountDetails,
  updateUserAvatar,
  updateUserCoverImage,
  getUserChannelProfile,
  getWatchHistory,
};