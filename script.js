"use strict";

/* =========================================================
   ZYLO — FINAL SHORT VIDEO APP SCRIPT
   UI/design is controlled by index.html + style.css.
   This file handles functionality.
========================================================= */

const API_BASE_URL = "https://zylo-backend-ec5c.onrender.com";

const CDN_VIDEO_URL =
  "https://cdn.jsdelivr.net/gh/golammostofa89076-sys/zylo@main/backend/uploads/video1.mp4";

const STORAGE_KEYS = {
  likes: "zylo_likes",
  saves: "zylo_saves",
  follows: "zylo_follows",
  comments: "zylo_comments",
  profile: "zylo_profile",
  uploadedVideos: "zylo_uploaded_videos"
};


/* =========================================================
   HELPERS
========================================================= */

function getStorage(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch (error) {
    return fallback;
  }
}

function setStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn("ZYLO storage error:", error);
  }
}

function escapeHTML(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeAttribute(value) {
  return escapeHTML(value);
}

function formatCount(number) {
  const n = Number(number) || 0;

  if (n >= 1000000000) {
    return (n / 1000000000).toFixed(1).replace(".0", "") + "B";
  }

  if (n >= 1000000) {
    return (n / 1000000).toFixed(1).replace(".0", "") + "M";
  }

  if (n >= 1000) {
    return (n / 1000).toFixed(1).replace(".0", "") + "K";
  }

  return String(n);
}


/* =========================================================
   DOM
========================================================= */

const videoFeed = document.getElementById("videoFeed");
const createBtn = document.getElementById("createBtn");
const videoInput = document.getElementById("videoInput");
const uploadBox = document.getElementById("uploadBox");
const closeUpload = document.getElementById("closeUpload");
const selectVideo = document.getElementById("selectVideo");
const uploadStatus = document.getElementById("uploadStatus");
const searchBtn = document.querySelector(".search-btn");


/* =========================================================
   STATE
========================================================= */

let likes = getStorage(STORAGE_KEYS.likes, {});
let saves = getStorage(STORAGE_KEYS.saves, {});
let follows = getStorage(STORAGE_KEYS.follows, {});
let comments = getStorage(STORAGE_KEYS.comments, {});
let profile = getStorage(STORAGE_KEYS.profile, {
  username: "zylo_creator",
  displayName: "ZYLO Creator",
  bio: "Create • Connect • Grow",
  followers: 0,
  following: 0
});

let activeFeedMode = "for-you";


/* =========================================================
   VIDEO ID
========================================================= */

function getVideoId(page) {
  if (!page.dataset.videoId) {
    page.dataset.videoId =
      "video_" +
      Date.now() +
      "_" +
      Math.random().toString(36).slice(2, 8);
  }

  return page.dataset.videoId;
}


/* =========================================================
   VIDEO INITIALIZATION
========================================================= */

function initializeAllVideos() {
  if (!videoFeed) return;

  const pages = videoFeed.querySelectorAll(".video-page");

  pages.forEach((page) => {
    initializeVideoPage(page);
  });

  restoreUploadedVideos();
}

function initializeVideoPage(page) {
  if (!page || page.dataset.zyloReady === "true") return;

  page.dataset.zyloReady = "true";

  const video = page.querySelector("video");
  if (!video) return;

  const videoId = getVideoId(page);

  video.loop = true;
  video.muted = true;
  video.playsInline = true;

  setupVideoFallback(video);
  setupVideoClick(video);

  updateLikeUI(page, videoId);
  updateSaveUI(page, videoId);
  updateFollowUI(page, videoId);
  updateCommentUI(page, videoId);

  setupLikeButton(page, videoId);
  setupSaveButton(page, videoId);
  setupCommentButton(page, videoId);
  setupShareButton(page, videoId);
  setupProfileButton(page, videoId);
  setupMusicButton(page, video);
  setupFullscreenButton(page);
}


/* =========================================================
   VIDEO FALLBACK
========================================================= */

function setupVideoFallback(video) {
  video.addEventListener("error", function () {
    if (video.dataset.fallbackUsed === "true") return;

    video.dataset.fallbackUsed = "true";

    const current =
      video.currentSrc ||
      video.src ||
      "";

    if (!current.includes("jsdelivr")) {
      video.src = CDN_VIDEO_URL;
      video.load();

      video.play().catch(() => {});
    }
  });
}


/* =========================================================
   VIDEO PLAY / PAUSE
========================================================= */

function setupVideoClick(video) {
  if (video.dataset.clickReady === "true") return;

  video.dataset.clickReady = "true";

  video.addEventListener("click", () => {
    if (video.paused) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  });
}


/* =========================================================
   LIKE
========================================================= */

function setupLikeButton(page, videoId) {
  const button = page.querySelector(".like-btn");

  if (!button || button.dataset.ready === "true") return;

  button.dataset.ready = "true";

  button.addEventListener("click", (event) => {
    event.stopPropagation();

    likes[videoId] = !likes[videoId];

    setStorage(STORAGE_KEYS.likes, likes);

    updateLikeUI(page, videoId);
  });
}

function updateLikeUI(page, videoId) {
  const button = page.querySelector(".like-btn");
  if (!button) return;

  const count = page.querySelector(".like-btn .action-count");

  const base =
    Number(button.dataset.baseCount || 0);

  if (likes[videoId]) {
    button.classList.add("active");

    if (count) {
      count.textContent = formatCount(base + 1);
    }
  } else {
    button.classList.remove("active");

    if (count) {
      count.textContent = formatCount(base);
    }
  }
}


/* =========================================================
   SAVE
========================================================= */

function setupSaveButton(page, videoId) {
  const button = page.querySelector(".save-btn");

  if (!button || button.dataset.ready === "true") return;

  button.dataset.ready = "true";

  button.addEventListener("click", (event) => {
    event.stopPropagation();

    saves[videoId] = !saves[videoId];

    setStorage(STORAGE_KEYS.saves, saves);

    updateSaveUI(page, videoId);
  });
}

function updateSaveUI(page, videoId) {
  const button = page.querySelector(".save-btn");
  if (!button) return;

  const text = button.querySelector(".action-text");

  if (saves[videoId]) {
    button.classList.add("active");

    if (text) {
      text.textContent = "Saved";
    }
  } else {
    button.classList.remove("active");

    if (text) {
      text.textContent = "Save";
    }
  }
}


/* =========================================================
   FOLLOW
========================================================= */

function updateFollowUI(page, videoId) {
  const badge = page.querySelector(".follow-badge");

  if (!badge) return;

  badge.textContent = follows[videoId] ? "✓" : "+";
}

function toggleFollow(videoId, page = null) {
  follows[videoId] = !follows[videoId];

  setStorage(STORAGE_KEYS.follows, follows);

  if (page) {
    updateFollowUI(page, videoId);
  }

  return follows[videoId];
}


/* =========================================================
   CREATOR PROFILE
========================================================= */

function setupProfileButton(page, videoId) {
  const button = page.querySelector(".profile-action");

  if (!button || button.dataset.ready === "true") return;

  button.dataset.ready = "true";

  button.addEventListener("click", (event) => {
    event.stopPropagation();

    showCreatorProfile(page, videoId);
  });
}

function getCreatorData(page) {
  const username =
    page.querySelector(".username")?.textContent?.trim() ||
    "@zylo_creator";

  const cleanUsername = username.replace(/^@/, "");

  const caption =
    page.querySelector(".caption")?.textContent?.trim() ||
    "Create • Connect • Grow";

  return {
    username: cleanUsername,
    displayName:
      cleanUsername === "zylo_creator"
        ? "ZYLO Creator"
        : cleanUsername,
    bio: caption
  };
}

function showCreatorProfile(page, videoId) {
  removeOverlay("zylo-creator-profile");

  const creator = getCreatorData(page);
  const isFollowing = !!follows[videoId];

  const overlay = document.createElement("div");

  overlay.className = "zylo-overlay zylo-creator-profile";

  overlay.innerHTML = `
    <div class="zylo-panel creator-panel">

      <button class="zylo-close" data-close-profile aria-label="Close">
        <svg viewBox="0 0 24 24">
          <path d="M6 6L18 18"></path>
          <path d="M18 6L6 18"></path>
        </svg>
      </button>

      <div class="creator-avatar">Z</div>

      <h2>${escapeHTML(creator.displayName)}</h2>

      <div class="creator-username">
        @${escapeHTML(creator.username)}
      </div>

      <p class="creator-bio">
        ${escapeHTML(creator.bio)}
      </p>

      <div class="creator-stats">
        <div>
          <strong>0</strong>
          <span>Following</span>
        </div>

        <div>
          <strong>${formatCount(profile.followers)}</strong>
          <span>Followers</span>
        </div>

        <div>
          <strong>0</strong>
          <span>Likes</span>
        </div>
      </div>

      <button
        class="creator-follow-button ${isFollowing ? "following" : ""}"
        data-creator-follow
      >
        ${isFollowing ? "Following" : "Follow"}
      </button>

      <button class="creator-message-button" data-creator-message>
        Message
      </button>

    </div>
  `;

  document.body.appendChild(overlay);

  requestAnimationFrame(() => {
    overlay.classList.add("show");
  });

  overlay.querySelector("[data-close-profile]")
    ?.addEventListener("click", () => {
      closeOverlay(overlay);
    });

  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) {
      closeOverlay(overlay);
    }
  });

  overlay.querySelector("[data-creator-follow]")
    ?.addEventListener("click", () => {
      const state = toggleFollow(videoId, page);

      const followButton =
        overlay.querySelector("[data-creator-follow]");

      if (followButton) {
        followButton.textContent =
          state ? "Following" : "Follow";

        followButton.classList.toggle(
          "following",
          state
        );
      }

      showToast(
        state ? "Following creator" : "Unfollowed"
      );
    });

  overlay.querySelector("[data-creator-message]")
    ?.addEventListener("click", () => {
      showToast("Messaging is ready");
    });
}


/* =========================================================
   COMMENTS
========================================================= */

function setupCommentButton(page, videoId) {
  const button = page.querySelector(
    ".action-btn:not(.like-btn):not(.save-btn):not(.share-btn)"
  );

  if (!button || button.dataset.commentReady === "true") return;

  const svg = button.querySelector("svg");

  if (!svg) return;

  button.dataset.commentReady = "true";

  button.addEventListener("click", (event) => {
    event.stopPropagation();

    showComments(page, videoId);
  });
}

function getComments(videoId) {
  if (!Array.isArray(comments[videoId])) {
    comments[videoId] = [];
  }

  return comments[videoId];
}

function updateCommentUI(page, videoId) {
  const button = page.querySelector(
    ".action-btn:not(.like-btn):not(.save-btn):not(.share-btn)"
  );

  if (!button) return;

  const count = button.querySelector(".action-count");

  if (!count) return;

  const list = getComments(videoId);

  count.textContent = formatCount(list.length);
}

function showComments(page, videoId) {
  removeOverlay("zylo-comments");

  const list = getComments(videoId);

  const overlay = document.createElement("div");

  overlay.className = "zylo-overlay zylo-comments";

  overlay.innerHTML = `
    <div class="zylo-sheet">

      <div class="zylo-sheet-header">
        <strong>Comments</strong>

        <button
          class="zylo-close"
          data-close-comments
          aria-label="Close"
        >
          <svg viewBox="0 0 24 24">
            <path d="M6 6L18 18"></path>
            <path d="M18 6L6 18"></path>
          </svg>
        </button>
      </div>

      <div class="zylo-comment-list">
        ${
          list.length
            ? list.map((item) => `
              <div class="zylo-comment">
                <div class="zylo-comment-avatar">Z</div>
                <div>
                  <strong>
                    ${escapeHTML(item.username || "You")}
                  </strong>
                  <p>
                    ${escapeHTML(item.text)}
                  </p>
                </div>
              </div>
            `).join("")
            : `
              <div class="zylo-empty">
                No comments yet
              </div>
            `
        }
      </div>

      <form class="zylo-comment-form">

        <input
          type="text"
          maxlength="500"
          placeholder="Add a comment..."
          autocomplete="off"
        >

        <button type="submit">
          Send
        </button>

      </form>

    </div>
  `;

  document.body.appendChild(overlay);

  requestAnimationFrame(() => {
    overlay.classList.add("show");
  });

  overlay.querySelector("[data-close-comments]")
    ?.addEventListener("click", () => {
      closeOverlay(overlay);
    });

  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) {
      closeOverlay(overlay);
    }
  });

  const form =
    overlay.querySelector(".zylo-comment-form");

  const input = form?.querySelector("input");

  form?.addEventListener("submit", (event) => {
    event.preventDefault();

    const text = input?.value.trim();

    if (!text) return;

    list.push({
      username: profile.username || "You",
      text,
      createdAt: Date.now()
    });

    comments[videoId] = list;

    setStorage(STORAGE_KEYS.comments, comments);

    updateCommentUI(page, videoId);

    closeOverlay(overlay);

    showComments(page, videoId);
  });
}


/* =========================================================
   SHARE
========================================================= */

function setupShareButton(page, videoId) {
  const button = page.querySelector(".share-btn");

  if (!button || button.dataset.ready === "true") return;

  button.dataset.ready = "true";

  button.addEventListener("click", async (event) => {
    event.stopPropagation();

    const video = page.querySelector("video");

    const shareData = {
      title: "ZYLO",
      text: "Watch this video on ZYLO",
      url: window.location.href
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(
          window.location.href
        );

        showToast("Link copied");
      }
    } catch (error) {
      if (error?.name !== "AbortError") {
        try {
          await navigator.clipboard.writeText(
            window.location.href
          );

          showToast("Link copied");
        } catch {
          showToast("Share link is ready");
        }
      }
    }
  });
}


/* =========================================================
   MUSIC
========================================================= */

function setupMusicButton(page, video) {
  const button = page.querySelector(".music-btn");

  if (!button || button.dataset.ready === "true") return;

  button.dataset.ready = "true";

  button.addEventListener("click", (event) => {
    event.stopPropagation();

    video.muted = !video.muted;

    button.classList.toggle(
      "music-muted",
      video.muted
    );

    if (video.muted) {
      showToast("Sound off");
    } else {
      video.play().catch(() => {});
      showToast("Sound on");
    }
  });
}


/* =========================================================
   FULLSCREEN
========================================================= */

function setupFullscreenButton(page) {
  const button = page.querySelector(".fullscreen-btn");

  if (!button || button.dataset.ready === "true") return;

  button.dataset.ready = "true";

  button.addEventListener("click", async (event) => {
    event.stopPropagation();

    const video = page.querySelector("video");

    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        return;
      }

      if (page.requestFullscreen) {
        await page.requestFullscreen();
        return;
      }

      if (video?.webkitEnterFullscreen) {
        video.webkitEnterFullscreen();
        return;
      }

      if (video?.requestFullscreen) {
        await video.requestFullscreen();
      }
    } catch (error) {
      console.warn("Fullscreen error:", error);
    }
  });
}


/* =========================================================
   CREATE / UPLOAD
========================================================= */

function setupUpload() {
  if (createBtn && createBtn.dataset.ready !== "true") {
    createBtn.dataset.ready = "true";

    createBtn.addEventListener("click", () => {
      openUploadModal();
    });
  }

  if (selectVideo && selectVideo.dataset.ready !== "true") {
    selectVideo.dataset.ready = "true";

    selectVideo.addEventListener("click", () => {
      videoInput?.click();
    });
  }

  if (videoInput && videoInput.dataset.ready !== "true") {
    videoInput.dataset.ready = "true";

    videoInput.addEventListener("change", handleVideoUpload);
  }

  if (closeUpload && closeUpload.dataset.ready !== "true") {
    closeUpload.dataset.ready = "true";

    closeUpload.addEventListener("click", () => {
      closeUploadModal();
    });
  }

  uploadBox?.addEventListener("click", (event) => {
    if (event.target === uploadBox) {
      closeUploadModal();
    }
  });
}

function openUploadModal() {
  if (!uploadBox) return;

  uploadBox.style.display = "flex";

  requestAnimationFrame(() => {
    uploadBox.classList.add("show");
  });
}

function closeUploadModal() {
  if (!uploadBox) return;

  uploadBox.classList.remove("show");

  setTimeout(() => {
    uploadBox.style.display = "none";
  }, 200);

  if (videoInput) {
    videoInput.value = "";
  }

  setUploadStatus("");
}

async function handleVideoUpload() {
  const file = videoInput?.files?.[0];

  if (!file) return;

  if (!file.type.startsWith("video/")) {
    setUploadStatus("Please select a video file.");
    return;
  }

  if (file.size > 200 * 1024 * 1024) {
    setUploadStatus("Maximum video size is 200 MB.");
    return;
  }

  setUploadStatus("Uploading video...");

  try {
    const formData = new FormData();

    formData.append("video", file);

    const response = await fetch(
      `${API_BASE_URL}/api/upload`,
      {
        method: "POST",
        body: formData
      }
    );

    if (!response.ok) {
      throw new Error(
        "Upload failed: " + response.status
      );
    }

    const data = await response.json();

    const videoUrl =
      data.videoUrl ||
      data.url ||
      data.fileUrl ||
      data.path;

    if (!videoUrl) {
      throw new Error("No video URL returned");
    }

    const finalUrl =
      videoUrl.startsWith("http")
        ? videoUrl
        : `${API_BASE_URL}${videoUrl.startsWith("/") ? "" : "/"}${videoUrl}`;

    saveUploadedVideo(finalUrl, file.name);

    addUploadedVideo(finalUrl, {
      fileName: file.name
    });

    setUploadStatus("Upload successful!");

    setTimeout(() => {
      closeUploadModal();
    }, 700);

  } catch (error) {
    console.error(error);

    setUploadStatus(
      "Upload failed. Please check the backend."
    );
  }
}

function setUploadStatus(message) {
  if (uploadStatus) {
    uploadStatus.textContent = message;
  }
}


/* =========================================================
   UPLOADED VIDEOS
========================================================= */

function saveUploadedVideo(url, fileName = "") {
  const list = getStorage(
    STORAGE_KEYS.uploadedVideos,
    []
  );

  list.unshift({
    url,
    fileName,
    createdAt: Date.now()
  });

  setStorage(
    STORAGE_KEYS.uploadedVideos,
    list.slice(0, 20)
  );
}

function restoreUploadedVideos() {
  const list = getStorage(
    STORAGE_KEYS.uploadedVideos,
    []
  );

  if (!list.length) return;

  list.reverse().forEach((item) => {
    if (
      item?.url &&
      !document.querySelector(
        `[data-upload-url="${escapeAttribute(item.url)}"]`
      )
    ) {
      addUploadedVideo(
        item.url,
        {
          fileName: item.fileName
        },
        true
      );
    }
  });
}

function addUploadedVideo(
  videoUrl,
  data = {},
  restoring = false
) {
  if (!videoFeed || !videoUrl) return;

  const page = document.createElement("section");

  page.className = "video-page";

  page.dataset.uploadUrl = videoUrl;

  page.innerHTML = `
    <video
      src="${escapeAttribute(videoUrl)}"
      loop
      muted
      playsinline
      preload="metadata"
    ></video>

    <div class="video-overlay"></div>

    <button
      class="fullscreen-btn"
      aria-label="Fullscreen"
    >
      <svg viewBox="0 0 24 24">
        <path d="M8 3H3v5"></path>
        <path d="M16 3h5v5"></path>
        <path d="M21 16v5h-5"></path>
        <path d="M3 16v5h5"></path>
      </svg>
    </button>

    <div class="right-actions">

      <button
        class="profile-action"
        aria-label="Profile"
      >
        <span class="profile-circle">Z</span>
        <span class="follow-badge">+</span>
      </button>

      <button
        class="action-btn like-btn"
        aria-label="Like"
        data-base-count="0"
      >
        <svg viewBox="0 0 24 24">
          <path d="M12 21S4 15.5 4 9.5C4 6.5 6.1 4 9 4c1.7 0 3 .9 3 2.3C12 4.9 13.3 4 15 4c2.9 0 5 2.5 5 5.5C20 15.5 12 21 12 21z"></path>
        </svg>
        <span class="action-count">0</span>
      </button>

      <button
        class="action-btn comment-btn"
        aria-label="Comments"
      >
        <svg viewBox="0 0 24 24">
          <path d="M20 11.5a7.5 7.5 0 0 1-8 7.5H8l-4 3v-6a7.5 7.5 0 1 1 16-4.5z"></path>
        </svg>
        <span class="action-count">0</span>
      </button>

      <button
        class="action-btn save-btn"
        aria-label="Save"
      >
        <svg viewBox="0 0 24 24">
          <path d="M6 3h12v18l-6-4-6 4V3z"></path>
        </svg>
        <span class="action-text">Save</span>
      </button>

      <button
        class="action-btn share-btn"
        aria-label="Share"
      >
        <svg viewBox="0 0 24 24">
          <path d="M21 3L10 14"></path>
          <path d="M21 3l-7 18-4-7-7-4 18-7z"></path>
        </svg>
        <span class="action-text">Share</span>
      </button>

      <button
        class="music-btn"
        aria-label="Music"
      >
        <svg viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="7"></circle>
          <circle cx="12" cy="12" r="2"></circle>
        </svg>
      </button>

    </div>

    <div class="video-info">

      <div class="username">
        @${escapeHTML(profile.username)}
        <span class="verified">✓</span>
      </div>

      <div class="caption">
        ${escapeHTML(
          data.fileName ||
          "Welcome to ZYLO"
        )}
      </div>

      <div class="caption">
        Create • Connect • Grow
      </div>

      <div class="hashtags">
        #ZYLO #CreateConnectGrow
      </div>

      <div class="music-info">
        Original sound • ZYLO
      </div>

    </div>
  `;

  page.dataset.uploadUrl = videoUrl;

  if (restoring) {
    videoFeed.appendChild(page);
  } else {
    videoFeed.prepend(page);
  }

  initializeVideoPage(page);

  if (!restoring) {
    page.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }

  setupVideoObserver();
}


/* =========================================================
   TOP TABS
========================================================= */

function setupTopTabs() {
  const tabs = document.querySelectorAll(".top-tab");

  tabs.forEach((tab) => {
    if (tab.dataset.ready === "true") return;

    tab.dataset.ready = "true";

    tab.addEventListener("click", () => {
      tabs.forEach((item) => {
        item.classList.remove("active");
      });

      tab.classList.add("active");

      const text =
        tab.textContent.trim().toLowerCase();

      if (text === "following") {
        activeFeedMode = "following";
        filterFollowingFeed();
      } else if (text === "for you") {
        activeFeedMode = "for-you";
        showAllVideos();
      } else if (text === "live") {
        activeFeedMode = "live";
        showLiveMessage();
      }
    });
  });
}

function showAllVideos() {
  document
    .querySelectorAll(".video-page")
    .forEach((page) => {
      page.style.display = "";
    });

  playVisibleVideo();
}

function filterFollowingFeed() {
  const pages =
    [...document.querySelectorAll(".video-page")];

  let found = false;

  pages.forEach((page) => {
    const id = getVideoId(page);

    if (follows[id]) {
      page.style.display = "";
      found = true;
    } else {
      page.style.display = "none";
    }
  });

  if (!found) {
    showToast("You are not following any creators yet");
    showAllVideos();
  }
}

function showLiveMessage() {
  showToast("LIVE is coming soon");
}


/* =========================================================
   SEARCH
========================================================= */

function setupSearch() {
  if (!searchBtn || searchBtn.dataset.ready === "true") {
    return;
  }

  searchBtn.dataset.ready = "true";

  searchBtn.addEventListener("click", () => {
    showSearch();
  });
}

function showSearch() {
  removeOverlay("zylo-search");

  const overlay = document.createElement("div");

  overlay.className = "zylo-overlay zylo-search";

  overlay.innerHTML = `
    <div class="zylo-panel search-panel">

      <button
        class="zylo-close"
        data-close-search
        aria-label="Close"
      >
        <svg viewBox="0 0 24 24">
          <path d="M6 6L18 18"></path>
          <path d="M18 6L6 18"></path>
        </svg>
      </button>

      <h2>Search ZYLO</h2>

      <div class="zylo-search-box">

        <svg viewBox="0 0 24 24">
          <circle cx="10.8" cy="10.8" r="6.8"></circle>
          <path d="M16 16L21 21"></path>
        </svg>

        <input
          type="search"
          placeholder="Search creators, videos..."
          autocomplete="off"
        >

      </div>

      <div class="zylo-search-results">
        Search ZYLO
      </div>

    </div>
  `;

  document.body.appendChild(overlay);

  requestAnimationFrame(() => {
    overlay.classList.add("show");
  });

  const input =
    overlay.querySelector("input");

  const results =
    overlay.querySelector(".zylo-search-results");

  input?.focus();

  input?.addEventListener("input", () => {
    const query =
      input.value.trim().toLowerCase();

    if (!query) {
      results.textContent = "Search ZYLO";
      return;
    }

    const pages =
      [...document.querySelectorAll(".video-page")];

    const matches = pages.filter((page) => {
      return page.textContent
        .toLowerCase()
        .includes(query);
    });

    results.innerHTML = matches.length
      ? `${matches.length} video${
          matches.length > 1 ? "s" : ""
        } found`
      : "No results found";
  });

  overlay.querySelector("[data-close-search]")
    ?.addEventListener("click", () => {
      closeOverlay(overlay);
    });

  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) {
      closeOverlay(overlay);
    }
  });
}


/* =========================================================
   BOTTOM NAVIGATION
========================================================= */

function setupBottomNavigation() {
  const navItems =
    document.querySelectorAll("[data-nav]");

  navItems.forEach((item) => {
    if (item.dataset.ready === "true") return;

    item.dataset.ready = "true";

    item.addEventListener("click", () => {
      const nav = item.dataset.nav;

      if (nav === "home") {
        window.scrollTo({
          top: 0,
          behavior: "smooth"
        });

        activeFeedMode = "for-you";
      }

      if (nav === "discover") {
        showSearch();
      }

      if (nav === "inbox") {
        showInbox();
      }

      if (nav === "profile") {
        showProfile();
      }
    });
  });
}


/* =========================================================
   OWN PROFILE
========================================================= */

function showProfile() {
  removeOverlay("zylo-own-profile");

  const overlay = document.createElement("div");

  overlay.className =
    "zylo-overlay zylo-own-profile";

  const followerCount =
    Number(profile.followers) || 0;

  const followingCount =
    Object.values(follows)
      .filter(Boolean).length;

  const likeCount =
    Object.values(likes)
      .filter(Boolean).length;

  overlay.innerHTML = `
    <div class="zylo-panel own-profile-panel">

      <button
        class="zylo-close"
        data-close-profile
        aria-label="Close"
      >
        <svg viewBox="0 0 24 24">
          <path d="M6 6L18 18"></path>
          <path d="M18 6L6 18"></path>
        </svg>
      </button>

      <div class="own-avatar">Z</div>

      <h2>
        ${escapeHTML(
          profile.displayName ||
          "ZYLO Creator"
        )}
      </h2>

      <div class="creator-username">
        @${escapeHTML(
          profile.username ||
          "zylo_creator"
        )}
      </div>

      <p class="creator-bio">
        ${escapeHTML(
          profile.bio ||
          "Create • Connect • Grow"
        )}
      </p>

      <div class="creator-stats">

        <div>
          <strong>${formatCount(followingCount)}</strong>
          <span>Following</span>
        </div>

        <div>
          <strong>${formatCount(followerCount)}</strong>
          <span>Followers</span>
        </div>

        <div>
          <strong>${formatCount(likeCount)}</strong>
          <span>Likes</span>
        </div>

      </div>

      <button
        class="creator-follow-button"
        data-edit-profile
      >
        Edit Profile
      </button>

    </div>
  `;

  document.body.appendChild(overlay);

  requestAnimationFrame(() => {
    overlay.classList.add("show");
  });

  overlay.querySelector("[data-close-profile]")
    ?.addEventListener("click", () => {
      closeOverlay(overlay);
    });

  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) {
      closeOverlay(overlay);
    }
  });

  overlay.querySelector("[data-edit-profile]")
    ?.addEventListener("click", () => {
      showToast("Profile editing is ready");
    });
}


/* =========================================================
   INBOX
========================================================= */

function showInbox() {
  removeOverlay("zylo-inbox");

  const overlay = document.createElement("div");

  overlay.className = "zylo-overlay zylo-inbox";

  overlay.innerHTML = `
    <div class="zylo-panel inbox-panel">

      <button
        class="zylo-close"
        data-close-inbox
        aria-label="Close"
      >
        <svg viewBox="0 0 24 24">
          <path d="M6 6L18 18"></path>
          <path d="M18 6L6 18"></path>
        </svg>
      </button>

      <h2>Inbox</h2>

      <div class="zylo-inbox-item">
        <div class="inbox-avatar">Z</div>

        <div>
          <strong>Welcome to ZYLO</strong>
          <p>Create • Connect • Grow</p>
        </div>
      </div>

      <div class="zylo-empty">
        Your notifications will appear here.
      </div>

    </div>
  `;

  document.body.appendChild(overlay);

  requestAnimationFrame(() => {
    overlay.classList.add("show");
  });

  overlay.querySelector("[data-close-inbox]")
    ?.addEventListener("click", () => {
      closeOverlay(overlay);
    });

  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) {
      closeOverlay(overlay);
    }
  });
}


/* =========================================================
   VIDEO OBSERVER
========================================================= */

let videoObserver = null;

function setupVideoObserver() {
  if (!videoFeed) return;

  if (videoObserver) {
    videoObserver.disconnect();
  }

  videoObserver =
    new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const page = entry.target;
          const video = page.querySelector("video");

          if (!video) return;

          if (
            entry.isIntersecting &&
            entry.intersectionRatio >= 0.65
          ) {
            document
              .querySelectorAll(".video-page video")
              .forEach((other) => {
                if (other !== video) {
                  other.pause();
                }
              });

            video.play().catch(() => {});
          } else {
            video.pause();
          }
        });
      },
      {
        threshold: [0, 0.65, 1]
      }
    );

  document
    .querySelectorAll(".video-page")
    .forEach((page) => {
      videoObserver.observe(page);
    });
}

function playVisibleVideo() {
  const pages =
    [...document.querySelectorAll(".video-page")];

  let bestPage = null;
  let bestRatio = 0;

  pages.forEach((page) => {
    if (page.style.display === "none") return;

    const rect = page.getBoundingClientRect();

    const visibleTop =
      Math.max(rect.top, 0);

    const visibleBottom =
      Math.min(rect.bottom, window.innerHeight);

    const visible =
      Math.max(0, visibleBottom - visibleTop);

    const ratio =
      visible / Math.max(1, rect.height);

    if (ratio > bestRatio) {
      bestRatio = ratio;
      bestPage = page;
    }
  });

  if (bestPage) {
    const video =
      bestPage.querySelector("video");

    video?.play().catch(() => {});
  }
}


/* =========================================================
   DOUBLE TAP LIKE
========================================================= */

function setupDoubleTap() {
  document
    .querySelectorAll(".video-page")
    .forEach((page) => {
      if (page.dataset.doubleTapReady === "true") {
        return;
      }

      page.dataset.doubleTapReady = "true";

      let lastTap = 0;

      page.addEventListener(
        "touchend",
        (event) => {
          const now = Date.now();

          if (now - lastTap < 300) {
            const videoId = getVideoId(page);

            likes[videoId] = true;

            setStorage(
              STORAGE_KEYS.likes,
              likes
            );

            updateLikeUI(page, videoId);

            showBigHeart(page);
          }

          lastTap = now;
        },
        { passive: true }
      );
    });
}

function showBigHeart(page) {
  const heart =
    document.createElement("div");

  heart.className = "zylo-big-heart";

  heart.innerHTML = `
    <svg viewBox="0 0 24 24">
      <path d="M12 21S4 15.5 4 9.5C4 6.5 6.1 4 9 4c1.7 0 3 .9 3 2.3C12 4.9 13.3 4 15 4c2.9 0 5 2.5 5 5.5C20 15.5 12 21 12 21z"></path>
    </svg>
  `;

  page.appendChild(heart);

  setTimeout(() => {
    heart.remove();
  }, 750);
}


/* =========================================================
   VISIBILITY
========================================================= */

document.addEventListener(
  "visibilitychange",
  () => {
    if (document.hidden) {
      document
        .querySelectorAll(".video-page video")
        .forEach((video) => video.pause());
    } else {
      playVisibleVideo();
    }
  }
);


/* =========================================================
   ESCAPE KEY
========================================================= */

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    document
      .querySelectorAll(".zylo-overlay.show")
      .forEach((overlay) => {
        closeOverlay(overlay);
      });
  }
});


/* =========================================================
   OVERLAY HELPERS
========================================================= */

function removeOverlay(className) {
  document
    .querySelectorAll("." + className)
    .forEach((element) => element.remove());
}

function closeOverlay(overlay) {
  if (!overlay) return;

  overlay.classList.remove("show");

  setTimeout(() => {
    overlay.remove();
  }, 200);
}


/* =========================================================
   TOAST
========================================================= */

function showToast(message) {
  let toast =
    document.querySelector(".zylo-toast");

  if (!toast) {
    toast = document.createElement("div");

    toast.className = "zylo-toast";

    document.body.appendChild(toast);
  }

  toast.textContent = message;

  toast.classList.add("show");

  clearTimeout(
    toast._timer
  );

  toast._timer =
    setTimeout(() => {
      toast.classList.remove("show");
    }, 1800);
}


/* =========================================================
   DYNAMIC FUNCTIONAL CSS
   Does NOT modify your existing style.css.
========================================================= */

function injectFunctionalCSS() {
  if (document.getElementById("zylo-functional-css")) {
    return;
  }

  const style =
    document.createElement("style");

  style.id = "zylo-functional-css";

  style.textContent = `

    .zylo-overlay {
      position: fixed;
      inset: 0;
      z-index: 99999;
      display: flex;
      align-items: flex-end;
      justify-content: center;
      background: rgba(0,0,0,.68);
      opacity: 0;
      visibility: hidden;
      transition: opacity .2s ease,
                  visibility .2s ease;
    }

    .zylo-overlay.show {
      opacity: 1;
      visibility: visible;
    }

    .zylo-panel {
      position: relative;
      width: min(430px, 94vw);
      max-height: 88vh;
      overflow: auto;
      padding: 28px 20px;
      border-radius: 24px 24px 0 0;
      background: #111;
      color: #fff;
      text-align: center;
      transform: translateY(30px);
      transition: transform .2s ease;
      box-sizing: border-box;
    }

    .zylo-overlay.show .zylo-panel {
      transform: translateY(0);
    }

    .zylo-sheet {
      width: min(600px, 100vw);
      max-height: 78vh;
      background: #111;
      color: #fff;
      border-radius: 22px 22px 0 0;
      overflow: hidden;
      transform: translateY(40px);
      transition: transform .2s ease;
    }

    .zylo-overlay.show .zylo-sheet {
      transform: translateY(0);
    }

    .zylo-close {
      position: absolute;
      top: 12px;
      right: 12px;
      width: 42px;
      height: 42px;
      border: 0;
      border-radius: 50%;
      background: rgba(255,255,255,.1);
      display: grid;
      place-items: center;
      cursor: pointer;
    }

    .zylo-close svg {
      width: 22px;
      height: 22px;
      fill: none;
      stroke: #fff;
      stroke-width: 2;
      stroke-linecap: round;
    }

    .creator-avatar,
    .own-avatar,
    .inbox-avatar {
      width: 82px;
      height: 82px;
      margin: 8px auto 14px;
      border-radius: 50%;
      display: grid;
      place-items: center;
      background: #222;
      color: #fff;
      font-size: 36px;
      font-weight: 800;
      border: 2px solid rgba(255,255,255,.35);
    }

    .zylo-panel h2 {
      margin: 8px 0;
    }

    .creator-username {
      opacity: .7;
      margin-bottom: 12px;
    }

    .creator-bio {
      opacity: .9;
      margin: 10px auto 20px;
      max-width: 320px;
      line-height: 1.5;
    }

    .creator-stats {
      display: flex;
      justify-content: center;
      gap: 34px;
      margin: 20px 0;
    }

    .creator-stats div {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .creator-stats strong {
      font-size: 20px;
    }

    .creator-stats span {
      font-size: 12px;
      opacity: .65;
    }

    .creator-follow-button,
    .creator-message-button {
      width: min(300px, 90%);
      min-height: 46px;
      margin: 6px auto;
      display: block;
      border: 0;
      border-radius: 10px;
      font-size: 15px;
      font-weight: 700;
      cursor: pointer;
    }

    .creator-follow-button {
      background: #fff;
      color: #000;
    }

    .creator-follow-button.following {
      background: #333;
      color: #fff;
    }

    .creator-message-button {
      background: #222;
      color: #fff;
    }

    .zylo-sheet-header {
      position: relative;
      min-height: 58px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-bottom: 1px solid rgba(255,255,255,.08);
    }

    .zylo-comment-list {
      max-height: 55vh;
      overflow-y: auto;
      padding: 14px 16px;
    }

    .zylo-comment {
      display: flex;
      gap: 10px;
      text-align: left;
      padding: 10px 0;
    }

    .zylo-comment-avatar {
      flex: 0 0 36px;
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: #222;
      display: grid;
      place-items: center;
      font-weight: 800;
    }

    .zylo-comment p {
      margin: 4px 0 0;
      opacity: .85;
      word-break: break-word;
    }

    .zylo-empty {
      padding: 35px 15px;
      text-align: center;
      opacity: .6;
    }

    .zylo-comment-form {
      display: flex;
      gap: 8px;
      padding: 12px;
      border-top: 1px solid rgba(255,255,255,.08);
      background: #111;
    }

    .zylo-comment-form input {
      min-width: 0;
      flex: 1;
      height: 44px;
      padding: 0 13px;
      border: 0;
      outline: 0;
      border-radius: 22px;
      background: #222;
      color: #fff;
    }

    .zylo-comment-form button {
      height: 44px;
      padding: 0 16px;
      border: 0;
      border-radius: 22px;
      background: #fff;
      color: #000;
      font-weight: 700;
    }

    .zylo-search {
      align-items: flex-start;
      padding-top: 70px;
    }

    .search-panel {
      border-radius: 24px;
      max-height: 80vh;
    }

    .zylo-search-box {
      display: flex;
      align-items: center;
      gap: 9px;
      margin: 20px 0;
      padding: 0 14px;
      height: 48px;
      border-radius: 24px;
      background: #222;
    }

    .zylo-search-box svg {
      width: 20px;
      height: 20px;
      fill: none;
      stroke: #fff;
      stroke-width: 2;
    }

    .zylo-search-box input {
      flex: 1;
      min-width: 0;
      border: 0;
      outline: 0;
      background: transparent;
      color: #fff;
      font-size: 15px;
    }

    .zylo-search-results {
      padding: 20px;
      opacity: .7;
    }

    .zylo-toast {
      position: fixed;
      left: 50%;
      bottom: 95px;
      z-index: 100001;
      transform: translate(-50%, 20px);
      padding: 10px 16px;
      border-radius: 22px;
      background: rgba(0,0,0,.88);
      color: #fff;
      font-size: 14px;
      opacity: 0;
      pointer-events: none;
      transition: .2s ease;
      white-space: nowrap;
    }

    .zylo-toast.show {
      opacity: 1;
      transform: translate(-50%, 0);
    }

    .zylo-big-heart {
      position: absolute;
      left: 50%;
      top: 50%;
      z-index: 50;
      transform: translate(-50%, -50%) scale(.4);
      animation: zyloHeart .75s ease forwards;
      pointer-events: none;
    }

    .zylo-big-heart svg {
      width: 110px;
      height: 110px;
      fill: #fff;
      stroke: #fff;
      stroke-width: 1;
      filter: drop-shadow(0 5px 20px rgba(0,0,0,.5));
    }

    .zylo-inbox-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 14px 8px;
      text-align: left;
      border-bottom: 1px solid rgba(255,255,255,.08);
    }

    .zylo-inbox-item .inbox-avatar {
      margin: 0;
      width: 48px;
      height: 48px;
      font-size: 20px;
    }

    .zylo-inbox-item p {
      margin: 4px 0 0;
      opacity: .65;
    }

    @keyframes zyloHeart {
      0% {
        opacity: 0;
        transform: translate(-50%, -50%) scale(.3);
      }
      20% {
        opacity: 1;
        transform: translate(-50%, -50%) scale(1.15);
      }
      70% {
        opacity: 1;
        transform: translate(-50%, -50%) scale(1);
      }
      100% {
        opacity: 0;
        transform: translate(-50%, -50%) scale(1.35);
      }
    }

    @media (max-width: 480px) {
      .creator-stats {
        gap: 22px;
      }

      .zylo-panel {
        width: 100%;
      }
    }

  `;

  document.head.appendChild(style);
}


/* =========================================================
   INITIALIZATION
========================================================= */

function initializeZYLO() {
  injectFunctionalCSS();

  initializeAllVideos();

  setupUpload();
  setupSearch();
  setupTopTabs();
  setupBottomNavigation();

  setupVideoObserver();
  setupDoubleTap();

  setTimeout(() => {
    playVisibleVideo();
  }, 400);
}


/* =========================================================
   START
========================================================= */

if (document.readyState === "loading") {
  document.addEventListener(
    "DOMContentLoaded",
    initializeZYLO
  );
} else {
  initializeZYLO();
}
