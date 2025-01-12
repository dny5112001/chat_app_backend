const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const authRoutes = require("./Routes/Auth"); // Adjust path as needed
const chatRoutes = require("./Routes/ChatRoutes"); // Adjust path as needed
const Chat = require("./Models/ChatsModel"); // Chat model
const User = require("./Models/UserModel"); // User model

const app = express();
const server = http.createServer(app); // Create HTTP server for Express app
const io = new Server(server, { cors: { origin: "*" } }); // Set up Socket.IO server

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static("uploads"));

// Routes
app.use("/auth", authRoutes);
app.use("/chat", chatRoutes);

// Connect to MongoDB
mongoose
  .connect("mongodb://localhost:27017/Chateo")
  .then(() => {
    console.log("Connected to MongoDB");

    // Start the server
    server.listen(3000, () => {
      console.log("Server is running on port 3000");
    });
  })
  .catch((err) => {
    console.error("Failed to connect to MongoDB", err);
  });

// Middleware for authenticating Socket.IO connections
io.use((socket, next) => {
  const token = socket.handshake.auth.token; // Expecting token in `auth` property
  if (token) {
    try {
      const decoded = jwt.verify(token, "secretForChattingApplication");
      socket.user = decoded; // Attach user information to the socket
      // console.log(socket.user);
      next();
    } catch (err) {
      next(new Error("Authentication error"));
    }
  } else {
    next(new Error("Authentication error"));
  }
});

// Socket.IO connection and events
io.on("connection", (socket) => {
  const userId = socket.user.userId;
  console.log(`User connected with ID: ${userId}`);

  if (userId) {
    // Set user status to online when they connect
    User.findOneAndUpdate(
      { userId: userId },
      { status: "online", lastSeen: null },
      { new: true }
    ).then((user) => console.log(`User ${userId} is online`));

    socket.broadcast.emit("userStatusChange", {
      userId: userId,
      status: "online",
      lastSeen: null,
    });

    // Join a room based on user ID
    socket.join(userId);

    // Handle sending messages
    socket.on("message", async (data) => {
      const { receiverId, text } = data;
      const senderId = userId;

      // Save message in the database
      const newMessage = new Chat({
        senderId,
        receiverId,
        message: text,
        timestamp: new Date(),
        status: "sent",
      });

      console.log(newMessage);

      await newMessage.save();

      io.to(receiverId).emit("message", {
        senderId,
        receiverId,
        text,
        status: "sent",
      });
      io.to(senderId).emit("message", {
        senderId,
        receiverId,
        text,
        status: "sent",
      });
    });

    // Handle sending friend requests
    socket.on("sendFriendRequest", async (receiverId) => {
      const senderId = userId;

      if (senderId === receiverId) {
        return socket.emit("error", {
          message: "You cannot send a request to yourself",
        });
      }

      // Check if request already sent or users are friends
      const receiver = await User.findOne({ userId: receiverId });
      if (!receiver) {
        return socket.emit("error", { message: "User not found" });
      }

      if (
        receiver.receivedFriendRequests.includes(senderId) ||
        receiver.friends.includes(senderId)
      ) {
        return socket.emit("error", {
          message: "Friend request already sent or you are already friends.",
        });
      }

      // Update receiver's received requests and sender's sent requests in the database
      await User.findOneAndUpdate(
        { userId: receiverId },
        {
          $addToSet: { receivedFriendRequests: senderId },
        }
      );
      await User.findOneAndUpdate(
        { userId: senderId },
        {
          $addToSet: { sentFriendRequests: receiverId },
        }
      );

      // Notify the receiver in real time
      io.to(receiverId).emit("friendRequestReceived", { senderId });
      socket.emit("friendRequestSent", { receiverId });
    });

    // Handle approving friend requests
    socket.on("approveFriendRequest", async (senderId) => {
      const receiverId = userId;

      // Update receiver's receivedFriendRequests and friends list
      await User.findOneAndUpdate(
        { userId: receiverId },
        {
          $pull: { receivedFriendRequests: senderId },
          $addToSet: { friends: senderId },
        }
      );

      // Update sender's sentFriendRequests and friends list
      await User.findOneAndUpdate(
        { userId: senderId },
        {
          $addToSet: { friends: receiverId },
          $pull: { sentFriendRequests: receiverId },
        }
      );

      // Notify both users
      io.to(senderId).emit("friendRequestApproved", { receiverId });
      io.to(receiverId).emit("friendRequestApproved", { senderId }); // Notify receiver
    });

    // Handle canceling friend requests
    socket.on("cancelFriendRequest", async (receiverId) => {
      const senderId = userId;
      console.log(`Canceling friend request from ${senderId} to ${receiverId}`);

      try {
        // Get the receiver's document and modify the array manually
        const receiver = await User.findOne({ userId: receiverId });
        if (receiver && receiver.sentFriendRequests) {
          const updatedReceivedRequests = receiver.sentFriendRequests.filter(
            (userId) => userId !== senderId
          );
          await User.updateOne(
            { userId: receiverId },
            { $set: { sentFriendRequests: updatedReceivedRequests } },
            { new: true }
          );
        }

        // Get the sender's document and modify the array manually
        const sender = await User.findOne({ userId: senderId });
        if (sender && sender.receivedFriendRequests) {
          const updatedSentRequests = sender.receivedFriendRequests.filter(
            (userId) => userId !== receiverId
          );
          await User.updateOne(
            { userId: senderId },
            { $set: { receivedFriendRequests: updatedSentRequests } },
            { new: true }
          );
        }

        // Notify both users
        io.to(receiverId).emit("friendRequestCanceled", { senderId });
        socket.emit("friendRequestCanceled", { receiverId });
      } catch (error) {
        console.error("Error updating friend request:", error);
      }
    });

    // Handle disconnection
    socket.on("disconnect", async () => {
      const lastSeenTime = new Date();
      await User.findOneAndUpdate(
        { userId: userId },
        { status: "offline", lastSeen: lastSeenTime },
        { new: true }
      );
      console.log(`User ${userId} is offline, last seen at ${lastSeenTime}`);

      // Broadcast the updated status to all connected clients
      socket.broadcast.emit("userStatusChange", {
        userId: userId,
        status: "offline",
        lastSeen: lastSeenTime,
      });
    });
  }
});
