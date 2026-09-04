/* =========================================================
   ZYLO - COMPLETE FRONTEND ENGINE
   Video Feed + Auto Next + Smart Loading + Upload
   Like + Save + Comment + Share + Music + Fullscreen
   Follow + Search + Profile + Auth bridge
   ========================================================= */

(() => {
  "use strict";

  const CONFIG = {
    API_BASE_URL: "https://zylo-backend-ec5c.onrender.com",

    DEFAULT_VIDEO:
      "./backend/uploads/video1.mp4",

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
    safeJSONParse(
      localStorage.getItem(key),
      fallback
    );

  const setStorage = (key, value) => {
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
        "button,a,input,textarea,select,label," +
        ".action-btn,.music-btn,.fullscreen-btn," +
        ".profile-action,.create-btn,.search-btn," +
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
     VIDEO SOURCE
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

    video.dataset.zyloPrimary = source;

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

      return $$(".video-page", feed)
        .filter(
          (page) =>
            !page.hidden &&
            page.style.display !== "none"
        );
    }

    function getVideo(page) {
      return page
        ? $("video", page)
        : null;
    }

    function prepareVideo(video) {
      if (!video) return;

      captureVideoSource(video);

      video.muted = true;
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

      if (!video.dataset.zyloPrepared) {
        video.dataset.zyloPrepared =
          "true";

        video.dataset.zyloEnded =
          "false";
      }
    }

    function ensureSource(
      video,
      preloadMode = "metadata"
    ) {
      if (!video) return false;

      prepareVideo(video);

      const primary =
        captureVideoSource(video);

      if (!primary) return false;

      const currentSrc =
        video.currentSrc ||
        video.src ||
        "";

      const wanted =
        normalizeVideoSource(
          primary
        );

      if (
        !currentSrc ||
        currentSrc ===
          window.location.href
      ) {
        video.src = primary;
        video.preload =
          preloadMode;

        video.dataset.zyloSourceState =
          "primary";

        return true;
      }

      if (
        normalizeVideoSource(
          currentSrc
        ) === wanted
      ) {
        video.preload =
          preloadMode;

        return true;
      }

      return true;
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
          const fallback =
            getFallbackSource(video);

          if (!fallback) return;

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
          video.load();

          if (
            video.dataset
              .zyloActive === "true"
          ) {
            playVideo(video);
          }
        }
      );
    }

    /* =========================================================
       AUTO NEXT
       ========================================================= */

    function attachEndedHandler(video) {
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
          if (autoNextLock) return;

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

          if (currentIndex >= 0) {
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

    function registerVideo(video) {
      if (!video) return;

      prepareVideo(video);
      installErrorFallback(video);
      attachEndedHandler(video);
    }

    function smartLoad(index) {
      if (!pages.length) return;

      pages.forEach(
        (page, i) => {
          const video =
            getVideo(page);

          if (!video) return;

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

    function pauseAll(
      exceptVideo = null
    ) {
      pages.forEach(
        (page) => {
          const video =
            getVideo(page);

          if (
            !video ||
            video === exceptVideo
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

    async function playVideo(video) {
      if (!video) return false;

      prepareVideo(video);
      ensureSource(
        video,
        "auto"
      );

      video.muted = true;
      video.playsInline = true;

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
                .catch(() => {});
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

      if (!pages.length) return;

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

      if (!page) return;

      activeIndex = index;

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

      if (!pages.length) return;

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

    function next(
      fromEnded = false
    ) {
      refresh();

      if (!pages.length) return;

      const current =
        activeIndex >= 0
          ? activeIndex
          : findNearestIndex();

      if (current < 0) return;

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
        Math.abs(delta) <
        12
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

      window.setTimeout(
        () => {
          wheelLocked =
            false;
        },
        CONFIG.VIDEO
          .WHEEL_LOCK_MS
      );
    }

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

    function handleTouchEnd(
      event
    ) {
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
        !event.changedTouches
          ?.length
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
        CONFIG.VIDEO
          .SWIPE_THRESHOLD
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
        window.setTimeout(
          () => {
            const index =
              findNearestIndex();

            if (
              index < 0 ||
              index ===
                activeIndex
            ) {
              return;
            }

            activate(index, {
              updateHash:
                true
            });
          },
          CONFIG.VIDEO
            .SETTLE_DELAY_MS
        );
    }

    function setupIntersectionObserver() {
      if (
        visibilityObserver
      ) {
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
                    best =
                      entry;
                  }
                }
              }
            );

            if (!best) return;

            const page =
              best.target;

            const index =
              pages.indexOf(
                page
              );

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

      pages.forEach(
        (page) => {
          const video =
            getVideo(page);

          registerVideo(
            video
          );
        }
      );

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

      observer.observe(feed, {
        childList: true,
        subtree: true
      });

      const initialIndex =
        findNearestIndex();

      if (
        initialIndex >= 0
      ) {
        window.setTimeout(
          () => {
            activate(
              initialIndex,
              {
                updateHash:
                  false
              }
            );
          },
          250
        );
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

    const page = $(
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
    const panels =
      $$(
        ".zylo-comment-panel,.comment-panel"
      );

    panels.forEach(
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

    const comments =
      getComments()[id] ||
      [];

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

    const form = $(
      ".zylo-comment-form",
      panel
    );

    const input = $(
      "input",
      form
    );

    form.addEventListener(
      "submit",
      (event) => {
        event.preventDefault();

        const text =
          input.value.trim();

        if (!text) return;

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

          uid:
            getUserUID(),

          username:
            getUsername(),

          text,

          createdAt:
            Date.now()
        });

        setComments(all);

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

  function getShareURL(page) {
    if (!page) {
      return window.location.href;
    }

    const id =
      page.dataset.videoId ||
      page.id ||
      "";

    if (!id) {
      return window.location.href;
    }

    return `${window.location.origin}${window.location.pathname}#video-${encodeURIComponent(
      id
    )}`;
  }

  async function shareVideo(button) {
    const page =
      button?.closest?.(".video-page");

    const url =
      getShareURL(page);

    const title =
      page?.querySelector(
        ".video-title,.caption,.description"
      )?.textContent?.trim() ||
      "ZYLO Video";

    const shareData = {
      title: "ZYLO",
      text: title,
      url
    };

    try {
      if (
        navigator.share &&
        typeof navigator.share ===
          "function"
      ) {
        await navigator.share(
          shareData
        );
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

    try {
      await navigator.clipboard.writeText(
        url
      );

      showToast(
        "Video link copied"
      );

      return;
    } catch {}

    try {
      const textarea =
        document.createElement(
          "textarea"
        );

      textarea.value = url;
      textarea.style.position =
        "fixed";
      textarea.style.opacity = "0";

      document.body.appendChild(
        textarea
      );

      textarea.select();

      document.execCommand(
        "copy"
      );

      textarea.remove();

      showToast(
        "Video link copied"
      );
    } catch {
      showToast(
        "Unable to share video"
      );
    }
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
     TOAST
     ========================================================= */

  let toastTimer = null;

  function showToast(message) {
    let toast =
      document.querySelector(
        ".zylo-toast"
      );

    if (!toast) {
      toast =
        document.createElement(
          "div"
        );

      toast.className =
        "zylo-toast";

      toast.style.position =
        "fixed";

      toast.style.left =
        "50%";

      toast.style.bottom =
        "90px";

      toast.style.transform =
        "translateX(-50%)";

      toast.style.zIndex =
        "99999";

      toast.style.padding =
        "10px 16px";

      toast.style.borderRadius =
        "12px";

      toast.style.background =
        "rgba(0,0,0,.85)";

      toast.style.color =
        "#fff";

      toast.style.fontSize =
        "14px";

      toast.style.pointerEvents =
        "none";

      document.body.appendChild(
        toast
      );
    }

    toast.textContent =
      message;

    toast.style.display =
      "block";

    clearTimeout(
      toastTimer
    );

    toastTimer =
      window.setTimeout(
        () => {
          toast.style.display =
            "none";
        },
        1800
      );
  }


  /* =========================================================
     MUSIC
     ========================================================= */

  let globalAudio = null;
  let musicPlaying = false;

  function getMusicSource(button) {
    if (!button) return "";

    return (
      button.dataset.music ||
      button.getAttribute(
        "data-music"
      ) ||
      ""
    );
  }

  function createAudio() {
    if (globalAudio) {
      return globalAudio;
    }

    globalAudio =
      document.createElement(
        "audio"
      );

    globalAudio.preload =
      "auto";

    globalAudio.loop = true;

    globalAudio.style.display =
      "none";

    document.body.appendChild(
      globalAudio
    );

    return globalAudio;
  }

  async function toggleMusic(
    button
  ) {
    const source =
      getMusicSource(button);

    if (!source) {
      showToast(
        "Music is not available"
      );
      return;
    }

    const audio =
      createAudio();

    if (
      audio.src !==
      normalizeVideoSource(
        source
      )
    ) {
      audio.src = source;
      audio.load();
    }

    try {
      if (
        audio.paused
      ) {
        await audio.play();

        musicPlaying =
          true;

        button.classList.add(
          "active",
          "playing"
        );
      } else {
        audio.pause();

        musicPlaying =
          false;

        button.classList.remove(
          "active",
          "playing"
        );
      }
    } catch {
      showToast(
        "Music could not be played"
      );
    }
  }

  function stopMusic() {
    if (!globalAudio) return;

    try {
      globalAudio.pause();
      globalAudio.currentTime =
        0;
    } catch {}

    musicPlaying =
      false;

    $$(".music-btn").forEach(
      (button) => {
        button.classList.remove(
          "active",
          "playing"
        );
      }
    );
  }

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

        toggleMusic(
          button
        );
      }
    );
  }


  /* =========================================================
     FULLSCREEN
     ========================================================= */

  async function enterFullscreen(
    element
  ) {
    if (!element) return;

    try {
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

      if (
        element.webkitEnterFullscreen
      ) {
        element.webkitEnterFullscreen();
        return;
      }
    } catch (error) {
      console.warn(
        "ZYLO fullscreen error:",
        error
      );
    }
  }

  async function toggleFullscreen(
    button
  ) {
    const page =
      button?.closest?.(
        ".video-page"
      );

    if (!page) return;

    const video =
      $("video", page);

    if (!video) return;

    try {
      if (
        document.fullscreenElement ||
        document.webkitFullscreenElement
      ) {
        if (
          document.exitFullscreen
        ) {
          await document.exitFullscreen();
        } else if (
          document.webkitExitFullscreen
        ) {
          document.webkitExitFullscreen();
        }

        return;
      }

      await enterFullscreen(
        video
      );
    } catch {}
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

        toggleFullscreen(
          button
        );
      }
    );
  }


  /* =========================================================
     DOUBLE TAP LIKE
     ========================================================= */

  const doubleTapState =
    new WeakMap();

  function triggerLike(button) {
    if (!button) return;

    button.click();
  }

  function setupDoubleTapLike() {
    $$(".video-page").forEach(
      (page) => {
        const video =
          $("video", page);

        if (!video) return;

        let lastTap = 0;

        const handleTap =
          (event) => {
            if (
              isInteractiveTarget(
                event.target
              )
            ) {
              return;
            }

            const now =
              Date.now();

            const elapsed =
              now - lastTap;

            if (
              elapsed > 0 &&
              elapsed < 320
            ) {
              const likeButton =
                $(
                  ".like-btn",
                  page
                );

              if (likeButton) {
                triggerLike(
                  likeButton
                );
              }

              lastTap = 0;
            } else {
              lastTap = now;
            }
          };

        video.addEventListener(
          "touchend",
          handleTap,
          {
            passive: true
          }
        );

        video.addEventListener(
          "click",
          handleTap
        );

        doubleTapState.set(
          video,
          true
        );
      }
    );
  }


  /* =========================================================
     VIDEO CLICK = PLAY / PAUSE
     ========================================================= */

  function setupVideoPlayPause() {
    document.addEventListener(
      "click",
      (event) => {
        const video =
          event.target.closest(
            ".video-page video"
          );

        if (!video) return;

        if (
          isInteractiveTarget(
            event.target
          )
        ) {
          return;
        }

        if (
          video.paused
        ) {
          video.muted = true;

          video.play().catch(
            () => {}
          );

          video.dataset
            .zyloPlaying =
            "true";
        } else {
          video.pause();

          video.dataset
            .zyloPlaying =
            "false";
        }
      }
    );
  }


  /* =========================================================
     VISIBILITY / APP BACKGROUND
     ========================================================= */

  function setupVisibilityHandling() {
    document.addEventListener(
      "visibilitychange",
      () => {
        if (
          document.hidden
        ) {
          $$(".video-page video")
            .forEach(
              (video) => {
                try {
                  video.pause();
                } catch {}
              }
            );

          return;
        }

        const pages =
          VideoEngine.getPages();

        const index =
          VideoEngine.getActiveIndex();

        if (
          index >= 0 &&
          pages[index]
        ) {
          const video =
            $(
              "video",
              pages[index]
            );

          if (video) {
            video.muted = true;

            video.play().catch(
              () => {}
            );
          }
        }
      }
    );
  }


  /* =========================================================
     CREATOR PROFILE
     ========================================================= */

  function getCreatorData(
    page
  ) {
    if (!page) {
      return {
        uid: "",
        username:
          "ZYLO Creator"
      };
    }

    const profile =
      $(".profile-action", page);

    return {
      uid:
        profile?.dataset?.uid ||
        page.dataset.ownerUid ||
        "",

      username:
        profile?.dataset?.username ||
        page.dataset.ownerUsername ||
        page.dataset.username ||
        "ZYLO Creator"
    };
  }

  function openCreatorProfile(
    page
  ) {
    const creator =
      getCreatorData(page);

    try {
      window.dispatchEvent(
        new CustomEvent(
          "zylo:creatorprofile",
          {
            detail: creator
          }
        )
      );
    } catch {}

    if (
      window.ZYLOAuth &&
      typeof window.ZYLOAuth.openCreatorProfile ===
        "function"
    ) {
      window.ZYLOAuth.openCreatorProfile(
        creator.uid,
        creator.username
      );

      return;
    }

    showToast(
      `@${creator.username}`
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

        if (!page) return;

        openCreatorProfile(
          page
        );
      }
    );
  }


  /* =========================================================
     TOP NAVIGATION
     ========================================================= */

  function activateTopTab(
    tab
  ) {
    if (!tab) return;

    const allTabs =
      $$(
        ".top-tab,.feed-tab,[data-feed]"
      );

    allTabs.forEach(
      (item) => {
        item.classList.toggle(
          "active",
          item === tab
        );
      }
    );

    const type =
      tab.dataset.feed ||
      tab.dataset.tab ||
      tab.textContent
        ?.trim()
        .toLowerCase() ||
      "";

    document.dispatchEvent(
      new CustomEvent(
        "zylo:feedchange",
        {
          detail: {
            feed: type
          }
        }
      )
    );
  }

  function setupTopNavigation() {
    document.addEventListener(
      "click",
      (event) => {
        const tab =
          event.target.closest(
            ".top-tab,.feed-tab,[data-feed]"
          );

        if (!tab) return;

        if (
          tab.classList.contains(
            "search-btn"
          )
        ) {
          return;
        }

        event.preventDefault();

        activateTopTab(
          tab
        );
      }
    );
  }


  /* =========================================================
     BOTTOM NAVIGATION
     ========================================================= */

  function setupBottomNavigation() {
    document.addEventListener(
      "click",
      (event) => {
        const item =
          event.target.closest(
            ".nav-item"
          );

        if (!item) return;

        const nav =
          item.dataset.nav ||
          "";

        if (
          nav === "profile"
        ) {
          event.preventDefault();
          event.stopPropagation();

          if (
            window.ZYLOAuth &&
            typeof window.ZYLOAuth.openOwnProfile ===
              "function"
          ) {
            window.ZYLOAuth.openOwnProfile();
          } else {
            window.dispatchEvent(
              new CustomEvent(
                "zylo:openprofile"
              )
            );
          }

          return;
        }

        if (
          nav === "create"
        ) {
          return;
        }

        if (
          nav === "home"
        ) {
          const feed =
            $(".video-feed");

          if (feed) {
            feed.scrollTo({
              top: 0,
              behavior:
                "smooth"
            });
          }
        }

        if (
          nav === "discover"
        ) {
          document.dispatchEvent(
            new CustomEvent(
              "zylo:discover"
            )
          );
        }

        if (
          nav === "inbox"
        ) {
          document.dispatchEvent(
            new CustomEvent(
              "zylo:inbox"
            )
          );
        }

        $$(".nav-item").forEach(
          (navItem) => {
            navItem.classList.toggle(
              "active",
              navItem === item
            );
          }
        );
      }
    );
  }


  /* =========================================================
     SEARCH
     ========================================================= */

  let searchOverlay = null;

  function closeSearch() {
    if (
      searchOverlay
    ) {
      searchOverlay.remove();
      searchOverlay = null;
    }
  }

  function createSearchOverlay() {
    closeSearch();

    searchOverlay =
      document.createElement(
        "div"
      );

    searchOverlay.className =
      "zylo-search-overlay";

    searchOverlay.innerHTML = `
      <div class="zylo-search-box">
        <div class="zylo-search-header">
          <input
            type="search"
            placeholder="Search ZYLO"
            autocomplete="off"
            data-zylo-search-input
          />

          <button
            type="button"
            data-zylo-search-close
            aria-label="Close search"
          >×</button>
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

    input?.addEventListener(
      "input",
      () => {
        performSearch(
          input.value,
          results
        );
      }
    );

    $(
      "[data-zylo-search-close]",
      searchOverlay
    )?.addEventListener(
      "click",
      closeSearch
    );

    input?.focus();
  }

  function performSearch(
    query,
    results
  ) {
    if (!results) return;

    const value =
      String(query || "")
        .trim()
        .toLowerCase();

    if (!value) {
      results.innerHTML = "";
      return;
    }

    const matches = [];

    $$(".video-page").forEach(
      (page) => {
        const text =
          page.textContent
            ?.toLowerCase() ||
          "";

        if (
          text.includes(value)
        ) {
          matches.push(
            page
          );
        }
      }
    );

    if (!matches.length) {
      results.innerHTML = `
        <div class="zylo-search-empty">
          No results found
        </div>
      `;

      return;
    }

    results.innerHTML =
      matches
        .map(
          (page, index) => {
            const creator =
              getCreatorData(
                page
              );

            return `
              <button
                type="button"
                class="zylo-search-result"
                data-result-index="${index}"
              >
                <strong>
                  ${escapeHTML(
                    creator.username
                  )}
                </strong>
              </button>
            `;
          }
        )
        .join("");

    results
      .querySelectorAll(
        "[data-result-index]"
      )
      .forEach(
        (button) => {
          button.addEventListener(
            "click",
            () => {
              const index =
                parseInt(
                  button.dataset
                    .resultIndex,
                  10
                );

              const page =
                matches[index];

              const pages =
                VideoEngine.getPages();

              const pageIndex =
                pages.indexOf(
                  page
                );

              closeSearch();

              if (
                pageIndex >= 0
              ) {
                VideoEngine.scrollToPage(
                  pageIndex,
                  "smooth"
                );
              }
            }
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

        createSearchOverlay();
      }
    );
  }
