/* =========================================================
   ZYLO — Functional Script
   UI/CSS LOCKED — functionality only
   ========================================================= */

(() => {
  "use strict";

  /* =========================================================
     CONFIG
     ========================================================= */

  const API_BASE_URL = "https://zylo-backend-ec5c.onrender.com";
  const LOCAL_VIDEO = "./backend/uploads/video1.mp4";
  const CDN_VIDEO =
    "https://cdn.jsdelivr.net/gh/golammostofa89076-sys/zylo@main/backend/uploads/video1.mp4";

  const STORAGE = {
    uploads: "zylo_uploaded_videos",
    liked: "zylo_liked_videos",
    saved: "zylo_saved_videos",
    following: "zylo_following_creators",
    comments: "zylo_comments",
    profile: "zylo_profile"
  };

  const DEFAULT_PROFILE = {
    name: "ZYLO User",
    username: "@zylo_user",
    bio: "Create • Connect • Grow.",
    avatar: ""
  };

  /* =========================================================
     HELPERS
     ========================================================= */

  const $ = (selector, root = document) =>
    root.querySelector(selector);

  const $$ = (selector, root = document) =>
    Array.from(root.querySelectorAll(selector));

  function safeJSONParse(value, fallback) {
    try {
      return value ? JSON.parse(value) : fallback;
    } catch {
      return fallback;
    }
  }

  function getStorage(key, fallback = []) {
    return safeJSONParse(localStorage.getItem(key), fallback);
  }

  function setStorage(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function escapeHTML(value = "") {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function formatNumber(number) {
    const n = Number(number) || 0;

    if (n >= 1000000) {
      return `${(n / 1000000).toFixed(1).replace(".0", "")}M`;
    }

    if (n >= 1000) {
      return `${(n / 1000).toFixed(1).replace(".0", "")}K`;
    }

    return String(n);
  }

  function toast(message) {
    let el = $("#zyloToast");

    if (!el) {
      el = document.createElement("div");
      el.id = "zyloToast";

      Object.assign(el.style, {
        position: "fixed",
        left: "50%",
        bottom: "90px",
        transform: "translateX(-50%)",
        zIndex: "99999",
        background: "rgba(0,0,0,.85)",
        color: "#fff",
        padding: "10px 16px",
        borderRadius: "999px",
        fontSize: "14px",
        pointerEvents: "none",
        opacity: "0",
        transition: "opacity .2s ease"
      });

      document.body.appendChild(el);
    }

    el.textContent = message;
    el.style.opacity = "1";

    clearTimeout(el._timer);

    el._timer = setTimeout(() => {
      el.style.opacity = "0";
    }, 1800);
  }

  function getCurrentUser() {
    try {
      if (
        window.ZYLOAuth &&
        typeof window.ZYLOAuth.getCurrentUser === "function"
      ) {
        return window.ZYLOAuth.getCurrentUser();
      }

      return window.ZYLOAuth?.currentUser || null;
    } catch {
      return null;
    }
  }

  function getMyProfile() {
    const saved = safeJSONParse(
      localStorage.getItem(STORAGE.profile),
      null
    );

    if (saved) return saved;

    return { ...DEFAULT_PROFILE };
  }

  function saveMyProfile(profile) {
    setStorage(STORAGE.profile, profile);
  }

  function getOwnerInfo() {
    const user = getCurrentUser();
    const profile = getMyProfile();

    if (user) {
      return {
        uid: user.uid || "",
        name: user.displayName || profile.name || "ZYLO User",
        username:
          profile.username ||
          user.email?.split("@")[0] ||
          "zylo_user"
      };
    }

    return {
      uid: "",
      name: profile.name || "ZYLO User",
      username: profile.username || "@zylo_user"
    };
  }

  /* =========================================================
     AUTH
     ========================================================= */

  function loadAuthJS() {
    if (
      window.ZYLOAuth ||
      document.querySelector('script[src*="auth.js"]')
    ) {
      return;
    }

    const script = document.createElement("script");
    script.type = "module";
    script.src = "./auth.js";

    document.head.appendChild(script);
  }

  function requireLogin() {
    const user = getCurrentUser();

    if (user) return true;

    toast("Please login first");

    try {
      if (
        window.ZYLOAuth &&
        typeof window.ZYLOAuth.openAuth === "function"
      ) {
        window.ZYLOAuth.openAuth("login");
        return false;
      }

      if (
        window.ZYLOAuth &&
        typeof window.ZYLOAuth.showAuth === "function"
      ) {
        window.ZYLOAuth.showAuth("login");
        return false;
      }
    } catch {}

    document.dispatchEvent(
      new CustomEvent("zylo:login-required")
    );

    return false;
  }

  /* =========================================================
     VIDEO SOURCE
     ========================================================= */

  function setVideoSource(video, source) {
    if (!video || !source) return;

    if (video.dataset.zyloSource === source) return;

    video.dataset.zyloSource = source;
    video.src = source;
    video.load();
  }

  function setupVideoFallback(video) {
    if (!video) return;

    video.addEventListener("error", () => {
      const current = video.currentSrc || video.src;

      if (current.includes("cdn.jsdelivr.net")) {
        return;
      }

      if (video.dataset.fallbackUsed === "true") {
        return;
      }

      video.dataset.fallbackUsed = "true";
      setVideoSource(video, CDN_VIDEO);
    });
  }

  function initializeVideoSources() {
    $$(".video-page video, .video-feed video, video").forEach(
      video => {
        if (!video.src && !video.currentSrc) {
          setVideoSource(video, LOCAL_VIDEO);
        }

        setupVideoFallback(video);

        video.playsInline = true;
        video.setAttribute("playsinline", "");
        video.preload = "metadata";
      }
    );
  }

  /* =========================================================
     VIDEO PLAY / PAUSE
     ========================================================= */

  function pauseAllVideos(except = null) {
    $$("video").forEach(video => {
      if (video !== except) {
        try {
          video.pause();
        } catch {}
      }
    });
  }

  function playVideo(video) {
    if (!video) return;

    pauseAllVideos(video);

    const promise = video.play();

    if (promise && typeof promise.catch === "function") {
      promise.catch(() => {});
    }
  }

  function setupVideoObserver() {
    const pages = $$(".video-page");

    if (!pages.length) return;

    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          const video = $("video", entry.target);

          if (!video) return;

          if (entry.isIntersecting && entry.intersectionRatio >= 0.65) {
            playVideo(video);
          } else {
            try {
              video.pause();
            } catch {}
          }
        });
      },
      {
        threshold: [0.25, 0.65, 0.9]
      }
    );

    pages.forEach(page => observer.observe(page));
  }

  /* =========================================================
     VIDEO NAVIGATION
     ========================================================= */

  function getVideoFeed() {
    return $(".video-feed");
  }

  function getVideoPages() {
    return $$(".video-page");
  }

  function scrollToVideo(index) {
    const pages = getVideoPages();

    if (!pages.length) return;

    const safeIndex = Math.max(
      0,
      Math.min(index, pages.length - 1)
    );

    pages[safeIndex].scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }

  function currentVideoIndex() {
    const pages = getVideoPages();

    if (!pages.length) return 0;

    const viewportCenter = window.innerHeight / 2;

    let closestIndex = 0;
    let closestDistance = Infinity;

    pages.forEach((page, index) => {
      const rect = page.getBoundingClientRect();
      const center = rect.top + rect.height / 2;
      const distance = Math.abs(center - viewportCenter);

      if (distance < closestDistance) {
        closestDistance = distance;
        closestIndex = index;
      }
    });

    return closestIndex;
  }

  function setupVideoNavigation() {
    const feed = getVideoFeed();

    if (!feed) return;

    let wheelLocked = false;

    feed.addEventListener(
      "wheel",
      event => {
        if (Math.abs(event.deltaY) < 20) return;

        event.preventDefault();

        if (wheelLocked) return;

        wheelLocked = true;

        const index = currentVideoIndex();

        scrollToVideo(
          event.deltaY > 0 ? index + 1 : index - 1
        );

        setTimeout(() => {
          wheelLocked = false;
        }, 500);
      },
      { passive: false }
    );

    let touchStartY = 0;
    let touchStartX = 0;

    feed.addEventListener(
      "touchstart",
      event => {
        const touch = event.changedTouches[0];

        touchStartY = touch.clientY;
        touchStartX = touch.clientX;
      },
      { passive: true }
    );

    feed.addEventListener(
      "touchend",
      event => {
        const touch = event.changedTouches[0];

        const dy = touch.clientY - touchStartY;
        const dx = touch.clientX - touchStartX;

        if (Math.abs(dy) < 50) return;
        if (Math.abs(dy) < Math.abs(dx)) return;

        const index = currentVideoIndex();

        if (dy < 0) {
          scrollToVideo(index + 1);
        } else {
          scrollToVideo(index - 1);
        }
      },
      { passive: true }
    );
  }

  function setupKeyboardNavigation() {
    document.addEventListener("keydown", event => {
      if (
        event.target &&
        ["INPUT", "TEXTAREA"].includes(event.target.tagName)
      ) {
        return;
      }

      const index = currentVideoIndex();

      if (event.key === "ArrowDown" || event.key === "PageDown") {
        event.preventDefault();
        scrollToVideo(index + 1);
      }

      if (event.key === "ArrowUp" || event.key === "PageUp") {
        event.preventDefault();
        scrollToVideo(index - 1);
      }
    });
  }

  /* =========================================================
     VIDEO DATA
     ========================================================= */

  function getVideoId(page) {
    return (
      page?.dataset.videoId ||
      page?.id ||
      `video-${Math.random().toString(36).slice(2)}`
    );
  }

  function getUploadedVideos() {
    return getStorage(STORAGE.uploads, []);
  }

  function saveUploadedVideos(videos) {
    setStorage(STORAGE.uploads, videos);
  }

  function findUploadedVideo(id) {
    return getUploadedVideos().find(
      video => String(video.id) === String(id)
    );
  }

  /* =========================================================
     LIKE
     ========================================================= */

  function isLiked(id) {
    return getStorage(STORAGE.liked, []).includes(String(id));
  }

  function setLiked(id, liked) {
    let list = getStorage(STORAGE.liked, []);

    id = String(id);

    if (liked) {
      if (!list.includes(id)) list.push(id);
    } else {
      list = list.filter(item => item !== id);
    }

    setStorage(STORAGE.liked, list);
  }

  function updateLikeUI(page, liked) {
    const button = $(".like-btn", page);

    if (!button) return;

    button.classList.toggle("active", liked);
    button.setAttribute(
      "aria-pressed",
      liked ? "true" : "false"
    );

    const count =
      button.querySelector(".action-count") ||
      button.querySelector(".count") ||
      button.querySelector("span");

    if (count && !count.closest("svg")) {
      const raw = Number(
        button.dataset.baseCount ||
        count.textContent.replace(/[^\d]/g, "") ||
        0
      );

      button.dataset.baseCount = String(
        Math.max(0, raw)
      );

      count.textContent = formatNumber(
        Math.max(0, raw + (liked ? 1 : 0))
      );
    }
  }

  function setupLikeButtons() {
    $$(".like-btn, .action-btn.like-btn").forEach(button => {
      if (button.dataset.zyloBound === "true") return;

      button.dataset.zyloBound = "true";

      const page = button.closest(".video-page");

      if (!page) return;

      const id = getVideoId(page);

      const count =
        button.querySelector(".action-count") ||
        button.querySelector(".count");

      if (count && !button.dataset.baseCount) {
        button.dataset.baseCount =
          count.textContent.replace(/[^\d]/g, "") || "0";
      }

      updateLikeUI(page, isLiked(id));

      button.addEventListener("click", event => {
        event.stopPropagation();

        const liked = !isLiked(id);

        setLiked(id, liked);
        updateLikeUI(page, liked);
      });
    });
  }

  /* =========================================================
     DOUBLE TAP LIKE
     ========================================================= */

  function setupDoubleTapLike() {
    $$(".video-page video").forEach(video => {
      if (video.dataset.doubleTapBound === "true") return;

      video.dataset.doubleTapBound = "true";

      let lastTap = 0;

      video.addEventListener("click", () => {
        const now = Date.now();

        if (now - lastTap < 320) {
          const page = video.closest(".video-page");

          if (!page) return;

          const button = $(".like-btn", page);

          if (button && !isLiked(getVideoId(page))) {
            button.click();
          }

          showHeartAnimation(page);
        }

        lastTap = now;
      });
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
      fontSize: "100px",
      color: "#fff",
      textShadow: "0 3px 20px rgba(0,0,0,.5)",
      pointerEvents: "none",
      zIndex: "100",
      opacity: "0",
      transition:
        "transform .25s ease, opacity .25s ease"
    });

    page.appendChild(heart);

    requestAnimationFrame(() => {
      heart.style.opacity = "1";
      heart.style.transform =
        "translate(-50%, -50%) scale(1)";
    });

    setTimeout(() => {
      heart.style.opacity = "0";
      heart.style.transform =
        "translate(-50%, -50%) scale(1.25)";
    }, 300);

    setTimeout(() => heart.remove(), 600);
  }

  /* =========================================================
     SAVE
     ========================================================= */

  function isSaved(id) {
    return getStorage(STORAGE.saved, []).includes(String(id));
  }

  function setSaved(id, saved) {
    let list = getStorage(STORAGE.saved, []);

    id = String(id);

    if (saved) {
      if (!list.includes(id)) list.push(id);
    } else {
      list = list.filter(item => item !== id);
    }

    setStorage(STORAGE.saved, list);
  }

  function updateSaveUI(page, saved) {
    const button = $(".save-btn", page);

    if (!button) return;

    button.classList.toggle("active", saved);
    button.setAttribute(
      "aria-pressed",
      saved ? "true" : "false"
    );
  }

  function setupSaveButtons() {
    $$(".save-btn, .action-btn.save-btn").forEach(button => {
      if (button.dataset.zyloBound === "true") return;

      button.dataset.zyloBound = "true";

      const page = button.closest(".video-page");

      if (!page) return;

      const id = getVideoId(page);

      updateSaveUI(page, isSaved(id));

      button.addEventListener("click", event => {
        event.stopPropagation();

        const saved = !isSaved(id);

        setSaved(id, saved);
        updateSaveUI(page, saved);

        toast(saved ? "Saved" : "Removed from saved");
      });
    });
  }

  /* =========================================================
     FOLLOW
     ========================================================= */

  function creatorIdFromPage(page) {
    return (
      page?.dataset.creatorId ||
      page?.dataset.creator ||
      $(".profile-action", page)?.dataset.creatorId ||
      "zylo_creator"
    );
  }

  function isFollowing(id) {
    return getStorage(STORAGE.following, []).includes(
      String(id)
    );
  }

  function setFollowing(id, following) {
    let list = getStorage(STORAGE.following, []);

    id = String(id);

    if (following) {
      if (!list.includes(id)) list.push(id);
    } else {
      list = list.filter(item => item !== id);
    }

    setStorage(STORAGE.following, list);
  }

  function updateFollowUI(page, following) {
    const button = $(".profile-action", page);

    if (!button) return;

    button.classList.toggle("following", following);

    const badge =
      button.querySelector(".follow-badge") ||
      button.querySelector(".follow-plus");

    if (badge) {
      badge.textContent = following ? "✓" : "+";
    }

    button.setAttribute(
      "aria-pressed",
      following ? "true" : "false"
    );
  }

  function setupFollowButtons() {
    $$(".profile-action").forEach(button => {
      if (button.dataset.zyloFollowBound === "true") return;

      button.dataset.zyloFollowBound = "true";

      const page = button.closest(".video-page");

      const creatorId =
        button.dataset.creatorId ||
        creatorIdFromPage(page);

      if (page) {
        updateFollowUI(page, isFollowing(creatorId));
      }

      button.addEventListener("click", event => {
        event.stopPropagation();

        const following = !isFollowing(creatorId);

        setFollowing(creatorId, following);

        if (page) {
          updateFollowUI(page, following);
        }

        toast(
          following
            ? "Following"
            : "Unfollowed"
        );
      });
    });
  }

  /* =========================================================
     COMMENTS
     ========================================================= */

  function getComments(videoId) {
    const all = getStorage(STORAGE.comments, {});
    return all[String(videoId)] || [];
  }

  function saveComments(videoId, comments) {
    const all = getStorage(STORAGE.comments, {});
    all[String(videoId)] = comments;
    setStorage(STORAGE.comments, all);
  }

  function openCommentPanel(page) {
    const videoId = getVideoId(page);
    const comments = getComments(videoId);

    let panel = $("#zyloCommentPanel");

    if (panel) panel.remove();

    panel = document.createElement("div");
    panel.id = "zyloCommentPanel";

    Object.assign(panel.style, {
      position: "fixed",
      left: "0",
      right: "0",
      bottom: "0",
      maxHeight: "70vh",
      background: "#fff",
      color: "#111",
      zIndex: "99990",
      borderRadius: "18px 18px 0 0",
      padding: "18px",
      boxSizing: "border-box",
      boxShadow: "0 -8px 30px rgba(0,0,0,.25)"
    });

    const listHTML = comments.length
      ? comments
          .map(
            comment => `
              <div style="
                padding:10px 0;
                border-bottom:1px solid #eee;
              ">
                <strong>${escapeHTML(
                  comment.username || "ZYLO User"
                )}</strong>
                <div>${escapeHTML(
                  comment.text || ""
                )}</div>
              </div>
            `
          )
          .join("")
      : `
          <div style="
            padding:30px 0;
            text-align:center;
            color:#777;
          ">
            No comments yet
          </div>
        `;

    panel.innerHTML = `
      <div style="
        display:flex;
        align-items:center;
        justify-content:space-between;
        margin-bottom:12px;
      ">
        <strong>Comments</strong>
        <button
          type="button"
          data-close-comments
          style="
            border:0;
            background:none;
            font-size:24px;
            cursor:pointer;
          "
        >×</button>
      </div>

      <div style="
        overflow:auto;
        max-height:45vh;
      ">
        ${listHTML}
      </div>

      <form
        data-comment-form
        style="
          display:flex;
          gap:8px;
          margin-top:12px;
        "
      >
        <input
          name="comment"
          placeholder="Add a comment..."
          autocomplete="off"
          style="
            flex:1;
            border:1px solid #ddd;
            border-radius:999px;
            padding:11px 14px;
            outline:none;
          "
        >

        <button
          type="submit"
          style="
            border:0;
            border-radius:999px;
            padding:0 18px;
            cursor:pointer;
          "
        >
          Post
        </button>
      </form>
    `;

    document.body.appendChild(panel);

    $("[data-close-comments]", panel)?.addEventListener(
      "click",
      () => panel.remove()
    );

    $("[data-comment-form]", panel)?.addEventListener(
      "submit",
      event => {
        event.preventDefault();

        const input = $(
          'input[name="comment"]',
          panel
        );

        const text = input?.value.trim();

        if (!text) return;

        const owner = getOwnerInfo();

        comments.push({
          text,
          username: owner.username,
          uid: owner.uid,
          createdAt: Date.now()
        });

        saveComments(videoId, comments);

        panel.remove();

        openCommentPanel(page);
      }
    );
  }

  function setupCommentButtons() {
    $$(
      '[aria-label="Comments"], .comment-btn, .comment-action'
    ).forEach(button => {
      if (button.dataset.zyloBound === "true") return;

      button.dataset.zyloBound = "true";

      button.addEventListener("click", event => {
        event.stopPropagation();

        const page = button.closest(".video-page");

        if (page) openCommentPanel(page);
      });
    });
  }

  /* =========================================================
     SHARE
     ========================================================= */

  async function shareVideo(page) {
    const videoId = getVideoId(page);

    const url = `${location.origin}${location.pathname}#video=${encodeURIComponent(
      videoId
    )}`;

    const title = "Watch this video on ZYLO";

    try {
      if (navigator.share) {
        await navigator.share({
          title,
          text: title,
          url
        });

        return;
      }

      if (navigator.clipboard) {
        await navigator.clipboard.writeText(url);
        toast("Link copied");
        return;
      }
    } catch (error) {
      if (error?.name === "AbortError") return;
    }

    toast(url);
  }

  function setupShareButtons() {
    $$(
      ".share-btn, .action-btn.share-btn, .share-action"
    ).forEach(button => {
      if (button.dataset.zyloBound === "true") return;

      button.dataset.zyloBound = "true";

      button.addEventListener("click", event => {
        event.stopPropagation();

        const page = button.closest(".video-page");

        if (page) shareVideo(page);
      });
    });
  }

  /* =========================================================
     MUSIC
     ========================================================= */

  function setupMusicButtons() {
    $$(".music-btn, .music-action").forEach(button => {
      if (button.dataset.zyloBound === "true") return;

      button.dataset.zyloBound = "true";

      button.addEventListener("click", event => {
        event.stopPropagation();

        const page = button.closest(".video-page");
        const video = $("video", page);

        if (!video) return;

        video.muted = !video.muted;

        button.classList.toggle(
          "active",
          !video.muted
        );

        toast(
          video.muted
            ? "Sound off"
            : "Sound on"
        );
      });
    });
  }

  /* =========================================================
     FULLSCREEN
     ========================================================= */

  async function toggleFullscreen(page) {
    if (!page) return;

    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        return;
      }

      if (page.requestFullscreen) {
        await page.requestFullscreen();
        return;
      }

      const video = $("video", page);

      if (video?.webkitEnterFullscreen) {
        video.webkitEnterFullscreen();
      }
    } catch {
      toast("Fullscreen unavailable");
    }
  }

  function setupFullscreenButtons() {
    $(
      ".fullscreen-btn, .fullscreen-action, .fullscreen-button"
    ).forEach(button => {
      if (button.dataset.zyloBound === "true") return;

      button.dataset.zyloBound = "true";

      button.addEventListener("click", event => {
        event.stopPropagation();

        const page = button.closest(".video-page");

        if (page) toggleFullscreen(page);
      });
    });
  }

  /* =========================================================
     CREATE / UPLOAD
     ========================================================= */

  function findCreateButton() {
    return $(
      "#createBtn, .create-btn, .create-button, .create-action, [data-action='create']"
    );
  }

  function findVideoInput() {
    return $("#videoInput");
  }

  function openUploadBox() {
    const box = $("#uploadBox");

    if (!box) {
      const input = findVideoInput();

      if (input) {
        input.click();
        return;
      }

      toast("Upload panel not found");
      return;
    }

    box.style.display = "flex";

    box.removeAttribute("hidden");
    box.classList.add("active");
  }

  function closeUploadBox() {
    const box = $("#uploadBox");

    if (!box) return;

    box.style.display = "none";
    box.classList.remove("active");
    box.setAttribute("hidden", "");
  }

  function setupCreateButton() {
    const button = findCreateButton();

    if (!button) return;

    if (button.dataset.zyloBound === "true") return;

    button.dataset.zyloBound = "true";

    button.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();

      if (!requireLogin()) return;

      openUploadBox();
    });
  }

  function setupUploadCloseButtons() {
    const box = $("#uploadBox");

    if (!box) return;

    $$(
      "[data-close], .close-upload, .upload-close, .modal-close",
      box
    ).forEach(button => {
      if (button.dataset.zyloBound === "true") return;

      button.dataset.zyloBound = "true";

      button.addEventListener("click", event => {
        event.preventDefault();
        closeUploadBox();
      });
    });

    box.addEventListener("click", event => {
      if (event.target === box) {
        closeUploadBox();
      }
    });
  }

  async function uploadVideo(file) {
    if (!file) return;

    if (!file.type.startsWith("video/")) {
      toast("Please select a video");
      return;
    }

    const owner = getOwnerInfo();

    const formData = new FormData();

    formData.append("video", file);
    formData.append("ownerUid", owner.uid);
    formData.append("username", owner.username);
    formData.append("name", owner.name);

    toast("Uploading...");

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/upload`,
        {
          method: "POST",
          body: formData
        }
      );

      if (!response.ok) {
        throw new Error(
          `Upload failed: ${response.status}`
        );
      }

      const data = await response.json();

      const serverURL =
        data.url ||
        data.videoUrl ||
        data.video ||
        data.fileUrl ||
        "";

      const localURL = URL.createObjectURL(file);

      const videoRecord = {
        id:
          data.id ||
          `upload-${Date.now()}-${Math.random()
            .toString(36)
            .slice(2)}`,

        url: serverURL || localURL,

        localUrl: localURL,

        name: file.name,

        ownerUid: owner.uid,

        ownerName: owner.name,

        username: owner.username,

        createdAt: Date.now(),

        local: !serverURL,

        server: Boolean(serverURL)
      };

      addUploadedVideo(videoRecord);

      closeUploadBox();

      toast("Video uploaded");

      addVideoToFeed(videoRecord);
    } catch (error) {
      console.error("ZYLO upload error:", error);

      /*
       * Backend upload failed.
       * We still keep a local copy so the user does not
       * lose the selected video immediately.
       */

      const localURL = URL.createObjectURL(file);

      const videoRecord = {
        id:
          `local-${Date.now()}-${Math.random()
            .toString(36)
            .slice(2)}`,

        url: localURL,

        localUrl: localURL,

        name: file.name,

        ownerUid: owner.uid,

        ownerName: owner.name,

        username: owner.username,

        createdAt: Date.now(),

        local: true,

        server: false
      };

      addUploadedVideo(videoRecord);

      closeUploadBox();

      toast(
        "Server upload failed. Video saved locally."
      );

      addVideoToFeed(videoRecord);
    }
  }

  function setupVideoInput() {
    const input = findVideoInput();

    if (!input) return;

    if (input.dataset.zyloBound === "true") return;

    input.dataset.zyloBound = "true";

    input.addEventListener("change", async event => {
      const file = event.target.files?.[0];

      if (file) {
        await uploadVideo(file);
      }

      input.value = "";
    });
  }

  /* =========================================================
     ADD UPLOADED VIDEO
     ========================================================= */

  function addUploadedVideo(record) {
    const videos = getUploadedVideos();

    const exists = videos.some(
      item =>
        String(item.id) === String(record.id) ||
        (
          item.name === record.name &&
          item.ownerUid === record.ownerUid
        )
    );

    if (exists) return;

    videos.push(record);

    saveUploadedVideos(videos);
  }

  function createVideoPage(record) {
    const page = document.createElement("section");

    page.className = "video-page";

    page.dataset.videoId = String(record.id);

    page.dataset.ownerUid = record.ownerUid || "";

    page.dataset.creatorId =
      record.ownerUid ||
      record.username ||
      "zylo_creator";

    page.dataset.uploaded = "true";

    const source =
      record.url ||
      record.localUrl ||
      LOCAL_VIDEO;

    page.innerHTML = `
      <video
        src="${escapeHTML(source)}"
        playsinline
        webkit-playsinline
        loop
        preload="metadata"
      ></video>

      <div class="video-overlay">
        <div class="video-info">
          <strong>${escapeHTML(
            record.username ||
            record.ownerName ||
            "@zylo_user"
          )}</strong>
        </div>
      </div>
    `;

    const feed = getVideoFeed();

    if (!feed) return page;

    return page;
  }

  function addVideoToFeed(record) {
    const feed = getVideoFeed();

    if (!feed) return;

    const existing = $(
      `.video-page[data-video-id="${CSS.escape(
        String(record.id)
      )}"]`,
      feed
    );

    if (existing) return;

    const page = createVideoPage(record);

    feed.appendChild(page);

    initializeDynamicPage(page);
  }

  function restoreUploadedVideos() {
    const videos = getUploadedVideos();

    videos.forEach(record => {
      /*
       * Important:
       * We restore both server videos and local videos.
       * Old versions restored only local records.
       */

      const feed = getVideoFeed();

      if (!feed) return;

      const exists = $(
        `.video-page[data-video-id="${CSS.escape(
          String(record.id)
        )}"]`,
        feed
      );

      if (!exists) {
        addVideoToFeed(record);
      }
    });
  }

  /* =========================================================
     PROFILE DATA
     ========================================================= */

  function getMyVideos() {
    const owner = getOwnerInfo();

    return getUploadedVideos().filter(video => {
      if (!owner.uid) {
        return (
          !video.ownerUid ||
          video.ownerUid === ""
        );
      }

      return video.ownerUid === owner.uid;
    });
  }

  function getCreatorVideos(creatorId) {
    return getUploadedVideos().filter(
      video =>
        video.ownerUid === creatorId ||
        video.username === creatorId
    );
  }

  /* =========================================================
     OWN PROFILE
     ========================================================= */

  function openOwnProfile() {
    if (
      window.ZYLOAuth &&
      typeof window.ZYLOAuth.openMyProfile === "function"
    ) {
      window.ZYLOAuth.openMyProfile();
      return;
    }

    const profile = getMyProfile();
    const videos = getMyVideos();

    showProfileFallback(
      profile,
      videos,
      true
    );
  }

  /* =========================================================
     CREATOR PROFILE
     ========================================================= */

  function getCreatorData(page) {
    const button = $(".profile-action", page);

    const creatorId =
      page?.dataset.ownerUid ||
      page?.dataset.creatorId ||
      button?.dataset.creatorId ||
      "zylo_creator";

    const record = findUploadedVideo(
      getVideoId(page)
    );

    return {
      uid: creatorId,

      name:
        record?.ownerName ||
        record?.name ||
        "ZYLO Creator",

      username:
        record?.username ||
        "@zylo_creator"
    };
  }

  function openCreatorProfile(page) {
    if (!page) return;

    const creator = getCreatorData(page);

    const videos = getCreatorVideos(
      creator.uid
    );

    showProfileFallback(
      creator,
      videos,
      false
    );
  }

  function showProfileFallback(
    profile,
    videos,
    isOwn
  ) {
    let overlay = $("#zyloProfileOverlay");

    if (overlay) overlay.remove();

    overlay = document.createElement("div");

    overlay.id = "zyloProfileOverlay";

    Object.assign(overlay.style, {
      position: "fixed",
      inset: "0",
      zIndex: "99980",
      background: "#fff",
      color: "#111",
      overflow: "auto"
    });

    const videoHTML = videos.length
      ? videos
          .map(
            video => `
              <div
                data-profile-video="${escapeHTML(
                  String(video.id)
                )}"
                style="
                  position:relative;
                  aspect-ratio:9/16;
                  background:#111;
                  overflow:hidden;
                  cursor:pointer;
                "
              >
                <video
                  src="${escapeHTML(
                    video.url ||
                    video.localUrl ||
                    LOCAL_VIDEO
                  )}"
                  muted
                  playsinline
                  preload="metadata"
                  style="
                    width:100%;
                    height:100%;
                    object-fit:cover;
                  "
                ></video>
              </div>
            `
          )
          .join("")
      : `
          <div style="
            grid-column:1/-1;
            text-align:center;
            padding:50px 20px;
            color:#777;
          ">
            No videos yet
          </div>
        `;

    overlay.innerHTML = `
      <div style="
        position:sticky;
        top:0;
        z-index:2;
        background:#fff;
        display:flex;
        align-items:center;
        padding:14px 16px;
        border-bottom:1px solid #eee;
      ">
        <button
          type="button"
          data-close-profile
          style="
            border:0;
            background:none;
            font-size:28px;
            cursor:pointer;
          "
        >‹</button>

        <strong style="
          margin-left:12px;
        ">
          ${isOwn ? "My Profile" : "Profile"}
        </strong>
      </div>

      <div style="
        padding:25px 20px;
        text-align:center;
      ">
        <div style="
          width:82px;
          height:82px;
          border-radius:50%;
          margin:auto;
          background:#eee;
          display:flex;
          align-items:center;
          justify-content:center;
          font-size:30px;
          overflow:hidden;
        ">
          ${
            profile.avatar
              ? `<img src="${escapeHTML(
                  profile.avatar
                )}" style="width:100%;height:100%;object-fit:cover;">`
              : "Z"
          }
        </div>

        <h2 style="margin:12px 0 4px;">
          ${escapeHTML(
            profile.name || "ZYLO Creator"
          )}
        </h2>

        <div style="color:#777;">
          ${escapeHTML(
            profile.username || "@zylo_creator"
          )}
        </div>

        ${
          profile.bio
            ? `
              <p style="
                max-width:500px;
                margin:12px auto;
              ">
                ${escapeHTML(profile.bio)}
              </p>
            `
            : ""
        }

        <div style="
          margin-top:15px;
          font-weight:600;
        ">
          ${videos.length} Videos
        </div>
      </div>

      <div style="
        display:grid;
        grid-template-columns:repeat(3,1fr);
        gap:2px;
        background:#eee;
      ">
        ${videoHTML}
      </div>
    `;

    document.body.appendChild(overlay);

    $("[data-close-profile]", overlay)?.addEventListener(
      "click",
      () => overlay.remove()
    );

    $$("[data-profile-video]", overlay).forEach(
      item => {
        item.addEventListener("click", () => {
          const id =
            item.dataset.profileVideo;

          overlay.remove();

          const page = $(
            `.video-page[data-video-id="${CSS.escape(
              id
            )}"]`
          );

          if (page) {
            page.scrollIntoView({
              behavior: "smooth",
              block: "start"
            });

            setTimeout(() => {
              playVideo($("video", page));
            }, 500);
          } else {
            toast("Video is not currently in the feed");
          }
        });
      }
    );
  }

  /* =========================================================
     PROFILE BUTTONS
     ========================================================= */

  function setupCreatorProfileButtons() {
    $$(".profile-action").forEach(button => {
      if (button.dataset.zyloProfileBound === "true") {
        return;
      }

      button.dataset.zyloProfileBound = "true";

      button.addEventListener("click", event => {
        /*
         * Do not interfere with follow functionality
         * if the button is being used as a follow button.
         *
         * Existing UI uses profile-action for creator profile.
         */

        event.stopPropagation();

        const page =
          button.closest(".video-page");

        if (!page) return;

        openCreatorProfile(page);
      });
    });
  }

  /* =========================================================
     BOTTOM NAVIGATION
     ========================================================= */

  function setupBottomNavigation() {
    $$(".nav-item").forEach(item => {
      if (item.dataset.zyloBound === "true") return;

      item.dataset.zyloBound = "true";

      item.addEventListener("click", event => {
        const nav = item.dataset.nav;

        if (!nav) return;

        if (nav === "profile") {
          /*
           * auth.js may already handle this button.
           * If it has its own handler, this fallback
           * simply avoids replacing its UI.
           */

          if (
            window.ZYLOAuth &&
            (
              typeof window.ZYLOAuth.openMyProfile ===
                "function" ||
              typeof window.ZYLOAuth.getCurrentUser ===
                "function"
            )
          ) {
            return;
          }

          event.preventDefault();
          event.stopPropagation();

          openOwnProfile();
          return;
        }

        if (nav === "home") {
          event.preventDefault();

          const feed = getVideoFeed();

          if (feed) {
            feed.scrollTo({
              top: 0,
              behavior: "smooth"
            });
          }

          return;
        }

        if (nav === "discover") {
          toast("Discover");
          return;
        }

        if (nav === "inbox") {
          toast("Inbox");
        }
      });
    });
  }

  /* =========================================================
     TOP TABS
     ========================================================= */

  function setupTopTabs() {
    const tabs = $$(".top-bar [data-tab], .top-tabs [data-tab]");

    tabs.forEach(tab => {
      if (tab.dataset.zyloBound === "true") return;

      tab.dataset.zyloBound = "true";

      tab.addEventListener("click", () => {
        const name = tab.dataset.tab;

        if (!name) return;

        if (name === "following") {
          filterFeed("following");
        }

        if (
          name === "for-you" ||
          name === "foryou"
        ) {
          filterFeed("for-you");
        }

        if (name === "live") {
          toast("LIVE");
        }
      });
    });
  }

  function filterFeed(mode) {
    const pages = getVideoPages();

    if (!pages.length) return;

    pages.forEach(page => {
      if (mode === "following") {
        const creatorId =
          page.dataset.ownerUid ||
          page.dataset.creatorId ||
          "zylo_creator";

        page.style.display =
          isFollowing(creatorId)
            ? ""
            : "none";
      } else {
        page.style.display = "";
      }
    });

    const firstVisible =
      pages.find(page => page.style.display !== "none");

    if (firstVisible) {
      firstVisible.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    }
  }

  /* =========================================================
     SEARCH
     ========================================================= */

  function setupSearch() {
    const button = $(
      ".search-btn, .search-button, .search-action, [data-action='search']"
    );

    if (!button) return;

    if (button.dataset.zyloBound === "true") return;

    button.dataset.zyloBound = "true";

    button.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();

      openSearch();
    });
  }

  function openSearch() {
    let overlay = $("#zyloSearchOverlay");

    if (overlay) {
      overlay.remove();
      return;
    }

    overlay = document.createElement("div");

    overlay.id = "zyloSearchOverlay";

    Object.assign(overlay.style, {
      position: "fixed",
      inset: "0",
      background: "#fff",
      color: "#111",
      zIndex: "99970",
      padding: "20px",
      boxSizing: "border-box"
    });

    overlay.innerHTML = `
      <div style="
        display:flex;
        gap:10px;
        align-items:center;
      ">
        <button
          type="button"
          data-close-search
          style="
            border:0;
            background:none;
            font-size:28px;
          "
        >‹</button>

        <input
          data-search-input
          type="search"
          placeholder="Search ZYLO"
          autocomplete="off"
          style="
            flex:1;
            border:1px solid #ddd;
            border-radius:999px;
            padding:12px 16px;
            outline:none;
          "
        >
      </div>

      <div
        data-search-results
        style="margin-top:20px;"
      ></div>
    `;

    document.body.appendChild(overlay);

    const input =
      $("[data-search-input]", overlay);

    const results =
      $("[data-search-results]", overlay);

    $("[data-close-search]", overlay)
      ?.addEventListener(
        "click",
        () => overlay.remove()
      );

    input?.focus();

    input?.addEventListener("input", () => {
      const query =
        input.value.trim().toLowerCase();

      results.innerHTML = "";

      if (!query) return;

      const matches = getVideoPages().filter(
        page => {
          const text =
            page.textContent.toLowerCase();

          const creator =
            page.dataset.creatorId?.toLowerCase() ||
            "";

          return (
            text.includes(query) ||
            creator.includes(query)
          );
        }
      );

      if (!matches.length) {
        results.innerHTML = `
          <div style="
            padding:30px;
            text-align:center;
            color:#777;
          ">
            No results
          </div>
        `;

        return;
      }

      matches.forEach(page => {
        const item =
          document.createElement("div");

        item.textContent =
          page.dataset.creatorId ||
          "ZYLO Video";

        Object.assign(item.style, {
          padding: "14px 8px",
          borderBottom: "1px solid #eee",
          cursor: "pointer"
        });

        item.addEventListener("click", () => {
          overlay.remove();

          page.scrollIntoView({
            behavior: "smooth",
            block: "start"
          });

          playVideo($("video", page));
        });

        results.appendChild(item);
      });
    });
  }

  /* =========================================================
     VIDEO CLICK PAUSE / PLAY
     ========================================================= */

  function setupVideoClick() {
    $$(".video-page video").forEach(video => {
      if (video.dataset.clickBound === "true") {
        return;
      }

      video.dataset.clickBound = "true";

      video.addEventListener("click", event => {
        /*
         * Double tap handler also listens to click.
         * A small delay avoids breaking double-tap Like.
         */

        if (video._clickTimer) {
          clearTimeout(video._clickTimer);
        }

        video._clickTimer = setTimeout(() => {
          if (video.paused) {
            playVideo(video);
          } else {
            video.pause();
          }
        }, 340);
      });
    });
  }

  /* =========================================================
     DYNAMIC PAGE INITIALIZATION
     ========================================================= */

  function initializeDynamicPage(page) {
    if (!page) return;

    const video = $("video", page);

    if (video) {
      video.playsInline = true;
      video.loop = true;
      setupVideoFallback(video);
    }

    setupLikeButtons();
    setupSaveButtons();
    setupCommentButtons();
    setupShareButtons();
    setupMusicButtons();
    setupFullscreenButtons();
    setupFollowButtons();
    setupCreatorProfileButtons();
    setupDoubleTapLike();
    setupVideoClick();
  }

  /* =========================================================
     HASH VIDEO OPEN
     ========================================================= */

  function openHashVideo() {
    const hash = location.hash;

    if (!hash.startsWith("#video=")) return;

    const id = decodeURIComponent(
      hash.substring("#video=".length)
    );

    const page = $(
      `.video-page[data-video-id="${CSS.escape(id)}"]`
    );

    if (!page) return;

    setTimeout(() => {
      page.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });

      playVideo($("video", page));
    }, 300);
  }

  /* =========================================================
     PAGE VISIBILITY
     ========================================================= */

  function setupVisibilityHandling() {
    document.addEventListener(
      "visibilitychange",
      () => {
        if (document.hidden) {
          pauseAllVideos();
        } else {
          const pages = getVideoPages();

          if (!pages.length) return;

          const index = currentVideoIndex();

          playVideo(
            $("video", pages[index])
          );
        }
      }
    );
  }

  /* =========================================================
     RESIZE
     ========================================================= */

  function setupResize() {
    let timer;

    window.addEventListener("resize", () => {
      clearTimeout(timer);

      timer = setTimeout(() => {
        const pages = getVideoPages();

        if (!pages.length) return;

        /*
         * Keep the current video in place after resize.
         * No CSS is changed here.
         */

        const index = currentVideoIndex();

        pages[index]?.scrollIntoView({
          behavior: "auto",
          block: "start"
        });
      }, 150);
    });
  }

  /* =========================================================
     INITIALIZATION
     ========================================================= */

  function initializeZYLO() {
    loadAuthJS();

    initializeVideoSources();

    restoreUploadedVideos();

    setupVideoObserver();

    setupVideoNavigation();

    setupKeyboardNavigation();

    setupLikeButtons();

    setupSaveButtons();

    setupCommentButtons();

    setupShareButtons();

    setupMusicButtons();

    setupFullscreenButtons();

    setupFollowButtons();

    setupDoubleTapLike();

    setupVideoClick();

    setupCreateButton();

    setupUploadCloseButtons();

    setupVideoInput();

    setupCreatorProfileButtons();

    setupBottomNavigation();

    setupTopTabs();

    setupSearch();

    setupVisibilityHandling();

    setupResize();

    openHashVideo();

    /*
     * Start the first visible video.
     */

    setTimeout(() => {
      const pages = getVideoPages();

      if (!pages.length) return;

      const index = currentVideoIndex();

      playVideo($("video", pages[index]));
    }, 500);

    console.log(
      "%cZYLO initialized successfully",
      "font-weight:bold"
    );
  }

  /* =========================================================
     START
     ========================================================= */

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      initializeZYLO,
      { once: true }
    );
  } else {
    initializeZYLO();
  }

})();
