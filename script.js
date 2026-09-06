/* =========================================================
   ZYLO
   VIDEO + SWIPE + AUTOPLAY + UPLOAD ENGINE

   IMPORTANT:
   UI / CSS / BUTTON DESIGN IS NOT CHANGED.
   ========================================================= */

(() => {
    "use strict";


    /* =======================================================
       CONFIG
       ======================================================= */

    const CONFIG = {

        API_BASE_URL:
            "https://zylo-backend-ec5c.onrender.com",

        DEFAULT_VIDEO:
            "./backend/uploads/video1.mp4",

        CDN_VIDEO:
            "https://cdn.jsdelivr.net/gh/golammostofa89076-sys/zylo@main/backend/uploads/video1.mp4",

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
            PRELOAD_BEHIND: 1,
            PLAY_RETRY_MS: 350,
            SETTLE_DELAY_MS: 120,
            VISIBILITY_THRESHOLD: 0.65
        }
    };


    /* =======================================================
       HELPERS
       ======================================================= */

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


    function safeJSON(value, fallback) {
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
            return safeJSON(
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
        } catch {}
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


    function isInteractive(target) {
        return Boolean(
            target?.closest?.(
                "button," +
                "a," +
                "input," +
                "textarea," +
                "select," +
                "label," +
                ".upload-box," +
                ".upload-modal," +
                ".comment-panel," +
                ".zylo-comment-panel," +
                ".zylo-profile-panel," +
                ".zylo-search-overlay"
            )
        );
    }


    /* =======================================================
       AUTH
       ======================================================= */

    function getCurrentUser() {

        try {

            if (
                window.ZYLOAuth &&
                typeof window.ZYLOAuth
                    .getCurrentUser === "function"
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

        } catch {}

        return null;
    }


    function getUID() {

        const user =
            getCurrentUser();

        return (
            user?.uid ||
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
            "./auth.js?v=1006";

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
                "ZYLO auth.js failed to load"
            );
        };

        document.head.appendChild(
            script
        );
    }


    /* =======================================================
       VIDEO SOURCE
       ======================================================= */

    function originalSource(video) {

        if (!video) {
            return "";
        }

        return (
            video.dataset.zyloOriginal ||
            video.getAttribute("src") ||
            video.dataset.src ||
            CONFIG.DEFAULT_VIDEO
        );
    }


    function isDefaultVideo(source) {

        const value =
            String(source || "")
                .split("?")[0];

        return (
            value.includes(
                "/backend/uploads/video1.mp4"
            ) ||
            value.endsWith(
                "backend/uploads/video1.mp4"
            )
        );
    }


    function preferredSource(video) {

        const source =
            originalSource(video);

        if (
            isDefaultVideo(source)
        ) {
            return CONFIG.CDN_VIDEO;
        }

        return source;
    }


    /* =======================================================
       VIDEO PREPARE
       ======================================================= */

    function prepareVideo(video) {

        if (!video) {
            return;
        }

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
         * loop OFF
         * so ended event works.
         */

        video.loop = false;

        video.removeAttribute(
            "loop"
        );

        if (
            !video.dataset
                .zyloOriginal
        ) {
            video.dataset
                .zyloOriginal =
                video.getAttribute(
                    "src"
                ) ||
                video.dataset.src ||
                CONFIG.DEFAULT_VIDEO;
        }
    }


    /* =======================================================
       LOAD VIDEO
       ======================================================= */

    function loadVideo(
        video,
        preload = "auto"
    ) {

        if (!video) {
            return false;
        }

        prepareVideo(video);

        const source =
            preferredSource(video);

        if (!source) {
            return false;
        }

        const wanted =
            new URL(
                source,
                location.href
            ).href;

        const current =
            video.currentSrc ||
            video.src ||
            "";

        const currentURL =
            current
                ? new URL(
                    current,
                    location.href
                ).href
                : "";

        video.preload =
            preload;

        if (
            currentURL !== wanted
        ) {

            video.src =
                source;

            video.preload =
                preload;

            /*
             * Important for mobile browsers.
             */

            try {
                video.load();
            } catch {}

        }

        return true;
    }


    /* =======================================================
       PLAY VIDEO
       ======================================================= */

    async function playVideo(video) {

        if (!video) {
            return false;
        }

        prepareVideo(video);

        loadVideo(
            video,
            "auto"
        );

        video.muted = true;

        video.defaultMuted =
            true;

        video.playsInline =
            true;

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

            video.dataset.playing =
                "true";

            return true;

        } catch {

            video.dataset.playing =
                "false";

            setTimeout(() => {

                if (
                    video.dataset.active ===
                        "true" &&
                    !document.hidden
                ) {

                    video.muted =
                        true;

                    video.play()
                        .catch(() => {});

                }

            }, CONFIG.VIDEO
                .PLAY_RETRY_MS);

            return false;
        }
    }


    /* =======================================================
       VIDEO ENGINE
       ======================================================= */

    const VideoEngine =
        (() => {

            let feed = null;

            let pages = [];

            let activeIndex = -1;

            let scrollTimer =
                null;

            let initialized =
                false;


            function refresh() {

                feed =
                    $(".video-feed");

                if (!feed) {
                    pages = [];
                    return;
                }

                /*
                 * NEVER filter .video-page.
                 */

                pages =
                    $$(".video-page", feed);

                pages.forEach(
                    page => {

                        const video =
                            $("video", page);

                        if (!video) {
                            return;
                        }

                        prepareVideo(
                            video
                        );

                        installVideoEvents(
                            video
                        );

                    }
                );

                if (
                    activeIndex >=
                    pages.length
                ) {
                    activeIndex =
                        pages.length -
                        1;
                }
            }


            function getPages() {

                refresh();

                return pages;
            }


            function getVideo(page) {

                return page
                    ? $("video", page)
                    : null;
            }


            function pauseOthers(
                except
            ) {

                pages.forEach(
                    page => {

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

                        video.dataset.active =
                            "false";

                        video.dataset.playing =
                            "false";
                    }
                );
            }


            function preload(index) {

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

                            loadVideo(
                                video,
                                "auto"
                            );

                        } else if (
                            distance <=
                            CONFIG.VIDEO
                                .PRELOAD_AHEAD
                        ) {

                            loadVideo(
                                video,
                                "auto"
                            );

                        } else if (
                            distance <=
                            CONFIG.VIDEO
                                .PRELOAD_BEHIND
                        ) {

                            loadVideo(
                                video,
                                "metadata"
                            );

                        } else {

                            video.preload =
                                "none";
                        }

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

                const video =
                    getVideo(page);

                if (!page) {
                    return;
                }

                activeIndex =
                    index;

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

                        if (
                            itemVideo
                        ) {

                            itemVideo.dataset
                                .active =
                                active
                                    ? "true"
                                    : "false";

                            itemVideo.loop =
                                false;

                        }

                    }
                );

                pauseOthers(video);

                preload(index);

                if (video) {
                    await playVideo(
                        video
                    );
                }

                if (
                    options.updateHash !==
                    false
                ) {

                    try {

                        history.replaceState(
                            null,
                            "",
                            "#video-" +
                            encodeURIComponent(
                                page.dataset
                                    .videoId ||
                                ""
                            )
                        );

                    } catch {}
                }

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
            }


            function findNearest() {

                if (
                    !feed ||
                    !pages.length
                ) {
                    return -1;
                }

                const rect =
                    feed.getBoundingClientRect();

                const center =
                    rect.top +
                    rect.height / 2;

                let best =
                    0;

                let distance =
                    Infinity;

                pages.forEach(
                    (page, index) => {

                        const r =
                            page.getBoundingClientRect();

                        const c =
                            r.top +
                            r.height / 2;

                        const d =
                            Math.abs(
                                c - center
                            );

                        if (
                            d < distance
                        ) {

                            distance = d;
                            best = index;
                        }
                    }
                );

                return best;
            }


            function scrollToPage(
                index,
                behavior = "smooth"
            ) {

                refresh();

                if (!pages.length) {
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

                feed.scrollTo({
                    top:
                        page.offsetTop,
                    behavior
                });

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
                    CONFIG.VIDEO
                        .SETTLE_DELAY_MS
                );
            }


            function next() {

                refresh();

                if (!pages.length) {
                    return;
                }

                let current =
                    activeIndex;

                if (
                    current < 0
                ) {
                    current =
                        findNearest();
                }

                const nextIndex =
                    current + 1;

                if (
                    nextIndex >=
                    pages.length
                ) {
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

                    loadVideo(
                        nextVideo,
                        "auto"
                    );
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

                let current =
                    activeIndex;

                if (
                    current < 0
                ) {
                    current =
                        findNearest();
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


            function handleScroll() {

                clearTimeout(
                    scrollTimer
                );

                scrollTimer =
                    setTimeout(
                        () => {

                            const index =
                                findNearest();

                            if (
                                index >= 0
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
                            .SETTLE_DELAY_MS
                    );
            }


            function installObserver() {

                if (
                    !("IntersectionObserver"
                        in window)
                ) {
                    return;
                }

                const observer =
                    new IntersectionObserver(
                        entries => {

                            let best =
                                null;

                            entries.forEach(
                                entry => {

                                    if (
                                        entry.isIntersecting &&
                                        entry.intersectionRatio >=
                                        CONFIG.VIDEO
                                            .VISIBILITY_THRESHOLD
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
                            threshold:
                                [
                                    0.65,
                                    0.8,
                                    1
                                ]
                        }
                    );

                pages.forEach(
                    page => {
                        observer.observe(
                            page
                        );
                    }
                );
            }


            function installVideoEvents(
                video
            ) {

                if (
                    video.dataset
                        .zyloEvents ===
                    "true"
                ) {
                    return;
                }

                video.dataset
                    .zyloEvents =
                    "true";


                /*
                 * Video ended
                 */

                video.addEventListener(
                    "ended",
                    () => {

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

                            next();
                        }

                    }
                );


                /*
                 * CDN fallback
                 */

                video.addEventListener(
                    "error",
                    () => {

                        const source =
                            originalSource(
                                video
                            );

                        if (
                            isDefaultVideo(
                                source
                            ) &&
                            video.dataset
                                .fallback !==
                            "true"
                        ) {

                            video.dataset
                                .fallback =
                                "true";

                            video.src =
                                source;

                            video.preload =
                                "auto";

                            try {
                                video.load();
                            } catch {}

                            if (
                                video.dataset
                                    .active ===
                                "true"
                            ) {

                                setTimeout(
                                    () => {
                                        playVideo(
                                            video
                                        );
                                    },
                                    CONFIG.VIDEO
                                        .PLAY_RETRY_MS
                                );
                            }
                        }

                    }
                );

            }


            function init() {

                if (initialized) {

                    refresh();

                    return;
                }

                initialized =
                    true;

                refresh();

                if (!feed) {
                    return;
                }


                /*
                 * Native mobile scrolling.
                 *
                 * Do NOT preventDefault
                 * on touch scrolling.
                 */

                feed.addEventListener(
                    "scroll",
                    handleScroll,
                    {
                        passive: true
                    }
                );


                /*
                 * Intersection Observer
                 */

                installObserver();


                /*
                 * MutationObserver
                 *
                 * New uploaded videos
                 * automatically enter feed.
                 */

                const mutation =
                    new MutationObserver(
                        () => {

                            refresh();

                            installObserver();

                        }
                    );

                mutation.observe(
                    feed,
                    {
                        childList: true,
                        subtree: true
                    }
                );


                /*
                 * First video
                 */

                setTimeout(
                    () => {

                        refresh();

                        const index =
                            findNearest();

                        if (
                            index >= 0
                        ) {

                            activate(
                                index,
                                {
                                    updateHash:
                                        false
                                }
                            );

                        }

                    },
                    150
                );

            }


            return {

                init,

                refresh,

                getPages,

                getActiveIndex:
                    () =>
                        activeIndex,

                activate,

                next,

                previous,

                scrollToPage,

                playVideo
            };

        })();


    /* =======================================================
       LIKE
       ======================================================= */

    function videoIdFromButton(
        button
    ) {

        return (
            button
                ?.closest?.(
                    ".video-page"
                )
                ?.dataset
                ?.videoId ||
            ""
        );
    }


    function updateCount(
        button,
        delta
    ) {

        const count =
            $(
                ".action-count",
                button
            );

        if (!count) {
            return;
        }

        const value =
            parseInt(
                count.textContent,
                10
            ) || 0;

        count.textContent =
            String(
                Math.max(
                    0,
                    value + delta
                )
            );
    }


    function setupLike() {

        document.addEventListener(
            "click",
            event => {

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
                    videoIdFromButton(
                        button
                    );

                if (!id) {
                    return;
                }

                const likes =
                    getStorage(
                        CONFIG.STORAGE.LIKES,
                        []
                    );

                const index =
                    likes.indexOf(id);

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

    }


    /* =======================================================
       SAVE
       ======================================================= */

    function setupSave() {

        document.addEventListener(
            "click",
            event => {

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
                    videoIdFromButton(
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


    /* =======================================================
       COMMENTS
       ======================================================= */

    function getComments() {

        const value =
            getStorage(
                CONFIG.STORAGE.COMMENTS,
                {}
            );

        return (
            value &&
            typeof value ===
                "object" &&
            !Array.isArray(value)
        )
            ? value
            : {};
    }


    function openComments(
        button
    ) {

        const id =
            videoIdFromButton(
                button
            );

        if (!id) {
            return;
        }

        const old =
            $(".zylo-comment-panel");

        if (old) {
            old.remove();
        }

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


        panel.innerHTML = `

            <div class="zylo-comment-inner">

                <div class="zylo-comment-header">

                    <strong>
                        Comments
                    </strong>

                    <button
                        type="button"
                        class="zylo-comment-close"
                    >
                        ×
                    </button>

                </div>


                <div class="zylo-comment-list">

                    ${
                        comments.length

                            ? comments
                                .map(
                                    comment =>
                                        `
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


                <form
                    class="zylo-comment-form"
                >

                    <input
                        type="text"
                        maxlength="500"
                        placeholder="Add a comment..."
                        required
                    >

                    <button
                        type="submit"
                    >
                        Send
                    </button>

                </form>

            </div>
        `;


        document.body.appendChild(
            panel
        );


        const form =
            $(".zylo-comment-form",
                panel);

        const input =
            $("input", form);


        form.addEventListener(
            "submit",
            event => {

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
                    data[id] = [];
                }

                data[id].push({

                    id:
                        makeId(
                            "comment"
                        ),

                    uid:
                        getUID(),

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

                input.value = "";

                openComments(
                    button
                );

            }
        );


        $(
            ".zylo-comment-close",
            panel
        )?.addEventListener(
            "click",
            () => panel.remove()
        );


        panel.classList.add(
            "open",
            "active"
        );


        input.focus();
    }


    function setupComments() {

        document.addEventListener(
            "click",
            event => {

                const button =
                    event.target.closest(
                        ".comment-btn," +
                        '[aria-label="Comments"]'
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


    /* =======================================================
       SHARE
       ======================================================= */

    function setupShare() {

        document.addEventListener(
            "click",
            async event => {

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
                    page?.dataset
                        ?.videoId ||
                    "";

                const url =
                    location.origin +
                    location.pathname +
                    "#video-" +
                    encodeURIComponent(
                        id
                    );


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

                        await navigator.clipboard
                            .writeText(
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


    /* =======================================================
       MUSIC
       ======================================================= */

    function setupMusic() {

        document.addEventListener(
            "click",
            event => {

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


    /* =======================================================
       FULLSCREEN
       ======================================================= */

    function setupFullscreen() {

        document.addEventListener(
            "click",
            async event => {

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

                        await document
                            .exitFullscreen();

                    } else if (
                        video.requestFullscreen
                    ) {

                        await video
                            .requestFullscreen();

                    } else if (
                        video.webkitEnterFullscreen
                    ) {

                        video.webkitEnterFullscreen();

                    }

                } catch {}

            }
        );

    }


    /* =======================================================
       VIDEO TAP PLAY / PAUSE
       ======================================================= */

    function setupVideoTap() {

        document.addEventListener(
            "click",
            event => {

                if (
                    isInteractive(
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


    /* =======================================================
       CREATE BUTTON
       ======================================================= */

    function getUploadBox() {
        return $(
            "#uploadBox"
        );
    }


    function openUploadBox() {

        const box =
            getUploadBox();

        if (!box) {
            console.warn(
                "ZYLO uploadBox missing"
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

        const input =
            $("#videoInput");

        if (input) {
            input.value = "";
        }

        const modalInput =
            $("#videoInputModal");

        if (modalInput) {
            modalInput.value = "";
        }

        const preview =
            $("#uploadPreview");

        if (preview) {
            preview.hidden =
                true;
        }

        const previewVideo =
            $("#uploadPreviewVideo");

        if (previewVideo) {
            previewVideo.pause();

            previewVideo.removeAttribute(
                "src"
            );

            try {
                previewVideo.load();
            } catch {}
        }

        const status =
            $("#uploadStatus");

        if (status) {
            status.textContent =
                "";
        }

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


        const previewVideo =
            $("#uploadPreviewVideo");

        if (previewVideo) {

            previewVideo.pause();

            previewVideo.removeAttribute(
                "src"
            );

            try {
                previewVideo.load();
            } catch {}
        }

        const preview =
            $("#uploadPreview");

        if (preview) {
            preview.hidden =
                true;
        }

        const input =
            $("#videoInput");

        if (input) {
            input.value = "";
        }

        const modalInput =
            $("#videoInputModal");

        if (modalInput) {
            modalInput.value = "";
        }

    }


    function setupCreateButton() {

        /*
         * Capture phase ensures
         * bottom Create works even
         * if another listener exists.
         */

        document.addEventListener(
            "click",
            event => {

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


    /* =======================================================
       SELECT VIDEO BUTTON
       ======================================================= */

    function openFilePicker() {

        const input =
            $("#videoInputModal") ||
            $("#videoInput");

        if (!input) {

            alert(
                "Video input is missing."
            );

            return;
        }

        input.value = "";

        input.click();
    }


    function setupSelectVideo() {

        document.addEventListener(
            "click",
            event => {

                const button =
                    event.target.closest(
                        "#selectVideo"
                    );

                if (!button) {
                    return;
                }

                event.preventDefault();

                event.stopPropagation();

                openFilePicker();

            },
            true
        );

    }


    /* =======================================================
       PREVIEW
       ======================================================= */

    let selectedUploadFile =
        null;


    function showPreview(
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

        selectedUploadFile =
            file;


        const preview =
            $("#uploadPreview");

        const previewVideo =
            $("#uploadPreviewVideo");

        if (
            !preview ||
            !previewVideo
        ) {
            return;
        }


        const url =
            URL.createObjectURL(
                file
            );


        previewVideo.src =
            url;

        previewVideo.muted =
            true;

        previewVideo.playsInline =
            true;

        previewVideo.controls =
            true;


        preview.hidden =
            false;


        previewVideo.play()
            .catch(() => {});


        const status =
            $("#uploadStatus");

        if (status) {

            status.textContent =
                file.name;

        }

    }


    function setupVideoInput() {

        document.addEventListener(
            "change",
            event => {

                const input =
                    event.target;

                if (
                    input.id !==
                        "videoInputModal" &&
                    input.id !==
                        "videoInput"
                ) {
                    return;
                }

                const file =
                    input.files?.[0];

                if (!file) {
                    return;
                }

                showPreview(
                    file
                );

            }
        );

    }


    /* =======================================================
       UPLOAD
       ======================================================= */

    function uploadVideo(
        file
    ) {

        return new Promise(
            (resolve, reject) => {

                if (!file) {

                    reject(
                        new Error(
                            "Please select a video."
                        )
                    );

                    return;
                }


                if (
                    !file.type.startsWith(
                        "video/"
                    )
                ) {

                    reject(
                        new Error(
                            "Please select a video file."
                        )
                    );

                    return;
                }


                if (
                    file.size >
                    200 *
                    1024 *
                    1024
                ) {

                    reject(
                        new Error(
                            "Video must be 200 MB or smaller."
                        )
                    );

                    return;
                }


                const uid =
                    getUID();

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


                const xhr =
                    new XMLHttpRequest();


                xhr.open(
                    "POST",
                    CONFIG.API_BASE_URL +
                    "/api/upload",
                    true
                );


                xhr.responseType =
                    "json";


                const status =
                    $("#uploadStatus");


                xhr.upload.onprogress =
                    event => {

                        if (
                            event.lengthComputable &&
                            status
                        ) {

                            const percent =
                                Math.round(
                                    (
                                        event.loaded /
                                        event.total
                                    ) *
                                    100
                                );

                            status.textContent =
                                "Uploading " +
                                percent +
                                "%";

                        }

                    };


                xhr.onload =
                    () => {

                        let data =
                            xhr.response;

                        if (!data) {

                            try {

                                data =
                                    JSON.parse(
                                        xhr.responseText ||
                                        "{}"
                                    );

                            } catch {

                                data = {};

                            }

                        }


                        if (
                            xhr.status >=
                                200 &&
                            xhr.status <
                                300
                        ) {

                            resolve(
                                data
                            );

                        } else {

                            reject(
                                new Error(
                                    data?.message ||
                                    "Upload failed."
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

    }


    /* =======================================================
       POST BUTTON
       ======================================================= */

    function setupPostButton() {

        document.addEventListener(
            "click",
            async event => {

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


                button.disabled =
                    true;


                const status =
                    $("#uploadStatus");


                if (status) {

                    status.textContent =
                        "Uploading...";

                }


                try {

                    const result =
                        await uploadVideo(
                            selectedUploadFile
                        );


                    const url =
                        result?.url ||
                        result?.videoUrl ||
                        result?.video?.url;


                    const id =
                        result?.videoId ||
                        result?.video?.videoId ||
                        makeId(
                            "video"
                        );


                    if (!url) {

                        throw new Error(
                            "Server did not return a video URL."
                        );

                    }


                    const videoData = {

                        id,

                        uid,

                        username,

                        name:
                            selectedUploadFile
                                .name,

                        url,

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
                                .indexOf(
                                    page
                                );

                        if (
                            index >= 0
                        ) {

                            VideoEngine
                                .scrollToPage(
                                    index,
                                    "smooth"
                                );

                        }

                    }


                    if (status) {

                        status.textContent =
                            "Posted successfully.";

                    }


                    selectedUploadFile =
                        null;


                    setTimeout(
                        () => {

                            closeUploadBox();

                        },
                        500
                    );


                } catch (error) {

                    console.error(
                        "ZYLO upload error:",
                        error
                    );


                    if (status) {

                        status.textContent =
                            error?.message ||
                            "Upload failed.";

                    }

                } finally {

                    button.disabled =
                        false;

                }

            }
        );

    }


    /* =======================================================
       CREATE UPLOADED VIDEO PAGE
       ======================================================= */

    function createUploadedPage(
        data
    ) {

        const feed =
            $(".video-feed");

        if (!feed) {
            return null;
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


        page.className =
            "video-page";


        page.classList.remove(
            "active"
        );


        page.dataset.videoId =
            data.id;


        page.dataset.creatorUid =
            data.uid ||
            getUID();


        page.dataset.creatorUsername =
            data.username ||
            getUsername();


        page.dataset.uploaded =
            "true";


        page.dataset.active =
            "false";


        page.dataset.title =
            data.name ||
            "ZYLO Video";


        const video =
            $("video", page);


        if (!video) {
            return null;
        }


        /*
         * IMPORTANT:
         * New uploaded video uses
         * server URL directly.
         */

        video.pause();


        video.removeAttribute(
            "loop"
        );


        video.loop =
            false;


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


        video.preload =
            "auto";


        video.autoplay =
            false;


        /*
         * Update visible information.
         */

        const username =
            $(".username", page);

        if (username) {

            username.textContent =
                "@" +
                String(
                    data.username ||
                    getUsername()
                )
                    .replace(
                        /^@/,
                        ""
                    );

        }


        const caption =
            $(".caption", page);

        if (caption) {

            caption.textContent =
                data.caption ||
                data.name ||
                "ZYLO Video";

        }


        feed.appendChild(
            page
        );


        return page;
    }


    /* =======================================================
       RESTORE UPLOADED VIDEOS
       ======================================================= */

    function restoreUploadedVideos() {

        const feed =
            $(".video-feed");

        if (!feed) {
            return;
        }


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


        const existing =
            new Set(
                $$(".video-page", feed)
                    .map(
                        page =>
                            page.dataset
                                .videoId
                    )
            );


        /*
         * Oldest first so the
         * current built-in videos
         * remain at the top.
         */

        uploads
            .slice()
            .reverse()
            .forEach(
                data => {

                    if (
                        !data?.url ||
                        existing.has(
                            data.id
                        )
                    ) {
                        return;
                    }

                    createUploadedPage(
                        data
                    );

                }
            );

    }


    /* =======================================================
       CREATOR PROFILE
       ======================================================= */

    function getCreatorData(
        page
    ) {

        return {

            uid:
                page?.dataset
                    ?.creatorUid ||
                "creator",

            username:
                page?.dataset
                    ?.creatorUsername ||
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


        const old =
            $("#zyloCreatorProfile");

        if (old) {
            old.remove();
        }


        const panel =
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

                <h2 class="zylo-profile-name">
                    ${escapeHTML(
                        creator.username
                    )}
                </h2>

                <p class="zylo-profile-handle">
                    @${escapeHTML(
                        creator.username
                    )}
                </p>

                <button
                    type="button"
                    class="zylo-profile-follow"
                >
                    Follow
                </button>

                <div class="zylo-profile-videos">

                    <h3>
                        Videos
                    </h3>

                    <div
                        class="zylo-profile-video-list"
                    ></div>

                </div>

            </div>
        `;


        document.body.appendChild(
            panel
        );


        $(".zylo-profile-close",
            panel
        )?.addEventListener(
            "click",
            () => panel.remove()
        );


        const follows =
            getStorage(
                CONFIG.STORAGE.FOLLOWS,
                []
            );


        const followButton =
            $(".zylo-profile-follow",
                panel);


        followButton.textContent =
            follows.includes(
                creator.uid
            )
                ? "Following"
                : "Follow";


        followButton.addEventListener(
            "click",
            () => {

                const list =
                    getStorage(
                        CONFIG.STORAGE
                            .FOLLOWS,
                        []
                    );


                const index =
                    list.indexOf(
                        creator.uid
                    );


                if (
                    index >= 0
                ) {

                    list.splice(
                        index,
                        1
                    );

                    followButton.textContent =
                        "Follow";

                } else {

                    list.push(
                        creator.uid
                    );

                    followButton.textContent =
                        "Following";
                }


                setStorage(
                    CONFIG.STORAGE.FOLLOWS,
                    list
                );

            }
        );


        const videoList =
            $(".zylo-profile-video-list",
                panel);


        /*
         * IMPORTANT:
         * Do NOT remove videos from feed.
         */

        VideoEngine
            .getPages()
            .filter(
                item =>
                    getCreatorData(
                        item
                    ).uid ===
                    creator.uid
            )
            .forEach(
                item => {

                    const videoItem =
                        document.createElement(
                            "button"
                        );

                    videoItem.type =
                        "button";

                    videoItem.className =
                        "zylo-profile-video-item";

                    videoItem.textContent =
                        item.dataset
                            .videoId ||
                        "Video";


                    videoItem.addEventListener(
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

                                VideoEngine
                                    .scrollToPage(
                                        index,
                                        "smooth"
                                    );

                            }

                        }
                    );


                    videoList.appendChild(
                        videoItem
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
            event => {

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


    /* =======================================================
       SEARCH
       ======================================================= */

    function setupSearch() {

        document.addEventListener(
            "click",
            event => {

                const button =
                    event.target.closest(
                        ".search-btn"
                    );

                if (!button) {
                    return;
                }

                event.preventDefault();

                event.stopPropagation();


                const old =
                    $("#zyloSearchOverlay");

                if (old) {
                    old.remove();
                }


                const overlay =
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
                        >

                        <div
                            class="zylo-search-results"
                        ></div>

                    </div>
                `;


                document.body.appendChild(
                    overlay
                );


                const input =
                    $(".zylo-search-input",
                        overlay);


                const results =
                    $(".zylo-search-results",
                        overlay);


                input.addEventListener(
                    "input",
                    () => {

                        const term =
                            input.value
                                .trim()
                                .toLowerCase();


                        results.innerHTML =
                            "";


                        if (!term) {
                            return;
                        }


                        VideoEngine
                            .getPages()
                            .filter(
                                page => {

                                    const creator =
                                        getCreatorData(
                                            page
                                        );

                                    const text =
                                        [
                                            page.dataset
                                                .videoId,

                                            page.dataset
                                                .title,

                                            creator.username

                                        ]
                                            .filter(
                                                Boolean
                                            )
                                            .join(
                                                " "
                                            )
                                            .toLowerCase();


                                    return text.includes(
                                        term
                                    );

                                }
                            )
                            .forEach(
                                page => {

                                    const item =
                                        document.createElement(
                                            "button"
                                        );

                                    item.type =
                                        "button";

                                    item.className =
                                        "zylo-search-result";

                                    item.textContent =
                                        page.dataset
                                            .title ||
                                        page.dataset
                                            .videoId ||
                                        "Video";


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

                                                VideoEngine
                                                    .scrollToPage(
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


                $(".zylo-search-close",
                    overlay
                )?.addEventListener(
                    "click",
                    () => overlay.remove()
                );


                setTimeout(
                    () => input.focus(),
                    50
                );

            }
        );

    }


    /* =======================================================
       NAVIGATION
       ======================================================= */

    function setupNavigation() {

        document.addEventListener(
            "click",
            event => {

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

                    window.dispatchEvent(
                        new CustomEvent(
                            "zylo:openprofile"
                        )
                    );

                }

            }
        );

    }


    /* =======================================================
       VISIBILITY
       ======================================================= */

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
                            page => {

                                const video =
                                    $("video",
                                        page);

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


    /* =======================================================
       KEYBOARD
       ======================================================= */

    function setupKeyboard() {

        document.addEventListener(
            "keydown",
            event => {

                if (
                    isInteractive(
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

                    VideoEngine.next();

                }


                if (
                    event.key ===
                    "ArrowUp"
                ) {

                    event.preventDefault();

                    VideoEngine.previous();

                }


                if (
                    event.key ===
                    "Escape"
                ) {

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


    /* =======================================================
       INITIALIZE
       ======================================================= */

    function initializeZYLO() {

        loadAuthJS();

        restoreUploadedVideos();

        VideoEngine.init();

        setupLike();

        setupSave();

        setupComments();

        setupShare();

        setupMusic();

        setupFullscreen();

        setupVideoTap();

        setupCreatorProfile();

        setupSearch();

        setupNavigation();

        setupCreateButton();

        setupSelectVideo();

        setupVideoInput();

        setupPostButton();

        setupVisibility();

        setupKeyboard();


        /*
         * Close upload
         */

        document.addEventListener(
            "click",
            event => {

                const close =
                    event.target.closest(
                        "#closeUpload," +
                        "#uploadCancel"
                    );

                if (!close) {
                    return;
                }

                event.preventDefault();

                closeUploadBox();

            }
        );


        /*
         * Open first video
         */

        setTimeout(
            () => {

                VideoEngine.refresh();

                const pages =
                    VideoEngine.getPages();

                if (
                    pages.length
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
         * Resize
         */

        window.addEventListener(
            "resize",
            () => {

                VideoEngine.refresh();

            }
        );


        console.log(
            "ZYLO initialized successfully"
        );

    }


    /* =======================================================
       START
       ======================================================= */

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


    /* =======================================================
       GLOBAL API
       ======================================================= */

    window.ZYLOVideoEngine =
        VideoEngine;


    window.ZYLO = {

        VideoEngine,

        openUploadBox,

        closeUploadBox,

        uploadVideo,

        getCurrentUser,

        getUserUID: getUID,

        getUsername

    };

})();
