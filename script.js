/* =========================================================
   ZYLO — FINAL SCRIPT
   Feed + Swipe + Auto Play/Pause + Actions + Profiles + Upload
   ========================================================= */

"use strict";

/* =========================
   CONFIG
========================= */

const API_BASE_URL = "https://zylo-backend-ec5c.onrender.com";

const DEFAULT_VIDEO_URL = "./backend/uploads/video1.mp4";

const CDN_VIDEO_URL =
  "https://cdn.jsdelivr.net/gh/golammostofa89076-sys/zylo@main/backend/uploads/video1.mp4";

const STORAGE_KEYS = {
  likes: "zylo_likes",
  saves: "zylo_saves",
  follows: "zylo_follows",
  comments: "zylo_comments",
  uploaded: "zylo_uploaded_videos"
};

const PROFILE = {
  username: "@zylo_creator",
  name: "ZYLO Creator",
  bio: "Create • Connect • Grow"
};


/* =========================
   STORAGE HELPERS
========================= */

function getStorage(key, fallback) {
  try {
    const value = localStorage.getItem(key);

    if (!value) {
      return fallback;
    }

    return JSON.parse(value);
  } catch (error) {
    console.warn("Storage read error:", key, error);
    return fallback;
  }
}

function setStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn("Storage write error:", key, error);
  }
}


/* =========================
   DOM HELPERS
========================= */

function $(selector, parent = document) {
  return parent.querySelector(selector);
}

function $$(selector, parent = document) {
  return Array.from(parent.querySelectorAll(selector));
}

function getVideoFeed() {
  return $(".video-feed");
}

function getVideoPages() {
  const feed = getVideoFeed();

  if (!feed) {
    return [];
  }

  return $$(".video-page", feed);
}

function getVideoId(page) {
  if (!page) {
    return "";
  }

  return (
    page.dataset.videoId ||
    page.id ||
    `video-${getVideoPages().indexOf(page) + 1}`
  );
}


/* =========================
   TOAST
========================= */

function showToast(message) {
  let toast = $(".zylo-toast");

  if (!toast) {
    toast = document.createElement("div");
    toast.className = "zylo-toast";

    Object.assign(toast.style, {
      position: "fixed",
      left: "50%",
      bottom: "90px",
      transform: "translateX(-50%)",
      zIndex: "99999",
      padding: "10px 16px",
      borderRadius: "20px",
      background: "rgba(0,0,0,.82)",
      color: "#fff",
      fontSize: "14px",
      pointerEvents: "none",
      opacity: "0",
      transition: "opacity .2s ease"
    });

    document.body.appendChild(toast);
  }

  toast.textContent = message;
  toast.style.opacity = "1";

  clearTimeout(toast._timer);

  toast._timer = setTimeout(() => {
    toast.style.opacity = "0";
  }, 1800);
}


/* =========================
   VIDEO SOURCE
========================= */

function getVideoElement(page) {
  return page ? $("video", page) : null;
}

function setupVideoSource(video) {
  if (!video) {
    return;
  }

  if (!video.dataset.originalSrc) {
    const source = $("source", video);

    video.dataset.originalSrc =
      video.getAttribute("src") ||
      (source ? source.getAttribute("src") : "") ||
      DEFAULT_VIDEO_URL;
  }

  video.muted = true;
  video.playsInline = true;
  video.setAttribute("playsinline", "");
  video.setAttribute("webkit-playsinline", "");
}

function setupVideoFallback(video) {
  if (!video || video.dataset.fallbackReady === "1") {
    return;
  }

  video.dataset.fallbackReady = "1";

  video.addEventListener("error", () => {
    if (video.dataset.cdnTried === "1") {
      return;
    }

    video.dataset.cdnTried = "1";

    const source = $("source", video);

    if (source) {
      source.src = CDN_VIDEO_URL;
    }

    video.src = CDN_VIDEO_URL;
    video.load();
  });
}

function initializeVideos() {
  $$("video").forEach(video => {
    setupVideoSource(video);
    setupVideoFallback(video);

    video.muted = true;
    video.playsInline = true;
    video.preload = "metadata";
  });
}


/* =========================
   AUTOPLAY / PAUSE
========================= */

function playVideo(video) {
  if (!video) {
    return;
  }

  video.muted = true;

  const promise = video.play();

  if (promise && typeof promise.catch === "function") {
    promise.catch(() => {
      // Browser autoplay restriction — harmless.
    });
  }
}

function pauseVideo(video) {
  if (!video) {
    return;
  }

  try {
    video.pause();
  } catch (error) {
    console.warn("Video pause error:", error);
  }
}

function pauseAllVideos(exceptVideo = null) {
  $$("video").forEach(video => {
    if (video !== exceptVideo) {
      pauseVideo(video);
    }
  });
}

function activatePage(page) {
  if (!page) {
    return;
  }

  const video = getVideoElement(page);

  pauseAllVideos(video);

  if (video) {
    playVideo(video);
  }

  $$(".video-page").forEach(item => {
    item.classList.toggle("active", item === page);
  });
}


/* =========================
   NEXT / PREVIOUS VIDEO
========================= */

let feedNavigationLocked = false;

function getCurrentPageIndex() {
  const pages = getVideoPages();

  if (!pages.length) {
    return -1;
  }

  const feed = getVideoFeed();

  if (!feed) {
    return 0;
  }

  const center = feed.scrollTop + feed.clientHeight / 2;

  let closestIndex = 0;
  let closestDistance = Infinity;

  pages.forEach((page, index) => {
    const centerOfPage =
      page.offsetTop + page.offsetHeight / 2;

    const distance = Math.abs(centerOfPage - center);

    if (distance < closestDistance) {
      closestDistance = distance;
      closestIndex = index;
    }
  });

  return closestIndex;
}

function goToPage(index, smooth = true) {
  const pages = getVideoPages();

  if (!pages.length) {
    return;
  }

  const safeIndex = Math.max(
    0,
    Math.min(index, pages.length - 1)
  );

  const page = pages[safeIndex];

  if (!page) {
    return;
  }

  feedNavigationLocked = true;

  page.scrollIntoView({
    behavior: smooth ? "smooth" : "auto",
    block: "start"
  });

  activatePage(page);

  clearTimeout(goToPage._timer);

  goToPage._timer = setTimeout(() => {
    feedNavigationLocked = false;
  }, smooth ? 650 : 100);
}

function goNextVideo() {
  const pages = getVideoPages();

  if (!pages.length) {
    return;
  }

  const currentIndex = getCurrentPageIndex();

  if (currentIndex < pages.length - 1) {
    goToPage(currentIndex + 1);
  } else {
    showToast("আর কোনো ভিডিও নেই");
  }
}

function goPreviousVideo() {
  const pages = getVideoPages();

  if (!pages.length) {
    return;
  }

  const currentIndex = getCurrentPageIndex();

  if (currentIndex > 0) {
    goToPage(currentIndex - 1);
  }
}


/* =========================
   TOUCH SWIPE
========================= */

function initializeSwipeNavigation() {
  const feed = getVideoFeed();

  if (!feed || feed.dataset.swipeReady === "1") {
    return;
  }

  feed.dataset.swipeReady = "1";

  let startX = 0;
  let startY = 0;
  let startTime = 0;
  let tracking = false;

  feed.addEventListener(
    "touchstart",
    event => {
      if (!event.touches || !event.touches[0]) {
        return;
      }

      const touch = event.touches[0];

      startX = touch.clientX;
      startY = touch.clientY;
      startTime = Date.now();
      tracking = true;
    },
    { passive: true }
  );

  feed.addEventListener(
    "touchend",
    event => {
      if (!tracking || !event.changedTouches[0]) {
        return;
      }

      tracking = false;

      if (feedNavigationLocked) {
        return;
      }

      const touch = event.changedTouches[0];

      const deltaX = touch.clientX - startX;
      const deltaY = touch.clientY - startY;

      const elapsed = Date.now() - startTime;

      const verticalDistance = Math.abs(deltaY);
      const horizontalDistance = Math.abs(deltaX);

      if (
        verticalDistance < 50 ||
        verticalDistance < horizontalDistance ||
        elapsed > 1000
      ) {
        return;
      }

      if (deltaY < 0) {
        goNextVideo();
      } else {
        goPreviousVideo();
      }
    },
    { passive: true }
  );
}


/* =========================
   MOUSE WHEEL
========================= */

function initializeWheelNavigation() {
  const feed = getVideoFeed();

  if (!feed || feed.dataset.wheelReady === "1") {
    return;
  }

  feed.dataset.wheelReady = "1";

  let wheelTimer = null;

  feed.addEventListener(
    "wheel",
    event => {
      if (Math.abs(event.deltaY) < 10) {
        return;
      }

      event.preventDefault();

      if (feedNavigationLocked) {
        return;
      }

      clearTimeout(wheelTimer);

      wheelTimer = setTimeout(() => {
        if (event.deltaY > 0) {
          goNextVideo();
        } else {
          goPreviousVideo();
        }
      }, 30);
    },
    { passive: false }
  );
}


/* =========================
   KEYBOARD NAVIGATION
========================= */

function initializeKeyboardNavigation() {
  if (document.body.dataset.keyboardReady === "1") {
    return;
  }

  document.body.dataset.keyboardReady = "1";

  document.addEventListener("keydown", event => {
    const tag = document.activeElement
      ? document.activeElement.tagName
      : "";

    if (
      tag === "INPUT" ||
      tag === "TEXTAREA" ||
      tag === "SELECT"
    ) {
      return;
    }

    if (event.key === "ArrowDown" || event.key === "PageDown") {
      event.preventDefault();
      goNextVideo();
    }

    if (event.key === "ArrowUp" || event.key === "PageUp") {
      event.preventDefault();
      goPreviousVideo();
    }
  });
}


/* =========================
   OBSERVER
========================= */

function initializeVideoObserver() {
  const feed = getVideoFeed();

  if (!feed || feed.dataset.observerReady === "1") {
    return;
  }

  feed.dataset.observerReady = "1";

  const observer = new IntersectionObserver(
    entries => {
      entries.forEach(entry => {
        const page = entry.target;
        const video = getVideoElement(page);

        if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
          activatePage(page);
        } else {
          pauseVideo(video);
        }
      });
    },
    {
      root: feed,
      threshold: [0.25, 0.6, 0.8]
    }
  );

  getVideoPages().forEach(page => {
    observer.observe(page);
  });

  feed._videoObserver = observer;
}


/* =========================
   LIKE
========================= */

function initializeLike(page) {
  if (!page || page.dataset.likeReady === "1") {
    return;
  }

  const button =
    $(".like-action", page) ||
    $(".like-button", page) ||
    $('[data-action="like"]', page);

  if (!button) {
    return;
  }

  page.dataset.likeReady = "1";

  button.addEventListener("click", event => {
    event.stopPropagation();

    const id = getVideoId(page);
    const likes = getStorage(STORAGE_KEYS.likes, {});

    likes[id] = likes[id] ? 0 : 1;

    setStorage(STORAGE_KEYS.likes, likes);

    updateLikeButton(page);
  });

  updateLikeButton(page);
}

function updateLikeButton(page) {
  if (!page) {
    return;
  }

  const button =
    $(".like-action", page) ||
    $(".like-button", page) ||
    $('[data-action="like"]', page);

  if (!button) {
    return;
  }

  const id = getVideoId(page);
  const likes = getStorage(STORAGE_KEYS.likes, {});
  const liked = !!likes[id];

  button.classList.toggle("active", liked);
  button.setAttribute("aria-pressed", String(liked));

  const count =
    $(".like-count", button) ||
    $(".count", button);

  if (count) {
    count.textContent = liked ? "1" : "0";
  }
}


/* =========================
   SAVE
========================= */

function initializeSave(page) {
  if (!page || page.dataset.saveReady === "1") {
    return;
  }

  const button =
    $(".save-action", page) ||
    $(".save-button", page) ||
    $('[data-action="save"]', page);

  if (!button) {
    return;
  }

  page.dataset.saveReady = "1";

  button.addEventListener("click", event => {
    event.stopPropagation();

    const id = getVideoId(page);
    const saves = getStorage(STORAGE_KEYS.saves, {});

    saves[id] = saves[id] ? 0 : 1;

    setStorage(STORAGE_KEYS.saves, saves);

    updateSaveButton(page);

    showToast(saves[id] ? "Saved" : "Removed from saved");
  });

  updateSaveButton(page);
}

function updateSaveButton(page) {
  const button =
    $(".save-action", page) ||
    $(".save-button", page) ||
    $('[data-action="save"]', page);

  if (!button) {
    return;
  }

  const id = getVideoId(page);
  const saves = getStorage(STORAGE_KEYS.saves, {});
  const saved = !!saves[id];

  button.classList.toggle("active", saved);
  button.setAttribute("aria-pressed", String(saved));
}


/* =========================
   COMMENTS
========================= */

function initializeComment(page) {
  if (!page || page.dataset.commentReady === "1") {
    return;
  }

  const button =
    $(".comment-action", page) ||
    $(".comment-button", page) ||
    $('[data-action="comment"]', page);

  if (!button) {
    return;
  }

  page.dataset.commentReady = "1";

  button.addEventListener("click", event => {
    event.stopPropagation();

    const id = getVideoId(page);
    openCommentPanel(id);
  });
}

function openCommentPanel(videoId) {
  let overlay = $(".zylo-comment-overlay");

  if (!overlay) {
    overlay = document.createElement("div");
    overlay.className = "zylo-comment-overlay";

    Object.assign(overlay.style, {
      position: "fixed",
      inset: "0",
      zIndex: "100000",
      background: "rgba(0,0,0,.65)",
      display: "flex",
      alignItems: "flex-end"
    });

    const panel = document.createElement("div");

    Object.assign(panel.style, {
      width: "100%",
      maxHeight: "70vh",
      background: "#111",
      color: "#fff",
      borderRadius: "18px 18px 0 0",
      padding: "18px",
      boxSizing: "border-box"
    });

    panel.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:15px;">
        <strong>Comments</strong>
        <button type="button" class="zylo-close-comments"
          style="background:none;border:0;color:#fff;font-size:24px;">
          ×
        </button>
      </div>

      <div class="zylo-comments-list"
        style="max-height:35vh;overflow:auto;margin-bottom:12px;">
      </div>

      <div style="display:flex;gap:8px;">
        <input
          class="zylo-comment-input"
          type="text"
          placeholder="Add a comment..."
          style="flex:1;padding:12px;border-radius:20px;border:0;"
        >

        <button
          type="button"
          class="zylo-send-comment"
          style="padding:10px 15px;border:0;border-radius:20px;"
        >
          Send
        </button>
      </div>
    `;

    overlay.appendChild(panel);
    document.body.appendChild(overlay);

    $(".zylo-close-comments", overlay).addEventListener(
      "click",
      () => overlay.remove()
    );

    overlay.addEventListener("click", event => {
      if (event.target === overlay) {
        overlay.remove();
      }
    });
  }

  const comments = getStorage(
    STORAGE_KEYS.comments,
    {}
  );

  const list = $(".zylo-comments-list", overlay);
  const input = $(".zylo-comment-input", overlay);
  const send = $(".zylo-send-comment", overlay);

  const render = () => {
    const items = comments[videoId] || [];

    if (!items.length) {
      list.innerHTML =
        '<div style="opacity:.6;text-align:center;padding:20px;">No comments yet</div>';
      return;
    }

    list.innerHTML = items
      .map(
        item => `
          <div style="padding:10px 0;border-bottom:1px solid #333;">
            ${escapeHTML(item)}
          </div>
        `
      )
      .join("");
  };

  const submit = () => {
    const text = input.value.trim();

    if (!text) {
      return;
    }

    if (!comments[videoId]) {
      comments[videoId] = [];
    }

    comments[videoId].push(text);

    setStorage(STORAGE_KEYS.comments, comments);

    input.value = "";
    render();
  };

  send.onclick = submit;

  input.onkeydown = event => {
    if (event.key === "Enter") {
      event.preventDefault();
      submit();
    }
  };

  render();
}

function escapeHTML(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


/* =========================
   SHARE
========================= */

function initializeShare(page) {
  if (!page || page.dataset.shareReady === "1") {
    return;
  }

  const button =
    $(".share-action", page) ||
    $(".share-button", page) ||
    $('[data-action="share"]', page);

  if (!button) {
    return;
  }

  page.dataset.shareReady = "1";

  button.addEventListener("click", async event => {
    event.stopPropagation();

    const url = window.location.href;

    try {
      if (navigator.share) {
        await navigator.share({
          title: "ZYLO",
          text: "Check out this video on ZYLO",
          url
        });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(url);
        showToast("Link copied");
      } else {
        showToast("Share link: " + url);
      }
    } catch (error) {
      // User cancelled share.
    }
  });
}


/* =========================
   MUSIC
========================= */

function initializeMusic(page) {
  if (!page || page.dataset.musicReady === "1") {
    return;
  }

  const button =
    $(".music-action", page) ||
    $(".music-button", page) ||
    $('[data-action="music"]', page);

  if (!button) {
    return;
  }

  page.dataset.musicReady = "1";

  button.addEventListener("click", event => {
    event.stopPropagation();

    const video = getVideoElement(page);

    if (!video) {
      return;
    }

    video.muted = !video.muted;

    button.classList.toggle("active", !video.muted);

    showToast(video.muted ? "Sound off" : "Sound on");
  });
}


/* =========================
   FULLSCREEN
========================= */

function initializeFullscreen(page) {
  if (!page || page.dataset.fullscreenReady === "1") {
    return;
  }

  const button =
    $(".fullscreen-action", page) ||
    $(".fullscreen-button", page) ||
    $('[data-action="fullscreen"]', page);

  if (!button) {
    return;
  }

  page.dataset.fullscreenReady = "1";

  button.addEventListener("click", async event => {
    event.stopPropagation();

    try {
      if (!document.fullscreenElement) {
        await page.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (error) {
      showToast("Fullscreen unavailable");
    }
  });
}


/* =========================
   DOUBLE TAP LIKE
========================= */

function initializeDoubleTap(page) {
  if (!page || page.dataset.doubleTapReady === "1") {
    return;
  }

  const video = getVideoElement(page);

  if (!video) {
    return;
  }

  page.dataset.doubleTapReady = "1";

  let lastTap = 0;

  video.addEventListener("click", event => {
    const now = Date.now();

    if (now - lastTap < 320) {
      const id = getVideoId(page);
      const likes = getStorage(STORAGE_KEYS.likes, {});

      if (!likes[id]) {
        likes[id] = 1;
        setStorage(STORAGE_KEYS.likes, likes);
        updateLikeButton(page);
        showHeartAnimation(page);
      }

      lastTap = 0;
      return;
    }

    lastTap = now;
  });
}

function showHeartAnimation(page) {
  const heart = document.createElement("div");

  heart.textContent = "♥";

  Object.assign(heart.style, {
    position: "absolute",
    left: "50%",
    top: "50%",
    transform: "translate(-50%, -50%) scale(.5)",
    fontSize: "90px",
    color: "#fff",
    zIndex: "500",
    pointerEvents: "none",
    transition: "transform .25s ease, opacity .35s ease",
    opacity: "1"
  });

  page.appendChild(heart);

  requestAnimationFrame(() => {
    heart.style.transform =
      "translate(-50%, -50%) scale(1.15)";
  });

  setTimeout(() => {
    heart.style.opacity = "0";
    heart.style.transform =
      "translate(-50%, -50%) scale(1.4)";
  }, 220);

  setTimeout(() => {
    heart.remove();
  }, 600);
}


/* =========================
   PROFILE BUTTON
========================= */

function initializeProfileButton(page) {
  if (!page || page.dataset.profileReady === "1") {
    return;
  }

  const button = $(".profile-action", page);

  if (!button) {
    return;
  }

  page.dataset.profileReady = "1";

  button.addEventListener("click", event => {
    event.stopPropagation();

    openCreatorProfile(getVideoId(page));
  });
}

function getFollowState() {
  return getStorage(STORAGE_KEYS.follows, {});
}

function isFollowing(username = PROFILE.username) {
  const follows = getFollowState();
  return !!follows[username];
}

function toggleFollow(username = PROFILE.username) {
  const follows = getFollowState();

  follows[username] = !follows[username];

  setStorage(STORAGE_KEYS.follows, follows);

  updateProfileButtons();

  return follows[username];
}

function updateProfileButtons() {
  const following = isFollowing();

  $$(".profile-action").forEach(button => {
    const badge =
      $(".follow-badge", button) ||
      $(".follow-plus", button);

    if (badge) {
      badge.textContent = following ? "✓" : "+";
    }

    button.classList.toggle("following", following);
  });
}


/* =========================
   PROFILE STATS
========================= */

function getProfileStats() {
  const follows = getStorage(
    STORAGE_KEYS.follows,
    {}
  );

  const likes = getStorage(
    STORAGE_KEYS.likes,
    {}
  );

  const uploaded = getStorage(
    STORAGE_KEYS.uploaded,
    []
  );

  let totalLikes = Object.values(likes)
    .filter(Boolean)
    .reduce((sum, value) => {
      return sum + (Number(value) || 0);
    }, 0);

  if (totalLikes === 0) {
    totalLikes = 5;
  }

  return {
    following: Object.values(follows)
      .filter(Boolean).length,

    followers: 0,

    likes: totalLikes,

    videos: Math.max(
      2,
      getVideoPages().length,
      uploaded.length + 2
    )
  };
}


/* =========================
   CREATOR PROFILE
========================= */

function openCreatorProfile(videoId) {
  closeProfileOverlay();

  const overlay = document.createElement("div");

  overlay.className = "zylo-profile-overlay";

  Object.assign(overlay.style, {
    position: "fixed",
    inset: "0",
    zIndex: "99998",
    background: "rgba(0,0,0,.72)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "20px",
    boxSizing: "border-box"
  });

  const card = document.createElement("div");

  Object.assign(card.style, {
    width: "min(420px, 100%)",
    maxHeight: "90vh",
    overflow: "auto",
    background: "#111",
    color: "#fff",
    borderRadius: "20px",
    padding: "24px",
    boxSizing: "border-box",
    textAlign: "center"
  });

  const stats = getProfileStats();

  const following = isFollowing();

  card.innerHTML = `
    <button
      class="zylo-profile-close"
      type="button"
      style="
        float:right;
        background:none;
        border:0;
        color:#fff;
        font-size:28px;
      "
    >×</button>

    <div style="clear:both;"></div>

    <div
      style="
        width:80px;
        height:80px;
        margin:10px auto 14px;
        border-radius:50%;
        background:#222;
        display:flex;
        align-items:center;
        justify-content:center;
        font-size:34px;
        font-weight:700;
      "
    >Z</div>

    <h2 style="margin:0 0 6px;">
      ${PROFILE.name} ✓
    </h2>

    <div style="opacity:.7;margin-bottom:8px;">
      ${PROFILE.username}
    </div>

    <div style="margin-bottom:22px;">
      ${PROFILE.bio}
    </div>

    <div
      style="
        display:flex;
        justify-content:space-around;
        margin-bottom:20px;
      "
    >
      <div>
        <strong>${stats.following}</strong>
        <div style="opacity:.65;font-size:13px;">Following</div>
      </div>

      <div>
        <strong>${stats.followers}</strong>
        <div style="opacity:.65;font-size:13px;">Followers</div>
      </div>

      <div>
        <strong>${stats.likes}</strong>
        <div style="opacity:.65;font-size:13px;">Likes</div>
      </div>
    </div>

    <button
      type="button"
      class="zylo-follow-profile"
      style="
        width:100%;
        padding:12px;
        border:0;
        border-radius:12px;
        font-weight:700;
        margin-bottom:20px;
      "
    >
      ${following ? "Following" : "Follow"}
    </button>

    <h3 style="text-align:left;margin:10px 0;">
      Videos
    </h3>

    <div
      class="zylo-profile-video-grid"
      style="
        display:grid;
        grid-template-columns:repeat(3,1fr);
        gap:5px;
      "
    ></div>
  `;

  overlay.appendChild(card);
  document.body.appendChild(overlay);

  $(".zylo-profile-close", card).onclick =
    closeProfileOverlay;

  $(".zylo-follow-profile", card).onclick = () => {
    const state = toggleFollow(PROFILE.username);

    $(".zylo-follow-profile", card).textContent =
      state ? "Following" : "Follow";
  };

  overlay.addEventListener("click", event => {
    if (event.target === overlay) {
      closeProfileOverlay();
    }
  });

  renderProfileVideos(
    $(".zylo-profile-video-grid", card)
  );
}

function renderProfileVideos(grid) {
  if (!grid) {
    return;
  }

  const pages = getVideoPages();

  grid.innerHTML = "";

  pages.forEach((page, index) => {
    const video = getVideoElement(page);

    if (!video) {
      return;
    }

    const item = document.createElement("div");

    Object.assign(item.style, {
      aspectRatio: "9 / 16",
      background: "#222",
      overflow: "hidden",
      borderRadius: "5px",
      cursor: "pointer"
    });

    const preview = document.createElement("video");

    const source =
      video.currentSrc ||
      video.src ||
      video.dataset.originalSrc ||
      DEFAULT_VIDEO_URL;

    preview.src = source;
    preview.muted = true;
    preview.playsInline = true;
    preview.preload = "metadata";

    Object.assign(preview.style, {
      width: "100%",
      height: "100%",
      objectFit: "cover"
    });

    item.appendChild(preview);

    item.onclick = () => {
      closeProfileOverlay();

      setTimeout(() => {
        goToPage(index);
      }, 100);
    };

    grid.appendChild(item);
  });
}

function closeProfileOverlay() {
  const overlay = $(".zylo-profile-overlay");

  if (overlay) {
    overlay.remove();
  }
}


/* =========================
   MY PROFILE
========================= */

function openOwnProfile() {
  closeProfileOverlay();

  const overlay = document.createElement("div");

  overlay.className = "zylo-profile-overlay";

  Object.assign(overlay.style, {
    position: "fixed",
    inset: "0",
    zIndex: "99998",
    background: "rgba(0,0,0,.72)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "20px",
    boxSizing: "border-box"
  });

  const card = document.createElement("div");

  Object.assign(card.style, {
    width: "min(420px, 100%)",
    maxHeight: "90vh",
    overflow: "auto",
    background: "#111",
    color: "#fff",
    borderRadius: "20px",
    padding: "24px",
    boxSizing: "border-box",
    textAlign: "center"
  });

  const stats = getProfileStats();

  card.innerHTML = `
    <button
      type="button"
      class="zylo-profile-close"
      style="
        float:right;
        background:none;
        border:0;
        color:#fff;
        font-size:28px;
      "
    >×</button>

    <div style="clear:both;"></div>

    <div
      style="
        width:80px;
        height:80px;
        margin:10px auto 14px;
        border-radius:50%;
        background:#222;
        display:flex;
        align-items:center;
        justify-content:center;
        font-size:34px;
        font-weight:700;
      "
    >Z</div>

    <h2 style="margin:0 0 6px;">
      ${PROFILE.name}
    </h2>

    <div style="opacity:.7;margin-bottom:8px;">
      ${PROFILE.username}
    </div>

    <div style="margin-bottom:22px;">
      ${PROFILE.bio}
    </div>

    <div
      style="
        display:flex;
        justify-content:space-around;
        margin-bottom:20px;
      "
    >
      <div>
        <strong>${stats.following}</strong>
        <div style="opacity:.65;font-size:13px;">Following</div>
      </div>

      <div>
        <strong>${stats.followers}</strong>
        <div style="opacity:.65;font-size:13px;">Followers</div>
      </div>

      <div>
        <strong>${stats.likes}</strong>
        <div style="opacity:.65;font-size:13px;">Likes</div>
      </div>
    </div>

    <button
      type="button"
      style="
        width:100%;
        padding:12px;
        border:0;
        border-radius:12px;
        font-weight:700;
        margin-bottom:20px;
      "
    >
      Edit Profile
    </button>

    <h3 style="text-align:left;margin:10px 0;">
      My Videos
    </h3>

    <div
      class="zylo-profile-video-grid"
      style="
        display:grid;
        grid-template-columns:repeat(3,1fr);
        gap:5px;
      "
    ></div>
  `;

  overlay.appendChild(card);
  document.body.appendChild(overlay);

  $(".zylo-profile-close", card).onclick =
    closeProfileOverlay;

  overlay.addEventListener("click", event => {
    if (event.target === overlay) {
      closeProfileOverlay();
    }
  });

  renderProfileVideos(
    $(".zylo-profile-video-grid", card)
  );
}


/* =========================
   UPLOAD
========================= */

function initializeUpload() {
  if (document.body.dataset.uploadReady === "1") {
    return;
  }

  document.body.dataset.uploadReady = "1";

  const createButtons = $$(
    '[data-action="create"], .create-button, .create-action'
  );

  createButtons.forEach(button => {
    if (button.dataset.uploadButtonReady === "1") {
      return;
    }

    button.dataset.uploadButtonReady = "1";

    button.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();

      openUploadModal();
    });
  });
}

function openUploadModal() {
  closeUploadModal();

  const overlay = document.createElement("div");

  overlay.className = "zylo-upload-overlay";

  Object.assign(overlay.style, {
    position: "fixed",
    inset: "0",
    zIndex: "100001",
    background: "rgba(0,0,0,.75)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "20px",
    boxSizing: "border-box"
  });

  const modal = document.createElement("div");

  Object.assign(modal.style, {
    width: "min(450px,100%)",
    background: "#111",
    color: "#fff",
    borderRadius: "20px",
    padding: "22px",
    boxSizing: "border-box"
  });

  modal.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;">
      <h2 style="margin:0;">Create Video</h2>

      <button
        type="button"
        class="zylo-upload-close"
        style="
          background:none;
          border:0;
          color:#fff;
          font-size:28px;
        "
      >×</button>
    </div>

    <input
      type="file"
      class="zylo-video-input"
      accept="video/*"
      style="
        width:100%;
        margin:25px 0;
      "
    >

    <button
      type="button"
      class="zylo-upload-submit"
      style="
        width:100%;
        padding:13px;
        border:0;
        border-radius:12px;
        font-weight:700;
      "
    >
      Upload Video
    </button>

    <div
      class="zylo-upload-status"
      style="
        margin-top:12px;
        text-align:center;
        opacity:.7;
      "
    ></div>
  `;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  $(".zylo-upload-close", modal).onclick =
    closeUploadModal;

  $(".zylo-upload-submit", modal).onclick =
    uploadSelectedVideo;

  overlay.addEventListener("click", event => {
    if (event.target === overlay) {
      closeUploadModal();
    }
  });
}

function closeUploadModal() {
  const overlay = $(".zylo-upload-overlay");

  if (overlay) {
    overlay.remove();
  }
}

async function uploadSelectedVideo() {
  const input = $(".zylo-video-input");
  const status = $(".zylo-upload-status");

  if (!input || !input.files || !input.files[0]) {
    showToast("একটি ভিডিও নির্বাচন করুন");
    return;
  }

  const file = input.files[0];

  if (!file.type.startsWith("video/")) {
    showToast("শুধু ভিডিও ফাইল ব্যবহার করুন");
    return;
  }

  status.textContent = "Uploading...";

  const formData = new FormData();

  formData.append("video", file);

  try {
    const response = await fetch(
      `${API_BASE_URL}/api/upload`,
      {
        method: "POST",
        body: formData
      }
    );

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(
        data.message || "Upload failed"
      );
    }

    const videoUrl =
      data.url ||
      data.videoUrl ||
      `${API_BASE_URL}/uploads/${data.filename}`;

    saveUploadedVideo({
      id: `uploaded-${Date.now()}`,
      url: videoUrl,
      name: file.name,
      createdAt: Date.now()
    });

    addUploadedVideoToFeed({
      id: `uploaded-${Date.now()}`,
      url: videoUrl
    });

    status.textContent = "Upload complete";

    showToast("ভিডিও আপলোড হয়েছে");

    setTimeout(() => {
      closeUploadModal();
    }, 500);
  } catch (error) {
    console.error(error);

    status.textContent =
      "Upload failed. আবার চেষ্টা করুন।";

    showToast("ভিডিও আপলোড হয়নি");
  }
}

function saveUploadedVideo(videoData) {
  const videos = getStorage(
    STORAGE_KEYS.uploaded,
    []
  );

  videos.push(videoData);

  setStorage(
    STORAGE_KEYS.uploaded,
    videos
  );
}

function addUploadedVideoToFeed(videoData) {
  const feed = getVideoFeed();

  if (!feed) {
    return;
  }

  const page = document.createElement("section");

  page.className = "video-page";
  page.dataset.videoId = videoData.id;

  page.innerHTML = `
    <video
      src="${escapeHTML(videoData.url)}"
      muted
      playsinline
      webkit-playsinline
      loop
      preload="metadata"
    ></video>
  `;

  feed.appendChild(page);

  initializeVideos();
  initializePageFeatures(page);

  if (feed._videoObserver) {
    feed._videoObserver.observe(page);
  }

  updateProfileButtons();
}


/* =========================
   RESTORE UPLOADED VIDEOS
========================= */

function restoreUploadedVideos() {
  const feed = getVideoFeed();

  if (!feed) {
    return;
  }

  const uploaded = getStorage(
    STORAGE_KEYS.uploaded,
    []
  );

  uploaded.forEach(item => {
    if (!item || !item.url) {
      return;
    }

    if (
      $(
        `.video-page[data-video-id="${CSS.escape(item.id)}"]`,
        feed
      )
    ) {
      return;
    }

    const page = document.createElement("section");

    page.className = "video-page";
    page.dataset.videoId = item.id;

    page.innerHTML = `
      <video
        src="${escapeHTML(item.url)}"
        muted
        playsinline
        webkit-playsinline
        loop
        preload="metadata"
      ></video>
    `;

    feed.appendChild(page);
  });
}


/* =========================
   PAGE FEATURES
========================= */

function initializePageFeatures(page) {
  if (!page) {
    return;
  }

  initializeLike(page);
  initializeSave(page);
  initializeComment(page);
  initializeShare(page);
  initializeMusic(page);
  initializeFullscreen(page);
  initializeDoubleTap(page);
  initializeProfileButton(page);
}


/* =========================
   TOP TABS
========================= */

function initializeTopTabs() {
  const tabs = $$(
    ".top-tabs button, .top-tab, [data-tab]"
  );

  tabs.forEach(tab => {
    if (tab.dataset.topTabReady === "1") {
      return;
    }

    tab.dataset.topTabReady = "1";

    tab.addEventListener("click", event => {
      event.preventDefault();

      tabs.forEach(item => {
        item.classList.remove("active");
      });

      tab.classList.add("active");

      const name =
        tab.dataset.tab ||
        tab.textContent.trim();

      if (
        name.toLowerCase().includes("following")
      ) {
        showToast("Following");
      } else if (
        name.toLowerCase().includes("for you")
      ) {
        showToast("For You");
      } else if (
        name.toLowerCase().includes("live")
      ) {
        showToast("LIVE");
      }
    });
  });
}


/* =========================
   SEARCH
========================= */

function initializeSearch() {
  const searchButtons = $$(
    '[data-action="search"], .search-button'
  );

  searchButtons.forEach(button => {
    if (button.dataset.searchReady === "1") {
      return;
    }

    button.dataset.searchReady = "1";

    button.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();

      openSearch();
    });
  });
}

function openSearch() {
  if ($(".zylo-search-overlay")) {
    return;
  }

  const overlay = document.createElement("div");

  overlay.className = "zylo-search-overlay";

  Object.assign(overlay.style, {
    position: "fixed",
    inset: "0",
    zIndex: "100002",
    background: "#000",
    padding: "20px",
    boxSizing: "border-box"
  });

  overlay.innerHTML = `
    <div style="display:flex;gap:10px;align-items:center;">
      <input
        class="zylo-search-input"
        type="search"
        placeholder="Search ZYLO..."
        style="
          flex:1;
          padding:13px 16px;
          border-radius:25px;
          border:0;
        "
      >

      <button
        type="button"
        class="zylo-search-close"
        style="
          background:none;
          border:0;
          color:#fff;
          font-size:28px;
        "
      >×</button>
    </div>

    <div
      class="zylo-search-results"
      style="margin-top:25px;color:#fff;"
    ></div>
  `;

  document.body.appendChild(overlay);

  const input = $(".zylo-search-input", overlay);
  const results = $(".zylo-search-results", overlay);

  $(".zylo-search-close", overlay).onclick =
    () => overlay.remove();

  input.focus();

  input.addEventListener("input", () => {
    const query = input.value
      .trim()
      .toLowerCase();

    if (!query) {
      results.innerHTML = "";
      return;
    }

    if (
      PROFILE.name.toLowerCase().includes(query) ||
      PROFILE.username.toLowerCase().includes(query) ||
      PROFILE.bio.toLowerCase().includes(query)
    ) {
      results.innerHTML = `
        <div
          class="zylo-search-profile"
          style="
            padding:15px;
            border-bottom:1px solid #333;
            cursor:pointer;
          "
        >
          <strong>${PROFILE.name}</strong>
          <div style="opacity:.65;">
            ${PROFILE.username}
          </div>
        </div>
      `;

      $(".zylo-search-profile", results).onclick =
        () => {
          overlay.remove();
          openCreatorProfile();
        };
    } else {
      results.innerHTML =
        '<div style="opacity:.6;">No results</div>';
    }
  });
}


/* =========================
   BOTTOM NAV
========================= */

function initializeBottomNavigation() {
  const buttons = $$(
    ".bottom-nav button, .bottom-navigation button, [data-nav]"
  );

  buttons.forEach(button => {
    if (button.dataset.bottomNavReady === "1") {
      return;
    }

    button.dataset.bottomNavReady = "1";

    button.addEventListener("click", event => {
      const action =
        button.dataset.nav ||
        button.dataset.action ||
        button.textContent
          .trim()
          .toLowerCase();

      if (
        action.includes("profile")
      ) {
        event.preventDefault();
        event.stopPropagation();

        openOwnProfile();
        return;
      }

      if (
        action.includes("create") ||
        action === "+"
      ) {
        event.preventDefault();
        event.stopPropagation();

        openUploadModal();
        return;
      }

      if (
        action.includes("home")
      ) {
        const feed = getVideoFeed();

        if (feed) {
          goToPage(0);
        }
      }
    });
  });
}


/* =========================
   FEED SCROLL SNAP SUPPORT
========================= */

function ensureFeedNavigationCSS() {
  if ($("#zylo-feed-navigation-style")) {
    return;
  }

  const style = document.createElement("style");

  style.id = "zylo-feed-navigation-style";

  style.textContent = `
    .video-feed {
      overflow-y: auto;
      scroll-snap-type: y mandatory;
      overscroll-behavior-y: contain;
    }

    .video-feed .video-page {
      scroll-snap-align: start;
      scroll-snap-stop: always;
    }

    .video-feed video {
      touch-action: pan-y;
    }
  `;

  document.head.appendChild(style);
}


/* =========================
   INITIALIZE
========================= */

function initializeZYLO() {
  ensureFeedNavigationCSS();

  restoreUploadedVideos();

  initializeVideos();

  getVideoPages().forEach(page => {
    initializePageFeatures(page);
  });

  initializeSwipeNavigation();
  initializeWheelNavigation();
  initializeKeyboardNavigation();
  initializeVideoObserver();

  initializeUpload();
  initializeTopTabs();
  initializeSearch();
  initializeBottomNavigation();

  updateProfileButtons();

  // Start the first video.
  const pages = getVideoPages();

  if (pages.length) {
    const index = getCurrentPageIndex();

    activatePage(
      pages[index >= 0 ? index : 0]
    );
  }
}


/* =========================
   START
========================= */

if (document.readyState === "loading") {
  document.addEventListener(
    "DOMContentLoaded",
    initializeZYLO,
    { once: true }
  );
} else {
  initializeZYLO();
}
