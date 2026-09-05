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

      if (!feed) {
        return [];
      }

      /*
       * IMPORTANT:
       * এখানে hidden/display:none দিয়ে ভিডিও filter করা হচ্ছে না।
       * তাই নতুন ভিডিও যোগ হলেও feed থেকে হারিয়ে যাবে না।
       */
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
       * Auto-next কাজ করার জন্য loop বন্ধ রাখা হচ্ছে।
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
      if (!feed || !pages.length) {
        return -1;
      }

      const feedRect =
        feed.getBoundingClientRect();

      const feedCenter =
        feedRect.top + feedRect.height / 2;

      let bestIndex = 0;
      let bestDistance = Infinity;

      pages.forEach((page, index) => {
        const rect =
          page.getBoundingClientRect();

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

      const touch =
        event.touches[0];

      touchStartX =
        touch.clientX;

      touchStartY =
        touch.clientY;

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
      if (!feed) {
        return;
      }

      clearTimeout(scrollTimer);

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
        const video =
          getVideo(page);

        registerVideo(video);
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

    const id =
      page.dataset.videoId;

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

    const page =
      $(
        `.video-page[data-video-id="${CSS.escape(id)}"]`
      );

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

    panels.forEach(
      (panel) => {
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
      }
    );
  }

  function openComments(button) {
    const id =
      getVideoIdFromButton(
        button
      );

    if (!id) {
      return;
    }

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

        if (!button) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();

        shareVideo(button);
      }
    );
  }

     function previous() {
      refresh();
      if (!pages.length) return;

      const current =
        activeIndex >= 0 ? activeIndex : findNearestIndex();

      const previousIndex = Math.max(0, current - 1);

      if (previousIndex !== current) {
        scrollToPage(previousIndex, "smooth");
      }
    }

    function handleWheel(event) {
      if (!feed || isInteractiveTarget(event.target)) return;

      const delta = event.deltaY;
      if (Math.abs(delta) < 12) return;

      event.preventDefault();

      if (wheelLocked) return;

      wheelLocked = true;

      if (delta > 0) next();
      else previous();

      window.setTimeout(() => {
        wheelLocked = false;
      }, CONFIG.VIDEO.WHEEL_LOCK_MS);
    }

    function handleTouchStart(event) {
      if (!event.touches?.length) return;
      if (isInteractiveTarget(event.target)) return;

      const touch = event.touches[0];

      touchStartX = touch.clientX;
      touchStartY = touch.clientY;
      touching = true;
    }

    function handleTouchEnd(event) {
      if (!touching) return;
      touching = false;

      if (isInteractiveTarget(event.target)) return;
      if (!event.changedTouches?.length) return;

      const touch = event.changedTouches[0];
      const deltaY = touch.clientY - touchStartY;
      const deltaX = touch.clientX - touchStartX;

      if (Math.abs(deltaY) < CONFIG.VIDEO.SWIPE_THRESHOLD) return;
      if (Math.abs(deltaY) < Math.abs(deltaX)) return;

      if (deltaY < 0) next();
      else previous();
    }

    function handleScroll() {
      if (!feed) return;

      clearTimeout(scrollTimer);

      scrollTimer = window.setTimeout(() => {
        const index = findNearestIndex();

        if (index < 0 || index === activeIndex) return;

        activate(index, { updateHash: true });
      }, CONFIG.VIDEO.SETTLE_DELAY_MS);
    }

    function setupIntersectionObserver() {
      if (visibilityObserver) {
        visibilityObserver.disconnect();
      }

      if (!("IntersectionObserver" in window)) return;

      visibilityObserver = new IntersectionObserver(
        (entries) => {
          let best = null;

          entries.forEach((entry) => {
            if (
              entry.isIntersecting &&
              entry.intersectionRatio >= 0.65
            ) {
              if (
                !best ||
                entry.intersectionRatio > best.intersectionRatio
              ) {
                best = entry;
              }
            }
          });

          if (!best) return;

          const page = best.target;
          const index = pages.indexOf(page);

          if (index >= 0 && index !== activeIndex) {
            activate(index, { updateHash: true });
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

      observer = new MutationObserver(() => {
        refresh();
      });

      observer.observe(feed, {
        childList: true,
        subtree: true
      });

      const initialIndex = findNearestIndex();

      if (initialIndex >= 0) {
        window.setTimeout(() => {
          activate(initialIndex, {
            updateHash: false
          });
        }, 250);
      }

      console.log("ZYLO Video Engine initialized");
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

    if (!hash.startsWith("#video-")) return;

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
    const page = button?.closest?.(".video-page");

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
        label.textContent.replace(/[^\d]/g, ""),
        10
      ) || 0;

    label.textContent = String(
      Math.max(0, current + delta)
    );
  }

  function setupLikeButtons() {
    document.addEventListener(
      "click",
      (event) => {
        const button =
          event.target.closest(".like-btn");

        if (!button) return;

        event.preventDefault();
        event.stopPropagation();

        const id =
          getVideoIdFromButton(button);

        if (!id) return;

        const likes = getLikeSet();
        const index = likes.indexOf(id);

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

    $$(".like-btn").forEach((button) => {
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
    });
  }

  /* =========================================================
     SAVE
     ========================================================= */

  function setupSaveButtons() {
    document.addEventListener(
      "click",
      (event) => {
        const button =
          event.target.closest(".save-btn");

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

    $$(".save-btn").forEach((button) => {
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
    });
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
          >×</button>
        </div>

        <div class="zylo-comment-list">

          ${
            comments.length
              ? comments
                  .map(
                    (comment) => `
                      <div
                        class="zylo-comment-item"
                      >
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
                <div
                  class="zylo-comment-empty"
                >
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

          <button
            type="submit"
          >
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
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(
          url
        );

        button.classList.add("active");

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
          button.closest(".video-page");

        const video =
          $("video", page);

        if (!video) return;

        if (video.paused) {
          VideoEngine.playVideo(video);
        } else {
          video.pause();
        }
      }
    );
  }

  /* =========================================================
     FULLSCREEN
     ========================================================= */

  async function requestFullscreen(element) {
    if (!element) return;

    try {
      if (
        document.fullscreenElement
      ) {
        await document.exitFullscreen();
        return;
      }

      if (
        element.requestFullscreen
      ) {
        await element.requestFullscreen();
        return;
      }

      if (
        element.webkitRequestFullscreen
      ) {
        element.webkitRequestFullscreen();
        return;
      }

      const video =
        element.querySelector?.("video");

      if (
        video?.webkitEnterFullscreen
      ) {
        video.webkitEnterFullscreen();
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

        if (!button) return;

        event.preventDefault();
        event.stopPropagation();

        const page =
          button.closest(".video-page");

        requestFullscreen(page);
      }
    );
  }

  /* =========================================================
     FOLLOW
     ========================================================= */

  function getFollows() {
    const value =
      getStorage(
        CONFIG.STORAGE.FOLLOWS,
        []
      );

    return Array.isArray(value)
      ? value
      : [];
  }

  function setFollows(value) {
    setStorage(
      CONFIG.STORAGE.FOLLOWS,
      value
    );
  }

  function getCreatorIdFromPage(page) {
    return (
      page?.dataset?.creatorUid ||
      page?.dataset?.uid ||
      page?.dataset?.creatorId ||
      ""
    );
  }

  function getCreatorNameFromPage(page) {
    return (
      page?.dataset?.creatorUsername ||
      page?.dataset?.username ||
      $(".username", page)?.textContent?.trim() ||
      $(".creator-name", page)?.textContent?.trim() ||
      "zylo_creator"
    );
  }

  function updateFollowButton(button, following) {
    if (!button) return;

    button.classList.toggle(
      "following",
      following
    );

    button.classList.toggle(
      "active",
      following
    );

    const text =
      button.querySelector(
        ".follow-text"
      );

    if (text) {
      text.textContent =
        following
          ? "Following"
          : "Follow";
    }

    const aria =
      following
        ? "Following"
        : "Follow";

    button.setAttribute(
      "aria-label",
      aria
    );
  }

  function setupFollowButtons() {
    document.addEventListener(
      "click",
      (event) => {
        const button =
          event.target.closest(
            ".follow-btn,.profile-follow-btn,[data-follow]"
          );

        if (!button) return;

        event.preventDefault();
        event.stopPropagation();

        const page =
          button.closest(".video-page");

        const creatorId =
          button.dataset.creatorUid ||
          getCreatorIdFromPage(page);

        if (!creatorId) return;

        const follows =
          getFollows();

        const index =
          follows.indexOf(creatorId);

        if (index >= 0) {
          follows.splice(index, 1);
          updateFollowButton(
            button,
            false
          );
        } else {
          follows.push(creatorId);
          updateFollowButton(
            button,
            true
          );
        }

        setFollows(follows);

        window.dispatchEvent(
          new CustomEvent(
            "zylo:followchange",
            {
              detail: {
                creatorId,
                following:
                  index < 0,
                creatorName:
                  getCreatorNameFromPage(
                    page
                  )
              }
            }
          )
        );
      }
    );

    $(
      ".follow-btn,.profile-follow-btn,[data-follow]"
    ).forEach((button) => {
      const page =
        button.closest(".video-page");

      const creatorId =
        button.dataset.creatorUid ||
        getCreatorIdFromPage(page);

      if (
        creatorId &&
        getFollows().includes(
          creatorId
        )
      ) {
        updateFollowButton(
          button,
          true
        );
      }
    });
  }

  /* =========================================================
     NAVIGATION
     ========================================================= */

  function openHome() {
    const feed =
      $(".video-feed");

    if (!feed) return;

    VideoEngine.refresh();

    const pages =
      VideoEngine.getPages();

    if (!pages.length) return;

    VideoEngine.scrollToPage(
      0,
      "smooth"
    );
  }

  function openDiscover() {
    window.dispatchEvent(
      new CustomEvent(
        "zylo:discover"
      )
    );

    const search =
      $("#searchInput");

    if (search) {
      search.focus();
    }
  }

  function openInbox() {
    window.dispatchEvent(
      new CustomEvent(
        "zylo:inbox"
      )
    );
  }

  function openProfile() {
    if (
      window.ZYLOAuth &&
      typeof window.ZYLOAuth.openProfile ===
        "function"
    ) {
      window.ZYLOAuth.openProfile();
      return;
    }

    window.dispatchEvent(
      new CustomEvent(
        "zylo:profile"
      )
    );
  }

  function setupNavigation() {
    document.addEventListener(
      "click",
      (event) => {
        const nav =
          event.target.closest(
            ".nav-item"
          );

        if (!nav) return;

        event.preventDefault();
        event.stopPropagation();

        const type =
          nav.dataset.nav ||
          nav.getAttribute(
            "data-nav"
          );

        if (type === "home") {
          openHome();
        }

        if (type === "discover") {
          openDiscover();
        }

        if (type === "inbox") {
          openInbox();
        }

        if (type === "profile") {
          openProfile();
        }
      }
    );
  }

  /* =========================================================
     SEARCH
     ========================================================= */

  let searchOverlay = null;

  function getAllVideoPages() {
    return $$(".video-page");
  }

  function collectSearchData() {
    return getAllVideoPages().map(
      (page, index) => {
        const video =
          $("video", page);

        const username =
          page.dataset.creatorUsername ||
          page.dataset.username ||
          $(".username", page)
            ?.textContent
            ?.trim() ||
          "zylo_creator";

        const caption =
          page.dataset.description ||
          $(".video-description", page)
            ?.textContent
            ?.trim() ||
          $(".description", page)
            ?.textContent
            ?.trim() ||
          "";

        const hashtags =
          page.dataset.hashtags ||
          $(".hashtags", page)
            ?.textContent
            ?.trim() ||
          "";

        return {
          page,
          index,
          id:
            page.dataset.videoId ||
            `video_${index}`,
          username,
          caption,
          hashtags,
          source:
            video?.currentSrc ||
            video?.src ||
            ""
        };
      }
    );
  }

  function closeSearchOverlay() {
    if (!searchOverlay) return;

    searchOverlay.remove();
    searchOverlay = null;
  }

  function openSearchOverlay() {
    closeSearchOverlay();

    searchOverlay =
      document.createElement("div");

    searchOverlay.className =
      "zylo-search-overlay";

    searchOverlay.innerHTML = `
      <div class="zylo-search-box">

        <div class="zylo-search-header">

          <strong>Search ZYLO</strong>

          <button
            type="button"
            data-search-close
            aria-label="Close"
          >
            ×
          </button>

        </div>

        <div class="zylo-search-input-wrap">

          <input
            type="search"
            data-zylo-search-input
            placeholder="Search creators, videos or hashtags..."
            autocomplete="off"
          />

        </div>

        <div
          class="zylo-search-results"
          data-zylo-search-results
        ></div>

      </div>
    `;

    document.body.appendChild(
      searchOverlay
    );

    injectSearchStyles();

    const input =
      $(
        "[data-zylo-search-input]",
        searchOverlay
      );

    const results =
      $(
        "[data-zylo-search-results]",
        searchOverlay
      );

    function renderResults(query) {
      const q =
        String(query || "")
          .trim()
          .toLowerCase();

      if (!q) {
        results.innerHTML = `
          <div class="zylo-search-empty">
            Search ZYLO
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
              item.caption,
              item.hashtags,
              item.id
            ]
              .join(" ")
              .toLowerCase();

          return haystack.includes(q);
        });

      if (!matches.length) {
        results.innerHTML = `
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
                data-search-index="${item.index}"
              >

                <div
                  class="zylo-search-avatar"
                >
                  Z
                </div>

                <div
                  class="zylo-search-result-text"
                >

                  <strong>
                    ${escapeHTML(
                      item.username
                    )}
                  </strong>

                  <span>
                    ${escapeHTML(
                      item.caption ||
                      item.hashtags ||
                      "ZYLO video"
                    )}
                  </span>

                </div>

              </button>
            `
          )
          .join("");
    }

    input.addEventListener(
      "input",
      () => {
        renderResults(
          input.value
        );
      }
    );

    searchOverlay.addEventListener(
      "click",
      (event) => {
        const close =
          event.target.closest(
            "[data-search-close]"
          );

        if (close) {
          closeSearchOverlay();
          return;
        }

        const result =
          event.target.closest(
            ".zylo-search-result"
          );

        if (!result) return;

        const index =
          Number(
            result.dataset.searchIndex
          );

        closeSearchOverlay();

        VideoEngine.scrollToPage(
          index,
          "smooth"
        );
      }
    );

    input.focus();

    renderResults("");
  }

  function setupSearch() {
    document.addEventListener(
      "click",
      (event) => {
        const button =
          event.target.closest(
            ".search-btn,#searchBtn,[data-search]"
          );

        if (!button) return;

        event.preventDefault();
        event.stopPropagation();

        openSearchOverlay();
      }
    );

    document.addEventListener(
      "keydown",
      (event) => {
        if (
          event.key === "/" &&
          !isTypingTarget(
            event.target
          )
        ) {
          event.preventDefault();
          openSearchOverlay();
        }

        if (
          event.key === "Escape" &&
          searchOverlay
        ) {
          closeSearchOverlay();
        }
      }
    );
  }

  function isTypingTarget(target) {
    if (!target) return false;

    const tag =
      target.tagName?.toLowerCase();

    return (
      tag === "input" ||
      tag === "textarea" ||
      tag === "select" ||
      target.isContentEditable
    );
  }

  function injectSearchStyles() {
    if (
      document.getElementById(
        "zylo-search-styles"
      )
    ) {
      return;
    }

    const style =
      document.createElement("style");

    style.id =
      "zylo-search-styles";

    style.textContent = `
      .zylo-search-overlay {
        position: fixed;
        inset: 0;
        z-index: 99999;
        background: rgba(0,0,0,.72);
        display: flex;
        align-items: flex-start;
        justify-content: center;
        padding: 24px 14px;
        box-sizing: border-box;
      }

      .zylo-search-box {
        width: min(560px, 100%);
        max-height: calc(100dvh - 48px);
        overflow: auto;
        background: #111;
        color: #fff;
        border-radius: 18px;
        box-shadow: 0 20px 70px rgba(0,0,0,.5);
      }

      .zylo-search-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 18px;
        font-size: 18px;
      }

      .zylo-search-header button {
        width: 38px;
        height: 38px;
        border: 0;
        border-radius: 50%;
        background: rgba(255,255,255,.1);
        color: #fff;
        font-size: 24px;
        cursor: pointer;
      }

      .zylo-search-input-wrap {
        padding: 0 18px 14px;
      }

      .zylo-search-input-wrap input {
        width: 100%;
        box-sizing: border-box;
        border: 1px solid rgba(255,255,255,.14);
        background: rgba(255,255,255,.08);
        color: #fff;
        border-radius: 12px;
        padding: 13px 14px;
        outline: none;
        font-size: 15px;
      }

      .zylo-search-results {
        padding: 0 10px 12px;
      }

      .zylo-search-result {
        width: 100%;
        border: 0;
        background: transparent;
        color: #fff;
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px 8px;
        text-align: left;
        border-radius: 12px;
        cursor: pointer;
      }

      .zylo-search-result:hover {
        background: rgba(255,255,255,.08);
      }

      .zylo-search-avatar {
        width: 42px;
        height: 42px;
        min-width: 42px;
        border-radius: 50%;
        display: grid;
        place-items: center;
        background: #fff;
        color: #111;
        font-weight: 800;
      }

      .zylo-search-result-text {
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 3px;
      }

      .zylo-search-result-text strong {
        font-size: 14px;
      }

      .zylo-search-result-text span {
        font-size: 12px;
        opacity: .7;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .zylo-search-empty {
        padding: 30px 18px;
        text-align: center;
        opacity: .65;
      }
    `;

    document.head.appendChild(style);
  }

  /* =========================================================
     UPLOAD SYSTEM
     ========================================================= */

  let uploadStudio = null;
  let selectedUploadFile = null;
  let uploadPreviewURL = "";

  function injectUploadStyles() {
    if (
      document.getElementById(
        "zylo-upload-styles"
      )
    ) {
      return;
    }

    const style =
      document.createElement("style");

    style.id =
      "zylo-upload-styles";

    style.textContent = `
      #zyloUploadStudio {
        position: fixed;
        inset: 0;
        z-index: 100000;
        background: #000;
        color: #fff;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }

      .zylo-upload-top {
        height: 58px;
        min-height: 58px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 14px;
        box-sizing: border-box;
        border-bottom: 1px solid rgba(255,255,255,.1);
      }

      .zylo-upload-title {
        font-size: 18px;
        font-weight: 800;
      }

      .zylo-upload-close {
        width: 38px;
        height: 38px;
        border: 0;
        border-radius: 50%;
        background: rgba(255,255,255,.1);
        color: #fff;
        font-size: 24px;
      }

      .zylo-upload-content {
        flex: 1;
        overflow-y: auto;
        padding: 14px;
        box-sizing: border-box;
      }

      .zylo-upload-preview {
        width: 100%;
        max-width: 430px;
        aspect-ratio: 9 / 16;
        margin: 0 auto 18px;
        background: #111;
        border-radius: 16px;
        overflow: hidden;
        position: relative;
      }

      .zylo-upload-preview video {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
      }

      .zylo-upload-placeholder {
        position: absolute;
        inset: 0;
        display: grid;
        place-items: center;
        text-align: center;
        padding: 30px;
        box-sizing: border-box;
        color: rgba(255,255,255,.7);
      }

      .zylo-upload-fields {
        max-width: 650px;
        margin: 0 auto;
      }

      .zylo-upload-field {
        margin-bottom: 14px;
      }

      .zylo-upload-field label {
        display: block;
        margin-bottom: 7px;
        font-size: 13px;
        font-weight: 700;
      }

      .zylo-upload-field input,
      .zylo-upload-field textarea,
      .zylo-upload-field select {
        width: 100%;
        box-sizing: border-box;
        border: 1px solid rgba(255,255,255,.14);
        background: rgba(255,255,255,.08);
        color: #fff;
        border-radius: 12px;
        padding: 12px;
        outline: none;
        font-size: 14px;
      }

      .zylo-upload-field textarea {
        min-height: 90px;
        resize: vertical;
      }

      .zylo-upload-options {
        display: grid;
        gap: 8px;
        margin-top: 8px;
      }

      .zylo-upload-option {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        padding: 12px;
        background: rgba(255,255,255,.06);
        border-radius: 12px;
      }

      .zylo-upload-option span {
        font-size: 14px;
      }

      .zylo-upload-option input {
        width: 20px;
        height: 20px;
      }

      .zylo-upload-actions {
        display: flex;
        gap: 10px;
        max-width: 650px;
        margin: 0 auto;
        padding-top: 8px;
      }

      .zylo-upload-actions button {
        flex: 1;
        min-height: 46px;
        border: 0;
        border-radius: 12px;
        font-weight: 800;
        cursor: pointer;
      }

      .zylo-upload-cancel {
        background: rgba(255,255,255,.1);
        color: #fff;
      }

      .zylo-upload-post {
        background: #fff;
        color: #000;
      }

      .zylo-upload-post:disabled {
        opacity: .45;
        cursor: not-allowed;
      }

      .zylo-upload-progress-wrap {
        max-width: 650px;
        margin: 12px auto 0;
      }

      .zylo-upload-progress {
        height: 5px;
        border-radius: 99px;
        overflow: hidden;
        background: rgba(255,255,255,.1);
      }

      .zylo-upload-progress > div {
        width: 0%;
        height: 100%;
        background: #fff;
        transition: width .15s linear;
      }

      .zylo-upload-status {
        text-align: center;
        font-size: 12px;
        opacity: .7;
        min-height: 20px;
        margin-top: 7px;
      }

      .zylo-upload-select {
        width: 100%;
        min-height: 46px;
        border: 1px solid rgba(255,255,255,.15);
        border-radius: 12px;
        background: rgba(255,255,255,.08);
        color: #fff;
        font-weight: 800;
        cursor: pointer;
      }

      @media (max-width: 600px) {
        .zylo-upload-content {
          padding: 10px;
        }

        .zylo-upload-preview {
          max-width: 340px;
        }
      }
    `;

    document.head.appendChild(style);
  }

  /* =========================================================
     UPLOAD STUDIO — PART 3
     ========================================================= */

  function createUploadStudio() {
    injectUploadStyles();

    const studio =
      document.createElement("div");

    studio.id =
      "zyloUploadStudio";

    studio.innerHTML = `
      <div class="zylo-upload-top">

        <div class="zylo-upload-title">
          Create
        </div>

        <button
          type="button"
          class="zylo-upload-close"
          id="zyloUploadClose"
          aria-label="Close"
        >
          ×
        </button>

      </div>

      <div class="zylo-upload-content">

        <div class="zylo-upload-preview">

          <video
            id="zyloUploadPreview"
            playsinline
            muted
            controls
            preload="metadata"
          ></video>

          <div
            class="zylo-upload-placeholder"
            id="zyloUploadPlaceholder"
          >
            Choose a video to preview
          </div>

        </div>

        <div class="zylo-upload-fields">

          <div class="zylo-upload-field">

            <button
              type="button"
              class="zylo-upload-select"
              id="zyloUploadSelect"
            >
              Choose video
            </button>

          </div>

          <div class="zylo-upload-field">

            <label for="zyloCaption">
              Caption
            </label>

            <textarea
              id="zyloCaption"
              maxlength="2200"
              placeholder="Describe your video..."
            ></textarea>

          </div>

          <div class="zylo-upload-field">

            <label for="zyloHashtags">
              Hashtags
            </label>

            <input
              id="zyloHashtags"
              type="text"
              maxlength="500"
              placeholder="#zylo #video #creator"
            />

          </div>

          <div class="zylo-upload-field">

            <label for="zyloPrivacy">
              Who can watch this video?
            </label>

            <select id="zyloPrivacy">

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

          <div class="zylo-upload-field">

            <label>
              Settings
            </label>

            <div class="zylo-upload-options">

              <label class="zylo-upload-option">

                <span>
                  Allow comments
                </span>

                <input
                  type="checkbox"
                  id="zyloAllowComments"
                  checked
                />

              </label>

              <label class="zylo-upload-option">

                <span>
                  Allow saving
                </span>

                <input
                  type="checkbox"
                  id="zyloAllowSave"
                  checked
                />

              </label>

              <label class="zylo-upload-option">

                <span>
                  Allow sharing
                </span>

                <input
                  type="checkbox"
                  id="zyloAllowShare"
                  checked
                />

              </label>

            </div>

          </div>

          <div class="zylo-upload-progress-wrap">

            <div
              class="zylo-upload-progress"
            >
              <div
                id="zyloUploadProgress"
              ></div>
            </div>

            <div
              class="zylo-upload-status"
              id="zyloUploadStatus"
            >
              Select a video to continue
            </div>

          </div>

          <div class="zylo-upload-actions">

            <button
              type="button"
              class="zylo-upload-cancel"
              id="zyloUploadCancel"
            >
              Cancel
            </button>

            <button
              type="button"
              class="zylo-upload-post"
              id="zyloUploadPost"
              disabled
            >
              Post
            </button>

          </div>

        </div>

      </div>
    `;

    document.body.appendChild(studio);

    uploadStudio = studio;

    setupUploadStudioEvents();

    return studio;
  }

  function setupUploadStudioEvents() {
    if (!uploadStudio) return;

    const selectButton =
      $("#zyloUploadSelect", uploadStudio);

    const closeButton =
      $("#zyloUploadClose", uploadStudio);

    const cancelButton =
      $("#zyloUploadCancel", uploadStudio);

    const postButton =
      $("#zyloUploadPost", uploadStudio);

    selectButton?.addEventListener(
      "click",
      () => {
        const input =
          $("#videoInput");

        if (input) {
          input.value = "";
          input.click();
        }
      }
    );

    closeButton?.addEventListener(
      "click",
      closeUploadStudio
    );

    cancelButton?.addEventListener(
      "click",
      closeUploadStudio
    );

    postButton?.addEventListener(
      "click",
      () => {
        uploadVideo();
      }
    );
  }

  function openUploadBox() {
    if (
      uploadStudio &&
      document.body.contains(uploadStudio)
    ) {
      uploadStudio.style.display =
        "flex";

      return;
    }

    createUploadStudio();

    selectedUploadFile = null;

    setUploadStatus(
      "Select a video to continue"
    );

    setUploadProgress(0);

    const input =
      $("#videoInput");

    if (input) {
      input.value = "";
    }
  }

  function closeUploadStudio() {
    if (!uploadStudio) return;

    if (
      uploadPreviewURL
    ) {
      try {
        URL.revokeObjectURL(
          uploadPreviewURL
        );
      } catch {}

      uploadPreviewURL = "";
    }

    const preview =
      $("#zyloUploadPreview", uploadStudio);

    if (preview) {
      preview.pause();
      preview.removeAttribute("src");
      preview.load();
    }

    uploadStudio.remove();

    uploadStudio = null;
    selectedUploadFile = null;
  }

  function setUploadStatus(message) {
    if (!uploadStudio) return;

    const status =
      $("#zyloUploadStatus", uploadStudio);

    if (status) {
      status.textContent =
        String(message || "");
    }
  }

  function setUploadProgress(value) {
    if (!uploadStudio) return;

    const progress =
      $("#zyloUploadProgress", uploadStudio);

    if (!progress) return;

    const percent =
      Math.max(
        0,
        Math.min(
          100,
          Number(value) || 0
        )
      );

    progress.style.width =
      `${percent}%`;
  }

  function updatePostButton() {
    if (!uploadStudio) return;

    const post =
      $("#zyloUploadPost", uploadStudio);

    if (!post) return;

    post.disabled =
      !selectedUploadFile;
  }

  function previewUploadFile(file) {
    if (!file) return;

    if (
      !file.type ||
      !file.type.startsWith("video/")
    ) {
      setUploadStatus(
        "Please select a valid video file."
      );

      selectedUploadFile = null;
      updatePostButton();

      return;
    }

    const maxSize =
      200 * 1024 * 1024;

    if (file.size > maxSize) {
      setUploadStatus(
        "Video must be 200 MB or smaller."
      );

      selectedUploadFile = null;
      updatePostButton();

      return;
    }

    selectedUploadFile = file;

    if (uploadPreviewURL) {
      try {
        URL.revokeObjectURL(
          uploadPreviewURL
        );
      } catch {}
    }

    uploadPreviewURL =
      URL.createObjectURL(file);

    if (!uploadStudio) {
      createUploadStudio();
    }

    const preview =
      $("#zyloUploadPreview", uploadStudio);

    const placeholder =
      $(
        "#zyloUploadPlaceholder",
        uploadStudio
      );

    if (preview) {
      preview.src =
        uploadPreviewURL;

      preview.muted = true;
      preview.controls = true;

      preview.load();

      preview.play().catch(() => {});
    }

    if (placeholder) {
      placeholder.style.display =
        "none";
    }

    setUploadStatus(
      `${file.name} • ${formatFileSize(file.size)}`
    );

    setUploadProgress(0);

    updatePostButton();
  }

  function formatFileSize(bytes) {
    const size =
      Number(bytes) || 0;

    if (size < 1024) {
      return `${size} B`;
    }

    if (size < 1024 * 1024) {
      return `${(
        size / 1024
      ).toFixed(1)} KB`;
    }

    if (
      size <
      1024 * 1024 * 1024
    ) {
      return `${(
        size /
        (1024 * 1024)
      ).toFixed(1)} MB`;
    }

    return `${(
      size /
      (1024 * 1024 * 1024)
    ).toFixed(2)} GB`;
  }

  function getUploadFormData() {
    if (!uploadStudio) {
      throw new Error(
        "Upload studio is not open."
      );
    }

    if (!selectedUploadFile) {
      throw new Error(
        "Please choose a video first."
      );
    }

    const caption =
      $(
        "#zyloCaption",
        uploadStudio
      )?.value?.trim() || "";

    const hashtags =
      $(
        "#zyloHashtags",
        uploadStudio
      )?.value?.trim() || "";

    const privacy =
      $(
        "#zyloPrivacy",
        uploadStudio
      )?.value || "public";

    const allowComments =
      Boolean(
        $(
          "#zyloAllowComments",
          uploadStudio
        )?.checked
      );

    const allowSave =
      Boolean(
        $(
          "#zyloAllowSave",
          uploadStudio
        )?.checked
      );

    const allowShare =
      Boolean(
        $(
          "#zyloAllowShare",
          uploadStudio
        )?.checked
      );

    return {
      caption,
      hashtags,
      privacy,
      allowComments,
      allowSave,
      allowShare
    };
  }

  function getCurrentUserData() {
    const uid =
      getUserUID();

    const username =
      getUsername();

    return {
      uid:
        uid ||
        `guest_${Date.now()}`,

      username:
        username ||
        "zylo_creator"
    };
  }

  function uploadVideo() {
    if (!selectedUploadFile) {
      setUploadStatus(
        "Please choose a video first."
      );

      return;
    }

    if (!uploadStudio) return;

    const postButton =
      $("#zyloUploadPost", uploadStudio);

    const cancelButton =
      $("#zyloUploadCancel", uploadStudio);

    const selectButton =
      $("#zyloUploadSelect", uploadStudio);

    if (postButton) {
      postButton.disabled = true;
      postButton.textContent =
        "Uploading...";
    }

    if (cancelButton) {
      cancelButton.disabled = true;
    }

    if (selectButton) {
      selectButton.disabled = true;
    }

    let formData;

    try {
      formData =
        getUploadFormData();
    } catch (error) {
      setUploadStatus(
        error.message
      );

      if (postButton) {
        postButton.disabled = false;
        postButton.textContent =
          "Post";
      }

      return;
    }

    const user =
      getCurrentUserData();

    const data =
      new FormData();

    data.append(
      "video",
      selectedUploadFile,
      selectedUploadFile.name
    );

    data.append(
      "uid",
      user.uid
    );

    data.append(
      "username",
      user.username
    );

    data.append(
      "caption",
      formData.caption
    );

    data.append(
      "hashtags",
      formData.hashtags
    );

    data.append(
      "privacy",
      formData.privacy
    );

    data.append(
      "allowComments",
      String(
        formData.allowComments
      )
    );

    data.append(
      "allowSave",
      String(
        formData.allowSave
      )
    );

    data.append(
      "allowShare",
      String(
        formData.allowShare
      )
    );

    const xhr =
      new XMLHttpRequest();

    xhr.open(
      "POST",
      `${CONFIG.API_BASE_URL}/api/upload`,
      true
    );

    xhr.setRequestHeader(
      "Accept",
      "application/json"
    );

    xhr.upload.onprogress =
      (event) => {
        if (!event.lengthComputable) {
          setUploadStatus(
            "Uploading..."
          );

          return;
        }

        const percent =
          (event.loaded /
            event.total) *
          100;

        setUploadProgress(
          percent
        );

        setUploadStatus(
          `Uploading ${Math.round(
            percent
          )}%`
        );
      };

    xhr.onload = () => {
      let response = null;

      try {
        response =
          JSON.parse(
            xhr.responseText ||
            "{}"
          );
      } catch {
        response = null;
      }

      if (
        xhr.status < 200 ||
        xhr.status >= 300
      ) {
        const message =
          response?.message ||
          response?.error ||
          `Upload failed (${xhr.status})`;

        handleUploadFailure(
          new Error(message)
        );

        return;
      }

      const uploadedURL =
        response?.url ||
        response?.videoUrl ||
        response?.video?.url ||
        "";

      if (!uploadedURL) {
        handleUploadFailure(
          new Error(
            "Server did not return a video URL."
          )
        );

        return;
      }

      setUploadProgress(100);

      setUploadStatus(
        "Processing video..."
      );

      const videoId =
        response?.videoId ||
        response?.video?.videoId ||
        makeId("video");

      const record = {
        videoId,

        uid:
          response?.uid ||
          response?.video?.uid ||
          user.uid,

        username:
          response?.username ||
          response?.video?.username ||
          user.username,

        url: uploadedURL,

        videoUrl: uploadedURL,

        caption:
          formData.caption,

        hashtags:
          formData.hashtags,

        privacy:
          formData.privacy,

        allowComments:
          formData.allowComments,

        allowSave:
          formData.allowSave,

        allowShare:
          formData.allowShare,

        filename:
          selectedUploadFile.name,

        size:
          selectedUploadFile.size,

        type:
          selectedUploadFile.type,

        createdAt:
          Date.now()
      };

      saveUploadedVideo(
        record
      );

      setUploadStatus(
        "Posted successfully!"
      );

      window.setTimeout(() => {
        addUploadedVideoToFeed(
          record
        );

        closeUploadStudio();
      }, 500);
    };

    xhr.onerror = () => {
      handleUploadFailure(
        new Error(
          "Network error. Please try again."
        )
      );
    };

    xhr.onabort = () => {
      handleUploadFailure(
        new Error(
          "Upload cancelled."
        )
      );
    };

    xhr.ontimeout = () => {
      handleUploadFailure(
        new Error(
          "Upload timed out. Please try again."
        )
      );
    };

    setUploadStatus(
      "Starting upload..."
    );

    xhr.send(data);
  }

  function handleUploadFailure(error) {
    console.error(
      "ZYLO upload error:",
      error
    );

    setUploadStatus(
      error?.message ||
      "Upload failed."
    );

    const postButton =
      uploadStudio &&
      $("#zyloUploadPost", uploadStudio);

    const cancelButton =
      uploadStudio &&
      $("#zyloUploadCancel", uploadStudio);

    const selectButton =
      uploadStudio &&
      $("#zyloUploadSelect", uploadStudio);

    if (postButton) {
      postButton.disabled = false;
      postButton.textContent =
        "Post";
    }

    if (cancelButton) {
      cancelButton.disabled = false;
    }

    if (selectButton) {
      selectButton.disabled = false;
    }
  }

  function saveUploadedVideo(video) {
    const videos =
      getStorage(
        CONFIG.STORAGE.UPLOADED_VIDEOS,
        []
      );

    const list =
      Array.isArray(videos)
        ? videos
        : [];

    const clean =
      list.filter(
        (item) =>
          item &&
          item.videoId !==
            video.videoId
      );

    clean.unshift(video);

    setStorage(
      CONFIG.STORAGE.UPLOADED_VIDEOS,
      clean
    );
  }

  function getUploadedVideos() {
    const videos =
      getStorage(
        CONFIG.STORAGE.UPLOADED_VIDEOS,
        []
      );

    return Array.isArray(videos)
      ? videos
      : [];
  }

  function setupUploadInput() {
    const input =
      $("#videoInput");

    if (!input) return;

    input.setAttribute(
      "accept",
      "video/*"
    );

    input.addEventListener(
      "change",
      (event) => {
        const file =
          event.target.files?.[0];

        if (!file) return;

        if (!uploadStudio) {
          openUploadBox();
        }

        previewUploadFile(
          file
        );
      }
    );
  }

  function addUploadedVideoToFeed(video) {
    if (!video?.url) return;

    const feed =
      getFeed();

    if (!feed) return;

    const existing =
      $(
        `.video-page[data-video-id="${CSS.escape(
          String(video.videoId)
        )}"]`
      );

    if (existing) {
      VideoEngine.refresh();
      return;
    }

    const template =
      $(".video-page", feed);

    if (!template) {
      console.warn(
        "ZYLO: no video template found."
      );

      return;
    }

    const page =
      template.cloneNode(true);

    page.dataset.videoId =
      video.videoId;

    page.dataset.creatorUid =
      video.uid || "";

    page.dataset.creatorUsername =
      video.username || "";

    page.dataset.username =
      video.username || "";

    page.dataset.description =
      video.caption || "";

    page.dataset.hashtags =
      video.hashtags || "";

    page.dataset.privacy =
      video.privacy || "public";

    page.dataset.allowComments =
      String(
        video.allowComments !== false
      );

    page.dataset.allowSave =
      String(
        video.allowSave !== false
      );

    page.dataset.allowShare =
      String(
        video.allowShare !== false
      );

    const media =
      $("video", page);

    if (media) {
      media.pause();

      media.loop = false;
      media.removeAttribute(
        "loop"
      );

      media.muted = true;
      media.playsInline = true;

      media.setAttribute(
        "playsinline",
        ""
      );

      media.preload =
        "metadata";

      media.src =
        video.url;

      media.load();
    }

    setUploadedPageText(
      page,
      video
    );

    feed.appendChild(page);

    VideoEngine.refresh();

    window.setTimeout(() => {
      const pages =
        VideoEngine.getPages();

      const index =
        pages.indexOf(page);

      if (index >= 0) {
        VideoEngine.scrollToPage(
          index,
          "smooth"
        );
      }
    }, 100);
  }

  function setUploadedPageText(
    page,
    video
  ) {
    const username =
      video.username ||
      "zylo_creator";

    const caption =
      video.caption ||
      "";

    const hashtags =
      video.hashtags ||
      "";

    const userElements = [
      ...$$(
        ".username",
        page
      ),
      ...$$(
        ".creator-name",
        page
      ),
      ...$$(
        "[data-username]",
        page
      )
    ];

    userElements.forEach(
      (element) => {
        if (
          !element.matches(
            "input,textarea"
          )
        ) {
          element.textContent =
            username;
        }
      }
    );

    const descriptionElements = [
      ...$$(
        ".video-description",
        page
      ),
      ...$$(
        ".description",
        page
      ),
      ...$$(
        ".caption",
        page
      ),
      ...$$(
        "[data-description]",
        page
      )
    ];

    descriptionElements.forEach(
      (element) => {
        if (
          !element.matches(
            "input,textarea"
          )
        ) {
          element.textContent =
            caption;
        }
      }
    );

    const hashtagElements = [
      ...$$(
        ".hashtags",
        page
      ),
      ...$$(
        "[data-hashtags]",
        page
      )
    ];

    hashtagElements.forEach(
      (element) => {
        if (
          !element.matches(
            "input,textarea"
          )
        ) {
          element.textContent =
            hashtags;
        }
      }
    );

    page.setAttribute(
      "aria-label",
      `${username} video`
    );
  }

  /* =========================================================
     RESTORE UPLOADED VIDEOS
     ========================================================= */

  function restoreUploadedVideos() {
    const videos =
      getUploadedVideos();

    if (!videos.length) return;

    videos
      .slice()
      .reverse()
      .forEach((video) => {
        if (!video?.url) return;

        if (
          String(video.url).startsWith(
            "blob:"
          )
        ) {
          return;
        }

        addUploadedVideoToFeed(
          video
        );
      });
  }

  /* =========================================================
     CREATE BUTTON
     ========================================================= */

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
      },
      true
    );
  }

  /* =========================================================
     INITIALIZATION
     ========================================================= */

  function initializeVideoSystem() {
    VideoEngine.init();

    setupLikeButtons();
    setupSaveButtons();
    setupCommentButtons();
    setupShareButtons();
    setupMusicButtons();
    setupFullscreenButtons();
    setupFollowButtons();

    setupNavigation();
    setupSearch();

    setupCreateButton();
    setupUploadInput();

    restoreUploadedVideos();

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

    document.addEventListener(
      "visibilitychange",
      () => {
        if (
          document.hidden
        ) {
          const pages =
            VideoEngine.getPages();

          pages.forEach(
            (page) => {
              const video =
                $("video", page);

              if (video) {
                video.pause();
              }
            }
          );
        } else {
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
      }
    );

    console.log(
      "ZYLO Video System ready"
    );
  }

  /* =========================================================
     AUTH BRIDGE
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

    script.async = true;

    script.dataset.zyloAuth =
      "true";

    script.onload = () => {
      console.log(
        "ZYLO Auth loaded"
      );
    };

    script.onerror = () => {
      console.warn(
        "ZYLO Auth could not be loaded."
      );
    };

    document.head.appendChild(
      script
    );
  }

  /* =========================================================
     GLOBAL EVENTS
     ========================================================= */

  window.addEventListener(
    "zylo:video-uploaded",
    (event) => {
      const video =
        event.detail;

      if (video) {
        saveUploadedVideo(
          video
        );

        addUploadedVideoToFeed(
          video
        );
      }
    }
  );

  window.addEventListener(
    "zylo:followchange",
    () => {
      VideoEngine.refresh();
    }
  );

  /* =========================================================
     START ZYLO
     ========================================================= */

  function startZYLO() {
    try {
      initializeVideoSystem();
    } catch (error) {
      console.error(
        "ZYLO initialization error:",
        error
      );
    }

    loadAuthJS();
  }

  if (
    document.readyState ===
    "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      startZYLO,
      {
        once: true
      }
    );
  } else {
    startZYLO();
  }

})();
