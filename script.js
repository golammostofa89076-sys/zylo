/* =========================================================
   ZYLO - COMPLETE script.js
   Video Feed + One Swipe + Snap + Auto Play + Auto Next
   Upload + Like + Save + Comment + Share
   Music + Fullscreen + Creator Profile
   Search + Navigation + Auth Bridge

   IMPORTANT:
   Existing HTML / CSS / SVG UI is NOT redesigned.
   ========================================================= */

(() => {
  "use strict";

  /* =========================================================
     CONFIG
     ========================================================= */

  const CONFIG = {
    API_BASE_URL: "https://zylo-backend-ec5c.onrender.com",

    DEFAULT_VIDEO: "./backend/uploads/video1.mp4",

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
      SETTLE_DELAY_MS: 120,
      AUTO_NEXT_DELAY_MS: 180,
      PLAY_RETRY_MS: 500,
      PRELOAD_AHEAD: 1,
      PRELOAD_BEHIND: 1
    }
  };


  /* =========================================================
     DOM HELPERS
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


  /* =========================================================
     STORAGE
     ========================================================= */

  function getStorage(key, fallback) {
    try {
      const value = localStorage.getItem(key);

      if (!value) {
        return fallback;
      }

      return JSON.parse(value);
    } catch {
      return fallback;
    }
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


  /* =========================================================
     INTERACTIVE TARGET
     ========================================================= */

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
          ".bottom-nav",
          ".top-bar"
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

      if (
        window.ZYLOAuth &&
        window.ZYLOAuth.currentUser
      ) {
        return window.ZYLOAuth.currentUser;
      }
    } catch (error) {
      console.warn(
        "ZYLO auth error:",
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
        new CustomEvent(
          "zylo:authloaded"
        )
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
    if (!video) {
      return "";
    }

    if (
      video.dataset.zyloPrimary
    ) {
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
      video?.getAttribute?.(
        "data-src"
      ) ||
      video?.getAttribute?.(
        "src"
      ) ||
      "";

    if (
      isDefaultLocalVideo(primary)
    ) {
      return CONFIG.CDN_VIDEO;
    }

    return "";
  }


  /* =========================================================
     VIDEO ENGINE
     ========================================================= */

  const VideoEngine = (() => {
    let feed = null;
    let pages = [];
    let activeIndex = -1;

    let scrollTimer = null;
    let navigationLock = false;
    let autoNextLock = false;

    let touchStartX = 0;
    let touchStartY = 0;
    let touching = false;

    let observer = null;
    let mutationObserver = null;

    let initialized = false;


    /* -------------------------------------------------------
       FEED
       ------------------------------------------------------- */

    function getFeed() {
      return $(".video-feed");
    }


    function getPages() {
      if (!feed) {
        feed = getFeed();
      }

      if (!feed) {
        return [];
      }

      /*
       * IMPORTANT:
       * Never filter pages using hidden/display:none.
       * This prevents videos disappearing after Follow/Profile.
       */
      return $$(".video-page", feed);
    }


    function getVideo(page) {
      if (!page) {
        return null;
      }

      return $("video", page);
    }


    /* -------------------------------------------------------
       FORCE SCROLL SYSTEM
       ------------------------------------------------------- */

    function forceFeedScrolling() {
      if (!feed) {
        return;
      }

      /*
       * This is a safety layer in case old CSS is cached.
       */
      feed.style.overflowY = "auto";
      feed.style.overflowX = "hidden";

      feed.style.scrollSnapType =
        "y mandatory";

      feed.style.webkitOverflowScrolling =
        "touch";

      feed.style.touchAction =
        "pan-y";

      feed.style.scrollBehavior =
        "smooth";

      feed.style.overscrollBehaviorY =
        "contain";

      pages.forEach((page) => {
        page.style.scrollSnapAlign =
          "start";

        page.style.scrollSnapStop =
          "always";

        page.style.flex =
          "0 0 100dvh";

        page.style.height =
          "100dvh";

        page.style.minHeight =
          "100dvh";

        page.style.overflow =
          "hidden";
      });
    }


    /* -------------------------------------------------------
       PREPARE VIDEO
       ------------------------------------------------------- */

    function prepareVideo(video) {
      if (!video) {
        return;
      }

      captureVideoSource(video);

      video.muted = true;
      video.defaultMuted = true;
      video.playsInline = true;
      video.controls = false;

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

      /*
       * VERY IMPORTANT:
       * loop must be false so ended event works.
       */
      video.loop = false;
      video.removeAttribute(
        "loop"
      );

      if (
        !video.dataset.zyloPrepared
      ) {
        video.dataset.zyloPrepared =
          "true";

        video.dataset.zyloActive =
          "false";

        video.dataset.zyloPlaying =
          "false";
      }
    }


    /* -------------------------------------------------------
       SOURCE
       ------------------------------------------------------- */

    function ensureSource(
      video,
      preload = "metadata"
    ) {
      if (!video) {
        return false;
      }

      prepareVideo(video);

      const primary =
        captureVideoSource(video);

      if (!primary) {
        return false;
      }

      const current =
        video.currentSrc ||
        video.getAttribute("src") ||
        video.src ||
        "";

      const wanted =
        normalizeVideoSource(
          primary
        );

      if (!current) {
        video.src = primary;
        video.preload = preload;

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

      if (
        video.dataset
          .zyloUsingFallback !==
        "true"
      ) {
        video.src = primary;
        video.preload = preload;
      }

      return true;
    }


    /* -------------------------------------------------------
       ERROR FALLBACK
       ------------------------------------------------------- */

    function installErrorHandler(video) {
      if (!video) {
        return;
      }

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
            }, 200);
          }
        }
      );
    }


    /* -------------------------------------------------------
       AUTO NEXT
       ------------------------------------------------------- */

    function installEndedHandler(video) {
      if (!video) {
        return;
      }

      if (
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

          const page =
            video.closest(
              ".video-page"
            );

          if (page) {
            const index =
              pages.indexOf(page);

            if (index >= 0) {
              activeIndex =
                index;
            }
          }

          setTimeout(() => {
            next(true);

            setTimeout(() => {
              autoNextLock =
                false;
            }, 700);
          }, CONFIG.VIDEO.AUTO_NEXT_DELAY_MS);
        }
      );
    }


    /* -------------------------------------------------------
       REGISTER
       ------------------------------------------------------- */

    function registerVideo(video) {
      if (!video) {
        return;
      }

      prepareVideo(video);
      installErrorHandler(video);
      installEndedHandler(video);
    }


    /* -------------------------------------------------------
       PRELOAD
       ------------------------------------------------------- */

    function smartLoad(index) {
      pages.forEach(
        (page, i) => {
          const video =
            getVideo(page);

          if (!video) {
            return;
          }

          const distance =
            Math.abs(i - index);

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


    /* -------------------------------------------------------
       PAUSE ALL
       ------------------------------------------------------- */

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


    /* -------------------------------------------------------
       PLAY
       ------------------------------------------------------- */

    async function playVideo(video) {
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
      video.loop = false;

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
      } catch {
        video.dataset
          .zyloPlaying =
          "false";

        setTimeout(() => {
          if (
            video.dataset
              .zyloActive ===
            "true"
          ) {
            video.muted = true;

            video.play().catch(
              () => {}
            );
          }
        }, CONFIG.VIDEO.PLAY_RETRY_MS);

        return false;
      }
    }


    /* -------------------------------------------------------
       ACTIVE VIDEO
       ------------------------------------------------------- */

    async function activate(
      index,
      options = {}
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

      const video =
        getVideo(page);

      activeIndex = index;

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

            itemVideo.loop =
              false;
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

      try {
        window.dispatchEvent(
          new CustomEvent(
            "zylo:videochange",
            {
              detail: {
                index,
                page,
                video
              }
            }
          )
        );
      } catch {}
    }


    /* -------------------------------------------------------
       FIND NEAREST
       ------------------------------------------------------- */

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

      let bestIndex = 0;
      let bestDistance =
        Infinity;

      pages.forEach(
        (page, index) => {
          const rect =
            page.getBoundingClientRect();

          const pageCenter =
            rect.top +
            rect.height / 2;

          const distance =
            Math.abs(
              pageCenter - center
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


    /* -------------------------------------------------------
       SCROLL TO PAGE
       ------------------------------------------------------- */

    function scrollToPage(
      index,
      behavior = "smooth"
    ) {
      refresh();

      if (
        !feed ||
        !pages.length
      ) {
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

      activeIndex = index;

      /*
       * Native browser scroll.
       * CSS scroll-snap completes the snap.
       */
      page.scrollIntoView({
        behavior,
        block: "start",
        inline: "nearest"
      });

      clearTimeout(
        scrollTimer
      );

      scrollTimer =
        setTimeout(
          () => {
            activate(
              index,
              {
                updateHash: true
              }
            );
          },
          behavior === "smooth"
            ? 400
            : 50
        );
    }


    /* -------------------------------------------------------
       NEXT
       ------------------------------------------------------- */

    function next(
      fromEnded = false
    ) {
      refresh();

      if (!pages.length) {
        return;
      }

      let current =
        activeIndex >= 0
          ? activeIndex
          : findNearestIndex();

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
            "ZYLO: last video reached"
          );
        }

        return;
      }

      const nextVideo =
        getVideo(
          pages[nextIndex]
        );

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

        nextVideo.loop =
          false;

        nextVideo.preload =
          "auto";
      }

      scrollToPage(
        nextIndex,
        "smooth"
      );
    }


    /* -------------------------------------------------------
       PREVIOUS
       ------------------------------------------------------- */

    function previous() {
      refresh();

      if (!pages.length) {
        return;
      }

      let current =
        activeIndex >= 0
          ? activeIndex
          : findNearestIndex();

      if (current < 0) {
        current = 0;
      }

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


    /* -------------------------------------------------------
       WHEEL
       ------------------------------------------------------- */

    function handleWheel(event) {
      if (
        !feed ||
        isInteractiveTarget(
          event.target
        )
      ) {
        return;
      }

      if (
        Math.abs(
          event.deltaY
        ) < 20
      ) {
        return;
      }

      if (navigationLock) {
        return;
      }

      navigationLock = true;

      if (
        event.deltaY > 0
      ) {
        next();
      } else {
        previous();
      }

      setTimeout(() => {
        navigationLock =
          false;
      }, CONFIG.VIDEO.WHEEL_LOCK_MS);
    }


    /* -------------------------------------------------------
       TOUCH START
       ------------------------------------------------------- */

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
        touching = false;
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


    /* -------------------------------------------------------
       TOUCH END
       
       IMPORTANT:
       We DO NOT preventDefault().
       The browser handles the swipe.
       CSS scroll-snap moves it to one full page.
       ------------------------------------------------------- */

    function handleTouchEnd(
      event
    ) {
      if (!touching) {
        return;
      }

      touching = false;

      if (
        !event.changedTouches
          ?.length
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
        event.changedTouches[0];

      const deltaY =
        touch.clientY -
        touchStartY;

      const deltaX =
        touch.clientX -
        touchStartX;

      /*
       * Ignore horizontal gestures.
       */
      if (
        Math.abs(deltaX) >
        Math.abs(deltaY)
      ) {
        return;
      }

      /*
       * Let native scroll + snap
       * decide the page.
       */
      clearTimeout(
        scrollTimer
      );

      scrollTimer =
        setTimeout(
          () => {
            const index =
              findNearestIndex();

            if (index >= 0) {
              scrollToPage(
                index,
                "smooth"
              );
            }
          },
          100
        );
    }


    /* -------------------------------------------------------
       SCROLL
       ------------------------------------------------------- */

    function handleScroll() {
      if (!feed) {
        return;
      }

      clearTimeout(
        scrollTimer
      );

      scrollTimer =
        setTimeout(
          () => {
            const index =
              findNearestIndex();

            if (index < 0) {
              return;
            }

            if (
              index !==
              activeIndex
            ) {
              activate(
                index,
                {
                  updateHash: true
                }
              );
            }
          },
          CONFIG.VIDEO
            .SETTLE_DELAY_MS
        );
    }


    /* -------------------------------------------------------
       INTERSECTION OBSERVER
       ------------------------------------------------------- */

    function setupObserver() {
      if (observer) {
        observer.disconnect();
        observer = null;
      }

      if (
        !(
          "IntersectionObserver" in
          window
        )
      ) {
        return;
      }

      observer =
        new IntersectionObserver(
          (entries) => {
            let best = null;

            entries.forEach(
              (entry) => {
                if (
                  !entry.isIntersecting
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
              pages.indexOf(
                page
              );

            if (
              index >= 0 &&
              index !==
                activeIndex &&
              best.intersectionRatio >=
                0.70
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


    /* -------------------------------------------------------
       REFRESH
       ------------------------------------------------------- */

    function refresh() {
      feed = getFeed();
      pages = getPages();

      forceFeedScrolling();

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


    /* -------------------------------------------------------
       INIT
       ------------------------------------------------------- */

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

      /*
       * Wheel listener is passive.
       * We NEVER call preventDefault().
       */
      feed.addEventListener(
        "wheel",
        handleWheel,
        {
          passive: true
        }
      );

      /*
       * Native mobile touch scrolling.
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

      feed.addEventListener(
        "scroll",
        handleScroll,
        {
          passive: true
        }
      );

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

      const first =
        findNearestIndex();

      if (first >= 0) {
        setTimeout(() => {
          activate(
            first,
            {
              updateHash: false
            }
          );
        }, 200);
      }

      console.log(
        "ZYLO Video Engine ready"
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

    if (!id) {
      return;
    }

    try {
      history.replaceState(
        null,
        "",
        "#video-" +
          encodeURIComponent(
            id
          )
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
      $$(".video-page").find(
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
      setTimeout(() => {
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


  function getLikes() {
    const likes =
      getStorage(
        CONFIG.STORAGE.LIKES,
        []
      );

    return Array.isArray(
      likes
    )
      ? likes
      : [];
  }


  function updateActionCount(
    button,
    delta
  ) {
    if (!button) {
      return;
    }

    const label =
      $(
        ".action-count,.count,.action-number",
        button
      );

    if (!label) {
      return;
    }

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

        if (!id) {
          return;
        }

        const likes =
          getLikes();

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

          updateActionCount(
            button,
            -1
          );
        } else {
          likes.push(id);

          button.classList.add(
            "active",
            "liked"
          );

          updateActionCount(
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
          getLikes().includes(id)
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

        if (!id) {
          return;
        }

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

        const saved =
          getStorage(
            CONFIG.STORAGE.SAVED,
            []
          );

        if (
          saved.includes(id)
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

    if (
      value &&
      typeof value ===
        "object" &&
      !Array.isArray(value)
    ) {
      return value;
    }

    return {};
  }


  function closeCommentPanel() {
    $$(".zylo-comment-panel").forEach(
      (panel) => {
        panel.remove();
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

    if (!id) {
      return;
    }

    closeCommentPanel();

    const comments =
      getComments()[id] ||
      [];

    const panel =
      document.createElement(
        "div"
      );

    panel.className =
      "zylo-comment-panel";

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

    $(
      "[data-zylo-comment-close]",
      panel
    )?.addEventListener(
      "click",
      closeCommentPanel
    );

    form.addEventListener(
      "submit",
      (event) => {
        event.preventDefault();

        const text =
          input.value.trim();

        if (!text) {
          return;
        }

        const all =
          getComments();

        if (
          !Array.isArray(
            all[id]
          )
        ) {
          all[id] = [];
        }

        all[id].push({
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

        setStorage(
          CONFIG.STORAGE.COMMENTS,
          all
        );

        input.value = "";

        closeCommentPanel();

        openComments(
          button
        );
      }
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

        if (!button) {
          return;
        }

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

    const id =
      page?.dataset?.videoId ||
      "";

    const url =
      window.location.origin +
      window.location.pathname +
      "#video-" +
      encodeURIComponent(id);

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

        setTimeout(() => {
          button.classList.remove(
            "active"
          );
        }, 1200);
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

        if (!button) {
          return;
        }

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

        if (!button) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();

        const page =
          button.closest(
            ".video-page"
          );

        const video =
          $("video", page);

        if (!video) {
          return;
        }

        /*
         * Current UI stays unchanged.
         * Music button simply controls the active video.
         */
        if (video.paused) {
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

        if (!button) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();

        const page =
          button.closest(
            ".video-page"
          );

        const video =
          $("video", page);

        if (!video) {
          return;
        }

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
    let lastTapTime = 0;
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

        if (!page) {
          return;
        }

        const now =
          Date.now();

        if (
          lastPage === page &&
          now - lastTapTime <
            320
        ) {
          const like =
            $(".like-btn", page);

          if (like) {
            like.click();
          }
        }

        lastTapTime = now;
        lastPage = page;
      }
    );
  }


  /* =========================================================
     CREATOR DATA
     ========================================================= */

  function getCreatorData(
    page
  ) {
    return {
      uid:
        page?.dataset?.creatorUid ||
        page?.dataset?.ownerUid ||
        page?.dataset?.uid ||
        "creator",

      username:
        page?.dataset
          ?.creatorUsername ||
        page?.dataset?.username ||
        "zylo_creator"
    };
  }


  /* =========================================================
     CREATOR PROFILE
     ========================================================= */

  function showCreatorProfile(
    page
  ) {
    const creator =
      getCreatorData(page);

    let panel =
      $("#zyloCreatorProfile");

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
          >
            ×
          </button>

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
        () => {
          panel.remove();
        }
      );

      $(
        ".zylo-profile-follow",
        panel
      )?.addEventListener(
        "click",
        () => {
          const uid =
            panel.dataset.creatorUid;

          if (!uid) {
            return;
          }

          const follows =
            getStorage(
              CONFIG.STORAGE.FOLLOWS,
              []
            );

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
            panel
          );

          /*
           * Do NOT hide/remove any videos.
           */
          VideoEngine.refresh();
        }
      );
    }

    panel.dataset.creatorUid =
      creator.uid;

    $(
      ".zylo-profile-name",
      panel
    ).textContent =
      creator.username;

    $(
      ".zylo-profile-handle",
      panel
    ).textContent =
      "@" +
      creator.username;

    updateFollowButton(
      panel
    );

    const list =
      $(
        ".zylo-profile-video-list",
        panel
      );

    list.innerHTML = "";

    /*
     * IMPORTANT:
     * All creator videos remain in the feed.
     * We only display their references here.
     */
    VideoEngine
      .getPages()
      .forEach((item) => {
        const data =
          getCreatorData(item);

        if (
          data.uid !==
          creator.uid
        ) {
          return;
        }

        const itemButton =
          document.createElement(
            "button"
          );

        itemButton.type =
          "button";

        itemButton.className =
          "zylo-profile-video-item";

        itemButton.textContent =
          item.dataset.title ||
          item.dataset.videoId ||
          "Video";

        itemButton.addEventListener(
          "click",
          () => {
            const index =
              VideoEngine
                .getPages()
                .indexOf(item);

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
          itemButton
        );
      });

    panel.classList.add(
      "open",
      "active"
    );
  }


  function updateFollowButton(
    panel
  ) {
    const button =
      $(
        ".zylo-profile-follow",
        panel
      );

    if (!button) {
      return;
    }

    const uid =
      panel.dataset.creatorUid;

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

        if (!button) {
          return;
        }

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

        if (!nav) {
          return;
        }

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
          /*
           * auth.js handles the real
           * personal profile/account.
           */
          window.dispatchEvent(
            new CustomEvent(
              "zylo:openprofile"
            )
          );
        }
      }
    );


    /*
     * Top feed tabs.
     */
    document.addEventListener(
      "click",
      (event) => {
        const tab =
          event.target.closest(
            "[data-feed-tab]"
          );

        if (!tab) {
          return;
        }

        const type =
          tab.dataset.feedTab;

        if (
          type ===
            "for-you" ||
          type ===
            "following"
        ) {
          filterFeed(
            type
          );
        }
      }
    );
  }


  /* =========================================================
     FOLLOWING FILTER
     
     IMPORTANT:
     Never hide/remove video pages.
     ========================================================= */

  function filterFeed(
    type
  ) {
    const pages =
      VideoEngine.getPages();

    const follows =
      getStorage(
        CONFIG.STORAGE.FOLLOWS,
        []
      );

    pages.forEach(
      (page) => {
        const creator =
          getCreatorData(page);

        page.hidden = false;
        page.style.display = "";

        page.dataset.followingMatch =
          follows.includes(
            creator.uid
          )
            ? "true"
            : "false";
      }
    );

    VideoEngine.refresh();

    /*
     * For You:
     * return to first video.
     *
     * Following:
     * jump to first followed creator,
     * but DO NOT hide other videos.
     */
    let targetIndex = 0;

    if (
      type ===
      "following"
    ) {
      const followed =
        pages.findIndex(
          (page) =>
            page.dataset
              .followingMatch ===
            "true"
        );

      if (followed >= 0) {
        targetIndex =
          followed;
      }
    }

    setTimeout(() => {
      VideoEngine.scrollToPage(
        targetIndex,
        "auto"
      );
    }, 80);
  }


  /* =========================================================
     SEARCH
     ========================================================= */

  function createSearchOverlay() {
    let overlay =
      $("#zyloSearchOverlay");

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
        >
          ×
        </button>

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
      () => {
        overlay.remove();
      }
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
              page.dataset
                .videoId,

              page.dataset
                .title,

              page.dataset
                .description,

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
                .indexOf(page);

            if (index >= 0) {
              overlay.remove();

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

        if (!button) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();

        const overlay =
          createSearchOverlay();

        overlay.classList.add(
          "open",
          "active"
        );

        setTimeout(() => {
          $(
            ".zylo-search-input",
            overlay
          )?.focus();
        }, 50);
      }
    );
  }


  /* =========================================================
     UPLOAD BOX
     ========================================================= */

  function getUploadBox() {
    return (
      $("#uploadBox") ||
      $(".upload-box")
    );
  }


  function openUploadBox() {
    const box =
      getUploadBox();

    if (!box) {
      console.warn(
        "ZYLO: upload box not found"
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

    if (!box) {
      return;
    }

    box.classList.remove(
      "open",
      "active"
    );

    box.hidden = true;

    box.style.display =
      "none";
  }


  function setupCreateButton() {
    document.addEventListener(
      "click",
      (event) => {
        const button =
          event.target.closest(
            "#createBtn,.create-btn"
          );

        if (!button) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();

        openUploadBox();
      }
    );
  }


  function setupUploadCloseButtons() {
    document.addEventListener(
      "click",
      (event) => {
        const close =
          event.target.closest(
            "#closeUpload,.close-upload,.upload-close,[data-close-upload]"
          );

        if (!close) {
          return;
        }

        event.preventDefault();

        closeUploadBox();
      }
    );
  }


  /* =========================================================
     CREATE UPLOADED PAGE
     ========================================================= */

  function createUploadedPage(
    data
  ) {
    const feed =
      getFeed();

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

    page.dataset.uploaded =
      "true";

    page.dataset.title =
      data.name ||
      "ZYLO Video";

    /*
     * Keep page fullscreen.
     */
    page.style.height =
      "100dvh";

    page.style.minHeight =
      "100dvh";

    page.style.flex =
      "0 0 100dvh";

    page.style.scrollSnapAlign =
      "start";

    page.style.scrollSnapStop =
      "always";

    page.style.overflow =
      "hidden";


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

    video.controls =
      false;

    video.preload =
      "metadata";

    video.loop =
      false;

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

    /*
     * Use the same fullscreen
     * video sizing as existing UI.
     */
    video.style.width =
      "100%";

    video.style.height =
      "100%";

    video.style.objectFit =
      "cover";

    page.appendChild(
      video
    );

    feed.appendChild(
      page
    );

    return page;
  }


  /* =========================================================
     UPLOAD VIDEO
     ========================================================= */

  async function uploadVideo(
    file
  ) {
    if (!file) {
      return;
    }

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
            method:
              "POST",

            body:
              formData
          }
        );

      const result =
        await response.json();

      if (
        response.ok &&
        result
          ?.url
      ) {
        serverURL =
          result.url;

        if (
          serverURL.startsWith(
            "/"
          )
        ) {
          serverURL =
            CONFIG.API_BASE_URL +
            serverURL;
        }
      }
    } catch (error) {
      console.warn(
        "ZYLO upload server error:",
        error
      );
    }

    /*
     * Immediate local preview.
     */
    const localURL =
      URL.createObjectURL(
        file
      );

    const finalURL =
      serverURL ||
      localURL;

    const videoData = {
      id:
        makeId("video"),

      uid,

      username,

      name:
        file.name,

      url:
        finalURL,

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
      const index =
        VideoEngine
          .getPages()
          .indexOf(page);

      if (index >= 0) {
        VideoEngine.scrollToPage(
          index,
          "smooth"
        );
      }
    }

    closeUploadBox();

    try {
      window.dispatchEvent(
        new CustomEvent(
          "zylo:uploaded",
          {
            detail:
              videoData
          }
        )
      );
    } catch {}

    console.log(
      "ZYLO video uploaded",
      videoData
    );
  }


  /* =========================================================
     UPLOAD INPUT
     ========================================================= */

  function setupUploadInput() {
    document.addEventListener(
      "change",
      (event) => {
        const input =
          event.target.closest(
            "#videoInput"
          );

        if (!input) {
          return;
        }

        const file =
          input.files?.[0];

        if (!file) {
          return;
        }

        uploadVideo(
          file
        );

        input.value =
          "";
      }
    );
  }


  /* =========================================================
     RESTORE UPLOADS
     ========================================================= */

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
      getFeed();

    if (!feed) {
      return;
    }

    const existing =
      new Set(
        $$(".video-page", feed)
          .map(
            (page) =>
              page.dataset
                .videoId
          )
          .filter(Boolean)
      );

    /*
     * Oldest first so newest
     * uploaded videos remain
     * at the top after reverse.
     */
    uploads
      .slice()
      .reverse()
      .forEach(
        (data) => {
          if (
            !data?.id ||
            existing.has(
              data.id
            )
          ) {
            return;
          }

          /*
           * Blob URLs cannot survive
           * page reload.
           */
          const url =
            data.serverURL ||
            data.url;

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

        if (!video) {
          return;
        }

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
          VideoEngine
            .getActiveIndex();

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

          $(
            "#zyloSearchOverlay"
          )?.remove();

          $(
            "#zyloCreatorProfile"
          )?.remove();

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
     * Load Firebase/auth system.
     */
    loadAuthJS();


    /*
     * Restore uploaded videos
     * before initializing feed.
     */
    restoreUploadedVideos();


    /*
     * Start video engine.
     */
    VideoEngine.init();


    /*
     * Existing action buttons.
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
     * Navigation.
     */
    setupNavigation();

    setupSearch();


    /*
     * Upload.
     */
    setupCreateButton();

    setupUploadCloseButtons();

    setupUploadInput();


    /*
     * Video interaction.
     */
    setupVideoClick();

    setupVisibilityHandling();

    setupKeyboardNavigation();


    /*
     * Hash navigation.
     */
    openHashVideo();

    window.addEventListener(
      "hashchange",
      openHashVideo
    );


    /*
     * Resize.
     */
    window.addEventListener(
      "resize",
      () => {
        VideoEngine.refresh();
      }
    );


    /*
     * Auth loaded.
     */
    window.addEventListener(
      "zylo:authloaded",
      () => {
        VideoEngine.refresh();
      }
    );


    console.log(
      "ZYLO frontend initialized successfully"
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
