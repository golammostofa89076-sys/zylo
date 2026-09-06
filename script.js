/* =========================================================
   ZYLO - VIDEO SYSTEM ENGINE
   UI / CSS / BUTTON DESIGN UNTOUCHED

   Video:
   - Native mobile scroll + snap
   - Autoplay
   - One active video at a time
   - Adjacent preload
   - CDN-first loading for default video
   - Auto-next when video ends
   - Tap video = play/pause

   Other:
   - Like
   - Save
   - Comment
   - Share
   - Music
   - Fullscreen
   - Creator profile
   - Follow
   - Search
   - Upload
   - Auth bridge
   ========================================================= */

(() => {
  "use strict";

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
      PRELOAD_AHEAD: 1,
      PRELOAD_BEHIND: 1,

      SETTLE_DELAY_MS: 120,

      PLAY_RETRY_MS: 350,

      AUTO_NEXT_DELAY_MS: 150,

      VISIBILITY_THRESHOLD: 0.70
    }
  };

  /* =========================================================
     HELPERS
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
    try {
      return safeJSONParse(localStorage.getItem(key), fallback);
    } catch {
      return fallback;
    }
  }

  function setStorage(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.warn("ZYLO storage error:", error);
    }
  }

  function makeId(prefix = "zylo") {
    return (
      prefix +
      "_" +
      Date.now().toString(36) +
      "_" +
      Math.random().toString(36).slice(2, 10)
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
        "button,a,input,textarea,select,label," +
        ".action-btn,.music-btn,.fullscreen-btn," +
        ".profile-action,.create-btn,.search-btn," +
        ".comment-panel,.modal,.upload-box," +
        ".zylo-comment-panel,.zylo-profile-panel," +
        ".zylo-search-overlay"
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
      window.dispatchEvent(
        new CustomEvent("zylo:authloaded")
      );
    };

    script.onerror = () => {
      console.warn("ZYLO: auth.js could not be loaded.");
    };

    document.head.appendChild(script);
  }

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

  function getVideoOriginalSource(video) {
    if (!video) return "";

    if (video.dataset.zyloOriginalSource) {
      return video.dataset.zyloOriginalSource;
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

    video.dataset.zyloOriginalSource = source;

    return source;
  }

  /*
   * CDN FIRST for the built-in default video.
   * Uploaded/server videos keep their own URL.
   */

  function getPreferredVideoSource(video) {
    const original = getVideoOriginalSource(video);

    if (isDefaultLocalVideo(original)) {
      return CONFIG.CDN_VIDEO;
    }

    return original;
  }

  /* =========================================================
     VIDEO ENGINE
     ========================================================= */

  const VideoEngine = (() => {
    let feed = null;
    let pages = [];
    let activeIndex = -1;

    let scrollTimer = null;

    let initialized = false;

    let mutationObserver = null;

    let intersectionObserver = null;

    let autoNextLock = false;

    function getFeed() {
      return $(".video-feed");
    }

    /*
     * IMPORTANT:
     * Never filter pages.
     * Every .video-page must remain part of the feed.
     */

    function getPages() {
      if (!feed) {
        feed = getFeed();
      }

      if (!feed) {
        return [];
      }

      return $$(".video-page", feed);
    }

    function getVideo(page) {
      return page ? $("video", page) : null;
    }

    /* =======================================================
       PREPARE VIDEO
       ======================================================= */

    function prepareVideo(video) {
      if (!video) return;

      getVideoOriginalSource(video);

      video.muted = true;
      video.defaultMuted = true;

      video.playsInline = true;

      video.controls = false;

      video.setAttribute("muted", "");
      video.setAttribute("playsinline", "");
      video.setAttribute("webkit-playsinline", "");

      /*
       * loop MUST be false.
       * Otherwise ended event will not fire.
       */

      video.loop = false;
      video.removeAttribute("loop");

      if (!video.dataset.zyloPrepared) {
        video.dataset.zyloPrepared = "true";
        video.dataset.zyloPlaying = "false";
        video.dataset.zyloActive = "false";
        video.dataset.zyloEnded = "false";
      }
    }

    /* =======================================================
       SOURCE LOAD
       ======================================================= */

    function ensureSource(video, mode = "metadata") {
      if (!video) return false;

      prepareVideo(video);

      const preferred = getPreferredVideoSource(video);

      if (!preferred) return false;

      const wanted = normalizeVideoSource(preferred);

      const current =
        normalizeVideoSource(
          video.currentSrc ||
          video.src ||
          ""
        );

      /*
       * If already using preferred source,
       * only change preload mode.
       */

      if (current === wanted) {
        video.preload = mode;
        return true;
      }

      /*
       * Set preferred source.
       */

      video.src = preferred;

      video.preload = mode;

      video.dataset.zyloSource = preferred;

      /*
       * Important:
       * Do not immediately call load() for every preload.
       * Browser can manage buffering naturally.
       */

      return true;
    }

    /* =======================================================
       SOURCE ERROR
       ======================================================= */

    function installErrorHandler(video) {
      if (!video) return;

      if (video.dataset.zyloErrorHandler === "true") {
        return;
      }

      video.dataset.zyloErrorHandler = "true";

      video.addEventListener("error", () => {
        const original = getVideoOriginalSource(video);

        /*
         * If CDN failed, try original local source.
         */

        if (
          isDefaultLocalVideo(original) &&
          video.dataset.zyloFallbackUsed !== "true"
        ) {
          video.dataset.zyloFallbackUsed = "true";

          video.src = original;
          video.preload = "auto";

          try {
            video.load();
          } catch {}

          if (video.dataset.zyloActive === "true") {
            setTimeout(() => {
              playVideo(video);
            }, CONFIG.VIDEO.PLAY_RETRY_MS);
          }
        }
      });
    }

    /* =======================================================
       AUTO NEXT
       ======================================================= */

    function installEndedHandler(video) {
      if (!video) return;

      if (video.dataset.zyloEndedHandler === "true") {
        return;
      }

      video.dataset.zyloEndedHandler = "true";

      video.addEventListener("ended", () => {
        if (autoNextLock) {
          return;
        }

        autoNextLock = true;

        const page = video.closest(".video-page");

        const index = pages.indexOf(page);

        if (index >= 0) {
          activeIndex = index;
        }

        setTimeout(() => {
          next(true);

          setTimeout(() => {
            autoNextLock = false;
          }, 450);
        }, CONFIG.VIDEO.AUTO_NEXT_DELAY_MS);
      });
    }

    function registerVideo(video) {
      if (!video) return;

      prepareVideo(video);

      installErrorHandler(video);

      installEndedHandler(video);
    }

    /* =======================================================
       SMART PRELOAD
       ======================================================= */

    function smartLoad(index) {
      if (!pages.length) return;

      pages.forEach((page, i) => {
        const video = getVideo(page);

        if (!video) return;

        const distance = Math.abs(i - index);

        if (distance === 0) {
          /*
           * Current video
           */
          ensureSource(video, "auto");
        } else if (
          distance <= CONFIG.VIDEO.PRELOAD_AHEAD
        ) {
          /*
           * Next video
           */
          ensureSource(video, "auto");
        } else if (
          distance <= CONFIG.VIDEO.PRELOAD_BEHIND
        ) {
          /*
           * Previous video
           */
          ensureSource(video, "metadata");
        } else {
          /*
           * Far videos
           */
          video.preload = "none";
        }
      });
    }

    /* =======================================================
       PAUSE ALL
       ======================================================= */

    function pauseAll(except = null) {
      pages.forEach((page) => {
        const video = getVideo(page);

        if (!video || video === except) {
          return;
        }

        try {
          video.pause();
        } catch {}

        video.dataset.zyloActive = "false";
        video.dataset.zyloPlaying = "false";
      });
    }

    /* =======================================================
       PLAY
       ======================================================= */

    async function playVideo(video) {
      if (!video) return false;

      prepareVideo(video);

      ensureSource(video, "auto");

      video.muted = true;
      video.defaultMuted = true;

      video.playsInline = true;

      video.loop = false;

      /*
       * If browser already has enough data,
       * play immediately.
       */

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

        /*
         * Retry once after browser finishes attaching source.
         */

        setTimeout(() => {
          if (
            video.dataset.zyloActive === "true" &&
            !document.hidden
          ) {
            video.muted = true;

            video.play().then(() => {
              video.dataset.zyloPlaying = "true";
            }).catch(() => {});
          }
        }, CONFIG.VIDEO.PLAY_RETRY_MS);

        return false;
      }
    }

    /* =======================================================
       ACTIVATE
       ======================================================= */

    async function activate(index, options = {}) {
      refresh();

      if (!pages.length) {
        return;
      }

      index = Math.max(
        0,
        Math.min(index, pages.length - 1)
      );

      const page = pages[index];

      if (!page) return;

      const video = getVideo(page);

      activeIndex = index;

      /*
       * Update active state.
       */

      pages.forEach((item, i) => {
        const active = i === index;

        item.classList.toggle(
          "active",
          active
        );

        item.dataset.active = active
          ? "true"
          : "false";

        const itemVideo = getVideo(item);

        if (itemVideo) {
          itemVideo.dataset.zyloActive =
            active
              ? "true"
              : "false";

          itemVideo.loop = false;
        }
      });

      /*
       * Only active video plays.
       */

      pauseAll(video);

      /*
       * Load current + next.
       */

      smartLoad(index);

      /*
       * Play active video.
       */

      if (video) {
        await playVideo(video);
      }

      /*
       * URL
       */

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

    /* =======================================================
       FIND NEAREST PAGE
       ======================================================= */

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

    /* =======================================================
       SCROLL TO PAGE
       ======================================================= */

    function scrollToPage(
      index,
      behavior = "smooth"
    ) {
      refresh();

      if (!feed || !pages.length) {
        return;
      }

      index = Math.max(
        0,
        Math.min(index, pages.length - 1)
      );

      const page = pages[index];

      if (!page) return;

      page.scrollIntoView({
        behavior,
        block: "start",
        inline: "nearest"
      });

      if (behavior === "auto") {
        activate(index, {
          updateHash: true
        });
      } else {
        setTimeout(() => {
          activate(index, {
            updateHash: true
          });
        }, 300);
      }
    }

    /* =======================================================
       NEXT
       ======================================================= */

    function next(fromEnded = false) {
      refresh();

      if (!pages.length) return;

      let current = activeIndex;

      if (current < 0) {
        current = findNearestIndex();
      }

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

      /*
       * Preload next video before scrolling.
       */

      const nextPage = pages[nextIndex];

      const nextVideo =
        getVideo(nextPage);

      if (nextVideo) {
        prepareVideo(nextVideo);

        ensureSource(
          nextVideo,
          "auto"
        );
      }

      scrollToPage(
        nextIndex,
        "smooth"
      );
    }

    /* =======================================================
       PREVIOUS
       ======================================================= */

    function previous() {
      refresh();

      if (!pages.length) return;

      let current = activeIndex;

      if (current < 0) {
        current = findNearestIndex();
      }

      if (current < 0) return;

      const previousIndex =
        Math.max(
          0,
          current - 1
        );

      if (
        previousIndex !== current
      ) {
        scrollToPage(
          previousIndex,
          "smooth"
        );
      }
    }

    /* =======================================================
       NATIVE SCROLL
       ======================================================= */

    function handleScroll() {
      if (!feed) return;

      clearTimeout(scrollTimer);

      scrollTimer = setTimeout(() => {
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

    /* =======================================================
       INTERSECTION OBSERVER
       ======================================================= */

    function setupIntersectionObserver() {
      if (intersectionObserver) {
        intersectionObserver.disconnect();
        intersectionObserver = null;
      }

      if (
        !("IntersectionObserver" in window)
      ) {
        return;
      }

      intersectionObserver =
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

            if (
              best.intersectionRatio <
              CONFIG.VIDEO.VISIBILITY_THRESHOLD
            ) {
              return;
            }

            const page =
              best.target;

            const index =
              pages.indexOf(page);

            if (
              index >= 0 &&
              index !== activeIndex
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
        intersectionObserver.observe(page);
      });
    }

    /* =======================================================
       FORCE FEED SCROLL
       ======================================================= */

    function forceFeedScrolling() {
      if (!feed) return;

      /*
       * These properties guarantee native browser
       * scrolling even if an older CSS file is cached.
       */

      feed.style.overflowY = "auto";
      feed.style.overflowX = "hidden";

      feed.style.scrollSnapType =
        "y mandatory";

      feed.style.touchAction =
        "pan-y";

      feed.style.webkitOverflowScrolling =
        "touch";

      pages.forEach((page) => {
        page.style.scrollSnapAlign =
          "start";

        page.style.scrollSnapStop =
          "always";
      });
    }

    /* =======================================================
       REFRESH
       ======================================================= */

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

    /* =======================================================
       INIT
       ======================================================= */

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
       * IMPORTANT:
       * No preventDefault.
       * No manual touch swipe.
       * No wheel lock.
       *
       * Browser controls scrolling.
       */

      feed.addEventListener(
        "scroll",
        handleScroll,
        {
          passive: true
        }
      );

      mutationObserver =
        new MutationObserver(() => {
          refresh();
        });

      mutationObserver.observe(
        feed,
        {
          childList: true,
          subtree: true
        }
      );

      /*
       * Initial active video.
       */

      const initialIndex =
        findNearestIndex();

      if (initialIndex >= 0) {
        setTimeout(() => {
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

  function updateURL(page, enabled = true) {
    if (!enabled || !page) return;

    const id =
      page.dataset.videoId;

    if (!id) return;

    try {
      history.replaceState(
        null,
        "",
        "#video-" +
          encodeURIComponent(id)
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
        hash.replace(
          "#video-",
          ""
        )
      );

    let page = null;

    try {
      page = $(
        `.video-page[data-video-id="${CSS.escape(id)}"]`
      );
    } catch {}

    if (!page) return;

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
          likes.splice(index, 1);

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
          saved.splice(index, 1);

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

    closeCommentPanel();

    const comments =
      getComments()[id] || [];

    const panel =
      document.createElement(
        "div"
      );

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

  /* =========================================================
     SHARE
     ========================================================= */

  async function shareVideo(button) {
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
      if (navigator.share) {
        await navigator.share({
          title: "ZYLO",
          text: "Watch this video on ZYLO",
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

        if (!button) return;

        event.preventDefault();
        event.stopPropagation();

        shareVideo(button);
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

        if (video.paused) {
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

    let lastTarget = null;

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
          lastTarget === page &&
          now - lastTap < 320
        ) {
          const likeButton =
            $(".like-btn", page);

          if (likeButton) {
            likeButton.click();
          }
        }

        lastTap = now;

        lastTarget = page;
      }
    );
  }

  /* =========================================================
     CREATOR PROFILE
     ========================================================= */

  function getCreatorData(page) {
    return {
      uid:
        page?.dataset?.creatorUid ||
        page?.dataset?.ownerUid ||
        page?.dataset?.uid ||
        "creator",

      username:
        page?.dataset?.creatorUsername ||
        page?.dataset?.username ||
        "zylo_creator"
    };
  }

  function showCreatorProfile(page) {
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

      $(".zylo-profile-close", panel)
        ?.addEventListener(
          "click",
          () => panel.remove()
        );

      $(".zylo-profile-follow", panel)
        ?.addEventListener(
          "click",
          () => {
            const follows =
              getStorage(
                CONFIG.STORAGE.FOLLOWS,
                []
              );

            const uid =
              panel.dataset.creatorUid;

            const index =
              follows.indexOf(uid);

            if (index >= 0) {
              follows.splice(
                index,
                1
              );

              $(
                ".zylo-profile-follow",
                panel
              ).textContent =
                "Follow";
            } else {
              follows.push(uid);

              $(
                ".zylo-profile-follow",
                panel
              ).textContent =
                "Following";
            }

            setStorage(
              CONFIG.STORAGE.FOLLOWS,
              follows
            );
          }
        );
    }

    panel.dataset.creatorUid =
      creator.uid;

    $(".zylo-profile-name", panel)
      .textContent =
      creator.username ||
      "zylo_creator";

    $(".zylo-profile-handle", panel)
      .textContent =
      "@" +
      (
        creator.username ||
        "zylo_creator"
      );

    const follows =
      getStorage(
        CONFIG.STORAGE.FOLLOWS,
        []
      );

    $(".zylo-profile-follow", panel)
      .textContent =
      follows.includes(
        creator.uid
      )
        ? "Following"
        : "Follow";

    const list =
      $(".zylo-profile-video-list", panel);

    const creatorPages =
      VideoEngine
        .getPages()
        .filter((item) => {
          const data =
            getCreatorData(item);

          return (
            data.uid ===
            creator.uid
          );
        });

    list.innerHTML = "";

    creatorPages.forEach(
      (item) => {
        const thumb =
          document.createElement(
            "div"
          );

        thumb.className =
          "zylo-profile-video-item";

        thumb.textContent =
          item.dataset.videoId ||
          "Video";

        thumb.addEventListener(
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
          thumb
        );
      }
    );

    panel.classList.add(
      "open",
      "active"
    );
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

        if (type === "home") {
          event.preventDefault();

          VideoEngine.refresh();

          VideoEngine.scrollToPage(
            0,
            "smooth"
          );

          return;
        }

        if (type === "profile") {
          window.dispatchEvent(
            new CustomEvent(
              "zylo:openprofile"
            )
          );
        }
      }
    );

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
          type === "for-you" ||
          type === "following"
        ) {
          filterFeed(type);
        }
      }
    );
  }

  function filterFeed(type) {
    const pages =
      $$(".video-page");

    const follows =
      getStorage(
        CONFIG.STORAGE.FOLLOWS,
        []
      );

    pages.forEach((page) => {
      const creator =
        getCreatorData(page);

      /*
       * Do NOT hide/remove pages.
       * We keep all pages mounted.
       */

      page.hidden = false;

      page.style.display = "";

      page.dataset.followingMatch =
        follows.includes(
          creator.uid
        )
          ? "true"
          : "false";
    });

    VideoEngine.refresh();

    setTimeout(() => {
      VideoEngine.scrollToPage(
        0,
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

    $(".zylo-search-close", overlay)
      ?.addEventListener(
        "click",
        () => overlay.remove()
      );

    const input =
      $(".zylo-search-input", overlay);

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
      $(".zylo-search-results", overlay);

    if (!term) {
      results.innerHTML = "";
      return;
    }

    const pages =
      VideoEngine
        .getPages()
        .filter((page) => {
          const creator =
            getCreatorData(page);

          const text = [
            page.dataset.videoId,
            page.dataset.title,
            page.dataset.description,
            creator.username
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

          return text.includes(term);
        });

    results.innerHTML = "";

    pages.forEach((page) => {
      const item =
        document.createElement(
          "button"
        );

      item.type = "button";

      item.className =
        "zylo-search-result";

      item.textContent =
        page.dataset.title ||
        page.dataset.videoId ||
        getCreatorData(page)
          .username;

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
    });
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

        setTimeout(() => {
          $(".zylo-search-input", overlay)
            ?.focus();
        }, 50);
      }
    );
  }

  /* =========================================================
     UPLOAD
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

  function setupCreateButton() {
    /*
     * Capture phase guarantees
     * the Create button is caught
     * before other click handlers.
     */

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
      },
      true
    );
  }

  function setupUploadCloseButtons() {
    document.addEventListener(
      "click",
      (event) => {
        const button =
          event.target.closest(
            "#closeUpload," +
            ".close-upload," +
            ".upload-close," +
            "[data-close-upload]"
          );

        if (!button) return;

        event.preventDefault();

        closeUploadBox();
      }
    );
  }

  /* =========================================================
     CREATE UPLOADED PAGE
     ========================================================= */

  function createUploadedPage(data) {
    const feed =
      getFeed();

    if (!feed) return null;

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
      data.title ||
      data.name ||
      "";

    page.dataset.description =
      data.description ||
      data.caption ||
      "";

    /*
     * Keep video page compatible
     * with existing UI.
     */

    const video =
      document.createElement(
        "video"
      );

    video.src =
      data.url;

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

    video.preload =
      "metadata";

    video.loop = false;

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

  async function uploadVideo(file) {
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

    let serverURL = "";

    let serverVideoId = "";

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

      const result =
        await response.json();

      if (
        response.ok
      ) {
        serverURL =
          result?.url ||
          result?.videoUrl ||
          result?.video?.url ||
          "";

        serverVideoId =
          result?.videoId ||
          result?.video?.videoId ||
          "";
      }
    } catch (error) {
      console.warn(
        "ZYLO upload server error:",
        error
      );
    }

    /*
     * We still allow the current browser
     * to see the uploaded video immediately.
     *
     * If server succeeded:
     * serverURL is permanent on the current
     * backend setup.
     *
     * If server failed:
     * local blob is session-only.
     */

    const localURL =
      URL.createObjectURL(file);

    const finalURL =
      serverURL ||
      localURL;

    const videoData = {
      id:
        serverVideoId ||
        makeId("video"),

      uid,

      username,

      name:
        file.name,

      url:
        finalURL,

      serverURL,

      createdAt:
        Date.now()
    };

    const uploads =
      getStorage(
        CONFIG.STORAGE.UPLOADED_VIDEOS,
        []
      );

    uploads.unshift(
      videoData
    );

    setStorage(
      CONFIG.STORAGE.UPLOADED_VIDEOS,
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
  }

  /* =========================================================
     RESTORE UPLOADED VIDEOS
     ========================================================= */

  function restoreUploadedVideos() {
    const uploads =
      getStorage(
        CONFIG.STORAGE.UPLOADED_VIDEOS,
        []
      );

    if (
      !Array.isArray(uploads) ||
      !uploads.length
    ) {
      return;
    }

    const feed =
      getFeed();

    if (!feed) return;

    const existingIds =
      new Set(
        $$(".video-page", feed)
          .map(
            (page) =>
              page.dataset.videoId
          )
          .filter(Boolean)
      );

    uploads
      .slice()
      .reverse()
      .forEach((data) => {
        if (
          !data?.id ||
          existingIds.has(data.id)
        ) {
          return;
        }

        const url =
          data.serverURL ||
          data.url;

        /*
         * Blob URLs do not survive reload.
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
      });

    VideoEngine.refresh();
  }

  /* =========================================================
     VIDEO INPUT
     ========================================================= */

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

        uploadVideo(file);

        input.value = "";
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

        if (video.paused) {
          video.muted = true;

          VideoEngine.playVideo(
            video
          );
        } else {
          video.pause();

          video.dataset.zyloPlaying =
            "false";
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

        if (document.hidden) {
          pages.forEach(
            (page) => {
              const video =
                $("video", page);

              if (video) {
                try {
                  video.pause();
                } catch {}

                video.dataset.zyloPlaying =
                  "false";
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
              updateHash: false
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
            $("#zyloSearchOverlay");

          if (search) {
            search.remove();
          }

          const profile =
            $("#zyloCreatorProfile");

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
    loadAuthJS();

    restoreUploadedVideos();

    VideoEngine.init();

    setupLikeButtons();

    setupSaveButtons();

    setupCommentButtons();

    setupShareButtons();

    setupMusicButtons();

    setupFullscreenButtons();

    setupDoubleTapLike();

    setupCreatorProfileButtons();

    setupNavigation();

    setupSearch();

    setupCreateButton();

    setupUploadCloseButtons();

    setupUploadInput();

    setupVideoClick();

    setupVisibilityHandling();

    setupKeyboardNavigation();

    openHashVideo();

    window.addEventListener(
      "hashchange",
      openHashVideo
    );

    window.addEventListener(
      "resize",
      () => {
        VideoEngine.refresh();
      }
    );

    window.addEventListener(
      "zylo:authloaded",
      () => {
        VideoEngine.refresh();

        const index =
          VideoEngine.getActiveIndex();

        if (index >= 0) {
          VideoEngine.activate(
            index,
            {
              updateHash: false
            }
          );
        }
      }
    );

    console.log(
      "ZYLO frontend initialized"
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
