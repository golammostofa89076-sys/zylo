/* =========================================================
   ZYLO v1015 - FAST VIDEO + LIGHTWEIGHT ANALYTICS
   ZYLO - COMPLETE FRONTEND ENGINE
   Video Feed + Auto Next + Smart Loading + Upload
   Like + Save + Comment + Share + Music + Fullscreen
   Follow + Search + Profile + Auth bridge

   UI / CSS / Button Design is intentionally untouched.
   ========================================================= */

(() => {
  "use strict";

  const CONFIG = {
    API_BASE_URL: "https://zylo-backend-ec5c.onrender.com",
    DEFAULT_VIDEO: "./backend/uploads/video1.mp4",
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
      PRELOAD_BEHIND: 0,
      SWIPE_THRESHOLD: 55,
      WHEEL_LOCK_MS: 650,
      SETTLE_DELAY_MS: 90,
      PLAY_RETRY_MS: 250,
      AUTO_NEXT_DELAY_MS: 120
    },

    ANALYTICS: {
      ENDPOINT: "/api/analytics/events",
      STORAGE: "zylo_analytics_queue_v1",
      MAX_QUEUE: 100,
      FLUSH_INTERVAL_MS: 10000
    }
  };

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

  const getStorage = (key, fallback = []) =>
    safeJSONParse(localStorage.getItem(key), fallback);

  const setStorage = (key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.warn("ZYLO storage error:", error);
    }
  };

  const makeId = (prefix = "zylo") =>
    `${prefix}_${Date.now().toString(36)}_${Math.random()
      .toString(36)
      .slice(2, 10)}`;

  const escapeHTML = (value) =>
    String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");

  const isInteractiveTarget = (target) =>
    Boolean(
      target?.closest?.(
        "button,a,input,textarea,select,label,.action-btn,.music-btn," +
        ".fullscreen-btn,.profile-action,.create-btn,.search-btn," +
        ".comment-panel,.modal,.upload-box"
      )
    );

  /* =========================================================
     AUTH BRIDGE
     ========================================================= */

  function getCurrentUser() {
    try {
      if (
        window.ZYLOAuth &&
        typeof window.ZYLOAuth.getCurrentUser === "function"
      ) {
        return window.ZYLOAuth.getCurrentUser();
      }

      if (window.ZYLOAuth?.currentUser) {
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

  function loadAuthJS() {
    if (
      window.ZYLOAuth ||
      document.querySelector('script[data-zylo-auth="true"]')
    ) {
      return;
    }

    const script = document.createElement("script");

    script.type = "module";
    script.src = "./auth.js";
    script.dataset.zyloAuth = "true";

    script.onload = () => {
      window.dispatchEvent(new CustomEvent("zylo:authloaded"));
    };

    script.onerror = () => {
      console.warn("ZYLO: auth.js could not be loaded.");
    };

    document.head.appendChild(script);
  }

  /* =========================================================
     LIGHTWEIGHT ANALYTICS
     ========================================================= */

  const Analytics = (() => {
    let queue = [];
    let flushTimer = null;
    let sessionId = "";

    function getSessionId() {
      try {
        const key = "zylo_analytics_session_v1";
        let value = localStorage.getItem(key);

        if (!value) {
          value = makeId("session");
          localStorage.setItem(key, value);
        }

        return value;
      } catch {
        return makeId("session");
      }
    }

    function getConnectionInfo() {
      try {
        const connection =
          navigator.connection ||
          navigator.mozConnection ||
          navigator.webkitConnection;

        return {
          saveData: Boolean(connection?.saveData),
          effectiveType: connection?.effectiveType || "",
          downlink: connection?.downlink || null
        };
      } catch {
        return {
          saveData: false,
          effectiveType: "",
          downlink: null
        };
      }
    }

    function loadQueue() {
      const saved = getStorage(CONFIG.ANALYTICS.STORAGE, []);

      queue = Array.isArray(saved)
        ? saved.slice(-CONFIG.ANALYTICS.MAX_QUEUE)
        : [];
    }

    function saveQueue() {
      setStorage(
        CONFIG.ANALYTICS.STORAGE,
        queue.slice(-CONFIG.ANALYTICS.MAX_QUEUE)
      );
    }

    function add(type, data = {}) {
      const connection = getConnectionInfo();

      const event = {
        id: makeId("event"),
        type,
        sessionId,
        timestamp: Date.now(),
        pathname: window.location.pathname,
        referrerOrigin: getReferrerOrigin(),
        connection,
        ...data
      };

      queue.push(event);

      if (queue.length > CONFIG.ANALYTICS.MAX_QUEUE) {
        queue = queue.slice(-CONFIG.ANALYTICS.MAX_QUEUE);
      }

      saveQueue();

      if (queue.length >= 10) {
        flush();
      }
    }

    function getReferrerOrigin() {
      try {
        return document.referrer
          ? new URL(document.referrer).origin
          : "";
      } catch {
        return "";
      }
    }

    async function flush() {
      if (!queue.length) return;

      const events = queue.slice();

      const payload = JSON.stringify({
        events
      });

      try {
        if (navigator.sendBeacon) {
          const blob = new Blob([payload], {
            type: "application/json"
          });

          const sent = navigator.sendBeacon(
            CONFIG.API_BASE_URL + CONFIG.ANALYTICS.ENDPOINT,
            blob
          );

          if (sent) {
            queue = [];
            saveQueue();
            return;
          }
        }
      } catch (error) {
        console.warn("ZYLO analytics beacon error:", error);
      }

      try {
        const response = await fetch(
          CONFIG.API_BASE_URL + CONFIG.ANALYTICS.ENDPOINT,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: payload,
            keepalive: true
          }
        );

        if (response.ok) {
          queue = [];
          saveQueue();
        }
      } catch (error) {
        console.warn("ZYLO analytics upload waiting:", error);
      }
    }

    function setup() {
      sessionId = getSessionId();
      loadQueue();

      if (flushTimer) {
        clearInterval(flushTimer);
      }

      flushTimer = window.setInterval(
        flush,
        CONFIG.ANALYTICS.FLUSH_INTERVAL_MS
      );

      window.addEventListener("online", flush);

      document.addEventListener("visibilitychange", () => {
        if (document.hidden) {
          flush();
        }
      });
    }

    function videoImpression(page) {
      if (!page) return;

      add("video_impression", {
        videoId: page.dataset.videoId || "",
        creatorUid: page.dataset.creatorUid || "",
        creatorUsername: page.dataset.creatorUsername || ""
      });
    }

    function videoWatch(page, seconds = 0) {
      if (!page) return;

      add("video_watch", {
        videoId: page.dataset.videoId || "",
        creatorUid: page.dataset.creatorUid || "",
        seconds: Math.max(0, Number(seconds) || 0)
      });
    }

    function like(page, active) {
      if (!page) return;

      add("like", {
        videoId: page.dataset.videoId || "",
        active: Boolean(active)
      });
    }

    function save(page, active) {
      if (!page) return;

      add("save", {
        videoId: page.dataset.videoId || "",
        active: Boolean(active)
      });
    }

    function commentOpen(page) {
      if (!page) return;

      add("comment_open", {
        videoId: page.dataset.videoId || ""
      });
    }

    function share(page) {
      if (!page) return;

      add("share", {
        videoId: page.dataset.videoId || ""
      });
    }

    return {
      setup,
      flush,
      add,
      videoImpression,
      videoWatch,
      like,
      save,
      commentOpen,
      share
    };
  })();

  /* =========================================================
     VIDEO SOURCE
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
      const sourceTag = $("source", video);

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

  function getFallbackSource(video) {
    const primary =
      video?.dataset?.zyloPrimary ||
      video?.dataset?.src ||
      video?.getAttribute?.("data-src") ||
      video?.getAttribute?.("src") ||
      "";

    return isDefaultLocalVideo(primary)
      ? CONFIG.DEFAULT_VIDEO
      : "";
  }

  function getFastVideoSource(video) {
    const primary = captureVideoSource(video);

    if (isDefaultLocalVideo(primary)) {
      return CONFIG.CDN_VIDEO;
    }

    return primary;
  }

  function warmVideoCDN() {
    try {
      const url = new URL(CONFIG.CDN_VIDEO);

      if (
        document.head.querySelector(
          `link[rel="preconnect"][href="${url.origin}"]`
        )
      ) {
        return;
      }

      const link = document.createElement("link");

      link.rel = "preconnect";
      link.href = url.origin;
      link.crossOrigin = "";

      document.head.appendChild(link);
    } catch (error) {
      console.warn("ZYLO CDN preconnect error:", error);
    }
  }

  /* =========================================================
     VIDEO ENGINE
     ZYLO TIKTOK-STYLE ONE-SWIPE VIDEO SYSTEM
     ========================================================= */

  const VideoEngine = (() => {
    let feed = null;
    let pages = [];
    let activeIndex = -1;
    let scrollTimer = null;
    let wheelLocked = false;
    let touchStartX = 0;
    let touchStartY = 0;
    let touching = false;
    let initialized = false;
    let observer = null;
    let autoNextLock = false;

    function getFeed() {
      return $(".video-feed");
    }

    function getPages() {
      if (!feed) {
        feed = getFeed();
      }

      if (!feed) return [];

      return $$(".video-page", feed);
    }

    function getVideo(page) {
      return page ? $("video", page) : null;
    }

    function prepareVideo(video) {
      if (!video) return;

      captureVideoSource(video);

      video.muted = true;
      video.defaultMuted = true;
      video.playsInline = true;
      video.controls = false;

      video.setAttribute("muted", "");
      video.setAttribute("playsinline", "");
      video.setAttribute("webkit-playsinline", "");

      video.loop = false;
      video.removeAttribute("loop");

      if (!video.dataset.zyloPrepared) {
        video.dataset.zyloPrepared = "true";
        video.dataset.zyloEnded = "false";
        video.dataset.zyloWatchStarted = "false";
        video.dataset.zyloWatchSeconds = "0";
      }
    }

    function ensureSource(video, preloadMode = "metadata") {
      if (!video) return false;

      prepareVideo(video);

      const primary = captureVideoSource(video);

      if (!primary) return false;

      const fastSource = getFastVideoSource(video);

      const currentSrc =
        video.currentSrc ||
        video.src ||
        "";

      const wanted = normalizeVideoSource(fastSource);

      if (
        !currentSrc ||
        currentSrc === window.location.href
      ) {
        video.src = fastSource;
        video.preload = preloadMode;

        video.dataset.zyloSourceState =
          fastSource === primary
            ? "primary"
            : "cdn";

        return true;
      }

      if (
        normalizeVideoSource(currentSrc) === wanted
      ) {
        video.preload = preloadMode;
        return true;
      }

      if (video.dataset.zyloUsingFallback !== "true") {
        video.src = fastSource;
        video.preload = preloadMode;

        video.dataset.zyloSourceState =
          fastSource === primary
            ? "primary"
            : "cdn";
      }

      return true;
    }

    function installErrorFallback(video) {
      if (
        !video ||
        video.dataset.zyloErrorHandler === "true"
      ) {
        return;
      }

      video.dataset.zyloErrorHandler = "true";

      video.addEventListener("error", () => {
        const primary =
          video.dataset.zyloPrimary ||
          "";

        if (!primary) return;

        if (
          normalizeVideoSource(video.currentSrc) ===
          normalizeVideoSource(primary)
        ) {
          console.warn(
            "ZYLO: video source failed:",
            primary
          );
          return;
        }

        if (
          video.dataset.zyloUsingFallback === "true"
        ) {
          return;
        }

        video.dataset.zyloUsingFallback = "true";
        video.src = primary;
        video.preload = "auto";

        try {
          video.load();
        } catch {}

        if (
          video.dataset.zyloActive === "true"
        ) {
          window.setTimeout(
            () => playVideo(video),
            CONFIG.VIDEO.PLAY_RETRY_MS
          );
        }
      });
    }

    function attachEndedHandler(video) {
      if (
        !video ||
        video.dataset.zyloEndedHandler === "true"
      ) {
        return;
      }

      video.dataset.zyloEndedHandler = "true";

      video.addEventListener("ended", () => {
        if (autoNextLock) return;

        autoNextLock = true;

        const page =
          video.closest(".video-page");

        const index = pages.indexOf(page);

        if (index >= 0) {
          activeIndex = index;
        }

        window.setTimeout(() => {
          next(true);

          window.setTimeout(() => {
            autoNextLock = false;
          }, CONFIG.VIDEO.WHEEL_LOCK_MS);
        }, CONFIG.VIDEO.AUTO_NEXT_DELAY_MS);
      });
    }

    function attachWatchAnalytics(video) {
      if (
        !video ||
        video.dataset.zyloAnalyticsHandler === "true"
      ) {
        return;
      }

      video.dataset.zyloAnalyticsHandler = "true";

      video.addEventListener("timeupdate", () => {
        const page =
          video.closest(".video-page");

        if (!page) return;

        if (
          video.dataset.zyloActive !== "true"
        ) {
          return;
        }

        const current =
          Math.floor(video.currentTime || 0);

        const previous =
          Number(video.dataset.zyloWatchSeconds || 0);

        if (current >= previous + 5) {
          video.dataset.zyloWatchSeconds =
            String(current);

          Analytics.videoWatch(
            page,
            current
          );
        }
      });

      video.addEventListener("play", () => {
        const page =
          video.closest(".video-page");

        if (
          page &&
          video.dataset.zyloWatchStarted !== "true"
        ) {
          video.dataset.zyloWatchStarted = "true";

          Analytics.videoImpression(page);
        }
      });
    }

    function registerVideo(video) {
      if (!video) return;

      prepareVideo(video);
      installErrorFallback(video);
      attachEndedHandler(video);
      attachWatchAnalytics(video);
    }

    function smartLoad(index) {
      if (!pages.length) return;

      let saveData = false;
      let effectiveType = "";

      try {
        const connection =
          navigator.connection ||
          navigator.mozConnection ||
          navigator.webkitConnection;

        saveData = Boolean(connection?.saveData);
        effectiveType =
          connection?.effectiveType || "";
      } catch {}

      pages.forEach((page, i) => {
        const video = getVideo(page);

        if (!video) return;

        const distance = Math.abs(i - index);

        if (distance === 0) {
          ensureSource(video, "auto");
        } else if (
          distance === 1 &&
          !saveData &&
          effectiveType !== "2g"
        ) {
          ensureSource(video, "auto");
        } else {
          video.preload = "none";
        }
      });
    }

    function pauseAll(exceptVideo = null) {
      pages.forEach((page) => {
        const video = getVideo(page);

        if (!video || video === exceptVideo) return;

        try {
          video.pause();
        } catch {}

        video.dataset.zyloActive = "false";
        video.dataset.zyloPlaying = "false";
      });
    }

    async function playVideo(video) {
      if (!video) return false;

      prepareVideo(video);
      ensureSource(video, "auto");

      video.muted = true;
      video.defaultMuted = true;
      video.playsInline = true;
      video.loop = false;

      try {
        const promise = video.play();

        if (
          promise &&
          typeof promise.then === "function"
        ) {
          await promise;
        }

        video.dataset.zyloPlaying = "true";

        return true;
      } catch (error) {
        video.dataset.zyloPlaying = "false";

        window.setTimeout(() => {
          if (
            video.dataset.zyloActive === "true"
          ) {
            video.muted = true;

            video.play().catch(() => {});
          }
        }, CONFIG.VIDEO.PLAY_RETRY_MS);

        return false;
      }
    }

    async function activate(index, options = {}) {
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

      const video = getVideo(page);

      activeIndex = index;

      pages.forEach((item, i) => {
        const active = i === index;

        item.classList.toggle(
          "active",
          active
        );

        item.dataset.active =
          active ? "true" : "false";

        const itemVideo =
          getVideo(item);

        if (itemVideo) {
          itemVideo.dataset.zyloActive =
            active ? "true" : "false";

          itemVideo.loop = false;

          if (!active) {
            itemVideo.dataset.zyloWatchStarted =
              "false";

            itemVideo.dataset.zyloWatchSeconds =
              "0";
          }
        }
      });

      pauseAll(video);
      smartLoad(index);

      if (video) {
        await playVideo(video);
      }

      updateURL(
        page,
        options.updateHash !== false
      );

      dispatchActiveEvent(
        page,
        index
      );
    }

    function dispatchActiveEvent(page, index) {
      try {
        window.dispatchEvent(
          new CustomEvent(
            "zylo:videochange",
            {
              detail: {
                index,
                page,
                video: getVideo(page)
              }
            }
          )
        );
      } catch {}
    }

    function findNearestIndex() {
      if (!feed || !pages.length) {
        return -1;
      }

      const feedRect =
        feed.getBoundingClientRect();

      const feedCenter =
        feedRect.top +
        feedRect.height / 2;

      let bestIndex = 0;
      let bestDistance = Infinity;

      pages.forEach((page, index) => {
        const rect =
          page.getBoundingClientRect();

        const center =
          rect.top +
          rect.height / 2;

        const distance =
          Math.abs(center - feedCenter);

        if (distance < bestDistance) {
          bestDistance = distance;
          bestIndex = index;
        }
      });

      return bestIndex;
    }

    function scrollToPage(
      index,
      behavior = "smooth"
    ) {
      refresh();

      if (!feed || !pages.length) return;

      index = Math.max(
        0,
        Math.min(index, pages.length - 1)
      );

      const page = pages[index];

      if (!page) return;

      activeIndex = index;

      page.scrollIntoView({
        behavior,
        block: "start",
        inline: "nearest"
      });

      window.setTimeout(() => {
        activate(index, {
          updateHash: true
        });
      }, behavior === "smooth" ? 350 : 30);
    }

    function next(fromEnded = false) {
      refresh();

      if (!pages.length) return;

      const current =
        activeIndex >= 0
          ? activeIndex
          : findNearestIndex();

      if (current < 0) return;

      const nextIndex = current + 1;

      if (nextIndex >= pages.length) {
        if (fromEnded) {
          console.log(
            "ZYLO: শেষ ভিডিওতে পৌঁছেছে"
          );
        }

        return;
      }

      const nextPage =
        pages[nextIndex];

      const nextVideo =
        getVideo(nextPage);

      if (nextVideo) {
        prepareVideo(nextVideo);

        ensureSource(
          nextVideo,
          "auto"
        );

        nextVideo.muted = true;
        nextVideo.playsInline = true;
        nextVideo.loop = false;
        nextVideo.preload = "auto";
      }

      scrollToPage(
        nextIndex,
        "smooth"
      );
    }

    function previous() {
      refresh();

      if (!pages.length) return;

      const current =
        activeIndex >= 0
          ? activeIndex
          : findNearestIndex();

      if (current < 0) return;

      const previousIndex =
        Math.max(0, current - 1);

      if (previousIndex !== current) {
        scrollToPage(
          previousIndex,
          "smooth"
        );
      }
    }

    function handleWheel(event) {
      if (
        !feed ||
        isInteractiveTarget(event.target)
      ) {
        return;
      }

      if (Math.abs(event.deltaY) < 12) {
        return;
      }

      if (wheelLocked) {
        return;
      }

      wheelLocked = true;

      if (event.deltaY > 0) {
        next();
      } else {
        previous();
      }

      window.setTimeout(() => {
        wheelLocked = false;
      }, CONFIG.VIDEO.WHEEL_LOCK_MS);
    }

    function handleTouchStart(event) {
      if (!event.touches?.length) {
        return;
      }

      if (isInteractiveTarget(event.target)) {
        return;
      }

      const touch = event.touches[0];

      touchStartX = touch.clientX;
      touchStartY = touch.clientY;
      touching = true;
    }

    function handleTouchEnd(event) {
      if (!touching) return;

      touching = false;

      if (!event.changedTouches?.length) {
        return;
      }

      if (isInteractiveTarget(event.target)) {
        return;
      }

      const touch =
        event.changedTouches[0];

      const deltaY =
        touch.clientY - touchStartY;

      const deltaX =
        touch.clientX - touchStartX;

      if (
        Math.abs(deltaY) <
        Math.abs(deltaX)
      ) {
        return;
      }

      if (
        Math.abs(deltaY) <
        CONFIG.VIDEO.SWIPE_THRESHOLD
      ) {
        window.setTimeout(() => {
          const index =
            findNearestIndex();

          if (index >= 0) {
            activate(index, {
              updateHash: true
            });
          }
        }, 120);

        return;
      }

      if (wheelLocked) return;

      wheelLocked = true;

      if (deltaY < 0) {
        next();
      } else {
        previous();
      }

      window.setTimeout(() => {
        wheelLocked = false;
      }, CONFIG.VIDEO.WHEEL_LOCK_MS);
    }

    function handleScroll() {
      if (!feed) return;

      clearTimeout(scrollTimer);

      scrollTimer = window.setTimeout(() => {
        const index =
          findNearestIndex();

        if (index < 0) return;

        if (index !== activeIndex) {
          activate(index, {
            updateHash: true
          });
        }
      }, CONFIG.VIDEO.SETTLE_DELAY_MS);
    }

    function setupIntersectionObserver() {
      if (observer) {
        observer.disconnect();
        observer = null;
      }

      if (!("IntersectionObserver" in window)) {
        return;
      }

      observer =
        new IntersectionObserver(
          (entries) => {
            let best = null;

            entries.forEach((entry) => {
              if (!entry.isIntersecting) {
                return;
              }

              if (
                !best ||
                entry.intersectionRatio >
                  best.intersectionRatio
              ) {
                best = entry;
              }
            });

            if (!best) return;

            const page =
              best.target;

            const index =
              pages.indexOf(page);

            if (
              index >= 0 &&
              index !== activeIndex &&
              best.intersectionRatio >= 0.70
            ) {
              activate(index, {
                updateHash: true
              });
            }
          },
          {
            root: feed,
            threshold: [
              0.70,
              0.80,
              0.90,
              1
            ]
          }
        );

      pages.forEach((page) => {
        observer.observe(page);
      });
    }

    function forceFeedScrolling() {
      if (!feed) return;

      feed.style.overflowY = "auto";
      feed.style.overflowX = "hidden";
      feed.style.scrollSnapType =
        "y mandatory";
      feed.style.touchAction = "pan-y";
      feed.style.webkitOverflowScrolling =
        "touch";

      pages.forEach((page) => {
        page.style.scrollSnapAlign =
          "start";

        page.style.scrollSnapStop =
          "always";
      });
    }

    function refresh() {
      feed = getFeed();
      pages = getPages();

      forceFeedScrolling();

      pages.forEach((page) => {
        registerVideo(
          getVideo(page)
        );
      });

      setupIntersectionObserver();

      if (
        activeIndex >= pages.length
      ) {
        activeIndex =
          pages.length
            ? pages.length - 1
            : -1;
      }
    }

    function init() {
      if (initialized) {
        refresh();
        return;
      }

      initialized = true;

      refresh();

      if (!feed) {
        console.warn(
          "ZYLO: .video-feed not found"
        );
        return;
      }

      feed.addEventListener(
        "wheel",
        handleWheel,
        { passive: true }
      );

      feed.addEventListener(
        "touchstart",
        handleTouchStart,
        { passive: true }
      );

      feed.addEventListener(
        "touchend",
        handleTouchEnd,
        { passive: true }
      );

      feed.addEventListener(
        "scroll",
        handleScroll,
        { passive: true }
      );

      observer = new MutationObserver(
        () => refresh()
      );

      observer.observe(feed, {
        childList: true,
        subtree: true
      });

      const initialIndex =
        findNearestIndex();

      if (initialIndex >= 0) {
        window.setTimeout(() => {
          activate(
            initialIndex,
            {
              updateHash: false
            }
          );
        }, 120);
      }

      console.log(
        "ZYLO Video Engine initialized"
      );
    }

    function getActiveIndex() {
      return activeIndex;
    }

    return {
      init,
      refresh,
      getPages,
      getActiveIndex,
      activate,
      next,
      previous,
      scrollToPage,
      playVideo
    };
  })();

  /* =========================================================
     URL / HASH
     ========================================================= */

  function updateURL(
    page,
    enabled = true
  ) {
    if (!enabled || !page) return;

    const id =
      page.dataset.videoId;

    if (!id) return;

    try {
      history.replaceState(
        null,
        "",
        `#video-${encodeURIComponent(id)}`
      );
    } catch {}
  }

  function openHashVideo() {
    const hash =
      window.location.hash || "";

    if (!hash.startsWith("#video-")) {
      return;
    }

    const id =
      decodeURIComponent(
        hash.replace("#video-", "")
      );

    let page = null;

    try {
      page = $(
        `.video-page[data-video-id="${CSS.escape(id)}"]`
      );
    } catch {
      page = null;
    }

    if (!page) return;

    const pages =
      VideoEngine.getPages();

    const index =
      pages.indexOf(page);

    if (index >= 0) {
      window.setTimeout(() => {
        VideoEngine.scrollToPage(
          index,
          "auto"
        );
      }, 150);
    }
  }

  /* =========================================================
     LIKE
     ========================================================= */

  function getVideoIdFromButton(button) {
    const page =
      button?.closest?.(
        ".video-page"
      );

    return (
      page?.dataset?.videoId ||
      page?.id ||
      ""
    );
  }

  function getLikeSet() {
    const values =
      getStorage(
        CONFIG.STORAGE.LIKES,
        []
      );

    return Array.isArray(values)
      ? values
      : [];
  }

  function updateCount(
    button,
    delta
  ) {
    if (!button) return;

    const label =
      $(".action-count,.count,.action-number", button);

    if (!label) return;

    const current =
      parseInt(
        label.textContent.replace(
          /[^\d]/g,
          ""
        ),
        10
      ) || 0;

    label.textContent =
      String(
        Math.max(
          0,
          current + delta
        )
      );
  }

  function setupLikeButtons() {
    document.addEventListener(
      "click",
      (event) => {
        const button =
          event.target.closest(
            ".like-btn"
          );

        if (!button) return;

        event.preventDefault();
        event.stopPropagation();

        const id =
          getVideoIdFromButton(
            button
          );

        if (!id) return;

        const page =
          button.closest(
            ".video-page"
          );

        const likes =
          getLikeSet();

        const index =
          likes.indexOf(id);

        if (index >= 0) {
          likes.splice(
            index,
            1
          );

          button.classList.remove(
            "active",
            "liked"
          );

          updateCount(
            button,
            -1
          );

          Analytics.like(
            page,
            false
          );
        } else {
          likes.push(id);

          button.classList.add(
            "active",
            "liked"
          );

          updateCount(
            button,
            1
          );

          Analytics.like(
            page,
            true
          );
        }

        setStorage(
          CONFIG.STORAGE.LIKES,
          likes
        );
      }
    );

    $$(".like-btn").forEach(
      (button) => {
        const id =
          getVideoIdFromButton(
            button
          );

        if (
          getLikeSet().includes(id)
        ) {
          button.classList.add(
            "active",
            "liked"
          );
        }
      }
    );
  }

  /* =========================================================
     SAVE
     ========================================================= */

  function setupSaveButtons() {
    document.addEventListener(
      "click",
      (event) => {
        const button =
          event.target.closest(
            ".save-btn"
          );

        if (!button) return;

        event.preventDefault();
        event.stopPropagation();

        const id =
          getVideoIdFromButton(
            button
          );

        if (!id) return;

        const page =
          button.closest(
            ".video-page"
          );

        const saved =
          getStorage(
            CONFIG.STORAGE.SAVED,
            []
          );

        const index =
          saved.indexOf(id);

        if (index >= 0) {
          saved.splice(
            index,
            1
          );

          button.classList.remove(
            "active",
            "saved"
          );

          Analytics.save(
            page,
            false
          );
        } else {
          saved.push(id);

          button.classList.add(
            "active",
            "saved"
          );

          Analytics.save(
            page,
            true
          );
        }

        setStorage(
          CONFIG.STORAGE.SAVED,
          saved
        );
      }
    );

    $$(".save-btn").forEach(
      (button) => {
        const id =
          getVideoIdFromButton(
            button
          );

        if (
          getStorage(
            CONFIG.STORAGE.SAVED,
            []
          ).includes(id)
        ) {
          button.classList.add(
            "active",
            "saved"
          );
        }
      }
    );
  }

  /* =========================================================
     COMMENTS
     ========================================================= */

  function getComments() {
    const value =
      getStorage(
        CONFIG.STORAGE.COMMENTS,
        {}
      );

    return value &&
      typeof value === "object" &&
      !Array.isArray(value)
      ? value
      : {};
  }

  function setComments(value) {
    setStorage(
      CONFIG.STORAGE.COMMENTS,
      value
    );
  }

  function closeCommentPanel() {
    const panels =
      $$(".zylo-comment-panel,.comment-panel");

    panels.forEach((panel) => {
      if (
        panel.dataset.zyloGenerated ===
        "true"
      ) {
        panel.remove();
      } else {
        panel.classList.remove(
          "open",
          "active"
        );
      }
    });
  }

  function openComments(button) {
    const id =
      getVideoIdFromButton(
        button
      );

    if (!id) return;

    const page =
      button.closest(
        ".video-page"
      );

    Analytics.commentOpen(page);

    closeCommentPanel();

    const comments =
      getComments()[id] || [];

    const panel =
      document.createElement("div");

    panel.className =
      "zylo-comment-panel";

    panel.dataset.zyloGenerated =
      "true";

    panel.innerHTML = `
      <div class="zylo-comment-inner">

        <div class="zylo-comment-header">
          <strong>Comments</strong>

          <button
            type="button"
            data-zylo-comment-close
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div class="zylo-comment-list">
          ${
            comments.length
              ? comments
                  .map(
                    (comment) => `
                      <div class="zylo-comment-item">
                        <strong>
                          ${escapeHTML(
                            comment.username ||
                              "zylo_creator"
                          )}
                        </strong>

                        <span>
                          ${escapeHTML(
                            comment.text
                          )}
                        </span>
                      </div>
                    `
                  )
                  .join("")
              : `
                  <div class="zylo-comment-empty">
                    No comments yet.
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
            required
          />

          <button type="submit">
            Send
          </button>
        </form>

      </div>
    `;

    document.body.appendChild(
      panel
    );

    const form =
      $(".zylo-comment-form", panel);

    const input =
      $("input", form);

    form.addEventListener(
      "submit",
      (event) => {
        event.preventDefault();

        const text =
          input.value.trim();

        if (!text) return;

        const all =
          getComments();

        if (!Array.isArray(all[id])) {
          all[id] = [];
        }

        all[id].push({
          id: makeId("comment"),
          uid: getUserUID(),
          username: getUsername(),
          text,
          createdAt: Date.now()
        });

        setComments(all);

        input.value = "";

        openComments(button);
      }
    );

    $(
      "[data-zylo-comment-close]",
      panel
    )?.addEventListener(
      "click",
      closeCommentPanel
    );

    input.focus();

    panel.classList.add(
      "open",
      "active"
    );
  }

  function setupCommentButtons() {
    document.addEventListener(
      "click",
      (event) => {
        const button =
          event.target.closest(
            '[aria-label="Comments"],.comment-btn'
          );

        if (!button) return;

        event.preventDefault();
        event.stopPropagation();

        openComments(button);
      }
    );
  }
