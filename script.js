/* =========================================================
   ZYLO - COMPLETE script.js
   ---------------------------------------------------------
   Video Feed
   Auto Play
   Auto Pause
   Auto Next
   Native Touch Swipe
   Scroll Snap
   Upload
   Server Video Loading
   Like
   Save
   Comment
   Share
   Music
   Fullscreen
   Creator Profile
   Search
   Navigation
   Auth Bridge

   IMPORTANT:
   Existing HTML / CSS / SVG UI is NOT redesigned.
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
      UPLOADED_VIDEOS: "zylo_uploaded_videos_v5",
      LIKES: "zylo_likes_v5",
      SAVED: "zylo_saved_v5",
      COMMENTS: "zylo_comments_v5",
      FOLLOWS: "zylo_follows_v5"
    },

    VIDEO: {
      SETTLE_DELAY_MS: 140,
      AUTO_NEXT_DELAY_MS: 180,
      PLAY_RETRY_MS: 700,
      PRELOAD_AHEAD: 1,
      PRELOAD_BEHIND: 1
    },

    UPLOAD: {
      MAX_SIZE:
        200 * 1024 * 1024,

      TIMEOUT:
        5 * 60 * 1000
    }
  };


  /* =========================================================
     DOM HELPERS
     ========================================================= */

  function $(selector, root = document) {
    try {
      return root.querySelector(selector);
    } catch {
      return null;
    }
  }


  function $$(selector, root = document) {
    try {
      return Array.from(
        root.querySelectorAll(selector)
      );
    } catch {
      return [];
    }
  }


  /* =========================================================
     STORAGE
     ========================================================= */

  function getStorage(key, fallback) {
    try {
      const value =
        localStorage.getItem(key);

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
    const user =
      getCurrentUser();

    return (
      user?.uid ||
      user?.id ||
      localStorage.getItem("zylo_uid") ||
      "guest"
    );
  }


  function getUsername() {
    const user =
      getCurrentUser();

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
          ".top-bar",
          ".zylo-comment-panel",
          ".zylo-profile-panel",
          ".zylo-my-profile-panel",
          ".zylo-search-panel",
          ".zylo-inbox-panel"
        ].join(",")
      )
    );
  }


  /* =========================================================
     VIDEO SOURCE HELPERS
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


  function makeServerVideoURL(url) {
    if (!url) {
      return "";
    }

    const value =
      String(url).trim();

    if (!value) {
      return "";
    }

    if (
      value.startsWith("http://") ||
      value.startsWith("https://")
    ) {
      return value;
    }

    if (value.startsWith("//")) {
      return window.location.protocol + value;
    }

    if (value.startsWith("/")) {
      return (
        CONFIG.API_BASE_URL +
        value
      );
    }

    return (
      CONFIG.API_BASE_URL +
      "/" +
      value.replace(/^\/+/, "")
    );
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
      clean ===
        CONFIG.DEFAULT_VIDEO
    );
  }


  function captureVideoSource(video) {
    if (!video) {
      return "";
    }

    if (
      video.dataset &&
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
          sourceTag.getAttribute("data-src") ||
          sourceTag.getAttribute("src") ||
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
      video?.getAttribute?.("data-src") ||
      video?.getAttribute?.("src") ||
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
    let playRetryTimer = null;
    let autoNextLock = false;

    let observer = null;
    let mutationObserver = null;

    let initialized = false;


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
       * NEVER hide/filter video pages.
       */
      return $$(".video-page", feed);
    }


    function getVideo(page) {
      if (!page) {
        return null;
      }

      return $("video", page);
    }


    function refresh() {
      feed = getFeed();
      pages = getPages();

      pages.forEach(page => {
        const video =
          getVideo(page);

        if (video) {
          registerVideo(video);
        }
      });

      forceScrolling();

      return pages;
    }


    function forceScrolling() {
      if (!feed) {
        return;
      }

      feed.style.overflowY =
        "auto";

      feed.style.overflowX =
        "hidden";

      feed.style.scrollSnapType =
        "y mandatory";

      feed.style.scrollBehavior =
        "smooth";

      feed.style.touchAction =
        "pan-y";

      feed.style.overscrollBehaviorY =
        "contain";

      feed.style.webkitOverflowScrolling =
        "touch";

      feed.style.height =
        "100dvh";

      feed.style.minHeight =
        "100dvh";

      pages.forEach(page => {
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
      });
    }


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
       * Do not use loop.
       */
      video.loop = false;
      video.removeAttribute("loop");

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

      const wanted =
        normalizeVideoSource(primary);

      const current =
        video.currentSrc ||
        video.getAttribute("src") ||
        video.src ||
        "";

      if (!current) {
        video.src = primary;
        video.preload = preload;

        return true;
      }

      const currentNormalized =
        normalizeVideoSource(current);

      if (
        currentNormalized === wanted
      ) {
        video.preload = preload;

        return true;
      }

      if (
        video.dataset.zyloUsingFallback !==
        "true"
      ) {
        video.src = primary;
        video.preload = preload;
      }

      return true;
    }


    function installErrorHandler(video) {
      if (!video) {
        return;
      }

      if (
        video.dataset.zyloErrorHandler ===
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
            console.warn(
              "ZYLO: video failed:",
              video.src
            );

            return;
          }

          if (
            video.dataset.zyloUsingFallback ===
            "true"
          ) {
            return;
          }

          video.dataset.zyloUsingFallback =
            "true";

          video.src = fallback;
          video.preload = "auto";

          try {
            video.load();
          } catch {}

          if (
            video.dataset.zyloActive ===
            "true"
          ) {
            setTimeout(() => {
              playVideo(video);
            }, 250);
          }
        }
      );
    }


    function installEndedHandler(video) {
      if (!video) {
        return;
      }

      if (
        video.dataset.zyloEndedHandler ===
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
            video.closest(".video-page");

          if (page) {
            const index =
              pages.indexOf(page);

            if (index >= 0) {
              activeIndex = index;
            }
          }

          setTimeout(() => {
            next(true);

            setTimeout(() => {
              autoNextLock = false;
            }, 700);
          }, CONFIG.VIDEO.AUTO_NEXT_DELAY_MS);
        }
      );
    }


    function registerVideo(video) {
      if (!video) {
        return;
      }

      prepareVideo(video);
      installErrorHandler(video);
      installEndedHandler(video);
    }


    function smartLoad(index) {
      pages.forEach((page, i) => {
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
          CONFIG.VIDEO.PRELOAD_AHEAD
        ) {
          ensureSource(
            video,
            "metadata"
          );
        } else if (
          distance <=
          CONFIG.VIDEO.PRELOAD_BEHIND
        ) {
          video.preload =
            "metadata";
        } else {
          video.preload =
            "none";
        }
      });
    }


    function pauseAll(except = null) {
      pages.forEach(page => {
        const video =
          getVideo(page);

        if (!video) {
          return;
        }

        if (
          except &&
          video === except
        ) {
          return;
        }

        try {
          video.pause();
        } catch {}

        video.dataset.zyloPlaying =
          "false";
      });
    }


    function playVideo(video) {
      if (!video) {
        return;
      }

      if (
        video.dataset.zyloActive !==
        "true"
      ) {
        return;
      }

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
          promise
            .then(() => {
              video.dataset.zyloPlaying =
                "true";
            })
            .catch(() => {
              video.dataset.zyloPlaying =
                "false";

              clearTimeout(
                playRetryTimer
              );

              playRetryTimer =
                setTimeout(() => {
                  if (
                    video.dataset
                      .zyloActive ===
                    "true"
                  ) {
                    playVideo(video);
                  }
                }, CONFIG.VIDEO.PLAY_RETRY_MS);
            });
        }
      } catch {
        video.dataset.zyloPlaying =
          "false";
      }
    }


    function activate(
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
          const itemVideo =
            getVideo(item);

          if (!itemVideo) {
            return;
          }

          const active =
            i === index;

          itemVideo.dataset.zyloActive =
            active
              ? "true"
              : "false";

          if (!active) {
            try {
              itemVideo.pause();
            } catch {}

            itemVideo.dataset.zyloPlaying =
              "false";
          }
        }
      );

      if (video) {
        ensureSource(
          video,
          "auto"
        );

        if (
          video.ended &&
          video.currentTime > 0
        ) {
          try {
            video.currentTime = 0;
          } catch {}
        }

        playVideo(video);
      }

      smartLoad(index);

      if (
        options.updateHash !== false
      ) {
        try {
          const id =
            page.dataset.videoId;

          if (id) {
            history.replaceState(
              null,
              "",
              "#" +
                encodeURIComponent(id)
            );
          }
        } catch {}
      }

      window.dispatchEvent(
        new CustomEvent(
          "zylo:videoactive",
          {
            detail: {
              index,
              page,
              video
            }
          }
        )
      );
    }


    function getNearestIndex() {
      refresh();

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

      try {
        page.scrollIntoView({
          behavior,
          block: "start",
          inline: "nearest"
        });
      } catch {
        try {
          feed.scrollTop =
            page.offsetTop;
        } catch {}
      }

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
          ? 350
          : 0
      );
    }


    function next() {
      refresh();

      if (!pages.length) {
        return;
      }

      let index =
        activeIndex;

      if (
        index < 0 ||
        index >= pages.length
      ) {
        index =
          getNearestIndex();
      }

      const nextIndex =
        index + 1;

      if (
        nextIndex >=
        pages.length
      ) {
        return;
      }

      scrollToPage(
        nextIndex,
        "smooth"
      );
    }


    function previous() {
      refresh();

      if (!pages.length) {
        return;
      }

      let index =
        activeIndex;

      if (
        index < 0 ||
        index >= pages.length
      ) {
        index =
          getNearestIndex();
      }

      const previousIndex =
        index - 1;

      if (
        previousIndex < 0
      ) {
        return;
      }

      scrollToPage(
        previousIndex,
        "smooth"
      );
    }


    function handleScroll() {
      if (!feed) {
        return;
      }

      clearTimeout(
        scrollTimer
      );

      scrollTimer =
        setTimeout(() => {
          const index =
            getNearestIndex();

          if (index >= 0) {
            activate(
              index,
              {
                updateHash: true
              }
            );
          }
        }, CONFIG.VIDEO.SETTLE_DELAY_MS);
    }


    function setupTouch() {
      if (!feed) {
        return;
      }

      feed.addEventListener(
        "touchstart",
        () => {},
        {
          passive: true
        }
      );

      feed.addEventListener(
        "touchend",
        () => {
          clearTimeout(
            scrollTimer
          );

          scrollTimer =
            setTimeout(() => {
              const index =
                getNearestIndex();

              if (index >= 0) {
                activate(
                  index,
                  {
                    updateHash: true
                  }
                );
              }
            }, 180);
        },
        {
          passive: true
        }
      );
    }


    function setupWheel() {
      if (!feed) {
        return;
      }

      feed.addEventListener(
        "wheel",
        () => {},
        {
          passive: true
        }
      );
    }


    function setupKeyboard() {
      document.addEventListener(
        "keydown",
        event => {
          if (
            isInteractiveTarget(
              event.target
            )
          ) {
            return;
          }

          if (
            event.key ===
            "ArrowDown"
          ) {
            event.preventDefault();
            next();
          }

          if (
            event.key ===
            "ArrowUp"
          ) {
            event.preventDefault();
            previous();
          }

          if (
            event.key ===
            "PageDown"
          ) {
            event.preventDefault();
            next();
          }

          if (
            event.key ===
            "PageUp"
          ) {
            event.preventDefault();
            previous();
          }
        }
      );
    }


    function setupObserver() {
      if (
        !feed ||
        !("IntersectionObserver" in window)
      ) {
        return;
      }

      if (observer) {
        observer.disconnect();
      }

      observer =
        new IntersectionObserver(
          entries => {
            let best = null;

            entries.forEach(
              entry => {
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
              pages.indexOf(page);

            if (index >= 0) {
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
              0.55,
              0.7,
              0.85,
              0.95
            ]
          }
        );

      pages.forEach(page => {
        observer.observe(page);
      });
    }


    function setupMutationObserver() {
      if (
        !feed ||
        !("MutationObserver" in window)
      ) {
        return;
      }

      if (mutationObserver) {
        mutationObserver.disconnect();
      }

      mutationObserver =
        new MutationObserver(() => {
          refresh();

          if (observer) {
            setupObserver();
          }
        });

      mutationObserver.observe(
        feed,
        {
          childList: true,
          subtree: true
        }
      );
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
        "scroll",
        handleScroll,
        {
          passive: true
        }
      );

      setupTouch();
      setupWheel();
      setupKeyboard();
      setupObserver();
      setupMutationObserver();

      const initialIndex =
        getNearestIndex();

      if (initialIndex >= 0) {
        activate(
          initialIndex,
          {
            updateHash: false
          }
        );
      }

      setTimeout(() => {
        const index =
          getNearestIndex();

        if (index >= 0) {
          activate(
            index,
            {
              updateHash: false
            }
          );
        }
      }, 500);
    }


    return {
      init,
      refresh,
      getPages,
      getActiveIndex:
        () => activeIndex,
      getFeed,
      getVideo,
      activate,
      next,
      previous,
      scrollToPage,
      playVideo,
      pauseAll
    };
  })();


  /* =========================================================
     UPLOAD SYSTEM
     ========================================================= */

  function getUploadBox() {
    return $("#uploadBox");
  }


  function openUploadBox() {
    const box =
      getUploadBox();

    if (!box) {
      return;
    }

    box.style.display =
      "flex";

    box.classList.add(
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
      "active"
    );

    box.style.display =
      "none";
  }


  function setupUploadCloseButtons() {
    const close =
      $("#closeUpload");

    if (close) {
      close.addEventListener(
        "click",
        event => {
          event.preventDefault();
          event.stopPropagation();

          closeUploadBox();
        }
      );
    }

    const box =
      getUploadBox();

    if (box) {
      box.addEventListener(
        "click",
        event => {
          if (
            event.target === box
          ) {
            closeUploadBox();
          }
        }
      );
    }
  }


  function setupCreateButton() {
    const create =
      $("#createBtn");

    if (!create) {
      return;
    }

    create.addEventListener(
      "click",
      event => {
        event.preventDefault();
        event.stopPropagation();

        openUploadBox();
      }
    );
  }


  function setupSelectVideoButton() {
    const select =
      $("#selectVideo");

    const input =
      $("#videoInput");

    if (
      !select ||
      !input
    ) {
      return;
    }

    select.addEventListener(
      "click",
      event => {
        event.preventDefault();
        event.stopPropagation();

        input.click();
      }
    );
  }


  function createUploadedPage(
    videoData
  ) {
    const feed =
      $(".video-feed");

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
      videoData.id;

    page.dataset.uid =
      videoData.uid || "guest";

    page.dataset.username =
      videoData.username ||
      "zylo_creator";

    const videoURL =
      makeServerVideoURL(
        videoData.url ||
        videoData.videoUrl ||
        videoData.serverURL
      );

    if (!videoURL) {
      return null;
    }

    page.innerHTML = `
      <video
        src="${escapeHTML(videoURL)}"
        muted
        playsinline
        webkit-playsinline
        preload="metadata"
        crossorigin="anonymous"
      ></video>

      <div class="video-overlay"></div>

      <button
        class="fullscreen-btn"
        type="button"
        aria-label="Fullscreen"
      ></button>

      <div class="right-actions">

        <button
          class="profile-action"
          type="button"
          aria-label="Profile"
        >
          <span>Z</span>
          <small>+</small>
        </button>

        <button
          class="action-btn like-btn"
          type="button"
          data-action="like"
        >
          <span class="like-icon"></span>
          <span class="like-count">0</span>
        </button>

        <button
          class="action-btn comment-btn"
          type="button"
          data-action="comment"
        >
          <span class="comment-icon"></span>
          <span class="comment-count">0</span>
        </button>

        <button
          class="action-btn save-btn"
          type="button"
          data-action="save"
        >
          <span class="save-icon"></span>
          <span class="save-label">Save</span>
        </button>

        <button
          class="action-btn share-btn"
          type="button"
          data-action="share"
        >
          <span class="share-icon"></span>
          <span class="share-label">Share</span>
        </button>

        <button
          class="music-btn"
          type="button"
          aria-label="Music"
        >
          <span>Music</span>
        </button>

      </div>

      <div class="video-info">

        <strong>
          @${escapeHTML(
            videoData.username ||
            "zylo_creator"
          )}
        </strong>

        <p>
          ${escapeHTML(
            videoData.name ||
            "ZYLO Video"
          )}
        </p>

        <p>
          Create • Connect • Grow
        </p>

        <p>
          #ZYLO #ShortVideo #Create
        </p>

        <p>
          Original sound • ZYLO Creator
        </p>

      </div>
    `;

    const video =
      $("video", page);

    if (video) {
      video.dataset.zyloPrimary =
        videoURL;
    }

    feed.appendChild(page);

    return page;
  }


  /* =========================================================
     SERVER VIDEO LIST
     ========================================================= */

  async function loadServerVideos() {
    try {
      const response =
        await fetch(
          CONFIG.API_BASE_URL +
            "/api/videos",
          {
            method: "GET",
            cache: "no-store"
          }
        );

      if (!response.ok) {
        throw new Error(
          "Video list failed: " +
            response.status
        );
      }

      const result =
        await response.json();

      if (
        !result ||
        !Array.isArray(
          result.videos
        )
      ) {
        return [];
      }

      const serverVideos =
        result.videos
          .map(video => {
            const url =
              makeServerVideoURL(
                video.url ||
                video.videoUrl ||
                video.fileUrl ||
                video.path
              );

            if (!url) {
              return null;
            }

            return {
              id:
                video.id ||
                video.videoId ||
                makeId("server-video"),

              uid:
                video.uid ||
                "guest",

              username:
                video.username ||
                "zylo_creator",

              name:
                video.originalName ||
                video.name ||
                "ZYLO Video",

              url,

              serverURL: url,

              createdAt:
                video.createdAt ||
                Date.now(),

              size:
                video.size ||
                0,

              type:
                video.mimetype ||
                video.type ||
                "video/mp4"
            };
          })
          .filter(Boolean);

      if (!serverVideos.length) {
        return [];
      }

      const localVideos =
        getStorage(
          CONFIG.STORAGE.UPLOADED_VIDEOS,
          []
        );

      const merged = [
        ...serverVideos,
        ...(
          Array.isArray(localVideos)
            ? localVideos
            : []
        )
      ];

      const unique = [];
      const ids = new Set();
      const urls = new Set();

      merged.forEach(video => {
        if (!video) {
          return;
        }

        const id =
          String(
            video.id || ""
          );

        const url =
          makeServerVideoURL(
            video.url ||
            video.serverURL
          );

        if (
          id &&
          ids.has(id)
        ) {
          return;
        }

        if (
          url &&
          urls.has(url)
        ) {
          return;
        }

        if (id) {
          ids.add(id);
        }

        if (url) {
          urls.add(url);
        }

        unique.push({
          ...video,
          url,
          serverURL: url
        });
      });

      setStorage(
        CONFIG.STORAGE.UPLOADED_VIDEOS,
        unique
      );

      return serverVideos;
    } catch (error) {
      console.warn(
        "ZYLO server video list error:",
        error
      );

      return [];
    }
  }


  async function restoreServerVideos() {
    const serverVideos =
      await loadServerVideos();

    if (!serverVideos.length) {
      return;
    }

    const feed =
      $(".video-feed");

    if (!feed) {
      return;
    }

    /*
     * Server videos are already
     * in the backend.
     *
     * Never create duplicate pages.
     */
    serverVideos
      .slice()
      .reverse()
      .forEach(videoData => {
        const existing =
          $(
            `.video-page[data-video-id="${CSS.escape(
              String(videoData.id)
            )}"]`,
            feed
          );

        if (existing) {
          return;
        }

        createUploadedPage(
          videoData
        );
      });

    VideoEngine.refresh();

    setupLikeButtons();
    setupSaveButtons();
    setupCommentButtons();
    setupShareButtons();
    setupMusicButtons();
    setupFullscreenButtons();
    setupDoubleTapLike();
    setupCreatorProfileButtons();
    setupVideoClick();

    restoreActionStates();
  }


  /* =========================================================
     REAL UPLOAD
     ========================================================= */

  async function uploadVideo(file) {
    if (!file) {
      return;
    }

    if (
      !file.type ||
      !file.type.startsWith("video/")
    ) {
      alert(
        "Please select a video file."
      );
      return;
    }

    if (
      file.size >
      CONFIG.UPLOAD.MAX_SIZE
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
      file,
      file.name
    );

    formData.append(
      "uid",
      uid
    );

    formData.append(
      "username",
      username
    );

    /*
     * IMPORTANT:
     *
     * There is NO blob/local fallback here.
     *
     * If Render upload fails,
     * the upload is considered failed.
     */

    let serverURL = "";
    let serverVideoId = "";

    try {
      console.log(
        "ZYLO: uploading:",
        file.name
      );

      const controller =
        new AbortController();

      const timeout =
        setTimeout(() => {
          controller.abort();
        }, CONFIG.UPLOAD.TIMEOUT);

      let response;

      try {
        response =
          await fetch(
            CONFIG.API_BASE_URL +
              "/api/upload",
            {
              method: "POST",
              body: formData,
              signal:
                controller.signal
            }
          );
      } finally {
        clearTimeout(timeout);
      }

      if (!response.ok) {
        let message =
          "Upload failed.";

        try {
          const errorData =
            await response.json();

          message =
            errorData?.message ||
            errorData?.error ||
            message;
        } catch {}

        throw new Error(
          message +
            " HTTP " +
            response.status
        );
      }

      const result =
        await response.json();

      console.log(
        "ZYLO upload response:",
        result
      );

      serverURL =
        result?.url ||
        result?.videoUrl ||
        result?.fileUrl ||
        result?.video?.url ||
        "";

      serverVideoId =
        result?.videoId ||
        result?.video?.videoId ||
        result?.video?.id ||
        "";

      serverURL =
        makeServerVideoURL(
          serverURL
        );

      if (!serverURL) {
        throw new Error(
          "Server did not return a video URL."
        );
      }

    } catch (error) {
      console.error(
        "ZYLO upload failed:",
        error
      );

      if (
        error?.name ===
        "AbortError"
      ) {
        alert(
          "Upload took too long. Please try again."
        );
      } else {
        alert(
          "Video upload failed. Please try again."
        );
      }

      return false;
    }

    /*
     * Only save after server success.
     */

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

      createdAt:
        Date.now(),

      size:
        file.size,

      type:
        file.type
    };

    const uploads =
      getStorage(
        CONFIG.STORAGE.UPLOADED_VIDEOS,
        []
      );

    const filtered =
      Array.isArray(uploads)
        ? uploads.filter(
            item =>
              item?.id !==
              videoData.id &&
              item?.url !==
              videoData.url
          )
        : [];

    filtered.unshift(
      videoData
    );

    setStorage(
      CONFIG.STORAGE.UPLOADED_VIDEOS,
      filtered
    );

    const page =
      createUploadedPage(
        videoData
      );

    if (!page) {
      alert(
        "Upload succeeded, but the video page could not be created."
      );

      return false;
    }

    VideoEngine.refresh();

    setupLikeButtons();
    setupSaveButtons();
    setupCommentButtons();
    setupShareButtons();
    setupMusicButtons();
    setupFullscreenButtons();
    setupDoubleTapLike();
    setupCreatorProfileButtons();
    setupVideoClick();

    restoreActionStates();

    const allPages =
      VideoEngine.getPages();

    const index =
      allPages.indexOf(page);

    if (index >= 0) {
      VideoEngine.scrollToPage(
        index,
        "smooth"
      );
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
      "ZYLO: video uploaded successfully:",
      videoData
    );

    return true;
  }


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
      $(".video-feed");

    if (!feed) {
      return;
    }

    uploads
      .slice()
      .reverse()
      .forEach(videoData => {
        if (!videoData?.url) {
          return;
        }

        /*
         * Never restore blob:
         * blob:http://...
         */

        if (
          String(videoData.url)
            .startsWith("blob:")
        ) {
          return;
        }

        const serverURL =
          makeServerVideoURL(
            videoData.url
          );

        if (!serverURL) {
          return;
        }

        const existing =
          $(
            `.video-page[data-video-id="${CSS.escape(
              String(videoData.id)
            )}"]`,
            feed
          );

        if (existing) {
          return;
        }

        createUploadedPage({
          ...videoData,
          url: serverURL,
          serverURL
        });
      });
  }


  function setupUploadInput() {
    const input =
      $("#videoInput");

    if (!input) {
      return;
    }

    input.addEventListener(
      "change",
      async event => {
        const file =
          event.target?.files?.[0];

        if (!file) {
          return;
        }

        await uploadVideo(file);

        input.value = "";
      }
    );
  }


  function setupUpload() {
    setupCreateButton();
    setupSelectVideoButton();
    setupUploadCloseButtons();
    setupUploadInput();
  }


  /* =========================================================
     PAGE HELPERS
     ========================================================= */

  function getPageFromButton(button) {
    return button?.closest?.(
      ".video-page"
    );
  }


  function getPageId(page) {
    return (
      page?.dataset?.videoId ||
      page?.id ||
      makeId("page")
    );
  }


  /* =========================================================
     LIKE
     ========================================================= */

  function setupLikeButtons() {
    $$(".like-btn").forEach(
      button => {
        if (
          button.dataset.zyloBound ===
          "true"
        ) {
          return;
        }

        button.dataset.zyloBound =
          "true";

        const page =
          getPageFromButton(
            button
          );

        if (page) {
          const likes =
            getStorage(
              CONFIG.STORAGE.LIKES,
              {}
            );

          const id =
            getPageId(page);

          if (likes[id]) {
            button.classList.add(
              "liked"
            );
          }
        }

        button.addEventListener(
          "click",
          event => {
            event.preventDefault();
            event.stopPropagation();

            const currentPage =
              getPageFromButton(
                button
              );

            if (!currentPage) {
              return;
            }

            const id =
              getPageId(
                currentPage
              );

            const likes =
              getStorage(
                CONFIG.STORAGE.LIKES,
                {}
              );

            const current =
              Boolean(likes[id]);

            likes[id] =
              !current;

            setStorage(
              CONFIG.STORAGE.LIKES,
              likes
            );

            button.classList.toggle(
              "liked",
              !current
            );

            const count =
              $(".like-count", button);

            if (count) {
              let number =
                parseInt(
                  count.textContent ||
                    "0",
                  10
                ) || 0;

              number =
                !current
                  ? number + 1
                  : Math.max(
                      0,
                      number - 1
                    );

              count.textContent =
                String(number);
            }
          }
        );
      }
    );
  }


  /* =========================================================
     SAVE
     ========================================================= */

  function setupSaveButtons() {
    $$(".save-btn").forEach(
      button => {
        if (
          button.dataset.zyloBound ===
          "true"
        ) {
          return;
        }

        button.dataset.zyloBound =
          "true";

        button.addEventListener(
          "click",
          event => {
            event.preventDefault();
            event.stopPropagation();

            const page =
              getPageFromButton(
                button
              );

            if (!page) {
              return;
            }

            const id =
              getPageId(page);

            const saved =
              getStorage(
                CONFIG.STORAGE.SAVED,
                {}
              );

            const current =
              Boolean(saved[id]);

            saved[id] =
              !current;

            setStorage(
              CONFIG.STORAGE.SAVED,
              saved
            );

            button.classList.toggle(
              "saved",
              !current
            );

            const label =
              $(".save-label", button);

            if (label) {
              label.textContent =
                !current
                  ? "Saved"
                  : "Save";
            }
          }
        );
      }
    );
  }


  /* =========================================================
     COMMENTS
     ========================================================= */

  function getCommentsForVideo(id) {
    const all =
      getStorage(
        CONFIG.STORAGE.COMMENTS,
        {}
      );

    return Array.isArray(all[id])
      ? all[id]
      : [];
  }


  function setCommentsForVideo(
    id,
    comments
  ) {
    const all =
      getStorage(
        CONFIG.STORAGE.COMMENTS,
        {}
      );

    all[id] =
      comments;

    setStorage(
      CONFIG.STORAGE.COMMENTS,
      all
    );
  }


  function updateCommentCount(page) {
    if (!page) {
      return;
    }

    const id =
      getPageId(page);

    const comments =
      getCommentsForVideo(id);

    const count =
      $(".comment-count", page);

    if (count) {
      count.textContent =
        String(comments.length);
    }
  }


  function closeCommentPanel() {
    const panel =
      $(".zylo-comment-panel");

    if (panel) {
      panel.remove();
    }
  }


  function openCommentPanel(page) {
    if (!page) {
      return;
    }

    closeCommentPanel();

    const id =
      getPageId(page);

    const comments =
      getCommentsForVideo(id);

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
            class="zylo-comment-close"
          >×</button>
        </div>

        <div class="zylo-comment-list"></div>

        <div class="zylo-comment-input-row">

          <input
            type="text"
            class="zylo-comment-input"
            placeholder="Add a comment..."
            maxlength="500"
          />

          <button
            type="button"
            class="zylo-comment-send"
          >
            Send
          </button>

        </div>

      </div>
    `;

    document.body.appendChild(
      panel
    );

    const list =
      $(".zylo-comment-list", panel);

    function renderComments() {
      if (!list) {
        return;
      }

      if (!comments.length) {
        list.innerHTML =
          `<div class="zylo-no-comments">
             No comments yet.
           </div>`;

        return;
      }

      list.innerHTML =
        comments
          .map(
            comment => `
              <div class="zylo-comment-item">

                <strong>
                  @${escapeHTML(
                    comment.username ||
                    "zylo_creator"
                  )}
                </strong>

                <p>
                  ${escapeHTML(
                    comment.text
                  )}
                </p>

              </div>
            `
          )
          .join("");
    }

    renderComments();

    const close =
      $(".zylo-comment-close", panel);

    if (close) {
      close.addEventListener(
        "click",
        closeCommentPanel
      );
    }

    const send =
      $(".zylo-comment-send", panel);

    const input =
      $(".zylo-comment-input", panel);

    function sendComment() {
      const text =
        input?.value?.trim();

      if (!text) {
        return;
      }

      comments.push({
        id:
          makeId("comment"),

        uid:
          getUserUID(),

        username:
          getUsername(),

        text,

        createdAt:
          Date.now()
      });

      setCommentsForVideo(
        id,
        comments
      );

      updateCommentCount(page);

      if (input) {
        input.value = "";
      }

      renderComments();
    }

    if (send) {
      send.addEventListener(
        "click",
        sendComment
      );
    }

    if (input) {
      input.addEventListener(
        "keydown",
        event => {
          if (
            event.key ===
            "Enter"
          ) {
            event.preventDefault();
            sendComment();
          }
        }
      );

      setTimeout(() => {
        try {
          input.focus();
        } catch {}
      }, 100);
    }
  }


  function setupCommentButtons() {
    $$(".comment-btn").forEach(
      button => {
        if (
          button.dataset.zyloBound ===
          "true"
        ) {
          return;
        }

        button.dataset.zyloBound =
          "true";

        const page =
          getPageFromButton(
            button
          );

        if (page) {
          updateCommentCount(page);
        }

        button.addEventListener(
          "click",
          event => {
            event.preventDefault();
            event.stopPropagation();

            const currentPage =
              getPageFromButton(
                button
              );

            if (currentPage) {
              openCommentPanel(
                currentPage
              );
            }
          }
        );
      }
    );
  }


  /* =========================================================
     SHARE
     ========================================================= */

  async function shareVideo(page) {
    if (!page) {
      return;
    }

    const id =
      getPageId(page);

    const url =
      window.location.origin +
      window.location.pathname +
      "#" +
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

        return;
      }
    } catch {}

    try {
      await navigator.clipboard.writeText(
        url
      );

      alert(
        "Video link copied."
      );
    } catch {
      prompt(
        "Copy this video link:",
        url
      );
    }
  }


  function setupShareButtons() {
    $$(".share-btn").forEach(
      button => {
        if (
          button.dataset.zyloBound ===
          "true"
        ) {
          return;
        }

        button.dataset.zyloBound =
          "true";

        button.addEventListener(
          "click",
          async event => {
            event.preventDefault();
            event.stopPropagation();

            await shareVideo(
              getPageFromButton(
                button
              )
            );
          }
        );
      }
    );
  }


  /* =========================================================
     MUSIC
     ========================================================= */

  function setupMusicButtons() {
    $$(".music-btn").forEach(
      button => {
        if (
          button.dataset.zyloBound ===
          "true"
        ) {
          return;
        }

        button.dataset.zyloBound =
          "true";

        button.addEventListener(
          "click",
          event => {
            event.preventDefault();
            event.stopPropagation();

            const page =
              getPageFromButton(
                button
              );

            const video =
              page
                ? $("video", page)
                : null;

            if (!video) {
              return;
            }

            video.muted =
              !video.muted;

            button.classList.toggle(
              "muted",
              video.muted
            );

            if (!video.muted) {
              video.volume = 1;
            }
          }
        );
      }
    );
  }


  /* =========================================================
     FULLSCREEN
     ========================================================= */

  async function toggleFullscreen(page) {
    if (!page) {
      return;
    }

    try {
      if (
        document.fullscreenElement
      ) {
        await document.exitFullscreen();
        return;
      }

      if (
        page.requestFullscreen
      ) {
        await page.requestFullscreen();
        return;
      }

      const video =
        $("video", page);

      if (
        video &&
        video.webkitEnterFullscreen
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
    $$(".fullscreen-btn").forEach(
      button => {
        if (
          button.dataset.zyloBound ===
          "true"
        ) {
          return;
        }

        button.dataset.zyloBound =
          "true";

        button.addEventListener(
          "click",
          event => {
            event.preventDefault();
            event.stopPropagation();

            toggleFullscreen(
              getPageFromButton(
                button
              )
            );
          }
        );
      }
    );
  }


  /* =========================================================
     DOUBLE TAP LIKE
     ========================================================= */

  function setupDoubleTapLike() {
    $$(".video-page").forEach(
      page => {
        if (
          page.dataset.zyloDoubleTap ===
          "true"
        ) {
          return;
        }

        page.dataset.zyloDoubleTap =
          "true";

        let lastTap = 0;

        page.addEventListener(
          "click",
          event => {
            if (
              isInteractiveTarget(
                event.target
              )
            ) {
              return;
            }

            const now =
              Date.now();

            const difference =
              now - lastTap;

            if (
              difference > 0 &&
              difference < 320
            ) {
              const like =
                $(".like-btn", page);

              if (like) {
                like.click();
              }
            }

            lastTap = now;
          }
        );
      }
    );
  }


  /* =========================================================
     CREATOR PROFILE
     ========================================================= */

  function getCreatorFromPage(page) {
    return {
      uid:
        page?.dataset?.uid ||
        "guest",

      username:
        page?.dataset?.username ||
        "zylo_creator"
    };
  }


  function getCreatorVideos(
    uid,
    username
  ) {
    return VideoEngine
      .getPages()
      .filter(page => {
        return (
          (
            uid &&
            page.dataset.uid === uid
          ) ||
          (
            username &&
            page.dataset.username ===
              username
          )
        );
      });
  }


  function isFollowing(uid) {
    const follows =
      getStorage(
        CONFIG.STORAGE.FOLLOWS,
        {}
      );

    return Boolean(
      follows[uid]
    );
  }


  function toggleFollow(uid) {
    const follows =
      getStorage(
        CONFIG.STORAGE.FOLLOWS,
        {}
      );

    const current =
      Boolean(follows[uid]);

    follows[uid] =
      !current;

    setStorage(
      CONFIG.STORAGE.FOLLOWS,
      follows
    );

    return !current;
  }


  function closeCreatorProfile() {
    const panel =
      $(".zylo-profile-panel");

    if (panel) {
      panel.remove();
    }
  }


  function showCreatorProfile(page) {
    if (!page) {
      return;
    }

    closeCreatorProfile();

    const creator =
      getCreatorFromPage(page);

    const videos =
      getCreatorVideos(
        creator.uid,
        creator.username
      );

    const following =
      isFollowing(
        creator.uid
      );

    const panel =
      document.createElement(
        "div"
      );

    panel.className =
      "zylo-profile-panel";

    panel.innerHTML = `
      <div class="zylo-profile-inner">

        <div class="zylo-profile-header">

          <div class="zylo-profile-avatar">
            Z
          </div>

          <div class="zylo-profile-name">
            @${escapeHTML(
              creator.username
            )}
          </div>

          <button
            type="button"
            class="zylo-profile-close"
          >
            ×
          </button>

        </div>

        <div class="zylo-profile-stats">

          <span>
            <strong>
              ${videos.length}
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

        <button
          type="button"
          class="zylo-follow-button ${
            following
              ? "following"
              : ""
          }"
        >
          ${
            following
              ? "Following"
              : "Follow"
          }
        </button>

        <div class="zylo-profile-videos">

          ${
            videos.length
              ? videos
                  .map(
                    videoPage => {
                      const video =
                        $("video", videoPage);

                      const source =
                        video?.dataset
                          ?.zyloPrimary ||
                        video?.currentSrc ||
                        video?.src ||
                        "";

                      return `
                        <div
                          class="zylo-profile-video"
                          data-video-id="${escapeHTML(
                            videoPage.dataset
                              .videoId ||
                              ""
                          )}"
                        >

                          ${
                            source
                              ? `
                                <video
                                  src="${escapeHTML(
                                    source
                                  )}"
                                  muted
                                  playsinline
                                  preload="metadata"
                                ></video>
                              `
                              : ""
                          }

                        </div>
                      `;
                    }
                  )
                  .join("")
              : `
                <div class="zylo-empty-profile">
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

    const close =
      $(".zylo-profile-close", panel);

    if (close) {
      close.addEventListener(
        "click",
        closeCreatorProfile
      );
    }

    const follow =
      $(".zylo-follow-button", panel);

    if (follow) {
      follow.addEventListener(
        "click",
        () => {
          const state =
            toggleFollow(
              creator.uid
            );

          follow.textContent =
            state
              ? "Following"
              : "Follow";

          follow.classList.toggle(
            "following",
            state
          );
        }
      );
    }

    $$(".zylo-profile-video", panel)
      .forEach(
        thumb => {
          thumb.addEventListener(
            "click",
            () => {
              const id =
                thumb.dataset
                  .videoId;

              const allPages =
                VideoEngine.getPages();

              const target =
                allPages.find(
                  item =>
                    item.dataset
                      .videoId ===
                    id
                );

              if (!target) {
                return;
              }

              closeCreatorProfile();

              const index =
                allPages.indexOf(
                  target
                );

              if (index >= 0) {
                VideoEngine.scrollToPage(
                  index,
                  "smooth"
                );
              }
            }
          );
        }
      );
  }


  function setupCreatorProfileButtons() {
    $$(".profile-action").forEach(
      button => {
        if (
          button.dataset.zyloBound ===
          "true"
        ) {
          return;
        }

        button.dataset.zyloBound =
          "true";

        button.addEventListener(
          "click",
          event => {
            event.preventDefault();
            event.stopPropagation();

            showCreatorProfile(
              getPageFromButton(
                button
              )
            );
          }
        );
      }
    );
  }


  /* =========================================================
     SEARCH
     ========================================================= */

  function closeSearchPanel() {
    const panel =
      $(".zylo-search-panel");

    if (panel) {
      panel.remove();
    }
  }


  function openSearchPanel() {
    closeSearchPanel();

    const panel =
      document.createElement(
        "div"
      );

    panel.className =
      "zylo-search-panel";

    panel.innerHTML = `
      <div class="zylo-search-inner">

        <div class="zylo-search-header">

          <strong>
            Search
          </strong>

          <button
            type="button"
            class="zylo-search-close"
          >
            ×
          </button>

        </div>

        <input
          type="search"
          class="zylo-search-input"
          placeholder="Search creators or videos..."
          autocomplete="off"
        />

        <div
          class="zylo-search-results"
        ></div>

      </div>
    `;

    document.body.appendChild(
      panel
    );

    const close =
      $(".zylo-search-close", panel);

    if (close) {
      close.addEventListener(
        "click",
        closeSearchPanel
      );
    }

    const input =
      $(".zylo-search-input", panel);

    const results =
      $(".zylo-search-results", panel);

    function performSearch() {
      const query =
        input?.value
          ?.trim()
          .toLowerCase() ||
        "";

      const pages =
        VideoEngine.getPages();

      if (!results) {
        return;
      }

      if (!query) {
        results.innerHTML =
          "<p>Type something to search.</p>";

        return;
      }

      const matches =
        pages.filter(page => {
          const username =
            (
              page.dataset.username ||
              ""
            ).toLowerCase();

          const text =
            (
              page.textContent ||
              ""
            ).toLowerCase();

          return (
            username.includes(query) ||
            text.includes(query)
          );
        });

      if (!matches.length) {
        results.innerHTML =
          "<p>No videos found.</p>";

        return;
      }

      results.innerHTML =
        matches
          .map(
            page => `
              <button
                type="button"
                class="zylo-search-result"
                data-video-id="${escapeHTML(
                  page.dataset
                    .videoId ||
                    ""
                )}"
              >
                @${escapeHTML(
                  page.dataset
                    .username ||
                    "zylo_creator"
                )}
              </button>
            `
          )
          .join("");

      $$(".zylo-search-result", results)
        .forEach(
          result => {
            result.addEventListener(
              "click",
              () => {
                const id =
                  result.dataset
                    .videoId;

                const currentPages =
                  VideoEngine.getPages();

                const target =
                  currentPages.find(
                    page =>
                      page.dataset
                        .videoId ===
                      id
                  );

                if (!target) {
                  return;
                }

                closeSearchPanel();

                const index =
                  currentPages.indexOf(
                    target
                  );

                if (index >= 0) {
                  VideoEngine.scrollToPage(
                    index,
                    "smooth"
                  );
                }
              }
            );
          }
        );
    }

    if (input) {
      input.addEventListener(
        "input",
        performSearch
      );

      setTimeout(() => {
        try {
          input.focus();
        } catch {}
      }, 100);
    }
  }


  /* =========================================================
     MY PROFILE
     ========================================================= */

  function closeMyProfile() {
    const panel =
      $(".zylo-my-profile-panel");

    if (panel) {
      panel.remove();
    }
  }


  function showMyProfile() {
    closeMyProfile();

    const uid =
      getUserUID();

    const username =
      getUsername();

    const pages =
      VideoEngine.getPages();

    const myVideos =
      pages.filter(page => {
        return (
          page.dataset.uid === uid ||
          page.dataset.username ===
            username
        );
      });

    const panel =
      document.createElement(
        "div"
      );

    panel.className =
      "zylo-my-profile-panel";

    panel.innerHTML = `
      <div class="zylo-my-profile-inner">

        <div class="zylo-my-profile-header">

          <div class="zylo-my-profile-avatar">
            Z
          </div>

          <div>

            <strong>
              @${escapeHTML(
                username
              )}
            </strong>

            <p>
              My Profile
            </p>

          </div>

          <button
            type="button"
            class="zylo-my-profile-close"
          >
            ×
          </button>

        </div>

        <div class="zylo-my-profile-stats">

          <span>
            <strong>
              ${myVideos.length}
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

        <div class="zylo-my-videos">

          ${
            myVideos.length
              ? myVideos
                  .map(
                    page => {
                      const video =
                        $("video", page);

                      const source =
                        video?.dataset
                          ?.zyloPrimary ||
                        video?.currentSrc ||
                        video?.src ||
                        "";

                      return `
                        <div
                          class="zylo-my-video"
                          data-video-id="${escapeHTML(
                            page.dataset
                              .videoId ||
                              ""
                          )}"
                        >

                          ${
                            source
                              ? `
                                <video
                                  src="${escapeHTML(
                                    source
                                  )}"
                                  muted
                                  playsinline
                                  preload="metadata"
                                ></video>
                              `
                              : ""
                          }

                        </div>
                      `;
                    }
                  )
                  .join("")
              : `
                <div class="zylo-empty-profile">
                  You have not uploaded any videos yet.
                </div>
              `
          }

        </div>

      </div>
    `;

    document.body.appendChild(
      panel
    );

    const close =
      $(".zylo-my-profile-close", panel);

    if (close) {
      close.addEventListener(
        "click",
        closeMyProfile
      );
    }

    $$(".zylo-my-video", panel)
      .forEach(
        item => {
          item.addEventListener(
            "click",
            () => {
              const id =
                item.dataset
                  .videoId;

              const allPages =
                VideoEngine.getPages();

              const target =
                allPages.find(
                  page =>
                    page.dataset
                      .videoId ===
                    id
                );

              if (!target) {
                return;
              }

              closeMyProfile();

              const index =
                allPages.indexOf(
                  target
                );

              if (index >= 0) {
                VideoEngine.scrollToPage(
                  index,
                  "smooth"
                );
              }
            }
          );
        }
      );
  }


  /* =========================================================
     INBOX
     ========================================================= */

  function closeInboxPanel() {
    const panel =
      $(".zylo-inbox-panel");

    if (panel) {
      panel.remove();
    }
  }


  function openInboxPanel() {
    closeInboxPanel();

    const panel =
      document.createElement(
        "div"
      );

    panel.className =
      "zylo-inbox-panel";

    panel.innerHTML = `
      <div class="zylo-inbox-inner">

        <div class="zylo-inbox-header">

          <strong>
            Inbox
          </strong>

          <button
            type="button"
            class="zylo-inbox-close"
          >
            ×
          </button>

        </div>

        <div class="zylo-inbox-content">
          <p>
            No new notifications.
          </p>
        </div>

      </div>
    `;

    document.body.appendChild(
      panel
    );

    const close =
      $(".zylo-inbox-close", panel);

    if (close) {
      close.addEventListener(
        "click",
        closeInboxPanel
      );
    }
  }


  /* =========================================================
     NAVIGATION
     ========================================================= */

  function setupNavigation() {
    $$(".nav-item").forEach(
      item => {
        if (
          item.dataset.zyloBound ===
          "true"
        ) {
          return;
        }

        item.dataset.zyloBound =
          "true";

        item.addEventListener(
          "click",
          event => {
            event.preventDefault();

            const nav =
              item.dataset.nav;

            if (
              nav === "home"
            ) {
              const feed =
                VideoEngine.getFeed();

              if (feed) {
                feed.scrollTo({
                  top: 0,
                  behavior: "smooth"
                });
              }

              setTimeout(() => {
                VideoEngine.activate(
                  0
                );
              }, 350);
            }

            if (
              nav === "profile"
            ) {
              showMyProfile();
            }

            if (
              nav === "discover"
            ) {
              openSearchPanel();
            }

            if (
              nav === "inbox"
            ) {
              openInboxPanel();
            }
          }
        );
      }
    );


    $$("[data-feed-tab]")
      .forEach(tab => {
        if (
          tab.dataset.zyloBound ===
          "true"
        ) {
          return;
        }

        tab.dataset.zyloBound =
          "true";

        tab.addEventListener(
          "click",
          event => {
            event.preventDefault();

            /*
             * Do not hide videos.
             */
            VideoEngine.refresh();
          }
        );
      });
  }


  /* =========================================================
     VIDEO CLICK
     ========================================================= */

  function setupVideoClick() {
    $$(".video-page").forEach(
      page => {
        const video =
          $("video", page);

        if (!video) {
          return;
        }

        if (
          video.dataset
            .zyloClickBound ===
          "true"
        ) {
          return;
        }

        video.dataset
          .zyloClickBound =
          "true";

        video.addEventListener(
          "click",
          event => {
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

              video.play()
                .catch(() => {});
            } else {
              video.pause();
            }
          }
        );
      }
    );
  }


  /* =========================================================
     VISIBILITY
     ========================================================= */

  function setupVisibility() {
    document.addEventListener(
      "visibilitychange",
      () => {
        if (
          document.hidden
        ) {
          VideoEngine.pauseAll();
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
     RESIZE
     ========================================================= */

  function setupResize() {
    let timer = null;

    window.addEventListener(
      "resize",
      () => {
        clearTimeout(timer);

        timer =
          setTimeout(() => {
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
          }, 200);
      },
      {
        passive: true
      }
    );
  }


  /* =========================================================
     AUTH EVENTS
     ========================================================= */

  function setupAuthEvents() {
    window.addEventListener(
      "zylo:authloaded",
      () => {
        setTimeout(() => {
          VideoEngine.refresh();
        }, 200);
      }
    );

    window.addEventListener(
      "zylo:authchange",
      () => {
        VideoEngine.refresh();
      }
    );

    window.addEventListener(
      "zylo:uploaded",
      () => {
        VideoEngine.refresh();

        setupLikeButtons();
        setupSaveButtons();
        setupCommentButtons();
        setupShareButtons();
        setupMusicButtons();
        setupFullscreenButtons();
        setupDoubleTapLike();
        setupCreatorProfileButtons();
        setupVideoClick();

        restoreActionStates();
      }
    );
  }


  /* =========================================================
     RESTORE ACTION STATES
     ========================================================= */

  function restoreActionStates() {
    const likes =
      getStorage(
        CONFIG.STORAGE.LIKES,
        {}
      );

    const saved =
      getStorage(
        CONFIG.STORAGE.SAVED,
        {}
      );

    $$(".video-page").forEach(
      page => {
        const id =
          getPageId(page);

        const like =
          $(".like-btn", page);

        if (
          like &&
          likes[id]
        ) {
          like.classList.add(
            "liked"
          );
        }

        const save =
          $(".save-btn", page);

        if (
          save &&
          saved[id]
        ) {
          save.classList.add(
            "saved"
          );

          const label =
            $(".save-label", save);

          if (label) {
            label.textContent =
              "Saved";
          }
        }

        updateCommentCount(page);
      }
    );
  }


  /* =========================================================
     FUNCTIONAL STYLES ONLY
     ========================================================= */

  function injectOnlyFunctionalStyles() {
    if (
      document.getElementById(
        "zylo-functional-styles"
      )
    ) {
      return;
    }

    const style =
      document.createElement(
        "style"
      );

    style.id =
      "zylo-functional-styles";

    style.textContent = `
      html,
      body {
        width: 100%;
        min-height: 100%;
        margin: 0;
      }

      .video-feed {
        overflow-y: auto !important;
        overflow-x: hidden !important;
        scroll-snap-type: y mandatory !important;
        -webkit-overflow-scrolling: touch !important;
        touch-action: pan-y !important;
        overscroll-behavior-y: contain;
      }

      .video-page {
        scroll-snap-align: start !important;
        scroll-snap-stop: always !important;
        min-height: 100dvh;
        height: 100dvh;
        flex: 0 0 100dvh;
        overflow: hidden;
      }

      .video-page > video {
        display: block;
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .zylo-comment-panel,
      .zylo-profile-panel,
      .zylo-my-profile-panel,
      .zylo-search-panel,
      .zylo-inbox-panel {
        position: fixed;
        inset: 0;
        z-index: 99999;
        display: flex;
        align-items: flex-end;
        justify-content: center;
        background: rgba(0,0,0,.55);
      }

      .zylo-comment-inner,
      .zylo-profile-inner,
      .zylo-my-profile-inner,
      .zylo-search-inner,
      .zylo-inbox-inner {
        width: min(100%, 560px);
        max-height: 85dvh;
        overflow: auto;
        background: #111;
        color: #fff;
        border-radius: 20px 20px 0 0;
        padding: 18px;
        box-sizing: border-box;
      }

      .zylo-comment-header,
      .zylo-profile-header,
      .zylo-my-profile-header,
      .zylo-search-header,
      .zylo-inbox-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
      }

      .zylo-comment-close,
      .zylo-profile-close,
      .zylo-my-profile-close,
      .zylo-search-close,
      .zylo-inbox-close {
        border: 0;
        background: transparent;
        color: #fff;
        font-size: 28px;
        cursor: pointer;
      }

      .zylo-comment-list {
        max-height: 50dvh;
        overflow-y: auto;
        padding: 12px 0;
      }

      .zylo-comment-item {
        padding: 10px 0;
        border-bottom: 1px solid rgba(255,255,255,.12);
      }

      .zylo-comment-item p {
        margin: 4px 0 0;
      }

      .zylo-comment-input-row {
        display: flex;
        gap: 8px;
      }

      .zylo-comment-input,
      .zylo-search-input {
        flex: 1;
        min-width: 0;
        border: 1px solid rgba(255,255,255,.2);
        background: rgba(255,255,255,.08);
        color: #fff;
        border-radius: 12px;
        padding: 12px;
        box-sizing: border-box;
      }

      .zylo-comment-send,
      .zylo-follow-button {
        border: 0;
        border-radius: 12px;
        padding: 10px 16px;
        cursor: pointer;
      }

      .zylo-profile-stats,
      .zylo-my-profile-stats {
        display: flex;
        justify-content: space-around;
        gap: 12px;
        padding: 18px 0;
        text-align: center;
      }

      .zylo-profile-stats span,
      .zylo-my-profile-stats span {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .zylo-profile-videos,
      .zylo-my-videos {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 5px;
        margin-top: 16px;
      }

      .zylo-profile-video,
      .zylo-my-video {
        aspect-ratio: 9 / 16;
        overflow: hidden;
        border-radius: 6px;
        background: #222;
        cursor: pointer;
      }

      .zylo-profile-video video,
      .zylo-my-video video {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .zylo-search-results {
        padding-top: 14px;
      }

      .zylo-search-result {
        width: 100%;
        text-align: left;
        border: 0;
        background: rgba(255,255,255,.08);
        color: #fff;
        padding: 12px;
        margin-bottom: 6px;
        border-radius: 10px;
        cursor: pointer;
      }

      .zylo-empty-profile,
      .zylo-no-comments {
        padding: 30px 10px;
        text-align: center;
        opacity: .75;
      }
    `;

    document.head.appendChild(
      style
    );
  }


  /* =========================================================
     INITIALIZATION
     ========================================================= */

  async function initializeZYLO() {
    injectOnlyFunctionalStyles();

    loadAuthJS();

    /*
     * Restore cached server URLs first.
     */
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

    setupUpload();

    setupNavigation();

    setupVideoClick();

    setupVisibility();

    setupResize();

    setupAuthEvents();

    restoreActionStates();

    /*
     * IMPORTANT:
     *
     * Now ask Render for the real
     * server-side video list.
     */
    await restoreServerVideos();

    VideoEngine.refresh();

    restoreActionStates();

    const index =
      VideoEngine.getActiveIndex();

    if (index >= 0) {
      VideoEngine.activate(
        index,
        {
          updateHash: false
        }
      );
    } else if (
      VideoEngine.getPages().length
    ) {
      VideoEngine.activate(
        0,
        {
          updateHash: false
        }
      );
    }

    console.log(
      "ZYLO: Video System initialized successfully."
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

  window.ZYLO = {
    VideoEngine,

    uploadVideo,

    openUploadBox,

    closeUploadBox,

    openSearchPanel,

    showMyProfile,

    showCreatorProfile,

    openInboxPanel,

    loadServerVideos
  };

})();
