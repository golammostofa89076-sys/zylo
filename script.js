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

    function smartLoad(index) {
      if (!pages.length) return;

      let saveData = false;
      let slowNetwork = false;

      try {
        const c =
          navigator.connection ||
          navigator.mozConnection ||
          navigator.webkitConnection;

        saveData = Boolean(c?.saveData);
        slowNetwork = ["slow-2g", "2g"].includes(c?.effectiveType);
      } catch {}

      pages.forEach((page, i) => {
        const video = getVideo(page);
        if (!video) return;

        const distance = Math.abs(i - index);

        if (distance === 0) {
          ensureSource(video, "auto");
        } else if (distance === 1 && !saveData && !slowNetwork) {
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
      video.playsInline = true;

      try {
        const promise = video.play();

        if (promise && typeof promise.catch === "function") {
          await promise;
        }

        video.dataset.zyloPlaying = "true";
        return true;
      } catch (error) {
        video.dataset.zyloPlaying = "false";

        window.setTimeout(() => {
          if (video.dataset.zyloActive === "true") {
            video.play().catch(() => {});
          }
        }, CONFIG.VIDEO.PLAY_RETRY_MS);

        return false;
      }
    }

    async function activate(index, options = {}) {
      if (!pages.length) refresh();
      if (!pages.length) return;

      index = Math.max(
        0,
        Math.min(index, pages.length - 1)
      );

      const page = pages[index];
      const video = getVideo(page);

      if (!page) return;

      activeIndex = index;

      pages.forEach((item, i) => {
        item.classList.toggle("active", i === index);
        item.dataset.active =
          i === index ? "true" : "false";

        const itemVideo = getVideo(item);

        if (itemVideo) {
          itemVideo.dataset.zyloActive =
            i === index ? "true" : "false";
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

      dispatchActiveEvent(page, index);
    }

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

    function findNearestIndex() {
      if (!feed || !pages.length) return -1;

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

      if (!pages.length) return;

      index = Math.max(
        0,
        Math.min(index, pages.length - 1)
      );

      const page = pages[index];

      if (!page) return;

      activeIndex = index;

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

      activate(index, {
        updateHash: true
      });
    }

    function next(fromEnded = false) {
      refresh();

      if (!pages.length) return;

      const current =
        activeIndex >= 0
          ? activeIndex
          : findNearestIndex();

      if (current < 0) return;

      const nextIndex =
        current + 1;

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
        nextVideo.preload = "auto";
      }

      scrollToPage(
        nextIndex,
        "smooth"
      );

      window.setTimeout(() => {
        refresh();

        if (pages[nextIndex]) {
          activate(
            nextIndex,
            {
              updateHash: true
            }
          );
        }
      }, CONFIG.VIDEO.SETTLE_DELAY_MS + 120);
    }

    function previous() {
      refresh();

      if (!pages.length) return;

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

    function handleWheel(event) {
      if (
        !feed ||
        isInteractiveTarget(
          event.target
        )
      ) {
        return;
      }

      const delta =
        event.deltaY;

      if (
        Math.abs(delta) < 12
      ) {
        return;
      }

      event.preventDefault();

      if (wheelLocked) return;

      wheelLocked = true;

      if (delta > 0) {
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

      if (
        isInteractiveTarget(
          event.target
        )
      ) {
        return;
      }

      const touch =
        event.touches[0];

      touchStartX =
        touch.clientX;

      touchStartY =
        touch.clientY;

      touching = true;
    }

    function handleTouchEnd(event) {
      if (!touching) return;

      touching = false;

      if (
        isInteractiveTarget(
          event.target
        )
      ) {
        return;
      }

      if (
        !event.changedTouches?.length
      ) {
        return;
      }

      const touch =
        event.changedTouches[0];

      const deltaY =
        touch.clientY -
        touchStartY;

      const deltaX =
        touch.clientX -
        touchStartX;

      if (
        Math.abs(deltaY) <
        CONFIG.VIDEO.SWIPE_THRESHOLD
      ) {
        return;
      }

      if (
        Math.abs(deltaY) <
        Math.abs(deltaX)
      ) {
        return;
      }

      if (deltaY < 0) {
        next();
      } else {
        previous();
      }
    }

    function handleScroll() {
      if (!feed) return;

      clearTimeout(
        scrollTimer
      );

      scrollTimer =
        window.setTimeout(() => {
          const index =
            findNearestIndex();

          if (
            index < 0 ||
            index === activeIndex
          ) {
            return;
          }

          activate(
            index,
            {
              updateHash: true
            }
          );
        },
        CONFIG.VIDEO
          .SETTLE_DELAY_MS
      );
    }

    function setupIntersectionObserver() {
      if (visibilityObserver) {
        visibilityObserver.disconnect();
      }

      if (
        !(
          "IntersectionObserver" in
          window
        )
      ) {
        return;
      }

      visibilityObserver =
        new IntersectionObserver(
          (entries) => {
            let best = null;

            entries.forEach(
              (entry) => {
                if (
                  entry.isIntersecting &&
                  entry.intersectionRatio >=
                    0.65
                ) {
                  if (
                    !best ||
                    entry.intersectionRatio >
                      best.intersectionRatio
                  ) {
                    best = entry;
                  }
                }
              }
            );

            if (!best) return;

            const page =
              best.target;

            const index =
              pages.indexOf(page);

            if (
              index >= 0 &&
              index !== activeIndex
            ) {
              activate(
                index,
                {
                  updateHash: true
                }
              );
            }
          },
          {
            root: feed,
            threshold: [
              0.65,
              0.8,
              1
            ]
          }
        );

      pages.forEach(
        (page) =>
          visibilityObserver.observe(
            page
          )
      );
    }

    function refresh() {
      feed = getFeed();
      pages = getPages();

      pages.forEach((page) => {
        const video =
          getVideo(page);

        registerVideo(video);
      });

      setupIntersectionObserver();

      if (
        activeIndex >=
        pages.length
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

      if (!feed) return;

      feed.addEventListener(
        "wheel",
        handleWheel,
        {
          passive: false
        }
      );

      feed.addEventListener(
        "touchstart",
        handleTouchStart,
        {
          passive: true
        }
      );

      feed.addEventListener(
        "touchend",
        handleTouchEnd,
        {
          passive: true
        }
      );

      feed.addEventListener(
        "scroll",
        handleScroll,
        {
          passive: true
        }
      );

      observer =
        new MutationObserver(
          () => {
            refresh();
          }
        );

      observer.observe(
        feed,
        {
          childList: true,
          subtree: true
        }
      );

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
        }, 250);
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
    if (
      !enabled ||
      !page
    ) {
      return;
    }

    const id =
      page.dataset.videoId;

    if (!id) return;

    try {
      history.replaceState(
        null,
        "",
        `#video-${encodeURIComponent(
          id
        )}`
      );
    } catch {}
  }

  function openHashVideo() {
    const hash =
      window.location.hash ||
      "";

    if (
      !hash.startsWith(
        "#video-"
      )
    ) {
      return;
    }

    const id =
      decodeURIComponent(
        hash.replace(
          "#video-",
          ""
        )
      );

    const page =
      $(
        `.video-page[data-video-id="${CSS.escape(
          id
        )}"]`
      );

    if (!page) return;

    const pages =
      VideoEngine.getPages();

    const index =
      pages.indexOf(page);

    if (index >= 0) {
      window.setTimeout(
        () => {
          VideoEngine.scrollToPage(
            index,
            "auto"
          );
        },
        150
      );
    }
  }

  /* =========================================================
     LIKE
     ========================================================= */

  function getVideoIdFromButton(
    button
  ) {
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

    return Array.isArray(
      values
    )
      ? values
      : [];
  }

  function updateCount(
    button,
    delta
  ) {
    if (!button) return;

    const label =
      $(
        ".action-count,.count,.action-number",
        button
      );

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
        }

        setStorage(
          CONFIG.STORAGE.LIKES,
          likes
        );

        Analytics.track(
          "like",
          {
            videoId: id,
            active:
              index < 0
          }
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
          getLikeSet().includes(
            id
          )
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
        } else {
          saved.push(id);

          button.classList.add(
            "active",
            "saved"
          );
        }

        setStorage(
          CONFIG.STORAGE.SAVED,
          saved
        );

        Analytics.track(
          "save",
          {
            videoId: id,
            active:
              index < 0
          }
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
     MOBILE OVERLAY UI - SEARCH + COMMENTS
     TikTok-style behavior without changing existing feed buttons.
     ========================================================= */

  function ensureOverlayStyles() {
    if (
      document.getElementById(
        "zylo-overlay-styles"
      )
    ) {
      return;
    }

    const style =
      document.createElement(
        "style"
      );

    style.id =
      "zylo-overlay-styles";

    style.textContent = `
      html.zylo-overlay-open,
      body.zylo-overlay-open {
        overflow: hidden !important;
        overscroll-behavior: none !important;
      }

      .zylo-search-overlay,
      .zylo-comment-panel {
        position: fixed !important;
        inset: 0 !important;
        width: 100% !important;
        height: 100dvh !important;
        min-height: 100svh !important;
        z-index: 100000 !important;
        margin: 0 !important;
        padding: 0 !important;
        display: flex !important;
        align-items: stretch !important;
        justify-content: stretch !important;
        background: rgba(0,0,0,.68) !important;
        opacity: 0;
        visibility: hidden;
        pointer-events: none;
        transition: opacity .18s ease, visibility .18s ease;
        box-sizing: border-box !important;
      }

      .zylo-search-overlay.open,
      .zylo-search-overlay.active,
      .zylo-comment-panel.open,
      .zylo-comment-panel.active {
        opacity: 1 !important;
        visibility: visible !important;
        pointer-events: auto !important;
      }

      .zylo-search-inner {
        position: absolute !important;
        inset: 0 !important;
        width: 100% !important;
        height: 100% !important;
        background: #fff !important;
        color: #111 !important;
        display: flex !important;
        flex-direction: column !important;
        box-sizing: border-box !important;
        padding: max(12px, env(safe-area-inset-top)) 14px max(16px, env(safe-area-inset-bottom)) !important;
      }

      .zylo-search-top {
        display: flex !important;
        align-items: center !important;
        gap: 10px !important;
        min-height: 52px !important;
        flex: 0 0 auto !important;
      }

      .zylo-search-close {
        width: 44px !important;
        height: 44px !important;
        flex: 0 0 44px !important;
        border: 0 !important;
        background: transparent !important;
        color: #111 !important;
        font-size: 32px !important;
        line-height: 1 !important;
        padding: 0 !important;
        cursor: pointer !important;
        -webkit-tap-highlight-color: transparent !important;
      }

      .zylo-search-input-wrap {
        flex: 1 1 auto !important;
        height: 44px !important;
        display: flex !important;
        align-items: center !important;
        background: #f1f1f1 !important;
        border-radius: 22px !important;
        padding: 0 14px !important;
      }

      .zylo-search-input {
        width: 100% !important;
        height: 44px !important;
        border: 0 !important;
        outline: 0 !important;
        background: transparent !important;
        color: #111 !important;
        font-size: 16px !important;
        padding: 0 !important;
        margin: 0 !important;
        box-sizing: border-box !important;
      }

      .zylo-search-results {
        flex: 1 1 auto !important;
        min-height: 0 !important;
        overflow-y: auto !important;
        -webkit-overflow-scrolling: touch !important;
        overscroll-behavior: contain !important;
        padding: 12px 0 20px !important;
      }

      .zylo-search-result {
        width: 100% !important;
        min-height: 56px !important;
        display: flex !important;
        align-items: center !important;
        text-align: left !important;
        border: 0 !important;
        border-bottom: 1px solid #eee !important;
        background: #fff !important;
        color: #111 !important;
        padding: 12px 8px !important;
        font-size: 16px !important;
        cursor: pointer !important;
      }

      .zylo-search-empty {
        padding: 40px 12px !important;
        text-align: center !important;
        color: #777 !important;
      }

      .zylo-comment-panel {
        align-items: flex-end !important;
        background: rgba(0,0,0,.58) !important;
      }

      .zylo-comment-inner {
        position: relative !important;
        width: 100% !important;
        height: min(72dvh, 680px) !important;
        min-height: 300px !important;
        max-height: calc(100dvh - env(safe-area-inset-top)) !important;
        background: #fff !important;
        color: #111 !important;
        border-radius: 18px 18px 0 0 !important;
        display: flex !important;
        flex-direction: column !important;
        overflow: hidden !important;
        transform: translateY(100%) !important;
        transition: transform .22s cubic-bezier(.2,.8,.2,1) !important;
        padding-bottom: env(safe-area-inset-bottom) !important;
        box-sizing: border-box !important;
      }

      .zylo-comment-panel.open .zylo-comment-inner,
      .zylo-comment-panel.active .zylo-comment-inner {
        transform: translateY(0) !important;
      }

      .zylo-comment-header {
        position: relative !important;
        min-height: 54px !important;
        flex: 0 0 54px !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        border-bottom: 1px solid #eee !important;
        font-size: 16px !important;
      }

      .zylo-comment-header::before {
        content: "" !important;
        position: absolute !important;
        top: 8px !important;
        left: 50% !important;
        transform: translateX(-50%) !important;
        width: 38px !important;
        height: 4px !important;
        border-radius: 99px !important;
        background: #d4d4d4 !important;
      }

      .zylo-comment-header button {
        position: absolute !important;
        right: 8px !important;
        top: 5px !important;
        width: 44px !important;
        height: 44px !important;
        border: 0 !important;
        background: transparent !important;
        color: #111 !important;
        font-size: 28px !important;
        cursor: pointer !important;
      }

      .zylo-comment-list {
        flex: 1 1 auto !important;
        min-height: 0 !important;
        overflow-y: auto !important;
        -webkit-overflow-scrolling: touch !important;
        overscroll-behavior: contain !important;
        padding: 8px 14px 10px !important;
      }

      .zylo-comment-item {
        display: flex !important;
        flex-direction: column !important;
        gap: 3px !important;
        padding: 10px 0 !important;
        border-bottom: 1px solid #f0f0f0 !important;
        font-size: 14px !important;
      }

      .zylo-comment-item strong {
        font-size: 13px !important;
      }

      .zylo-comment-item span {
        word-break: break-word !important;
        line-height: 1.4 !important;
      }

      .zylo-comment-empty {
        height: 100% !important;
        min-height: 180px !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        color: #777 !important;
        text-align: center !important;
      }

      .zylo-comment-form {
        flex: 0 0 auto !important;
        display: flex !important;
        align-items: center !important;
        gap: 8px !important;
        padding: 9px 12px max(9px, env(safe-area-inset-bottom)) !important;
        border-top: 1px solid #eee !important;
        background: #fff !important;
      }

      .zylo-comment-form input {
        flex: 1 1 auto !important;
        min-width: 0 !important;
        height: 42px !important;
        border: 1px solid #ddd !important;
        border-radius: 21px !important;
        outline: 0 !important;
        padding: 0 14px !important;
        background: #f7f7f7 !important;
        color: #111 !important;
        font-size: 15px !important;
      }

      .zylo-comment-form button {
        flex: 0 0 auto !important;
        height: 42px !important;
        border: 0 !important;
        border-radius: 21px !important;
        padding: 0 16px !important;
        background: #111 !important;
        color: #fff !important;
        font-weight: 700 !important;
        cursor: pointer !important;
      }

      @media (min-width: 700px) {
        .zylo-search-inner {
          width: min(680px, 100%) !important;
          left: 50% !important;
          right: auto !important;
          transform: translateX(-50%) !important;
          box-shadow: 0 0 40px rgba(0,0,0,.25) !important;
        }

        .zylo-comment-inner {
          width: min(680px, 100%) !important;
        }
      }
    `;

    document.head.appendChild(style);
  }
                       
