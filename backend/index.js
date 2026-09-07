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

const VIDEO_DB =
  path.join(DATA_DIR, "videos.json");

const ENGAGEMENT_DB =
  path.join(DATA_DIR, "engagement.json");

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


// --------------------------------------------------
// DATABASE FILES
// --------------------------------------------------

if (!fs.existsSync(VIDEO_DB)) {
  fs.writeFileSync(
    VIDEO_DB,
    JSON.stringify([], null, 2),
    "utf8"
  );
}

if (!fs.existsSync(ENGAGEMENT_DB)) {
  fs.writeFileSync(
    ENGAGEMENT_DB,
    JSON.stringify(
      {
        likes: {},
        saves: {},
        comments: {},
        shares: {}
      },
      null,
      2
    ),
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

app.use(
  express.json({
    limit: "2mb"
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: "2mb"
  })
);

// --------------------------------------------------
// STATIC VIDEO FILES
// --------------------------------------------------

app.use(
  "/uploads",
  express.static(
    UPLOAD_DIR,
    {
      fallthrough: false,
      maxAge: "1h"
    }
  )
);

// --------------------------------------------------
// MULTER STORAGE
// --------------------------------------------------

const storage =
  multer.diskStorage({

    destination: function (
      req,
      file,
      cb
    ) {
      cb(
        null,
        UPLOAD_DIR
      );
    },

    filename: function (
      req,
      file,
      cb
    ) {

      const originalExt =
        path
          .extname(
            file.originalname || ""
          )
          .toLowerCase();

      const safeExt =
        originalExt ||
        getExtensionFromMime(
          file.mimetype
        );

      const videoId =
        crypto.randomUUID();

      const filename =
        `${videoId}${safeExt}`;

      cb(
        null,
        filename
      );
    }
  });

// --------------------------------------------------
// VIDEO MIME TYPES
// --------------------------------------------------

const ALLOWED_MIME_TYPES =
  new Set([
    "video/mp4",
    "video/webm",
    "video/quicktime",
    "video/x-matroska",
    "video/ogg",
    "video/mpeg",
    "video/3gpp"
  ]);

function getExtensionFromMime(
  mime
) {

  const map = {

    "video/mp4":
      ".mp4",

    "video/webm":
      ".webm",

    "video/quicktime":
      ".mov",

    "video/x-matroska":
      ".mkv",

    "video/ogg":
      ".ogv",

    "video/mpeg":
      ".mpeg",

    "video/3gpp":
      ".3gp"
  };

  return (
    map[mime] ||
    ".mp4"
  );
}

// --------------------------------------------------
// MULTER
// --------------------------------------------------

const upload =
  multer({

    storage,

    limits: {
      fileSize:
        200 * 1024 * 1024
    },

    fileFilter:
      function (
        req,
        file,
        cb
      ) {

        if (!file) {

          return cb(
            new Error(
              "No video file received."
            )
          );
        }

        if (
          file.mimetype &&
          file.mimetype.startsWith(
            "video/"
          )
        ) {

          if (
            ALLOWED_MIME_TYPES.has(
              file.mimetype
            )
          ) {
            return cb(
              null,
              true
            );
          }

          return cb(
            null,
            true
          );
        }

        return cb(
          new Error(
            "Only video files are allowed."
          )
        );
      }
  });

// ==================================================
// DATABASE HELPERS
// ==================================================

function readVideos() {

  try {

    const data =
      fs.readFileSync(
        VIDEO_DB,
        "utf8"
      );

    const videos =
      JSON.parse(data);

    if (
      Array.isArray(videos)
    ) {
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

function writeVideos(
  videos
) {

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
// ENGAGEMENT DATABASE
// --------------------------------------------------

function createEmptyEngagement() {

  return {
    likes: {},
    saves: {},
    comments: {},
    shares: {}
  };
}

function readEngagement() {

  try {

    const data =
      fs.readFileSync(
        ENGAGEMENT_DB,
        "utf8"
      );

    const engagement =
      JSON.parse(data);

    if (
      engagement &&
      typeof engagement === "object"
    ) {

      return {
        likes:
          engagement.likes || {},

        saves:
          engagement.saves || {},

        comments:
          engagement.comments || {},

        shares:
          engagement.shares || {}
      };
    }

    return createEmptyEngagement();

  } catch (error) {

    console.error(
      "Could not read engagement database:",
      error
    );

    return createEmptyEngagement();
  }
}

function writeEngagement(
  engagement
) {

  fs.writeFileSync(
    ENGAGEMENT_DB,
    JSON.stringify(
      engagement,
      null,
      2
    ),
    "utf8"
  );
}

// --------------------------------------------------
// TEXT CLEANING
// --------------------------------------------------

function cleanText(
  value,
  fallback = ""
) {

  if (
    typeof value !==
    "string"
  ) {
    return fallback;
  }

  return value
    .trim()
    .slice(0, 200);
}

// --------------------------------------------------
// ID
// --------------------------------------------------

function createVideoId() {
  return crypto.randomUUID();
}

// --------------------------------------------------
// ENGAGEMENT HELPERS
// --------------------------------------------------

function normalizeVideoId(
  value
) {

  return cleanText(
    value,
    ""
  );
}

function normalizeUserId(
  value
) {

  return cleanText(
    value,
    "guest"
  );
}

function ensureUserArray(
  object,
  videoId
) {

  if (
    !Array.isArray(
      object[videoId]
    )
  ) {

    object[videoId] = [];
  }

  return object[videoId];
}

function getLikeCount(
  engagement,
  videoId
) {

  return Array.isArray(
    engagement.likes[videoId]
  )
    ? engagement.likes[videoId].length
    : 0;
}

function getSaveCount(
  engagement,
  videoId
) {

  return Array.isArray(
    engagement.saves[videoId]
  )
    ? engagement.saves[videoId].length
    : 0;
}

function getShareCount(
  engagement,
  videoId
) {

  return Number(
    engagement.shares[videoId] || 0
  );
}

function getCommentList(
  engagement,
  videoId
) {

  return Array.isArray(
    engagement.comments[videoId]
  )
    ? engagement.comments[videoId]
    : [];
}

// ==================================================
// HEALTH CHECK
// ==================================================

app.get(
  "/",
  function (
    req,
    res
  ) {

    res.json({

      success:
        true,

      message:
        "ZYLO Backend is running",

      version:
        "2.1.0",

      service:
        "video-upload-engagement",

      timestamp:
        new Date().toISOString()
    });
  }
);

// ==================================================
// SERVER STATUS
// ==================================================

app.get(
  "/api/health",
  function (
    req,
    res
  ) {

    res.json({

      success:
        true,

      status:
        "online",

      service:
        "ZYLO Backend",

      version:
        "2.1.0",

      timestamp:
        new Date().toISOString()
    });
  }
);

// ==================================================
// UPLOAD VIDEO
// ==================================================

app.post(
  "/api/upload",

  upload.single("video"),

  function (
    req,
    res
  ) {

    try {

      if (!req.file) {

        return res
          .status(400)
          .json({

            success:
              false,

            message:
              "No video file uploaded."
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
        req.headers[
          "x-forwarded-proto"
        ] ||
        req.protocol;

      const host =
        req.get("host");

      const videoUrl =
        `${protocol}://${host}/uploads/${encodeURIComponent(filename)}`;

      // ------------------------------------------
      // VIDEO METADATA
      // ------------------------------------------

      const videoData = {

        id:
          videoId,

        videoId:
          videoId,

        uid:
          uid,

        username:
          username,

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
      // SAVE VIDEO
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

      return res
        .status(201)
        .json({

          success:
            true,

          message:
            "Video uploaded successfully.",

          video:
            videoData,

          url:
            videoUrl,

          videoUrl:
            videoUrl,

          videoId:
            videoId,

          uid:
            uid,

          username:
            username
        });

    } catch (error) {

      console.error(
        "UPLOAD ERROR:",
        error
      );

      if (
        req.file &&
        req.file.path &&
        fs.existsSync(
          req.file.path
        )
      ) {

        try {

          fs.unlinkSync(
            req.file.path
          );

        } catch (
          deleteError
        ) {

          console.error(
            "Could not delete failed upload:",
            deleteError
          );
        }
      }

      return res
        .status(500)
        .json({

          success:
            false,

          message:
            "Video upload failed.",

          error:
            error.message
        });
    }
  }
);

// ==================================================
// GET ALL VIDEOS
// ==================================================

app.get(
  "/api/videos",
  function (
    req,
    res
  ) {

    try {

      const videos =
        readVideos();

      const engagement =
        readEngagement();

      const enrichedVideos =
        videos.map(
          function (
            video
          ) {

            const videoId =
              video.videoId ||
              video.id;

            return {

              ...video,

              likeCount:
                getLikeCount(
                  engagement,
                  videoId
                ),

              saveCount:
                getSaveCount(
                  engagement,
                  videoId
                ),

              commentCount:
                getCommentList(
                  engagement,
                  videoId
                ).length,

              shareCount:
                getShareCount(
                  engagement,
                  videoId
                )
            };
          }
        );

      return res.json({

        success:
          true,

        count:
          enrichedVideos.length,

        videos:
          enrichedVideos
      });

    } catch (error) {

      console.error(
        "GET VIDEOS ERROR:",
        error
      );

      return res
        .status(500)
        .json({

          success:
            false,

          message:
            "Could not load videos.",

          videos:
            []
        });
    }
  }
);

// ==================================================
// GET VIDEOS BY USER
// ==================================================

app.get(
  "/api/videos/user/:uid",

  function (
    req,
    res
  ) {

    try {

      const uid =
        cleanText(
          req.params.uid
        );

      if (!uid) {

        return res
          .status(400)
          .json({

            success:
              false,

            message:
              "User ID is required.",

            videos:
              []
          });
      }

      const videos =
        readVideos();

      const engagement =
        readEngagement();

      const userVideos =
        videos
          .filter(
            function (
              video
            ) {

              return (
                video.uid === uid
              );
            }
          )
          .map(
            function (
              video
            ) {

              const videoId =
                video.videoId ||
                video.id;

              return {

                ...video,

                likeCount:
                  getLikeCount(
                    engagement,
                    videoId
                  ),

                saveCount:
                  getSaveCount(
                    engagement,
                    videoId
                  ),

                commentCount:
                  getCommentList(
                    engagement,
                    videoId
                  ).length,

                shareCount:
                  getShareCount(
                    engagement,
                    videoId
                  )
              };
            }
          );

      return res.json({

        success:
          true,

        uid:
          uid,

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

      return res
        .status(500)
        .json({

          success:
            false,

          message:
            "Could not load user videos.",

          videos:
            []
        });
    }
  }
);

// ==================================================
// GET SINGLE VIDEO
// ==================================================

app.get(
  "/api/videos/:videoId",

  function (
    req,
    res
  ) {

    try {

      const videoId =
        normalizeVideoId(
          req.params.videoId
        );

      const videos =
        readVideos();

      const video =
        videos.find(
          function (
            item
          ) {

            return (
              item.videoId ===
                videoId ||
              item.id ===
                videoId
            );
          }
        );

      if (!video) {

        return res
          .status(404)
          .json({

            success:
              false,

            message:
              "Video not found."
          });
      }

      const engagement =
        readEngagement();

      return res.json({

        success:
          true,

        video: {

          ...video,

          likeCount:
            getLikeCount(
              engagement,
              videoId
            ),

          saveCount:
            getSaveCount(
              engagement,
              videoId
            ),

          commentCount:
            getCommentList(
              engagement,
              videoId
            ).length,

          shareCount:
            getShareCount(
              engagement,
              videoId
            )
        }
      });

    } catch (error) {

      console.error(
        "GET VIDEO ERROR:",
        error
      );

      return res
        .status(500)
        .json({

          success:
            false,

          message:
            "Could not load video."
        });
    }
  }
);

// ==================================================
// LIKE / UNLIKE
// ==================================================

app.post(
  "/api/videos/:videoId/like",

  function (
    req,
    res
  ) {

    try {

      const videoId =
        normalizeVideoId(
          req.params.videoId
        );

      const uid =
        normalizeUserId(
          req.body.uid
        );

      const videos =
        readVideos();

      const videoExists =
        videos.some(
          function (
            video
          ) {

            return (
              video.id ===
                videoId ||
              video.videoId ===
                videoId
            );
          }
        );

      if (!videoExists) {

        return res
          .status(404)
          .json({

            success:
              false,

            message:
              "Video not found."
          });
      }

      const engagement =
        readEngagement();

      const likes =
        ensureUserArray(
          engagement.likes,
          videoId
        );

      const index =
        likes.indexOf(uid);

      let liked;

      if (index >= 0) {

        likes.splice(
          index,
          1
        );

        liked =
          false;

      } else {

        likes.push(
          uid
        );

        liked =
          true;
      }

      writeEngagement(
        engagement
      );

      return res.json({

        success:
          true,

        videoId:
          videoId,

        uid:
          uid,

        liked:
          liked,

        likeCount:
          likes.length
      });

    } catch (error) {

      console.error(
        "LIKE ERROR:",
        error
      );

      return res
        .status(500)
        .json({

          success:
            false,

          message:
            "Could not update like."
        });
    }
  }
);

// ==================================================
// SAVE / UNSAVE
// ==================================================

app.post(
  "/api/videos/:videoId/save",

  function (
    req,
    res
  ) {

    try {

      const videoId =
        normalizeVideoId(
          req.params.videoId
        );

      const uid =
        normalizeUserId(
          req.body.uid
        );

      const videos =
        readVideos();

      const videoExists =
        videos.some(
          function (
            video
          ) {

            return (
              video.id ===
                videoId ||
              video.videoId ===
                videoId
            );
          }
        );

      if (!videoExists) {

        return res
          .status(404)
          .json({

            success:
              false,

            message:
              "Video not found."
          });
      }

      const engagement =
        readEngagement();

      const saves =
        ensureUserArray(
          engagement.saves,
          videoId
        );

      const index =
        saves.indexOf(uid);

      let saved;

      if (index >= 0) {

        saves.splice(
          index,
          1
        );

        saved =
          false;

      } else {

        saves.push(
          uid
        );

        saved =
          true;
      }

      writeEngagement(
        engagement
      );

      return res.json({

        success:
          true,

        videoId:
          videoId,

        uid:
          uid,

        saved:
          saved,

        saveCount:
          saves.length
      });

    } catch (error) {

      console.error(
        "SAVE ERROR:",
        error
      );

      return res
        .status(500)
        .json({

          success:
            false,

          message:
            "Could not update save."
        });
    }
  }
);

// ==================================================
// GET COMMENTS
// ==================================================

app.get(
  "/api/videos/:videoId/comments",

  function (
    req,
    res
  ) {

    try {

      const videoId =
        normalizeVideoId(
          req.params.videoId
        );

      const videos =
        readVideos();

      const videoExists =
        videos.some(
          function (
            video
          ) {

            return (
              video.id ===
                videoId ||
              video.videoId ===
                videoId
            );
          }
        );

      if (!videoExists) {

        return res
          .status(404)
          .json({

            success:
              false,

            message:
              "Video not found.",

            comments:
              []
          });
      }

      const engagement =
        readEngagement();

      const comments =
        getCommentList(
          engagement,
          videoId
        );

      return res.json({

        success:
          true,

        videoId:
          videoId,

        count:
          comments.length,

        comments:
          comments
      });

    } catch (error) {

      console.error(
        "GET COMMENTS ERROR:",
        error
      );

      return res
        .status(500)
        .json({

          success:
            false,

          message:
            "Could not load comments.",

          comments:
            []
        });
    }
  }
);

// ==================================================
// ADD COMMENT
// ==================================================

app.post(
  "/api/videos/:videoId/comments",

  function (
    req,
    res
  ) {

    try {

      const videoId =
        normalizeVideoId(
          req.params.videoId
        );

      const uid =
        normalizeUserId(
          req.body.uid
        );

      const username =
        cleanText(
          req.body.username,
          "ZYLO User"
        );

      const text =
        cleanText(
          req.body.text,
          ""
        );

      if (!text) {

        return res
          .status(400)
          .json({

            success:
              false,

            message:
              "Comment text is required."
          });
      }

      const videos =
        readVideos();

      const videoExists =
        videos.some(
          function (
            video
          ) {

            return (
              video.id ===
                videoId ||
              video.videoId ===
                videoId
            );
          }
        );

      if (!videoExists) {

        return res
          .status(404)
          .json({

            success:
              false,

            message:
              "Video not found."
          });
      }

      const engagement =
        readEngagement();

      const comments =
        ensureUserArray(
          engagement.comments,
          videoId
        );

      const comment = {

        id:
          crypto.randomUUID(),

        videoId:
          videoId,

        uid:
          uid,

        username:
          username,

        text:
          text,

        createdAt:
          Date.now()
      };

      comments.push(
        comment
      );

      writeEngagement(
        engagement
      );

      return res
        .status(201)
        .json({

          success:
            true,

          comment:
            comment,

          commentCount:
            comments.length
        });

    } catch (error) {

      console.error(
        "ADD COMMENT ERROR:",
        error
      );

      return res
        .status(500)
        .json({

          success:
            false,

          message:
            "Could not add comment."
        });
    }
  }
);

// ==================================================
// SHARE
// ==================================================

app.post(
  "/api/videos/:videoId/share",

  function (
    req,
    res
  ) {

    try {

      const videoId =
        normalizeVideoId(
          req.params.videoId
        );

      const videos =
        readVideos();

      const videoExists =
        videos.some(
          function (
            video
          ) {

            return (
              video.id ===
                videoId ||
              video.videoId ===
                videoId
            );
          }
        );

      if (!videoExists) {

        return res
          .status(404)
          .json({

            success:
              false,

            message:
              "Video not found."
          });
      }

      const engagement =
        readEngagement();

      const current =
        Number(
          engagement.shares[
            videoId
          ] || 0
        );

      engagement.shares[
        videoId
      ] =
        current + 1;

      writeEngagement(
        engagement
      );

      return res.json({

        success:
          true,

        videoId:
          videoId,

        shareCount:
          engagement.shares[
            videoId
          ]
      });

    } catch (error) {

      console.error(
        "SHARE ERROR:",
        error
      );

      return res
        .status(500)
        .json({

          success:
            false,

          message:
            "Could not update share count."
        });
    }
  }
);

// ==================================================
// ENGAGEMENT STATE FOR USER
// ==================================================

app.get(
  "/api/videos/:videoId/engagement",

  function (
    req,
    res
  ) {

    try {

      const videoId =
        normalizeVideoId(
          req.params.videoId
        );

      const uid =
        normalizeUserId(
          req.query.uid
        );

      const videos =
        readVideos();

      const videoExists =
        videos.some(
          function (
            video
          ) {

            return (
              video.id ===
                videoId ||
              video.videoId ===
                videoId
            );
          }
        );

      if (!videoExists) {

        return res
          .status(404)
          .json({

            success:
              false,

            message:
              "Video not found."
          });
      }

      const engagement =
        readEngagement();

      const likes =
        ensureUserArray(
          engagement.likes,
          videoId
        );

      const saves =
        ensureUserArray(
          engagement.saves,
          videoId
        );

      const comments =
        getCommentList(
          engagement,
          videoId
        );

      const shares =
        getShareCount(
          engagement,
          videoId
        );

      return res.json({

        success:
          true,

        videoId:
          videoId,

        uid:
          uid,

        liked:
          likes.includes(
            uid
          ),

        saved:
          saves.includes(
            uid
          ),

        likeCount:
          likes.length,

        saveCount:
          saves.length,

        commentCount:
          comments.length,

        shareCount:
          shares
      });

    } catch (error) {

      console.error(
        "ENGAGEMENT STATE ERROR:",
        error
      );

      return res
        .status(500)
        .json({

          success:
            false,

          message:
            "Could not load engagement state."
        });
    }
  }
);

// ==================================================
// DELETE VIDEO
// ==================================================

app.delete(
  "/api/videos/:videoId",

  function (
    req,
    res
  ) {

    try {

      const videoId =
        cleanText(
          req.params.videoId
        );

      const videos =
        readVideos();

      const index =
        videos.findIndex(
          function (
            video
          ) {

            return (
              video.videoId ===
                videoId ||
              video.id ===
                videoId
            );
          }
        );

      if (index === -1) {

        return res
          .status(404)
          .json({

            success:
              false,

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
          fs.existsSync(
            filePath
          )
        ) {

          fs.unlinkSync(
            filePath
          );
        }
      }

      // ------------------------------------------
      // DELETE VIDEO
      // ------------------------------------------

      videos.splice(
        index,
        1
      );

      writeVideos(
        videos
      );

      // ------------------------------------------
      // DELETE ENGAGEMENT DATA
      // ------------------------------------------

      const engagement =
        readEngagement();

      delete engagement.likes[
        videoId
      ];

      delete engagement.saves[
        videoId
      ];

      delete engagement.comments[
        videoId
      ];

      delete engagement.shares[
        videoId
      ];

      writeEngagement(
        engagement
      );

      return res.json({

        success:
          true,

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

      return res
        .status(500)
        .json({

          success:
            false,

          message:
            "Could not delete video.",

          error:
            error.message
        });
    }
  }
);

// ==================================================
// MULTER / GENERAL ERROR HANDLER
// ==================================================

app.use(
  function (
    error,
    req,
    res,
    next
  ) {

    console.error(
      "ZYLO SERVER ERROR:",
      error
    );

    if (
      error instanceof
      multer.MulterError
    ) {

      if (
        error.code ===
        "LIMIT_FILE_SIZE"
      ) {

        return res
          .status(413)
          .json({

            success:
              false,

            message:
              "Video is too large. Maximum size is 200 MB."
          });
      }

      return res
        .status(400)
        .json({

          success:
            false,

          message:
            error.message
        });
    }

    if (
      error &&
      error.message &&
      error.message.startsWith(
        "CORS:"
      )
    ) {

      return res
        .status(403)
        .json({

          success:
            false,

          message:
            "CORS request blocked."
        });
    }

    return res
      .status(500)
      .json({

        success:
          false,

        message:
          error.message ||
          "Internal server error."
      });
  }
);

// ==================================================
// START SERVER
// ==================================================

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

    console.log(
      `Engagement database: ${ENGAGEMENT_DB}`
    );
  }
);
