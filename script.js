"use strict";

/* =========================================================
   ZYLO — STABLE FUNCTION SYSTEM
   index.html + style.css untouched
========================================================= */

const API_BASE_URL =
  "https://zylo-backend-ec5c.onrender.com";

const CDN_VIDEO_URL =
  "https://cdn.jsdelivr.net/gh/golammostofa89076-sys/zylo@main/backend/uploads/video1.mp4";


/* =========================================================
   STORAGE
========================================================= */

const STORAGE_KEYS = {
  likes: "zylo_likes",
  saves: "zylo_saves",
  follows: "zylo_follows",
  comments: "zylo_comments",
  profile: "zylo_profile",
  uploadedVideos: "zylo_uploaded_videos"
};

function readStorage(key, fallback) {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : fallback;
  } catch {
    return fallback;
  }
}

function writeStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn("ZYLO storage error:", error);
  }
}


/* =========================================================
   STATE
========================================================= */

const state = {
  likes: readStorage(STORAGE_KEYS.likes, {}),
  saves: readStorage(STORAGE_KEYS.saves, {}),
  follows: readStorage(STORAGE_KEYS.follows, {}),
  comments: readStorage(STORAGE_KEYS.comments, {}),
  profile: readStorage(STORAGE_KEYS.profile, {
    username: "zylo_creator",
    displayName: "ZYLO Creator",
    bio: "Create • Connect • Grow"
  }),
  uploadedVideos: readStorage(
    STORAGE_KEYS.uploadedVideos,
    []
  ),
  feedMode: "for-you"
};


/* =========================================================
   DOM
========================================================= */

const videoFeed =
  document.getElementById("videoFeed");

const createBtn =
  document.getElementById("createBtn");

const videoInput =
  document.getElementById("videoInput");

const uploadBox =
  document.getElementById("uploadBox");

const closeUpload =
  document.getElementById("closeUpload");

const selectVideo =
  document.getElementById("selectVideo");

const uploadStatus =
  document.getElementById("uploadStatus");

const searchBtn =
  document.querySelector(".search-btn");


/* =========================================================
   BASIC HELPERS
========================================================= */

function formatCount(number) {
  const n = Number(number) || 0;

  if (n >= 1000000000) {
    return (
      (n / 1000000000)
        .toFixed(1)
        .replace(".0", "") + "B"
    );
  }

  if (n >= 1000000) {
    return (
      (n / 1000000)
        .toFixed(1)
        .replace(".0", "") + "M"
    );
  }

  if (n >= 1000) {
    return (
      (n / 1000)
        .toFixed(1)
        .replace(".0", "") + "K"
    );
  }

  return String(n);
}

function escapeHTML(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getVideoId(page) {
  if (!page.dataset.videoId) {
    page.dataset.videoId =
      "zylo_" +
      Date.now() +
      "_" +
      Math.random()
        .toString(36)
        .slice(2, 9);
  }

  return page.dataset.videoId;
}


/* =========================================================
   CREATOR ID
========================================================= */

function getCreatorId(page) {
  const usernameElement =
    page.querySelector(".username");

  let username =
    usernameElement?.textContent?.trim() ||
    "zylo_creator";

  username = username
    .replace("✓", "")
    .trim()
    .replace(/^@/, "");

  return (
    username.toLowerCase() ||
    "zylo_creator"
  );
}


/* =========================================================
   INITIALIZE ALL
========================================================= */

function initializeZYLO() {
  injectFunctionalCSS();

  initializeVideos();
  setupTopTabs();
  setupBottomNavigation();
  setupUpload();
  setupSearch();
  setupVisibility();
  setupGlobalEscape();

  setupObserver();

  setTimeout(() => {
    playVisibleVideo();
  }, 500);
}


/* =========================================================
   VIDEO INITIALIZATION
========================================================= */

function initializeVideos() {
  if (!videoFeed) return;

  const pages =
    videoFeed.querySelectorAll(".video-page");

  pages.forEach((page) => {
    initializeVideo(page);
  });

  restoreUploadedVideos();
}

function initializeVideo(page) {
  if (!page) return;

  if (page.dataset.zyloInitialized === "true") {
    return;
  }

  page.dataset.zyloInitialized = "true";

  const video =
    page.querySelector("video");

  if (!video) return;

  const videoId =
    getVideoId(page);

  video.loop = true;
  video.playsInline = true;

  /*
    Feed videos start muted so mobile browsers
    allow autoplay.
  */
  video.muted = true;

  setupVideoFallback(video);
  setupVideoTap(video);

  setupLike(page, videoId);
  setupSave(page, videoId);
  setupComment(page, videoId);
  setupShare(page);
  setupCreatorProfile(page);
  setupMusic(page, video);
  setupFullscreen(page);

  updateLike(page, videoId);
  updateSave(page, videoId);
  updateFollowBadge(page);
  updateCommentCount(page, videoId);
}


/* =========================================================
   VIDEO FALLBACK
========================================================= */

function setupVideoFallback(video) {
  if (video.dataset.fallbackReady === "true") {
    return;
  }

  video.dataset.fallbackReady = "true";

  video.addEventListener("error", () => {
    if (
      video.dataset.cdnFallback === "true"
    ) {
      return;
    }

    video.dataset.cdnFallback = "true";

    const source =
      video.currentSrc ||
      video.src ||
      "";

    if (!source.includes("jsdelivr")) {
      video.src = CDN_VIDEO_URL;
      video.load();

      video.play().catch(() => {});
    }
  });
}


/* =========================================================
   VIDEO TAP
========================================================= */

function setupVideoTap(video) {
  if (video.dataset.tapReady === "true") {
    return;
  }

  video.dataset.tapReady = "true";

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

function setupLike(page, videoId) {
  const button =
    page.querySelector(".like-btn");

  if (!button) return;

  if (button.dataset.ready === "true") {
    return;
  }

  button.dataset.ready = "true";

  button.addEventListener("click", (event) => {
    event.stopPropagation();

    state.likes[videoId] =
      !state.likes[videoId];

    writeStorage(
      STORAGE_KEYS.likes,
      state.likes
    );

    updateLike(page, videoId);
  });
}

function updateLike(page, videoId) {
  const button =
    page.querySelector(".like-btn");

  if (!button) return;

  const count =
    button.querySelector(".action-count");

  const base =
    Number(button.dataset.baseCount || 0);

  const liked =
    !!state.likes[videoId];

  button.classList.toggle(
    "active",
    liked
  );

  if (count) {
    count.textContent =
      formatCount(
        base + (liked ? 1 : 0)
      );
  }
}


/* =========================================================
   DOUBLE TAP LIKE
========================================================= */

function setupDoubleTap(page) {
  if (
    page.dataset.doubleTapReady === "true"
  ) {
    return;
  }

  page.dataset.doubleTapReady = "true";

  let lastTap = 0;

  page.addEventListener(
    "touchend",
    () => {
      const now = Date.now();

      if (now - lastTap < 300) {
        const videoId =
          getVideoId(page);

        state.likes[videoId] = true;

        writeStorage(
          STORAGE_KEYS.likes,
          state.likes
        );

        updateLike(page, videoId);

        showBigHeart(page);
      }

      lastTap = now;
    },
    { passive: true }
  );
}


/* =========================================================
   SAVE
========================================================= */

function setupSave(page, videoId) {
  const button =
    page.querySelector(".save-btn");

  if (!button) return;

  if (button.dataset.ready === "true") {
    return;
  }

  button.dataset.ready = "true";

  button.addEventListener("click", (event) => {
    event.stopPropagation();

    state.saves[videoId] =
      !state.saves[videoId];

    writeStorage(
      STORAGE_KEYS.saves,
      state.saves
    );

    updateSave(page, videoId);
  });
}

function updateSave(page, videoId) {
  const button =
    page.querySelector(".save-btn");

  if (!button) return;

  const text =
    button.querySelector(".action-text");

  const saved =
    !!state.saves[videoId];

  button.classList.toggle(
    "active",
    saved
  );

  if (text) {
    text.textContent =
      saved ? "Saved" : "Save";
  }
}


/* =========================================================
   FOLLOW
========================================================= */

function updateFollowBadge(page) {
  const badge =
    page.querySelector(".follow-badge");

  if (!badge) return;

  const creatorId =
    getCreatorId(page);

  badge.textContent =
    state.follows[creatorId]
      ? "✓"
      : "+";
}

function toggleCreatorFollow(
  creatorId,
  page = null
) {
  state.follows[creatorId] =
    !state.follows[creatorId];

  writeStorage(
    STORAGE_KEYS.follows,
    state.follows
  );

  /*
    Update every video belonging to
    the same creator.
  */
  document
    .querySelectorAll(".video-page")
    .forEach((item) => {
      if (
        getCreatorId(item) === creatorId
      ) {
        updateFollowBadge(item);
      }
    });

  if (page) {
    updateFollowBadge(page);
  }

  return state.follows[creatorId];
}


/* =========================================================
   CREATOR PROFILE — Z+
========================================================= */

function setupCreatorProfile(page) {
  const button =
    page.querySelector(
      ".profile-action"
    );

  if (!button) return;

  if (button.dataset.ready === "true") {
    return;
  }

  button.dataset.ready = "true";

  button.addEventListener("click", (event) => {
    event.stopPropagation();

    showCreatorProfile(page);
  });
}

function showCreatorProfile(page) {
  removeOverlay(
    ".zylo-creator-profile"
  );

  const creatorId =
    getCreatorId(page);

  const usernameElement =
    page.querySelector(".username");

  let username =
    usernameElement?.textContent?.trim() ||
    "@zylo_creator";

  username =
    username
      .replace("✓", "")
      .trim();

  const cleanUsername =
    username.replace(/^@/, "");

  const caption =
    page.querySelector(".caption")
      ?.textContent
      ?.trim() ||
    "Create • Connect • Grow";

  const following =
    !!state.follows[creatorId];

  const overlay =
    document.createElement("div");

  overlay.className =
    "zylo-overlay zylo-creator-profile";

  overlay.innerHTML = `
    <div class="zylo-panel creator-panel">

      <button
        class="zylo-close"
        data-close
        aria-label="Close"
      >
        <svg viewBox="0 0 24 24">
          <path d="M6 6L18 18"></path>
          <path d="M18 6L6 18"></path>
        </svg>
      </button>

      <div class="creator-avatar">Z</div>

      <h2>
        ${escapeHTML(cleanUsername)}
      </h2>

      <div class="creator-username">
        @${escapeHTML(cleanUsername)}
      </div>

      <p class="creator-bio">
        ${escapeHTML(caption)}
      </p>

      <div class="creator-stats">

        <div>
          <strong>0</strong>
          <span>Following</span>
        </div>

        <div>
          <strong>0</strong>
          <span>Followers</span>
        </div>

        <div>
          <strong>0</strong>
          <span>Likes</span>
        </div>

      </div>

      <button
        class="creator-follow-button ${
          following ? "following" : ""
        }"
        data-follow
      >
        ${
          following
            ? "Following"
            : "Follow"
        }
      </button>

      <button
        class="creator-message-button"
        data-message
      >
        Message
      </button>

    </div>
  `;

  document.body.appendChild(overlay);

  requestAnimationFrame(() => {
    overlay.classList.add("show");
  });

  overlay
    .querySelector("[data-close]")
    ?.addEventListener(
      "click",
      () => closeOverlay(overlay)
    );

  overlay.addEventListener(
    "click",
    (event) => {
      if (event.target === overlay) {
        closeOverlay(overlay);
      }
    }
  );

  overlay
    .querySelector("[data-follow]")
    ?.addEventListener(
      "click",
      () => {
        const result =
          toggleCreatorFollow(
            creatorId,
            page
          );

        const followButton =
          overlay.querySelector(
            "[data-follow]"
          );

        if (followButton) {
          followButton.textContent =
            result
              ? "Following"
              : "Follow";

          followButton.classList.toggle(
            "following",
            result
          );
        }

        showToast(
          result
            ? "Following creator"
            : "Unfollowed"
        );
      }
    );

  overlay
    .querySelector("[data-message]")
    ?.addEventListener(
      "click",
      () => {
        showToast(
          "Messaging is ready"
        );
      }
    );
}


/* =========================================================
   COMMENTS
========================================================= */

function getComments(videoId) {
  if (
    !Array.isArray(
      state.comments[videoId]
    )
  ) {
    state.comments[videoId] = [];
  }

  return state.comments[videoId];
}

function setupComment(page, videoId) {
  const button =
    page.querySelector(".comment-btn");

  if (!button) {
    return;
  }

  if (button.dataset.ready === "true") {
    return;
  }

  button.dataset.ready = "true";

  button.addEventListener("click", (event) => {
    event.stopPropagation();

    showComments(page, videoId);
  });
}

function updateCommentCount(
  page,
  videoId
) {
  const button =
    page.querySelector(".comment-btn");

  if (!button) return;

  const count =
    button.querySelector(".action-count");

  if (count) {
    count.textContent =
      formatCount(
        getComments(videoId).length
      );
  }
}

function showComments(page, videoId) {
  removeOverlay(
    ".zylo-comments"
  );

  const list =
    getComments(videoId);

  const overlay =
    document.createElement("div");

  overlay.className =
    "zylo-overlay zylo-comments";

  overlay.innerHTML = `
    <div class="zylo-sheet">

      <div class="zylo-sheet-header">

        <strong>
          Comments
        </strong>

        <button
          class="zylo-close"
          data-close
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
            ? list
                .map(
                  (comment) => `
                    <div class="zylo-comment">

                      <div class="zylo-comment-avatar">
                        Z
                      </div>

                      <div>
                        <strong>
                          ${escapeHTML(
                            comment.username ||
                              "You"
                          )}
                        </strong>

                        <p>
                          ${escapeHTML(
                            comment.text
                          )}
                        </p>
                      </div>

                    </div>
                  `
                )
                .join("")
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

  overlay
    .querySelector("[data-close]")
    ?.addEventListener(
      "click",
      () => closeOverlay(overlay)
    );

  overlay.addEventListener(
    "click",
    (event) => {
      if (event.target === overlay) {
        closeOverlay(overlay);
      }
    }
  );

  const form =
    overlay.querySelector(
      ".zylo-comment-form"
    );

  const input =
    form?.querySelector("input");

  input?.focus();

  form?.addEventListener(
    "submit",
    (event) => {
      event.preventDefault();

      const text =
        input.value.trim();

      if (!text) return;

      list.push({
        username:
          state.profile.username ||
          "You",
        text,
        createdAt: Date.now()
      });

      state.comments[videoId] =
        list;

      writeStorage(
        STORAGE_KEYS.comments,
        state.comments
      );

      updateCommentCount(
        page,
        videoId
      );

      closeOverlay(overlay);

      showComments(
        page,
        videoId
      );
    }
  );
}


/* =========================================================
   SHARE
========================================================= */

function setupShare(page) {
  const button =
    page.querySelector(".share-btn");

  if (!button) return;

  if (button.dataset.ready === "true") {
    return;
  }

  button.dataset.ready = "true";

  button.addEventListener(
    "click",
    async (event) => {
      event.stopPropagation();

      const data = {
        title: "ZYLO",
        text: "Watch this video on ZYLO",
        url: window.location.href
      };

      try {
        if (navigator.share) {
          await navigator.share(data);
          return;
        }

        await copyText(
          window.location.href
        );

        showToast("Link copied");
      } catch (error) {
        if (
          error?.name !==
          "AbortError"
        ) {
          showToast(
            "Unable to share"
          );
        }
      }
    }
  );
}

async function copyText(text) {
  if (
    navigator.clipboard &&
    window.isSecureContext
  ) {
    await navigator.clipboard.writeText(
      text
    );
    return;
  }

  const textarea =
    document.createElement("textarea");

  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";

  document.body.appendChild(
    textarea
  );

  textarea.select();

  document.execCommand("copy");

  textarea.remove();
}


/* =========================================================
   MUSIC
========================================================= */

function setupMusic(page, video) {
  const button =
    page.querySelector(".music-btn");

  if (!button) return;

  if (button.dataset.ready === "true") {
    return;
  }

  button.dataset.ready = "true";

  button.addEventListener("click", (event) => {
    event.stopPropagation();

    video.muted =
      !video.muted;

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

function setupFullscreen(page) {
  const button =
    page.querySelector(
      ".fullscreen-btn"
    );

  if (!button) return;

  if (button.dataset.ready === "true") {
    return;
  }

  button.dataset.ready = "true";

  button.addEventListener(
    "click",
    async (event) => {
      event.stopPropagation();

      const video =
        page.querySelector("video");

      try {
        if (document.fullscreenElement) {
          await document.exitFullscreen();
          return;
        }

        if (page.requestFullscreen) {
          await page.requestFullscreen();
          return;
        }

        if (
          video &&
          video.webkitEnterFullscreen
        ) {
          video.webkitEnterFullscreen();
          return;
        }

        if (
          video &&
          video.requestFullscreen
        ) {
          await video.requestFullscreen();
        }

      } catch (error) {
        console.warn(
          "Fullscreen error:",
          error
        );
      }
    }
  );
}


/* =========================================================
   TOP TABS
========================================================= */

function setupTopTabs() {
  document
    .querySelectorAll(".top-tab")
    .forEach((tab) => {

      if (
        tab.dataset.ready === "true"
      ) {
        return;
      }

      tab.dataset.ready = "true";

      tab.addEventListener(
        "click",
        () => {

          document
            .querySelectorAll(
              ".top-tab"
            )
            .forEach((item) => {
              item.classList.remove(
                "active"
              );
            });

          tab.classList.add("active");

          const name =
            tab.textContent
              .trim()
              .toLowerCase();

          if (name === "following") {
            state.feedMode =
              "following";

            showFollowingFeed();
          }

          else if (name === "for you") {
            state.feedMode =
              "for-you";

            showAllFeed();
          }

          else if (name === "live") {
            state.feedMode =
              "live";

            showToast(
              "LIVE is coming soon"
            );
          }
        }
      );
    });
}


/* =========================================================
   FEED FILTER
========================================================= */

function showAllFeed() {
  document
    .querySelectorAll(".video-page")
    .forEach((page) => {
      page.style.display = "";
    });

  playVisibleVideo();
}

function showFollowingFeed() {
  let found = false;

  document
    .querySelectorAll(".video-page")
    .forEach((page) => {

      const creatorId =
        getCreatorId(page);

      const visible =
        !!state.follows[creatorId];

      page.style.display =
        visible ? "" : "none";

      if (visible) {
        found = true;
      }
    });

  if (!found) {
    showToast(
      "Follow creators to see their videos"
    );

    setTimeout(() => {
      showAllFeed();
    }, 500);
  }
}


/* =========================================================
   SEARCH
========================================================= */

function setupSearch() {
  if (!searchBtn) return;

  if (searchBtn.dataset.ready === "true") {
    return;
  }

  searchBtn.dataset.ready = "true";

  searchBtn.addEventListener(
    "click",
    showSearch
  );
}

function showSearch() {
  removeOverlay(
    ".zylo-search"
  );

  const overlay =
    document.createElement("div");

  overlay.className =
    "zylo-overlay zylo-search";

  overlay.innerHTML = `
    <div class="zylo-panel search-panel">

      <button
        class="zylo-close"
        data-close
        aria-label="Close"
      >
        <svg viewBox="0 0 24 24">
          <path d="M6 6L18 18"></path>
          <path d="M18 6L6 18"></path>
        </svg>
      </button>

      <h2>
        Search ZYLO
      </h2>

      <div class="zylo-search-box">

        <svg viewBox="0 0 24 24">
          <circle
            cx="10.8"
            cy="10.8"
            r="6.8"
          ></circle>

          <path
            d="M16 16L21 21"
          ></path>
        </svg>

        <input
          type="search"
          placeholder="Search creators, videos..."
          autocomplete="off"
        >

      </div>

      <div class="zylo-search-results">
        Search creators or videos
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
    overlay.querySelector(
      ".zylo-search-results"
    );

  input?.focus();

  input?.addEventListener(
    "input",
    () => {

      const query =
        input.value
          .trim()
          .toLowerCase();

      if (!query) {
        results.textContent =
          "Search creators or videos";
        return;
      }

      const pages =
        [
          ...document.querySelectorAll(
            ".video-page"
          )
        ];

      const matches =
        pages.filter((page) =>
          page.textContent
            .toLowerCase()
            .includes(query)
        );

      results.textContent =
        matches.length
          ? `${matches.length} video${
              matches.length > 1
                ? "s"
                : ""
            } found`
          : "No results found";
    }
  );

  overlay
    .querySelector("[data-close]")
    ?.addEventListener(
      "click",
      () => closeOverlay(overlay)
    );

  overlay.addEventListener(
    "click",
    (event) => {
      if (event.target === overlay) {
        closeOverlay(overlay);
      }
    }
  );
}


/* =========================================================
   BOTTOM NAV
========================================================= */

function setupBottomNavigation() {
  document
    .querySelectorAll("[data-nav]")
    .forEach((item) => {

      if (
        item.dataset.ready === "true"
      ) {
        return;
      }

      item.dataset.ready = "true";

      item.addEventListener(
        "click",
        () => {

          const nav =
            item.dataset.nav;

          if (nav === "home") {
            showAllFeed();

            window.scrollTo({
              top: 0,
              behavior: "smooth"
            });
          }

          if (nav === "discover") {
            showSearch();
          }

          if (nav === "inbox") {
            showInbox();
          }

          if (nav === "profile") {
            showOwnProfile();
          }
        }
      );
    });
}


/* =========================================================
   OWN PROFILE
========================================================= */

function showOwnProfile() {
  removeOverlay(
    ".zylo-own-profile"
  );

  const followingCount =
    Object.values(
      state.follows
    ).filter(Boolean).length;

  const likedCount =
    Object.values(
      state.likes
    ).filter(Boolean).length;

  const overlay =
    document.createElement("div");

  overlay.className =
    "zylo-overlay zylo-own-profile";

  overlay.innerHTML = `
    <div class="zylo-panel own-profile-panel">

      <button
        class="zylo-close"
        data-close
        aria-label="Close"
      >
        <svg viewBox="0 0 24 24">
          <path d="M6 6L18 18"></path>
          <path d="M18 6L6 18"></path>
        </svg>
      </button>

      <div class="own-avatar">
        Z
      </div>

      <h2>
        ${escapeHTML(
          state.profile.displayName ||
          "ZYLO Creator"
        )}
      </h2>

      <div class="creator-username">
        @${escapeHTML(
          state.profile.username ||
          "zylo_creator"
        )}
      </div>

      <p class="creator-bio">
        ${escapeHTML(
          state.profile.bio ||
          "Create • Connect • Grow"
        )}
      </p>

      <div class="creator-stats">

        <div>
          <strong>
            ${formatCount(
              followingCount
            )}
          </strong>
          <span>Following</span>
        </div>

        <div>
          <strong>0</strong>
          <span>Followers</span>
        </div>

        <div>
          <strong>
            ${formatCount(
              likedCount
            )}
          </strong>
          <span>Likes</span>
        </div>

      </div>

      <button
        class="creator-follow-button"
        data-edit
      >
        Edit Profile
      </button>

    </div>
  `;

  document.body.appendChild(overlay);

  requestAnimationFrame(() => {
    overlay.classList.add("show");
  });

  overlay
    .querySelector("[data-close]")
    ?.addEventListener(
      "click",
      () => closeOverlay(overlay)
    );

  overlay.addEventListener(
    "click",
    (event) => {
      if (event.target === overlay) {
        closeOverlay(overlay);
      }
    }
  );

  overlay
    .querySelector("[data-edit]")
    ?.addEventListener(
      "click",
      () => {
        showToast(
          "Profile editing is ready"
        );
      }
    );
}


/* =========================================================
   INBOX
========================================================= */

function showInbox() {
  removeOverlay(
    ".zylo-inbox"
  );

  const overlay =
    document.createElement("div");

  overlay.className =
    "zylo-overlay zylo-inbox";

  overlay.innerHTML = `
    <div class="zylo-panel inbox-panel">

      <button
        class="zylo-close"
        data-close
        aria-label="Close"
      >
        <svg viewBox="0 0 24 24">
          <path d="M6 6L18 18"></path>
          <path d="M18 6L6 18"></path>
        </svg>
      </button>

      <h2>
        Inbox
      </h2>

      <div class="zylo-inbox-item">

        <div class="inbox-avatar">
          Z
        </div>

        <div>
          <strong>
            Welcome to ZYLO
          </strong>

          <p>
            Create • Connect • Grow
          </p>
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

  overlay
    .querySelector("[data-close]")
    ?.addEventListener(
      "click",
      () => closeOverlay(overlay)
    );

  overlay.addEventListener(
    "click",
    (event) => {
      if (event.target === overlay) {
        closeOverlay(overlay);
      }
    }
  );
}


/* =========================================================
   UPLOAD
========================================================= */

function setupUpload() {
  createBtn?.addEventListener(
    "click",
    openUpload,
    { once: true }
  );

  selectVideo?.addEventListener(
    "click",
    () => {
      videoInput?.click();
    }
  );

  videoInput?.addEventListener(
    "change",
    uploadVideo
  );

  closeUpload?.addEventListener(
    "click",
    closeUploadModal
  );

  uploadBox?.addEventListener(
    "click",
    (event) => {
      if (event.target === uploadBox) {
        closeUploadModal();
      }
    }
  );
}

function openUpload() {
  if (!uploadBox) return;

  uploadBox.style.display =
    "flex";

  requestAnimationFrame(() => {
    uploadBox.classList.add("show");
  });
}

function closeUploadModal() {
  if (!uploadBox) return;

  uploadBox.classList.remove(
    "show"
  );

  setTimeout(() => {
    uploadBox.style.display =
      "none";
  }, 200);

  if (videoInput) {
    videoInput.value = "";
  }

  setUploadStatus("");
}

async function uploadVideo() {
  const file =
    videoInput?.files?.[0];

  if (!file) return;

  if (
    !file.type.startsWith("video/")
  ) {
    setUploadStatus(
      "Please select a video file."
    );
    return;
  }

  if (
    file.size >
    200 * 1024 * 1024
  ) {
    setUploadStatus(
      "Maximum video size is 200 MB."
    );
    return;
  }

  setUploadStatus(
    "Uploading video..."
  );

  try {
    const formData =
      new FormData();

    formData.append(
      "video",
      file
    );

    const response =
      await fetch(
        `${API_BASE_URL}/api/upload`,
        {
          method: "POST",
          body: formData
        }
      );

    if (!response.ok) {
      throw new Error(
        "Upload failed"
      );
    }

    const data =
      await response.json();

    const returnedUrl =
      data.videoUrl ||
      data.url ||
      data.fileUrl ||
      data.path;

    if (!returnedUrl) {
      throw new Error(
        "Video URL missing"
      );
    }

    const videoUrl =
      returnedUrl.startsWith("http")
        ? returnedUrl
        : `${API_BASE_URL}${
            returnedUrl.startsWith("/")
              ? ""
              : "/"
          }${returnedUrl}`;

    saveUploadedVideo(
      videoUrl,
      file.name
    );

    addUploadedVideo(
      videoUrl,
      file.name
    );

    setUploadStatus(
      "Upload successful!"
    );

    setTimeout(
      closeUploadModal,
      700
    );

  } catch (error) {
    console.error(error);

    setUploadStatus(
      "Upload failed. Please try again."
    );
  }
}

function setUploadStatus(message) {
  if (uploadStatus) {
    uploadStatus.textContent =
      message;
  }
}


/* =========================================================
   UPLOADED VIDEO STORAGE
========================================================= */

function saveUploadedVideo(
  url,
  fileName
) {
  state.uploadedVideos.unshift({
    url,
    fileName,
    createdAt: Date.now()
  });

  state.uploadedVideos =
    state.uploadedVideos
      .slice(0, 20);

  writeStorage(
    STORAGE_KEYS.uploadedVideos,
    state.uploadedVideos
  );
}

function restoreUploadedVideos() {
  if (!videoFeed) return;

  const videos =
    [...state.uploadedVideos]
      .reverse();

  videos.forEach((item) => {
    if (!item?.url) return;

    const alreadyExists =
      [
        ...document.querySelectorAll(
          ".video-page"
        )
      ].some(
        (page) =>
          page.dataset.uploadUrl ===
          item.url
      );

    if (!alreadyExists) {
      addUploadedVideo(
        item.url,
        item.fileName,
        true
      );
    }
  });
}

function addUploadedVideo(
  url,
  fileName = "Welcome to ZYLO",
  restoring = false
) {
  if (!videoFeed) return;

  const page =
    document.createElement("section");

  page.className =
    "video-page";

  page.dataset.uploadUrl =
    url;

  page.innerHTML = `
    <video
      src="${escapeHTML(url)}"
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
        <span class="profile-circle">
          Z
        </span>

        <span class="follow-badge">
          +
        </span>
      </button>

      <button
        class="action-btn like-btn"
        aria-label="Like"
        data-base-count="0"
      >
        <svg viewBox="0 0 24 24">
          <path d="M12 21S4 15.5 4 9.5C4 6.5 6.1 4 9 4c1.7 0 3 .9 3 2.3C12 4.9 13.3 4 15 4c2.9 0 5 2.5 5 5.5C20 15.5 12 21 12 21z"></path>
        </svg>

        <span class="action-count">
          0
        </span>
      </button>

      <button
        class="action-btn comment-btn"
        aria-label="Comments"
      >
        <svg viewBox="0 0 24 24">
          <path d="M20 11.5a7.5 7.5 0 0 1-8 7.5H8l-4 3v-6a7.5 7.5 0 1 1 16-4.5z"></path>
        </svg>

        <span class="action-count">
          0
        </span>
      </button>

      <button
        class="action-btn save-btn"
        aria-label="Save"
      >
        <svg viewBox="0 0 24 24">
          <path d="M6 3h12v18l-6-4-6 4V3z"></path>
        </svg>

        <span class="action-text">
          Save
        </span>
      </button>

      <button
        class="action-btn share-btn"
        aria-label="Share"
      >
        <svg viewBox="0 0 24 24">
          <path d="M21 3L10 14"></path>
          <path d="M21 3l-7 18-4-7-7-4 18-7z"></path>
        </svg>

        <span class="action-text">
          Share
        </span>
      </button>

      <button
        class="music-btn"
        aria-label="Music"
      >
        <svg viewBox="0 0 24 24">
          <circle
            cx="12"
            cy="12"
            r="7"
          ></circle>

          <circle
            cx="12"
            cy="12"
            r="2"
          ></circle>
        </svg>
      </button>

    </div>

    <div class="video-info">

      <div class="username">
        @${escapeHTML(
          state.profile.username ||
          "zylo_creator"
        )}
        <span class="verified">
          ✓
        </span>
      </div>

      <div class="caption">
        ${escapeHTML(fileName)}
      </div>

      <div class="caption">
        Create • Connect • Grow
      </div>

      <div class="hashtags">
        #ZYLO #Create #Connect #Grow
      </div>

      <div class="music-info">
        Original sound - ZYLO
      </div>

    </div>
  `;

  if (restoring) {
    videoFeed.appendChild(page);
  } else {
    videoFeed.prepend(page);
  }

  initializeVideo(page);
  setupDoubleTap(page);

  if (!restoring) {
    page.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }

  setupObserver();
}


/* =========================================================
   INTERSECTION OBSERVER
========================================================= */

let observer = null;

function setupObserver() {
  if (!videoFeed) return;

  if (observer) {
    observer.disconnect();
  }

  observer =
    new IntersectionObserver(
      (entries) => {

        entries.forEach((entry) => {

          const video =
            entry.target.querySelector(
              "video"
            );

          if (!video) return;

          if (
            entry.isIntersecting &&
            entry.intersectionRatio >=
              0.65
          ) {

            document
              .querySelectorAll(
                ".video-page video"
              )
              .forEach((other) => {
                if (
                  other !== video
                ) {
                  other.pause();
                }
              });

            video.play().catch(
              () => {}
            );

          } else {
            video.pause();
          }
        });
      },
      {
        threshold: [
          0,
          0.65,
          1
        ]
      }
    );

  document
    .querySelectorAll(
      ".video-page"
    )
    .forEach((page) => {
      observer.observe(page);

      setupDoubleTap(page);
    });
}

function playVisibleVideo() {
  let best = null;
  let bestRatio = 0;

  document
    .querySelectorAll(
      ".video-page"
    )
    .forEach((page) => {

      if (
        page.style.display ===
        "none"
      ) {
        return;
      }

      const rect =
        page.getBoundingClientRect();

      const top =
        Math.max(
          rect.top,
          0
        );

      const bottom =
        Math.min(
          rect.bottom,
          window.innerHeight
        );

      const visible =
        Math.max(
          0,
          bottom - top
        );

      const ratio =
        visible /
        Math.max(
          1,
          rect.height
        );

      if (ratio > bestRatio) {
        bestRatio = ratio;
        best = page;
      }
    });

  if (best) {
    const video =
      best.querySelector("video");

    video?.play().catch(
      () => {}
    );
  }
}


/* =========================================================
   VISIBILITY
========================================================= */

function setupVisibility() {
  document.addEventListener(
    "visibilitychange",
    () => {

      if (document.hidden) {

        document
          .querySelectorAll(
            ".video-page video"
          )
          .forEach((video) => {
            video.pause();
          });

      } else {
        playVisibleVideo();
      }
    }
  );
}


/* =========================================================
   BIG HEART
========================================================= */

function showBigHeart(page) {
  const heart =
    document.createElement("div");

  heart.className =
    "zylo-big-heart";

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
   OVERLAY
========================================================= */

function removeOverlay(selector) {
  document
    .querySelectorAll(selector)
    .forEach((element) => {
      element.remove();
    });
}

function closeOverlay(overlay) {
  if (!overlay) return;

  overlay.classList.remove(
    "show"
  );

  setTimeout(() => {
    overlay.remove();
  }, 200);
}

function setupGlobalEscape() {
  document.addEventListener(
    "keydown",
    (event) => {

      if (
        event.key !== "Escape"
      ) {
        return;
      }

      document
        .querySelectorAll(
          ".zylo-overlay.show"
        )
        .forEach((overlay) => {
          closeOverlay(overlay);
        });
    }
  );
}


/* =========================================================
   TOAST
========================================================= */

function showToast(message) {
  let toast =
    document.querySelector(
      ".zylo-toast"
    );

  if (!toast) {
    toast =
      document.createElement(
        "div"
      );

    toast.className =
      "zylo-toast";

    document.body.appendChild(
      toast
    );
  }

  toast.textContent =
    message;

  toast.classList.add(
    "show"
  );

  clearTimeout(
    toast._timer
  );

  toast._timer =
    setTimeout(() => {
      toast.classList.remove(
        "show"
      );
    }, 1800);
}


/* =========================================================
   FUNCTIONAL CSS
   Does NOT change style.css.
========================================================= */

function injectFunctionalCSS() {
  if (
    document.getElementById(
      "zylo-functional-css"
    )
  ) {
    return;
  }

  const style =
    document.createElement("style");

  style.id =
    "zylo-functional-css";

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
      transition:
        opacity .2s ease,
        visibility .2s ease;
    }

    .zylo-overlay.show {
      opacity: 1;
      visibility: visible;
    }

    .zylo-panel {
      position: relative;
      width: min(430px,94vw);
      max-height: 88vh;
      overflow-y: auto;
      padding: 28px 20px;
      box-sizing: border-box;
      border-radius: 24px 24px 0 0;
      background: #111;
      color: #fff;
      text-align: center;
      transform: translateY(30px);
      transition: transform .2s ease;
    }

    .zylo-overlay.show
    .zylo-panel {
      transform: translateY(0);
    }

    .zylo-sheet {
      width: min(600px,100vw);
      max-height: 78vh;
      background: #111;
      color: #fff;
      border-radius: 22px 22px 0 0;
      overflow: hidden;
      transform: translateY(40px);
      transition: transform .2s ease;
    }

    .zylo-overlay.show
    .zylo-sheet {
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
    .own-avatar {
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

    .creator-stats {
      display: flex;
      justify-content: center;
      gap: 30px;
      margin: 20px 0;
    }

    .creator-stats div {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .creator-stats span {
      font-size: 12px;
      opacity: .65;
    }

    .creator-follow-button,
    .creator-message-button {
      width: min(300px,90%);
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
    }

    .zylo-comment-form input {
      flex: 1;
      min-width: 0;
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
    }

    .zylo-search-box {
      display: flex;
      align-items: center;
      gap: 9px;
      height: 48px;
      margin: 20px 0;
      padding: 0 14px;
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
      transform:
        translate(-50%,20px);
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
      transform:
        translate(-50%,0);
    }

    .zylo-big-heart {
      position: absolute;
      left: 50%;
      top: 50%;
      z-index: 50;
      pointer-events: none;
      transform:
        translate(-50%,-50%)
        scale(.4);
      animation:
        zyloHeart .75s ease forwards;
    }

    .zylo-big-heart svg {
      width: 110px;
      height: 110px;
      fill: #fff;
      stroke: #fff;
      stroke-width: 1;
    }

    .zylo-inbox-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 14px 8px;
      text-align: left;
      border-bottom:
        1px solid rgba(255,255,255,.08);
    }

    .inbox-avatar {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      display: grid;
      place-items: center;
      background: #222;
      font-weight: 800;
    }

    @keyframes zyloHeart {
      0% {
        opacity: 0;
        transform:
          translate(-50%,-50%)
          scale(.3);
      }

      20% {
        opacity: 1;
        transform:
          translate(-50%,-50%)
          scale(1.15);
      }

      70% {
        opacity: 1;
        transform:
          translate(-50%,-50%)
          scale(1);
      }

      100% {
        opacity: 0;
        transform:
          translate(-50%,-50%)
          scale(1.35);
      }
    }

    @media (max-width:480px) {

      .creator-stats {
        gap: 20px;
      }

      .zylo-panel {
        width: 100%;
      }

    }

  `;

  document.head.appendChild(
    style
  );
}


/* =========================================================
   START
========================================================= */

if (
  document.readyState ===
  "loading"
) {
  document.addEventListener(
    "DOMContentLoaded",
    initializeZYLO
  );
} else {
  initializeZYLO();
}

/* =========================================================
   ZYLO CREATOR PROFILE
   Right-side Z+ opens Creator Profile
========================================================= */

function showCreatorProfile(page) {

    // Remove previous creator profile
    const oldProfile =
        document.getElementById("zyloCreatorProfile");

    if (oldProfile) {
        oldProfile.remove();
    }

    const profile =
        page.querySelector(".profile-action");

    const creatorName =
        page.querySelector(".video-username");

    const username =
        creatorName
            ? creatorName.textContent.trim()
            : "@zylo_creator";

    const creatorProfile = document.createElement("div");

    creatorProfile.id = "zyloCreatorProfile";

    creatorProfile.innerHTML = `
        <div class="zylo-creator-backdrop"></div>

        <div class="zylo-creator-panel">

            <button
                class="zylo-creator-close"
                aria-label="Close"
            >
                <svg viewBox="0 0 24 24">
                    <path d="M6 6L18 18"></path>
                    <path d="M18 6L6 18"></path>
                </svg>
            </button>

            <div class="zylo-creator-avatar">
                Z
            </div>

            <h2>ZYLO Creator ✓</h2>

            <p class="zylo-creator-username">
                ${username}
            </p>

            <p class="zylo-creator-bio">
                Create • Connect • Grow
            </p>

            <div class="zylo-creator-stats">

                <div>
                    <strong>1</strong>
                    <span>Following</span>
                </div>

                <div>
                    <strong>0</strong>
                    <span>Followers</span>
                </div>

                <div>
                    <strong>5</strong>
                    <span>Likes</span>
                </div>

            </div>

            <button
                class="zylo-creator-follow"
                type="button"
            >
                Follow
            </button>

        </div>
    `;

    document.body.appendChild(creatorProfile);

    /* -----------------------------------------
       Follow state
    ----------------------------------------- */

    const followButton =
        creatorProfile.querySelector(
            ".zylo-creator-follow"
        );

    const profileKey =
        username.toLowerCase();

    const followed =
        follows[profileKey] === true;

    if (followed) {
        followButton.textContent = "Following";
        followButton.classList.add("following");
    }

    followButton.addEventListener(
        "click",
        function () {

            const currentlyFollowing =
                follows[profileKey] === true;

            follows[profileKey] =
                !currentlyFollowing;

            setStorage(
                STORAGE_KEYS.follows,
                follows
            );

            if (follows[profileKey]) {

                followButton.textContent =
                    "Following";

                followButton.classList.add(
                    "following"
                );

            } else {

                followButton.textContent =
                    "Follow";

                followButton.classList.remove(
                    "following"
                );
            }

            // Update Z+ badge
            const badge =
                profile
                    ? profile.querySelector(
                        ".follow-badge"
                    )
                    : null;

            if (badge) {
                badge.textContent =
                    follows[profileKey]
                        ? "✓"
                        : "+";
            }
        }
    );

    /* -----------------------------------------
       Close button
    ----------------------------------------- */

    const closeButton =
        creatorProfile.querySelector(
            ".zylo-creator-close"
        );

    const backdrop =
        creatorProfile.querySelector(
            ".zylo-creator-backdrop"
        );

    function closeCreatorProfile() {
        creatorProfile.remove();
    }

    closeButton.addEventListener(
        "click",
        closeCreatorProfile
    );

    backdrop.addEventListener(
        "click",
        closeCreatorProfile
    );

    /* -----------------------------------------
       ESC key
    ----------------------------------------- */

    document.addEventListener(
        "keydown",
        function creatorEscape(event) {

            if (event.key === "Escape") {
                closeCreatorProfile();

                document.removeEventListener(
                    "keydown",
                    creatorEscape
                );
            }
        }
    );
}


/* =========================================================
   Z+ CLICK HANDLER
   Works for existing AND newly uploaded videos
========================================================= */

document.addEventListener(
    "click",
    function (event) {

        const profileButton =
            event.target.closest(
                ".video-page .profile-action"
            );

        if (!profileButton) {
            return;
        }

        const page =
            profileButton.closest(
                ".video-page"
            );

        if (!page) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();

        showCreatorProfile(page);
    },
    true
);


/* =========================================================
   CREATOR PROFILE STYLE
   Added automatically — style.css stays unchanged
========================================================= */

(function addCreatorProfileStyle() {

    if (
        document.getElementById(
            "zyloCreatorProfileStyle"
        )
    ) {
        return;
    }

    const style =
        document.createElement("style");

    style.id =
        "zyloCreatorProfileStyle";

    style.textContent = `

        #zyloCreatorProfile {
            position: fixed;
            inset: 0;
            z-index: 99999;
            display: flex;
            align-items: flex-end;
            justify-content: center;
            font-family: Arial, sans-serif;
        }

        .zylo-creator-backdrop {
            position: absolute;
            inset: 0;
            background: rgba(0,0,0,.72);
        }

        .zylo-creator-panel {
            position: relative;
            z-index: 2;
            width: min(100%, 520px);
            background: #111;
            color: #fff;
            border-radius: 28px 28px 0 0;
            padding: 34px 24px 42px;
            text-align: center;
            box-sizing: border-box;
            animation: zyloCreatorUp .25s ease;
        }

        @keyframes zyloCreatorUp {
            from {
                transform: translateY(100%);
            }
            to {
                transform: translateY(0);
            }
        }

        .zylo-creator-close {
            position: absolute;
            top: 18px;
            right: 18px;
            width: 48px;
            height: 48px;
            border: 0;
            border-radius: 50%;
            background: #292929;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .zylo-creator-close svg {
            width: 25px;
            height: 25px;
            fill: none;
            stroke: #fff;
            stroke-width: 2.2;
            stroke-linecap: round;
        }

        .zylo-creator-avatar {
            width: 112px;
            height: 112px;
            margin: 12px auto 18px;
            border-radius: 50%;
            background: #222;
            border: 3px solid #777;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 54px;
            font-weight: 700;
        }

        .zylo-creator-panel h2 {
            margin: 0 0 7px;
            font-size: 27px;
        }

        .zylo-creator-username {
            margin: 0;
            font-size: 18px;
            opacity: .85;
        }

        .zylo-creator-bio {
            margin: 12px 0 25px;
            font-size: 18px;
        }

        .zylo-creator-stats {
            display: flex;
            justify-content: center;
            gap: 45px;
            margin-bottom: 28px;
        }

        .zylo-creator-stats div {
            display: flex;
            flex-direction: column;
            gap: 6px;
        }

        .zylo-creator-stats strong {
            font-size: 22px;
        }

        .zylo-creator-stats span {
            font-size: 14px;
            opacity: .7;
        }

        .zylo-creator-follow {
            width: 100%;
            height: 54px;
            border: 0;
            border-radius: 12px;
            background: #fff;
            color: #111;
            font-size: 18px;
            font-weight: 700;
        }

        .zylo-creator-follow.following {
            background: #333;
            color: #fff;
        }

        @media (max-width: 480px) {

            .zylo-creator-panel {
                padding-left: 20px;
                padding-right: 20px;
            }

            .zylo-creator-stats {
                gap: 28px;
            }
        }
    `;

    document.head.appendChild(style);

})();
