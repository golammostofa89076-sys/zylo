/* =========================================================
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
      PRELOAD_BEHIND: 1,
      SWIPE_THRESHOLD: 55,
      WHEEL_LOCK_MS: 650,
      SETTLE_DELAY_MS: 120,
      PLAY_RETRY_MS: 300,
      AUTO_NEXT_DELAY_MS: 180
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

    return isDefaultLocalVideo(primary) ? CONFIG.CDN_VIDEO : "";
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
    let touching = false;

    let initialized = false;
    let observer = null;
    let visibilityObserver = null;

    let autoNextLock = false;

    function getFeed() {
      return $(".video-feed");
    }

    function getPages() {
      if (!feed) {
        feed = getFeed();
      }

      if (!feed) return [];

      return $$(".video-page", feed).filter(
        (page) => !page.hidden && page.style.display !== "none"
      );
    }

    function getVideo(page) {
      return page ? $("video", page) : null;
    }

    function prepareVideo(video) {
      if (!video) return;

      captureVideoSource(video);

      video.muted = true;
      video.playsInline = true;

      video.setAttribute("muted", "");
      video.setAttribute("playsinline", "");
      video.setAttribute("webkit-playsinline", "");

      video.controls = false;

      /*
       * Important:
       * loop must remain false so ended event can fire.
       */
      video.loop = false;
      video.removeAttribute("loop");

      if (!video.dataset.zyloPrepared) {
        video.dataset.zyloPrepared = "true";
        video.dataset.zyloEnded = "false";
      }
    }

    function ensureSource(video, preloadMode = "metadata") {
      if (!video) return false;

      prepareVideo(video);

      const primary = captureVideoSource(video);

      if (!primary) return false;

      const currentSrc = video.currentSrc || video.src || "";
      const wanted = normalizeVideoSource(primary);

      if (!currentSrc || currentSrc === window.location.href) {
        video.src = primary;
        video.preload = preloadMode;
        video.dataset.zyloSourceState = "primary";

        return true;
      }

      if (normalizeVideoSource(currentSrc) === wanted) {
        video.preload = preloadMode;
        return true;
      }

      return true;
    }

    function installErrorFallback(video) {
      if (!video || video.dataset.zyloErrorHandler === "true") {
        return;
      }

      video.dataset.zyloErrorHandler = "true";

      video.addEventListener("error", () => {
        const fallback = getFallbackSource(video);

        if (!fallback) return;

        if (video.dataset.zyloUsingFallback === "true") {
          return;
        }

        video.dataset.zyloUsingFallback = "true";

        video.src = fallback;
        video.preload = "auto";
        video.load();

        if (video.dataset.zyloActive === "true") {
          playVideo(video);
        }
      });
    }

    function attachEndedHandler(video) {
      if (!video || video.dataset.zyloEndedHandler === "true") {
        return;
      }

      video.dataset.zyloEndedHandler = "true";

      video.addEventListener("ended", () => {
        if (autoNextLock) return;

        autoNextLock = true;

        const currentVideo = video;
        const currentPage = currentVideo.closest(".video-page");
        const currentIndex = pages.indexOf(currentPage);

        if (currentIndex >= 0) {
          activeIndex = currentIndex;
        }

        window.setTimeout(() => {
          next(true);

          window.setTimeout(() => {
            autoNextLock = false;
          }, CONFIG.VIDEO.WHEEL_LOCK_MS);
        }, CONFIG.VIDEO.AUTO_NEXT_DELAY_MS);
      });
    }

    function registerVideo(video) {
      if (!video) return;

      prepareVideo(video);
      installErrorFallback(video);
      attachEndedHandler(video);
    }

    function smartLoad(index) {
      if (!pages.length) return;

      pages.forEach((page, i) => {
        const video = getVideo(page);

        if (!video) return;

        const distance = Math.abs(i - index);

        if (distance === 0) {
          ensureSource(video, "auto");
        } else if (distance <= CONFIG.VIDEO.PRELOAD_AHEAD) {
          ensureSource(video, "metadata");
        } else if (distance <= CONFIG.VIDEO.PRELOAD_BEHIND) {
          video.preload = "metadata";
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

      updateURL(page, options.updateHash !== false);

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

      const feedRect = feed.getBoundingClientRect();

      const feedCenter =
        feedRect.top + feedRect.height / 2;

      let bestIndex = 0;
      let bestDistance = Infinity;

      pages.forEach((page, index) => {
        const rect = page.getBoundingClientRect();

        const center = rect.top + rect.height / 2;

        const distance = Math.abs(center - feedCenter);

        if (distance < bestDistance) {
          bestDistance = distance;
          bestIndex = index;
        }
      });

      return bestIndex;
    }

    function scrollToPage(index, behavior = "smooth") {
      refresh();

      if (!pages.length) return;

      index = Math.max(0, Math.min(index, pages.length - 1));

      const page = pages[index];

      if (!page) return;

      activeIndex = index;

      if (feed) {
        const targetTop = page.offsetTop;

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

      const nextIndex = current + 1;

      if (nextIndex >= pages.length) {
        if (fromEnded) {
          console.log("ZYLO: শেষ ভিডিওতে পৌঁছেছে");
        }

        return;
      }

      const nextPage = pages[nextIndex];
      const nextVideo = getVideo(nextPage);

      if (nextVideo) {
        prepareVideo(nextVideo);

        ensureSource(nextVideo, "auto");

        nextVideo.muted = true;
        nextVideo.playsInline = true;
        nextVideo.preload = "auto";
      }

      scrollToPage(nextIndex, "smooth");

      window.setTimeout(() => {
        refresh();

        if (pages[nextIndex]) {
          activate(nextIndex, {
            updateHash: true
          });
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

      const previousIndex = Math.max(0, current - 1);

      if (previousIndex !== current) {
        scrollToPage(previousIndex, "smooth");
      }
    }

    function handleWheel(event) {
      if (!feed || isInteractiveTarget(event.target)) {
        return;
      }

      const delta = event.deltaY;

      if (Math.abs(delta) < 12) return;

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
      if (!event.touches?.length) return;

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

      if (isInteractiveTarget(event.target)) {
        return;
      }

      if (!event.changedTouches?.length) {
        return;
      }

      const touch = event.changedTouches[0];

      const deltaY =
        touch.clientY - touchStartY;

      const deltaX =
        touch.clientX - touchStartX;

      if (
        Math.abs(deltaY) <
        CONFIG.VIDEO.SWIPE_THRESHOLD
      ) {
        return;
      }

      if (Math.abs(deltaY) < Math.abs(deltaX)) {
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

      clearTimeout(scrollTimer);

      scrollTimer = window.setTimeout(() => {
        const index = findNearestIndex();

        if (index < 0 || index === activeIndex) {
          return;
        }

        activate(index, {
          updateHash: true
        });
      }, CONFIG.VIDEO.SETTLE_DELAY_MS);
    }

    function setupIntersectionObserver() {
      if (visibilityObserver) {
        visibilityObserver.disconnect();
      }

      if (!("IntersectionObserver" in window)) {
        return;
      }

      visibilityObserver =
        new IntersectionObserver(
          (entries) => {
            let best = null;

            entries.forEach((entry) => {
              if (
                entry.isIntersecting &&
                entry.intersectionRatio >= 0.65
              ) {
                if (
                  !best ||
                  entry.intersectionRatio >
                    best.intersectionRatio
                ) {
                  best = entry;
                }
              }
            });

            if (!best) return;

            const page = best.target;
            const index = pages.indexOf(page);

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
            threshold: [0.65, 0.8, 1]
          }
        );

      pages.forEach((page) => {
        visibilityObserver.observe(page);
      });
    }

    function refresh() {
      feed = getFeed();

      pages = getPages();

      pages.forEach((page) => {
        const video = getVideo(page);

        registerVideo(video);
      });

      setupIntersectionObserver();

      if (activeIndex >= pages.length) {
        activeIndex = pages.length
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

      observer = new MutationObserver(() => {
        refresh();
      });

      observer.observe(feed, {
        childList: true,
        subtree: true
      });

      const initialIndex =
        findNearestIndex();

      if (initialIndex >= 0) {
        window.setTimeout(() => {
          activate(initialIndex, {
            updateHash: false
          });
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

  function updateURL(page, enabled = true) {
    if (!enabled || !page) return;

    const id = page.dataset.videoId;

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
    const hash = window.location.hash || "";

    if (!hash.startsWith("#video-")) {
      return;
    }

    const id = decodeURIComponent(
      hash.replace("#video-", "")
    );

    const page = $(
      `.video-page[data-video-id="${CSS.escape(id)}"]`
    );

    if (!page) return;

    const pages = VideoEngine.getPages();

    const index = pages.indexOf(page);

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
      button?.closest?.(".video-page");

    return (
      page?.dataset?.videoId ||
      page?.id ||
      ""
    );
  }

  function getLikeSet() {
    const values = getStorage(
      CONFIG.STORAGE.LIKES,
      []
    );

    return Array.isArray(values)
      ? values
      : [];
  }

  function updateCount(button, delta) {
    if (!button) return;

    const label = $(
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

    label.textContent = String(
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
          getVideoIdFromButton(button);

        if (!id) return;

        const likes = getLikeSet();

        const index =
          likes.indexOf(id);

        if (index >= 0) {
          likes.splice(index, 1);

          button.classList.remove(
            "active",
            "liked"
          );

          updateCount(button, -1);
        } else {
          likes.push(id);

          button.classList.add(
            "active",
            "liked"
          );

          updateCount(button, 1);
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
          getVideoIdFromButton(button);

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
          getVideoIdFromButton(button);

        if (!id) return;

        const saved = getStorage(
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
          getVideoIdFromButton(button);

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
    const value = getStorage(
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
    const panels = $$(
      ".zylo-comment-panel,.comment-panel"
    );

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
      getVideoIdFromButton(button);

    if (!id) return;

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

    document.body.appendChild(panel);

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
      button.closest(".video-page");

    const id =
      page?.dataset?.videoId || "";

    const url =
      `${window.location.origin}` +
      `${window.location.pathname}` +
      `#video-${encodeURIComponent(id)}`;

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

        button.classList.add("active");

        window.setTimeout(() => {
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
    document.addEventListener("click", (event) => {
      const button = event.target.closest(".music-btn");

      if (!button) return;

      event.preventDefault();
      event.stopPropagation();

      const page = button.closest(".video-page");
      const video = $("video", page);

      if (!video) return;

      if (video.paused) {
        VideoEngine.playVideo(video);
      } else {
        video.pause();
      }

      button.classList.toggle("active", !video.paused);
    });
  }

  /* =========================================================
     FULLSCREEN
     ========================================================= */

  function setupFullscreenButtons() {
    document.addEventListener("click", async (event) => {
      const button = event.target.closest(".fullscreen-btn");

      if (!button) return;

      event.preventDefault();
      event.stopPropagation();

      const page = button.closest(".video-page");
      const video = $("video", page);

      if (!video) return;

      try {
        if (document.fullscreenElement) {
          await document.exitFullscreen();
        } else if (video.requestFullscreen) {
          await video.requestFullscreen();
        } else if (video.webkitEnterFullscreen) {
          video.webkitEnterFullscreen();
        }
      } catch {}
    });
  }

  /* =========================================================
     DOUBLE TAP LIKE
     ========================================================= */

  function setupDoubleTapLike() {
    let lastTap = 0;
    let lastTarget = null;

    document.addEventListener("click", (event) => {
      if (isInteractiveTarget(event.target)) return;

      const page = event.target.closest(".video-page");

      if (!page) return;

      const now = Date.now();

      if (
        lastTarget === page &&
        now - lastTap < 320
      ) {
        const likeButton = $(".like-btn", page);

        if (likeButton) {
          likeButton.click();
        }
      }

      lastTap = now;
      lastTarget = page;
    });
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
    const creator = getCreatorData(page);

    let panel = $("#zyloCreatorProfile");

    if (!panel) {
      panel = document.createElement("div");

      panel.id = "zyloCreatorProfile";
      panel.className = "zylo-profile-panel";

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

      document.body.appendChild(panel);

      $(".zylo-profile-close", panel)?.addEventListener(
        "click",
        () => panel.remove()
      );

      $(".zylo-profile-follow", panel)?.addEventListener(
        "click",
        () => {
          const follows = getStorage(
            CONFIG.STORAGE.FOLLOWS,
            []
          );

          const uid = panel.dataset.creatorUid;

          const index = follows.indexOf(uid);

          if (index >= 0) {
            follows.splice(index, 1);

            $(".zylo-profile-follow", panel).textContent =
              "Follow";
          } else {
            follows.push(uid);

            $(".zylo-profile-follow", panel).textContent =
              "Following";
          }

          setStorage(
            CONFIG.STORAGE.FOLLOWS,
            follows
          );
        }
      );
    }

    panel.dataset.creatorUid = creator.uid;

    $(".zylo-profile-name", panel).textContent =
      creator.username || "zylo_creator";

    $(".zylo-profile-handle", panel).textContent =
      `@${creator.username || "zylo_creator"}`;

    const follows = getStorage(
      CONFIG.STORAGE.FOLLOWS,
      []
    );

    $(".zylo-profile-follow", panel).textContent =
      follows.includes(creator.uid)
        ? "Following"
        : "Follow";

    const list = $(
      ".zylo-profile-video-list",
      panel
    );

    const creatorPages =
      VideoEngine
        .getPages()
        .filter((item) => {
          const data = getCreatorData(item);

          return data.uid === creator.uid;
        });

    list.innerHTML = "";

    creatorPages.forEach((item) => {
      const thumb =
        document.createElement("div");

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

      list.appendChild(thumb);
    });

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
          button.closest(".video-page");

        if (page) {
          showCreatorProfile(page);
        }
      }
    );
  }

  /* =========================================================
     BOTTOM NAV / TOP NAV
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
          /*
           * auth.js owns the real
           * Account/Profile screen.
           */

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

    pages.forEach((page) => {
      if (type === "for-you") {
        page.hidden = false;
        page.style.display = "";

        return;
      }

      const creator =
        getCreatorData(page);

      const follows =
        getStorage(
          CONFIG.STORAGE.FOLLOWS,
          []
        );

      const following =
        follows.includes(
          creator.uid
        );

      page.hidden = !following;

      page.style.display =
        following
          ? ""
          : "none";
    });

    VideoEngine.refresh();

    window.setTimeout(() => {
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

    if (overlay) return overlay;

    overlay =
      document.createElement("div");

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

      results.appendChild(item);
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

        window.setTimeout(() => {
          $(
            ".zylo-search-input",
            overlay
          )?.focus();
        }, 50);
      }
    );
  }

  /* =========================================================
     CREATE / UPLOAD
     ========================================================= */

  function getUploadBox() {
    return (
      $("#uploadBox") ||
      $(".upload-box")
    );
  }

  let uploadState = {
    file: null,
    previewURL: "",
    caption: "",
    hashtags: "",
    privacy: "Everyone",

    allowComments: true,
    allowSave: true,
    allowShare: true,

    busy: false
  };

  function ensureUploadStyles() {
    if ($("#zylo-upload-styles")) {
      return;
    }

    const style =
      document.createElement(
        "style"
      );

    style.id =
      "zylo-upload-styles";

    style.textContent = `
      #zyloUploadStudio{
        position:fixed;
        inset:0;
        z-index:99999;
        display:flex;
        align-items:center;
        justify-content:center;
        padding:16px;
        background:rgba(0,0,0,.72);
        box-sizing:border-box;
        font-family:inherit;
      }

      #zyloUploadStudio *{
        box-sizing:border-box;
      }

      .zylo-upload-card{
        width:min(560px,100%);
        max-height:94dvh;
        overflow:auto;
        background:#fff;
        color:#111;
        border-radius:20px;
        padding:18px;
        box-shadow:
          0 20px 70px
          rgba(0,0,0,.35);
      }

      .zylo-upload-head{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:12px;
        margin-bottom:14px;
      }

      .zylo-upload-head h2{
        margin:0;
        font-size:21px;
      }

      .zylo-upload-x{
        border:0;
        background:transparent;
        font-size:30px;
        line-height:1;
        cursor:pointer;
        padding:2px 8px;
      }

      .zylo-upload-preview{
        width:100%;
        aspect-ratio:9/16;
        background:#111;
        border-radius:14px;
        overflow:hidden;
        display:flex;
        align-items:center;
        justify-content:center;
        margin-bottom:14px;
        position:relative;
      }

      .zylo-upload-preview video{
        width:100%;
        height:100%;
        object-fit:cover;
        display:block;
      }

      .zylo-upload-placeholder{
        color:#fff;
        text-align:center;
        padding:20px;
      }

      .zylo-upload-row{
        display:grid;
        grid-template-columns:1fr 1fr;
        gap:10px;
      }

      .zylo-upload-field{
        margin:10px 0;
      }

      .zylo-upload-field label{
        display:block;
        font-size:13px;
        font-weight:700;
        margin-bottom:6px;
      }

      .zylo-upload-field input,
      .zylo-upload-field textarea,
      .zylo-upload-field select{
        width:100%;
        border:1px solid #ddd;
        border-radius:11px;
        padding:11px 12px;
        font:inherit;
        outline:none;
        background:#fff;
      }

      .zylo-upload-field textarea{
        min-height:82px;
        resize:vertical;
      }

      .zylo-upload-options{
        border-top:1px solid #eee;
        border-bottom:1px solid #eee;
        margin:12px 0;
        padding:7px 0;
      }

      .zylo-upload-option{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:12px;
        padding:10px 0;
        font-size:14px;
      }

      .zylo-upload-option input{
        width:19px;
        height:19px;
      }

      .zylo-upload-actions{
        display:flex;
        gap:10px;
        margin-top:14px;
      }

      .zylo-upload-btn{
        flex:1;
        border:0;
        border-radius:12px;
        padding:12px 14px;
        font-weight:800;
        cursor:pointer;
        font-size:15px;
      }

      .zylo-upload-secondary{
        background:#eee;
        color:#111;
      }

      .zylo-upload-primary{
        background:#111;
        color:#fff;
      }

      .zylo-upload-primary:disabled{
        opacity:.55;
        cursor:not-allowed;
      }

      .zylo-upload-status{
        font-size:13px;
        text-align:center;
        min-height:18px;
        margin-top:9px;
        color:#666;
      }

      .zylo-upload-progress{
        height:5px;
        border-radius:999px;
        background:#eee;
        overflow:hidden;
        margin-top:7px;
        display:none;
      }

      .zylo-upload-progress span{
        display:block;
        height:100%;
        width:0%;
        background:#111;
        transition:
          width .2s ease;
      }

      @media(max-width:520px){

        #zyloUploadStudio{
          padding:8px;
        }

        .zylo-upload-card{
          max-height:98dvh;
          border-radius:16px;
          padding:14px;
        }

        .zylo-upload-row{
          grid-template-columns:1fr;
        }

        .zylo-upload-preview{
          aspect-ratio:9/14;
        }
      }
    `;

    document.head.appendChild(
      style
    );
  }

  function openUploadBox() {
    ensureUploadStyles();

    const old =
      $("#zyloUploadStudio");

    if (old) {
      old.remove();
    }

    const nativeInput =
      $("#videoInput");

    uploadState = {
      file: null,
      previewURL: "",
      caption: "",
      hashtags: "",
      privacy: "Everyone",

      allowComments: true,
      allowSave: true,
      allowShare: true,

      busy: false
    };

    const studio =
      document.createElement(
        "div"
      );

    studio.id =
      "zyloUploadStudio";

    studio.innerHTML = `
      <div
        class="zylo-upload-card"
        role="dialog"
        aria-modal="true"
        aria-label="Create a post"
      >

        <div class="zylo-upload-head">

          <h2>Create a post</h2>

          <button
            type="button"
            class="zylo-upload-x"
            data-upload-close
            aria-label="Close"
          >
            ×
          </button>

        </div>

        <div
          class="zylo-upload-preview"
          id="zyloUploadPreview"
        >
          <div class="zylo-upload-placeholder">
            Choose a video to preview it here
          </div>
        </div>

        <div class="zylo-upload-row">

          <button
            type="button"
            class="zylo-upload-btn zylo-upload-secondary"
            id="zyloChooseVideo"
          >
            Choose video
          </button>

          <select
            id="zyloUploadPrivacy"
            aria-label="Privacy"
          >
            <option>Everyone</option>
            <option>Friends</option>
            <option>Only me</option>
          </select>

        </div>

        <div class="zylo-upload-field">

          <label for="zyloUploadCaption">
            Caption
          </label>

          <textarea
            id="zyloUploadCaption"
            maxlength="2200"
            placeholder="Describe your video..."
          ></textarea>

        </div>

        <div class="zylo-upload-field">

          <label for="zyloUploadHashtags">
            Hashtags
          </label>

          <input
            id="zyloUploadHashtags"
            maxlength="300"
            placeholder="#ZYLO #ShortVideo #Create"
          />

        </div>

        <div class="zylo-upload-options">

          <label class="zylo-upload-option">
            <span>Allow comments</span>

            <input
              id="zyloAllowComments"
              type="checkbox"
              checked
            />
          </label>

          <label class="zylo-upload-option">
            <span>Allow saving</span>

            <input
              id="zyloAllowSave"
              type="checkbox"
              checked
            />
          </label>

          <label class="zylo-upload-option">
            <span>Allow sharing</span>

            <input
              id="zyloAllowShare"
              type="checkbox"
              checked
            />
          </label>

        </div>

        <div class="zylo-upload-actions">

          <button
            type="button"
            class="zylo-upload-btn zylo-upload-secondary"
            data-upload-close
          >
            Cancel
          </button>

          <button
            type="button"
            class="zylo-upload-btn zylo-upload-primary"
            id="zyloPostVideo"
            disabled
          >
            Post
          </button>

        </div>

        <div
          class="zylo-upload-status"
          id="zyloUploadStatus"
        ></div>

        <div
          class="zylo-upload-progress"
          id="zyloUploadProgress"
        >
          <span></span>
        </div>

      </div>
    `;

    document.body.appendChild(
      studio
    );

    const preview =
      $("#zyloUploadPreview", studio);

    const postButton =
      $("#zyloPostVideo", studio);

    const status =
      $("#zyloUploadStatus", studio);

    const progress =
      $("#zyloUploadProgress", studio);

    const progressBar =
      $("span", progress);

    function updatePostButton() {
      postButton.disabled =
        !uploadState.file ||
        uploadState.busy;
    }

    function chooseVideo() {
      if (nativeInput) {
        nativeInput.value = "";
        nativeInput.click();
      }
    }

    $(
      "#zyloChooseVideo",
      studio
    )?.addEventListener(
      "click",
      chooseVideo
    );

    $(
      "#zyloUploadCaption",
      studio
    )?.addEventListener(
      "input",
      (event) => {
        uploadState.caption =
          event.target.value;
      }
    );

    $(
      "#zyloUploadHashtags",
      studio
    )?.addEventListener(
      "input",
      (event) => {
        uploadState.hashtags =
          event.target.value;
      }
    );

    $(
      "#zyloUploadPrivacy",
      studio
    )?.addEventListener(
      "change",
      (event) => {
        uploadState.privacy =
          event.target.value;
      }
    );

    $(
      "#zyloAllowComments",
      studio
    )?.addEventListener(
      "change",
      (event) => {
        uploadState.allowComments =
          event.target.checked;
      }
    );

    $(
      "#zyloAllowSave",
      studio
    )?.addEventListener(
      "change",
      (event) => {
        uploadState.allowSave =
          event.target.checked;
      }
    );

    $(
      "#zyloAllowShare",
      studio
    )?.addEventListener(
      "change",
      (event) => {
        uploadState.allowShare =
          event.target.checked;
      }
    );

    $(
      "[data-upload-close]",
      studio
    )?.addEventListener(
      "click",
      closeUploadBox
    );

    studio.addEventListener(
      "click",
      (event) => {
        if (
          event.target === studio &&
          !uploadState.busy
        ) {
          closeUploadBox();
        }
      }
    );

    postButton.addEventListener(
      "click",
      async () => {
        if (
          !uploadState.file ||
          uploadState.busy
        ) {
          return;
        }

        uploadState.busy =
          true;

        updatePostButton();

        status.textContent =
          "Uploading video…";

        progress.style.display =
          "block";

        progressBar.style.width =
          "15%";

        try {
          await uploadVideo(
            uploadState.file,
            {
              caption:
                uploadState.caption,

              hashtags:
                uploadState.hashtags,

              privacy:
                uploadState.privacy,

              allowComments:
                uploadState.allowComments,

              allowSave:
                uploadState.allowSave,

              allowShare:
                uploadState.allowShare,

              onProgress:
                (value) => {
                  progressBar.style.width =
                    `${Math.max(
                      15,
                      Math.min(
                        95,
                        value
                      )
                    )}%`;
                }
            }
          );

          progressBar.style.width =
            "100%";

          status.textContent =
            "Posted successfully";
        } catch (error) {
          console.error(
            "ZYLO upload failed:",
            error
          );

          uploadState.busy =
            false;

          updatePostButton();

          status.textContent =
            error?.message ||
            "Upload failed. Please try again.";

          progressBar.style.width =
            "0%";
        }
      }
    );

    if (nativeInput) {
      nativeInput.value = "";
    }

    updatePostButton();
  }

  function closeUploadBox() {
    const studio =
      $("#zyloUploadStudio");

    if (studio) {
      if (uploadState.busy) {
        return;
      }

      studio.remove();
    }

    const box =
      getUploadBox();

    if (box) {
      box.classList.remove(
        "open",
        "active"
      );

      box.hidden = true;

      box.style.display =
        "none";
    }

    if (
      uploadState.previewURL
    ) {
      try {
        URL.revokeObjectURL(
          uploadState.previewURL
        );
      } catch {}
    }

    uploadState.previewURL =
      "";

    uploadState.file =
      null;
  }

  function setupUploadCloseButtons() {
    document.addEventListener(
      "click",
      (event) => {
        if (
          event.target.closest(
            "#closeUpload," +
              ".close-upload," +
              ".upload-close," +
              "[data-close-upload]"
          )
        ) {
          event.preventDefault();

          closeUploadBox();
        }
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

  function setUploadedPageText(
    page,
    data
  ) {
    const username =
      data.username ||
      getUsername();

    const title =
      data.caption ||
      data.name ||
      "ZYLO video";

    const hashtags =
      data.hashtags ||
      "#ZYLO #ShortVideo #Create";

    const selectors = [
      ".username",
      ".creator-name",
      ".video-username",
      "[data-username]"
    ];

    for (
      const selector of selectors
    ) {
      const el =
        $(selector, page);

      if (el) {
        el.textContent =
          `@${username.replace(
            /^@/,
            ""
          )}`;

        break;
      }
    }

    const titleSelectors = [
      ".description",
      ".video-description",
      ".caption",
      ".video-title"
    ];

    for (
      const selector of titleSelectors
    ) {
      const el =
        $(selector, page);

      if (el) {
        el.textContent =
          title;

        break;
      }
    }

    const hashSelectors = [
      ".hashtags",
      ".video-hashtags",
      "[data-hashtags]"
    ];

    for (
      const selector of hashSelectors
    ) {
      const el =
        $(selector, page);

      if (el) {
        el.textContent =
          hashtags;

        break;
      }
    }

    page.dataset.title =
      title;

    page.dataset.description =
      `${title} ${hashtags}`;

    page.dataset.privacy =
      data.privacy ||
      "Everyone";

    page.dataset.allowComments =
      String(
        data.allowComments !== false
      );

    page.dataset.allowSave =
      String(
        data.allowSave !== false
      );

    page.dataset.allowShare =
      String(
        data.allowShare !== false
      );
  }

  function createUploadedPage(
    data
  ) {
    const feed =
      getFeed();

    if (!feed) return null;

    /*
     * Clone the existing video page.
     *
     * This keeps the exact existing
     * SVG action buttons and locked UI.
     */
    const template =
      $(".video-page", feed);

    const page = template
      ? template.cloneNode(true)
      : document.createElement(
          "section"
        );

    page.className =
      "video-page";

    page.classList.remove(
      "active"
    );

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

    page.dataset.active =
      "false";

    const video =
      $("video", page);

    if (!video) {
      return null;
    }

    const source =
      data.url ||
      data.serverURL ||
      "";

    video.pause();

    video.removeAttribute(
      "loop"
    );

    video.loop = false;

    video.src =
      source;

    video.muted = true;

    video.playsInline =
      true;

    video.setAttribute(
      "playsinline",
      ""
    );

    video.setAttribute(
      "muted",
      ""
    );

    video.preload =
      "metadata";

    video.removeAttribute(
      "autoplay"
    );

    setUploadedPageText(
      page,
      data
    );

    feed.appendChild(
      page
    );

    return page;
  }

  async function uploadVideo(
    file,
    options = {}
  ) {
    if (!file) {
      throw new Error(
        "Please select a video."
      );
    }

    if (
      !file.type.startsWith(
        "video/"
      )
    ) {
      throw new Error(
        "Please select a video file."
      );
    }

    if (
      file.size >
      200 *
        1024 *
        1024
    ) {
      throw new Error(
        "Video must be 200 MB or smaller."
      );
    }

    const uid =
      getUserUID();

    const username =
      getUsername();

    const localURL =
      URL.createObjectURL(
        file
      );

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

    formData.append(
      "caption",
      options.caption ||
        ""
    );

    formData.append(
      "hashtags",
      options.hashtags ||
        ""
    );

    formData.append(
      "privacy",
      options.privacy ||
        "Everyone"
    );

    formData.append(
      "allowComments",
      String(
        options.allowComments !==
          false
      )
    );

    formData.append(
      "allowSave",
      String(
        options.allowSave !==
          false
      )
    );

    formData.append(
      "allowShare",
      String(
        options.allowShare !==
          false
      )
    );

    let serverURL =
      "";

    let serverVideoId =
      "";

    try {
      const result =
        await new Promise(
          (
            resolve,
            reject
          ) => {
            const xhr =
              new XMLHttpRequest();

            xhr.open(
              "POST",
              `${CONFIG.API_BASE_URL}/api/upload`,
              true
            );

            xhr.responseType =
              "json";

            xhr.upload.onprogress =
              (event) => {
                if (
                  event.lengthComputable &&
                  typeof options.onProgress ===
                    "function"
                ) {
                  options.onProgress(
                    (event.loaded /
                      event.total) *
                      100
                  );
                }
              };

            xhr.onload =
              () => {
                let body =
                  xhr.response;

                if (!body) {
                  try {
                    body =
                      JSON.parse(
                        xhr.responseText ||
                          "{}"
                      );
                  } catch {
                    body = {};
                  }
                }

                if (
                  xhr.status >=
                    200 &&
                  xhr.status <
                    300
                ) {
                  resolve(
                    body
                  );
                } else {
                  reject(
                    new Error(
                      body?.message ||
                        `Upload failed (${xhr.status})`
                    )
                  );
                }
              };

            xhr.onerror =
              () => {
                reject(
                  new Error(
                    "Network error while uploading."
                  )
                );
              };

            xhr.onabort =
              () => {
                reject(
                  new Error(
                    "Upload cancelled."
                  )
                );
              };

            xhr.send(
              formData
            );
          }
        );

      serverURL =
        result?.url ||
        result?.videoUrl ||
        result?.video?.url ||
        "";

      serverVideoId =
        result?.videoId ||
        result?.video?.videoId ||
        "";

      if (!serverURL) {
        throw new Error(
          "Server did not return a video URL."
        );
      }
    } catch (error) {
      URL.revokeObjectURL(
        localURL
      );

      throw error;
    }

    const videoData = {
      id:
        serverVideoId ||
        makeId("video"),

      uid,

      username,

      name:
        file.name,

      url:
        serverURL,

      serverURL,

      caption:
        String(
          options.caption ||
            ""
        ).trim(),

      hashtags:
        String(
          options.hashtags ||
            ""
        ).trim(),

      privacy:
        options.privacy ||
        "Everyone",

      allowComments:
        options.allowComments !==
        false,

      allowSave:
        options.allowSave !==
        false,

      allowShare:
        options.allowShare !==
        false,

      createdAt:
        Date.now()
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

    URL.revokeObjectURL(
      localURL
    );

    closeUploadBox();

    return videoData;
  }

  function previewUploadFile(
    file
  ) {
    const studio =
      $("#zyloUploadStudio");

    const preview =
      $("#zyloUploadPreview", studio);

    const postButton =
      $("#zyloPostVideo", studio);

    if (
      !studio ||
      !preview ||
      !file
    ) {
      return;
    }

    if (
      !file.type.startsWith(
        "video/"
      )
    ) {
      preview.innerHTML = `
        <div class="zylo-upload-placeholder">
          Please choose a video file.
        </div>
      `;

      uploadState.file =
        null;

      if (postButton) {
        postButton.disabled =
          true;
      }

      return;
    }

    if (
      uploadState.previewURL
    ) {
      try {
        URL.revokeObjectURL(
          uploadState.previewURL
        );
      } catch {}
    }

    uploadState.file =
      file;

    uploadState.previewURL =
      URL.createObjectURL(
        file
      );

    preview.innerHTML = `
      <video
        src="${escapeHTML(
          uploadState.previewURL
        )}"
        muted
        playsinline
        controls
      ></video>
    `;

    if (postButton) {
      postButton.disabled =
        false;
    }
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

        if (
          $("#zyloUploadStudio")
        ) {
          previewUploadFile(
            file
          );
        } else {
          openUploadBox();

          window.setTimeout(
            () => {
              previewUploadFile(
                file
              );
            },
            0
          );
        }

        input.value = "";
      }
    );
  }

  /* =========================================================
     VIDEO CLICK = PLAY / PAUSE
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
     RESTORE UPLOADED VIDEOS
     ========================================================= */

  function restoreUploadedVideos() {
    const feed =
      getFeed();

    if (!feed) return;

    const uploads =
      getStorage(
        CONFIG.STORAGE
          .UPLOADED_VIDEOS,
        []
      );

    if (
      !Array.isArray(
        uploads
      )
    ) {
      return;
    }

    /*
     * Avoid duplicate pages.
     */

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
      .forEach(
        (data) => {
          if (!data?.id) {
            return;
          }

          if (
            existingIds.has(
              data.id
            )
          ) {
            return;
          }

          /*
           * Old blob URLs cannot survive
           * a page reload.
           *
           * Only restore server URLs.
           */
          const source =
            data.serverURL ||
            data.url ||
            "";

          if (
            !source ||
            source.startsWith(
              "blob:"
            )
          ) {
            return;
          }

          createUploadedPage({
            ...data,
            url: source
          });

          existingIds.add(
            data.id
          );
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
      }
    );

    console.log(
      "ZYLO frontend initialized"
    );
  }

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
