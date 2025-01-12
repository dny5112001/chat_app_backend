const router = require("express").Router();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../Models/UserModel");

const multer = require("multer");
const path = require("path");

// Configure storage for profile images
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname)); // Save with unique filename
  },
});

const upload = multer({ storage: storage });

//registration of the user
router.post("/register", upload.single("profileImage"), async (req, res) => {
  try {
    const { userId, firstName, lastName, password } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ userId });
    if (existingUser) {
      return res
        .status(400)
        .json({ success: false, message: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Use the file path for the profile image
    const profileImage = req.file ? req.file.path : null;

    const newUser = await User.create({
      userId,
      firstName,
      lastName,
      profileImage,
      password: hashedPassword,
    });

    const token = jwt.sign(
      { userId, firstName, lastName },
      "secretForChattingApplication"
    );
    res
      .status(200)
      .send({ success: true, message: "User registered successfully", token });
  } catch (err) {
    console.error("Registration error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { userId, password } = req.body;

    const user = await User.findOne({ userId: userId });
    if (!user) {
      return res
        .status(400)
        .json({ success: false, message: "User does not exist" });
    }

    const compare = await bcrypt.compare(password, user.password);
    if (!compare) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid password" });
    }

    const token = jwt.sign(
      { userId, firstName: user.firstName, lastName: user.lastName },
      "secretForChattingApplication"
    );
    res
      .status(200)
      .send({ success: true, message: "User logged in successfully", token });
  } catch (err) {
    console.error("Error during login:", err); // Log the error
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
