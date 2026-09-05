/* =========================================================
   ZYLO - COMPLETE FRONTEND ENGINE
   Video Feed
   Auto Play
   Auto Next
   Swipe
   Wheel Navigation
   Smart Preload
   Upload
   Like
   Save
   Comment
   Share
   Music
   Fullscreen
   Follow
   Search
   Profile
   Auth Bridge

   UI / CSS / Button Design is NOT changed.
   ========================================================= */

(() => {
  "use strict";

  /* =========================================================
     CONFIG
     ========================================================= */

  const CONFIG = {
    API_BASE_URL:
      "https://zylo-backend-ec5c.onrender.com",

    DEFAULT_VIDEO:
      "./backend/uploads/video1.mp4",

    CDN_VIDEO:
      "https://cdn.jsdelivr.net/gh/golammostofa89076-sys/zylo@main/backend/uploads/video1.mp4",

    STORAGE: {
      UPLOADED_VIDEOS: "zylo_uploaded_videos_v4",
      LIKES: "zylo_likes_v4",
      SAVED: "zylo_saved_v4",
      COMMENTS: "zylo_comments_v4",
      FOLLOWS: "zylo_follows_v4"
    },

    VIDEO: {
      SWIPE_THRESHOLD: 55,
      WHEEL_LOCK_MS: 650,
      SETTLE_DELAY_MS: 160,
      PLAY_RETRY_MS: 500,
      AUTO_NEXT_DELAY_MS: 180,
      PRELOAD_AHEAD: 1,
      PRELOAD_BEHIND: 1
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
    try {
      localStorage.setItem(
        key,
        JSON.stringify(value)
      );
    } catch (error) {
      console.warn(
        "ZYLO storage error:",
        error
      );
    }
  }

  function makeId(prefix = "zylo") {
    return (
      prefix +
      "_" +
      Date.now().toString(36) +
      "_" +
      Math.random()
        .toString(36)
        .slice(2, 10)
    );
  }

  function escapeHTML(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function isInteractiveTarget(target) {
    return Boolean(
      target?.closest?.(
        [
          "button",
          "a",
          "input",
          "textarea",
          "select",
          "label",
          ".action-btn",
          ".music-btn",
          ".fullscreen-btn",
          ".profile-action",
          ".create-btn",
          ".search-btn",
          ".comment-panel",
          ".modal",
          ".upload-box",
          ".zylo-comment-panel",
          ".zylo-profile-panel",
          ".zylo-search-overlay"
        ].join(",")
      )
    );
  }


  /* =========================================================
     AUTH BRIDGE
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

      if (window.ZYLOAuth?.currentUser) {
        return window.ZYLOAuth.currentUser;
      }
    } catch (error) {
      console.warn(
        "ZYLO auth read error:",
        error
      );
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
      document.querySelector(
        'script[data-zylo-auth="true"]'
      )
    ) {
      return;
    }

    const script =
      document.createElement("script");

    script.type = "module";
    script.src = "./auth.js";
    script.dataset.zyloAuth = "true";

    script.onload = () => {
      window.dispatchEvent(
        new CustomEvent("zylo:authloaded")
      );
    };

    script.onerror = () => {
      console.warn(
        "ZYLO: auth.js could not be loaded."
      );
    };

    document.head.appendChild(script);
  }


  /* =========================================================
     VIDEO SOURCE HELPERS
     ========================================================= */

  function normalizeVideoSource(source) {
    if (!source) return "";

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
    if (!source) return false;

    const clean =
      String(source).split("?")[0];

    return (
      clean.includes(
        "/backend/uploads/video1.mp4"
      ) ||
      clean.endsWith(
        "backend/uploads/video1.mp4"
      ) ||
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
      const sourceTag =
        $("source", video);

      if (sourceTag) {
        source =
          sourceTag.dataset.src ||
          sourceTag.getAttribute(
            "data-src"
          ) ||
          sourceTag.getAttribute("src") ||
          "";
      }
    }

    if (!source) {
      source = CONFIG.DEFAULT_VIDEO;
    }

    video.dataset.zyloPrimary =
      source;

    return source;
  }

  function getFallbackSource(video) {
    const primary =
      video?.dataset?.zyloPrimary ||
      video?.dataset?.src ||
      video?.getAttribute?.(
        "data-src"
      ) ||
      video?.getAttribute?.("src") ||
      "";

    return isDefaultLocalVideo(primary)
      ? CONFIG.CDN_VIDEO
      : "";
  }


  /* =========================================================
     VIDEO ENGINE
     ========================================================= */

  const VideoEngine = (() => {

    let feed = null;
    let pages = [];

    let activeIndex = -1;

    let initialized = false;

    let scrollTimer = null;
    let autoNextTimer = null;

    let wheelLocked = false;
    let navigationLocked = false;

    let touchStartX = 0;
    let touchStartY = 0;
    let touching = false;

    let observer = null;
    let mutationObserver = null;

    const retryTimers =
      new WeakMap();


    /* ---------------------------------------------------------
       FEED
       --------------------------------------------------------- */

    function getFeed() {
      return document.querySelector(
        ".video-feed"
      );
    }

    function getPages() {
      if (!feed) {
        feed = getFeed();
      }

      if (!feed) {
        return [];
      }

      return Array.from(
        feed.querySelectorAll(
          ".video-page"
        )
      ).filter((page) => {
        if (page.hidden) return false;

        const style =
          window.getComputedStyle(page);

        return style.display !== "none";
      });
    }

    function getVideo(page) {
      return page
        ? page.querySelector("video")
        : null;
    }


    /* ---------------------------------------------------------
       PREPARE VIDEO
       --------------------------------------------------------- */

    function prepareVideo(video) {
      if (!video) return;

      captureVideoSource(video);

      video.muted = true;
      video.defaultMuted = true;
      video.playsInline = true;

      video.setAttribute(
        "muted",
        ""
      );

      video.setAttribute(
        "playsinline",
        ""
      );

      video.setAttribute(
        "webkit-playsinline",
        ""
      );

      video.controls = false;

      if (!video.preload) {
        video.preload = "metadata";
      }

      video.dataset.zyloPrepared =
        "true";
    }


    /* ---------------------------------------------------------
       SOURCE
       --------------------------------------------------------- */

    function ensureSource(
      video,
      preload = "metadata"
    ) {
      if (!video) return false;

      prepareVideo(video);

      const primary =
        captureVideoSource(video);

      if (!primary) {
        return false;
      }

      const wanted =
        normalizeVideoSource(
          primary
        );

      const current =
        video.currentSrc ||
        video.src ||
        "";

      if (
        !current ||
        current === window.location.href ||
        current === "about:blank"
      ) {
        video.src = primary;
        video.preload = preload;

        video.dataset.zyloSourceState =
          "primary";

        return true;
      }

      if (
        normalizeVideoSource(
          current
        ) === wanted
      ) {
        video.preload = preload;
        return true;
      }

      video.preload = preload;

      return true;
    }


    /* ---------------------------------------------------------
       ERROR FALLBACK
       --------------------------------------------------------- */

    function installErrorHandler(
      video
    ) {
      if (!video) return;

      if (
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
          const fallback =
            getFallbackSource(video);

          if (!fallback) {
            return;
          }

          if (
            video.dataset
              .zyloUsingFallback ===
            "true"
          ) {
            return;
          }

          video.dataset
            .zyloUsingFallback =
            "true";

          video.src = fallback;
          video.preload = "auto";

          try {
            video.load();
          } catch {}

          if (
            video.dataset
              .zyloActive ===
            "true"
          ) {
            setTimeout(() => {
              playVideo(video);
            }, 100);
          }
        }
      );
    }


    /* ---------------------------------------------------------
       AUTO NEXT
       --------------------------------------------------------- */

    function installEndedHandler(
      video
    ) {
      if (!video) return;

      if (
        video.dataset
          .zyloEndedHandler ===
        "true"
      ) {
        return;
      }

      video.dataset
        .zyloEndedHandler =
        "true";

      video.addEventListener(
        "ended",
        () => {

          /*
           * Only active video can
           * start auto-next.
           */

          if (
            video.dataset
              .zyloActive !==
            "true"
          ) {
            return;
          }

          if (autoNextTimer) {
            clearTimeout(
              autoNextTimer
            );
          }

          autoNextTimer =
            setTimeout(() => {

              autoNextTimer =
                null;

              pages = getPages();

              const page =
                video.closest(
                  ".video-page"
                );

              const index =
                pages.indexOf(page);

              if (index < 0) {
                return;
              }

              activeIndex = index;

              const nextIndex =
                index + 1;

              if (
                nextIndex >=
                pages.length
              ) {
                console.log(
                  "ZYLO: last video reached"
                );

                return;
              }

              goToPage(
                nextIndex,
                "smooth",
                true
              );

            },
            CONFIG.VIDEO
              .AUTO_NEXT_DELAY_MS);
        }
      );
    }


    /* ---------------------------------------------------------
       REGISTER
       --------------------------------------------------------- */

    function registerVideo(
      video
    ) {
      if (!video) return;

      prepareVideo(video);

      installErrorHandler(
        video
      );

      installEndedHandler(
        video
      );
    }


    /* ---------------------------------------------------------
       PAUSE ALL
       --------------------------------------------------------- */

    function pauseAll(
      except = null
    ) {
      pages.forEach(
        (page) => {
          const video =
            getVideo(page);

          if (
            !video ||
            video === except
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


    /* ---------------------------------------------------------
       PLAY
       --------------------------------------------------------- */

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
      video.defaultMuted = true;
      video.playsInline = true;

      try {

        const promise =
          video.play();

        if (
          promise &&
          typeof promise.then ===
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

        if (
          retryTimers.has(
            video
          )
        ) {
          clearTimeout(
            retryTimers.get(
              video
            )
          );
        }

        const timer =
          setTimeout(() => {

            if (
              video.dataset
                .zyloActive ===
              "true" &&
              video.paused
            ) {
              video
                .play()
                .catch(() => {});
            }

          },
          CONFIG.VIDEO
            .PLAY_RETRY_MS);

        retryTimers.set(
          video,
          timer
        );

        return false;
      }
    }


    /* ---------------------------------------------------------
       SMART PRELOAD
       --------------------------------------------------------- */

    function smartLoad(
      index
    ) {
      if (!pages.length) {
        return;
      }

      pages.forEach(
        (page, i) => {

          const video =
            getVideo(page);

          if (!video) return;

          const distance =
            Math.abs(
              i - index
            );

          if (distance === 0) {

            ensureSource(
              video,
              "auto"
            );

          } else if (
            distance <=
            CONFIG.VIDEO
              .PRELOAD_AHEAD
          ) {

            ensureSource(
              video,
              "metadata"
            );

          } else if (
            distance <=
            CONFIG.VIDEO
              .PRELOAD_BEHIND
          ) {

            video.preload =
              "metadata";

          } else {

            video.preload =
              "none";
          }
        }
      );
    }


    /* ---------------------------------------------------------
       ACTIVATE
       --------------------------------------------------------- */

    async function activate(
      index,
      options = {}
    ) {
      pages = getPages();

      if (!pages.length) {
        activeIndex = -1;
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

      if (!page) return;

      const video =
        getVideo(page);

      activeIndex = index;

      if (autoNextTimer) {
        clearTimeout(
          autoNextTimer
        );

        autoNextTimer =
          null;
      }

      /*
       * Mark active page.
       */

      pages.forEach(
        (item, i) => {

          const active =
            i === index;

          item.classList.toggle(
            "active",
            active
          );

          item.dataset.active =
            active
              ? "true"
              : "false";

          const itemVideo =
            getVideo(item);

          if (itemVideo) {
            itemVideo.dataset
              .zyloActive =
              active
                ? "true"
                : "false";
          }
        }
      );

      /*
       * Pause everything else.
       */

      pauseAll(video);

      /*
       * Load nearby videos.
       */

      smartLoad(index);

      /*
       * Play active video.
       */

      if (video) {
        prepareVideo(video);

        ensureSource(
          video,
          "auto"
        );

        await playVideo(
          video
        );
      }

      updateURL(
        page,
        options.updateHash !==
          false
      );

      dispatchVideoChange(
        page,
        index
      );
    }


    /* ---------------------------------------------------------
       VIDEO CHANGE EVENT
       --------------------------------------------------------- */

    function dispatchVideoChange(
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


    /* ---------------------------------------------------------
       FIND CURRENT PAGE
       --------------------------------------------------------- */

    function findNearestIndex() {
      if (
        !feed ||
        !pages.length
      ) {
        return -1;
      }

      const feedRect =
        feed.getBoundingClientRect();

      const center =
        feedRect.top +
        feedRect.height / 2;

      let best = 0;
      let distance =
        Infinity;

      pages.forEach(
        (page, index) => {

          const rect =
            page.getBoundingClientRect();

          const pageCenter =
            rect.top +
            rect.height / 2;

          const currentDistance =
            Math.abs(
              pageCenter -
              center
            );

          if (
            currentDistance <
            distance
          ) {
            distance =
              currentDistance;

            best = index;
          }
        }
      );

      return best;
    }


    /* ---------------------------------------------------------
       SCROLL TO PAGE
       --------------------------------------------------------- */

    function scrollToPage(
      index,
      behavior = "smooth"
    ) {
      pages = getPages();

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

      if (!page || !feed) {
        return;
      }

      const feedRect =
        feed.getBoundingClientRect();

      const pageRect =
        page.getBoundingClientRect();

      const target =
        feed.scrollTop +
        pageRect.top -
        feedRect.top;

      feed.scrollTo({
        top: Math.max(
          0,
          target
        ),
        behavior
      });

      /*
       * For auto scroll we activate
       * after scroll has settled.
       *
       * This is important.
       */

      if (
        behavior === "auto"
      ) {
        setTimeout(() => {
          activate(
            index,
            {
              updateHash: true
            }
          );
        }, 20);
      }
    }


    /* ---------------------------------------------------------
       GO TO PAGE
       --------------------------------------------------------- */

    function goToPage(
      index,
      behavior = "smooth",
      force = false
    ) {
      pages = getPages();

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

      if (
        navigationLocked &&
        !force
      ) {
        return;
      }

      if (
        index === activeIndex &&
        !force
      ) {
        return;
      }

      navigationLocked = true;

      const nextPage =
        pages[index];

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

        nextVideo.preload =
          "auto";
      }

      /*
       * Scroll first.
       */

      scrollToPage(
        index,
        behavior
      );

      /*
       * Wait for the page to settle,
       * then activate exactly that page.
       */

      setTimeout(
        () => {

          pages = getPages();

          if (
            pages[index]
          ) {

            activate(
              index,
              {
                updateHash:
                  true
              }
            );
          }

          navigationLocked =
            false;

        },
        CONFIG.VIDEO
          .SETTLE_DELAY_MS
      );
    }


    /* ---------------------------------------------------------
       NEXT
       --------------------------------------------------------- */

    function next(
      fromEnded = false
    ) {
      pages = getPages();

      if (!pages.length) {
        return;
      }

      let current =
        activeIndex;

      if (
        current < 0 ||
        current >=
          pages.length
      ) {
        current =
          findNearestIndex();
      }

      if (current < 0) {
        current = 0;
      }

      const nextIndex =
        current + 1;

      if (
        nextIndex >=
        pages.length
      ) {
        if (fromEnded) {
          console.log(
            "ZYLO: no next video"
          );
        }

        return;
      }

      goToPage(
        nextIndex,
        "smooth",
        fromEnded
      );
    }


    /* ---------------------------------------------------------
       PREVIOUS
       --------------------------------------------------------- */

    function previous() {
      pages = getPages();

      if (!pages.length) {
        return;
      }

      let current =
        activeIndex;

      if (
        current < 0 ||
        current >=
          pages.length
      ) {
        current =
          findNearestIndex();
      }

      if (current <= 0) {
        return;
      }

      goToPage(
        current - 1,
        "smooth"
      );
    }


    /* ---------------------------------------------------------
       WHEEL
       --------------------------------------------------------- */

    function handleWheel(
      event
    ) {
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
        Math.abs(delta) < 10
      ) {
        return;
      }

      event.preventDefault();

      if (wheelLocked) {
        return;
      }

      wheelLocked = true;

      if (delta > 0) {
        next();
      } else {
        previous();
      }

      setTimeout(
        () => {
          wheelLocked =
            false;
        },
        CONFIG.VIDEO
          .WHEEL_LOCK_MS
      );
    }


    /* ---------------------------------------------------------
       TOUCH START
       --------------------------------------------------------- */

    function handleTouchStart(
      event
    ) {
      if (
        !event.touches?.length
      ) {
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


    /* ---------------------------------------------------------
       TOUCH END
       --------------------------------------------------------- */

    function handleTouchEnd(
      event
    ) {
      if (!touching) {
        return;
      }

      touching = false;

      if (
        isInteractiveTarget(
          event.target
        )
      ) {
        return;
      }

      if (
        !event.changedTouches
          ?.length
      ) {
        return;
      }

      const touch =
        event.changedTouches[0];

      const deltaX =
        touch.clientX -
        touchStartX;

      const deltaY =
        touch.clientY -
        touchStartY;

      /*
       * Not enough movement.
       */

      if (
        Math.abs(deltaY) <
        CONFIG.VIDEO
          .SWIPE_THRESHOLD
      ) {
        return;
      }

      /*
       * Horizontal gesture.
       */

      if (
        Math.abs(deltaX) >
        Math.abs(deltaY)
      ) {
        return;
      }

      if (wheelLocked) {
        return;
      }

      wheelLocked = true;

      /*
       * Swipe UP = next
       */

      if (deltaY < 0) {
        next();
      }

      /*
       * Swipe DOWN = previous
       */

      else {
        previous();
      }

      setTimeout(
        () => {
          wheelLocked =
            false;
        },
        CONFIG.VIDEO
          .WHEEL_LOCK_MS
      );
    }


    /* ---------------------------------------------------------
       NORMAL SCROLL
       --------------------------------------------------------- */

    function handleScroll() {
      if (!feed) return;

      clearTimeout(
        scrollTimer
      );

      scrollTimer =
        setTimeout(
          () => {

            /*
             * Ignore while our own
             * navigation is settling.
             */

            if (
              navigationLocked
            ) {
              return;
            }

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
                updateHash:
                  true
              }
            );

          },
          CONFIG.VIDEO
            .SETTLE_DELAY_MS
        );
    }


    /* ---------------------------------------------------------
       INTERSECTION OBSERVER
       --------------------------------------------------------- */

    function setupObserver() {
      if (observer) {
        observer.disconnect();
        observer = null;
      }

      if (
        !("IntersectionObserver" in
          window)
      ) {
        return;
      }

      observer =
        new IntersectionObserver(
          (entries) => {

            if (
              navigationLocked
            ) {
              return;
            }

            let best = null;

            entries.forEach(
              (entry) => {

                if (
                  !entry.isIntersecting
                ) {
                  return;
                }

                if (
                  entry.intersectionRatio <
                  0.70
                ) {
                  return;
                }

                if (
                  !best ||
                  entry.intersectionRatio >
                    best.intersectionRatio
                ) {
                  best = entry;
                }
              }
            );

            if (!best) {
              return;
            }

            const page =
              best.target;

            const index =
              pages.indexOf(page);

            if (
              index >= 0 &&
              index !==
                activeIndex
            ) {

              activate(
                index,
                {
                  updateHash:
                    true
                }
              );
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

      pages.forEach(
        (page) => {
          observer.observe(
            page
          );
        }
      );
    }


    /* ---------------------------------------------------------
       REFRESH
       --------------------------------------------------------- */

    function refresh() {
      feed = getFeed();

      if (!feed) {
        pages = [];
        activeIndex = -1;
        return;
      }

      pages = getPages();

      pages.forEach(
        (page) => {
          registerVideo(
            getVideo(page)
          );
        }
      );

      setupObserver();

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


    /* ---------------------------------------------------------
       INIT
       --------------------------------------------------------- */

    function init() {

      feed = getFeed();

      if (!feed) {
        console.warn(
          "ZYLO: .video-feed not found."
        );
        return;
      }

      refresh();

      if (initialized) {
        return;
      }

      initialized = true;

      /*
       * Wheel
       */

      feed.addEventListener(
        "wheel",
        handleWheel,
        {
          passive: false
        }
      );

      /*
       * Touch
       */

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

      /*
       * Scroll
       */

      feed.addEventListener(
        "scroll",
        handleScroll,
        {
          passive: true
        }
      );

      /*
       * Dynamic video detection
       */

      mutationObserver =
        new MutationObserver(
          () => {
            refresh();
          }
        );

      mutationObserver.observe(
        feed,
        {
          childList: true,
          subtree: true
        }
      );

      /*
       * Initial video
       */

      setTimeout(
        () => {

          pages = getPages();

          if (!pages.length) {
            return;
          }

          const index =
            findNearestIndex();

          if (index >= 0) {

            activate(
              index,
              {
                updateHash:
                  false
              }
            );
          }

        },
        250
      );

      console.log(
        "ZYLO Video Engine initialized successfully"
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
      Array.from(
        document.querySelectorAll(
          ".video-page"
        )
      ).find(
        (item) =>
          item.dataset.videoId ===
          id
      );

    if (!page) {
      return;
    }

    const pages =
      VideoEngine.getPages();

    const index =
      pages.indexOf(page);

    if (index >= 0) {
      setTimeout(
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
    const value =
      getStorage(
        CONFIG.STORAGE.LIKES,
        []
      );

    return Array.isArray(value)
      ? value
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

        if (!button) {
          return;
        }

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

        if (!button) {
          return;
        }

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
      typeof value ===
        "object" &&
      !Array.isArray(value)
      ? value
      : {};
  }


  function setComments(
    value
  ) {
    setStorage(
      CONFIG.STORAGE.COMMENTS,
      value
    );
  }


  function closeCommentPanel() {
    $$(".zylo-comment-panel,.comment-panel")
      .forEach(
        (panel) => {

          if (
            panel.dataset
              .zyloGenerated ===
            "true"
          ) {
            panel.remove();
          } else {
            panel.classList.remove(
              "open",
              "active"
            );
          }
        }
      );
  }


  function openComments(
    button
  ) {
    const id =
      getVideoIdFromButton(
        button
      );

    if (!id) return;

    closeCommentPanel();

    const all =
      getComments();

    const comments =
      Array.isArray(all[id])
        ? all[id]
        : [];

    const panel =
      document.createElement(
        "div"
      );

    panel.className =
      "zylo-comment-panel";

    panel.dataset
      .zyloGenerated =
      "true";

    panel.innerHTML = `
      <div class="zylo-comment-inner">

        <div class="zylo-comment-header">
          <strong>Comments</strong>
          <button
            type="button"
            data-zylo-comment-close
            aria-label="Close"
          >×</button>
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

        const comments =
          getComments();

        if (
          !Array.isArray(
            comments[id]
          )
        ) {
          comments[id] = [];
        }

        comments[id].push({
          id: makeId(
            "comment"
          ),
          uid: getUserUID(),
          username:
            getUsername(),
          text,
          createdAt:
            Date.now()
        });

        setComments(
          comments
        );

        input.value = "";

        openComments(
          button
        );
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

        openComments(
          button
        );
      }
    );
  }


  /* =========================================================
     SHARE
     ========================================================= */

  async function shareVideo(
    button
  ) {
    const page =
      button.closest(
        ".video-page"
      );

    if (!page) return;

    const id =
      page.dataset.videoId ||
      "";

    const url =
      `${window.location.origin}${window.location.pathname}#video-${encodeURIComponent(
        id
      )}`;

    try {

      if (
        navigator.share
      ) {

        await navigator.share({
          title: "ZYLO",
          text:
            "Watch this video on ZYLO",
          url
        });

      } else if (
        navigator.clipboard
      ) {

        await navigator.clipboard.writeText(
          url
        );

        button.classList.add(
          "active"
        );

        setTimeout(
          () => {
            button.classList.remove(
              "active"
            );
          },
          1200
        );
      }

    } catch {}
  }


  function setupShareButtons() {
    document.addEventListener(
      "click",
      (event) => {

        const button =
          event.target.closest(
            ".share-btn"
          );

        if (!button) return;

        event.preventDefault();
        event.stopPropagation();

        shareVideo(
          button
        );
      }
    );
  }


  /* =========================================================
     MUSIC
     ========================================================= */

  function setupMusicButtons() {
    document.addEventListener(
      "click",
      (event) => {

        const button =
          event.target.closest(
            ".music-btn"
          );

        if (!button) return;

        event.preventDefault();
        event.stopPropagation();

        const page =
          button.closest(
            ".video-page"
          );

        const video =
          $("video", page);

        if (!video) return;

        if (
          video.paused
        ) {

          video.muted = true;

          VideoEngine.playVideo(
            video
          );

        } else {

          video.pause();
        }

        button.classList.toggle(
          "active",
          !video.paused
        );
      }
    );
  }


  /* =========================================================
     FULLSCREEN
     ========================================================= */

  function setupFullscreenButtons() {
    document.addEventListener(
      "click",
      async (event) => {

        const button =
          event.target.closest(
            ".fullscreen-btn"
          );

        if (!button) return;

        event.preventDefault();
        event.stopPropagation();

        const page =
          button.closest(
            ".video-page"
          );

        const video =
          $("video", page);

        if (!video) return;

        try {

          if (
            document.fullscreenElement
          ) {

            await document.exitFullscreen();

          } else if (
            video.requestFullscreen
          ) {

            await video.requestFullscreen();

          } else if (
            video.webkitEnterFullscreen
          ) {

            video.webkitEnterFullscreen();
          }

        } catch {}
      }
    );
  }


  /* =========================================================
     DOUBLE TAP LIKE
     ========================================================= */

  function setupDoubleTapLike() {
    let lastTap = 0;
    let lastPage = null;

    document.addEventListener(
      "click",
      (event) => {

        if (
          isInteractiveTarget(
            event.target
          )
        ) {
          return;
        }

        const page =
          event.target.closest(
            ".video-page"
          );

        if (!page) return;

        const now =
          Date.now();

        if (
          page === lastPage &&
          now - lastTap <
            320
        ) {

          const button =
            $(".like-btn", page);

          if (button) {
            button.click();
          }
        }

        lastTap = now;
        lastPage = page;
      }
    );
  }


  /* =========================================================
     CREATOR
     ========================================================= */

  function getCreatorData(
    page
  ) {
    return {
      uid:
        page?.dataset
          ?.creatorUid ||
        page?.dataset
          ?.ownerUid ||
        page?.dataset?.uid ||
        "creator",

      username:
        page?.dataset
          ?.creatorUsername ||
        page?.dataset
          ?.username ||
        "zylo_creator"
    };
  }


  function showCreatorProfile(
    page
  ) {
    const creator =
      getCreatorData(page);

    let panel =
      document.getElementById(
        "zyloCreatorProfile"
      );

    if (!panel) {

      panel =
        document.createElement(
          "div"
        );

      panel.id =
        "zyloCreatorProfile";

      panel.className =
        "zylo-profile-panel";

      panel.innerHTML = `
        <div class="zylo-profile-inner">

          <button
            type="button"
            class="zylo-profile-close"
            aria-label="Close"
          >×</button>

          <div class="zylo-profile-avatar">
            Z
          </div>

          <h2 class="zylo-profile-name"></h2>

          <p class="zylo-profile-handle"></p>

          <button
            type="button"
            class="zylo-profile-follow"
          >
            Follow
          </button>

          <div class="zylo-profile-videos">
            <h3>Videos</h3>
            <div class="zylo-profile-video-list"></div>
          </div>

        </div>
      `;

      document.body.appendChild(
        panel
      );

      $(
        ".zylo-profile-close",
        panel
      )?.addEventListener(
        "click",
        () => panel.remove()
      );

      $(
        ".zylo-profile-follow",
        panel
      )?.addEventListener(
        "click",
        () => {

          const follows =
            getStorage(
              CONFIG.STORAGE.FOLLOWS,
              []
            );

          const uid =
            panel.dataset
              .creatorUid;

          const index =
            follows.indexOf(uid);

          if (index >= 0) {

            follows.splice(
              index,
              1
            );

          } else {

            follows.push(uid);
          }

          setStorage(
            CONFIG.STORAGE.FOLLOWS,
            follows
          );

          updateFollowButton(
            panel,
            uid
          );

          /*
           * IMPORTANT:
           * Following/unfollowing does NOT
           * remove video pages.
           */
          VideoEngine.refresh();
        }
      );
    }

    panel.dataset
      .creatorUid =
      creator.uid;

    panel.dataset
      .creatorUsername =
      creator.username;

    $(
      ".zylo-profile-name",
      panel
    ).textContent =
      creator.username;

    $(
      ".zylo-profile-handle",
      panel
    ).textContent =
      `@${creator.username}`;

    updateFollowButton(
      panel,
      creator.uid
    );

    const list =
      $(
        ".zylo-profile-video-list",
        panel
      );

    list.innerHTML = "";

    /*
     * Creator videos remain in the feed.
     */

    const creatorPages =
      VideoEngine
        .getPages()
        .filter(
          (item) => {

            const data =
              getCreatorData(
                item
              );

            return (
              data.uid ===
              creator.uid
            );
          }
        );

    creatorPages.forEach(
      (item) => {

        const thumb =
          document.createElement(
            "div"
          );

        thumb.className =
          "zylo-profile-video-item";

        thumb.textContent =
          item.dataset.title ||
          item.dataset.videoId ||
          "Video";

        thumb.addEventListener(
          "click",
          () => {

            const index =
              VideoEngine
                .getPages()
                .indexOf(
                  item
                );

            if (index >= 0) {

              panel.remove();

              VideoEngine.scrollToPage(
                index,
                "smooth"
              );
            }
          }
        );

        list.appendChild(
          thumb
        );
      }
    );

    panel.classList.add(
      "open",
      "active"
    );
  }


  function updateFollowButton(
    panel,
    uid
  ) {
    const button =
      $(
        ".zylo-profile-follow",
        panel
      );

    if (!button) return;

    const follows =
      getStorage(
        CONFIG.STORAGE.FOLLOWS,
        []
      );

    button.textContent =
      follows.includes(uid)
        ? "Following"
        : "Follow";
  }


  function setupCreatorProfileButtons() {
    document.addEventListener(
      "click",
      (event) => {

        const button =
          event.target.closest(
            ".profile-action"
          );

        if (!button) return;

        event.preventDefault();
        event.stopPropagation();

        const page =
          button.closest(
            ".video-page"
          );

        if (page) {
          showCreatorProfile(
            page
          );
        }
      }
    );
  }


  /* =========================================================
     NAVIGATION
     ========================================================= */

  function setupNavigation() {

    document.addEventListener(
      "click",
      (event) => {

        const nav =
          event.target.closest(
            ".nav-item"
          );

        if (!nav) return;

        const type =
          nav.dataset.nav;

        if (
          type === "home"
        ) {

          event.preventDefault();

          VideoEngine.refresh();

          VideoEngine.scrollToPage(
            0,
            "smooth"
          );

          return;
        }

        if (
          type === "profile"
        ) {

          window.dispatchEvent(
            new CustomEvent(
              "zylo:openprofile"
            )
          );
        }
      }
    );


    /*
     * Top feed tabs
     *
     * IMPORTANT:
     * We do NOT hide videos anymore.
     * This prevents videos from disappearing.
     */

    document.addEventListener(
      "click",
      (event) => {

        const tab =
          event.target.closest(
            "[data-feed-tab]"
          );

        if (!tab) return;

        const type =
          tab.dataset.feedTab;

        if (
          type === "for-you"
        ) {
          showAllVideos();
        }

        if (
          type === "following"
        ) {
          showFollowingVideos();
        }
      }
    );
  }


  function showAllVideos() {
    $$(".video-page").forEach(
      (page) => {
        page.hidden = false;
        page.style.display = "";
      }
    );

    VideoEngine.refresh();

    setTimeout(
      () => {
        VideoEngine.scrollToPage(
          0,
          "auto"
        );
      },
      50
    );
  }


  /*
   * Following feed:
   *
   * We keep pages in DOM.
   * We don't permanently delete videos.
   */

  function showFollowingVideos() {

    const follows =
      getStorage(
        CONFIG.STORAGE.FOLLOWS,
        []
      );

    const allPages =
      $$(".video-page");

    /*
     * If user follows nobody,
     * keep the normal feed visible.
     * This avoids an empty/broken screen.
     */

    if (!follows.length) {

      allPages.forEach(
        (page) => {
          page.hidden = false;
          page.style.display = "";
        }
      );

    } else {

      allPages.forEach(
        (page) => {

          const creator =
            getCreatorData(
              page
            );

          const isFollowing =
            follows.includes(
              creator.uid
            );

          page.hidden =
            !isFollowing;

          page.style.display =
            isFollowing
              ? ""
              : "none";
        }
      );
    }

    VideoEngine.refresh();

    setTimeout(
      () => {

        const pages =
          VideoEngine.getPages();

        if (pages.length) {
          VideoEngine.scrollToPage(
            0,
            "auto"
          );
        }

      },
      80
    );
  }


  /* =========================================================
     SEARCH
     ========================================================= */

  function createSearchOverlay() {

    let overlay =
      document.getElementById(
        "zyloSearchOverlay"
      );

    if (overlay) {
      return overlay;
    }

    overlay =
      document.createElement(
        "div"
      );

    overlay.id =
      "zyloSearchOverlay";

    overlay.className =
      "zylo-search-overlay";

    overlay.innerHTML = `
      <div class="zylo-search-inner">

        <button
          type="button"
          class="zylo-search-close"
        >×</button>

        <input
          class="zylo-search-input"
          type="search"
          placeholder="Search videos or creators..."
          autocomplete="off"
        />

        <div class="zylo-search-results"></div>

      </div>
    `;

    document.body.appendChild(
      overlay
    );

    $(
      ".zylo-search-close",
      overlay
    )?.addEventListener(
      "click",
      () => overlay.remove()
    );

    const input =
      $(
        ".zylo-search-input",
        overlay
      );

    input.addEventListener(
      "input",
      () => {
        performSearch(
          input.value,
          overlay
        );
      }
    );

    return overlay;
  }


  function performSearch(
    query,
    overlay
  ) {
    const term =
      String(query || "")
        .trim()
        .toLowerCase();

    const results =
      $(
        ".zylo-search-results",
        overlay
      );

    if (!term) {
      results.innerHTML = "";
      return;
    }

    const pages =
      VideoEngine
        .getPages()
        .filter(
          (page) => {

            const creator =
              getCreatorData(
                page
              );

            const text = [
              page.dataset.videoId,
              page.dataset.title,
              page.dataset.description,
              creator.username
            ]
              .filter(Boolean)
              .join(" ")
              .toLowerCase();

            return text.includes(
              term
            );
          }
        );

    results.innerHTML = "";

    pages.forEach(
      (page) => {

        const item =
          document.createElement(
            "button"
          );

        item.type =
          "button";

        item.className =
          "zylo-search-result";

        item.textContent =
          page.dataset.title ||
          page.dataset.videoId ||
          getCreatorData(
            page
          ).username;

        item.addEventListener(
          "click",
          () => {

            const index =
              VideoEngine
                .getPages()
                .indexOf(
                  page
                );

            if (index >= 0) {

              overlay.remove();

              /*
               * Make sure video is
               * visible again.
               */

              page.hidden = false;
              page.style.display =
                "";

              VideoEngine.refresh();

              VideoEngine.scrollToPage(
                index,
                "smooth"
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


  function setupSearch() {
    document.addEventListener(
      "click",
      (event) => {

        const button =
          event.target.closest(
            ".search-btn"
          );

        if (!button) return;

        event.preventDefault();
        event.stopPropagation();

        const overlay =
          createSearchOverlay();

        overlay.classList.add(
          "open",
          "active"
        );

        setTimeout(
          () => {
            $(
              ".zylo-search-input",
              overlay
            )?.focus();
          },
          50
        );
      }
    );
  }


  /* =========================================================
     UPLOAD
     ========================================================= */

  function getUploadBox() {
    return (
      document.getElementById(
        "uploadBox"
      ) ||
      $(".upload-box")
    );
  }


  function openUploadBox() {
    const box =
      getUploadBox();

    if (!box) {
      console.warn(
        "ZYLO: upload box not found."
      );
      return;
    }

    box.hidden = false;
    box.style.display =
      "flex";

    box.classList.add(
      "open",
      "active"
    );
  }


  function closeUploadBox() {
    const box =
      getUploadBox();

    if (!box) return;

    box.classList.remove(
      "open",
      "active"
    );

    box.hidden = true;
    box.style.display =
      "none";
  }


  function setupUploadCloseButtons() {
    document.addEventListener(
      "click",
      (event) => {

        const close =
          event.target.closest(
            [
              "#closeUpload",
              ".close-upload",
              ".upload-close",
              "[data-close-upload]"
            ].join(",")
          );

        if (!close) return;

        event.preventDefault();

        closeUploadBox();
      }
    );
  }


  function setupCreateButton() {
    document.addEventListener(
      "click",
      (event) => {

        const button =
          event.target.closest(
            "#createBtn,.create-btn"
          );

        if (!button) return;

        event.preventDefault();
        event.stopPropagation();

        openUploadBox();
      }
    );
  }


  /*
   * Create uploaded page.
   *
   * IMPORTANT:
   * We keep the video page structure simple
   * so existing CSS/UI remains untouched.
   */

  function createUploadedPage(
    data
  ) {
    const feed =
      getFeedElement();

    if (!feed) {
      return null;
    }

    const page =
      document.createElement(
        "section"
      );

    page.className =
      "video-page";

    page.dataset.videoId =
      data.id;

    page.dataset.creatorUid =
      data.uid ||
      getUserUID();

    page.dataset.creatorUsername =
      data.username ||
      getUsername();

    page.dataset.title =
      data.name ||
      "ZYLO Video";

    page.dataset.uploaded =
      "true";

    const video =
      document.createElement(
        "video"
      );

    video.src =
      data.url;

    video.muted =
      true;

    video.defaultMuted =
      true;

    video.playsInline =
      true;

    video.setAttribute(
      "muted",
      ""
    );

    video.setAttribute(
      "playsinline",
      ""
    );

    video.setAttribute(
      "webkit-playsinline",
      ""
    );

    video.preload =
      "metadata";

    page.appendChild(
      video
    );

    feed.appendChild(
      page
    );

    return page;
  }


  function getFeedElement() {
    return document.querySelector(
      ".video-feed"
    );
  }


  /* ---------------------------------------------------------
     UPLOAD VIDEO
     --------------------------------------------------------- */

  async function uploadVideo(
    file
  ) {
    if (!file) return;

    if (
      !file.type.startsWith(
        "video/"
      )
    ) {

      alert(
        "Please select a video file."
      );

      return;
    }

    const MAX_SIZE =
      200 *
      1024 *
      1024;

    if (
      file.size >
      MAX_SIZE
    ) {

      alert(
        "Video size must be 200 MB or less."
      );

      return;
    }

    const uid =
      getUserUID();

    const username =
      getUsername();

    const formData =
      new FormData();

    formData.append(
      "video",
      file
    );

    formData.append(
      "uid",
      uid
    );

    formData.append(
      "username",
      username
    );

    let serverURL =
      "";

    try {

      const response =
        await fetch(
          CONFIG.API_BASE_URL +
            "/api/upload",
          {
            method: "POST",
            body: formData
          }
        );

      if (!response.ok) {
        throw new Error(
          "Upload failed: " +
            response.status
        );
      }

      const result =
        await response.json();

      serverURL =
        result?.url ||
        result?.videoUrl ||
        result?.fileUrl ||
        "";

      if (
        serverURL &&
        !serverURL.startsWith(
          "http"
        )
      ) {
        serverURL =
          CONFIG.API_BASE_URL +
          serverURL;
      }

      if (!serverURL) {
        throw new Error(
          "Server did not return video URL."
        );
      }

    } catch (error) {

      console.error(
        "ZYLO upload failed:",
        error
      );

      alert(
        "Video upload failed. Please try again."
      );

      return;
    }


    /*
     * Server URL is used as the
     * permanent playable URL.
     */

    const videoData = {
      id: makeId(
        "video"
      ),

      uid,

      username,

      name:
        file.name,

      url:
        serverURL,

      serverURL,

      createdAt:
        Date.now(),

      size:
        file.size,

      type:
        file.type
    };


    const uploads =
      getStorage(
        CONFIG.STORAGE
          .UPLOADED_VIDEOS,
        []
      );

    uploads.unshift(
      videoData
    );

    setStorage(
      CONFIG.STORAGE
        .UPLOADED_VIDEOS,
      uploads
    );


    const page =
      createUploadedPage(
        videoData
      );


    VideoEngine.refresh();


    if (page) {

      const currentPages =
        VideoEngine.getPages();

      const index =
        currentPages.indexOf(
          page
        );

      if (index >= 0) {

        VideoEngine.scrollToPage(
          index,
          "smooth"
        );
      }
    }


    closeUploadBox();


    window.dispatchEvent(
      new CustomEvent(
        "zylo:uploaded",
        {
          detail:
            videoData
        }
      )
    );

    console.log(
      "ZYLO: video uploaded successfully",
      videoData
    );
  }


  /* ---------------------------------------------------------
     RESTORE UPLOADED VIDEOS
     --------------------------------------------------------- */

  function restoreUploadedVideos() {

    const uploads =
      getStorage(
        CONFIG.STORAGE
          .UPLOADED_VIDEOS,
        []
      );

    if (
      !Array.isArray(
        uploads
      ) ||
      !uploads.length
    ) {
      return;
    }

    const feed =
      getFeedElement();

    if (!feed) {
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


    /*
     * Oldest first when restoring,
     * so original feed order remains.
     */

    uploads
      .slice()
      .reverse()
      .forEach(
        (data) => {

          if (
            !data?.id ||
            existingIds.has(
              data.id
            )
          ) {
            return;
          }

          const url =
            data.serverURL ||
            data.url;

          /*
           * Blob URLs cannot survive
           * a page reload.
           */

          if (
            !url ||
            String(url).startsWith(
              "blob:"
            )
          ) {
            return;
          }

          createUploadedPage({
            ...data,
            url
          });
        }
      );

    VideoEngine.refresh();
  }


  function setupUploadInput() {
    document.addEventListener(
      "change",
      (event) => {

        const input =
          event.target.closest(
            "#videoInput"
          );

        if (!input) return;

        const file =
          input.files?.[0];

        if (!file) return;

        uploadVideo(
          file
        );

        input.value =
          "";
      }
    );
  }


  /* =========================================================
     VIDEO CLICK
     ========================================================= */

  function setupVideoClick() {

    document.addEventListener(
      "click",
      (event) => {

        if (
          isInteractiveTarget(
            event.target
          )
        ) {
          return;
        }

        const video =
          event.target.closest(
            "video"
          );

        if (!video) return;

        if (
          video.paused
        ) {

          video.muted =
            true;

          VideoEngine.playVideo(
            video
          );

        } else {

          video.pause();
        }
      }
    );
  }


  /* =========================================================
     VISIBILITY
     ========================================================= */

  function setupVisibilityHandling() {

    document.addEventListener(
      "visibilitychange",
      () => {

        const pages =
          VideoEngine.getPages();

        if (
          document.hidden
        ) {

          pages.forEach(
            (page) => {

              const video =
                $("video", page);

              if (video) {
                try {
                  video.pause();
                } catch {}
              }
            }
          );

          return;
        }


        const index =
          VideoEngine.getActiveIndex();

        if (index >= 0) {

          VideoEngine.activate(
            index,
            {
              updateHash:
                false
            }
          );
        }
      }
    );
  }


  /* =========================================================
     KEYBOARD
     ========================================================= */

  function setupKeyboardNavigation() {

    document.addEventListener(
      "keydown",
      (event) => {

        if (
          isInteractiveTarget(
            event.target
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

          VideoEngine.next();
        }


        if (
          event.key ===
            "ArrowUp" ||
          event.key ===
            "PageUp"
        ) {

          event.preventDefault();

          VideoEngine.previous();
        }


        if (
          event.key ===
          "Escape"
        ) {

          closeCommentPanel();

          const search =
            document.getElementById(
              "zyloSearchOverlay"
            );

          if (search) {
            search.remove();
          }

          const profile =
            document.getElementById(
              "zyloCreatorProfile"
            );

          if (profile) {
            profile.remove();
          }

          closeUploadBox();
        }
      }
    );
  }


  /* =========================================================
     INITIALIZATION
     ========================================================= */

  function initializeZYLO() {

    /*
     * Auth
     */

    loadAuthJS();


    /*
     * Restore uploaded videos
     */

    restoreUploadedVideos();


    /*
     * Video Engine
     */

    VideoEngine.init();


    /*
     * Actions
     */

    setupLikeButtons();

    setupSaveButtons();

    setupCommentButtons();

    setupShareButtons();

    setupMusicButtons();

    setupFullscreenButtons();

    setupDoubleTapLike();

    setupCreatorProfileButtons();


    /*
     * Navigation
     */

    setupNavigation();

    setupSearch();


    /*
     * Upload
     */

    setupCreateButton();

    setupUploadCloseButtons();

    setupUploadInput();


    /*
     * Video click
     */

    setupVideoClick();


    /*
     * Visibility
     */

    setupVisibilityHandling();


    /*
     * Keyboard
     */

    setupKeyboardNavigation();


    /*
     * Hash
     */

    openHashVideo();

    window.addEventListener(
      "hashchange",
      openHashVideo
    );


    /*
     * Resize
     */

    window.addEventListener(
      "resize",
      () => {
        VideoEngine.refresh();
      }
    );


    /*
     * Auth loaded
     */

    window.addEventListener(
      "zylo:authloaded",
      () => {
        VideoEngine.refresh();
      }
    );


    /*
     * New uploaded video
     */

    window.addEventListener(
      "zylo:uploaded",
      () => {
        VideoEngine.refresh();
      }
    );


    console.log(
      "ZYLO frontend initialized successfully"
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

  window.ZYLO = {

    VideoEngine,

    openUploadBox,

    closeUploadBox,

    uploadVideo,

    getCurrentUser,

    getUserUID,

    getUsername
  };

})();
