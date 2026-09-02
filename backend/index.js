const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;

// Upload folder
const uploadDir = path.join(__dirname, "uploads");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// JSON support
app.use(express.json());

// Serve uploaded videos
app.use("/uploads", express.static(uploadDir));

// Multer storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },

  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    const name =
      Date.now() + "-" + Math.round(Math.random() * 1e9) + ext;

    cb(null, name);
  }
});

// Only allow video files
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith("video/")) {
    cb(null, true);
  } else {
    cb(new Error("শুধু ভিডিও ফাইল আপলোড করা যাবে"));
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 200 * 1024 * 1024
  }
});

// Home
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "ZYLO Backend is running"
  });
});

// Video upload
app.post("/api/upload", upload.single("video"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: "কোনো ভিডিও পাওয়া যায়নি"
    });
  }

  const videoUrl =
    `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`;

  res.json({
    success: true,
    message: "ভিডিও সফলভাবে আপলোড হয়েছে",
    video: {
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size,
      url: videoUrl
    }
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err);

  res.status(500).json({
    success: false,
    message: err.message || "Server error"
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`ZYLO Backend running on port ${PORT}`);
});
