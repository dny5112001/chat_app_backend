const mongoose = require("mongoose");
const bcrypt = require("bcrypt"); // For hashing passwords

// Define User Schema
const userSchema = new mongoose.Schema({
  userId: {
    type: String,
    unique: true,
    required: true,
  },
  firstName: {
    type: String,
    required: true,
  },
  lastName: {
    type: String,
    required: true,
  },
  password: {
    type: String,
    required: true,
  },
  profileImage: {
    type: String, // Store image URL
    default: "default.png",
  },
  sentFriendRequests: [
    {
      type: String,
    },
  ],
  receivedFriendRequests: [
    {
      type: String,
    },
  ],
  friends: [
    {
      type: String,
    },
  ],
  status: {
    type: String,
    default: "offline",
  },
  lastSeen: {
    type: Date,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Export User Model
module.exports = mongoose.model("User", userSchema);
