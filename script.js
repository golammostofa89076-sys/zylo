/* =========================================================
   ZYLO v1016 - FAST VIDEO + TIKTOK STYLE OVERLAYS + ANALYTICS
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
     Collects product events without recording video/audio or passwords.
     Events are queued locally and sent in small batches when possible.
     ========================================================= */

  const Analytics = (() => {
    let current = null;
    let flushTimer = null;

    function queue() {
      const value = getStorage(CONFIG.ANALYTICS.STORAGE, []);

      return Array.isArray(value) ? value : [];
    }

    function connectionInfo() {
      try {
        const c =
          navigator.connection ||
          navigator.mozConnection ||
          navigator.webkitConnection;

        return {
          saveData: Boolean(c?.saveData),
          effectiveType: c?.effectiveType || "unknown"
        };
      } catch {
        return {
          saveData: false,
          effectiveType: "unknown"
        };
      }
    }

    function baseEvent(type, data = {}) {
      return {
        eventId: makeId("evt"),
        type,
        ts: Date.now(),
        sessionId: getSessionId(),
        page: window.location.pathname,
        referrer: document.referrer
          ? new URL(document.referrer).origin
          : "",
        ...connectionInfo(),
        ...data
      };
    }

    function getSessionId() {
      const key = "zylo_session_id_v1";

      let id = localStorage.getItem(key);

      if (!id) {
        id = makeId("session");

        try {
          localStorage.setItem(key, id);
        } catch {}
      }

      return id;
    }

    function track(type, data = {}) {
      const events = queue();

      events.push(
        baseEvent(type, data)
      );

      while (
        events.length >
        CONFIG.ANALYTICS.MAX_QUEUE
      ) {
        events.shift();
      }

      setStorage(
        CONFIG.ANALYTICS.STORAGE,
        events
      );

      scheduleFlush();
    }

    async function flush() {
      const events = queue();

      if (!events.length) {
        return;
      }

      const batch = events.slice(0, 20);

      const body = JSON.stringify({
        events: batch
      });

      try {
        if (
          navigator.sendBeacon &&
          body.length < 60000
        ) {
          const blob = new Blob(
            [body],
            {
              type: "application/json"
            }
          );

          const accepted =
            navigator.sendBeacon(
              CONFIG.ANALYTICS.ENDPOINT,
              blob
            );

          if (accepted) {
            setStorage(
              CONFIG.ANALYTICS.STORAGE,
              events.slice(batch.length)
            );

            return;
          }
        }

        const response = await fetch(
          CONFIG.ANALYTICS.ENDPOINT,
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json"
            },
            body,
            keepalive: true
          }
        );

        if (response.ok) {
          setStorage(
            CONFIG.ANALYTICS.STORAGE,
            events.slice(batch.length)
          );
        }
      } catch {}
    }

    function scheduleFlush() {
      if (flushTimer) {
        return;
      }

      flushTimer = window.setTimeout(
        () => {
          flushTimer = null;
          flush();
        },
        CONFIG.ANALYTICS.FLUSH_INTERVAL_MS
      );
    }

    function setup() {
      window.addEventListener(
        "zylo:videochange",
        (event) => {
          const page =
            event.detail?.page;

          const video =
            event.detail?.video;

          if (!page) {
            return;
          }

          if (current) {
            const watched =
              Math.max(
                0,
                Date.now() -
                  current.startedAt
              );

            if (watched >= 1000) {
              track(
                "video_watch",
                {
                  videoId:
                    current.videoId,

                  watchedMs:
                    Math.min(
                      watched,
                      3600000
                    )
                }
              );
            }
          }

          current = {
            videoId:
              page.dataset.videoId ||
              page.id ||
              "",

            startedAt:
              Date.now(),

            video
          };

          track(
            "video_impression",
            {
              videoId:
                current.videoId
            }
          );
        }
      );

      window.addEventListener(
        "pagehide",
        () => {
          if (current) {
            const watched =
              Math.max(
                0,
                Date.now() -
                  current.startedAt
              );

            if (watched >= 1000) {
              track(
                "video_watch",
                {
                  videoId:
                    current.videoId,

                  watchedMs:
                    Math.min(
                      watched,
                      3600000
                    )
                }
              );
            }
          }

          flush();
        }
      );

      window.setInterval(
        () =>
          flush(),
        CONFIG.ANALYTICS
          .FLUSH_INTERVAL_MS
      );
    }

    return {
      track,
      setup,
      flush
    };
  })();

  /* =========================================================
     VIDEO SOURCE
     ========================================================= */

  function normalizeVideoSource(source) {
    if (!source) {
      return "";
    }

    try {
      return new URL(
        source,
        window.location.href
      ).href;
    } catch {
      return String(source);
    }
  }

  function isDefaultLocalVideo(source) {
    if (!source) {
      return false;
    }

    const clean =
      String(source)
        .split("?")[0];

    return (
      clean.includes(
        "/backend/uploads/video1.mp4"
      ) ||
      clean.endsWith(
        "backend/uploads/video1.mp4"
      ) ||
      clean ===
        CONFIG.DEFAULT_VIDEO
    );
  }

  function captureVideoSource(video) {
    if (!video) {
      return "";
    }

    if (video.dataset.zyloPrimary) {
      return video.dataset.zyloPrimary;
    }

    let source =
      video.dataset.src ||
      video.getAttribute(
        "data-src"
      ) ||
      video.getAttribute(
        "src"
      ) ||
      "";

    if (!source) {
      const sourceTag =
        $("source", video);

      if (sourceTag) {
        source =
          sourceTag.dataset.src ||
          sourceTag.getAttribute(
            "data-src"
          ) ||
          sourceTag.getAttribute(
            "src"
          ) ||
          "";
      }
    }

    if (!source) {
      source =
        CONFIG.DEFAULT_VIDEO;
    }

    video.dataset.zyloPrimary =
      source;

    return source;
  }

  function getFallbackSource(video) {
    const primary =
      video?.dataset?.zyloPrimary ||
      video?.dataset?.src ||
      video?.dataset?.[
        "src"
      ] ||
      video?.getAttribute?.(
        "data-src"
      ) ||
      video?.getAttribute?.(
        "src"
      ) ||
      "";

    return isDefaultLocalVideo(
      primary
    )
      ? CONFIG.CDN_VIDEO
      : "";
  }

  function warmVideoCDN() {
    try {
      const origin =
        new URL(
          CONFIG.CDN_VIDEO
        ).origin;

      if (
        document.head.querySelector(
          `link[data-zylo-preconnect="${origin}"]`
        )
      ) {
        return;
      }

      const link =
        document.createElement(
          "link"
        );

      link.rel =
        "preconnect";

      link.href =
        origin;

      link.crossOrigin =
        "anonymous";

      link.dataset.zyloPreconnect =
        origin;

      document.head.appendChild(
        link
      );
    } catch {}
  }

  function getVideo(page) {
    return page
      ? $("video", page)
      : null;
  }

  function prepareVideo(video) {
    if (!video) {
      return;
    }

    captureVideoSource(
      video
    );

    video.muted = true;
    video.playsInline = true;

    try {
      video.setAttribute(
        "playsinline",
        ""
      );

      video.setAttribute(
        "webkit-playsinline",
        ""
      );

      video.setAttribute(
        "muted",
        ""
      );
    } catch {}

    if (
      !video.dataset.zyloPrepared
    ) {
      video.dataset.zyloPrepared =
        "true";

      video.addEventListener(
        "loadedmetadata",
        () => {
          if (
            video.dataset
              .zyloActive ===
            "true"
          ) {
            video.play().catch(
              () => {}
            );
          }
        }
      );
    }
  }

  function ensureSource(
    video,
    preload = "auto"
  ) {
    if (!video) {
      return;
    }

    prepareVideo(video);

    const primary =
      video.dataset.zyloPrimary ||
      CONFIG.DEFAULT_VIDEO;

    const fallback =
      getFallbackSource(
        video
      );

    const current =
      video.currentSrc ||
      video.src ||
      "";

    if (
      isDefaultLocalVideo(
        primary
      ) &&
      fallback
    ) {
      if (
        current !==
        normalizeVideoSource(
          fallback
        )
      ) {
        video.src =
          normalizeVideoSource(
            fallback
          );

        video.dataset.zyloSourceState =
          "cdn";

        try {
          video.load();
        } catch {}
      }
    } else if (
      !current
    ) {
      video.src =
        normalizeVideoSource(
          primary
        );

      video.dataset.zyloSourceState =
        "primary";

      try {
        video.load();
      } catch {}
    }

    if (preload) {
      video.preload =
        preload;
    }
  }

  function installErrorFallback(video) {
    if (
      !video ||
      video.dataset
        .zyloErrorHandler ===
        "true"
    ) {
      return;
    }

    video.dataset.zyloErrorHandler =
      "true";

    video.addEventListener(
      "error",
      () => {
        const primary =
          video.dataset
            .zyloPrimary ||
          "";

        if (
          video.dataset
            .zyloUsingPrimaryFallback !==
          "true"
        ) {
          video.dataset
            .zyloUsingPrimaryFallback =
            "true";

          video.src =
            normalizeVideoSource(
              primary
            );

          video.preload =
            "auto";

          video.dataset
            .zyloSourceState =
            "primary-fallback";

          try {
            video.load();
          } catch {}

          if (
            video.dataset
              .zyloActive ===
            "true"
          ) {
            playVideo(video);
          }
        }
      }
    );
  }

  function attachEndedHandler(
    video
  ) {
    if (
      !video ||
      video.dataset
        .zyloEndedHandler ===
        "true"
    ) {
      return;
    }

    video.dataset.zyloEndedHandler =
      "true";

    video.addEventListener(
      "ended",
      () => {
        if (autoNextLock) {
          return;
        }

        autoNextLock = true;

        const currentVideo =
          video;

        const currentPage =
          currentVideo.closest(
            ".video-page"
          );

        const currentIndex =
          pages.indexOf(
            currentPage
          );

        if (
          currentIndex >= 0
        ) {
          activeIndex =
            currentIndex;
        }

        window.setTimeout(
          () => {
            next(true);

            window.setTimeout(
              () => {
                autoNextLock =
                  false;
              },
              CONFIG.VIDEO
                .WHEEL_LOCK_MS
            );
          },
          CONFIG.VIDEO
            .AUTO_NEXT_DELAY_MS
        );
      }
    );
  }

  /* =========================================================
     VIDEO ENGINE
     ========================================================= */

  const VideoEngine = (() => {
    let feed = null;
    let pages = [];
    let activeIndex = -1;

    let initialized =
      false;

    let wheelLocked =
      false;

    let touching =
      false;

    let touchStartX =
      0;

    let touchStartY =
      0;

    let scrollTimer =
      null;

    let visibilityObserver =
      null;

    let observer =
      null;

    let autoNextLock =
      false;

    function getFeed() {
      return (
        document.querySelector(
          ".video-feed"
        ) ||
        document.querySelector(
          "#videoFeed"
        ) ||
        document.querySelector(
          ".feed"
        )
      );
    }

    function getPages() {
      const root =
        getFeed() ||
        document;

      return $$(".video-page", root);
    }

    function smartLoad(index) {
      if (!pages.length) {
        return;
      }

      let saveData =
        false;

      let slowNetwork =
        false;

      try {
        const c =
          navigator.connection ||
          navigator.mozConnection ||
          navigator.webkitConnection;

        saveData =
          Boolean(
            c?.saveData
          );

        slowNetwork =
          [
            "slow-2g",
            "2g"
          ].includes(
            c?.effectiveType
          );
      } catch {}

      pages.forEach(
        (page, i) => {
          const video =
            getVideo(page);

          if (!video) {
            return;
          }

          const distance =
            Math.abs(
              i - index
            );

          if (
            distance === 0
          ) {
            ensureSource(
              video,
              "auto"
            );
          } else if (
            distance === 1 &&
            !saveData &&
            !slowNetwork
          ) {
            ensureSource(
              video,
              "auto"
            );
          } else {
            video.preload =
              "none";
          }
        }
      );
    }

    function pauseAll(
      exceptVideo = null
    ) {
      pages.forEach(
        (page) => {
          const video =
            getVideo(page);

          if (
            !video ||
            video ===
              exceptVideo
          ) {
            return;
          }

          try {
            video.pause();
          } catch {}

          video.dataset
            .zyloActive =
            "false";

          video.dataset
            .zyloPlaying =
            "false";
        }
      );
    }

    async function playVideo(
      video
    ) {
      if (!video) {
        return false;
      }

      prepareVideo(video);

      ensureSource(
        video,
        "auto"
      );

      video.muted = true;
      video.playsInline =
        true;

      try {
        const promise =
          video.play();

        if (
          promise &&
          typeof promise.catch ===
            "function"
        ) {
          await promise;
        }

        video.dataset
          .zyloPlaying =
          "true";

        return true;
      } catch (error) {
        video.dataset
          .zyloPlaying =
          "false";

        window.setTimeout(
          () => {
            if (
              video.dataset
                .zyloActive ===
              "true"
            ) {
              video
                .play()
                .catch(
                  () => {}
                );
            }
          },
          CONFIG.VIDEO
            .PLAY_RETRY_MS
        );

        return false;
      }
    }

    async function activate(
      index,
      options = {}
    ) {
      if (!pages.length) {
        refresh();
      }

      if (!pages.length) {
        return;
      }

      index = Math.max(
        0,
        Math.min(
          index,
          pages.length - 1
        )
      );

      const page =
        pages[index];

      const video =
        getVideo(page);

      if (!page) {
        return;
      }

      activeIndex =
        index;

      pages.forEach(
        (item, i) => {
          item.classList.toggle(
            "active",
            i === index
          );

          item.dataset.active =
            i === index
              ? "true"
              : "false";

          const itemVideo =
            getVideo(item);

          if (itemVideo) {
            itemVideo.dataset
              .zyloActive =
              i === index
                ? "true"
                : "false";
          }
        }
      );

      pauseAll(video);

      smartLoad(index);

      if (video) {
        await playVideo(
          video
        );
      }

      updateURL(
        page,
        options.updateHash !==
          false
      );

      dispatchActiveEvent(
        page,
        index
      );
    }

    function dispatchActiveEvent(
      page,
      index
    ) {
      try {
        window.dispatchEvent(
          new CustomEvent(
            "zylo:videochange",
            {
              detail: {
                index,
                page,
                video:
                  getVideo(page)
              }
            }
          )
        );
      } catch {}
    }

    function findNearestIndex() {
      if (
        !feed ||
        !pages.length
      ) {
        return -1;
      }

      const feedRect =
        feed.getBoundingClientRect();

      const feedCenter =
        feedRect.top +
        feedRect.height / 2;

      let bestIndex = 0;
      let bestDistance =
        Infinity;

      pages.forEach(
        (page, index) => {
          const rect =
            page.getBoundingClientRect();

          const center =
            rect.top +
            rect.height / 2;

          const distance =
            Math.abs(
              center -
                feedCenter
            );

          if (
            distance <
            bestDistance
          ) {
            bestDistance =
              distance;

            bestIndex =
              index;
          }
        }
      );

      return bestIndex;
    }

    function scrollToPage(
      index,
      behavior = "smooth"
    ) {
      refresh();

      if (!pages.length) {
        return;
      }

      index = Math.max(
        0,
        Math.min(
          index,
          pages.length - 1
        )
      );

      const page =
        pages[index];

      if (!page) {
        return;
      }

      activeIndex =
        index;

      if (feed) {
        const targetTop =
          page.offsetTop;

        feed.scrollTo({
          top: targetTop,
          behavior
        });
      } else {
        page.scrollIntoView({
          behavior,
          block: "start",
          inline: "nearest"
        });
      }

      activate(
        index,
        {
          updateHash: true
        }
      );
    }

    function next(
      fromEnded = false
    ) {
      refresh();

      if (!pages.length) {
        return;
      }

      const current =
        activeIndex >= 0
          ? activeIndex
          : findNearestIndex();

      if (current < 0) {
        return;
      }

      const nextIndex =
        current + 1;

      if (
        nextIndex >=
        pages.length
      ) {
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
        prepareVideo(
          nextVideo
        );

        ensureSource(
          nextVideo,
          "auto"
        );

        nextVideo.muted =
          true;

        nextVideo.playsInline =
          true;

        nextVideo.preload =
          "auto";
      }

      scrollToPage(
        nextIndex,
        "smooth"
      );

      window.setTimeout(
        () => {
          refresh();

          if (
            pages[nextIndex]
          ) {
            activate(
              nextIndex,
              {
                updateHash:
                  true
              }
            );
          }
        },
        CONFIG.VIDEO
          .SETTLE_DELAY_MS +
          120
      );
    }

    function previous() {
      refresh();

      if (!pages.length) {
        return;
      }

      const current =
        activeIndex >= 0
          ? activeIndex
          : findNearestIndex();

      const previousIndex =
        Math.max(
          0,
          current - 1
        );

      if (
        previousIndex !==
        current
      ) {
        scrollToPage(
          previousIndex,
          "smooth"
        );
      }
    }
