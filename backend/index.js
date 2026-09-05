const express = require("express");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const app = express();

const PORT = process.env.PORT || 10000;

const FRONTEND_ORIGIN =
  "https://golammostofa89076-sys.github.io";

const UPLOAD_DIR = path.join(__dirname, "uploads");
const DATA_DIR = path.join(__dirname, "data");
const VIDEO_DB = path.join(DATA_DIR, "videos.json");

// --------------------------------------------------
// DIRECTORIES
// --------------------------------------------------

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, {
    recursive: true
  });
}


if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, {
    recursive: true
  });
}

if (!fs.existsSync(VIDEO_DB)) {
  fs.writeFileSync(
    VIDEO_DB,
    JSON.stringify([], null, 2),
    "utf8"
  );
}

// --------------------------------------------------
// MIDDLEWARE
// --------------------------------------------------

app.use(
  cors({
    origin: function (origin, callback) {
      const allowed = [
        FRONTEND_ORIGIN,
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173"
      ];

      // Allow requests without Origin
      // such as curl/Postman/server-to-server.
      if (!origin) {
        return callback(null, true);
      }

      if (allowed.includes(origin)) {
        return callback(null, true);
      }

      return callback(
        new Error("CORS: Origin not allowed")
      );
    },
    methods: [
      "GET",
      "POST",
      "DELETE",
      "OPTIONS"
    ],
    allowedHeaders: [
      "Content-Type",
      "Authorization"
    ]
  })
);

app.use(express.json({
  limit: "2mb"
}));

app.use(express.urlencoded({
  extended: true,
  limit: "2mb"
}));

// --------------------------------------------------
// STATIC VIDEO FILES
// --------------------------------------------------

app.use(
  "/uploads",
  express.static(UPLOAD_DIR, {
    fallthrough: false,
    maxAge: "1h"
  })
);

// --------------------------------------------------
// MULTER STORAGE
// --------------------------------------------------

const storage = multer.diskStorage({

  destination: function (req, file, cb) {
    cb(null, UPLOAD_DIR);
  },

  filename: function (req, file, cb) {

    const originalExt =
      path.extname(file.originalname || "")
        .toLowerCase();

    const safeExt =
      originalExt ||
      getExtensionFromMime(file.mimetype);

    const videoId =
      crypto.randomUUID();

    const filename =
      `${videoId}${safeExt}`;

    cb(null, filename);
  }
});

// --------------------------------------------------
// VIDEO MIME TYPES
// --------------------------------------------------

const ALLOWED_MIME_TYPES = new Set([
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-matroska",
  "video/ogg",
  "video/mpeg",
  "video/3gpp"
]);

function getExtensionFromMime(mime) {

  const map = {
    "video/mp4": ".mp4",
    "video/webm": ".webm",
    "video/quicktime": ".mov",
    "video/x-matroska": ".mkv",
    "video/ogg": ".ogv",
    "video/mpeg": ".mpeg",
    "video/3gpp": ".3gp"
  };

  return map[mime] || ".mp4";
}

// --------------------------------------------------
// MULTER
// --------------------------------------------------

const upload = multer({

  storage,

  limits: {
    fileSize: 200 * 1024 * 1024
  },

  fileFilter: function (req, file, cb) {

    if (!file) {
      return cb(
        new Error("No video file received.")
      );
    }

    if (
      file.mimetype &&
      file.mimetype.startsWith("video/")
    ) {

      if (
        ALLOWED_MIME_TYPES.has(
          file.mimetype
        )
      ) {
        return cb(null, true);
      }

      // Some browsers report uncommon
      // video MIME types. Allow them too.
      return cb(null, true);
    }

    return cb(
      new Error(
        "Only video files are allowed."
      )
    );
  }
});

// --------------------------------------------------
// DATABASE HELPERS
// --------------------------------------------------

function readVideos() {

  try {

    const data =
      fs.readFileSync(
        VIDEO_DB,
        "utf8"
      );

    const videos =
      JSON.parse(data);

    if (Array.isArray(videos)) {
      return videos;
    }

    return [];

  } catch (error) {

    console.error(
      "Could not read video database:",
      error
    );

    return [];
  }
}

function writeVideos(videos) {

  fs.writeFileSync(
    VIDEO_DB,
    JSON.stringify(
      videos,
      null,
      2
    ),
    "utf8"
  );
}

// --------------------------------------------------
// HELPERS
// --------------------------------------------------

function cleanText(value, fallback = "") {

  if (
    typeof value !== "string"
  ) {
    return fallback;
  }

  return value
    .trim()
    .slice(0, 200);
}

function createVideoId() {
  return crypto.randomUUID();
}

// --------------------------------------------------
// HEALTH CHECK
// --------------------------------------------------

app.get("/", function (req, res) {

  res.json({
    success: true,
    message: "ZYLO Backend is running",
    version: "2.0.0",
    service: "video-upload",
    timestamp: new Date().toISOString()
  });
});

// --------------------------------------------------
// SERVER STATUS
// --------------------------------------------------

app.get("/api/health", function (req, res) {

  res.json({
    success: true,
    status: "online",
    service: "ZYLO Backend",
    timestamp: new Date().toISOString()
  });
});

// --------------------------------------------------
// UPLOAD VIDEO
// --------------------------------------------------

app.post(
  "/api/upload",
  upload.single("video"),
  function (req, res) {

    try {

      if (!req.file) {

        return res.status(400).json({
          success: false,
          message: "No video file uploaded."
        });
      }

      // ------------------------------------------
      // USER INFORMATION
      // ------------------------------------------

      const uid =
        cleanText(
          req.body.uid,
          "guest"
        );

      const username =
        cleanText(
          req.body.username,
          "ZYLO Creator"
        );

      // ------------------------------------------
      // FILE INFORMATION
      // ------------------------------------------

      const filename =
        req.file.filename;

      const videoId =
        createVideoId();

      const createdAt =
        Date.now();

      const protocol =
        req.headers["x-forwarded-proto"] ||
        req.protocol;

      const host =
        req.get("host");

      const videoUrl =
        `${protocol}://${host}/uploads/${encodeURIComponent(filename)}`;

      // ------------------------------------------
      // VIDEO METADATA
      // ------------------------------------------

      const videoData = {

        id: videoId,

        videoId: videoId,

        uid: uid,

        username: username,

        filename:
          req.file.originalname,

        storedFilename:
          filename,

        mimetype:
          req.file.mimetype,

        size:
          req.file.size,

        url:
          videoUrl,

        videoUrl:
          videoUrl,

        createdAt:
          createdAt,

        status:
          "published"
      };

      // ------------------------------------------
      // SAVE METADATA
      // ------------------------------------------

      const videos =
        readVideos();

      videos.unshift(
        videoData
      );

      writeVideos(
        videos
      );

      // ------------------------------------------
      // RESPONSE
      // ------------------------------------------

      return res.status(201).json({

        success: true,

        message:
          "Video uploaded successfully.",

        video: videoData,

        // Keep this for the
        // current ZYLO frontend.
        url: videoUrl,

        videoUrl: videoUrl,

        videoId: videoId,

        uid: uid,

        username: username
      });

    } catch (error) {

      console.error(
        "UPLOAD ERROR:",
        error
      );

      // If metadata saving fails,
      // remove the uploaded file.
      if (
        req.file &&
        req.file.path &&
        fs.existsSync(req.file.path)
      ) {

        try {
          fs.unlinkSync(
            req.file.path
          );
        } catch (deleteError) {
          console.error(
            "Could not delete failed upload:",
            deleteError
          );
        }
      }

      return res.status(500).json({

        success: false,

        message:
          "Video upload failed.",

        error:
          error.message
      });
    }
  }
);

// --------------------------------------------------
// GET ALL VIDEOS
// --------------------------------------------------

app.get(
  "/api/videos",
  function (req, res) {

    try {

      const videos =
        readVideos();

      return res.json({

        success: true,

        count:
          videos.length,

        videos:
          videos
      });

    } catch (error) {

      console.error(
        "GET VIDEOS ERROR:",
        error
      );

      return res.status(500).json({

        success: false,

        message:
          "Could not load videos.",

        videos: []
      });
    }
  }
);

// --------------------------------------------------
// GET VIDEOS BY USER
// --------------------------------------------------

app.get(
  "/api/videos/user/:uid",
  function (req, res) {

    try {

      const uid =
        cleanText(
          req.params.uid
        );

      if (!uid) {

        return res.status(400).json({

          success: false,

          message:
            "User ID is required.",

          videos: []
        });
      }

      const videos =
        readVideos();

      const userVideos =
        videos.filter(
          function (video) {
            return video.uid === uid;
          }
        );

      return res.json({

        success: true,

        uid: uid,

        count:
          userVideos.length,

        videos:
          userVideos
      });

    } catch (error) {

      console.error(
        "GET USER VIDEOS ERROR:",
        error
      );

      return res.status(500).json({

        success: false,

        message:
          "Could not load user videos.",

        videos: []
      });
    }
  }
);

// --------------------------------------------------
// GET SINGLE VIDEO
// --------------------------------------------------

app.get(
  "/api/videos/:videoId",
  function (req, res) {

    try {

      const videoId =
        cleanText(
          req.params.videoId
        );

      const videos =
        readVideos();

      const video =
        videos.find(
          function (item) {
            return (
              item.videoId === videoId ||
              item.id === videoId
            );
          }
        );

      if (!video) {

        return res.status(404).json({

          success: false,

          message:
            "Video not found."
        });
      }

      return res.json({

        success: true,

        video:
          video
      });

    } catch (error) {

      console.error(
        "GET VIDEO ERROR:",
        error
      );

      return res.status(500).json({

        success: false,

        message:
          "Could not load video."
      });
    }
  }
);

// --------------------------------------------------
// DELETE VIDEO
// --------------------------------------------------

app.delete(
  "/api/videos/:videoId",
  function (req, res) {

    try {

      const videoId =
        cleanText(
          req.params.videoId
        );

      const videos =
        readVideos();

      const index =
        videos.findIndex(
          function (video) {
            return (
              video.videoId === videoId ||
              video.id === videoId
            );
          }
        );

      if (index === -1) {

        return res.status(404).json({

          success: false,

          message:
            "Video not found."
        });
      }

      const video =
        videos[index];

      // ------------------------------------------
      // DELETE FILE
      // ------------------------------------------

      if (
        video.storedFilename
      ) {

        const filePath =
          path.join(
            UPLOAD_DIR,
            path.basename(
              video.storedFilename
            )
          );

        if (
          fs.existsSync(filePath)
        ) {

          fs.unlinkSync(
            filePath
          );
        }
      }

      // ------------------------------------------
      // DELETE METADATA
      // ------------------------------------------

      videos.splice(
        index,
        1
      );

      writeVideos(
        videos
      );

      return res.json({

        success: true,

        message:
          "Video deleted successfully.",

        videoId:
          videoId
      });

    } catch (error) {

      console.error(
        "DELETE VIDEO ERROR:",
        error
      );

      return res.status(500).json({

        success: false,

        message:
          "Could not delete video.",

        error:
          error.message
      });
    }
  }
);

// --------------------------------------------------
// MULTER / GENERAL ERROR HANDLER
// --------------------------------------------------

app.use(
  function (error, req, res, next) {

    console.error(
      "ZYLO SERVER ERROR:",
      error
    );

    if (
      error instanceof multer.MulterError
    ) {

      if (
        error.code ===
        "LIMIT_FILE_SIZE"
      ) {

        return res.status(413).json({

          success: false,

          message:
            "Video is too large. Maximum size is 200 MB."
        });
      }

      return res.status(400).json({

        success: false,

        message:
          error.message
      });
    }

    if (
      error &&
      error.message &&
      error.message.startsWith("CORS:")
    ) {

      return res.status(403).json({

        success: false,

        message:
          "CORS request blocked."
      });
    }

    return res.status(500).json({

      success: false,

      message:
        error.message ||
        "Internal server error."
    });
  }
);

// --------------------------------------------------
// START SERVER
// --------------------------------------------------

app.listen(
  PORT,
  "0.0.0.0",
  function () {

    console.log(
      `ZYLO Backend running on port ${PORT}`
    );

    console.log(
      `Upload directory: ${UPLOAD_DIR}`
    );

    console.log(
      `Video database: ${VIDEO_DB}`
    );
  }
);
