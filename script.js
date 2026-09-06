/* =========================================================
   ZYLO - COMPLETE FRONTEND ENGINE v1009

   FAST VIDEO PLAYBACK
   SMART VIDEO LOADING
   AUTO PLAY
   AUTO NEXT
   UPLOAD + PREVIEW
   LIKE + SAVE + COMMENT + SHARE
   MUSIC + FULLSCREEN
   FOLLOW + SEARCH + PROFILE
   AUTH BRIDGE

   UI / CSS / BUTTON DESIGN IS NOT CHANGED.
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
      "https://cdn.jsdelivr.net/gh/golammostofa89076-sys/zylo@main/backend/uploads/video1.mp4",

    LOCAL_VIDEO:
      "./backend/uploads/video1.mp4",

    STORAGE: {
      UPLOADED_VIDEOS:
        "zylo_uploaded_videos_v5",

      LIKES:
        "zylo_likes_v5",

      SAVED:
        "zylo_saved_v5",

      COMMENTS:
        "zylo_comments_v5",

      FOLLOWS:
        "zylo_follows_v5"
    },

    VIDEO: {
      PRELOAD_AHEAD: 1,
      PRELOAD_BEHIND: 0,

      VISIBILITY: 0.70,

      SWIPE_THRESHOLD: 55,

      PLAY_RETRY_MS: 250,

      AUTO_NEXT_DELAY_MS: 100,

      SCROLL_SETTLE_MS: 100,

      WHEEL_LOCK_MS: 550
    },

    UPLOAD: {
      MAX_SIZE:
        200 * 1024 * 1024
    }
  };


  /* =========================================================
     HELPERS
     ========================================================= */

  const $ = (
    selector,
    root = document
  ) => {
    try {
      return root.querySelector(selector);
    } catch {
      return null;
    }
  };


  const $$ = (
    selector,
    root = document
  ) => {
    try {
      return Array.from(
        root.querySelectorAll(selector)
      );
    } catch {
      return [];
    }
  };


  function safeJSONParse(
    value,
    fallback
  ) {
    try {
      return value
        ? JSON.parse(value)
        : fallback;
    } catch {
      return fallback;
    }
  }


  function getStorage(
    key,
    fallback
  ) {
    try {
      return safeJSONParse(
        localStorage.getItem(key),
        fallback
      );
    } catch {
      return fallback;
    }
  }


  function setStorage(
    key,
    value
  ) {
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


  function makeId(
    prefix = "zylo"
  ) {
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
      .replaceAll(
        "&",
        "&amp;"
      )
      .replaceAll(
        "<",
        "&lt;"
      )
      .replaceAll(
        ">",
        "&gt;"
      )
      .replaceAll(
        '"',
        "&quot;"
      )
      .replaceAll(
        "'",
        "&#039;"
      );
  }


  function isInteractiveTarget(
    target
  ) {
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
     AUTH
     ========================================================= */

  function getCurrentUser() {
    try {
      if (
        window.ZYLOAuth &&
        typeof window.ZYLOAuth
          .getCurrentUser ===
          "function"
      ) {
        return window.ZYLOAuth
          .getCurrentUser();
      }

      if (
        window.ZYLOAuth?.currentUser
      ) {
        return window.ZYLOAuth
          .currentUser;
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
      localStorage.getItem(
        "zylo_uid"
      ) ||
      "guest"
    );
  }


  function getUsername() {
    const user =
      getCurrentUser();

    return (
      user?.displayName ||
      user?.username ||
      localStorage.getItem(
        "zylo_username"
      ) ||
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
      document.createElement(
        "script"
      );

    script.type = "module";

    script.src =
      "./auth.js?v=1009";

    script.dataset.zyloAuth =
      "true";

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

    document.head.appendChild(
      script
    );
  }


  /* =========================================================
     VIDEO SOURCE
     ========================================================= */

  function isDefaultVideo(
    source
  ) {
    if (!source) return false;

    const value =
      String(source)
        .split("?")[0]
        .replaceAll(
          "\\",
          "/"
        );

    return (
      value.includes(
        "backend/uploads/video1.mp4"
      ) ||
      value.includes(
        "/video1.mp4"
      )
    );
  }


  function getVideoOriginalSource(
    video
  ) {
    if (!video) {
      return CONFIG.DEFAULT_VIDEO;
    }

    const custom =
      video.dataset
        .zyloOriginal ||
      video.dataset.src ||
      video.getAttribute(
        "data-src"
      );

    if (custom) {
      return custom;
    }

    const src =
      video.getAttribute(
        "src"
      ) ||
      video.src;

    if (src) {
      return src;
    }

    const sourceTag =
      $("source", video);

    if (sourceTag) {
      return (
        sourceTag.getAttribute(
          "src"
        ) ||
        sourceTag.dataset.src ||
        CONFIG.DEFAULT_VIDEO
      );
    }

    return CONFIG.DEFAULT_VIDEO;
  }


  function getVideoSources(
    video
  ) {
    const original =
      getVideoOriginalSource(
        video
      );

    if (
      isDefaultVideo(
        original
      )
    ) {
      return [
        CONFIG.DEFAULT_VIDEO,
        CONFIG.LOCAL_VIDEO
      ];
    }

    return [original];
  }


  function prepareVideo(
    video
  ) {
    if (!video) return;

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

    video.loop = false;
    video.removeAttribute(
      "loop"
    );
  }


  function sourceMatches(
    video,
    source
  ) {
    if (
      !video ||
      !source
    ) {
      return false;
    }

    const current =
      video.dataset
        .zyloCurrentSource ||
      video.currentSrc ||
      video.src ||
      "";

    try {
      return (
        new URL(
          current,
          window.location.href
        ).href ===
        new URL(
          source,
          window.location.href
        ).href
      );
    } catch {
      return (
        current === source
      );
    }
  }


  /* =========================================================
     FAST VIDEO LOAD
     ========================================================= */

  async function loadVideoSource(
    video,
    source,
    shouldPlay = false
  ) {
    if (
      !video ||
      !source
    ) {
      return false;
    }

    try {
      prepareVideo(video);

      /*
       * IMPORTANT:
       * Do NOT reload the same video.
       * This is the main speed fix.
       */

      const alreadyLoaded =
        sourceMatches(
          video,
          source
        ) &&
        video.readyState >= 2;

      if (!alreadyLoaded) {
        video.dataset
          .zyloCurrentSource =
          source;

        video.src =
          source;

        video.preload =
          "auto";

        video.load();

        /*
         * Do not wait 7 seconds.
         * Metadata/canplay is enough.
         */

        await new Promise(
          (resolve) => {
            let finished =
              false;

            const done =
              () => {
                if (finished) {
                  return;
                }

                finished =
                  true;

                cleanup();

                resolve(true);
              };

            const failed =
              () => {
                if (finished) {
                  return;
                }

                finished =
                  true;

                cleanup();

                resolve(false);
              };

            const cleanup =
              () => {
                video.removeEventListener(
                  "loadedmetadata",
                  done
                );

                video.removeEventListener(
                  "canplay",
                  done
                );

                video.removeEventListener(
                  "error",
                  failed
                );
              };

            video.addEventListener(
              "loadedmetadata",
              done,
              {
                once: true
              }
            );

            video.addEventListener(
              "canplay",
              done,
              {
                once: true
              }
            );

            video.addEventListener(
              "error",
              failed,
              {
                once: true
              }
            );

            /*
             * Fast timeout.
             * We don't block playback for seconds.
             */

            setTimeout(
              () => {
                if (
                  !finished
                ) {
                  if (
                    video.readyState >=
                    1
                  ) {
                    done();
                  } else {
                    failed();
                  }
                }
              },
              1800
            );
          }
        );
      }

      if (shouldPlay) {
        return await playVideo(
          video
        );
      }

      return true;
    } catch (
      error
    ) {
      console.warn(
        "ZYLO video source error:",
        error
      );

      return false;
    }
  }


  async function ensureVideoLoaded(
    video,
    shouldPlay = false
  ) {
    if (!video) {
      return false;
    }

    prepareVideo(video);

    const sources =
      getVideoSources(
        video
      );

    /*
     * Already working source:
     * use it immediately.
     */

    if (
      video.currentSrc &&
      video.readyState >= 2
    ) {
      if (shouldPlay) {
        return await playVideo(
          video
        );
      }

      return true;
    }

    const currentIndex =
      Number(
        video.dataset
          .zyloSourceIndex ||
          0
      );

    /*
     * Try current source first.
     */

    for (
      let i = currentIndex;
      i < sources.length;
      i++
    ) {
      const success =
        await loadVideoSource(
          video,
          sources[i],
          shouldPlay
        );

      if (success) {
        video.dataset
          .zyloSourceIndex =
          String(i);

        return true;
      }
    }

    /*
     * If current source failed,
     * try all sources again.
     */

    for (
      let i = 0;
      i < currentIndex;
      i++
    ) {
      const success =
        await loadVideoSource(
          video,
          sources[i],
          shouldPlay
        );

      if (success) {
        video.dataset
          .zyloSourceIndex =
          String(i);

        return true;
      }
    }

    return false;
  }


  /* =========================================================
     PLAY VIDEO
     ========================================================= */

  async function playVideo(
    video
  ) {
    if (!video) {
      return false;
    }

    prepareVideo(video);

    video.dataset
      .zyloActive =
      "true";

    video.muted = true;

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

      setTimeout(
        () => {
          if (
            video.dataset
              .zyloActive ===
            "true"
          ) {
            video.muted =
              true;

            video.play()
              .then(() => {
                video.dataset
                  .zyloPlaying =
                  "true";
              })
              .catch(() => {});
          }
        },
        CONFIG.VIDEO
          .PLAY_RETRY_MS
      );

      return false;
    }
  }


  /* =========================================================
     VIDEO ENGINE
     ========================================================= */

  const VideoEngine =
    (() => {
      let feed = null;
      let pages = [];
      let activeIndex = -1;

      let initialized =
        false;

      let scrollTimer =
        null;

      let wheelLocked =
        false;

      let autoNextLock =
        false;

      let touchStartX =
        0;

      let touchStartY =
        0;

      let touching =
        false;

      let intersectionObserver =
        null;

      let mutationObserver =
        null;


      function getFeed() {
        return $(
          ".video-feed"
        );
      }


      function getPages() {
        if (!feed) {
          feed =
            getFeed();
        }

        if (!feed) {
          return [];
        }

        return $$(".video-page", feed);
      }


      function getVideo(
        page
      ) {
        return page
          ? $("video", page)
          : null;
      }


      function registerVideo(
        video
      ) {
        if (!video) {
          return;
        }

        prepareVideo(video);

        if (
          video.dataset
            .zyloRegistered ===
          "true"
        ) {
          return;
        }

        video.dataset
          .zyloRegistered =
          "true";


        /*
         * Video ended
         */

        video.addEventListener(
          "ended",
          () => {
            if (
              autoNextLock
            ) {
              return;
            }

            autoNextLock =
              true;

            const page =
              video.closest(
                ".video-page"
              );

            const index =
              pages.indexOf(
                page
              );

            if (
              index >= 0
            ) {
              activeIndex =
                index;
            }

            setTimeout(
              () => {
                next(true);

                setTimeout(
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


        /*
         * Video source error
         */

        video.addEventListener(
          "error",
          async () => {
            const sources =
              getVideoSources(
                video
              );

            const currentIndex =
              Number(
                video.dataset
                  .zyloSourceIndex ||
                  0
              );

            const nextIndex =
              currentIndex + 1;

            if (
              nextIndex >=
              sources.length
            ) {
              console.warn(
                "ZYLO: all video sources failed"
              );

              return;
            }

            video.dataset
              .zyloSourceIndex =
              String(
                nextIndex
              );

            await loadVideoSource(
              video,
              sources[
                nextIndex
              ],
              video.dataset
                .zyloActive ===
                "true"
            );
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


      async function activate(
        index,
        options = {}
      ) {
        refresh();

        if (
          !pages.length
        ) {
          return;
        }

        index =
          Math.max(
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

        activeIndex =
          index;


        /*
         * Activate page
         */

        pages.forEach(
          (
            item,
            itemIndex
          ) => {
            const active =
              itemIndex ===
              index;

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

            if (
              itemVideo
            ) {
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


        pauseAll(
          video
        );


        /*
         * FAST PATH:
         * If already loaded, play immediately.
         */

        if (
          video
        ) {
          let loaded =
            false;

          if (
            video.currentSrc &&
            video.readyState >= 2
          ) {
            loaded =
              true;
          } else {
            loaded =
              await ensureVideoLoaded(
                video,
                false
              );
          }

          if (
            loaded
          ) {
            await playVideo(
              video
            );
          }
        }


        /*
         * Preload next video
         */

        smartPreload(
          index
        );


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


      function smartPreload(
        index
      ) {
        pages.forEach(
          (
            page,
            i
          ) => {
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
              distance ===
              0
            ) {
              video.preload =
                "auto";

              return;
            }


            if (
              distance <=
              CONFIG.VIDEO
                .PRELOAD_AHEAD
            ) {
              video.preload =
                "metadata";

              /*
               * Load next video
               * without blocking current video.
               */

              if (
                !video.currentSrc
              ) {
                ensureVideoLoaded(
                  video,
                  false
                ).catch(
                  () => {}
                );
              }

              return;
            }


            if (
              distance <=
              CONFIG.VIDEO
                .PRELOAD_BEHIND
            ) {
              video.preload =
                "metadata";

              return;
            }


            video.preload =
              "none";
          }
        );
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

        const center =
          feedRect.top +
          feedRect.height / 2;

        let bestIndex =
          0;

        let bestDistance =
          Infinity;


        pages.forEach(
          (
            page,
            index
          ) => {
            const rect =
              page.getBoundingClientRect();

            const pageCenter =
              rect.top +
              rect.height / 2;

            const distance =
              Math.abs(
                pageCenter -
                  center
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
          !pages.length
        ) {
          return;
        }

        index =
          Math.max(
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

        page.scrollIntoView(
          {
            behavior,
            block: "start",
            inline: "nearest"
          }
        );


        setTimeout(
          () => {
            activate(
              index,
              {
                updateHash:
                  true
              }
            );
          },
          behavior ===
            "smooth"
            ? 250
            : 20
        );
      }


      function next(
        fromEnded = false
      ) {
        refresh();

        if (
          !pages.length
        ) {
          return;
        }

        const current =
          activeIndex >= 0
            ? activeIndex
            : findNearestIndex();

        if (
          current < 0
        ) {
          return;
        }

        const nextIndex =
          current + 1;

        if (
          nextIndex >=
          pages.length
        ) {
          if (
            fromEnded
          ) {
            console.log(
              "ZYLO: শেষ ভিডিওতে পৌঁছেছে"
            );
          }

          return;
        }

        scrollToPage(
          nextIndex,
          "smooth"
        );
      }


      function previous() {
        refresh();

        if (
          !pages.length
        ) {
          return;
        }

        const current =
          activeIndex >= 0
            ? activeIndex
            : findNearestIndex();

        if (
          current < 0
        ) {
          return;
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


      function handleWheel(
        event
      ) {
        if (!feed) {
          return;
        }

        if (
          isInteractiveTarget(
            event.target
          )
        ) {
          return;
        }

        if (
          Math.abs(
            event.deltaY
          ) < 12
        ) {
          return;
        }

        if (
          wheelLocked
        ) {
          return;
        }

        wheelLocked =
          true;

        if (
          event.deltaY > 0
        ) {
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


      function handleTouchStart(
        event
      ) {
        if (
          !event.touches ||
          !event.touches.length
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

        touching =
          true;
      }


      function handleTouchEnd(
        event
      ) {
        if (
          !touching
        ) {
          return;
        }

        touching =
          false;

        if (
          !event.changedTouches ||
          !event.changedTouches.length
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

        if (
          Math.abs(
            deltaY
          ) <
          Math.abs(
            deltaX
          )
        ) {
          return;
        }

        if (
          Math.abs(
            deltaY
          ) <
          CONFIG.VIDEO
            .SWIPE_THRESHOLD
        ) {
          return;
        }

        if (
          wheelLocked
        ) {
          return;
        }

        wheelLocked =
          true;

        if (
          deltaY < 0
        ) {
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

              if (
                index < 0
              ) {
                return;
              }

              if (
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
            CONFIG.VIDEO
              .SCROLL_SETTLE_MS
          );
      }


      function setupIntersectionObserver() {
        if (
          intersectionObserver
        ) {
          intersectionObserver.disconnect();
        }

        intersectionObserver =
          null;

        if (
          !(
            "IntersectionObserver" in
            window
          )
        ) {
          return;
        }

        intersectionObserver =
          new IntersectionObserver(
            (
              entries
            ) => {
              let best =
                null;

              entries.forEach(
                (
                  entry
                ) => {
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
                    best =
                      entry;
                  }
                }
              );

              if (
                !best
              ) {
                return;
              }

              const page =
                best.target;

              const index =
                pages.indexOf(
                  page
                );

              if (
                index >=
                  0 &&
                index !==
                  activeIndex &&
                best.intersectionRatio >=
                  CONFIG.VIDEO
                    .VISIBILITY
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
          (
            page
          ) => {
            intersectionObserver.observe(
              page
            );
          }
        );
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

        feed.style.touchAction =
          "pan-y";

        feed.style.webkitOverflowScrolling =
          "touch";


        pages.forEach(
          (
            page
          ) => {
            page.style.scrollSnapAlign =
              "start";

            page.style.scrollSnapStop =
              "always";
          }
        );
      }


      function refresh() {
        feed =
          getFeed();

        pages =
          getPages();

        forceScrolling();


        pages.forEach(
          (
            page
          ) => {
            registerVideo(
              getVideo(page)
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
        if (
          initialized
        ) {
          refresh();
          return;
        }

        initialized =
          true;

        refresh();


        if (!feed) {
          console.warn(
            "ZYLO: .video-feed not found."
          );

          return;
        }


        feed.addEventListener(
          "wheel",
          handleWheel,
          {
            passive: true
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


        const initialIndex =
          findNearestIndex();


        if (
          initialIndex >= 0
        ) {
          /*
           * Start almost immediately.
           */

          setTimeout(
            () => {
              activate(
                initialIndex,
                {
                  updateHash:
                    false
                }
              );
            },
            50
          );
        }


        console.log(
          "ZYLO Video Engine v1009 initialized"
        );
      }


      return {
        init,
        refresh,
        getPages,
        getActiveIndex:
          () => activeIndex,
        activate,
        next,
        previous,
        scrollToPage,
        playVideo
      };
    })();


  /* =========================================================
     URL
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

    const pages =
      VideoEngine.getPages();

    const page =
      pages.find(
        (
          item
        ) =>
          item.dataset.videoId ===
          id
      );

    if (!page) {
      return;
    }

    const index =
      pages.indexOf(
        page
      );

    if (
      index >= 0
    ) {
      setTimeout(
        () => {
          VideoEngine.scrollToPage(
            index,
            "auto"
          );
        },
        100
      );
    }
  }


  /* =========================================================
     VIDEO ID
     ========================================================= */

  function getVideoId(
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


  /* =========================================================
     LIKE
     ========================================================= */

  function getLikes() {
    const value =
      getStorage(
        CONFIG.STORAGE.LIKES,
        []
      );

    return Array.isArray(
      value
    )
      ? value
      : [];
  }


  function updateButtonCount(
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


  function setupLikes() {
    document.addEventListener(
      "click",
      (
        event
      ) => {
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
          getVideoId(
            button
          );

        if (!id) {
          return;
        }

        const likes =
          getLikes();

        const index =
          likes.indexOf(
            id
          );

        if (
          index >= 0
        ) {
          likes.splice(
            index,
            1
          );

          button.classList.remove(
            "active",
            "liked"
          );

          updateButtonCount(
            button,
            -1
          );
        } else {
          likes.push(id);

          button.classList.add(
            "active",
            "liked"
          );

          updateButtonCount(
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


    $$(".like-btn")
      .forEach(
        (
          button
        ) => {
          const id =
            getVideoId(
              button
            );

          if (
            getLikes().includes(
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

  function setupSave() {
    document.addEventListener(
      "click",
      (
        event
      ) => {
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
          getVideoId(
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
          saved.indexOf(
            id
          );

        if (
          index >= 0
        ) {
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
      !Array.isArray(
        value
      )
      ? value
      : {};
  }


  function closeComments() {
    $$(".zylo-comment-panel")
      .forEach(
        (
          panel
        ) =>
          panel.remove()
      );
  }


  function openComments(
    button
  ) {
    const id =
      getVideoId(
        button
      );

    if (!id) {
      return;
    }

    closeComments();

    const all =
      getComments();

    const comments =
      Array.isArray(
        all[id]
      )
        ? all[id]
        : [];


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
          >×</button>
        </div>

        <div class="zylo-comment-list">

          ${
            comments.length
              ? comments
                  .map(
                    (
                      comment
                    ) => `
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
      $(
        ".zylo-comment-form",
        panel
      );

    const input =
      $("input", form);


    form.addEventListener(
      "submit",
      (
        event
      ) => {
        event.preventDefault();

        const text =
          input.value.trim();

        if (!text) {
          return;
        }

        const data =
          getComments();

        if (
          !Array.isArray(
            data[id]
          )
        ) {
          data[id] =
            [];
        }

        data[id].push({
          id:
            makeId(
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


        setStorage(
          CONFIG.STORAGE.COMMENTS,
          data
        );


        input.value =
          "";

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
      closeComments
    );


    setTimeout(
      () => {
        input?.focus();
      },
      50
    );
  }


  function setupComments() {
    document.addEventListener(
      "click",
      (
        event
      ) => {
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

  function setupShare() {
    document.addEventListener(
      "click",
      async (
        event
      ) => {
        const button =
          event.target.closest(
            ".share-btn"
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

        const id =
          page?.dataset?.videoId ||
          "";


        const url =
          `${window.location.origin}` +
          `${window.location.pathname}` +
          `#video-${encodeURIComponent(
            id
          )}`;


        try {
          if (
            navigator.share
          ) {
            await navigator.share(
              {
                title:
                  "ZYLO",

                text:
                  "Watch this video on ZYLO",

                url
              }
            );
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
    );
  }


  /* =========================================================
     MUSIC
     ========================================================= */

  function setupMusic() {
    document.addEventListener(
      "click",
      (
        event
      ) => {
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
     FULLSCREEN
     ========================================================= */

  function setupFullscreen() {
    document.addEventListener(
      "click",
      async (
        event
      ) => {
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
     VIDEO CLICK
     ========================================================= */

  function setupVideoClick() {
    document.addEventListener(
      "click",
      (
        event
      ) => {
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

          video.dataset
            .zyloPlaying =
            "false";
        }
      }
    );
  }


  /* =========================================================
     DOUBLE TAP LIKE
     ========================================================= */

  function setupDoubleTap() {
    let lastTap =
      0;

    let lastPage =
      null;

    document.addEventListener(
      "click",
      (
        event
      ) => {
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
          now - lastTap < 320
        ) {
          const like =
            $(".like-btn", page);

          if (like) {
            like.click();
          }
        }

        lastTap =
          now;

        lastPage =
          page;
      }
    );
  }


  /* =========================================================
     CREATOR PROFILE
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
        page?.dataset?.creatorUsername ||
        page?.dataset?.username ||
        "zylo_creator"
    };
  }


  function showCreatorProfile(
    page
  ) {
    const creator =
      getCreatorData(
        page
      );

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
        () =>
          panel.remove()
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
            follows.indexOf(
              uid
            );


          if (
            index >= 0
          ) {
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
            follows.push(
              uid
            );

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


    const follows =
      getStorage(
        CONFIG.STORAGE.FOLLOWS,
        []
      );


    $(
      ".zylo-profile-follow",
      panel
    ).textContent =
      follows.includes(
        creator.uid
      )
        ? "Following"
        : "Follow";


    const list =
      $(
        ".zylo-profile-video-list",
        panel
      );


    list.innerHTML =
      "";


    const creatorPages =
      VideoEngine
        .getPages()
        .filter(
          (
            item
          ) =>
            getCreatorData(
              item
            ).uid ===
            creator.uid
        );


    creatorPages.forEach(
      (
        item
      ) => {
        const itemButton =
          document.createElement(
            "button"
          );

        itemButton.type =
          "button";

        itemButton.className =
          "zylo-profile-video-item";

        itemButton.textContent =
          item.dataset.videoId ||
          "Video";


        itemButton.addEventListener(
          "click",
          () => {
            const index =
              VideoEngine
                .getPages()
                .indexOf(
                  item
                );

            if (
              index >= 0
            ) {
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
      }
    );


    panel.classList.add(
      "open",
      "active"
    );
  }


  function setupCreatorProfile() {
    document.addEventListener(
      "click",
      (
        event
      ) => {
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
      () =>
        overlay.remove()
    );


    const input =
      $(
        ".zylo-search-input",
        overlay
      );


    input.addEventListener(
      "input",
      () => {
        const term =
          input.value
            .trim()
            .toLowerCase();


        const results =
          $(
            ".zylo-search-results",
            overlay
          );


        results.innerHTML =
          "";


        if (!term) {
          return;
        }


        const pages =
          VideoEngine
            .getPages()
            .filter(
              (
                page
              ) => {
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
                  .filter(
                    Boolean
                  )
                  .join(" ")
                  .toLowerCase();


                return text.includes(
                  term
                );
              }
            );


        pages.forEach(
          (
            page
          ) => {
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

                if (
                  index >= 0
                ) {
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
    );


    return overlay;
  }


  function setupSearch() {
    document.addEventListener(
      "click",
      (
        event
      ) => {
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
     CREATE / UPLOAD
     ========================================================= */

  let selectedUploadFile =
    null;


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
        "ZYLO: #uploadBox not found"
      );

      return;
    }


    box.hidden =
      false;

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


    box.hidden =
      true;

    box.style.display =
      "none";


    selectedUploadFile =
      null;


    const input =
      $("#videoInput");


    if (input) {
      input.value =
        "";
    }


    const preview =
      $("#uploadPreview");


    const previewVideo =
      $("#uploadPreviewVideo");


    if (preview) {
      preview.hidden =
        true;
    }


    if (previewVideo) {
      try {
        previewVideo.pause();
      } catch {}


      previewVideo.removeAttribute(
        "src"
      );


      try {
        previewVideo.load();
      } catch {}
    }
  }


  /* =========================================================
     CREATE BUTTON
     ========================================================= */

  function setupCreateButton() {
    /*
     * Capture phase makes this work even when
     * other click handlers exist.
     */

    document.addEventListener(
      "click",
      (
        event
      ) => {
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
     UPLOAD BUTTONS
     ========================================================= */

  function setupUploadButtons() {

    /*
     * CLOSE
     */

    document.addEventListener(
      "click",
      (
        event
      ) => {
        const close =
          event.target.closest(
            [
              "#closeUpload",
              ".close-upload",
              ".upload-close",
              "#uploadCancel"
            ].join(",")
          );


        if (!close) {
          return;
        }


        event.preventDefault();
        event.stopPropagation();


        closeUploadBox();
      },
      true
    );


    /*
     * SELECT VIDEO
     *
     * Directly opens phone picker.
     */

    document.addEventListener(
      "click",
      (
        event
      ) => {
        const button =
          event.target.closest(
            "#selectVideo"
          );


        if (!button) {
          return;
        }


        event.preventDefault();
        event.stopPropagation();


        const input =
          $("#videoInput");


        if (!input) {
          console.warn(
            "ZYLO: #videoInput not found"
          );

          return;
        }


        /*
         * Reset value first.
         * This allows selecting the same
         * video again.
         */

        input.value =
          "";


        try {
          input.click();
        } catch (
          error
        ) {
          console.warn(
            "ZYLO file picker error:",
            error
          );
        }
      },
      true
    );


    /*
     * FILE SELECTED
     */

    document.addEventListener(
      "change",
      (
        event
      ) => {
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


        if (
          !file.type.startsWith(
            "video/"
          )
        ) {
          alert(
            "Please select a video file."
          );

          input.value =
            "";

          return;
        }


        if (
          file.size >
          CONFIG.UPLOAD.MAX_SIZE
        ) {
          alert(
            "Video must be 200 MB or smaller."
          );

          input.value =
            "";

          return;
        }


        selectedUploadFile =
          file;


        const preview =
          $("#uploadPreview");


        const previewVideo =
          $("#uploadPreviewVideo");


        if (
          preview &&
          previewVideo
        ) {
          /*
           * Release previous preview URL.
           */

          if (
            previewVideo.dataset
              .zyloObjectURL
          ) {
            try {
              URL.revokeObjectURL(
                previewVideo.dataset
                  .zyloObjectURL
              );
            } catch {}
          }


          const objectURL =
            URL.createObjectURL(
              file
            );


          previewVideo.dataset
            .zyloObjectURL =
            objectURL;


          previewVideo.src =
            objectURL;

          previewVideo.muted =
            true;

          previewVideo.playsInline =
            true;

          previewVideo.controls =
            true;


          preview.hidden =
            false;


          try {
            previewVideo.load();
          } catch {}
        }
      },
      true
    );


    /*
     * POST
     */

    document.addEventListener(
      "click",
      async (
        event
      ) => {
        const button =
          event.target.closest(
            "#uploadPost"
          );


        if (!button) {
          return;
        }


        event.preventDefault();
        event.stopPropagation();


        if (
          !selectedUploadFile
        ) {
          alert(
            "Please select a video first."
          );

          return;
        }


        const file =
          selectedUploadFile;


        button.disabled =
          true;


        const oldText =
          button.textContent;


        button.textContent =
          "Uploading...";


        try {
          await uploadVideo(
            file
          );
        } catch (
          error
        ) {
          console.error(
            "ZYLO upload error:",
            error
          );


          alert(
            error?.message ||
            "Video upload failed."
          );
        } finally {
          button.disabled =
            false;

          button.textContent =
            oldText;
        }
      },
      true
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
      data.id ||
      makeId(
        "video"
      );


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


    page.dataset.description =
      data.description ||
      "";


    const video =
      document.createElement(
        "video"
      );


    video.muted =
      true;

    video.defaultMuted =
      true;

    video.playsInline =
      true;

    video.controls =
      false;

    video.autoplay =
      false;

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


    video.preload =
      "metadata";


    video.dataset
      .zyloOriginal =
      data.url;


    video.src =
      data.url;


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
      CONFIG.UPLOAD.MAX_SIZE
    ) {
      throw new Error(
        "Video must be 200 MB or smaller."
      );
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


    let serverVideoId =
      "";


    /*
     * BACKEND UPLOAD
     */

    try {
      const response =
        await fetch(
          `${CONFIG.API_BASE_URL}/api/upload`,
          {
            method:
              "POST",

            body:
              formData
          }
        );


      let result =
        {};


      try {
        result =
          await response.json();
      } catch {
        result =
          {};
      }


      if (
        response.ok &&
        result
      ) {
        serverURL =
          result.url ||
          result.videoUrl ||
          result.video?.url ||
          "";


        serverVideoId =
          result.videoId ||
          result.video?.videoId ||
          "";
      }


      if (
        !serverURL
      ) {
        throw new Error(
          result?.message ||
          "Server did not return a video URL."
        );
      }


      console.log(
        "ZYLO: video uploaded successfully"
      );
    } catch (
      error
    ) {
      console.warn(
        "ZYLO server upload failed:",
        error
      );


      /*
       * Backend unavailable:
       * keep local preview working.
       */

      serverURL =
        "";
    }


    /*
     * Local blob URL
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
        serverVideoId ||
        makeId(
          "video"
        ),

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


    /*
     * Add new video to feed
     */

    const page =
      createUploadedPage(
        videoData
      );


    VideoEngine.refresh();


    if (page) {
      const index =
        VideoEngine
          .getPages()
          .indexOf(
            page
          );


      if (
        index >= 0
      ) {
        /*
         * First scroll.
         * Then activate.
         */

        VideoEngine.scrollToPage(
          index,
          "smooth"
        );


        setTimeout(
          () => {
            VideoEngine.activate(
              index,
              {
                updateHash:
                  true
              }
            );
          },
          250
        );
      }
    }


    closeUploadBox();


    return videoData;
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
            (
              page
            ) =>
              page.dataset
                .videoId
          )
          .filter(
            Boolean
          )
      );


    uploads
      .slice()
      .reverse()
      .forEach(
        (
          data
        ) => {
          if (
            !data?.id ||
            existing.has(
              data.id
            )
          ) {
            return;
          }


          const url =
            data.serverURL ||
            data.url;


          /*
           * Blob URLs don't survive reload.
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
  }


  /* =========================================================
     NAVIGATION
     ========================================================= */

  function setupNavigation() {

    /*
     * HOME
     */

    document.addEventListener(
      "click",
      (
        event
      ) => {
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
          type ===
          "home"
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
          type ===
          "profile"
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
     * FEED TABS
     */

    document.addEventListener(
      "click",
      (
        event
      ) => {
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
          "for-you"
        ) {
          $$(".video-page")
            .forEach(
              (
                page
              ) => {
                page.hidden =
                  false;

                page.style.display =
                  "";
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


        if (
          type ===
          "following"
        ) {
          const follows =
            getStorage(
              CONFIG.STORAGE.FOLLOWS,
              []
            );


          /*
           * Keep all videos mounted.
           */

          $$(".video-page")
            .forEach(
              (
                page
              ) => {
                page.hidden =
                  false;

                page.style.display =
                  "";


                const creator =
                  getCreatorData(
                    page
                  );


                page.dataset
                  .followingMatch =
                  follows.includes(
                    creator.uid
                  )
                    ? "true"
                    : "false";
              }
            );


          VideoEngine.refresh();
        }
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
          VideoEngine
            .getPages()
            .forEach(
              (
                page
              ) => {
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


        if (
          index >= 0
        ) {
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

  function setupKeyboard() {
    document.addEventListener(
      "keydown",
      (
        event
      ) => {
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
          closeComments();


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

    /*
     * Auth
     */

    loadAuthJS();


    /*
     * Restore videos BEFORE engine starts.
     */

    restoreUploadedVideos();


    /*
     * Video engine
     */

    VideoEngine.init();


    /*
     * Features
     */

    setupLikes();

    setupSave();

    setupComments();

    setupShare();

    setupMusic();

    setupFullscreen();

    setupDoubleTap();

    setupCreatorProfile();

    setupNavigation();

    setupSearch();

    setupCreateButton();

    setupUploadButtons();

    setupVideoClick();

    setupVisibility();

    setupKeyboard();


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
     * Extra first-video safety.
     */

    setTimeout(
      () => {
        const pages =
          VideoEngine.getPages();


        if (
          pages.length &&
          VideoEngine
            .getActiveIndex() < 0
        ) {
          VideoEngine.activate(
            0,
            {
              updateHash:
                false
            }
          );
        }
      },
      300
    );


    console.log(
      "ZYLO frontend initialized - v1009"
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
