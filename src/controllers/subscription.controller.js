import { isValidObjectId } from "mongoose";
import { Subscription } from "../models/subscription.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const toggleSubscription = asyncHandler(async (req, res) => {
  // Extract channelId from request parameters
  const { channelId } = req.params;

  // Get the subscriber's ID from the authenticated user
  const subscriberId = req.user._id;

  /*
    Subscription Logic:
    - `channelId`: The ID of the channel the user wants to subscribe/unsubscribe from.
    - `subscriberId`: The ID of the currently logged-in user.
  */

  // Validate if channelId is a proper MongoDB ObjectId
  if (!isValidObjectId(channelId)) {
    throw new ApiError(400, "Invalid channel ID");
  }

  /*
    Prevent Self-Subscription:
    - A user shouldn't be able to subscribe to their own channel.
    - Convert IDs to strings before comparing (MongoDB IDs are objects).
  */
  if (subscriberId.toString() === channelId.toString()) {
    throw new ApiError(400, "You cannot subscribe to your own channel");
  }

  /*
     Check if Subscription Already Exists:
      - This looks for an existing record where the user is subscribed to the channel.
  */
  const existingSubscription = await Subscription.findOne({
    subscriber: subscriberId,
    channel: channelId,
  });

  /*
     Toggle Logic:
    - If the subscription exists, the user is already subscribed → Unsubscribe them.
    - If it doesn’t exist, subscribe them.
  */
  if (existingSubscription) {
    // Remove the existing subscription (unsubscribe)
    await Subscription.findByIdAndDelete(existingSubscription._id);
    return res
      .status(200)
      .json(new ApiResponse(200, {}, "Unsubscribed successfully"));
  }

  // If no subscription exists, create a new one (subscribe)
  await Subscription.create({ subscriber: subscriberId, channel: channelId });
  return res
    .status(201)
    .json(new ApiResponse(201, {}, "Subscribed successfully"));

});

const getUserChannelSubscribers = asyncHandler(async (req, res) => {
  // Extract the channel ID from the authenticated user (the one making the request)
  const channelId = req.user._id;

  // Validate if the channel ID is a valid MongoDB ObjectId
  if (!isValidObjectId(channelId)) {
    throw new ApiError(400, "Invalid channel ID");
  }

  /*
    Fetch all subscribers of the channel from the Subscription collection.
    - `Subscription.find({ channel: channelId })` finds all documents where the channel matches the given ID.
    - `.populate("subscriber", "_id name email")` replaces the `subscriber` field (which is just an ID) with full details (ID, name, email).
  */

  const subscribersDocs = await Subscription.find({
    channel: channelId,
  }).populate("subscriber", "_id name email");

  // If no subscribers are found, return a 404 error.
  if (!subscribersDocs) {
    throw new ApiError(404, "No subscribers found for this channel");
  }

  /*
    Send a success response with the list of subscribers.
    - `subscribersDocs` contains the list of all users subscribed to the channel.
  */
  return res
    .status(200)
    .json(
      new ApiResponse(200, subscribersDocs, "Subscribers fetched successfully")
    );

});

const getSubscribedChannels = asyncHandler(async (req, res) => {
  // Controller to get the list of channels a user has subscribed to

  // Extract the subscriber ID from the authenticated user
  const subscriberId = req.user._id;

  /* 

     - `Subscription.find({ subscriber: subscriberId })`: Finds all records where this user which is coming from "req.user._id " is the subscriber.
     - `populate("channel", "_id name email")`: Fetches the channel details (_id, name, email) for each subscription.
     - Why? Because subscriptions store only IDs. Populating converts them into actual channel objects. */

  const subscribedChannels = await Subscription.find({
    subscriber: subscriberId,
  }).populate("channel", "_id name email");

  // If no subscribed channels found, return an error
  if (!subscribedChannels || subscribedChannels.length === 0) {
    throw new ApiError(404, "No subscribed channels found");
  }

  /*  Why are we checking `subscribedChannels.length === 0`?
     - `.find()` always returns an array. If empty, that means no subscriptions exist.
     - Without this check, the user might receive an empty array instead of a proper message.
  */

  // Return a success response with the list of subscribed channels
  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        subscribedChannels,
        "Subscribed channels fetched successfully"
      )
    );

});

export { toggleSubscription, getUserChannelSubscribers, getSubscribedChannels };