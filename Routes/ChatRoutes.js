const router = require("express").Router();
const Chat = require("../Models/ChatsModel");
const User = require("../Models/UserModel");
const jwt = require("jsonwebtoken");
const multer = require("multer");

const isloggedIn = async (req, res, next) => {
  try {
    const token = req.headers["authorization"];
    if (!token)
      return res.status(401).json({ success: false, message: "Unauthorized" });
    const decoded = jwt.verify(token, "secretForChattingApplication");
    req.loggedUser = decoded;
    next();
  } catch (err) {
    res.status(500).send({ success: false, message: err.message });
  }
};

router.get("/getMessages/:receiverId", isloggedIn, async (req, res) => {
  try {
    const otherUserId = req.params.receiverId;
    const userId = req.loggedUser.userId;

    const messages = await Chat.find({
      $or: [
        { senderId: userId, receiverId: otherUserId },
        { senderId: otherUserId, receiverId: userId },
      ],
    }).sort({ timestamp: 1 });

    res.status(200).json({ success: true, data: messages });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get("/getAllusers", async (req, res) => {
  try {
    const users = await User.find().select("-password");
    if (!users) {
      return res
        .status(404)
        .json({ success: false, message: "No users found" });
    }
    res.status(200).json({ success: true, data: users });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

//getting a particular status data
router.get("/userStatus/:userId", async (req, res) => {
  try {
    const user = await User.findOne(
      { userId: req.params.userId },
      "status lastSeen"
    );
    if (user) {
      res.json({ success: true, status: user.status, lastSeen: user.lastSeen });
    } else {
      res.status(404).json({ success: false, message: "User not found" });
    }
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Error retrieving user status" });
  }
});

// multer

// Configure multer for file storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/"); // Specify the folder to store uploaded images
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}_${file.originalname}`); // Use a unique filename
  },
});

// Create the multer instance
const upload = multer({ storage });
router.post(
  "/updateProfile",
  isloggedIn,
  upload.single("profileImage"),
  async (req, res) => {
    try {
      const userId = req.loggedUser.userId;
      const { firstName, lastName } = req.body; // No need to destructure profileImage from req.body

      const user = await User.findOne({ userId });
      if (!user) {
        return res
          .status(404)
          .json({ success: false, message: "User not found" });
      }

      user.firstName = firstName;
      user.lastName = lastName;

      // Save the path of the uploaded image
      if (req.file) {
        user.profileImage = req.file.path; // Save the file path to the database
      }

      await user.save();
      res.status(200).json({ success: true, data: user });
    } catch (err) {
      console.error("Error updating profile:", err);
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

router.get("/getProfile", isloggedIn, async (req, res) => {
  try {
    const userId = req.loggedUser.userId;
    const user = await User.findOne({ userId });
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }
    res.status(200).send({ success: true, data: user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get("/getAllSentFriendRequests", isloggedIn, async (req, res) => {
  try {
    const userId = req.loggedUser.userId;
    const user = await User.findOne({ userId });

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    const allSentFriendRequests = user.sentFriendRequests;
    res.status(200).json({ success: true, data: allSentFriendRequests });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get("/getAllReceivedFriendRequests", isloggedIn, async (req, res) => {
  try {
    const userId = req.loggedUser.userId;
    const user = await User.findOne({ userId });
    if (!user) {
      return res
        .status(404)
        .send({ success: false, message: "User not found" });
    }

    // Assuming `user.receivedFriendRequests` is an array of user IDs
    const allReceivedFriendRequests = await User.find(
      { userId: { $in: user.receivedFriendRequests } },
      "profileImage userId firstName lastName" // Only select necessary fields
    );

    res.status(200).json({ success: true, data: allReceivedFriendRequests });
  } catch (err) {
    res.status(500).send({ success: false, message: err.message });
  }
});

router.get("/getAllFriends", isloggedIn, async (req, res) => {
  try {
    const userId = req.loggedUser.userId;
    const user = await User.findOne({ userId });
    if (!user) {
      return res
        .status(404)
        .send({ success: false, message: "User not found" });
    }
    const friends = await User.find(
      {
        userId: { $in: user.friends },
      },
      "profileImage userId firstName lastName status lastSeen"
    );
    res.status(200).json({ success: true, data: friends });
  } catch (err) {
    res.status(500).send({ success: false, message: err.message });
  }
});

module.exports = router;
