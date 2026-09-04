/* =========================================================
   ZYLO — Functional Script
   VERSION: 2.0
   UI/CSS LOCKED — functionality only
   ========================================================= */

(() => {
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
     BASIC HELPERS
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
      return `${(n / 1000000)
        .toFixed(1)
        .replace(".0", "")}M`;
    }

    if (n >= 1000) {
      return `${(n / 1000)
        .toFixed(1)
        .replace(".0", "")}K`;
    }

    return String(n);
  }

  function sleep(ms) {
    return new Promise(resolve =>
      setTimeout(resolve, ms)
    );
  }

  /* =========================================================
     TOAST
     ========================================================= */

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
        zIndex: "999999",
        background: "rgba(0,0,0,.86)",
        color: "#fff",
        padding: "10px 16px",
        borderRadius: "999px",
        fontSize: "14px",
        pointerEvents: "none",
        opacity: "0",
        transition: "opacity .2s ease",
        whiteSpace: "nowrap"
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

  /* =========================================================
     AUTH
     ========================================================= */

  function getCurrentUser() {
    try {
      if (
        window.ZYLOAuth &&
        typeof window.ZYLOAuth.getCurrentUser ===
          "function"
      ) {
        return window.ZYLOAuth.getCurrentUser();
      }

      return (
        window.ZYLOAuth?.currentUser ||
        null
      );
    } catch {
      return null;
    }
  }

  function getMyProfile() {
    const saved = safeJSONParse(
      localStorage.getItem(
        STORAGE.profile
      ),
      null
    );

    return saved
      ? { ...DEFAULT_PROFILE, ...saved }
      : { ...DEFAULT_PROFILE };
  }

  function saveMyProfile(profile) {
    setStorage(
      STORAGE.profile,
      profile
    );
  }

  function getOwnerInfo() {
    const user = getCurrentUser();
    const profile = getMyProfile();

    if (user) {
      return {
        uid: user.uid || "",
        name:
          user.displayName ||
          profile.name ||
          "ZYLO User",
        username:
          profile.username ||
          user.email?.split("@")[0] ||
          "@zylo_user"
      };
    }

    return {
      uid: "",
      name:
        profile.name ||
        "ZYLO User",
      username:
        profile.username ||
        "@zylo_user"
    };
  }

  function loadAuthJS() {
    if (
      window.ZYLOAuth ||
      document.querySelector(
        'script[src*="auth.js"]'
      )
    ) {
      return;
    }

    const script =
      document.createElement("script");

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
        typeof window.ZYLOAuth.openAuth ===
          "function"
      ) {
        window.ZYLOAuth.openAuth("login");
        return false;
      }

      if (
        window.ZYLOAuth &&
        typeof window.ZYLOAuth.showAuth ===
          "function"
      ) {
        window.ZYLOAuth.showAuth("login");
        return false;
      }
    } catch {}

    document.dispatchEvent(
      new CustomEvent(
        "zylo:login-required"
      )
    );

    return false;
  }

  /* =========================================================
     VIDEO ENGINE
     ========================================================= */

  const VideoEngine = {
    feed: null,
    pages: [],
    activeIndex: -1,
    initialized: false,
    scrollTimer: null,
    wheelTimer: null,
    touchStartX: 0,
    touchStartY: 0,
    touchTracking: false,
    settling: false,

    init() {
      this.feed = $(".video-feed");

      if (!this.feed) {
        return;
      }

      this.captureVideoSources();
      this.refreshPages();

      this.setupScroll();
      this.setupWheel();
      this.setupTouch();
      this.setupKeyboard();
      this.setupVisibility();
      this.setupVideoErrors();

      this.initialized = true;

      this.refresh();

      requestAnimationFrame(() => {
        this.refresh();
        this.activateNearest();
      });
    },

    refresh() {
      if (!this.feed) return;

      this.refreshPages();

      if (!this.pages.length) return;

      const nearest =
        this.findNearestIndex();

      if (
        this.activeIndex < 0 ||
        nearest !== this.activeIndex
      ) {
        this.activate(
          nearest,
          false
        );
      } else {
        this.prepareWindow(
          this.activeIndex
        );
      }
    },

    refreshPages() {
      if (!this.feed) return;

      this.pages = $$(
        ".video-page",
        this.feed
      );

      this.pages.forEach(
        (page, index) => {
          page.dataset.zyloIndex =
            String(index);

          const video = $(
            "video",
            page
          );

          if (!video) return;

          video.playsInline = true;
          video.setAttribute(
            "playsinline",
            ""
          );
          video.setAttribute(
            "webkit-playsinline",
            ""
          );
          video.loop = true;
          video.muted = true;

          if (
            !video.dataset
              .zyloPrimarySrc
          ) {
            const source =
              video.getAttribute(
                "src"
              ) ||
              video.dataset.src ||
              LOCAL_VIDEO;

            video.dataset.zyloPrimarySrc =
              source;
          }
        }
      );
    },

    captureVideoSources() {
      const videos = $$(
        ".video-feed video, .video-page video"
      );

      videos.forEach(video => {
        if (
          !video.dataset
            .zyloPrimarySrc
        ) {
          const source =
            video.getAttribute(
              "src"
            ) ||
            video.dataset.src ||
            LOCAL_VIDEO;

          video.dataset.zyloPrimarySrc =
            source;
        }

        /*
         * Remove initial src so the browser
         * does not try to download every
         * video at page load.
         */
        video.removeAttribute("src");

        video.preload = "none";
      });
    },

    getPrimarySource(video) {
      return (
        video?.dataset
          ?.zyloPrimarySrc ||
        video?.dataset?.src ||
        LOCAL_VIDEO
      );
    },

    getFallbackSource(video) {
      const primary =
        this.getPrimarySource(
          video
        );

      if (
        primary.includes(
          "backend/uploads/video1.mp4"
        ) ||
        primary === LOCAL_VIDEO
      ) {
        return CDN_VIDEO;
      }

      return "";
    },

    load(video, mode = "near") {
      if (!video) return;

      const source =
        this.getPrimarySource(
          video
        );

      if (!source) return;

      const current =
        video.getAttribute("src");

      if (current !== source) {
        video.setAttribute(
          "src",
          source
        );

        video.dataset.zyloLoadedSource =
          source;

        video.load();
      }

      if (mode === "active") {
        video.preload = "auto";
      } else if (mode === "near") {
        /*
         * Metadata only for nearby videos.
         * This prevents multiple huge files
         * from downloading together.
         */
        video.preload = "metadata";
      } else {
        video.preload = "none";
      }
    },

    unload(video) {
      if (!video) return;

      try {
        video.pause();
      } catch {}

      video.preload = "none";

      /*
       * Keep the source attached for stability.
       * We only tell the browser not to preload.
       */
    },

    prepareWindow(index) {
      if (!this.pages.length) return;

      const start =
        Math.max(0, index - 1);

      const end =
        Math.min(
          this.pages.length - 1,
          index + 1
        );

      this.pages.forEach(
        (page, i) => {
          const video = $(
            "video",
            page
          );

          if (!video) return;

          if (i === index) {
            this.load(
              video,
              "active"
            );
          } else if (
            i >= start &&
            i <= end
          ) {
            this.load(
              video,
              "near"
            );
          } else {
            this.unload(video);
          }
        }
      );
    },

    pauseOthers(activeVideo) {
      $$("video").forEach(
        video => {
          if (
            video !== activeVideo
          ) {
            try {
              video.pause();
            } catch {}
          }
        }
      );
    },

    play(video) {
      if (!video) return;

      this.pauseOthers(video);

      video.muted = true;
      video.playsInline = true;

      const promise =
        video.play();

      if (
        promise &&
        typeof promise.catch ===
          "function"
      ) {
        promise.catch(() => {
          /*
           * Autoplay can be blocked by
           * browser policy. Muted autoplay
           * normally works.
           */
        });
      }
    },

    pauseAll() {
      $$("video").forEach(
        video => {
          try {
            video.pause();
          } catch {}
        }
      );
    },

    findNearestIndex() {
      if (!this.feed || !this.pages.length) {
        return 0;
      }

      const feedRect =
        this.feed.getBoundingClientRect();

      const center =
        feedRect.top +
        feedRect.height / 2;

      let nearest = 0;
      let distance = Infinity;

      this.pages.forEach(
        (page, index) => {
          if (
            page.style.display ===
            "none"
          ) {
            return;
          }

          const rect =
            page.getBoundingClientRect();

          const pageCenter =
            rect.top +
            rect.height / 2;

          const d =
            Math.abs(
              pageCenter - center
            );

          if (d < distance) {
            distance = d;
            nearest = index;
          }
        }
      );

      return nearest;
    },

    activate(index, scroll = true) {
      if (!this.pages.length) return;

      index = Math.max(
        0,
        Math.min(
          index,
          this.pages.length - 1
        )
      );

      this.activeIndex = index;

      const page =
        this.pages[index];

      const video = $(
        "video",
        page
      );

      if (!video) return;

      this.prepareWindow(index);

      if (scroll) {
        this.scrollTo(
          index,
          true
        );
      }

      /*
       * Wait until the browser has attached
       * the video source before playing.
       */
      if (
        video.readyState >= 2
      ) {
        this.play(video);
      } else {
        const playOnce = () => {
          video.removeEventListener(
            "loadeddata",
            playOnce
          );

          if (
            this.activeIndex ===
            index
          ) {
            this.play(video);
          }
        };

        video.addEventListener(
          "loadeddata",
          playOnce
        );

        video.load();
      }
    },

    activateNearest() {
      const index =
        this.findNearestIndex();

      this.activate(
        index,
        false
      );
    },

    scrollTo(index, smooth = true) {
      if (!this.feed) return;

      if (!this.pages.length) return;

      index = Math.max(
        0,
        Math.min(
          index,
          this.pages.length - 1
        )
      );

      const page =
        this.pages[index];

      if (!page) return;

      const feedRect =
        this.feed.getBoundingClientRect();

      const pageRect =
        page.getBoundingClientRect();

      const target =
        this.feed.scrollTop +
        (pageRect.top -
          feedRect.top);

      this.feed.scrollTo({
        top: Math.max(
          0,
          target
        ),
        behavior: smooth
          ? "smooth"
          : "auto"
      });
    },

    next() {
      const index =
        this.findNearestIndex();

      if (
        index >=
        this.pages.length - 1
      ) {
        return;
      }

      const target =
        index + 1;

      this.prepareWindow(
        target
      );

      this.scrollTo(
        target,
        true
      );

      this.scheduleSettle();
    },

    previous() {
      const index =
        this.findNearestIndex();

      if (index <= 0) {
        return;
      }

      const target =
        index - 1;

      this.prepareWindow(
        target
      );

      this.scrollTo(
        target,
        true
      );

      this.scheduleSettle();
    },

    scheduleSettle() {
      clearTimeout(
        this.scrollTimer
      );

      this.scrollTimer =
        setTimeout(() => {
          this.settle();
        }, 180);
    },

    settle() {
      if (this.settling) return;

      this.settling = true;

      const index =
        this.findNearestIndex();

      this.activate(
        index,
        true
      );

      setTimeout(() => {
        this.settling = false;
      }, 80);
    },

    setupScroll() {
      if (!this.feed) return;

      this.feed.addEventListener(
        "scroll",
        () => {
          this.scheduleSettle();
        },
        {
          passive: true
        }
      );

      /*
       * Modern browsers support scrollend.
       */
      this.feed.addEventListener(
        "scrollend",
        () => {
          this.settle();
        },
        {
          passive: true
        }
      );
    },

    setupWheel() {
      if (!this.feed) return;

      this.feed.addEventListener(
        "wheel",
        event => {
          /*
           * Do not hijack horizontal scrolling.
           */
          if (
            Math.abs(event.deltaY) <=
            Math.abs(event.deltaX)
          ) {
            return;
          }

          if (
            Math.abs(event.deltaY) <
            8
          ) {
            return;
          }

          /*
           * Prevent native multi-page scrolling.
           */
          event.preventDefault();

          if (this.wheelTimer) {
            return;
          }

          this.wheelTimer = true;

          if (event.deltaY > 0) {
            this.next();
          } else {
            this.previous();
          }

          setTimeout(() => {
            this.wheelTimer = null;
          }, 650);
        },
        {
          passive: false,
          capture: true
        }
      );
    },

    setupTouch() {
      if (!this.feed) return;

      this.feed.addEventListener(
        "touchstart",
        event => {
          const target =
            event.target;

          /*
           * Don't interfere with
           * buttons/inputs.
           */
          if (
            target.closest(
              "button,a,input,textarea,select"
            )
          ) {
            this.touchTracking =
              false;
            return;
          }

          const touch =
            event.touches[0];

          if (!touch) return;

          this.touchStartX =
            touch.clientX;

          this.touchStartY =
            touch.clientY;

          this.touchTracking = true;
        },
        {
          passive: true,
          capture: true
        }
      );

      this.feed.addEventListener(
        "touchmove",
        event => {
          if (
            !this.touchTracking
          ) {
            return;
          }

          const touch =
            event.touches[0];

          if (!touch) return;

          const dy =
            touch.clientY -
            this.touchStartY;

          const dx =
            touch.clientX -
            this.touchStartX;

          /*
           * Once a vertical swipe is obvious,
           * stop browser native scrolling.
           */
          if (
            Math.abs(dy) >
              Math.abs(dx) &&
            Math.abs(dy) > 12
          ) {
            event.preventDefault();
          }
        },
        {
          passive: false,
          capture: true
        }
      );

      this.feed.addEventListener(
        "touchend",
        event => {
          if (
            !this.touchTracking
          ) {
            return;
          }

          this.touchTracking =
            false;

          const touch =
            event.changedTouches[0];

          if (!touch) return;

          const dy =
            touch.clientY -
            this.touchStartY;

          const dx =
            touch.clientX -
            this.touchStartX;

          if (
            Math.abs(dy) <
            50
          ) {
            return;
          }

          if (
            Math.abs(dy) <
            Math.abs(dx)
          ) {
            return;
          }

          if (dy < 0) {
            this.next();
          } else {
            this.previous();
          }
        },
        {
          passive: true,
          capture: true
        }
      );
    },

    setupKeyboard() {
      document.addEventListener(
        "keydown",
        event => {
          const target =
            event.target;

          if (
            target &&
            (
              target.tagName ===
                "INPUT" ||
              target.tagName ===
                "TEXTAREA" ||
              target.tagName ===
                "SELECT"
            )
          ) {
            return;
          }

          if (
            event.key ===
              "ArrowDown" ||
            event.key ===
              "PageDown"
          ) {
            event.preventDefault();
            this.next();
          }

          if (
            event.key ===
              "ArrowUp" ||
            event.key ===
              "PageUp"
          ) {
            event.preventDefault();
            this.previous();
          }
        }
      );
    },

    setupVisibility() {
      document.addEventListener(
        "visibilitychange",
        () => {
          if (
            document.hidden
          ) {
            this.pauseAll();
            return;
          }

          setTimeout(() => {
            this.activateNearest();
          }, 150);
        }
      );
    },

    setupVideoErrors() {
      document.addEventListener(
        "error",
        event => {
          const video =
            event.target;

          if (
            !video ||
            video.tagName !==
              "VIDEO"
          ) {
            return;
          }

          if (
            video.dataset
              .zyloFallbackUsed ===
            "true"
          ) {
            return;
          }

          const fallback =
            this.getFallbackSource(
              video
            );

          if (!fallback) {
            return;
          }

          video.dataset
            .zyloFallbackUsed =
            "true";

          video.dataset
            .zyloPrimarySrc =
            fallback;

          video.setAttribute(
            "src",
            fallback
          );

          video.load();

          if (
            this.pages[
              this.activeIndex
            ]?.querySelector(
              "video"
            ) === video
          ) {
            this.play(video);
          }
        },
        true
      );
    }
  };

  /* =========================================================
     VIDEO ID
     ========================================================= */

  function getVideoId(page) {
    return (
      page?.dataset.videoId ||
      page?.id ||
      `video-${Date.now()}`
    );
  }

  function getVideoFeed() {
    return $(".video-feed");
  }

  function getVideoPages() {
    return $$(".video-page");
  }

  function playVideo(video) {
    if (!video) return;

    VideoEngine.pauseOthers(
      video
    );

    video.muted = true;

    const promise =
      video.play();

    if (
      promise &&
      typeof promise.catch ===
        "function"
    ) {
      promise.catch(() => {});
    }
  }

  function pauseAllVideos(
    except = null
  ) {
    $$("video").forEach(
      video => {
        if (
          video !== except
        ) {
          try {
            video.pause();
          } catch {}
        }
      }
    );
  }

  /* =========================================================
     LIKE
     ========================================================= */

  function isLiked(id) {
    return getStorage(
      STORAGE.liked,
      []
    ).includes(String(id));
  }

  function setLiked(
    id,
    liked
  ) {
    let list = getStorage(
      STORAGE.liked,
      []
    );

    id = String(id);

    if (liked) {
      if (!list.includes(id)) {
        list.push(id);
      }
    } else {
      list = list.filter(
        item => item !== id
      );
    }

    setStorage(
      STORAGE.liked,
      list
    );
  }

  function updateLikeUI(
    page,
    liked
  ) {
    const button = $(
      ".like-btn",
      page
    );

    if (!button) return;

    button.classList.toggle(
      "active",
      liked
    );

    button.setAttribute(
      "aria-pressed",
      liked
        ? "true"
        : "false"
    );

    const count =
      button.querySelector(
        ".action-count"
      ) ||
      button.querySelector(
        ".count"
      );

    if (
      count &&
      !count.closest("svg")
    ) {
      const base =
        Number(
          button.dataset
            .baseCount ||
            count.textContent.replace(
              /[^\d]/g,
              ""
            ) ||
            0
        );

      button.dataset
        .baseCount =
        String(base);

      count.textContent =
        formatNumber(
          Math.max(
            0,
            base +
              (liked
                ? 1
                : 0)
          )
        );
    }
  }

  function setupLikeButtons() {
    $$(".like-btn").forEach(
      button => {
        if (
          button.dataset
            .zyloLikeBound ===
          "true"
        ) {
          return;
        }

        button.dataset
          .zyloLikeBound =
          "true";

        const page =
          button.closest(
            ".video-page"
          );

        if (!page) return;

        const id =
          getVideoId(page);

        const count =
          button.querySelector(
            ".action-count"
          ) ||
          button.querySelector(
            ".count"
          );

        if (
          count &&
          !button.dataset
            .baseCount
        ) {
          button.dataset
            .baseCount =
            count.textContent.replace(
              /[^\d]/g,
              ""
            ) || "0";
        }

        updateLikeUI(
          page,
          isLiked(id)
        );

        button.addEventListener(
          "click",
          event => {
            event.preventDefault();
            event.stopPropagation();

            const liked =
              !isLiked(id);

            setLiked(
              id,
              liked
            );

            updateLikeUI(
              page,
              liked
            );
          }
        );
      }
    );
  }

  /* =========================================================
     DOUBLE TAP LIKE
     ========================================================= */

  function showHeartAnimation(
    page
  ) {
    const heart =
      document.createElement(
        "div"
      );

    heart.textContent = "♥";

    Object.assign(
      heart.style,
      {
        position: "absolute",
        left: "50%",
        top: "50%",
        transform:
          "translate(-50%, -50%) scale(.5)",
        fontSize: "100px",
        color: "#fff",
        textShadow:
          "0 3px 20px rgba(0,0,0,.5)",
        pointerEvents: "none",
        zIndex: "100",
        opacity: "0",
        transition:
          "transform .25s ease, opacity .25s ease"
      }
    );

    page.appendChild(
      heart
    );

    requestAnimationFrame(
      () => {
        heart.style.opacity =
          "1";

        heart.style.transform =
          "translate(-50%, -50%) scale(1)";
      }
    );

    setTimeout(() => {
      heart.style.opacity =
        "0";

      heart.style.transform =
        "translate(-50%, -50%) scale(1.25)";
    }, 300);

    setTimeout(
      () => heart.remove(),
      650
    );
  }

  function setupDoubleTapLike() {
    $(
      ".video-page video"
    ).forEach(video => {
      if (
        video.dataset
          .zyloDoubleTap ===
        "true"
      ) {
        return;
      }

      video.dataset
        .zyloDoubleTap =
        "true";

      let lastTap = 0;

      video.addEventListener(
        "click",
        () => {
          const now =
            Date.now();

          if (
            now - lastTap <
            320
          ) {
            const page =
              video.closest(
                ".video-page"
              );

            if (!page) return;

            const id =
              getVideoId(page);

            if (!isLiked(id)) {
              const button =
                $(
                  ".like-btn",
                  page
                );

              button?.click();
            }

            showHeartAnimation(
              page
            );
          }

          lastTap = now;
        }
      );
    });
  }

  /* =========================================================
     SAVE
     ========================================================= */

  function isSaved(id) {
    return getStorage(
      STORAGE.saved,
      []
    ).includes(String(id));
  }

  function setSaved(
    id,
    saved
  ) {
    let list = getStorage(
      STORAGE.saved,
      []
    );

    id = String(id);

    if (saved) {
      if (!list.includes(id)) {
        list.push(id);
      }
    } else {
      list = list.filter(
        item => item !== id
      );
    }

    setStorage(
      STORAGE.saved,
      list
    );
  }

  function updateSaveUI(
    page,
    saved
  ) {
    const button = $(
      ".save-btn",
      page
    );

    if (!button) return;

    button.classList.toggle(
      "active",
      saved
    );

    button.setAttribute(
      "aria-pressed",
      saved
        ? "true"
        : "false"
    );
  }

  function setupSaveButtons() {
    $$(".save-btn").forEach(
      button => {
        if (
          button.dataset
            .zyloSaveBound ===
          "true"
        ) {
          return;
        }

        button.dataset
          .zyloSaveBound =
          "true";

        const page =
          button.closest(
            ".video-page"
          );

        if (!page) return;

        const id =
          getVideoId(page);

        updateSaveUI(
          page,
          isSaved(id)
        );

        button.addEventListener(
          "click",
          event => {
            event.preventDefault();
            event.stopPropagation();

            const saved =
              !isSaved(id);

            setSaved(
              id,
              saved
            );

            updateSaveUI(
              page,
              saved
            );

            toast(
              saved
                ? "Saved"
                : "Removed from saved"
            );
          }
        );
      }
    );
  }

  /* =========================================================
     COMMENTS
     ========================================================= */

  function getComments(
    videoId
  ) {
    const all =
      getStorage(
        STORAGE.comments,
        {}
      );

    return (
      all[String(videoId)] ||
      []
    );
  }

  function saveComments(
    videoId,
    comments
  ) {
    const all =
      getStorage(
        STORAGE.comments,
        {}
      );

    all[String(videoId)] =
      comments;

    setStorage(
      STORAGE.comments,
      all
    );
  }

  function openCommentPanel(
    page
  ) {
    const videoId =
      getVideoId(page);

    const comments =
      getComments(videoId);

    $("#zyloCommentPanel")
      ?.remove();

    const panel =
      document.createElement(
        "div"
      );

    panel.id =
      "zyloCommentPanel";

    Object.assign(
      panel.style,
      {
        position: "fixed",
        left: "0",
        right: "0",
        bottom: "0",
        maxHeight: "70vh",
        background: "#fff",
        color: "#111",
        zIndex: "999990",
        borderRadius:
          "18px 18px 0 0",
        padding: "18px",
        boxSizing: "border-box",
        boxShadow:
          "0 -8px 30px rgba(0,0,0,.25)"
      }
    );

    const listHTML =
      comments.length
        ? comments
            .map(
              comment => `
                <div style="
                  padding:10px 0;
                  border-bottom:1px solid #eee;
                ">
                  <strong>
                    ${escapeHTML(
                      comment.username ||
                        "@zylo_user"
                    )}
                  </strong>

                  <div>
                    ${escapeHTML(
                      comment.text ||
                        ""
                    )}
                  </div>
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
        >
          ×
        </button>
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

    document.body.appendChild(
      panel
    );

    $(
      "[data-close-comments]",
      panel
    )?.addEventListener(
      "click",
      () => panel.remove()
    );

    $(
      "[data-comment-form]",
      panel
    )?.addEventListener(
      "submit",
      event => {
        event.preventDefault();

        const input = $(
          'input[name="comment"]',
          panel
        );

        const text =
          input?.value.trim();

        if (!text) return;

        const owner =
          getOwnerInfo();

        comments.push({
          text,
          username:
            owner.username,
          uid: owner.uid,
          createdAt:
            Date.now()
        });

        saveComments(
          videoId,
          comments
        );

        panel.remove();

        openCommentPanel(
          page
        );
      }
    );
  }

  function setupCommentButtons() {
    $$(
      '[aria-label="Comments"], .comment-btn, .comment-action'
    ).forEach(
      button => {
        if (
          button.dataset
            .zyloCommentBound ===
          "true"
        ) {
          return;
        }

        button.dataset
          .zyloCommentBound =
          "true";

        button.addEventListener(
          "click",
          event => {
            event.preventDefault();
            event.stopPropagation();

            const page =
              button.closest(
                ".video-page"
              );

            if (page) {
              openCommentPanel(
                page
              );
            }
          }
        );
      }
    );
  }

  /* =========================================================
     SHARE
     ========================================================= */

  async function shareVideo(
    page
  ) {
    const id =
      getVideoId(page);

    const url =
      `${location.origin}${location.pathname}#video=${encodeURIComponent(
        id
      )}`;

    try {
      if (
        navigator.share
      ) {
        await navigator.share({
          title:
            "Watch this video on ZYLO",
          text:
            "Watch this video on ZYLO",
          url
        });

        return;
      }

      if (
        navigator.clipboard
      ) {
        await navigator.clipboard.writeText(
          url
        );

        toast("Link copied");
        return;
      }
    } catch (error) {
      if (
        error?.name ===
        "AbortError"
      ) {
        return;
      }
    }

    toast("Share link ready");
  }

  function setupShareButtons() {
    $$(
      ".share-btn, .share-action"
    ).forEach(
      button => {
        if (
          button.dataset
            .zyloShareBound ===
          "true"
        ) {
          return;
        }

        button.dataset
          .zyloShareBound =
          "true";

        button.addEventListener(
          "click",
          event => {
            event.preventDefault();
            event.stopPropagation();

            const page =
              button.closest(
                ".video-page"
              );

            if (page) {
              shareVideo(
                page
              );
            }
          }
        );
      }
    );
  }

  /* =========================================================
     MUSIC
     ========================================================= */

  function setupMusicButtons() {
    $$(".music-btn").forEach(
      button => {
        if (
          button.dataset
            .zyloMusicBound ===
          "true"
        ) {
          return;
        }

        button.dataset
          .zyloMusicBound =
          "true";

        button.addEventListener(
          "click",
          event => {
            event.preventDefault();
            event.stopPropagation();

            const page =
              button.closest(
                ".video-page"
              );

            const video =
              $("video", page);

            if (!video) return;

            video.muted =
              !video.muted;

            button.classList.toggle(
              "active",
              !video.muted
            );

            toast(
              video.muted
                ? "Sound off"
                : "Sound on"
            );
          }
        );
      }
    );
  }

  /* =========================================================
     FULLSCREEN
     ========================================================= */

  async function toggleFullscreen(
    page
  ) {
    if (!page) return;

    try {
      if (
        document.fullscreenElement
      ) {
        await document.exitFullscreen();
        return;
      }

      if (
        page.requestFullscreen
      ) {
        await page.requestFullscreen();
        return;
      }

      const video =
        $("video", page);

      if (
        video?.webkitEnterFullscreen
      ) {
        video.webkitEnterFullscreen();
      }
    } catch {
      toast(
        "Fullscreen unavailable"
      );
    }
  }

  function setupFullscreenButtons() {
    $$(
      ".fullscreen-btn, .fullscreen-action, .fullscreen-button"
    ).forEach(
      button => {
        if (
          button.dataset
            .zyloFullscreenBound ===
          "true"
        ) {
          return;
        }

        button.dataset
          .zyloFullscreenBound =
          "true";

        button.addEventListener(
          "click",
          event => {
            event.preventDefault();
            event.stopPropagation();

            const page =
              button.closest(
                ".video-page"
              );

            if (page) {
              toggleFullscreen(
                page
              );
            }
          }
        );
      }
    );
  }

  /* =========================================================
     FOLLOW
     ========================================================= */

  function isFollowing(id) {
    return getStorage(
      STORAGE.following,
      []
    ).includes(
      String(id)
    );
  }

  function setFollowing(
    id,
    following
  ) {
    let list = getStorage(
      STORAGE.following,
      []
    );

    id = String(id);

    if (following) {
      if (!list.includes(id)) {
        list.push(id);
      }
    } else {
      list = list.filter(
        item => item !== id
      );
    }

    setStorage(
      STORAGE.following,
      list
    );
  }

  /*
   * IMPORTANT:
   *
   * The right-side Z+ button is PROFILE.
   * It must NOT automatically follow the creator.
   *
   * Follow is handled inside creator profile.
   */

  /* =========================================================
     UPLOAD STORAGE
     ========================================================= */

  function getUploadedVideos() {
    return getStorage(
      STORAGE.uploads,
      []
    );
  }

  function saveUploadedVideos(
    videos
  ) {
    setStorage(
      STORAGE.uploads,
      videos
    );
  }

  function addUploadedVideo(
    record
  ) {
    const videos =
      getUploadedVideos();

    const exists =
      videos.some(
        item =>
          String(item.id) ===
            String(record.id) ||
          (
            item.name ===
              record.name &&
            item.ownerUid ===
              record.ownerUid
          )
      );

    if (exists) return;

    videos.push(record);

    saveUploadedVideos(
      videos
    );
  }

  function findUploadedVideo(
    id
  ) {
    return getUploadedVideos().find(
      video =>
        String(video.id) ===
        String(id)
    );
  }

  /* =========================================================
     UPLOAD UI
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
    const box =
      $("#uploadBox");

    if (!box) {
      findVideoInput()?.click();

      if (!findVideoInput()) {
        toast(
          "Upload panel not found"
        );
      }

      return;
    }

    box.removeAttribute(
      "hidden"
    );

    box.classList.add(
      "active"
    );

    box.style.display =
      "flex";
  }

  function closeUploadBox() {
    const box =
      $("#uploadBox");

    if (!box) return;

    box.classList.remove(
      "active"
    );

    box.style.display =
      "none";

    box.setAttribute(
      "hidden",
      ""
    );
  }

  function setupCreateButton() {
    const button =
      findCreateButton();

    if (!button) return;

    if (
      button.dataset
        .zyloCreateBound ===
      "true"
    ) {
      return;
    }

    button.dataset
      .zyloCreateBound =
      "true";

    button.addEventListener(
      "click",
      event => {
        event.preventDefault();
        event.stopPropagation();

        if (
          !requireLogin()
        ) {
          return;
        }

        openUploadBox();
      }
    );
  }

  function setupUploadCloseButtons() {
    const box =
      $("#uploadBox");

    if (!box) return;

    /*
     * Includes the exact ID from your HTML:
     * #closeUpload
     */
    $(
      "#closeUpload, [data-close], .close-upload, .upload-close, .modal-close",
      box
    );

    $$(
      "#closeUpload, [data-close], .close-upload, .upload-close, .modal-close",
      box
    ).forEach(
      button => {
        if (
          button.dataset
            .zyloCloseBound ===
          "true"
        ) {
          return;
        }

        button.dataset
          .zyloCloseBound =
          "true";

        button.addEventListener(
          "click",
          event => {
            event.preventDefault();
            event.stopPropagation();

            closeUploadBox();
          }
        );
      }
    );

    box.addEventListener(
      "click",
      event => {
        if (
          event.target === box
        ) {
          closeUploadBox();
        }
      }
    );
  }

  /* =========================================================
     UPLOAD VIDEO
     ========================================================= */

  async function uploadVideo(
    file
  ) {
    if (!file) return;

    if (
      !file.type.startsWith(
        "video/"
      )
    ) {
      toast(
        "Please select a video"
      );
      return;
    }

    const owner =
      getOwnerInfo();

    const formData =
      new FormData();

    formData.append(
      "video",
      file
    );

    formData.append(
      "ownerUid",
      owner.uid
    );

    formData.append(
      "username",
      owner.username
    );

    formData.append(
      "name",
      owner.name
    );

    toast("Uploading...");

    try {
      const response =
        await fetch(
          `${API_BASE_URL}/api/upload`,
          {
            method: "POST",
            body: formData
          }
        );

      if (
        !response.ok
      ) {
        throw new Error(
          `Upload failed: ${response.status}`
        );
      }

      const data =
        await response.json();

      const serverURL =
        data.url ||
        data.videoUrl ||
        data.video ||
        data.fileUrl ||
        "";

      /*
       * Local blob is useful for
       * immediate playback.
       */
      const localURL =
        URL.createObjectURL(
          file
        );

      const record = {
        id:
          data.id ||
          `upload-${Date.now()}-${Math.random()
            .toString(36)
            .slice(2)}`,

        url:
          serverURL ||
          localURL,

        localUrl:
          localURL,

        name:
          file.name,

        ownerUid:
          owner.uid,

        ownerName:
          owner.name,

        username:
          owner.username,

        createdAt:
          Date.now(),

        local:
          !serverURL,

        server:
          Boolean(serverURL)
      };

      addUploadedVideo(
        record
      );

      closeUploadBox();

      addVideoToFeed(
        record
      );

      toast(
        serverURL
          ? "Video uploaded"
          : "Video added"
      );
    } catch (error) {
      console.error(
        "ZYLO upload error:",
        error
      );

      /*
       * Browser blob URLs are NOT permanent
       * cross-device storage.
       *
       * This is only an immediate local
       * fallback until backend upload works.
       */
      const localURL =
        URL.createObjectURL(
          file
        );

      const record = {
        id:
          `local-${Date.now()}-${Math.random()
            .toString(36)
            .slice(2)}`,

        url:
          localURL,

        localUrl:
          localURL,

        name:
          file.name,

        ownerUid:
          owner.uid,

        ownerName:
          owner.name,

        username:
          owner.username,

        createdAt:
          Date.now(),

        local: true,

        server: false
      };

      addUploadedVideo(
        record
      );

      closeUploadBox();

      addVideoToFeed(
        record
      );

      toast(
        "Server upload failed"
      );
    }
  }

  function setupVideoInput() {
    const input =
      findVideoInput();

    if (!input) return;

    if (
      input.dataset
        .zyloInputBound ===
      "true"
    ) {
      return;
    }

    input.dataset
      .zyloInputBound =
      "true";

    input.addEventListener(
      "change",
      async event => {
        const file =
          event.target.files?.[0];

        if (file) {
          await uploadVideo(
            file
          );
        }

        input.value = "";
      }
    );
  }

  /* =========================================================
     CREATE VIDEO PAGE
     ========================================================= */

  function createVideoPage(
    record
  ) {
    const page =
      document.createElement(
        "section"
      );

    page.className =
      "video-page";

    page.dataset.videoId =
      String(record.id);

    page.dataset.ownerUid =
      record.ownerUid || "";

    page.dataset.creatorId =
      record.ownerUid ||
      record.username ||
      "zylo_creator";

    page.dataset.uploaded =
      "true";

    const source =
      record.url ||
      record.localUrl ||
      LOCAL_VIDEO;

    page.innerHTML = `
      <video
        src="${escapeHTML(
          source
        )}"
        muted
        playsinline
        webkit-playsinline
        loop
        preload="none"
      ></video>

      <div class="video-overlay">
        <div class="video-info">
          <strong>
            ${escapeHTML(
              record.username ||
                record.ownerName ||
                "@zylo_user"
            )}
          </strong>
        </div>
      </div>
    `;

    return page;
  }

  function addVideoToFeed(
    record
  ) {
    const feed =
      getVideoFeed();

    if (!feed) return;

    const existing =
      Array.from(
        feed.querySelectorAll(
          ".video-page"
        )
      ).find(
        page =>
          String(
            page.dataset.videoId
          ) ===
          String(record.id)
      );

    if (existing) return;

    const page =
      createVideoPage(
        record
      );

    feed.appendChild(
      page
    );

    initializeDynamicPage(
      page
    );

    VideoEngine.refresh();

    /*
     * Newly uploaded video becomes
     * immediately available.
     */
    const index =
      VideoEngine.pages.indexOf(
        page
      );

    if (index >= 0) {
      VideoEngine.scrollTo(
        index,
        true
      );
    }
  }

  function restoreUploadedVideos() {
    const feed =
      getVideoFeed();

    if (!feed) return;

    const videos =
      getUploadedVideos();

    videos.forEach(
      record => {
        const exists =
          Array.from(
            feed.querySelectorAll(
              ".video-page"
            )
          ).some(
            page =>
              String(
                page.dataset.videoId
              ) ===
              String(record.id)
          );

        if (!exists) {
          addVideoToFeed(
            record
          );
        }
      }
    );
  }

  /* =========================================================
     PROFILE / CREATOR
     ========================================================= */

  function getMyVideos() {
    const owner =
      getOwnerInfo();

    return getUploadedVideos().filter(
      video => {
        if (!owner.uid) {
          return (
            !video.ownerUid ||
            video.ownerUid === ""
          );
        }

        return (
          video.ownerUid ===
          owner.uid
        );
      }
    );
  }

  function getCreatorVideos(
    creatorId
  ) {
    return getUploadedVideos().filter(
      video =>
        video.ownerUid ===
          creatorId ||
        video.username ===
          creatorId
    );
  }

  function getCreatorData(
    page
  ) {
    const button = $(
      ".profile-action",
      page
    );

    const id =
      page?.dataset
        ?.ownerUid ||
      page?.dataset
        ?.creatorId ||
      button?.dataset
        ?.creatorId ||
      "zylo_creator";

    const record =
      findUploadedVideo(
        getVideoId(page)
      );

    return {
      uid: id,

      name:
        record?.ownerName ||
        "ZYLO Creator",

      username:
        record?.username ||
        "@zylo_creator"
    };
  }

  function openCreatorProfile(
    page
  ) {
    if (!page) return;

    const creator =
      getCreatorData(
        page
      );

    const videos =
      getCreatorVideos(
        creator.uid
      );

    showProfileFallback(
      creator,
      videos,
      false
    );
  }

  function openOwnProfile() {
    if (
      window.ZYLOAuth &&
      typeof window.ZYLOAuth.openMyProfile ===
        "function"
    ) {
      window.ZYLOAuth.openMyProfile();
      return;
    }

    const profile =
      getMyProfile();

    const videos =
      getMyVideos();

    showProfileFallback(
      profile,
      videos,
      true
    );
  }

  function showProfileFallback(
    profile,
    videos,
    isOwn
  ) {
    $("#zyloProfileOverlay")
      ?.remove();

    const overlay =
      document.createElement(
        "div"
      );

    overlay.id =
      "zyloProfileOverlay";

    Object.assign(
      overlay.style,
      {
        position: "fixed",
        inset: "0",
        zIndex: "999980",
        background: "#fff",
        color: "#111",
        overflow: "auto"
      }
    );

    const creatorId =
      profile.uid ||
      profile.username ||
      "zylo_creator";

    const following =
      isFollowing(
        creatorId
      );

    const followHTML =
      !isOwn
        ? `
          <button
            type="button"
            data-profile-follow
            style="
              margin-top:14px;
              border:0;
              border-radius:999px;
              padding:10px 24px;
              cursor:pointer;
            "
          >
            ${
              following
                ? "Following"
                : "Follow"
            }
          </button>
        `
        : "";

    const videoHTML =
      videos.length
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
        >
          ‹
        </button>

        <strong style="
          margin-left:12px;
        ">
          ${
            isOwn
              ? "My Profile"
              : "Profile"
          }
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
              ? `
                <img
                  src="${escapeHTML(
                    profile.avatar
                  )}"
                  style="
                    width:100%;
                    height:100%;
                    object-fit:cover;
                  "
                >
              `
              : "Z"
          }
        </div>

        <h2 style="
          margin:12px 0 4px;
        ">
          ${escapeHTML(
            profile.name ||
              "ZYLO Creator"
          )}
        </h2>

        <div style="
          color:#777;
        ">
          ${escapeHTML(
            profile.username ||
              "@zylo_creator"
          )}
        </div>

        ${
          profile.bio
            ? `
              <p style="
                max-width:500px;
                margin:12px auto;
              ">
                ${escapeHTML(
                  profile.bio
                )}
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

        ${followHTML}
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

    document.body.appendChild(
      overlay
    );

    $(
      "[data-close-profile]",
      overlay
    )?.addEventListener(
      "click",
      () =>
        overlay.remove()
    );

    $(
      "[data-profile-follow]",
      overlay
    )?.addEventListener(
      "click",
      event => {
        event.preventDefault();

        const next =
          !isFollowing(
            creatorId
          );

        setFollowing(
          creatorId,
          next
        );

        event.currentTarget.textContent =
          next
            ? "Following"
            : "Follow";

        toast(
          next
            ? "Following"
            : "Unfollowed"
        );
      }
    );

    $$(
      "[data-profile-video]",
      overlay
    ).forEach(
      item => {
        item.addEventListener(
          "click",
          () => {
            const id =
              item.dataset
                .profileVideo;

            overlay.remove();

            const page =
              Array.from(
                getVideoPages()
              ).find(
                p =>
                  String(
                    p.dataset
                      .videoId
                  ) ===
                  String(id)
              );

            if (!page) {
              toast(
                "Video is not currently in feed"
              );
              return;
            }

            const index =
              VideoEngine.pages.indexOf(
                page
              );

            if (index >= 0) {
              VideoEngine.scrollTo(
                index,
                true
              );

              setTimeout(
                () => {
                  VideoEngine.activate(
                    index,
                    false
                  );
                },
                450
              );
            }
          }
        );
      }
    );
  }

  /* =========================================================
     CREATOR PROFILE BUTTON
     ========================================================= */

  function setupCreatorProfileButtons() {
    $(
      ".profile-action"
    ).forEach(
      button => {
        if (
          button.dataset
            .zyloProfileBound ===
          "true"
        ) {
          return;
        }

        button.dataset
          .zyloProfileBound =
          "true";

        /*
         * IMPORTANT:
         * Z+ button = Profile.
         * It does NOT automatically follow.
         */
        button.addEventListener(
          "click",
          event => {
            event.preventDefault();
            event.stopPropagation();

            const page =
              button.closest(
                ".video-page"
              );

            if (page) {
              openCreatorProfile(
                page
              );
            }
          }
        );
      }
    );
  }

  /* =========================================================
     BOTTOM NAV
     ========================================================= */

  function setupBottomNavigation() {
    $$(".nav-item").forEach(
      item => {
        if (
          item.dataset
            .zyloNavBound ===
          "true"
        ) {
          return;
        }

        item.dataset
          .zyloNavBound =
          "true";

        item.addEventListener(
          "click",
          event => {
            const nav =
              item.dataset.nav;

            if (!nav) return;

            if (
              nav ===
              "profile"
            ) {
              /*
               * auth.js owns account profile
               * when available.
               */
              if (
                window.ZYLOAuth
              ) {
                return;
              }

              event.preventDefault();
              event.stopPropagation();

              openOwnProfile();
              return;
            }

            if (
              nav ===
              "home"
            ) {
              event.preventDefault();

              VideoEngine.scrollTo(
                0,
                true
              );

              return;
            }

            if (
              nav ===
              "discover"
            ) {
              toast(
                "Discover"
              );

              return;
            }

            if (
              nav ===
              "inbox"
            ) {
              toast(
                "Inbox"
              );
            }
          }
        );
      }
    );
  }

  /* =========================================================
     TOP TABS
     ========================================================= */

  function setupTopTabs() {
    $$(
      "[data-tab]"
    ).forEach(
      tab => {
        if (
          tab.dataset
            .zyloTabBound ===
          "true"
        ) {
          return;
        }

        tab.dataset
          .zyloTabBound =
          "true";

        tab.addEventListener(
          "click",
          () => {
            const name =
              tab.dataset.tab;

            if (
              name ===
              "following"
            ) {
              filterFeed(
                "following"
              );
            }

            if (
              name ===
                "for-you" ||
              name ===
                "foryou"
            ) {
              filterFeed(
                "for-you"
              );
            }

            if (
              name ===
              "live"
            ) {
              toast(
                "LIVE"
              );
            }
          }
        );
      }
    );
  }

  function filterFeed(
    mode
  ) {
    const pages =
      getVideoPages();

    pages.forEach(
      page => {
        if (
          mode ===
          "following"
        ) {
          const creator =
            page.dataset
              .ownerUid ||
            page.dataset
              .creatorId ||
            "zylo_creator";

          page.style.display =
            isFollowing(
              creator
            )
              ? ""
              : "none";
        } else {
          page.style.display =
            "";
        }
      }
    );

    VideoEngine.refresh();

    const first =
      pages.find(
        page =>
          page.style
            .display !==
          "none"
      );

    if (first) {
      const index =
        VideoEngine.pages.indexOf(
          first
        );

      if (index >= 0) {
        VideoEngine.scrollTo(
          index,
          true
        );
      }
    }
  }

  /* =========================================================
     SEARCH
     ========================================================= */

  function setupSearch() {
    const button =
      $(
        ".search-btn, .search-button, .search-action, [data-action='search']"
      );

    if (!button) return;

    if (
      button.dataset
        .zyloSearchBound ===
      "true"
    ) {
      return;
    }

    button.dataset
      .zyloSearchBound =
      "true";

    button.addEventListener(
      "click",
      event => {
        event.preventDefault();
        event.stopPropagation();

        openSearch();
      }
    );
  }

  function openSearch() {
    $("#zyloSearchOverlay")
      ?.remove();

    const overlay =
      document.createElement(
        "div"
      );

    overlay.id =
      "zyloSearchOverlay";

    Object.assign(
      overlay.style,
      {
        position: "fixed",
        inset: "0",
        background: "#fff",
        color: "#111",
        zIndex: "999970",
        padding: "20px",
        boxSizing: "border-box"
      }
    );

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
        >
          ‹
        </button>

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
        style="
          margin-top:20px;
        "
      ></div>
    `;

    document.body.appendChild(
      overlay
    );

    const input =
      $(
        "[data-search-input]",
        overlay
      );

    const results =
      $(
        "[data-search-results]",
        overlay
      );

    $(
      "[data-close-search]",
      overlay
    )?.addEventListener(
      "click",
      () =>
        overlay.remove()
    );

    input?.focus();

    input?.addEventListener(
      "input",
      () => {
        const query =
          input.value
            .trim()
            .toLowerCase();

        results.innerHTML =
          "";

        if (!query) return;

        const matches =
          getVideoPages().filter(
            page => {
              const text =
                page.textContent.toLowerCase();

              const creator =
                (
                  page.dataset
                    .creatorId ||
                  ""
                ).toLowerCase();

              return (
                text.includes(
                  query
                ) ||
                creator.includes(
                  query
                )
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

        matches.forEach(
          page => {
            const item =
              document.createElement(
                "div"
              );

            item.textContent =
              page.dataset
                .creatorId ||
              "ZYLO Video";

            Object.assign(
              item.style,
              {
                padding:
                  "14px 8px",
                borderBottom:
                  "1px solid #eee",
                cursor:
                  "pointer"
              }
            );

            item.addEventListener(
              "click",
              () => {
                overlay.remove();

                const index =
                  VideoEngine.pages.indexOf(
                    page
                  );

                if (
                  index >=
                  0
                ) {
                  VideoEngine.scrollTo(
                    index,
                    true
                  );
                }
              }
            );

            results.appendChild(
              item
            );
          }
        );
      }
    );
  }

  /* =========================================================
     VIDEO CLICK
     ========================================================= */

  function setupVideoClick() {
    $(
      ".video-page video"
    ).forEach(
      video => {
        if (
          video.dataset
            .zyloClickBound ===
          "true"
        ) {
          return;
        }

        video.dataset
          .zyloClickBound =
          "true";

        let timer = null;

        video.addEventListener(
          "click",
          () => {
            clearTimeout(
              timer
            );

            timer =
              setTimeout(
                () => {
                  if (
                    video.paused
                  ) {
                    playVideo(
                      video
                    );
                  } else {
                    video.pause();
                  }
                },
                340
              );
          }
        );
      }
    );
  }

  /* =========================================================
     DYNAMIC PAGE
     ========================================================= */

  function initializeDynamicPage(
    page
  ) {
    if (!page) return;

    const video =
      $("video", page);

    if (video) {
      video.playsInline =
        true;

      video.setAttribute(
        "playsinline",
        ""
      );

      video.loop = true;
      video.muted = true;

      if (
        !video.dataset
          .zyloPrimarySrc
      ) {
        video.dataset
          .zyloPrimarySrc =
          video.getAttribute(
            "src"
          ) ||
          video.dataset.src ||
          LOCAL_VIDEO;
      }
    }

    setupLikeButtons();
    setupSaveButtons();
    setupCommentButtons();
    setupShareButtons();
    setupMusicButtons();
    setupFullscreenButtons();
    setupDoubleTapLike();
    setupVideoClick();
    setupCreatorProfileButtons();
  }

  /* =========================================================
     HASH VIDEO
     ========================================================= */

  function openHashVideo() {
    const hash =
      location.hash;

    if (
      !hash.startsWith(
        "#video="
      )
    ) {
      return;
    }

    const id =
      decodeURIComponent(
        hash.substring(
          "#video=".length
        )
      );

    const page =
      getVideoPages().find(
        p =>
          String(
            p.dataset.videoId
          ) ===
          String(id)
      );

    if (!page) return;

    setTimeout(() => {
      const index =
        VideoEngine.pages.indexOf(
          page
        );

      if (index >= 0) {
        VideoEngine.scrollTo(
          index,
          true
        );

        setTimeout(
          () => {
            VideoEngine.activate(
              index,
              false
            );
          },
          450
        );
      }
    }, 300);
  }

  /* =========================================================
     RESIZE
     ========================================================= */

  function setupResize() {
    let timer = null;

    window.addEventListener(
      "resize",
      () => {
        clearTimeout(
          timer
        );

        timer =
          setTimeout(
            () => {
              VideoEngine.refresh();

              VideoEngine.scrollTo(
                VideoEngine.activeIndex >=
                  0
                  ? VideoEngine.activeIndex
                  : 0,
                false
              );
            },
            180
          );
      }
    );
  }

  /* =========================================================
     STARTUP
     ========================================================= */

  function initializeZYLO() {
    loadAuthJS();

    /*
     * First initialize video engine.
     * It captures existing src values and
     * stops unnecessary initial downloads.
     */
    VideoEngine.init();

    /*
     * Restore previously uploaded records.
     */
    restoreUploadedVideos();

    /*
     * Re-scan after restoring uploads.
     */
    VideoEngine.refresh();

    /*
     * Functional systems.
     */
    setupLikeButtons();
    setupSaveButtons();
    setupCommentButtons();
    setupShareButtons();
    setupMusicButtons();
    setupFullscreenButtons();
    setupDoubleTapLike();
    setupVideoClick();

    setupCreateButton();
    setupUploadCloseButtons();
    setupVideoInput();

    setupCreatorProfileButtons();

    setupBottomNavigation();
    setupTopTabs();
    setupSearch();

    setupResize();

    openHashVideo();

    /*
     * Give the browser a moment to calculate
     * layout before starting the first video.
     */
    setTimeout(() => {
      VideoEngine.refresh();
      VideoEngine.activateNearest();
    }, 250);

    console.log(
      "%cZYLO Video Engine 2.0 initialized",
      "font-weight:bold"
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
})();
