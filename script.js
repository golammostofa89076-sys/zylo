/* =========================================================
   ZYLO - COMPLETE FRONTEND SCRIPT
   Create • Connect • Grow
   ========================================================= */

"use strict";

/* =========================================================
   CONFIG
   ========================================================= */

const API_BASE_URL =
  "https://zylo-backend-ec5c.onrender.com";

const LOCAL_VIDEO =
  "./backend/uploads/video1.mp4";

const CDN_VIDEO =
  "https://cdn.jsdelivr.net/gh/golammostofa89076-sys/zylo@main/backend/uploads/video1.mp4";

const STORAGE = {
  likes: "zylo_likes",
  saves: "zylo_saves",
  follows: "zylo_follows",
  comments: "zylo_comments",
  uploadedVideos: "zylo_uploaded_videos",

  profileName: "zylo_profile_name",
  profileUsername: "zylo_profile_username",
  profileBio: "zylo_profile_bio"
};

const PROFILE = {
  name: "ZYLO Creator",
  username: "@zylo_creator",
  bio: "Create • Connect • Grow"
};


/* =========================================================
   HELPERS
   ========================================================= */

function $(selector, parent = document) {
  return parent.querySelector(selector);
}

function $$(selector, parent = document) {
  return Array.from(parent.querySelectorAll(selector));
}

function safeJSONParse(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function getStorage(key, fallback = {}) {
  return safeJSONParse(
    localStorage.getItem(key),
    fallback
  );
}

function setStorage(key, value) {
  localStorage.setItem(
    key,
    JSON.stringify(value)
  );
}

function escapeHTML(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function showToast(message) {
  let toast = document.querySelector(
    ".zylo-toast"
  );

  if (!toast) {
    toast = document.createElement("div");

    toast.className = "zylo-toast";

    Object.assign(toast.style, {
      position: "fixed",
      left: "50%",
      bottom: "90px",
      transform: "translateX(-50%)",
      zIndex: "999999",
      background: "rgba(30,30,30,.95)",
      color: "#fff",
      padding: "10px 18px",
      borderRadius: "22px",
      fontSize: "14px",
      pointerEvents: "none",
      opacity: "0",
      transition: "opacity .2s"
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


/* =========================================================
   PROFILE DATA
   ========================================================= */

function getProfileData() {
  return {
    name:
      localStorage.getItem(
        STORAGE.profileName
      ) || PROFILE.name,

    username:
      localStorage.getItem(
        STORAGE.profileUsername
      ) || PROFILE.username,

    bio:
      localStorage.getItem(
        STORAGE.profileBio
      ) || PROFILE.bio
  };
}


/* =========================================================
   VIDEO ID
   ========================================================= */

function getVideoId(page) {
  if (!page) return null;

  if (page.dataset.videoId) {
    return page.dataset.videoId;
  }

  if (page.id) {
    return page.id;
  }

  const video = $("video", page);

  if (video) {
    return (
      video.dataset.videoId ||
      video.currentSrc ||
      video.src ||
      null
    );
  }

  return null;
}


/* =========================================================
   VIDEO SOURCE / FALLBACK
   ========================================================= */

function setupVideoSource(video) {
  if (!video || video.dataset.zyloSourceReady) {
    return;
  }

  video.dataset.zyloSourceReady = "1";

  let source =
    video.querySelector("source");

  if (!source) {
    source = document.createElement("source");
    video.appendChild(source);
  }

  const original =
    source.getAttribute("src") ||
    video.getAttribute("src");

  if (!original) {
    source.src = LOCAL_VIDEO;
  }

  video.muted = true;
  video.playsInline = true;
  video.setAttribute("playsinline", "");
  video.setAttribute("webkit-playsinline", "");

  video.addEventListener(
    "error",
    () => {
      if (
        video.dataset.cdnFallback === "1"
      ) {
        return;
      }

      video.dataset.cdnFallback = "1";

      source.src = CDN_VIDEO;

      video.load();
    },
    { once: true }
  );

  video.load();
}


/* =========================================================
   VIDEO INITIALIZATION
   ========================================================= */

function initializeVideos() {
  $$("video").forEach(video => {
    setupVideoSource(video);

    video.muted = true;
    video.playsInline = true;

    video.addEventListener(
      "click",
      () => {
        if (video.paused) {
          video.play().catch(() => {});
        } else {
          video.pause();
        }
      }
    );
  });
}


/* =========================================================
   PLAY / PAUSE
   ========================================================= */

function playPageVideo(page) {
  if (!page) return;

  const video = $("video", page);

  if (!video) return;

  $$("video").forEach(other => {
    if (other !== video) {
      other.pause();
    }
  });

  video.muted = true;

  video.play().catch(() => {});
}

function pausePageVideo(page) {
  const video = $("video", page);

  if (video) {
    video.pause();
  }
}


/* =========================================================
   VIDEO OBSERVER
   ========================================================= */

let videoObserver = null;

function initializeVideoObserver() {
  const feed =
    $(".video-feed") ||
    $(".feed") ||
    document.body;

  const pages =
    $$(".video-page", feed);

  if (!pages.length) return;

  if (videoObserver) {
    videoObserver.disconnect();
  }

  videoObserver =
    new IntersectionObserver(
      entries => {
        let bestEntry = null;

        entries.forEach(entry => {
          if (
            entry.isIntersecting &&
            (!bestEntry ||
              entry.intersectionRatio >
                bestEntry.intersectionRatio)
          ) {
            bestEntry = entry;
          }
        });

        if (bestEntry) {
          pages.forEach(page => {
            if (page === bestEntry.target) {
              page.classList.add(
                "zylo-active-video"
              );

              playPageVideo(page);
            } else {
              page.classList.remove(
                "zylo-active-video"
              );

              pausePageVideo(page);
            }
          });
        }
      },
      {
        root:
          feed === document.body
            ? null
            : feed,

        threshold: [
          0.35,
          0.5,
          0.65,
          0.8
        ]
      }
    );

  pages.forEach(page => {
    videoObserver.observe(page);
  });
}


/* =========================================================
   FIND VIDEO FEED
   ========================================================= */

function getVideoFeed() {
  return (
    $(".video-feed") ||
    $(".videos-feed") ||
    $(".feed") ||
    document.querySelector(
      ".video-container"
    )
  );
}

function getVideoPages() {
  const feed = getVideoFeed();

  if (!feed) {
    return $$(".video-page");
  }

  return $$(".video-page", feed);
}


/* =========================================================
   NEXT / PREVIOUS VIDEO
   ========================================================= */

let feedNavigationLocked = false;

function goToVideoPage(direction) {
  const pages = getVideoPages();

  if (!pages.length) return;

  const feed = getVideoFeed();

  let currentIndex = 0;

  let activePage =
    $(".video-page.zylo-active-video");

  if (!activePage && feed) {
    const feedRect =
      feed.getBoundingClientRect();

    let closestDistance = Infinity;

    pages.forEach((page, index) => {
      const rect =
        page.getBoundingClientRect();

      const distance =
        Math.abs(
          rect.top - feedRect.top
        );

      if (distance < closestDistance) {
        closestDistance = distance;
        currentIndex = index;
      }
    });
  } else if (activePage) {
    currentIndex =
      pages.indexOf(activePage);

    if (currentIndex < 0) {
      currentIndex = 0;
    }
  }

  let nextIndex =
    currentIndex + direction;

  if (nextIndex < 0) {
    nextIndex = 0;
  }

  if (nextIndex >= pages.length) {
    nextIndex = pages.length - 1;
  }

  if (
    nextIndex === currentIndex
  ) {
    return;
  }

  if (feedNavigationLocked) {
    return;
  }

  feedNavigationLocked = true;

  const target =
    pages[nextIndex];

  if (feed) {
    const feedRect =
      feed.getBoundingClientRect();

    const targetRect =
      target.getBoundingClientRect();

    const top =
      feed.scrollTop +
      targetRect.top -
      feedRect.top;

    feed.scrollTo({
      top,
      behavior: "smooth"
    });
  } else {
    target.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }

  setTimeout(() => {
    feedNavigationLocked = false;
  }, 700);
}


/* =========================================================
   TOUCH SWIPE
   ========================================================= */

let touchStartX = 0;
let touchStartY = 0;
let touchStartTime = 0;

function initializeSwipeNavigation() {
  const feed = getVideoFeed();

  if (!feed) return;

  if (
    feed.dataset.swipeInitialized === "1"
  ) {
    return;
  }

  feed.dataset.swipeInitialized = "1";

  feed.addEventListener(
    "touchstart",
    event => {
      if (!event.touches.length) return;

      touchStartX =
        event.touches[0].clientX;

      touchStartY =
        event.touches[0].clientY;

      touchStartTime =
        Date.now();
    },
    { passive: true }
  );

  feed.addEventListener(
    "touchend",
    event => {
      if (!event.changedTouches.length) {
        return;
      }

      const touch =
        event.changedTouches[0];

      const dx =
        touch.clientX - touchStartX;

      const dy =
        touch.clientY - touchStartY;

      const duration =
        Date.now() - touchStartTime;

      const absX = Math.abs(dx);
      const absY = Math.abs(dy);

      if (
        absY < 50 ||
        absY <= absX
      ) {
        return;
      }

      if (duration > 1000) {
        return;
      }

      if (dy < 0) {
        // Swipe Up
        goToVideoPage(1);
      } else {
        // Swipe Down
        goToVideoPage(-1);
      }
    },
    { passive: true }
  );
}


/* =========================================================
   MOUSE WHEEL
   ========================================================= */

function initializeWheelNavigation() {
  const feed = getVideoFeed();

  if (!feed) return;

  if (
    feed.dataset.wheelInitialized === "1"
  ) {
    return;
  }

  feed.dataset.wheelInitialized = "1";

  let wheelTimer = null;

  feed.addEventListener(
    "wheel",
    event => {
      if (Math.abs(event.deltaY) < 20) {
        return;
      }

      event.preventDefault();

      clearTimeout(wheelTimer);

      wheelTimer = setTimeout(() => {
        if (event.deltaY > 0) {
          goToVideoPage(1);
        } else {
          goToVideoPage(-1);
        }
      }, 40);
    },
    { passive: false }
  );
}


/* =========================================================
   KEYBOARD NAVIGATION
   ========================================================= */

function initializeKeyboardNavigation() {
  if (
    document.body.dataset.keyboardInitialized ===
    "1"
  ) {
    return;
  }

  document.body.dataset.keyboardInitialized =
    "1";

  document.addEventListener(
    "keydown",
    event => {
      const tag =
        document.activeElement?.tagName;

      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT"
      ) {
        return;
      }

      if (
        event.key === "ArrowDown" ||
        event.key === "PageDown"
      ) {
        event.preventDefault();
        goToVideoPage(1);
      }

      if (
        event.key === "ArrowUp" ||
        event.key === "PageUp"
      ) {
        event.preventDefault();
        goToVideoPage(-1);
      }
    }
  );
}


/* =========================================================
   LIKE
   ========================================================= */

function initializeLike(page) {
  const button =
    $(".like-action", page);

  if (!button) return;

  if (
    button.dataset.zyloInitialized ===
    "1"
  ) {
    return;
  }

  button.dataset.zyloInitialized = "1";

  button.addEventListener(
    "click",
    event => {
      event.preventDefault();
      event.stopPropagation();

      const id =
        getVideoId(page) || "video";

      const likes =
        getStorage(
          STORAGE.likes,
          {}
        );

      likes[id] = !likes[id];

      setStorage(
        STORAGE.likes,
        likes
      );

      updateLikeButton(
        button,
        likes[id]
      );
    }
  );

  const likes =
    getStorage(
      STORAGE.likes,
      {}
    );

  const id =
    getVideoId(page) || "video";

  updateLikeButton(
    button,
    !!likes[id]
  );
}

function updateLikeButton(
  button,
  active
) {
  if (!button) return;

  button.classList.toggle(
    "active",
    active
  );

  button.setAttribute(
    "aria-pressed",
    String(active)
  );

  const count =
    $(".action-count", button);

  if (count) {
    const base =
      Number(
        count.dataset.baseCount ||
        count.textContent ||
        0
      );

    count.textContent =
      String(base + (active ? 1 : 0));
  }
}


/* =========================================================
   SAVE
   ========================================================= */

function initializeSave(page) {
  const button =
    $(".save-action", page);

  if (!button) return;

  if (
    button.dataset.zyloInitialized ===
    "1"
  ) {
    return;
  }

  button.dataset.zyloInitialized = "1";

  button.addEventListener(
    "click",
    event => {
      event.preventDefault();
      event.stopPropagation();

      const id =
        getVideoId(page) || "video";

      const saves =
        getStorage(
          STORAGE.saves,
          {}
        );

      saves[id] = !saves[id];

      setStorage(
        STORAGE.saves,
        saves
      );

      button.classList.toggle(
        "active",
        saves[id]
      );

      showToast(
        saves[id]
          ? "Saved"
          : "Removed from saved"
      );
    }
  );

  const saves =
    getStorage(
      STORAGE.saves,
      {}
    );

  const id =
    getVideoId(page) || "video";

  button.classList.toggle(
    "active",
    !!saves[id]
  );
}


/* =========================================================
   FOLLOW
   ========================================================= */

function initializeFollow(page) {
  const button =
    $(".profile-action", page);

  if (!button) return;

  if (
    button.dataset.followInitialized ===
    "1"
  ) {
    return;
  }

  button.dataset.followInitialized =
    "1";

  button.addEventListener(
    "click",
    event => {
      event.preventDefault();
      event.stopPropagation();

      openCreatorProfile(
        getVideoId(page)
      );
    }
  );

  updateProfileButton(button);
}

function updateProfileButton(button) {
  const follows =
    getStorage(
      STORAGE.follows,
      {}
    );

  const id =
    button.closest(".video-page") ?
      getVideoId(
        button.closest(".video-page")
      ) :
      "zylo_creator";

  const following =
    !!follows[id];

  const badge =
    $(".follow-badge", button);

  if (badge) {
    badge.textContent =
      following ? "✓" : "+";
  }

  button.classList.toggle(
    "following",
    following
  );
}


/* =========================================================
   COMMENT
   ========================================================= */

function initializeComment(page) {
  const button =
    $(".comment-action", page);

  if (!button) return;

  if (
    button.dataset.zyloInitialized ===
    "1"
  ) {
    return;
  }

  button.dataset.zyloInitialized = "1";

  button.addEventListener(
    "click",
    event => {
      event.preventDefault();
      event.stopPropagation();

      openComments(
        getVideoId(page) || "video"
      );
    }
  );
}

function openComments(videoId) {
  const comments =
    getStorage(
      STORAGE.comments,
      {}
    );

  if (!Array.isArray(comments[videoId])) {
    comments[videoId] = [];
  }

  const overlay =
    document.createElement("div");

  overlay.className =
    "zylo-comments-overlay";

  Object.assign(overlay.style, {
    position: "fixed",
    inset: "0",
    zIndex: "99997",
    background: "rgba(0,0,0,.72)",
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "center"
  });

  const sheet =
    document.createElement("div");

  Object.assign(sheet.style, {
    width: "min(520px,100%)",
    maxHeight: "75vh",
    background: "#111",
    color: "#fff",
    borderRadius: "20px 20px 0 0",
    padding: "20px",
    boxSizing: "border-box",
    overflow: "auto"
  });

  sheet.innerHTML = `
    <div style="
      display:flex;
      justify-content:space-between;
      align-items:center;
      margin-bottom:15px;
    ">
      <strong style="font-size:18px;">
        Comments
      </strong>

      <button
        type="button"
        class="zylo-comment-close"
        style="
          background:none;
          border:0;
          color:#fff;
          font-size:25px;
        "
      >×</button>
    </div>

    <div class="zylo-comment-list"></div>

    <div style="
      display:flex;
      gap:8px;
      margin-top:15px;
    ">
      <input
        class="zylo-comment-input"
        type="text"
        placeholder="Add a comment..."
        style="
          flex:1;
          padding:12px;
          border:0;
          border-radius:10px;
        "
      >

      <button
        type="button"
        class="zylo-comment-send"
        style="
          padding:0 16px;
          border:0;
          border-radius:10px;
          font-weight:700;
        "
      >
        Send
      </button>
    </div>
  `;

  overlay.appendChild(sheet);
  document.body.appendChild(overlay);

  const list =
    $(".zylo-comment-list", sheet);

  function render() {
    list.innerHTML = "";

    if (!comments[videoId].length) {
      list.innerHTML = `
        <div style="
          opacity:.6;
          padding:20px 0;
          text-align:center;
        ">
          No comments yet
        </div>
      `;
      return;
    }

    comments[videoId].forEach(
      comment => {
        const item =
          document.createElement("div");

        item.style.padding =
          "10px 0";

        item.style.borderBottom =
          "1px solid #222";

        item.textContent =
          comment;

        list.appendChild(item);
      }
    );
  }

  render();

  $(".zylo-comment-close", sheet)
    .onclick = () => {
      overlay.remove();
    };

  $(".zylo-comment-send", sheet)
    .onclick = () => {
      const input =
        $(".zylo-comment-input", sheet);

      const text =
        input.value.trim();

      if (!text) return;

      comments[videoId].push(text);

      setStorage(
        STORAGE.comments,
        comments
      );

      input.value = "";

      render();
    };
}


/* =========================================================
   SHARE
   ========================================================= */

function initializeShare(page) {
  const button =
    $(".share-action", page);

  if (!button) return;

  if (
    button.dataset.zyloInitialized ===
    "1"
  ) {
    return;
  }

  button.dataset.zyloInitialized = "1";

  button.addEventListener(
    "click",
    async event => {
      event.preventDefault();
      event.stopPropagation();

      const url =
        window.location.href;

      try {
        if (
          navigator.share
        ) {
          await navigator.share({
            title: "ZYLO",
            text:
              "Check this video on ZYLO",
            url
          });
        } else if (
          navigator.clipboard
        ) {
          await navigator.clipboard.writeText(
            url
          );

          showToast(
            "Video link copied"
          );
        } else {
          showToast(
            "Share is not supported"
          );
        }
      } catch {
        // User cancelled share
      }
    }
  );
}


/* =========================================================
   MUSIC
   ========================================================= */

function initializeMusic(page) {
  const button =
    $(".music-action", page);

  if (!button) return;

  if (
    button.dataset.zyloInitialized ===
    "1"
  ) {
    return;
  }

  button.dataset.zyloInitialized = "1";

  button.addEventListener(
    "click",
    event => {
      event.preventDefault();
      event.stopPropagation();

      const video =
        $("video", page);

      if (!video) return;

      video.muted =
        !video.muted;

      button.classList.toggle(
        "muted",
        video.muted
      );

      showToast(
        video.muted
          ? "Sound off"
          : "Sound on"
      );
    }
  );
}


/* =========================================================
   FULLSCREEN
   ========================================================= */

function initializeFullscreen(page) {
  const button =
    $(".fullscreen-action", page) ||
    $(".fullscreen-button", page);

  if (!button) return;

  if (
    button.dataset.zyloInitialized ===
    "1"
  ) {
    return;
  }

  button.dataset.zyloInitialized = "1";

  button.addEventListener(
    "click",
    event => {
      event.preventDefault();
      event.stopPropagation();

      const video =
        $("video", page);

      if (!video) return;

      if (
        document.fullscreenElement
      ) {
        document.exitFullscreen()
          .catch(() => {});
      } else if (
        video.requestFullscreen
      ) {
        video.requestFullscreen()
          .catch(() => {});
      } else {
        showToast(
          "Fullscreen unavailable"
        );
      }
    }
  );
}


/* =========================================================
   DOUBLE TAP LIKE
   ========================================================= */

function initializeDoubleTap(page) {
  const video =
    $("video", page);

  if (!video) return;

  if (
    video.dataset.doubleTapInitialized ===
    "1"
  ) {
    return;
  }

  video.dataset.doubleTapInitialized =
    "1";

  let lastTap = 0;

  video.addEventListener(
    "click",
    event => {
      const now = Date.now();

      if (
        now - lastTap <
        350
      ) {
        const likeButton =
          $(".like-action", page);

        if (likeButton) {
          likeButton.click();

          showHeartAnimation(
            event.clientX,
            event.clientY
          );
        }
      }

      lastTap = now;
    }
  );
}

function showHeartAnimation(
  x,
  y
) {
  const heart =
    document.createElement("div");

  heart.textContent = "♥";

  Object.assign(heart.style, {
    position: "fixed",
    left: `${x}px`,
    top: `${y}px`,
    transform: "translate(-50%,-50%) scale(.5)",
    zIndex: "999999",
    color: "#fff",
    fontSize: "70px",
    pointerEvents: "none",
    transition:
      "transform .25s, opacity .35s",
    opacity: "1"
  });

  document.body.appendChild(heart);

  requestAnimationFrame(() => {
    heart.style.transform =
      "translate(-50%,-50%) scale(1.2)";
  });

  setTimeout(() => {
    heart.style.opacity = "0";
  }, 250);

  setTimeout(() => {
    heart.remove();
  }, 600);
}


/* =========================================================
   PAGE INITIALIZATION
   ========================================================= */

function initializePageFeatures(page) {
  if (!page) return;

  initializeLike(page);
  initializeSave(page);
  initializeComment(page);
  initializeShare(page);
  initializeMusic(page);
  initializeFullscreen(page);
  initializeDoubleTap(page);
  initializeFollow(page);
}


/* =========================================================
   PROFILE STATS
   ========================================================= */

function getProfileStats() {
  const likes =
    getStorage(
      STORAGE.likes,
      {}
    );

  const follows =
    getStorage(
      STORAGE.follows,
      {}
    );

  const uploaded =
    safeJSONParse(
      localStorage.getItem(
        STORAGE.uploadedVideos
      ),
      []
    );

  let totalLikes = 0;

  Object.keys(likes).forEach(id => {
    if (likes[id]) {
      totalLikes++;
    }
  });

  return {
    following:
      Object.values(follows)
        .filter(Boolean).length,

    followers: 0,

    likes:
      totalLikes || 5,

    videos:
      Math.max(
        2,
        uploaded.length + 2
      )
  };
}


/* =========================================================
   PROFILE OVERLAY CLOSE
   ========================================================= */

function closeProfileOverlay() {
  $$(".zylo-profile-overlay")
    .forEach(el => el.remove());

  $$(".zylo-creator-profile-overlay")
    .forEach(el => el.remove());

  $$(".zylo-edit-profile-overlay")
    .forEach(el => el.remove());
}


/* =========================================================
   OWN PROFILE
   ========================================================= */

function openOwnProfile() {
  closeProfileOverlay();

  const profile =
    getProfileData();

  const stats =
    getProfileStats();

  const overlay =
    document.createElement("div");

  overlay.className =
    "zylo-profile-overlay";

  Object.assign(overlay.style, {
    position: "fixed",
    inset: "0",
    zIndex: "99998",
    background:
      "rgba(0,0,0,.72)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "20px",
    boxSizing: "border-box"
  });

  const card =
    document.createElement("div");

  Object.assign(card.style, {
    width:
      "min(620px,100%)",
    maxHeight: "90vh",
    overflowY: "auto",
    background: "#111",
    color: "#fff",
    borderRadius: "28px",
    padding: "24px",
    boxSizing: "border-box",
    textAlign: "center"
  });

  card.innerHTML = `
    <button
      type="button"
      class="zylo-profile-close"
      style="
        float:right;
        background:none;
        border:0;
        color:#fff;
        font-size:30px;
        cursor:pointer;
      "
    >×</button>

    <div style="clear:both;"></div>

    <div style="
      width:145px;
      height:145px;
      margin:20px auto 22px;
      border-radius:50%;
      background:#222;
      display:flex;
      align-items:center;
      justify-content:center;
      font-size:62px;
      font-weight:700;
    ">
      Z
    </div>

    <h2 style="
      margin:0 0 8px;
      font-size:30px;
    ">
      ${escapeHTML(profile.name)}
    </h2>

    <div style="
      opacity:.7;
      font-size:17px;
      margin-bottom:12px;
    ">
      ${escapeHTML(profile.username)}
    </div>

    <div style="
      font-size:18px;
      margin-bottom:30px;
    ">
      ${escapeHTML(profile.bio)}
    </div>

    <div style="
      display:flex;
      justify-content:space-around;
      margin-bottom:25px;
    ">
      <div>
        <strong style="font-size:24px;">
          ${stats.following}
        </strong>
        <div style="opacity:.65;">
          Following
        </div>
      </div>

      <div>
        <strong style="font-size:24px;">
          ${stats.followers}
        </strong>
        <div style="opacity:.65;">
          Followers
        </div>
      </div>

      <div>
        <strong style="font-size:24px;">
          ${stats.likes}
        </strong>
        <div style="opacity:.65;">
          Likes
        </div>
      </div>
    </div>

    <button
      type="button"
      class="zylo-edit-profile-button"
      style="
        width:100%;
        padding:15px;
        border:0;
        border-radius:14px;
        font-size:17px;
        font-weight:700;
        cursor:pointer;
        margin-bottom:30px;
      "
    >
      Edit Profile
    </button>

    <h2 style="
      text-align:left;
      margin:10px 0 15px;
    ">
      My Videos
    </h2>

    <div
      class="zylo-profile-video-grid"
      style="
        display:grid;
        grid-template-columns:
          repeat(3,minmax(0,1fr));
        gap:8px;
      "
    ></div>
  `;

  overlay.appendChild(card);
  document.body.appendChild(overlay);

  $(".zylo-profile-close", card)
    .onclick = closeProfileOverlay;

  $(".zylo-edit-profile-button", card)
    .onclick = openEditProfile;

  overlay.addEventListener(
    "click",
    event => {
      if (event.target === overlay) {
        closeProfileOverlay();
      }
    }
  );

  renderProfileVideos(
    $(".zylo-profile-video-grid", card)
  );
}


/* =========================================================
   EDIT PROFILE
   ========================================================= */

function openEditProfile() {
  closeProfileOverlay();

  const profile =
    getProfileData();

  const overlay =
    document.createElement("div");

  overlay.className =
    "zylo-edit-profile-overlay";

  Object.assign(overlay.style, {
    position: "fixed",
    inset: "0",
    zIndex: "100000",
    background: "#111",
    color: "#fff",
    overflowY: "auto",
    padding: "20px",
    boxSizing: "border-box"
  });

  overlay.innerHTML = `
    <div style="
      width:min(450px,100%);
      margin:0 auto;
    ">

      <div style="
        display:flex;
        align-items:center;
        justify-content:space-between;
        margin-bottom:30px;
      ">
        <h2 style="margin:0;">
          Edit Profile
        </h2>

        <button
          type="button"
          class="zylo-edit-close"
          style="
            background:none;
            border:0;
            color:#fff;
            font-size:30px;
            cursor:pointer;
          "
        >×</button>
      </div>

      <div style="
        width:100px;
        height:100px;
        margin:0 auto 25px;
        border-radius:50%;
        background:#222;
        display:flex;
        align-items:center;
        justify-content:center;
        font-size:44px;
        font-weight:700;
      ">
        Z
      </div>

      <label style="
        display:block;
        margin-bottom:8px;
      ">
        Name
      </label>

      <input
        class="zylo-edit-name"
        type="text"
        maxlength="40"
        value="${escapeHTML(profile.name)}"
        style="
          width:100%;
          box-sizing:border-box;
          padding:14px;
          border:0;
          border-radius:10px;
          font-size:16px;
          margin-bottom:20px;
        "
      >

      <label style="
        display:block;
        margin-bottom:8px;
      ">
        Username
      </label>

      <input
        class="zylo-edit-username"
        type="text"
        maxlength="30"
        value="${escapeHTML(profile.username)}"
        style="
          width:100%;
          box-sizing:border-box;
          padding:14px;
          border:0;
          border-radius:10px;
          font-size:16px;
          margin-bottom:20px;
        "
      >

      <label style="
        display:block;
        margin-bottom:8px;
      ">
        Bio
      </label>

      <textarea
        class="zylo-edit-bio"
        maxlength="100"
        rows="4"
        style="
          width:100%;
          box-sizing:border-box;
          padding:14px;
          border:0;
          border-radius:10px;
          font-size:16px;
          resize:none;
          margin-bottom:25px;
        "
      >${escapeHTML(profile.bio)}</textarea>

      <button
        type="button"
        class="zylo-save-profile"
        style="
          width:100%;
          padding:15px;
          border:0;
          border-radius:12px;
          font-size:17px;
          font-weight:700;
          cursor:pointer;
        "
      >
        Save Changes
      </button>

    </div>
  `;

  document.body.appendChild(overlay);

  $(".zylo-edit-close", overlay)
    .onclick = () => {
      overlay.remove();
      openOwnProfile();
    };

  $(".zylo-save-profile", overlay)
    .onclick = () => {

      let name =
        $(".zylo-edit-name", overlay)
          .value
          .trim();

      let username =
        $(".zylo-edit-username", overlay)
          .value
          .trim();

      const bio =
        $(".zylo-edit-bio", overlay)
          .value
          .trim();

      if (!name) {
        showToast(
          "Name লিখুন"
        );
        return;
      }

      if (!username) {
        showToast(
          "Username লিখুন"
        );
        return;
      }

      if (
        !username.startsWith("@")
      ) {
        username =
          "@" + username;
      }

      localStorage.setItem(
        STORAGE.profileName,
        name
      );

      localStorage.setItem(
        STORAGE.profileUsername,
        username
      );

      localStorage.setItem(
        STORAGE.profileBio,
        bio
      );

      overlay.remove();

      showToast(
        "Profile updated"
      );

      openOwnProfile();
    };
}


/* =========================================================
   PROFILE VIDEO GRID
   ========================================================= */

function renderProfileVideos(container) {
  if (!container) return;

  container.innerHTML = "";

  const pages =
    getVideoPages();

  if (!pages.length) {
    container.innerHTML = `
      <div style="
        grid-column:1/-1;
        opacity:.6;
        padding:30px 0;
      ">
        No videos yet
      </div>
    `;

    return;
  }

  pages.forEach(
    (page, index) => {
      const video =
        $("video", page);

      const item =
        document.createElement("div");

      Object.assign(item.style, {
        position: "relative",
        aspectRatio: "9/16",
        borderRadius: "8px",
        overflow: "hidden",
        background: "#000",
        cursor: "pointer"
      });

      if (video) {
        const clone =
          document.createElement(
            "video"
          );

        clone.src =
          video.currentSrc ||
          video.src ||
          LOCAL_VIDEO;

        clone.muted = true;
        clone.playsInline = true;
        clone.preload = "metadata";

        Object.assign(clone.style, {
          width: "100%",
          height: "100%",
          objectFit: "cover"
        });

        item.appendChild(clone);
      }

      item.addEventListener(
        "click",
        () => {
          closeProfileOverlay();

          const feed =
            getVideoFeed();

          if (feed) {
            const target =
              getVideoPages()[index];

            if (target) {
              const feedRect =
                feed.getBoundingClientRect();

              const targetRect =
                target.getBoundingClientRect();

              const top =
                feed.scrollTop +
                targetRect.top -
                feedRect.top;

              feed.scrollTo({
                top,
                behavior: "smooth"
              });
            }
          } else {
            pages[index]
              ?.scrollIntoView({
                behavior: "smooth"
              });
          }
        }
      );

      container.appendChild(item);
    }
  );
}


/* =========================================================
   CREATOR PROFILE
   ========================================================= */

function openCreatorProfile(
  videoId
) {
  closeProfileOverlay();

  const follows =
    getStorage(
      STORAGE.follows,
      {}
    );

  const following =
    !!follows[videoId];

  const overlay =
    document.createElement("div");

  overlay.className =
    "zylo-creator-profile-overlay";

  Object.assign(overlay.style, {
    position: "fixed",
    inset: "0",
    zIndex: "99998",
    background:
      "rgba(0,0,0,.72)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "20px",
    boxSizing: "border-box"
  });

  const card =
    document.createElement("div");

  Object.assign(card.style, {
    width:
      "min(620px,100%)",
    maxHeight: "90vh",
    overflowY: "auto",
    background: "#111",
    color: "#fff",
    borderRadius: "28px",
    padding: "24px",
    boxSizing: "border-box",
    textAlign: "center"
  });

  card.innerHTML = `
    <button
      type="button"
      class="zylo-creator-close"
      style="
        float:right;
        background:none;
        border:0;
        color:#fff;
        font-size:30px;
      "
    >×</button>

    <div style="clear:both;"></div>

    <div style="
      width:145px;
      height:145px;
      margin:20px auto;
      border-radius:50%;
      background:#222;
      display:flex;
      align-items:center;
      justify-content:center;
      font-size:62px;
      font-weight:700;
    ">
      Z
    </div>

    <h2 style="
      margin:0 0 8px;
    ">
      ZYLO Creator ✓
    </h2>

    <div style="
      opacity:.7;
      margin-bottom:10px;
      font-size:17px;
    ">
      @zylo_creator
    </div>

    <div style="
      margin-bottom:25px;
      font-size:18px;
    ">
      Create • Connect • Grow
    </div>

    <div style="
      display:flex;
      justify-content:space-around;
      margin-bottom:25px;
    ">
      <div>
        <strong>1</strong>
        <div style="opacity:.65;">
          Following
        </div>
      </div>

      <div>
        <strong>0</strong>
        <div style="opacity:.65;">
          Followers
        </div>
      </div>

      <div>
        <strong>5</strong>
        <div style="opacity:.65;">
          Likes
        </div>
      </div>
    </div>

    <button
      type="button"
      class="zylo-creator-follow"
      style="
        width:100%;
        padding:14px;
        border:0;
        border-radius:12px;
        font-size:17px;
        font-weight:700;
        margin-bottom:30px;
      "
    >
      ${following ? "Following" : "Follow"}
    </button>

    <h2 style="
      text-align:left;
      margin-bottom:15px;
    ">
      Videos
    </h2>

    <div
      class="zylo-creator-video-grid"
      style="
        display:grid;
        grid-template-columns:
          repeat(3,minmax(0,1fr));
        gap:8px;
      "
    ></div>
  `;

  overlay.appendChild(card);
  document.body.appendChild(overlay);

  $(".zylo-creator-close", card)
    .onclick = closeProfileOverlay;

  $(".zylo-creator-follow", card)
    .onclick = () => {

      const current =
        getStorage(
          STORAGE.follows,
          {}
        );

      current[videoId] =
        !current[videoId];

      setStorage(
        STORAGE.follows,
        current
      );

      const button =
        $(".zylo-creator-follow", card);

      button.textContent =
        current[videoId]
          ? "Following"
          : "Follow";

      updateAllProfileButtons();

      showToast(
        current[videoId]
          ? "Following"
          : "Unfollowed"
      );
    };

  overlay.addEventListener(
    "click",
    event => {
      if (event.target === overlay) {
        closeProfileOverlay();
      }
    }
  );

  renderCreatorVideos(
    $(".zylo-creator-video-grid", card)
  );
}


/* =========================================================
   CREATOR VIDEOS
   ========================================================= */

function renderCreatorVideos(
  container
) {
  if (!container) return;

  container.innerHTML = "";

  const pages =
    getVideoPages();

  pages.forEach(
    (page, index) => {
      const video =
        $("video", page);

      const item =
        document.createElement("div");

      Object.assign(item.style, {
        aspectRatio: "9/16",
        borderRadius: "8px",
        overflow: "hidden",
        background: "#000",
        cursor: "pointer"
      });

      if (video) {
        const clone =
          document.createElement(
            "video"
          );

        clone.src =
          video.currentSrc ||
          video.src ||
          LOCAL_VIDEO;

        clone.muted = true;
        clone.playsInline = true;

        Object.assign(clone.style, {
          width: "100%",
          height: "100%",
          objectFit: "cover"
        });

        item.appendChild(clone);
      }

      item.onclick = () => {
        closeProfileOverlay();

        const target =
          getVideoPages()[index];

        if (target) {
          target.scrollIntoView({
            behavior: "smooth",
            block: "start"
          });
        }
      };

      container.appendChild(item);
    }
  );
}


/* =========================================================
   UPDATE ALL PROFILE BUTTONS
   ========================================================= */

function updateAllProfileButtons() {
  $$(".profile-action")
    .forEach(button => {
      updateProfileButton(button);
    });
}


/* =========================================================
   BOTTOM PROFILE BUTTON
   ========================================================= */

function initializeBottomProfile() {
  const buttons =
    $$(
      ".bottom-nav .profile, " +
      ".bottom-nav .profile-btn, " +
      ".bottom-profile, " +
      '[data-nav="profile"]'
    );

  buttons.forEach(button => {
    if (
      button.dataset.profileInitialized ===
      "1"
    ) {
      return;
    }

    button.dataset.profileInitialized =
      "1";

    button.addEventListener(
      "click",
      event => {
        event.preventDefault();
        event.stopPropagation();

        openOwnProfile();
      }
    );
  });
}


/* =========================================================
   BOTTOM NAVIGATION
   ========================================================= */

function initializeBottomNavigation() {
  const nav =
    $(".bottom-nav");

  if (!nav) return;

  if (
    nav.dataset.zyloInitialized ===
    "1"
  ) {
    return;
  }

  nav.dataset.zyloInitialized =
    "1";

  const createButtons =
    $$(
      ".create-button, " +
      ".create-action, " +
      '[data-action="create"]',
      nav
    );

  createButtons.forEach(button => {
    button.addEventListener(
      "click",
      event => {
        event.preventDefault();
        openUploadModal();
      }
    );
  });
}


/* =========================================================
   TOP TABS
   ========================================================= */

function initializeTopTabs() {
  const tabs =
    $$(".top-nav .tab, .top-tab");

  tabs.forEach(tab => {
    if (
      tab.dataset.tabInitialized ===
      "1"
    ) {
      return;
    }

    tab.dataset.tabInitialized =
      "1";

    tab.addEventListener(
      "click",
      () => {
        const name =
          tab.textContent
            .trim()
            .toLowerCase();

        if (
          name.includes("for you")
        ) {
          showToast(
            "For You"
          );
        } else if (
          name.includes("following")
        ) {
          showToast(
            "Following"
          );
        } else if (
          name.includes("live")
        ) {
          showToast(
            "LIVE"
          );
        }
      }
    );
  });
}


/* =========================================================
   SEARCH
   ========================================================= */

function initializeSearch() {
  const searchButtons =
    $$(
      ".search-button, " +
      ".search-action, " +
      '[data-action="search"]'
    );

  searchButtons.forEach(button => {
    if (
      button.dataset.searchInitialized ===
      "1"
    ) {
      return;
    }

    button.dataset.searchInitialized =
      "1";

    button.addEventListener(
      "click",
      event => {
        event.preventDefault();
        openSearch();
      }
    );
  });
}

function openSearch() {
  if (
    $(".zylo-search-overlay")
  ) {
    return;
  }

  const overlay =
    document.createElement("div");

  overlay.className =
    "zylo-search-overlay";

  Object.assign(overlay.style, {
    position: "fixed",
    inset: "0",
    zIndex: "99996",
    background: "#111",
    color: "#fff",
    padding: "20px",
    boxSizing: "border-box"
  });

  overlay.innerHTML = `
    <div style="
      max-width:600px;
      margin:auto;
    ">

      <div style="
        display:flex;
        gap:10px;
        align-items:center;
        margin-bottom:20px;
      ">

        <input
          class="zylo-search-input"
          type="search"
          placeholder="Search ZYLO"
          style="
            flex:1;
            padding:14px;
            border:0;
            border-radius:12px;
            font-size:16px;
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

      <div class="zylo-search-results"></div>

    </div>
  `;

  document.body.appendChild(overlay);

  const input =
    $(".zylo-search-input", overlay);

  const results =
    $(".zylo-search-results", overlay);

  input.focus();

  input.addEventListener(
    "input",
    () => {
      const query =
        input.value
          .trim()
          .toLowerCase();

      results.innerHTML = "";

      if (!query) return;

      const profile =
        getProfileData();

      const matches = [];

      if (
        profile.name
          .toLowerCase()
          .includes(query) ||
        profile.username
          .toLowerCase()
          .includes(query)
      ) {
        matches.push({
          name: profile.name,
          username:
            profile.username
        });
      }

      if (
        "zylo creator"
          .includes(query) ||
        "@zylo_creator"
          .includes(query)
      ) {
        matches.push({
          name:
            "ZYLO Creator",
          username:
            "@zylo_creator"
        });
      }

      if (!matches.length) {
        results.innerHTML = `
          <div style="
            opacity:.6;
            padding:30px 0;
            text-align:center;
          ">
            No results
          </div>
        `;

        return;
      }

      matches.forEach(result => {
        const item =
          document.createElement(
            "button"
          );

        item.type = "button";

        Object.assign(item.style, {
          width: "100%",
          textAlign: "left",
          padding: "15px",
          marginBottom: "8px",
          border: "0",
          borderRadius: "12px",
          background: "#222",
          color: "#fff"
        });

        item.innerHTML = `
          <strong>
            ${escapeHTML(result.name)}
          </strong>
          <br>
          <span style="opacity:.65;">
            ${escapeHTML(result.username)}
          </span>
        `;

        item.onclick = () => {
          overlay.remove();
          openCreatorProfile(
            "zylo_creator"
          );
        };

        results.appendChild(item);
      });
    }
  );

  $(".zylo-search-close", overlay)
    .onclick = () => {
      overlay.remove();
    };
}


/* =========================================================
   UPLOAD MODAL
   ========================================================= */

function openUploadModal() {
  if (
    $(".zylo-upload-overlay")
  ) {
    return;
  }

  const overlay =
    document.createElement("div");

  overlay.className =
    "zylo-upload-overlay";

  Object.assign(overlay.style, {
    position: "fixed",
    inset: "0",
    zIndex: "100001",
    background:
      "rgba(0,0,0,.75)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "20px",
    boxSizing: "border-box"
  });

  overlay.innerHTML = `
    <div style="
      width:min(450px,100%);
      background:#111;
      color:#fff;
      border-radius:20px;
      padding:22px;
      box-sizing:border-box;
    ">

      <div style="
        display:flex;
        justify-content:space-between;
        align-items:center;
        margin-bottom:20px;
      ">
        <h2 style="margin:0;">
          Upload Video
        </h2>

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
        class="zylo-upload-file"
        type="file"
        accept="video/*"
        style="
          width:100%;
          margin-bottom:20px;
        "
      >

      <button
        type="button"
        class="zylo-upload-submit"
        style="
          width:100%;
          padding:14px;
          border:0;
          border-radius:12px;
          font-weight:700;
        "
      >
        Upload
      </button>

      <div
        class="zylo-upload-status"
        style="
          margin-top:15px;
          opacity:.7;
          text-align:center;
        "
      ></div>

    </div>
  `;

  document.body.appendChild(overlay);

  $(".zylo-upload-close", overlay)
    .onclick = () => {
      overlay.remove();
    };

  $(".zylo-upload-submit", overlay)
    .onclick = () => {
      uploadVideo(
        overlay
      );
    };
}


/* =========================================================
   UPLOAD VIDEO
   ========================================================= */

async function uploadVideo(
  overlay
) {
  const input =
    $(".zylo-upload-file", overlay);

  const status =
    $(".zylo-upload-status", overlay);

  const file =
    input?.files?.[0];

  if (!file) {
    showToast(
      "ভিডিও নির্বাচন করুন"
    );
    return;
  }

  if (
    !file.type.startsWith(
      "video/"
    )
  ) {
    showToast(
      "শুধু ভিডিও আপলোড করুন"
    );
    return;
  }

  status.textContent =
    "Uploading...";

  const formData =
    new FormData();

  formData.append(
    "video",
    file
  );

  try {
    const response =
      await fetch(
        `${API_BASE_URL}/api/upload`,
        {
          method: "POST",
          body: formData
        }
      );

    const data =
      await response.json();

    if (!response.ok) {
      throw new Error(
        data.message ||
        "Upload failed"
      );
    }

    const videoUrl =
      data.url ||
      data.videoUrl ||
      data.path ||
      `${API_BASE_URL}/uploads/${encodeURIComponent(file.name)}`;

    saveUploadedVideo({
      url: videoUrl,
      name: file.name,
      createdAt: Date.now()
    });

    addUploadedVideoToFeed(
      videoUrl
    );

    status.textContent =
      "Upload successful";

    showToast(
      "Video uploaded"
    );

    setTimeout(() => {
      overlay.remove();
    }, 700);

  } catch (error) {
    console.error(
      "ZYLO upload error:",
      error
    );

    /*
      If backend is unavailable,
      keep the local video so the
      frontend can still display it.
    */

    saveUploadedVideo({
      url:
        URL.createObjectURL(file),
      name: file.name,
      createdAt: Date.now(),
      local: true
    });

    addUploadedVideoToFeed(
      URL.createObjectURL(file)
    );

    status.textContent =
      "Video added locally";

    showToast(
      "Backend unavailable — local video added"
    );
  }
}


/* =========================================================
   SAVE UPLOADED VIDEO
   ========================================================= */

function saveUploadedVideo(videoData) {
  const videos =
    safeJSONParse(
      localStorage.getItem(
        STORAGE.uploadedVideos
      ),
      []
    );

  videos.push(videoData);

  setStorage(
    STORAGE.uploadedVideos,
    videos
  );
}


/* =========================================================
   ADD UPLOADED VIDEO TO FEED
   ========================================================= */

function addUploadedVideoToFeed(
  videoUrl
) {
  const feed =
    getVideoFeed();

  if (!feed) return;

  const page =
    document.createElement("section");

  page.className =
    "video-page";

  page.dataset.videoId =
    `uploaded-${Date.now()}`;

  page.innerHTML = `
    <video
      muted
      playsinline
      webkit-playsinline
      loop
      preload="metadata"
    >
      <source
        src="${escapeHTML(videoUrl)}"
        type="video/mp4"
      >
    </video>
  `;

  feed.appendChild(page);

  initializePageFeatures(page);

  if (videoObserver) {
    videoObserver.observe(page);
  }

  initializeSwipeNavigation();

  showToast(
    "ভিডিও Feed-এ যোগ হয়েছে"
  );
}


/* =========================================================
   RESTORE UPLOADED VIDEOS
   ========================================================= */

function restoreUploadedVideos() {
  const videos =
    safeJSONParse(
      localStorage.getItem(
        STORAGE.uploadedVideos
      ),
      []
    );

  /*
    Do not recreate videos that
    are already in the HTML.
    Uploaded videos are added only
    when they are not already
    represented in the feed.
  */

  const feed =
    getVideoFeed();

  if (!feed) return;

  const existing =
    $$(".video-page", feed);

  const existingIds =
    new Set(
      existing.map(page =>
        getVideoId(page)
      )
    );

  videos.forEach(
    (item, index) => {
      if (!item?.url) return;

      const id =
        `uploaded-${item.createdAt || index}`;

      if (existingIds.has(id)) {
        return;
      }

      /*
        Do not automatically duplicate
        every saved local video on each
        reload if the backend already
        contains the video.
      */

      if (item.local) {
        addRestoredVideo(
          item.url,
          id
        );
      }
    }
  );
}

function addRestoredVideo(
  videoUrl,
  id
) {
  const feed =
    getVideoFeed();

  if (!feed) return;

  const page =
    document.createElement("section");

  page.className =
    "video-page";

  page.dataset.videoId =
    id;

  page.innerHTML = `
    <video
      muted
      playsinline
      webkit-playsinline
      loop
      preload="metadata"
    >
      <source
        src="${escapeHTML(videoUrl)}"
      >
    </video>
  `;

  feed.appendChild(page);

  initializePageFeatures(page);

  if (videoObserver) {
    videoObserver.observe(page);
  }
}


/* =========================================================
   DYNAMIC FUNCTIONAL CSS
   ========================================================= */

function initializeFunctionalFeedCSS() {
  if (
    document.getElementById(
      "zylo-functional-feed-css"
    )
  ) {
    return;
  }

  const style =
    document.createElement("style");

  style.id =
    "zylo-functional-feed-css";

  style.textContent = `
    .video-feed {
      overflow-y:auto;
      scroll-behavior:smooth;
      overscroll-behavior-y:contain;
    }

    .video-page {
      scroll-snap-align:start;
      scroll-snap-stop:always;
    }

    .video-feed {
      scroll-snap-type:y mandatory;
    }

    video {
      max-width:100%;
    }

    .zylo-active-video video {
      visibility:visible;
    }

    .profile-action.following
    .follow-badge {
      font-size:12px;
    }
  `;

  document.head.appendChild(style);
}


/* =========================================================
   INITIALIZE
   ========================================================= */

function initializeZYLO() {
  initializeFunctionalFeedCSS();

  initializeVideos();

  const pages =
    getVideoPages();

  pages.forEach(page => {
    initializePageFeatures(page);
  });

  initializeVideoObserver();

  initializeSwipeNavigation();

  initializeWheelNavigation();

  initializeKeyboardNavigation();

  initializeBottomProfile();

  initializeBottomNavigation();

  initializeTopTabs();

  initializeSearch();

  restoreUploadedVideos();

  updateAllProfileButtons();

  /*
    Start first video.
  */

  const firstPage =
    getVideoPages()[0];

  if (firstPage) {
    setTimeout(() => {
      playPageVideo(firstPage);
    }, 300);
  }
}


/* =========================================================
   DOM READY
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
   RESIZE
   ========================================================= */

window.addEventListener(
  "resize",
  () => {
    /*
      Recalculate active page
      after orientation/viewport
      changes.
    */

    const active =
      $(".video-page.zylo-active-video");

    if (active) {
      setTimeout(() => {
        playPageVideo(active);
      }, 100);
    }
  }
);


/* =========================================================
   VISIBILITY
   ========================================================= */

document.addEventListener(
  "visibilitychange",
  () => {
    const active =
      $(".video-page.zylo-active-video");

    if (
      document.hidden
    ) {
      $$(".video-page")
        .forEach(page => {
          pausePageVideo(page);
        });
    } else if (active) {
      playPageVideo(active);
    }
  }
);


/* =========================================================
   END
   ========================================================= */
