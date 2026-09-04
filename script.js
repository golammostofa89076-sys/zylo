/* =========================================================
   ZYLO - COMPLETE FRONTEND ENGINE
   STEP 1:
   Smooth Video Feed + Scroll Engine + Smart Loading

   UI / CSS / Button Design is intentionally untouched.
   ========================================================= */

(() => {
  "use strict";

  /* =========================================================
     CONFIG
     ========================================================= */

  const CONFIG = {
    API_BASE_URL: "https://zylo-backend-ec5c.onrender.com",

    DEFAULT_VIDEO:
      "./backend/uploads/video1.mp4",

    CDN_VIDEO:
      "https://cdn.jsdelivr.net/gh/golammostofa89076-sys/zylo@main/backend/uploads/video1.mp4",

    STORAGE: {
      UPLOADED_VIDEOS: "zylo_uploaded_videos_v3",
      LIKES: "zylo_likes_v3",
      SAVED: "zylo_saved_v3",
      COMMENTS: "zylo_comments_v3",
      FOLLOWS: "zylo_follows_v3"
    },

    VIDEO: {
      PRELOAD_AHEAD: 1,
      PRELOAD_BEHIND: 1,
      SWIPE_THRESHOLD: 55,
      WHEEL_LOCK_MS: 650,
      SETTLE_DELAY_MS: 120,
      PLAY_RETRY_MS: 250
    }
  };


  /* =========================================================
     BASIC HELPERS
     ========================================================= */

  const $ = (selector, root = document) => {
    try {
      return root.querySelector(selector);
    } catch {
      return null;
    }
  };

  const $$ = (selector, root = document) => {
    try {
      return Array.from(root.querySelectorAll(selector));
    } catch {
      return [];
    }
  };

  const safeJSONParse = (value, fallback) => {
    try {
      return value ? JSON.parse(value) : fallback;
    } catch {
      return fallback;
    }
  };

  const getStorage = (key, fallback = []) => {
    return safeJSONParse(localStorage.getItem(key), fallback);
  };

  const setStorage = (key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.warn("ZYLO storage error:", error);
    }
  };

  const makeId = (prefix = "zylo") => {
    return (
      prefix +
      "_" +
      Date.now().toString(36) +
      "_" +
      Math.random().toString(36).slice(2, 10)
    );
  };

  const escapeHTML = (value) => {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  };

  const isInteractiveTarget = (target) => {
    if (!target) return false;

    return Boolean(
      target.closest(
        "button, a, input, textarea, select, label, .action-btn, .music-btn, .fullscreen-btn, .profile-action, .create-btn, .search-btn, .comment-panel, .modal, .upload-box"
      )
    );
  };


  /* =========================================================
     AUTH HELPERS
     ========================================================= */

  function getCurrentUser() {
    try {
      if (
        window.ZYLOAuth &&
        typeof window.ZYLOAuth.getCurrentUser === "function"
      ) {
        return window.ZYLOAuth.getCurrentUser();
      }

      if (window.ZYLOAuth && window.ZYLOAuth.currentUser) {
        return window.ZYLOAuth.currentUser;
      }
    } catch (error) {
      console.warn("ZYLO auth read error:", error);
    }

    return null;
  }


  function getUserUID() {
    const user = getCurrentUser();

    return (
      user?.uid ||
      user?.id ||
      localStorage.getItem("zylo_uid") ||
      "guest"
    );
  }


  function getUsername() {
    const user = getCurrentUser();

    return (
      user?.displayName ||
      user?.username ||
      localStorage.getItem("zylo_username") ||
      "zylo_creator"
    );
  }


  /* =========================================================
     VIDEO SOURCE HELPERS
     ========================================================= */

  function normalizeVideoSource(source) {
    if (!source) return "";

    try {
      return new URL(source, window.location.href).href;
    } catch {
      return String(source);
    }
  }


  function isDefaultLocalVideo(source) {
    if (!source) return false;

    const clean = String(source).split("?")[0];

    return (
      clean.includes("/backend/uploads/video1.mp4") ||
      clean.endsWith("backend/uploads/video1.mp4") ||
      clean === CONFIG.DEFAULT_VIDEO
    );
  }


  function getFallbackSource(video) {
    const primary =
      video?.dataset?.zyloPrimary ||
      video?.dataset?.src ||
      video?.getAttribute("data-src") ||
      video?.getAttribute("src") ||
      "";

    if (isDefaultLocalVideo(primary)) {
      return CONFIG.CDN_VIDEO;
    }

    return "";
  }


  function captureVideoSource(video) {
    if (!video) return "";

    if (video.dataset.zyloPrimary) {
      return video.dataset.zyloPrimary;
    }

    let source =
      video.dataset.src ||
      video.getAttribute("data-src") ||
      video.getAttribute("src") ||
      "";

    if (!source) {
      const sourceTag = video.querySelector("source");

      if (sourceTag) {
        source =
          sourceTag.dataset.src ||
          sourceTag.getAttribute("data-src") ||
          sourceTag.getAttribute("src") ||
          "";
      }
    }

    if (!source) {
      source = CONFIG.DEFAULT_VIDEO;
    }

    video.dataset.zyloPrimary = source;

    return source;
  }


  /* =========================================================
     VIDEO ENGINE
     ========================================================= */

  const VideoEngine = (() => {
    let feed = null;

    let pages = [];

    let activeIndex = -1;

    let scrollTimer = null;

    let wheelLocked = false;

    let touchStartX = 0;

    let touchStartY = 0;

    let touchLastY = 0;

    let touching = false;

    let initialized = false;

    let observer = null;

    let lastScrollTop = -1;

    let userRequestedNavigation = false;


    /* -------------------------------------------------------
       Get Feed
       ------------------------------------------------------- */

    function getFeed() {
      return $(".video-feed");
    }


    /* -------------------------------------------------------
       Get Visible Video Pages
       ------------------------------------------------------- */

    function getPages() {
      if (!feed) {
        feed = getFeed();
      }

      if (!feed) {
        return [];
      }

      return $$(".video-page", feed).filter((page) => {
        return !page.hidden && page.style.display !== "none";
      });
    }


    /* -------------------------------------------------------
       Get Video Element
       ------------------------------------------------------- */

    function getVideo(page) {
      if (!page) return null;

      return $("video", page);
    }


    /* -------------------------------------------------------
       Prepare Video
       ------------------------------------------------------- */

    function prepareVideo(video) {
      if (!video) return;

      captureVideoSource(video);

      video.playsInline = true;

      video.setAttribute("playsinline", "");

      video.setAttribute("webkit-playsinline", "");

      video.muted = true;

      video.setAttribute("muted", "");

      video.controls = false;

      video.preload = "none";

      video.dataset.zyloPrepared = "true";

      if (!video.dataset.zyloSourceState) {
        video.dataset.zyloSourceState = "idle";
      }

      /*
       Do not remove the initial src immediately.
       The browser may already have started loading it.
       We control preload after registration.
      */
    }


    /* -------------------------------------------------------
       Set Video Source
       ------------------------------------------------------- */

    function ensureSource(video, preloadMode = "metadata") {
      if (!video) return false;

      const primary = captureVideoSource(video);

      if (!primary) {
        return false;
      }

      const currentSrc = video.currentSrc || video.src || "";

      const wanted = normalizeVideoSource(primary);

      if (!currentSrc || currentSrc === window.location.href) {
        video.src = primary;

        video.dataset.zyloSourceState = "primary";

        video.preload = preloadMode;

        return true;
      }

      if (normalizeVideoSource(currentSrc) === wanted) {
        video.preload = preloadMode;

        return true;
      }

      return true;
    }


    /* -------------------------------------------------------
       Remove Source From Distant Videos
       ------------------------------------------------------- */

    function unloadVideo(video) {
      if (!video) return;

      /*
       Never unload the active video.
      */

      if (video.dataset.zyloActive === "true") {
        return;
      }

      /*
       We do not aggressively remove src from every video because
       doing so can cause expensive network re-requests on mobile.
       Instead, simply tell browser not to preload.
      */

      video.preload = "none";
    }


    /* -------------------------------------------------------
       Load Current / Adjacent Videos
       ------------------------------------------------------- */

    function smartLoad(index) {
      if (!pages.length) return;

      pages.forEach((page, i) => {
        const video = getVideo(page);

        if (!video) return;

        const distance = Math.abs(i - index);

        if (distance === 0) {
          video.preload = "auto";
          ensureSource(video, "auto");
          return;
        }

        if (distance <= CONFIG.VIDEO.PRELOAD_AHEAD) {
          video.preload = "metadata";
          ensureSource(video, "metadata");
          return;
        }

        if (distance <= CONFIG.VIDEO.PRELOAD_BEHIND) {
          video.preload = "metadata";
          ensureSource(video, "metadata");
          return;
        }

        unloadVideo(video);
      });
    }


    /* -------------------------------------------------------
       Pause All Except Active
       ------------------------------------------------------- */

    function pauseAll(exceptVideo = null) {
      pages.forEach((page) => {
        const video = getVideo(page);

        if (!video) return;

        if (video !== exceptVideo) {
          try {
            video.pause();
          } catch {}

          video.dataset.zyloActive = "false";
        }
      });
    }


    /* -------------------------------------------------------
       Play Active Video
       ------------------------------------------------------- */

    async function playVideo(video) {
      if (!video) return;

      video.muted = true;

      video.setAttribute("muted", "");

      video.playsInline = true;

      video.setAttribute("playsinline", "");

      try {
        const promise = video.play();

        if (promise && typeof promise.catch === "function") {
          await promise;
        }

        video.dataset.zyloPlaying = "true";
      } catch (error) {
        video.dataset.zyloPlaying = "false";

        /*
         Retry once after source/metadata becomes available.
        */

        setTimeout(() => {
          if (video.dataset.zyloActive === "true") {
            video.play().catch(() => {});
          }
        }, CONFIG.VIDEO.PLAY_RETRY_MS);
      }
    }


    /* -------------------------------------------------------
       Activate Video
       ------------------------------------------------------- */

    async function activate(index, options = {}) {
      if (!pages.length) {
        refresh();
      }

      if (!pages.length) return;

      index = Math.max(0, Math.min(index, pages.length - 1));

      const page = pages[index];

      const video = getVideo(page);

      if (!page) return;

      activeIndex = index;

      pages.forEach((item, i) => {
        item.classList.toggle("active", i === index);

        item.dataset.active = i === index ? "true" : "false";
      });

      pauseAll(video);

      pages.forEach((item, i) => {
        const itemVideo = getVideo(item);

        if (!itemVideo) return;

        itemVideo.dataset.zyloActive =
          i === index ? "true" : "false";
      });

      smartLoad(index);

      if (video) {
        ensureSource(video, "auto");

        video.muted = true;

        video.currentTime = Math.max(0, video.currentTime || 0);

        await playVideo(video);
      }

      updateURL(page, options.updateHash !== false);

      dispatchActiveEvent(page, index);
    }


    /* -------------------------------------------------------
       Dispatch Active Event
       ------------------------------------------------------- */

    function dispatchActiveEvent(page, index) {
      try {
        window.dispatchEvent(
          new CustomEvent("zylo:videochange", {
            detail: {
              index,
              page,
              video: getVideo(page)
            }
          })
        );
      } catch {}
    }


    /* -------------------------------------------------------
       Find Current Page From Scroll Position
       ------------------------------------------------------- */

    function findNearestIndex() {
      if (!feed || !pages.length) return -1;

      const feedRect = feed.getBoundingClientRect();

      const feedCenter =
        feedRect.top + feedRect.height / 2;

      let bestIndex = 0;

      let bestDistance = Infinity;

      pages.forEach((page, index) => {
        const rect = page.getBoundingClientRect();

        const pageCenter =
          rect.top + rect.height / 2;

        const distance =
          Math.abs(pageCenter - feedCenter);

        if (distance < bestDistance) {
          bestDistance = distance;
          bestIndex = index;
        }
      });

      return bestIndex;
    }


    /* -------------------------------------------------------
       Scroll To Page
       ------------------------------------------------------- */

    function scrollToPage(index, behavior = "smooth") {
      if (!pages.length) {
        refresh();
      }

      if (!pages.length) return;

      index = Math.max(
        0,
        Math.min(index, pages.length - 1)
      );

      const page = pages[index];

      if (!page) return;

      userRequestedNavigation = true;

      activeIndex = index;

      page.scrollIntoView({
        behavior,
        block: "start",
        inline: "nearest"
      });

      /*
       Activate immediately so playback does not wait
       for scroll event.
      */

      activate(index, {
        updateHash: true
      });

      setTimeout(() => {
        userRequestedNavigation = false;
      }, 800);
    }


    /* -------------------------------------------------------
       Next
       ------------------------------------------------------- */

    function next() {
      refresh();

      if (!pages.length) return;

      const current =
        activeIndex >= 0
          ? activeIndex
          : findNearestIndex();

      const nextIndex =
        Math.min(current + 1, pages.length - 1);

      if (nextIndex !== current) {
        scrollToPage(nextIndex);
      }
    }


    /* -------------------------------------------------------
       Previous
       ------------------------------------------------------- */

    function previous() {
      refresh();

      if (!pages.length) return;

      const current =
        activeIndex >= 0
          ? activeIndex
          : findNearestIndex();

      const previousIndex =
        Math.max(current - 1, 0);

      if (previousIndex !== current) {
        scrollToPage(previousIndex);
      }
    }


    /* -------------------------------------------------------
       Scroll Settle
       ------------------------------------------------------- */

    function settle() {
      if (!feed || !pages.length) return;

      const index = findNearestIndex();

      if (index < 0) return;

      if (index !== activeIndex) {
        activate(index, {
          updateHash: true
        });
      } else {
        const video = getVideo(pages[index]);

        if (video) {
          pauseAll(video);

          if (video.paused) {
            playVideo(video);
          }
        }
      }

      lastScrollTop = feed.scrollTop;
    }


    /* -------------------------------------------------------
       Scroll Event
       ------------------------------------------------------- */

    function handleScroll() {
      if (!feed) return;

      if (scrollTimer) {
        clearTimeout(scrollTimer);
      }

      scrollTimer = setTimeout(() => {
        settle();
      }, CONFIG.VIDEO.SETTLE_DELAY_MS);
    }


    /* -------------------------------------------------------
       Wheel Event
       ------------------------------------------------------- */

    function handleWheel(event) {
      if (!feed) return;

      /*
       Ignore horizontal wheel.
      */

      if (Math.abs(event.deltaY) < Math.abs(event.deltaX)) {
        return;
      }

      if (Math.abs(event.deltaY) < 10) {
        return;
      }

      /*
       If user is interacting with a button/input,
       don't hijack the wheel.
      */

      if (isInteractiveTarget(event.target)) {
        return;
      }

      event.preventDefault();

      if (wheelLocked) return;

      wheelLocked = true;

      if (event.deltaY > 0) {
        next();
      } else {
        previous();
      }

      setTimeout(() => {
        wheelLocked = false;
      }, CONFIG.VIDEO.WHEEL_LOCK_MS);
    }


    /* -------------------------------------------------------
       Touch Start
       ------------------------------------------------------- */

    function handleTouchStart(event) {
      if (!event.touches || !event.touches.length) {
        return;
      }

      if (isInteractiveTarget(event.target)) {
        touching = false;
        return;
      }

      const touch = event.touches[0];

      touchStartX = touch.clientX;

      touchStartY = touch.clientY;

      touchLastY = touch.clientY;

      touching = true;
    }


    /* -------------------------------------------------------
       Touch Move
       ------------------------------------------------------- */

    function handleTouchMove(event) {
      if (!touching) return;

      if (!event.touches || !event.touches.length) {
        return;
      }

      const touch = event.touches[0];

      touchLastY = touch.clientY;

      const deltaX = touch.clientX - touchStartX;

      const deltaY = touch.clientY - touchStartY;

      /*
       Only consider a vertical gesture.
      */

      if (Math.abs(deltaY) <= Math.abs(deltaX)) {
        return;
      }

      /*
       Once gesture is clearly vertical, prevent the browser
       from creating an unpredictable nested scroll.
      */

      if (Math.abs(deltaY) > 12) {
        event.preventDefault();
      }
    }


    /* -------------------------------------------------------
       Touch End
       ------------------------------------------------------- */

    function handleTouchEnd() {
      if (!touching) return;

      touching = false;

      const deltaY = touchLastY - touchStartY;

      if (Math.abs(deltaY) < CONFIG.VIDEO.SWIPE_THRESHOLD) {
        return;
      }

      if (deltaY < 0) {
        next();
      } else {
        previous();
      }
    }


    /* -------------------------------------------------------
       Keyboard
       ------------------------------------------------------- */

    function handleKeydown(event) {
      if (isInteractiveTarget(event.target)) {
        return;
      }

      switch (event.key) {
        case "ArrowDown":
        case "PageDown":
          event.preventDefault();
          next();
          break;

        case "ArrowUp":
        case "PageUp":
          event.preventDefault();
          previous();
          break;

        case " ":
          /*
           Space only toggles active video if body/feed itself
           is focused, not a form control.
          */

          if (
            event.target === document.body ||
            event.target === feed
          ) {
            event.preventDefault();

            const page = pages[activeIndex];

            const video = getVideo(page);

            if (!video) return;

            if (video.paused) {
              playVideo(video);
            } else {
              video.pause();
            }
          }

          break;
      }
    }


    /* -------------------------------------------------------
       Visibility Change
       ------------------------------------------------------- */

    function handleVisibility() {
      if (document.hidden) {
        pauseAll(null);
        return;
      }

      if (activeIndex >= 0) {
        activate(activeIndex, {
          updateHash: false
        });
      }
    }


    /* -------------------------------------------------------
       Resize
       ------------------------------------------------------- */

    function handleResize() {
      if (!feed) return;

      const index =
        activeIndex >= 0
          ? activeIndex
          : findNearestIndex();

      if (index < 0) return;

      setTimeout(() => {
        scrollToPage(index, "auto");
      }, 80);
    }


    /* -------------------------------------------------------
       Video Error / Fallback
       ------------------------------------------------------- */

    function handleVideoError(event) {
      const video = event.currentTarget;

      if (!video) return;

      const fallback = getFallbackSource(video);

      if (!fallback) {
        return;
      }

      const alreadyFallback =
        video.dataset.zyloFallback === "true";

      if (alreadyFallback) {
        return;
      }

      video.dataset.zyloFallback = "true";

      video.src = fallback;

      video.preload =
        video.dataset.zyloActive === "true"
          ? "auto"
          : "metadata";

      video.load();

      if (video.dataset.zyloActive === "true") {
        playVideo(video);
      }
    }


    /* -------------------------------------------------------
       Register Video
       ------------------------------------------------------- */

    function registerVideo(video) {
      if (!video) return;

      if (video.dataset.zyloEngineRegistered === "true") {
        return;
      }

      prepareVideo(video);

      video.addEventListener(
        "error",
        handleVideoError
      );

      video.addEventListener(
        "loadedmetadata",
        () => {
          if (video.dataset.zyloActive === "true") {
            playVideo(video);
          }
        }
      );

      video.addEventListener(
        "ended",
        () => {
          /*
           Automatically move to the next video only if
           another page exists.
          */

          const page = video.closest(".video-page");

          const index = pages.indexOf(page);

          if (
            index >= 0 &&
            index === activeIndex &&
            index < pages.length - 1
          ) {
            next();
          }
        }
      );

      video.dataset.zyloEngineRegistered = "true";
    }


    /* -------------------------------------------------------
       Refresh Engine
       ------------------------------------------------------- */

    function refresh() {
      feed = getFeed();

      if (!feed) {
        pages = [];
        return;
      }

      pages = getPages();

      pages.forEach((page) => {
        const video = getVideo(page);

        if (video) {
          registerVideo(video);
        }
      });

      /*
       Re-map active index after DOM changes.
      */

      if (activeIndex >= pages.length) {
        activeIndex = pages.length - 1;
      }
    }


    /* -------------------------------------------------------
       Hash
       ------------------------------------------------------- */

    function updateURL(page, enabled = true) {
      if (!enabled || !page) return;

      const id = page.dataset.videoId;

      if (!id) return;

      try {
        history.replaceState(
          null,
          "",
          "#" + encodeURIComponent(id)
        );
      } catch {}
    }


    /* -------------------------------------------------------
       Open Hash Video
       ------------------------------------------------------- */

    function openHashVideo() {
      const hash = window.location.hash.replace(/^#/, "");

      if (!hash) return;

      let id = "";

      try {
        id = decodeURIComponent(hash);
      } catch {
        id = hash;
      }

      if (!id) return;

      const index = pages.findIndex(
        (page) =>
          page.dataset.videoId === id
      );

      if (index < 0) return;

      setTimeout(() => {
        scrollToPage(index, "auto");
      }, 100);
    }


    /* -------------------------------------------------------
       Observer
       ------------------------------------------------------- */

    function createObserver() {
      if (!feed) return;

      if (observer) {
        observer.disconnect();
      }

      observer = new IntersectionObserver(
        (entries) => {
          let bestEntry = null;

          for (const entry of entries) {
            if (!entry.isIntersecting) continue;

            if (
              !bestEntry ||
              entry.intersectionRatio >
                bestEntry.intersectionRatio
            ) {
              bestEntry = entry;
            }
          }

          if (!bestEntry) return;

          const page = bestEntry.target;

          const index = pages.indexOf(page);

          if (index < 0) return;

          /*
           Only switch after a strong intersection.
          */

          if (bestEntry.intersectionRatio >= 0.55) {
            activate(index, {
              updateHash: true
            });
          }
        },
        {
          root: feed,
          threshold: [
            0.25,
            0.5,
            0.55,
            0.75,
            0.9
          ]
        }
      );

      pages.forEach((page) => {
        observer.observe(page);
      });
    }


    /* -------------------------------------------------------
       Initialization
       ------------------------------------------------------- */

    function init() {
      if (initialized) return;

      initialized = true;

      refresh();

      if (!feed || !pages.length) {
        return;
      }

      /*
       IMPORTANT:
       We intentionally use the feed as the scrolling container.
      */

      feed.addEventListener(
        "scroll",
        handleScroll,
        {
          passive: true
        }
      );

      /*
       Capture phase makes this handler reliable even when
       other elements have listeners.
      */

      feed.addEventListener(
        "wheel",
        handleWheel,
        {
          passive: false,
          capture: true
        }
      );

      feed.addEventListener(
        "touchstart",
        handleTouchStart,
        {
          passive: true,
          capture: true
        }
      );

      feed.addEventListener(
        "touchmove",
        handleTouchMove,
        {
          passive: false,
          capture: true
        }
      );

      feed.addEventListener(
        "touchend",
        handleTouchEnd,
        {
          passive: true,
          capture: true
        }
      );

      window.addEventListener(
        "keydown",
        handleKeydown,
        {
          passive: false
        }
      );

      document.addEventListener(
        "visibilitychange",
        handleVisibility
      );

      window.addEventListener(
        "resize",
        handleResize
      );

      window.addEventListener(
        "hashchange",
        openHashVideo
      );

      /*
       scrollend is supported on newer browsers.
       */

      if ("onscrollend" in feed) {
        feed.addEventListener(
          "scrollend",
          settle,
          {
            passive: true
          }
        );
      }

      pages.forEach((page) => {
        const video = getVideo(page);

        if (!video) return;

        registerVideo(video);
      });

      createObserver();

      /*
       Initial active video.
      */

      let initialIndex = findNearestIndex();

      if (initialIndex < 0) {
        initialIndex = 0;
      }

      const hash =
        window.location.hash.replace(/^#/, "");

      if (hash) {
        let decoded = hash;

        try {
          decoded = decodeURIComponent(hash);
        } catch {}

        const hashIndex = pages.findIndex(
          (page) =>
            page.dataset.videoId === decoded
        );

        if (hashIndex >= 0) {
          initialIndex = hashIndex;
        }
      }

      setTimeout(() => {
        scrollToPage(initialIndex, "auto");
      }, 80);
    }


    /* -------------------------------------------------------
       Public API
       ------------------------------------------------------- */

    return {
      init,
      refresh,
      next,
      previous,
      scrollToPage,
      activate,
      settle,

      getPages: () => pages.slice(),

      getActiveIndex: () => activeIndex,

      getActivePage: () =>
        activeIndex >= 0
          ? pages[activeIndex]
          : null,

      getActiveVideo: () =>
        activeIndex >= 0
          ? getVideo(pages[activeIndex])
          : null
    };
  })();


  /* =========================================================
     LIKE SYSTEM
     ========================================================= */

  function getLikeList() {
    return getStorage(CONFIG.STORAGE.LIKES, []);
  }


  function isLiked(videoId) {
    return getLikeList().includes(videoId);
  }


  function setLiked(videoId, liked) {
    let list = getLikeList();

    list = list.filter((id) => id !== videoId);

    if (liked) {
      list.push(videoId);
    }

    setStorage(CONFIG.STORAGE.LIKES, list);
  }


  function updateLikeUI(page) {
    if (!page) return;

    const videoId = page.dataset.videoId;

    if (!videoId) return;

    const button =
      $(".like-btn", page) ||
      $('.action-btn[aria-label="Like"]', page);

    if (!button) return;

    const liked = isLiked(videoId);

    button.classList.toggle("active", liked);

    button.setAttribute(
      "aria-pressed",
      liked ? "true" : "false"
    );
  }


  function showHeartAnimation(page) {
    if (!page) return;

    const heart = document.createElement("div");

    heart.className = "zylo-heart-animation";

    heart.textContent = "♥";

    heart.setAttribute("aria-hidden", "true");

    heart.style.position = "absolute";

    heart.style.left = "50%";

    heart.style.top = "50%";

    heart.style.transform =
      "translate(-50%, -50%) scale(.4)";

    heart.style.fontSize = "92px";

    heart.style.color = "#fff";

    heart.style.pointerEvents = "none";

    heart.style.zIndex = "999";

    heart.style.transition =
      "transform .25s ease, opacity .35s ease";

    page.appendChild(heart);

    requestAnimationFrame(() => {
      heart.style.transform =
        "translate(-50%, -50%) scale(1.15)";
    });

    setTimeout(() => {
      heart.style.opacity = "0";

      heart.style.transform =
        "translate(-50%, -50%) scale(1.35)";
    }, 180);

    setTimeout(() => {
      heart.remove();
    }, 550);
  }


  function setupLikeButtons() {
    $$(".video-page").forEach((page) => {
      const button =
        $(".like-btn", page) ||
        $('.action-btn[aria-label="Like"]', page);

      if (!button) return;

      if (button.dataset.zyloLikeBound === "true") {
        updateLikeUI(page);
        return;
      }

      button.dataset.zyloLikeBound = "true";

      button.addEventListener("click", (event) => {
        event.preventDefault();

        event.stopPropagation();

        const videoId = page.dataset.videoId;

        if (!videoId) return;

        const liked = !isLiked(videoId);

        setLiked(videoId, liked);

        updateLikeUI(page);
      });

      updateLikeUI(page);
    });
  }


  /* =========================================================
     DOUBLE TAP LIKE
     ========================================================= */

  function setupDoubleTapLike() {
    $$(".video-page").forEach((page) => {
      if (page.dataset.zyloDoubleTapBound === "true") {
        return;
      }

      page.dataset.zyloDoubleTapBound = "true";

      let lastTap = 0;

      page.addEventListener(
        "touchend",
        (event) => {
          if (isInteractiveTarget(event.target)) {
            return;
          }

          const now = Date.now();

          if (now - lastTap < 320) {
            const videoId = page.dataset.videoId;

            if (videoId && !isLiked(videoId)) {
              setLiked(videoId, true);
              updateLikeUI(page);
            }

            showHeartAnimation(page);
          }

          lastTap = now;
        },
        {
          passive: true
        }
      );
    });
  }


  /* =========================================================
     SAVE SYSTEM
     ========================================================= */

  function getSavedList() {
    return getStorage(CONFIG.STORAGE.SAVED, []);
  }


  function isSaved(videoId) {
    return getSavedList().includes(videoId);
  }


  function setSaved(videoId, saved) {
    let list = getSavedList();

    list = list.filter((id) => id !== videoId);

    if (saved) {
      list.push(videoId);
    }

    setStorage(CONFIG.STORAGE.SAVED, list);
  }


  function updateSaveUI(page) {
    if (!page) return;

    const videoId = page.dataset.videoId;

    if (!videoId) return;

    const button =
      $(".save-btn", page) ||
      $('.action-btn[aria-label="Save"]', page);

    if (!button) return;

    const saved = isSaved(videoId);

    button.classList.toggle("active", saved);

    button.setAttribute(
      "aria-pressed",
      saved ? "true" : "false"
    );
  }


  function setupSaveButtons() {
    $$(".video-page").forEach((page) => {
      const button =
        $(".save-btn", page) ||
        $('.action-btn[aria-label="Save"]', page);

      if (!button) return;

      if (button.dataset.zyloSaveBound === "true") {
        updateSaveUI(page);
        return;
      }

      button.dataset.zyloSaveBound = "true";

      button.addEventListener("click", (event) => {
        event.preventDefault();

        event.stopPropagation();

        const videoId = page.dataset.videoId;

        if (!videoId) return;

        const saved = !isSaved(videoId);

        setSaved(videoId, saved);

        updateSaveUI(page);
      });

      updateSaveUI(page);
    });
  }


  /* =========================================================
     COMMENT SYSTEM
     ========================================================= */

  function getComments() {
    return getStorage(CONFIG.STORAGE.COMMENTS, {});
  }


  function saveComments(data) {
    setStorage(CONFIG.STORAGE.COMMENTS, data);
  }


  function getVideoComments(videoId) {
    const all = getComments();

    return Array.isArray(all[videoId])
      ? all[videoId]
      : [];
  }


  function addComment(videoId, text) {
    const all = getComments();

    if (!Array.isArray(all[videoId])) {
      all[videoId] = [];
    }

    all[videoId].push({
      id: makeId("comment"),
      text,
      username: getUsername(),
      uid: getUserUID(),
      createdAt: Date.now()
    });

    saveComments(all);

    return all[videoId];
  }


  function closeCommentPanel() {
    const panels = $$(".zylo-comment-panel");

    panels.forEach((panel) => {
      panel.remove();
    });
  }


  function openCommentPanel(page) {
    if (!page) return;

    closeCommentPanel();

    const videoId = page.dataset.videoId;

    if (!videoId) return;

    const comments = getVideoComments(videoId);

    const panel = document.createElement("div");

    panel.className = "zylo-comment-panel";

    panel.style.position = "fixed";

    panel.style.left = "0";

    panel.style.right = "0";

    panel.style.bottom = "0";

    panel.style.zIndex = "5000";

    panel.style.background = "#111";

    panel.style.color = "#fff";

    panel.style.padding = "18px";

    panel.style.borderRadius =
      "18px 18px 0 0";

    panel.style.maxHeight = "70vh";

    panel.style.overflow = "auto";

    const items = comments.length
      ? comments
          .map(
            (comment) => `
              <div style="
                padding:10px 0;
                border-bottom:1px solid rgba(255,255,255,.08);
              ">
                <strong>${escapeHTML(
                  comment.username
                )}</strong>
                <div>${escapeHTML(
                  comment.text
                )}</div>
              </div>
            `
          )
          .join("")
      : `
        <div style="
          opacity:.65;
          padding:20px 0;
          text-align:center;
        ">
          No comments yet
        </div>
      `;

    panel.innerHTML = `
      <div style="
        display:flex;
        justify-content:space-between;
        align-items:center;
        gap:10px;
      ">
        <strong>Comments</strong>

        <button
          type="button"
          data-close-comments
          style="
            background:none;
            border:0;
            color:#fff;
            font-size:22px;
            cursor:pointer;
          "
        >
          ×
        </button>
      </div>

      <div style="
        margin-top:12px;
      ">
        ${items}
      </div>

      <form
        data-comment-form
        style="
          display:flex;
          gap:8px;
          margin-top:14px;
        "
      >
        <input
          type="text"
          name="comment"
          placeholder="Add a comment..."
          autocomplete="off"
          style="
            flex:1;
            min-width:0;
            border:1px solid rgba(255,255,255,.15);
            background:#222;
            color:#fff;
            border-radius:10px;
            padding:10px;
          "
        >

        <button
          type="submit"
          style="
            border:0;
            border-radius:10px;
            padding:10px 14px;
            cursor:pointer;
          "
        >
          Post
        </button>
      </form>
    `;

    document.body.appendChild(panel);

    const close =
      $("[data-close-comments]", panel);

    close?.addEventListener(
      "click",
      closeCommentPanel
    );

    const form =
      $("[data-comment-form]", panel);

    form?.addEventListener(
      "submit",
      (event) => {
        event.preventDefault();

        const input =
          $('input[name="comment"]', form);

        const text =
          input?.value.trim() || "";

        if (!text) return;

        addComment(videoId, text);

        openCommentPanel(page);
      }
    );
  }


  function setupCommentButtons() {
    $$(".video-page").forEach((page) => {
      const button =
        $('[aria-label="Comments"]', page) ||
        $(".comment-action", page) ||
        $(".comment-btn", page);

      if (!button) return;

      if (
        button.dataset.zyloCommentBound === "true"
      ) {
        return;
      }

      button.dataset.zyloCommentBound = "true";

      button.addEventListener("click", (event) => {
        event.preventDefault();

        event.stopPropagation();

        openCommentPanel(page);
      });
    });
  }


  /* =========================================================
     SHARE SYSTEM
     ========================================================= */

  function setupShareButtons() {
    $$(".video-page").forEach((page) => {
      const button =
        $(".share-btn", page) ||
        $('[aria-label="Share"]', page);

      if (!button) return;

      if (
        button.dataset.zyloShareBound === "true"
      ) {
        return;
      }

      button.dataset.zyloShareBound = "true";

      button.addEventListener("click", async (event) => {
        event.preventDefault();

        event.stopPropagation();

        const videoId =
          page.dataset.videoId || "";

        const url =
          window.location.origin +
          window.location.pathname +
          "#" +
          encodeURIComponent(videoId);

        try {
          if (navigator.share) {
            await navigator.share({
              title: "ZYLO",
              text: "Watch this video on ZYLO",
              url
            });

            return;
          }

          await navigator.clipboard.writeText(url);

          showToast("Link copied");
        } catch {
          showToast("Share cancelled");
        }
      });
    });
  }


  /* =========================================================
     MUSIC BUTTON
     ========================================================= */

  function setupMusicButtons() {
    $$(".video-page").forEach((page) => {
      const button =
        $(".music-btn", page) ||
        $(".music-action", page);

      if (!button) return;

      if (
        button.dataset.zyloMusicBound === "true"
      ) {
        return;
      }

      button.dataset.zyloMusicBound = "true";

      button.addEventListener("click", (event) => {
        event.preventDefault();

        event.stopPropagation();

        const video =
          $("video", page);

        if (!video) return;

        /*
         Sound toggle.
        */

        video.muted = !video.muted;

        button.classList.toggle(
          "active",
          !video.muted
        );
      });
    });
  }


  /* =========================================================
     FULLSCREEN
     ========================================================= */

  function setupFullscreenButtons() {
    $$(".video-page").forEach((page) => {
      const button =
        $(".fullscreen-btn", page) ||
        $(".fullscreen-action", page) ||
        $(".fullscreen-button", page);

      if (!button) return;

      if (
        button.dataset.zyloFullscreenBound === "true"
      ) {
        return;
      }

      button.dataset.zyloFullscreenBound = "true";

      button.addEventListener("click", async (event) => {
        event.preventDefault();

        event.stopPropagation();

        const video =
          $("video", page);

        if (!video) return;

        try {
          if (document.fullscreenElement) {
            await document.exitFullscreen();
            return;
          }

          if (video.requestFullscreen) {
            await video.requestFullscreen();
          } else if (video.webkitEnterFullscreen) {
            video.webkitEnterFullscreen();
          }
        } catch (error) {
          console.warn(
            "Fullscreen error:",
            error
          );
        }
      });
    });
  }


  /* =========================================================
     CREATOR PROFILE
     ========================================================= */

  function getCreatorData(page) {
    if (!page) {
      return {
        uid: "",
        username: "zylo_creator",
        avatar: ""
      };
    }

    return {
      uid:
        page.dataset.ownerUid ||
        page.dataset.creatorUid ||
        "",

      username:
        page.dataset.username ||
        page.dataset.creator ||
        "zylo_creator",

      avatar:
        page.dataset.avatar ||
        ""
    };
  }


  function openCreatorProfile(page) {
    const creator = getCreatorData(page);

    const existing =
      $(".zylo-creator-profile");

    existing?.remove();

    const overlay =
      document.createElement("div");

    overlay.className =
      "zylo-creator-profile";

    overlay.style.position = "fixed";

    overlay.style.inset = "0";

    overlay.style.zIndex = "6000";

    overlay.style.background = "#000";

    overlay.style.color = "#fff";

    overlay.innerHTML = `
      <div style="
        position:absolute;
        inset:0;
        overflow:auto;
      ">
        <div style="
          display:flex;
          align-items:center;
          justify-content:space-between;
          padding:18px;
        ">
          <strong>Creator Profile</strong>

          <button
            type="button"
            data-close-creator-profile
            style="
              border:0;
              background:none;
              color:#fff;
              font-size:28px;
              cursor:pointer;
            "
          >
            ×
          </button>
        </div>

        <div style="
          text-align:center;
          padding:35px 20px;
        ">
          <div style="
            width:86px;
            height:86px;
            border-radius:50%;
            margin:0 auto 15px;
            display:flex;
            align-items:center;
            justify-content:center;
            background:#222;
            border:2px solid #fff;
            font-size:34px;
          ">
            Z
          </div>

          <h2 style="margin:8px 0;">
            @${escapeHTML(
              creator.username
            )}
          </h2>

          <button
            type="button"
            data-creator-follow
            style="
              margin-top:12px;
              padding:10px 24px;
              border:0;
              border-radius:20px;
              cursor:pointer;
            "
          >
            Follow
          </button>
        </div>

        <div
          data-creator-video-list
          style="
            display:grid;
            grid-template-columns:
              repeat(3,1fr);
            gap:2px;
          "
        ></div>
      </div>
    `;

    document.body.appendChild(overlay);

    const list =
      $("[data-creator-video-list]", overlay);

    /*
     Show creator's current feed videos.
    */

    VideoEngine.getPages().forEach((item) => {
      const data = getCreatorData(item);

      if (
        creator.uid &&
        data.uid &&
        creator.uid !== data.uid
      ) {
        return;
      }

      if (
        creator.username &&
        data.username &&
        creator.username !== data.username
      ) {
        return;
      }

      const video =
        $("video", item);

      if (!video) return;

      const card =
        document.createElement("div");

      card.style.aspectRatio = "9/16";

      card.style.background = "#111";

      card.style.overflow = "hidden";

      card.innerHTML = `
        <video
          muted
          playsinline
          preload="metadata"
          style="
            width:100%;
            height:100%;
            object-fit:cover;
          "
        ></video>
      `;

      const thumbVideo =
        $("video", card);

      const source =
        captureVideoSource(video);

      if (source) {
        thumbVideo.src = source;
      }

      list.appendChild(card);
    });

    $(
      "[data-close-creator-profile]",
      overlay
    )?.addEventListener(
      "click",
      () => overlay.remove()
    );

    $(
      "[data-creator-follow]",
      overlay
    )?.addEventListener(
      "click",
      () => {
        const follows =
          getStorage(
            CONFIG.STORAGE.FOLLOWS,
            []
          );

        const uid =
          creator.uid ||
          creator.username;

        const index =
          follows.indexOf(uid);

        const button =
          $(
            "[data-creator-follow]",
            overlay
          );

        if (index >= 0) {
          follows.splice(index, 1);

          button.textContent =
            "Follow";
        } else {
          follows.push(uid);

          button.textContent =
            "Following";
        }

        setStorage(
          CONFIG.STORAGE.FOLLOWS,
          follows
        );
      }
    );
  }


  function setupCreatorProfileButtons() {
    $$(".video-page").forEach((page) => {
      const button =
        $(".profile-action", page);

      if (!button) return;

      if (
        button.dataset.zyloProfileBound ===
        "true"
      ) {
        return;
      }

      button.dataset.zyloProfileBound =
        "true";

      /*
       IMPORTANT:
       This button is PROFILE, not Follow.
      */

      button.addEventListener("click", (event) => {
        event.preventDefault();

        event.stopPropagation();

        openCreatorProfile(page);
      });
    });
  }


  /* =========================================================
     TOAST
     ========================================================= */

  function showToast(message) {
    const old =
      $(".zylo-toast");

    old?.remove();

    const toast =
      document.createElement("div");

    toast.className =
      "zylo-toast";

    toast.textContent =
      message;

    toast.style.position = "fixed";

    toast.style.left = "50%";

    toast.style.bottom = "110px";

    toast.style.transform =
      "translateX(-50%)";

    toast.style.zIndex = "10000";

    toast.style.background =
      "rgba(20,20,20,.95)";

    toast.style.color = "#fff";

    toast.style.padding =
      "10px 16px";

    toast.style.borderRadius =
      "20px";

    toast.style.fontSize =
      "14px";

    document.body.appendChild(toast);

    setTimeout(() => {
      toast.remove();
    }, 1800);
  }


  /* =========================================================
     CREATE / UPLOAD
     ========================================================= */

  function getUploadBox() {
    return (
      $("#uploadBox") ||
      $(".upload-box") ||
      $(".upload-modal")
    );
  }


  function openUploadBox() {
    const box = getUploadBox();

    if (!box) return;

    box.hidden = false;

    box.style.display = "flex";
  }


  function closeUploadBox() {
    const box = getUploadBox();

    if (!box) return;

    box.hidden = true;

    box.style.display = "none";
  }


  function setupUploadCloseButtons() {
    const selectors = [
      "#closeUpload",
      ".close-upload",
      ".upload-close",
      "[data-close-upload]"
    ];

    selectors.forEach((selector) => {
      $$(selector).forEach((button) => {
        if (
          button.dataset.zyloUploadCloseBound ===
          "true"
        ) {
          return;
        }

        button.dataset.zyloUploadCloseBound =
          "true";

        button.addEventListener(
          "click",
          (event) => {
            event.preventDefault();

            event.stopPropagation();

            closeUploadBox();
          }
        );
      });
    });
  }


  function setupCreateButtons() {
    const selectors = [
      "#createBtn",
      ".create-btn",
      "[data-create]"
    ];

    selectors.forEach((selector) => {
      $$(selector).forEach((button) => {
        if (
          button.dataset.zyloCreateBound ===
          "true"
        ) {
          return;
        }

        button.dataset.zyloCreateBound =
          "true";

        button.addEventListener(
          "click",
          (event) => {
            event.preventDefault();

            event.stopPropagation();

            openUploadBox();
          }
        );
      });
    });
  }


  async function uploadVideo(file) {
    if (!file) return;

    if (!file.type.startsWith("video/")) {
      showToast("Please select a video file");

      return;
    }

    const formData =
      new FormData();

    formData.append(
      "video",
      file
    );

    const user =
      getCurrentUser();

    if (user?.uid) {
      formData.append(
        "ownerUid",
        user.uid
      );
    }

    formData.append(
      "username",
      getUsername()
    );

    showToast("Uploading...");

    try {
      const response =
        await fetch(
          `${CONFIG.API_BASE_URL}/api/upload`,
          {
            method: "POST",
            body: formData
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data?.message ||
          "Upload failed"
        );
      }

      const url =
        data?.url ||
        data?.videoUrl ||
        data?.fileUrl;

      if (!url) {
        throw new Error(
          "Upload succeeded but video URL is missing"
        );
      }

      const videoData = {
        id: makeId("video"),
        videoId: makeId("video"),
        url,
        ownerUid:
          user?.uid || "",
        username:
          getUsername(),
        createdAt:
          Date.now()
      };

      saveUploadedVideo(videoData);

      createVideoPage(videoData);

      closeUploadBox();

      VideoEngine.refresh();

      VideoEngine.activate(
        VideoEngine.getPages().length - 1
      );

      setupDynamicFeatures();

      showToast("Video uploaded");
    } catch (error) {
      console.warn(
        "Backend upload failed:",
        error
      );

      /*
       Local browser fallback.
       */

      try {
        const localUrl =
          URL.createObjectURL(file);

        const videoData = {
          id: makeId("localvideo"),
          videoId: makeId("localvideo"),
          url: localUrl,
          local: true,
          ownerUid:
            user?.uid || "",
          username:
            getUsername(),
          createdAt:
            Date.now()
        };

        saveUploadedVideo(videoData);

        createVideoPage(videoData);

        closeUploadBox();

        VideoEngine.refresh();

        VideoEngine.activate(
          VideoEngine.getPages().length - 1
        );

        setupDynamicFeatures();

        showToast(
          "Saved locally. Backend upload failed."
        );
      } catch (localError) {
        console.error(
          "Local upload failed:",
          localError
        );

        showToast(
          "Upload failed"
        );
      }
    }
  }


  function setupUploadInput() {
    const input =
      $("#videoInput") ||
      $('input[type="file"][accept*="video"]');

    if (!input) return;

    if (
      input.dataset.zyloUploadInputBound ===
      "true"
    ) {
      return;
    }

    input.dataset.zyloUploadInputBound =
      "true";

    input.addEventListener(
      "change",
      async () => {
        const file =
          input.files?.[0];

        if (!file) return;

        await uploadVideo(file);

        /*
         Allow selecting the same file again.
        */

        input.value = "";
      }
    );
  }


  function getUploadedVideos() {
    return getStorage(
      CONFIG.STORAGE.UPLOADED_VIDEOS,
      []
    );
  }


  function saveUploadedVideo(data) {
    const list =
      getUploadedVideos();

    list.push(data);

    /*
     Keep local storage reasonably small.
    */

    if (list.length > 100) {
      list.splice(
        0,
        list.length - 100
      );
    }

    setStorage(
      CONFIG.STORAGE.UPLOADED_VIDEOS,
      list
    );
  }


  /* =========================================================
     CREATE VIDEO PAGE
     ========================================================= */

  function createVideoPage(data) {
    const feed =
      $(".video-feed");

    if (!feed || !data) return null;

    const page =
      document.createElement("section");

    page.className =
      "video-page";

    page.dataset.videoId =
      data.videoId ||
      data.id ||
      makeId("video");

    if (data.ownerUid) {
      page.dataset.ownerUid =
        data.ownerUid;
    }

    page.dataset.username =
      data.username ||
      "zylo_creator";

    page.innerHTML = `
      <video
        class="video-player"
        data-src="${escapeHTML(data.url)}"
        muted
        playsinline
        webkit-playsinline
        preload="none"
      ></video>
    `;

    /*
     Preserve existing overlay/UI by cloning the
     structure of the first existing page when possible.
     */

    const template =
      $(".video-page", feed);

    if (template) {
      const clone =
        template.cloneNode(true);

      clone.dataset.videoId =
        page.dataset.videoId;

      if (data.ownerUid) {
        clone.dataset.ownerUid =
          data.ownerUid;
      }

      clone.dataset.username =
        data.username ||
        "zylo_creator";

      const oldVideo =
        $("video", clone);

      if (oldVideo) {
        oldVideo.removeAttribute("src");

        oldVideo.dataset.src =
          data.url;

        oldVideo.dataset.zyloPrimary =
          data.url;

        oldVideo.load();
      }

      feed.appendChild(clone);

      return clone;
    }

    feed.appendChild(page);

    return page;
  }


  /* =========================================================
     RESTORE UPLOADED VIDEOS
     ========================================================= */

  function restoreUploadedVideos() {
    const feed =
      $(".video-feed");

    if (!feed) return;

    const uploaded =
      getUploadedVideos();

    if (!uploaded.length) {
      return;
    }

    const existingIds =
      new Set(
        $$(".video-page", feed)
          .map(
            (page) =>
              page.dataset.videoId
          )
          .filter(Boolean)
      );

    uploaded.forEach((data) => {
      const id =
        data.videoId ||
        data.id;

      if (!id) return;

      if (existingIds.has(id)) {
        return;
      }

      createVideoPage(data);
    });
  }


  /* =========================================================
     SEARCH
     ========================================================= */

  function setupSearch() {
    const buttons = [
      ...$$(".search-btn"),
      ...$$(".search-action"),
      ...$$('[aria-label="Search"]')
    ];

    buttons.forEach((button) => {
      if (
        button.dataset.zyloSearchBound ===
        "true"
      ) {
        return;
      }

      button.dataset.zyloSearchBound =
        "true";

      button.addEventListener(
        "click",
        (event) => {
          event.preventDefault();

          event.stopPropagation();

          openSearch();
        }
      );
    });
  }


  function openSearch() {
    const existing =
      $(".zylo-search-overlay");

    existing?.remove();

    const overlay =
      document.createElement("div");

    overlay.className =
      "zylo-search-overlay";

    overlay.style.position =
      "fixed";

    overlay.style.inset = "0";

    overlay.style.zIndex = "7000";

    overlay.style.background =
      "#000";

    overlay.style.color =
      "#fff";

    overlay.innerHTML = `
      <div style="
        padding:20px;
      ">
        <div style="
          display:flex;
          gap:10px;
          align-items:center;
        ">
          <input
            type="search"
            data-zylo-search-input
            placeholder="Search ZYLO"
            autocomplete="off"
            style="
              flex:1;
              background:#1d1d1d;
              color:#fff;
              border:1px solid #333;
              border-radius:12px;
              padding:12px;
              outline:none;
            "
          >

          <button
            type="button"
            data-close-search
            style="
              border:0;
              background:none;
              color:#fff;
              font-size:25px;
            "
          >
            ×
          </button>
        </div>

        <div
          data-search-results
          style="margin-top:20px;"
        ></div>
      </div>
    `;

    document.body.appendChild(
      overlay
    );

    const input =
      $(
        "[data-zylo-search-input]",
        overlay
      );

    const results =
      $(
        "[data-search-results]",
        overlay
      );

    const render =
      () => {
        const query =
          input.value
            .trim()
            .toLowerCase();

        if (!query) {
          results.innerHTML = "";
          return;
        }

        const pages =
          VideoEngine.getPages();

        const matches =
          pages.filter((page) => {
            const text =
              page.textContent
                .toLowerCase();

            return text.includes(query);
          });

        if (!matches.length) {
          results.innerHTML = `
            <div style="
              opacity:.6;
              padding:20px;
            ">
              No results
            </div>
          `;

          return;
        }

        results.innerHTML =
          matches
            .map(
              (page, index) => `
                <button
                  type="button"
                  data-search-video-id="${escapeHTML(
                    page.dataset.videoId
                  )}"
                  style="
                    display:block;
                    width:100%;
                    text-align:left;
                    background:#151515;
                    color:#fff;
                    border:0;
                    border-bottom:1px solid #222;
                    padding:14px;
                    cursor:pointer;
                  "
                >
                  ${escapeHTML(
                    page.dataset.username ||
                    page.dataset.creator ||
                    "ZYLO video"
                  )}
                </button>
              `
            )
            .join("");

        $$(
          "[data-search-video-id]",
          results
        ).forEach((button) => {
          button.addEventListener(
            "click",
            () => {
              const id =
                button.dataset
                  .searchVideoId;

              const pages =
                VideoEngine.getPages();

              const index =
                pages.findIndex(
                  (page) =>
                    page.dataset.videoId ===
                    id
                );

              if (index >= 0) {
                overlay.remove();

                VideoEngine.scrollToPage(
                  index
                );
              }
            }
          );
        });
      };

    input?.addEventListener(
      "input",
      render
    );

    $(
      "[data-close-search]",
      overlay
    )?.addEventListener(
      "click",
      () => overlay.remove()
    );

    input?.focus();
  }


  /* =========================================================
     NAVIGATION
     ========================================================= */

  function openOwnProfile() {
    try {
      if (
        window.ZYLOAuth &&
        typeof window.ZYLOAuth.openMyProfile ===
          "function"
      ) {
        window.ZYLOAuth.openMyProfile();
        return;
      }
    } catch (error) {
      console.warn(
        "ZYLO profile error:",
        error
      );
    }

    showProfileFallback();
  }


  function showProfileFallback() {
    const old =
      $(".zylo-own-profile");

    old?.remove();

    const user =
      getCurrentUser();

    const username =
      getUsername();

    const overlay =
      document.createElement("div");

    overlay.className =
      "zylo-own-profile";

    overlay.style.position =
      "fixed";

    overlay.style.inset = "0";

    overlay.style.zIndex =
      "6500";

    overlay.style.background =
      "#000";

    overlay.style.color =
      "#fff";

    overlay.innerHTML = `
      <div style="
        height:100%;
        overflow:auto;
        padding:20px;
      ">
        <div style="
          display:flex;
          justify-content:space-between;
          align-items:center;
        ">
          <strong>My Profile</strong>

          <button
            type="button"
            data-close-own-profile
            style="
              background:none;
              color:#fff;
              border:0;
              font-size:28px;
            "
          >
            ×
          </button>
        </div>

        <div style="
          text-align:center;
          padding:40px 20px;
        ">
          <div style="
            width:90px;
            height:90px;
            border-radius:50%;
            background:#222;
            border:2px solid #fff;
            display:flex;
            align-items:center;
            justify-content:center;
            margin:0 auto 15px;
            font-size:36px;
          ">
            Z
          </div>

          <h2>
            @${escapeHTML(username)}
          </h2>

          ${
            user?.email
              ? `
                <div style="
                  opacity:.6;
                  margin-top:5px;
                ">
                  ${escapeHTML(
                    user.email
                  )}
                </div>
              `
              : ""
          }
        </div>

        <h3>My Videos</h3>

        <div
          data-my-videos
          style="
            display:grid;
            grid-template-columns:
              repeat(3,1fr);
            gap:2px;
          "
        ></div>
      </div>
    `;

    document.body.appendChild(
      overlay
    );

    const myVideos =
      $(
        "[data-my-videos]",
        overlay
      );

    const uid =
      getUserUID();

    VideoEngine.getPages().forEach(
      (page) => {
        const owner =
          page.dataset.ownerUid ||
          "";

        if (
          owner &&
          uid !== "guest" &&
          owner !== uid
        ) {
          return;
        }

        const video =
          $("video", page);

        if (!video) return;

        const card =
          document.createElement("div");

        card.style.aspectRatio =
          "9/16";

        card.style.background =
          "#111";

        const thumb =
          document.createElement(
            "video"
          );

        thumb.muted = true;

        thumb.playsInline =
          true;

        thumb.preload =
          "metadata";

        thumb.style.width =
          "100%";

        thumb.style.height =
          "100%";

        thumb.style.objectFit =
          "cover";

        const source =
          captureVideoSource(video);

        if (source) {
          thumb.src = source;
        }

        card.appendChild(thumb);

        myVideos.appendChild(
          card
        );
      }
    );

    $(
      "[data-close-own-profile]",
      overlay
    )?.addEventListener(
      "click",
      () => overlay.remove()
    );
  }


  function setupBottomNavigation() {
    $$(".nav-item").forEach((item) => {
      if (
        item.dataset.zyloNavBound ===
        "true"
      ) {
        return;
      }

      item.dataset.zyloNavBound =
        "true";

      item.addEventListener(
        "click",
        (event) => {
          const nav =
            item.dataset.nav;

          /*
           Auth.js owns Profile when available.
          */

          if (
            nav === "profile" &&
            window.ZYLOAuth
          ) {
            return;
          }

          if (nav === "profile") {
            event.preventDefault();

            event.stopPropagation();

            openOwnProfile();

            return;
          }

          if (nav === "home") {
            event.preventDefault();

            event.stopPropagation();

            VideoEngine.refresh();

            VideoEngine.scrollToPage(
              0
            );

            return;
          }

          if (
            nav === "discover" ||
            nav === "search"
          ) {
            event.preventDefault();

            event.stopPropagation();

            openSearch();

            return;
          }

          if (nav === "create") {
            event.preventDefault();

            event.stopPropagation();

            openUploadBox();
          }
        }
      );
    });
  }


  /* =========================================================
     TOP TABS
     ========================================================= */

  function setupTopTabs() {
    const tabs =
      $$(".top-tab");

    tabs.forEach((tab) => {
      if (
        tab.dataset.zyloTabBound ===
        "true"
      ) {
        return;
      }

      tab.dataset.zyloTabBound =
        "true";

      tab.addEventListener(
        "click",
        (event) => {
          event.preventDefault();

          event.stopPropagation();

          const value =
            tab.dataset.tab ||
            tab.dataset.feed ||
            tab.textContent
              .trim()
              .toLowerCase();

          if (
            value.includes("for") ||
            value === "foryou"
          ) {
            showAllVideos();
            return;
          }

          if (
            value.includes("following")
          ) {
            showFollowingVideos();
            return;
          }
        }
      );
    });
  }


  function showAllVideos() {
    const pages =
      $$(".video-page");

    pages.forEach((page) => {
      page.hidden = false;
      page.style.display = "";
    });

    VideoEngine.refresh();

    VideoEngine.activate(
      Math.max(
        0,
        VideoEngine.getActiveIndex()
      ),
      {
        updateHash: false
      }
    );
  }


  function showFollowingVideos() {
    const follows =
      getStorage(
        CONFIG.STORAGE.FOLLOWS,
        []
      );

    const pages =
      $$(".video-page");

    pages.forEach((page) => {
      const creator =
        page.dataset.ownerUid ||
        page.dataset.creatorUid ||
        page.dataset.username ||
        page.dataset.creator ||
        "";

      const shouldShow =
        follows.includes(creator);

      page.hidden =
        follows.length
          ? !shouldShow
          : false;

      page.style.display =
        follows.length && !shouldShow
          ? "none"
          : "";
    });

    VideoEngine.refresh();

    if (VideoEngine.getPages().length) {
      VideoEngine.activate(0, {
        updateHash: false
      });
    }
  }


  /* =========================================================
     VIDEO CLICK
     ========================================================= */

  function setupVideoClick() {
    $$(".video-page").forEach((page) => {
      const video =
        $("video", page);

      if (!video) return;

      if (
        video.dataset.zyloClickBound ===
        "true"
      ) {
        return;
      }

      video.dataset.zyloClickBound =
        "true";

      video.addEventListener(
        "click",
        (event) => {
          if (
            isInteractiveTarget(
              event.target
            )
          ) {
            return;
          }

          /*
           Single tap = play/pause.
           Double tap is handled separately.
          */

          if (event.detail >= 2) {
            return;
          }

          if (video.paused) {
            video.muted = true;

            video.play().catch(() => {});
          } else {
            video.pause();
          }
        }
      );
    });
  }


  /* =========================================================
     DYNAMIC FEATURES
     ========================================================= */

  function setupDynamicFeatures() {
    setupLikeButtons();

    setupSaveButtons();

    setupCommentButtons();

    setupShareButtons();

    setupMusicButtons();

    setupFullscreenButtons();

    setupCreatorProfileButtons();

    setupDoubleTapLike();

    setupVideoClick();

    setupUploadCloseButtons();

    VideoEngine.refresh();
  }


  /* =========================================================
     AUTH JS LOADER
     ========================================================= */

  function loadAuthJS() {
    if (
      window.ZYLOAuth ||
      document.querySelector(
        'script[data-zylo-auth="true"]'
      )
    ) {
      return;
    }

    const script =
      document.createElement("script");

    script.src =
      "./auth.js";

    script.type =
      "module";

    script.dataset.zyloAuth =
      "true";

    script.onload = () => {
      console.log(
        "ZYLO Auth loaded"
      );
    };

    script.onerror = () => {
      console.warn(
        "ZYLO Auth could not be loaded"
      );
    };

    document.head.appendChild(
      script
    );
  }


  /* =========================================================
     RESCAN AFTER DOM CHANGES
     ========================================================= */

  function observeDOM() {
    const feed =
      $(".video-feed");

    if (!feed) return;

    const mutationObserver =
      new MutationObserver(
        (mutations) => {
          let changed = false;

          for (const mutation of mutations) {
            if (
              mutation.addedNodes.length ||
              mutation.removedNodes.length
            ) {
              changed = true;
              break;
            }
          }

          if (!changed) return;

          VideoEngine.refresh();

          setupDynamicFeatures();
        }
      );

    mutationObserver.observe(
      feed,
      {
        childList: true,
        subtree: true
      }
    );
  }


  /* =========================================================
     INITIALIZATION
     ========================================================= */

  function initializeZYLO() {
    /*
     Restore persisted uploads first.
    */

    restoreUploadedVideos();

    /*
     Start Video Engine.
    */

    VideoEngine.init();

    /*
     Buttons / interaction.
    */

    setupDynamicFeatures();

    setupCreateButtons();

    setupUploadInput();

    setupSearch();

    setupBottomNavigation();

    setupTopTabs();

    /*
     Auth is intentionally loaded after core video
     system initialization.
    */

    loadAuthJS();

    /*
     Observe future uploaded/dynamic videos.
    */

    observeDOM();

    /*
     Make sure current video is active.
    */

    setTimeout(() => {
      VideoEngine.refresh();

      if (
        VideoEngine.getPages().length
      ) {
        const index =
          VideoEngine.getActiveIndex();

        VideoEngine.activate(
          index >= 0 ? index : 0,
          {
            updateHash: true
          }
        );
      }
    }, 250);

    console.log(
      "ZYLO Video Engine initialized"
    );
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
      initializeZYLO,
      {
        once: true
      }
    );
  } else {
    initializeZYLO();
  }


  /* =========================================================
     GLOBAL API
     ========================================================= */

  window.ZYLOVideoEngine =
    VideoEngine;

})();
