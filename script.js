
.../* =========================================================
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

      if (!feed) {
        return [];
      }

      return $$(".video-page", feed);
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
       * IMPORTANT:
       * loop must be OFF so ended event can fire.
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

      if (!primary) {
        return false;
      }

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

        if (!fallback) {
          return;
        }

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
        if (autoNextLock) {
          return;
        }

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
      if (!pages.length) {
        return;
      }

      pages.forEach((page, i) => {
        const video = getVideo(page);

        if (!video) {
          return;
        }

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

        if (!video || video === exceptVideo) {
          return;
        }

        try {
          video.pause();
        } catch {}

        video.dataset.zyloActive = "false";
        video.dataset.zyloPlaying = "false";
      });
    }

    async function playVideo(video) {
      if (!video) {
        return false;
      }

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

      if (!pages.length) {
        return;
      }

      index = Math.max(
        0,
        Math.min(index, pages.length - 1)
      );

      const page = pages[index];
      const video = getVideo(page);

      if (!page) {
        return;
      }

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
      if (!feed || !pages.length) {
        return -1;
      }

      const feedRect = feed.getBoundingClientRect();

      const feedCenter =
        feedRect.top + feedRect.height / 2;

      let bestIndex = 0;
      let bestDistance = Infinity;

      pages.forEach((page, index) => {
        const rect = page.getBoundingClientRect();

        const center =
          rect.top + rect.height / 2;

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

      if (!pages.length) {
        return;
      }

      index = Math.max(
        0,
        Math.min(index, pages.length - 1)
      );

      const page = pages[index];

      if (!page) {
        return;
      }

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

      const nextIndex = current + 1;

      if (nextIndex >= pages.length) {
        if (fromEnded) {
          console.log(
            "ZYLO: শেষ ভিডিওতে পৌঁছেছে"
          );
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

      scrollToPage(
        nextIndex,
        "smooth"
      );

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

      if (!pages.length) {
        return;
      }

      const current =
        activeIndex >= 0
          ? activeIndex
          : findNearestIndex();

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

      const delta = event.deltaY;

      if (Math.abs(delta) < 12) {
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
      if (!touching) {
        return;
      }

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
      if (!feed) {
        return;
      }

      clearTimeout(scrollTimer);

      scrollTimer = window.setTimeout(() => {
        const index =
          findNearestIndex();

        if (
          index < 0 ||
          index === activeIndex
        ) {
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

            if (!best) {
              return;
            }

            const page = best.target;

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
              0.65,
              0.8,
              1
            ]
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
        return;
      }

      feed.addEventListener(
        "wheel",
        handleWheel,
        { passive: false }
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

      observer =
        new MutationObserver(() => {
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

  function updateURL(
    page,
    enabled = true
  ) {
    if (!enabled || !page) {
      return;
    }

    const id = page.dataset.videoId;

    if (!id) {
      return;
    }

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

    if (!page) {
      return;
    }

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
      button?.closest?.(".video-page");

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
    if (!button) {
      return;
    }

    const label =
      $(".action-count,.count,.action-number", button);

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
      getVideoIdFromButton(button);

    if (!id) {
      return;
    }

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

        if (!text) {
          return;
        }

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

        if (!button) {
          return;
        }

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
      `${window.location.origin}${window.location.pathname}` +
      `#video-${encodeURIComponent(id)}`;

    try {
      if (navigator.share) {
        await navigator.share({
          title: "ZYLO",
          text: "Watch this video on ZYLO",
          url
        });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(
          url
        );

        button.classList.add(
          "active"
        );

        window.setTimeout(
          () =>
            button.classList.remove(
              "active"
            ),
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

        if (!button) {
          return;
        }

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

        if (!button) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();

        button.classList.toggle(
          "active"
        );

        const page =
          button.closest(".video-page");

        if (page) {
          page.classList.toggle(
            "music-active"
          );
        }
      }
    );
  }

  /* =========================================================
     FULLSCREEN
     ========================================================= */

  async function enterFullscreen(element) {
    if (!element) {
      return;
    }

    try {
      if (element.requestFullscreen) {
        await element.requestFullscreen();
        return;
      }

      if (element.webkitRequestFullscreen) {
        element.webkitRequestFullscreen();
        return;
      }

      if (element.webkitEnterFullscreen) {
        element.webkitEnterFullscreen();
      }
    } catch (error) {
      console.warn(
        "ZYLO fullscreen error:",
        error
      );
    }
  }

  function setupFullscreenButtons() {
    document.addEventListener(
      "click",
      (event) => {
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

        enterFullscreen(
          video || page
        );
      }
    );
  }

  /* =========================================================
     PROFILE
     ========================================================= */

  function getCreatorFromPage(page) {
    if (!page) {
      return {
        uid: "",
        username: "zylo_creator"
      };
    }

    return {
      uid:
        page.dataset.creatorUid ||
        page.dataset.uid ||
        "creator",

      username:
        page.dataset.creatorUsername ||
        page.dataset.username ||
        $(".username", page)?.textContent?.trim() ||
        "zylo_creator"
    };
  }

  function getFollowSet() {
    const value =
      getStorage(
        CONFIG.STORAGE.FOLLOWS,
        []
      );

    return Array.isArray(value)
      ? value
      : [];
  }

  function setFollowSet(value) {
    setStorage(
      CONFIG.STORAGE.FOLLOWS,
      value
    );
  }

  function openCreatorProfile(page) {
    if (!page) {
      return;
    }

    const creator =
      getCreatorFromPage(page);

    const videos =
      VideoEngine
        .getPages()
        .filter((item) => {
          const data =
            getCreatorFromPage(item);

          return (
            data.uid === creator.uid ||
            data.username === creator.username
          );
        });

    const followSet =
      getFollowSet();

    const isFollowing =
      followSet.includes(
        creator.uid
      );

    const panel =
      document.createElement(
        "div"
      );

    panel.className =
      "zylo-creator-profile";

    panel.dataset.zyloGenerated =
      "true";

    panel.innerHTML = `
      <div class="zylo-profile-inner">

        <button
          type="button"
          class="zylo-profile-close"
        >
          ×
        </button>

        <div class="zylo-profile-avatar">
          Z
        </div>

        <h2>
          ${escapeHTML(
            creator.username
          )}
        </h2>

        <div class="zylo-profile-stats">
          <span>
            <strong>${videos.length}</strong>
            Videos
          </span>

          <span>
            <strong>0</strong>
            Followers
          </span>

          <span>
            <strong>0</strong>
            Following
          </span>
        </div>

        <button
          type="button"
          class="zylo-follow-button ${
            isFollowing
              ? "following"
              : ""
          }"
        >
          ${
            isFollowing
              ? "Following"
              : "Follow"
          }
        </button>

        <div class="zylo-profile-videos">
          ${
            videos.length
              ? videos
                  .map(
                    (videoPage) => {
                      const video =
                        $("video", videoPage);

                      const source =
                        captureVideoSource(
                          video
                        );

                      return `
                        <button
                          type="button"
                          class="zylo-profile-video"
                          data-video-id="${
                            escapeHTML(
                              videoPage.dataset.videoId ||
                                ""
                            )
                          }"
                        >
                          <span>
                            ${
                              escapeHTML(
                                source.split("/").pop() ||
                                  "Video"
                              )
                            }
                          </span>
                        </button>
                      `;
                    }
                  )
                  .join("")
              : `
                <div class="zylo-profile-empty">
                  No videos yet.
                </div>
              `
          }
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

    $(".zylo-follow-button", panel)
      ?.addEventListener(
        "click",
        () => {
          const follows =
            getFollowSet();

          const index =
            follows.indexOf(
              creator.uid
            );

          if (index >= 0) {
            follows.splice(index, 1);
          } else {
            follows.push(
              creator.uid
            );
          }

          setFollowSet(
            follows
          );

          const following =
            follows.includes(
              creator.uid
            );

          const button =
            $(".zylo-follow-button", panel);

          if (button) {
            button.textContent =
              following
                ? "Following"
                : "Follow";

            button.classList.toggle(
              "following",
              following
            );
          }
        }
      );

    $$(".zylo-profile-video", panel)
      .forEach((videoButton) => {
        videoButton.addEventListener(
          "click",
          () => {
            const videoId =
              videoButton.dataset.videoId;

            const pages =
              VideoEngine.getPages();

            const target =
              pages.find(
                (item) =>
                  item.dataset.videoId ===
                  videoId
              );

            const index =
              pages.indexOf(target);

            panel.remove();

            if (index >= 0) {
              VideoEngine.scrollToPage(
                index,
                "smooth"
              );
            }
          }
        );
      });
  }

  function setupProfileButtons() {
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

        openCreatorProfile(
          page
        );
      }
    );
  }

  /* =========================================================
     SEARCH
     ========================================================= */

  function collectSearchData() {
    return VideoEngine
      .getPages()
      .map((page, index) => {
        const video =
          $("video", page);

        const creator =
          getCreatorFromPage(page);

        return {
          page,
          index,
          videoId:
            page.dataset.videoId ||
            `video_${index}`,

          username:
            creator.username,

          uid:
            creator.uid,

          title:
            page.dataset.title ||
            $(".video-description", page)
              ?.textContent ||
            "",

          description:
            page.dataset.description ||
            $(".video-description", page)
              ?.textContent ||
            "",

          hashtags:
            page.dataset.hashtags ||
            "",

          source:
            captureVideoSource(video)
        };
      });
  }

  function createSearchPanel() {
    const existing =
      $(".zylo-search-panel");

    if (existing) {
      existing.remove();
      return;
    }

    const panel =
      document.createElement(
        "div"
      );

    panel.className =
      "zylo-search-panel";

    panel.dataset.zyloGenerated =
      "true";

    panel.innerHTML = `
      <div class="zylo-search-inner">

        <div class="zylo-search-header">

          <strong>Search ZYLO</strong>

          <button
            type="button"
            class="zylo-search-close"
          >
            ×
          </button>

        </div>

        <form
          class="zylo-search-form"
        >

          <input
            type="search"
            placeholder="Search videos or creators..."
            autocomplete="off"
          />

          <button type="submit">
            Search
          </button>

        </form>

        <div
          class="zylo-search-results"
        ></div>

      </div>
    `;

    document.body.appendChild(
      panel
    );

    const form =
      $(".zylo-search-form", panel);

    const input =
      $("input", form);

    const results =
      $(".zylo-search-results", panel);

    $(".zylo-search-close", panel)
      ?.addEventListener(
        "click",
        () => panel.remove()
      );

    form.addEventListener(
      "submit",
      (event) => {
        event.preventDefault();

        const query =
          input.value
            .trim()
            .toLowerCase();

        if (!query) {
          results.innerHTML =
            `
              <div class="zylo-search-empty">
                Type something to search.
              </div>
            `;

          return;
        }

        const data =
          collectSearchData();

        const matches =
          data.filter((item) => {
            const haystack =
              [
                item.username,
                item.title,
                item.description,
                item.hashtags,
                item.videoId
              ]
                .join(" ")
                .toLowerCase();

            return haystack.includes(
              query
            );
          });

        if (!matches.length) {
          results.innerHTML =
            `
              <div class="zylo-search-empty">
                No results found.
              </div>
            `;

          return;
        }

        results.innerHTML =
          matches
            .map(
              (item) => `
                <button
                  type="button"
                  class="zylo-search-result"
                  data-index="${item.index}"
                >
                  <strong>
                    ${escapeHTML(
                      item.username
                    )}
                  </strong>

                  <span>
                    ${escapeHTML(
                      item.description ||
                        item.title ||
                        "ZYLO video"
                    )}
                  </span>
                </button>
              `
            )
            .join("");

        $$(".zylo-search-result", results)
          .forEach((resultButton) => {
            resultButton.addEventListener(
              "click",
              () => {
                const index =
                  Number(
                    resultButton.dataset.index
                  );

                panel.remove();

                VideoEngine.scrollToPage(
                  index,
                  "smooth"
                );
              }
            );
          });
      }
    );

    input.focus();
  }

  function setupSearchButton() {
    document.addEventListener(
      "click",
      (event) => {
        const button =
          event.target.closest(
            ".search-btn,[data-search]"
          );

        if (!button) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();

        createSearchPanel();
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
        const item =
          event.target.closest(
            ".nav-item"
          );

        if (!item) {
          return;
        }

        /*
         * Create button is handled separately
         * in capture phase.
         */
        if (
          item.id === "createBtn" ||
          item.classList.contains(
            "create-btn"
          )
        ) {
          return;
        }

        const nav =
          item.dataset.nav ||
          item.getAttribute(
            "data-nav"
          );

        if (!nav) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();

        $$(".nav-item").forEach(
          (navItem) => {
            navItem.classList.toggle(
              "active",
              navItem === item
            );
          }
        );

        if (nav === "home") {
          closeAllGeneratedPanels();

          const pages =
            VideoEngine.getPages();

          if (pages.length) {
            VideoEngine.scrollToPage(
              0,
              "smooth"
            );
          }

          return;
        }

        if (nav === "discover") {
          createSearchPanel();
          return;
        }

        if (nav === "inbox") {
          openInboxPanel();
          return;
        }

        if (nav === "profile") {
          openOwnProfile();
        }
      }
    );
  }

  function closeAllGeneratedPanels() {
    $$(
      "[data-zylo-generated],.zylo-search-panel," +
        ".zylo-creator-profile,.zylo-comment-panel," +
        ".zylo-inbox-panel,.zylo-own-profile"
    ).forEach((panel) => {
      try {
        panel.remove();
      } catch {}
    });

    closeCommentPanel();
  }

  /* =========================================================
     INBOX
     ========================================================= */

  function openInboxPanel() {
    const existing =
      $(".zylo-inbox-panel");

    if (existing) {
      existing.remove();
      return;
    }

    const panel =
      document.createElement(
        "div"
      );

    panel.className =
      "zylo-inbox-panel";

    panel.dataset.zyloGenerated =
      "true";

    panel.innerHTML = `
      <div class="zylo-inbox-inner">

        <div class="zylo-inbox-header">

          <strong>Inbox</strong>

          <button
            type="button"
            class="zylo-inbox-close"
          >
            ×
          </button>

        </div>

        <div class="zylo-inbox-list">

          <div class="zylo-inbox-item">
            <strong>Welcome to ZYLO</strong>
            <span>
              Your notifications will appear here.
            </span>
          </div>

          <div class="zylo-inbox-item">
            <strong>Creator updates</strong>
            <span>
              Follow creators to see their updates.
            </span>
          </div>

        </div>

      </div>
    `;

    document.body.appendChild(
      panel
    );

    $(".zylo-inbox-close", panel)
      ?.addEventListener(
        "click",
        () => panel.remove()
      );
  }

  /* =========================================================
     OWN PROFILE
     ========================================================= */

  function getOwnVideos() {
    const uid =
      getUserUID();

    const username =
      getUsername();

    return VideoEngine
      .getPages()
      .filter((page) => {
        const creator =
          getCreatorFromPage(page);

        return (
          creator.uid === uid ||
          creator.username === username
        );
      });
  }

  function openOwnProfile() {
    const existing =
      $(".zylo-own-profile");

    if (existing) {
      existing.remove();
      return;
    }

    const ownVideos =
      getOwnVideos();

    const panel =
      document.createElement(
        "div"
      );

    panel.className =
      "zylo-own-profile";

    panel.dataset.zyloGenerated =
      "true";

    panel.innerHTML = `
      <div class="zylo-own-profile-inner">

        <button
          type="button"
          class="zylo-own-profile-close"
        >
          ×
        </button>

        <div class="zylo-profile-avatar">
          Z
        </div>

        <h2>
          ${escapeHTML(
            getUsername()
          )}
        </h2>

        <div class="zylo-profile-stats">

          <span>
            <strong>
              ${ownVideos.length}
            </strong>
            Videos
          </span>

          <span>
            <strong>0</strong>
            Followers
          </span>

          <span>
            <strong>0</strong>
            Following
          </span>

        </div>

        <div class="zylo-profile-tabs">

          <button
            type="button"
            class="active"
          >
            Videos
          </button>

          <button
            type="button"
          >
            Saved
          </button>

          <button
            type="button"
          >
            Liked
          </button>

        </div>

        <div class="zylo-own-video-list">

          ${
            ownVideos.length
              ? ownVideos
                  .map(
                    (page, index) => `
                      <button
                        type="button"
                        class="zylo-own-video"
                        data-index="${VideoEngine
                          .getPages()
                          .indexOf(page)}"
                      >
                        Video ${
                          index + 1
                        }
                      </button>
                    `
                  )
                  .join("")
              : `
                <div class="zylo-profile-empty">
                  You haven't uploaded any videos yet.
                </div>
              `
          }

        </div>

      </div>
    `;

    document.body.appendChild(
      panel
    );

    $(".zylo-own-profile-close", panel)
      ?.addEventListener(
        "click",
        () => panel.remove()
      );

    $$(".zylo-own-video", panel)
      .forEach((button) => {
        button.addEventListener(
          "click",
          () => {
            const index =
              Number(
                button.dataset.index
              );

            panel.remove();

            if (
              Number.isFinite(index) &&
              index >= 0
            ) {
              VideoEngine.scrollToPage(
                index,
                "smooth"
              );
            }
          }
        );
      });
  }

  /* =========================================================
     UPLOAD SYSTEM - TIKTOK STYLE
     ========================================================= */

  function injectUploadStyles() {
    if (
      document.getElementById(
        "zylo-upload-styles"
      )
    ) {
      return;
    }

    const style =
      document.createElement(
        "style"
      );

    style.id =
      "zylo-upload-styles";

    style.textContent = `
      .zylo-upload-studio {
        position: fixed;
        inset: 0;
        z-index: 999999;
        background: rgba(0,0,0,.96);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 16px;
        box-sizing: border-box;
      }

      .zylo-upload-card {
        width: min(100%, 760px);
        max-height: 96dvh;
        overflow-y: auto;
        background: #111;
        color: #fff;
        border-radius: 18px;
        padding: 18px;
        box-sizing: border-box;
        box-shadow: 0 20px 70px rgba(0,0,0,.55);
      }

      .zylo-upload-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 14px;
      }

      .zylo-upload-header strong {
        font-size: 20px;
      }

      .zylo-upload-close {
        border: 0;
        background: transparent;
        color: #fff;
        font-size: 30px;
        line-height: 1;
        cursor: pointer;
      }

      .zylo-upload-preview {
        width: 100%;
        aspect-ratio: 9 / 16;
        max-height: 56dvh;
        background: #000;
        border-radius: 14px;
        overflow: hidden;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-bottom: 14px;
      }

      .zylo-upload-preview video {
        width: 100%;
        height: 100%;
        object-fit: contain;
      }

      .zylo-upload-placeholder {
        color: #aaa;
        text-align: center;
        padding: 20px;
      }

      .zylo-upload-file-row {
        display: flex;
        gap: 10px;
        margin-bottom: 14px;
      }

      .zylo-upload-file-btn,
      .zylo-upload-post-btn,
      .zylo-upload-cancel-btn {
        min-height: 46px;
        border-radius: 12px;
        border: 0;
        padding: 0 16px;
        cursor: pointer;
        font-weight: 700;
      }

      .zylo-upload-file-btn {
        background: #fff;
        color: #000;
        flex: 1;
      }

      .zylo-upload-post-btn {
        background: #fff;
        color: #000;
        flex: 1;
      }

      .zylo-upload-cancel-btn {
        background: #2a2a2a;
        color: #fff;
        flex: 1;
      }

      .zylo-upload-field {
        margin-bottom: 13px;
      }

      .zylo-upload-field label {
        display: block;
        margin-bottom: 7px;
        font-size: 13px;
        color: #bbb;
      }

      .zylo-upload-field textarea,
      .zylo-upload-field input,
      .zylo-upload-field select {
        width: 100%;
        box-sizing: border-box;
        border: 1px solid #333;
        background: #1a1a1a;
        color: #fff;
        border-radius: 11px;
        padding: 12px;
        outline: none;
      }

      .zylo-upload-field textarea {
        min-height: 90px;
        resize: vertical;
      }

      .zylo-upload-toggles {
        display: grid;
        gap: 9px;
        margin: 12px 0;
      }

      .zylo-upload-toggle {
        display: flex !important;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 10px 12px;
        background: #181818;
        border-radius: 11px;
      }

      .zylo-upload-toggle input {
        width: auto;
      }

      .zylo-upload-progress-wrap {
        display: none;
        margin-top: 12px;
      }

      .zylo-upload-progress-track {
        height: 7px;
        background: #292929;
        border-radius: 99px;
        overflow: hidden;
      }

      .zylo-upload-progress-bar {
        width: 0%;
        height: 100%;
        background: #fff;
        transition: width .15s linear;
      }

      .zylo-upload-status {
        min-height: 20px;
        margin-top: 8px;
        font-size: 13px;
        color: #bbb;
      }

      .zylo-upload-actions {
        display: flex;
        gap: 10px;
        margin-top: 15px;
      }

      @media (max-width: 520px) {
        .zylo-upload-card {
          padding: 13px;
          border-radius: 14px;
        }

        .zylo-upload-actions {
          flex-direction: column;
        }
      }
    `;

    document.head.appendChild(
      style
    );
  }

  let uploadPreviewURL = "";

  function revokeUploadPreview() {
    if (uploadPreviewURL) {
      try {
        URL.revokeObjectURL(
          uploadPreviewURL
        );
      } catch {}

      uploadPreviewURL = "";
    }
  }

  function openUploadBox() {
    injectUploadStyles();

    const old =
      $("#zyloUploadStudio");

    if (old) {
      old.remove();
    }

    const studio =
      document.createElement(
        "div"
      );

    studio.id =
      "zyloUploadStudio";

    studio.className =
      "zylo-upload-studio";

    studio.dataset.zyloGenerated =
      "true";

    studio.innerHTML = `
      <div class="zylo-upload-card">

        <div class="zylo-upload-header">

          <strong>
            Create on ZYLO
          </strong>

          <button
            type="button"
            class="zylo-upload-close"
            aria-label="Close"
          >
            ×
          </button>

        </div>

        <div class="zylo-upload-preview">

          <div
            class="zylo-upload-placeholder"
          >
            Select a video to preview
          </div>

        </div>

        <div class="zylo-upload-file-row">

          <button
            type="button"
            class="zylo-upload-file-btn"
          >
            Choose video
          </button>

        </div>

        <div class="zylo-upload-field">

          <label>
            Caption
          </label>

          <textarea
            class="zylo-upload-caption"
            maxlength="2200"
            placeholder="Describe your video..."
          ></textarea>

        </div>

        <div class="zylo-upload-field">

          <label>
            Hashtags
          </label>

          <input
            class="zylo-upload-hashtags"
            type="text"
            maxlength="500"
            placeholder="#zylo #video"
          />

        </div>

        <div class="zylo-upload-field">

          <label>
            Privacy
          </label>

          <select class="zylo-upload-privacy">

            <option value="public">
              Everyone
            </option>

            <option value="friends">
              Friends
            </option>

            <option value="private">
              Only me
            </option>

          </select>

        </div>

        <div class="zylo-upload-toggles">

          <label class="zylo-upload-toggle">
            <span>
              Allow comments
            </span>

            <input
              type="checkbox"
              class="zylo-upload-comments"
              checked
            />
          </label>

          <label class="zylo-upload-toggle">
            <span>
              Allow saving
            </span>

            <input
              type="checkbox"
              class="zylo-upload-save"
              checked
            />
          </label>

          <label class="zylo-upload-toggle">
            <span>
              Allow sharing
            </span>

            <input
              type="checkbox"
              class="zylo-upload-share"
              checked
            />
          </label>

        </div>

        <div
          class="zylo-upload-progress-wrap"
        >

          <div
            class="zylo-upload-progress-track"
          >
            <div
              class="zylo-upload-progress-bar"
            ></div>
          </div>

        </div>

        <div
          class="zylo-upload-status"
        ></div>

        <div class="zylo-upload-actions">

          <button
            type="button"
            class="zylo-upload-cancel-btn"
          >
            Cancel
          </button>

          <button
            type="button"
            class="zylo-upload-post-btn"
          >
            Post
          </button>

        </div>

      </div>
    `;

    document.body.appendChild(
      studio
    );

    const fileButton =
      $(".zylo-upload-file-btn", studio);

    const postButton =
      $(".zylo-upload-post-btn", studio);

    const cancelButton =
      $(".zylo-upload-cancel-btn", studio);

    const closeButton =
      $(".zylo-upload-close", studio);

    const status =
      $(".zylo-upload-status", studio);

    const preview =
      $(".zylo-upload-preview", studio);

    const progressWrap =
      $(".zylo-upload-progress-wrap", studio);

    const progressBar =
      $(".zylo-upload-progress-bar", studio);

    let selectedFile = null;

    const hiddenInput =
      $("#videoInput") ||
      createFallbackVideoInput();

    fileButton.addEventListener(
      "click",
      () => {
        hiddenInput.value = "";
        hiddenInput.click();
      }
    );

    hiddenInput.addEventListener(
      "change",
      () => {
        const file =
          hiddenInput.files?.[0];

        if (!file) {
          return;
        }

        selectedFile = file;

        previewUploadFile(
          file,
          preview,
          status
        );
      },
      { once: true }
    );

    const close = () => {
      revokeUploadPreview();

      studio.remove();
    };

    closeButton.addEventListener(
      "click",
      close
    );

    cancelButton.addEventListener(
      "click",
      close
    );

    postButton.addEventListener(
      "click",
      async () => {
        if (!selectedFile) {
          status.textContent =
            "Please choose a video first.";

          return;
        }

        const caption =
          $(".zylo-upload-caption", studio)
            ?.value
            ?.trim() || "";

        const hashtags =
          $(".zylo-upload-hashtags", studio)
            ?.value
            ?.trim() || "";

        const privacy =
          $(".zylo-upload-privacy", studio)
            ?.value || "public";

        const allowComments =
          Boolean(
            $(".zylo-upload-comments", studio)
              ?.checked
          );

        const allowSave =
          Boolean(
            $(".zylo-upload-save", studio)
              ?.checked
          );

        const allowShare =
          Boolean(
            $(".zylo-upload-share", studio)
              ?.checked
          );

        postButton.disabled = true;
        fileButton.disabled = true;
        cancelButton.disabled = true;

        progressWrap.style.display =
          "block";

        progressBar.style.width =
          "0%";

        status.textContent =
          "Preparing upload...";

        try {
          const result =
            await uploadVideo(
              selectedFile,
              {
                caption,
                hashtags,
                privacy,
                allowComments,
                allowSave,
                allowShare
              },
              {
                onProgress: (percent) => {
                  progressBar.style.width =
                    `${percent}%`;

                  status.textContent =
                    `Uploading ${percent}%`;
                }
              }
            );

          status.textContent =
            "Video posted successfully.";

          addUploadedVideoToFeed(
            result
          );

          saveUploadedVideoMetadata(
            result
          );

          VideoEngine.refresh();

          window.setTimeout(
            () => {
              close();

              const pages =
                VideoEngine.getPages();

              const target =
                pages.find(
                  (page) =>
                    page.dataset.videoId ===
                    result.videoId
                );

              const index =
                pages.indexOf(
                  target
                );

              if (index >= 0) {
                VideoEngine.scrollToPage(
                  index,
                  "smooth"
                );
              }
            },
            350
          );
        } catch (error) {
          console.error(
            "ZYLO upload error:",
            error
          );

          status.textContent =
            error?.message ||
            "Upload failed. Please try again.";

          postButton.disabled = false;
          fileButton.disabled = false;
          cancelButton.disabled = false;
        }
      }
    );
  }

  function createFallbackVideoInput() {
    let input =
      document.getElementById(
        "videoInput"
      );

    if (input) {
      return input;
    }

    input =
      document.createElement(
        "input"
      );

    input.id =
      "videoInput";

    input.type =
      "file";

    input.accept =
      "video/*";

    input.style.display =
      "none";

    document.body.appendChild(
      input
    );

    return input;
  }

  function previewUploadFile(
    file,
    preview,
    status
  ) {
    if (!file) {
      return;
    }

    if (
      !file.type ||
      !file.type.startsWith(
        "video/"
      )
    ) {
      status.textContent =
        "Please select a video file.";

      return;
    }

    const maxBytes =
      200 * 1024 * 1024;

    if (file.size > maxBytes) {
      status.textContent =
        "Video must be 200 MB or smaller.";

      return;
    }

    revokeUploadPreview();

    uploadPreviewURL =
      URL.createObjectURL(
        file
      );

    preview.innerHTML = `
      <video
        src="${uploadPreviewURL}"
        muted
        playsinline
        webkit-playsinline
        controls
        autoplay
      ></video>
    `;

    status.textContent =
      `${file.name} selected`;
  }

  /* =========================================================
     UPLOAD REQUEST
     ========================================================= */

  function uploadVideo(
    file,
    metadata,
    options = {}
  ) {
    return new Promise(
      (resolve, reject) => {
        const xhr =
          new XMLHttpRequest();

        const url =
          `${CONFIG.API_BASE_URL}/api/upload`;

        xhr.open(
          "POST",
          url,
          true
        );

        xhr.responseType =
          "json";

        xhr.timeout =
          15 * 60 * 1000;

        xhr.upload.onprogress =
          (event) => {
            if (
              !event.lengthComputable
            ) {
              return;
            }

            const percent =
              Math.min(
                100,
                Math.round(
                  (event.loaded /
                    event.total) *
                    100
                )
              );

            if (
              typeof options.onProgress ===
              "function"
            ) {
              options.onProgress(
                percent
              );
            }
          };

        xhr.onerror = () => {
          reject(
            new Error(
              "Network error during upload."
            )
          );
        };

        xhr.ontimeout = () => {
          reject(
            new Error(
              "Upload timed out."
            )
          );
        };

        xhr.onabort = () => {
          reject(
            new Error(
              "Upload cancelled."
            )
          );
        };

        xhr.onload = () => {
          let data =
            xhr.response;

          if (
            !data &&
            xhr.responseText
          ) {
            data =
              safeJSONParse(
                xhr.responseText,
                null
              );
          }

          if (
            xhr.status < 200 ||
            xhr.status >= 300
          ) {
            reject(
              new Error(
                data?.message ||
                  data?.error ||
                  `Upload failed (${xhr.status})`
              )
            );

            return;
          }

          const video =
            data?.video || {};

          const videoUrl =
            data?.url ||
            data?.videoUrl ||
            video?.url ||
            video?.videoUrl ||
            "";

          if (!videoUrl) {
            reject(
              new Error(
                "Server did not return a video URL."
              )
            );

            return;
          }

          const videoId =
            data?.videoId ||
            video?.videoId ||
            makeId("video");

          resolve({
            videoId,
            url: videoUrl,
            videoUrl,
            uid:
              data?.uid ||
              video?.uid ||
              getUserUID(),

            username:
              data?.username ||
              video?.username ||
              getUsername(),

            caption:
              metadata.caption || "",

            hashtags:
              metadata.hashtags || "",

            privacy:
              metadata.privacy || "public",

            allowComments:
              metadata.allowComments !==
              false,

            allowSave:
              metadata.allowSave !==
              false,

            allowShare:
              metadata.allowShare !==
              false,

            createdAt:
              Date.now()
          });
        };

        const formData =
          new FormData();

        formData.append(
          "video",
          file,
          file.name
        );

        formData.append(
          "uid",
          getUserUID()
        );

        formData.append(
          "username",
          getUsername()
        );

        formData.append(
          "caption",
          metadata.caption || ""
        );

        formData.append(
          "hashtags",
          metadata.hashtags || ""
        );

        formData.append(
          "privacy",
          metadata.privacy || "public"
        );

        formData.append(
          "allowComments",
          String(
            metadata.allowComments !==
              false
          )
        );

        formData.append(
          "allowSave",
          String(
            metadata.allowSave !==
              false
          )
        );

        formData.append(
          "allowShare",
          String(
            metadata.allowShare !==
              false
          )
        );

        xhr.send(
          formData
        );
      }
    );
  }

  /* =========================================================
     UPLOAD FEED PAGE
     ========================================================= */

  function saveUploadedVideoMetadata(
    record
  ) {
    const existing =
      getStorage(
        CONFIG.STORAGE.UPLOADED_VIDEOS,
        []
      );

    const list =
      Array.isArray(existing)
        ? existing
        : [];

    const index =
      list.findIndex(
        (item) =>
          item.videoId ===
          record.videoId
      );

    if (index >= 0) {
      list[index] =
        record;
    } else {
      list.unshift(
        record
      );
    }

    setStorage(
      CONFIG.STORAGE.UPLOADED_VIDEOS,
      list
    );
  }

  function addUploadedVideoToFeed(
    record
  ) {
    const feed =
      $(".video-feed");

    if (!feed) {
      return null;
    }

    const existing =
      $(
        `.video-page[data-video-id="${record.videoId}"]`,
        feed
      );

    if (existing) {
      return existing;
    }

    const template =
      $(".video-page", feed);

    if (!template) {
      return null;
    }

    const page =
      template.cloneNode(
        true
      );

    page.dataset.videoId =
      record.videoId;

    page.dataset.creatorUid =
      record.uid;

    page.dataset.uid =
      record.uid;

    page.dataset.creatorUsername =
      record.username;

    page.dataset.username =
      record.username;

    page.dataset.title =
      record.caption || "";

    page.dataset.description =
      record.caption || "";

    page.dataset.hashtags =
      record.hashtags || "";

    page.dataset.privacy =
      record.privacy || "public";

    page.dataset.allowComments =
      String(
        record.allowComments !==
          false
      );

    page.dataset.allowSave =
      String(
        record.allowSave !==
          false
      );

    page.dataset.allowShare =
      String(
        record.allowShare !==
          false
      );

    const video =
      $("video", page);

    if (video) {
      video.removeAttribute(
        "loop"
      );

      video.loop =
        false;

      video.muted =
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

      video.removeAttribute(
        "src"
      );

      const source =
        $("source", video);

      if (source) {
        source.src =
          record.videoUrl ||
          record.url;

        video.load();
      } else {
        video.src =
          record.videoUrl ||
          record.url;

        video.load();
      }

      video.dataset.zyloPrimary =
        record.videoUrl ||
        record.url;
    }

    setUploadedPageText(
      page,
      record
    );

    /*
     * Insert at the beginning so
     * newly uploaded video appears first.
     */
    feed.insertBefore(
      page,
      feed.firstElementChild
    );

    return page;
  }

  function setUploadedPageText(
    page,
    record
  ) {
    const usernameSelectors = [
      ".username",
      ".video-username",
      ".creator-name",
      "[data-username]"
    ];

    usernameSelectors.forEach(
      (selector) => {
        $$(selector, page).forEach(
          (element) => {
            if (
              element.dataset &&
              element.dataset.username
            ) {
              element.dataset.username =
                record.username;
            }

            element.textContent =
              record.username;
          }
        );
      }
    );

    const captionSelectors = [
      ".video-description",
      ".description",
      ".caption",
      ".video-caption"
    ];

    captionSelectors.forEach(
      (selector) => {
        $$(selector, page).forEach(
          (element) => {
            element.textContent =
              record.caption || "";
          }
        );
      }
    );

    const hashtagSelectors = [
      ".hashtags",
      ".video-hashtags"
    ];

    hashtagSelectors.forEach(
      (selector) => {
        $$(selector, page).forEach(
          (element) => {
            element.textContent =
              record.hashtags || "";
          }
        );
      }
    );
  }

  /* =========================================================
     RESTORE UPLOADED VIDEOS
     ========================================================= */

  async function restoreUploadedVideos() {
    const localRecords =
      getStorage(
        CONFIG.STORAGE.UPLOADED_VIDEOS,
        []
      );

    if (
      Array.isArray(localRecords)
    ) {
      localRecords
        .filter(
          (record) =>
            record &&
            (record.url ||
              record.videoUrl)
        )
        .reverse()
        .forEach((record) => {
          addUploadedVideoToFeed(
            record
          );
        });
    }

    /*
     * Also ask backend for saved videos.
     */
    try {
      const response =
        await fetch(
          `${CONFIG.API_BASE_URL}/api/videos`,
          {
            method: "GET",
            cache: "no-store"
          }
        );

      if (!response.ok) {
        return;
      }

      const data =
        await response.json();

      if (
        !data?.success ||
        !Array.isArray(data.videos)
      ) {
        return;
      }

      data.videos
        .slice()
        .reverse()
        .forEach((serverVideo) => {
          const record = {
            videoId:
              serverVideo.videoId ||
              serverVideo.id ||
              makeId("video"),

            url:
              serverVideo.url ||
              serverVideo.videoUrl ||
              "",

            videoUrl:
              serverVideo.videoUrl ||
              serverVideo.url ||
              "",

            uid:
              serverVideo.uid ||
              "guest",

            username:
              serverVideo.username ||
              "zylo_creator",

            caption:
              serverVideo.caption ||
              "",

            hashtags:
              serverVideo.hashtags ||
              "",

            privacy:
              serverVideo.privacy ||
              "public",

            allowComments:
              serverVideo.allowComments !==
              false,

            allowSave:
              serverVideo.allowSave !==
              false,

            allowShare:
              serverVideo.allowShare !==
              false,

            createdAt:
              serverVideo.createdAt ||
              Date.now()
          };

          if (
            record.url ||
            record.videoUrl
          ) {
            addUploadedVideoToFeed(
              record
            );

            saveUploadedVideoMetadata(
              record
            );
          }
        });

    } catch (error) {
      console.warn(
        "ZYLO restore backend videos:",
        error
      );
    }
  }

  /* =========================================================
     CREATE BUTTON
     ========================================================= */

  function setupCreateButton() {
    /*
     * CAPTURE PHASE IS IMPORTANT.
     * .nav-item navigation must not block
     * the Create button.
     */
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
      },
      true
    );
  }

  /* =========================================================
     EXISTING UPLOAD INPUT
     ========================================================= */

  function setupUploadInput() {
    const input =
      $("#videoInput");

    if (!input) {
      return;
    }

    input.addEventListener(
      "change",
      () => {
        const file =
          input.files?.[0];

        if (!file) {
          return;
        }

        const studio =
          $("#zyloUploadStudio");

        if (!studio) {
          return;
        }

        const preview =
          $(".zylo-upload-preview", studio);

        const status =
          $(".zylo-upload-status", studio);

        if (
          preview &&
          status
        ) {
          previewUploadFile(
            file,
            preview,
            status
          );
        }
      }
    );
  }

  /* =========================================================
     INITIALIZATION
     ========================================================= */

  function init() {
    loadAuthJS();

    VideoEngine.init();

    setupLikeButtons();
    setupSaveButtons();
    setupCommentButtons();
    setupShareButtons();
    setupMusicButtons();
    setupFullscreenButtons();
    setupProfileButtons();

    setupSearchButton();
    setupNavigation();

    setupCreateButton();
    setupUploadInput();

    restoreUploadedVideos()
      .then(() => {
        VideoEngine.refresh();
      })
      .catch(() => {
        VideoEngine.refresh();
      });

    openHashVideo();

    window.addEventListener(
      "hashchange",
      openHashVideo
    );

    /*
     * If auth becomes available later,
     * refresh profile-related data.
     */
    window.addEventListener(
      "zylo:authloaded",
      () => {
        VideoEngine.refresh();
      }
    );

    /*
     * Resume current video when app
     * returns from background.
     */
    document.addEventListener(
      "visibilitychange",
      () => {
        if (
          document.visibilityState ===
          "visible"
        ) {
          const pages =
            VideoEngine.getPages();

          const index =
            VideoEngine.getActiveIndex();

          if (
            pages[index]
          ) {
            const video =
              $("video", pages[index]);

            if (video) {
              VideoEngine.playVideo(
                video
              );
            }
          }
        }
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
      init,
      { once: true }
    );
  } else {
    init();
  }

})();
