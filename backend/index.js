const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

const DATA_DIR = path.join(__dirname, "data");
const VIDEO_DIR = path.join(__dirname, "uploads", "videos");
const DATA_FILE = path.join(DATA_DIR, "videos.json");

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(VIDEO_DIR, { recursive: true });

if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, "[]", "utf8");
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use(express.static(__dirname));

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, VIDEO_DIR);
  },

  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    const name =
      Date.now() +
      "-" +
      Math.random().toString(36).substring(2, 8) +
      ext;

    cb(null, name);
  }
});

const upload = multer({
  storage: storage,

  limits: {
    fileSize: 200 * 1024 * 1024
  },

  fileFilter: function (req, file, cb) {
    if (file.mimetype && file.mimetype.startsWith("video/")) {
      cb(null, true);
    } else {
      cb(new Error("শুধু ভিডিও ফাইল আপলোড করা যাবে"));
    }
  }
});

// ভিডিও তালিকা
app.get("/api/videos", (req, res) => {
  try {
    const data = fs.readFileSync(DATA_FILE, "utf8");
    const videos = JSON.parse(data || "[]");

    res.json(videos);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "ভিডিও তালিকা পড়া যাচ্ছে না"
    });
  }
});

// ভিডিও আপলোড
app.post("/api/upload", upload.single("video"), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "ভিডিও ফাইল পাওয়া যায়নি"
      });
    }

    const username = req.body.username || "ZYLO User";
    const description = req.body.description || "";

    let videos = [];

    try {
      const data = fs.readFileSync(DATA_FILE, "utf8");
      videos = JSON.parse(data || "[]");

      if (!Array.isArray(videos)) {
        videos = [];
      }
    } catch {
      videos = [];
    }

    const video = {
      id: Date.now().toString(),
      username: username,
      description: description,
      filename: req.file.filename,
      url: "/uploads/videos/" + req.file.filename,
      createdAt: new Date().toISOString(),
      likes: 0,
      comments: 0,
      shares: 0
    };

    videos.unshift(video);

    fs.writeFileSync(
      DATA_FILE,
      JSON.stringify(videos, null, 2),
      "utf8"
    );

    res.json({
      success: true,
      message: "ভিডিও সফলভাবে আপলোড হয়েছে",
      video: video
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "ভিডিও আপলোড করতে সমস্যা হয়েছে"
    });
  }
});

// ভুল JSON বা অন্য error যেন পরিষ্কারভাবে JSON হিসেবে ফেরত যায়
app.use((err, req, res, next) => {
  console.error(err);

  res.status(400).json({
    success: false,
    message: err.message || "Server error"
  });
});

app.listen(PORT, () => {
  console.log(`ZYLO server running on port ${PORT}`);
});
