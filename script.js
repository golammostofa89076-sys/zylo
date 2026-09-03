/* =========================================================
   ZYLO — COMPLETE FRONTEND CONTROLLER
   Create • Connect • Grow
   ========================================================= */

"use strict";


/* =========================================================
   CONFIG
   ========================================================= */

const API_BASE_URL =
    "https://zylo-backend-ec5c.onrender.com";

const CDN_VIDEO_URL =
    "https://cdn.jsdelivr.net/gh/golammostofa89076-sys/zylo@main/backend/uploads/video1.mp4";


/* =========================================================
   STORAGE
   ========================================================= */

const STORAGE_KEYS = {
    likes: "zylo_likes",
    saves: "zylo_saves",
    follows: "zylo_follows",
    comments: "zylo_comments"
};


function getStorage(key, fallback = {}) {

    try {

        const value = localStorage.getItem(key);

        return value
            ? JSON.parse(value)
            : fallback;

    } catch (error) {

        console.error("ZYLO Storage Error:", error);

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

        console.error("ZYLO Storage Save Error:", error);
    }
}


/* =========================================================
   ELEMENTS
   ========================================================= */

const videoFeed =
    document.querySelector(".video-feed");

const createBtn =
    document.getElementById("createBtn");

const videoInput =
    document.getElementById("videoInput");

const uploadBox =
    document.getElementById("uploadBox");

const closeUpload =
    document.getElementById("closeUpload");

const selectVideo =
    document.getElementById("selectVideo");

const uploadStatus =
    document.getElementById("uploadStatus");

const searchBtn =
    document.querySelector(".search-btn");


/* =========================================================
   STATE
   ========================================================= */

let likes =
    getStorage(STORAGE_KEYS.likes);

let saves =
    getStorage(STORAGE_KEYS.saves);

let follows =
    getStorage(STORAGE_KEYS.follows);

let comments =
    getStorage(STORAGE_KEYS.comments);


/* =========================================================
   UNIQUE VIDEO ID
   ========================================================= */

function getVideoId(page) {

    if (!page.dataset.videoId) {

        page.dataset.videoId =
            "video_" +
            Math.random()
                .toString(36)
                .substring(2, 11);
    }

    return page.dataset.videoId;
}


/* =========================================================
   INITIALIZE ALL VIDEO PAGES
   ========================================================= */

function initializeAllVideos() {

    const pages =
        document.querySelectorAll(".video-page");

    pages.forEach(page => {

        initializeVideoPage(page);

    });
}


/* =========================================================
   INITIALIZE SINGLE VIDEO PAGE
   ========================================================= */

function initializeVideoPage(page) {

    if (!page) return;

    const video =
        page.querySelector(".video-player");

    if (!video) return;


    const videoId =
        getVideoId(page);


    /* -----------------------------
       VIDEO SETTINGS
       ----------------------------- */

    video.loop = true;
    video.muted = true;
    video.playsInline = true;


    /* -----------------------------
       RESTORE LIKE
       ----------------------------- */

    const likeBtn =
        page.querySelector(".like-btn");

    if (likeBtn) {

        if (likes[videoId]) {

            likeBtn.classList.add("liked");

        }

        updateLikeCount(page);

    }


    /* -----------------------------
       RESTORE SAVE
       ----------------------------- */

    const saveBtn =
        page.querySelector(".save-btn");

    if (saveBtn) {

        if (saves[videoId]) {

            saveBtn.classList.add("saved");

        }

    }


    /* -----------------------------
       PROFILE FOLLOW
       ----------------------------- */

    const profileBtn =
        page.querySelector(".profile-action");

    if (profileBtn) {

        updateFollowButton(
            profileBtn,
            videoId
        );

    }


    /* =====================================================
       VIDEO CLICK — PLAY / PAUSE
       ===================================================== */

    if (!video.dataset.zyloReady) {

        video.addEventListener(
            "click",
            () => {

                if (video.paused) {

                    video.play().catch(() => {});

                } else {

                    video.pause();

                }

            }
        );


        /* =================================================
           VIDEO ERROR — CDN FALLBACK
           ================================================= */

        video.addEventListener(
            "error",
            () => {

                if (
                    video.src !== CDN_VIDEO_URL &&
                    !video.dataset.fallback
                ) {

                    video.dataset.fallback = "true";

                    video.src =
                        CDN_VIDEO_URL;

                    video.load();

                    video.play().catch(() => {});

                }

            }
        );


        video.dataset.zyloReady =
            "true";
    }


    /* =====================================================
       LIKE
       ===================================================== */

    if (
        likeBtn &&
        !likeBtn.dataset.ready
    ) {

        likeBtn.addEventListener(
            "click",
            event => {

                event.stopPropagation();

                toggleLike(
                    page,
                    videoId
                );

            }
        );

        likeBtn.dataset.ready =
            "true";
    }


    /* =====================================================
       SAVE
       ===================================================== */

    if (
        saveBtn &&
        !saveBtn.dataset.ready
    ) {

        saveBtn.addEventListener(
            "click",
            event => {

                event.stopPropagation();

                toggleSave(
                    page,
                    videoId
                );

            }
        );

        saveBtn.dataset.ready =
            "true";
    }


    /* =====================================================
       COMMENT
       ===================================================== */

    const commentBtn =
        page.querySelector(
            '[aria-label="Comments"]'
        );

    if (
        commentBtn &&
        !commentBtn.dataset.ready
    ) {

        commentBtn.addEventListener(
            "click",
            event => {

                event.stopPropagation();

                openComments(
                    page,
                    videoId
                );

            }
        );

        commentBtn.dataset.ready =
            "true";

        updateCommentCount(
            page,
            videoId
        );
    }


    /* =====================================================
       SHARE
       ===================================================== */

    const shareBtn =
        page.querySelector(".share-btn");

    if (
        shareBtn &&
        !shareBtn.dataset.ready
    ) {

        shareBtn.addEventListener(
            "click",
            event => {

                event.stopPropagation();

                shareVideo(
                    page
                );

            }
        );

        shareBtn.dataset.ready =
            "true";
    }


    /* =====================================================
       PROFILE / FOLLOW
       ===================================================== */

    if (
        profileBtn &&
        !profileBtn.dataset.ready
    ) {

        profileBtn.addEventListener(
            "click",
            event => {

                event.stopPropagation();

                toggleFollow(
                    profileBtn,
                    videoId
                );

            }
        );

        profileBtn.dataset.ready =
            "true";
    }


    /* =====================================================
       MUSIC
       ===================================================== */

    const musicBtn =
        page.querySelector(".music-btn");

    if (
        musicBtn &&
        !musicBtn.dataset.ready
    ) {

        musicBtn.addEventListener(
            "click",
            event => {

                event.stopPropagation();

                toggleMusic(
                    musicBtn
                );

            }
        );

        musicBtn.dataset.ready =
            "true";
    }


    /* =====================================================
       FULLSCREEN
       ===================================================== */

    const fullscreenBtn =
        page.querySelector(
            ".fullscreen-btn"
        );

    if (
        fullscreenBtn &&
        !fullscreenBtn.dataset.ready
    ) {

        fullscreenBtn.addEventListener(
            "click",
            event => {

                event.stopPropagation();

                openFullscreen(
                    page,
                    video
                );

            }
        );

        fullscreenBtn.dataset.ready =
            "true";
    }
}


/* =========================================================
   LIKE
   ========================================================= */

function toggleLike(page, videoId) {

    const button =
        page.querySelector(".like-btn");

    if (!button) return;


    if (likes[videoId]) {

        delete likes[videoId];

        button.classList.remove("liked");

    } else {

        likes[videoId] = true;

        button.classList.add("liked");

    }


    setStorage(
        STORAGE_KEYS.likes,
        likes
    );


    updateLikeCount(page);
}


function updateLikeCount(page) {

    const videoId =
        getVideoId(page);

    const countElement =
        page.querySelector(
            ".like-btn .action-count"
        );

    if (!countElement) return;


    const baseCount =
        Number(
            countElement.dataset.baseCount || "0"
        );


    if (!countElement.dataset.baseCount) {

        countElement.dataset.baseCount =
            countElement.textContent.trim() || "0";
    }


    const current =
        Number(
            countElement.dataset.baseCount || baseCount
        );


    countElement.textContent =
        formatCount(
            current +
            (likes[videoId] ? 1 : 0)
        );
}


/* =========================================================
   SAVE
   ========================================================= */

function toggleSave(page, videoId) {

    const button =
        page.querySelector(".save-btn");

    if (!button) return;


    if (saves[videoId]) {

        delete saves[videoId];

        button.classList.remove("saved");

    } else {

        saves[videoId] = true;

        button.classList.add("saved");

    }


    setStorage(
        STORAGE_KEYS.saves,
        saves
    );


    const text =
        button.querySelector(".action-text");

    if (text) {

        text.textContent =
            saves[videoId]
                ? "Saved"
                : "Save";
    }
}


/* =========================================================
   FOLLOW
   ========================================================= */

function toggleFollow(
    button,
    videoId
) {

    if (follows[videoId]) {

        delete follows[videoId];

    } else {

        follows[videoId] = true;

    }


    setStorage(
        STORAGE_KEYS.follows,
        follows
    );


    updateFollowButton(
        button,
        videoId
    );
}


function updateFollowButton(
    button,
    videoId
) {

    const badge =
        button.querySelector(
            ".follow-badge"
        );

    if (!badge) return;


    if (follows[videoId]) {

        badge.textContent = "✓";

    } else {

        badge.textContent = "+";

    }
}


/* =========================================================
   COMMENTS
   ========================================================= */

function updateCommentCount(
    page,
    videoId
) {

    const button =
        page.querySelector(
            '[aria-label="Comments"]'
        );

    if (!button) return;


    const countElement =
        button.querySelector(
            ".action-count"
        );

    if (!countElement) return;


    const baseCount =
        Number(
            countElement.dataset.baseCount ||
            countElement.textContent.trim() ||
            "0"
        );


    if (!countElement.dataset.baseCount) {

        countElement.dataset.baseCount =
            countElement.textContent.trim() || "0";
    }


    const commentList =
        comments[videoId] || [];


    countElement.textContent =
        formatCount(
            baseCount +
            commentList.length
        );
}


function openComments(
    page,
    videoId
) {

    closeComments();


    const overlay =
        document.createElement("div");

    overlay.className =
        "zylo-comments-overlay";


    const panel =
        document.createElement("div");

    panel.className =
        "zylo-comments-panel";


    const list =
        comments[videoId] || [];


    let commentHTML = "";


    if (list.length === 0) {

        commentHTML = `
            <div class="zylo-no-comments">
                No comments yet
            </div>
        `;

    } else {

        commentHTML =
            list.map(comment => `
                <div class="zylo-comment">
                    <div class="zylo-comment-avatar">
                        Z
                    </div>

                    <div class="zylo-comment-body">
                        <strong>
                            @zylo_user
                        </strong>

                        <p>
                            ${escapeHTML(comment)}
                        </p>
                    </div>
                </div>
            `).join("");
    }


    panel.innerHTML = `

        <div class="zylo-comments-header">

            <strong>
                Comments
            </strong>

            <button
                class="zylo-comment-close"
                aria-label="Close">
                ×
            </button>

        </div>


        <div class="zylo-comments-list">
            ${commentHTML}
        </div>


        <div class="zylo-comment-input">

            <input
                type="text"
                class="zylo-comment-field"
                placeholder="Add a comment...">

            <button
                class="zylo-comment-send">
                Send
            </button>

        </div>
    `;


    overlay.appendChild(panel);

    document.body.appendChild(overlay);


    const close =
        panel.querySelector(
            ".zylo-comment-close"
        );


    close.addEventListener(
        "click",
        closeComments
    );


    overlay.addEventListener(
        "click",
        event => {

            if (event.target === overlay) {

                closeComments();

            }

        }
    );


    const input =
        panel.querySelector(
            ".zylo-comment-field"
        );


    const send =
        panel.querySelector(
            ".zylo-comment-send"
        );


    function sendComment() {

        const text =
            input.value.trim();


        if (!text) return;


        if (!comments[videoId]) {

            comments[videoId] = [];

        }


        comments[videoId].push(text);


        setStorage(
            STORAGE_KEYS.comments,
            comments
        );


        input.value = "";


        closeComments();


        updateCommentCount(
            page,
            videoId
        );


        setTimeout(
            () => {

                openComments(
                    page,
                    videoId
                );

            },
            100
        );
    }


    send.addEventListener(
        "click",
        sendComment
    );


    input.addEventListener(
        "keydown",
        event => {

            if (event.key === "Enter") {

                sendComment();

            }

        }
    );


    setTimeout(
        () => input.focus(),
        100
    );
}


function closeComments() {

    const existing =
        document.querySelector(
            ".zylo-comments-overlay"
        );

    if (existing) {

        existing.remove();

    }
}


/* =========================================================
   SHARE
   ========================================================= */

async function shareVideo(page) {

    const video =
        page.querySelector(
            ".video-player"
        );


    const url =
        video?.currentSrc ||
        video?.src ||
        window.location.href;


    const shareData = {

        title: "ZYLO",
        text: "Check out this video on ZYLO",
        url: window.location.href
    };


    try {

        if (
            navigator.share &&
            /Android|iPhone|iPad|iPod/i.test(
                navigator.userAgent
            )
        ) {

            await navigator.share(
                shareData
            );

            return;
        }


        await copyToClipboard(
            window.location.href
        );


        showToast(
            "Video link copied"
        );

    } catch (error) {

        if (
            error &&
            error.name === "AbortError"
        ) {

            return;
        }


        try {

            await copyToClipboard(
                window.location.href
            );

            showToast(
                "Video link copied"
            );

        } catch {

            showToast(
                "Share failed"
            );
        }
    }
}


async function copyToClipboard(text) {

    if (
        navigator.clipboard &&
        window.isSecureContext
    ) {

        await navigator.clipboard.writeText(
            text
        );

        return;
    }


    const textarea =
        document.createElement("textarea");

    textarea.value = text;

    textarea.style.position =
        "fixed";

    textarea.style.opacity =
        "0";

    document.body.appendChild(
        textarea
    );

    textarea.select();

    document.execCommand(
        "copy"
    );

    textarea.remove();
}


/* =========================================================
   MUSIC
   ========================================================= */

function toggleMusic(button) {

    button.classList.toggle(
        "music-muted"
    );


    const disc =
        button.querySelector(
            ".music-disc"
        );


    if (disc) {

        disc.style.animationPlayState =
            button.classList.contains(
                "music-muted"
            )
                ? "paused"
                : "running";
    }


    showToast(
        button.classList.contains(
            "music-muted"
        )
            ? "Music paused"
            : "Music playing"
    );
}


/* =========================================================
   FULLSCREEN
   ========================================================= */

async function openFullscreen(
    page,
    video
) {

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


        if (
            video.webkitEnterFullscreen
        ) {

            video.webkitEnterFullscreen();

            return;
        }


        if (
            video.requestFullscreen
        ) {

            await video.requestFullscreen();

        }

    } catch (error) {

        console.error(
            "Fullscreen error:",
            error
        );
    }
}


/* =========================================================
   CREATE / UPLOAD
   ========================================================= */

if (createBtn) {

    createBtn.addEventListener(
        "click",
        event => {

            event.stopPropagation();

            if (uploadBox) {

                uploadBox.classList.add(
                    "show"
                );

            }

        }
    );
}


/* =========================================================
   CLOSE UPLOAD
   ========================================================= */

if (closeUpload) {

    closeUpload.addEventListener(
        "click",
        () => {

            closeUploadModal();

        }
    );
}


function closeUploadModal() {

    if (uploadBox) {

        uploadBox.classList.remove(
            "show"
        );
    }


    if (videoInput) {

        videoInput.value = "";

    }


    if (uploadStatus) {

        uploadStatus.textContent =
            "আপনার ভিডিও নির্বাচন করুন";
    }


    if (selectVideo) {

        selectVideo.disabled =
            false;

        selectVideo.textContent =
            "Select Video";
    }
}


/* =========================================================
   SELECT VIDEO
   ========================================================= */

if (selectVideo) {

    selectVideo.addEventListener(
        "click",
        () => {

            if (videoInput) {

                videoInput.click();

            }

        }
    );
}


/* =========================================================
   UPLOAD VIDEO
   ========================================================= */

if (videoInput) {

    videoInput.addEventListener(
        "change",
        async () => {

            const file =
                videoInput.files?.[0];


            if (!file) return;


            /* -----------------------------
               CHECK VIDEO
               ----------------------------- */

            if (
                !file.type.startsWith(
                    "video/"
                )
            ) {

                setUploadStatus(
                    "শুধু ভিডিও ফাইল নির্বাচন করুন"
                );

                return;
            }


            /* -----------------------------
               200 MB LIMIT
               ----------------------------- */

            if (
                file.size >
                200 * 1024 * 1024
            ) {

                setUploadStatus(
                    "ভিডিও 200 MB-এর বেশি হতে পারবে না"
                );

                return;
            }


            /* -----------------------------
               UI
               ----------------------------- */

            setUploadStatus(
                "ভিডিও আপলোড হচ্ছে..."
            );


            selectVideo.disabled =
                true;


            selectVideo.textContent =
                "Uploading...";


            try {

                const formData =
                    new FormData();


                formData.append(
                    "video",
                    file
                );


                const response =
                    await fetch(
                        `${API_BASE_URL}/api/upload`,
                        {
                            method: "POST",
                            body: formData
                        }
                    );


                let data;


                try {

                    data =
                        await response.json();

                } catch {

                    throw new Error(
                        "Invalid server response"
                    );

                }


                if (
                    !response.ok ||
                    !data.success
                ) {

                    throw new Error(
                        data.message ||
                        "Upload failed"
                    );

                }


                console.log(
                    "ZYLO Upload:",
                    data
                );


                setUploadStatus(
                    "ভিডিও সফলভাবে আপলোড হয়েছে ✓"
                );


                selectVideo.textContent =
                    "Uploaded ✓";


                const videoUrl =
                    data.video?.url;


                if (!videoUrl) {

                    throw new Error(
                        "Video URL not found"
                    );

                }


                /* -----------------------------
                   ADD VIDEO TO FEED
                   ----------------------------- */

                addUploadedVideo(
                    videoUrl
                );


                setTimeout(
                    () => {

                        closeUploadModal();

                    },
                    1000
                );


            } catch (error) {

                console.error(
                    "ZYLO Upload Error:",
                    error
                );


                setUploadStatus(
                    "ভিডিও আপলোড করা যায়নি"
                );


                selectVideo.disabled =
                    false;


                selectVideo.textContent =
                    "Try Again";
            }

        }
    );
}


/* =========================================================
   ADD UPLOADED VIDEO
   ========================================================= */

function addUploadedVideo(
    videoUrl
) {

    if (!videoFeed) return;


    const page =
        document.createElement(
            "section"
        );


    page.className =
        "video-page";


    page.dataset.videoId =
        "uploaded_" +
        Date.now();


    page.innerHTML = `

        <video
            class="video-player"
            src="${escapeAttribute(videoUrl)}"
            loop
            muted
            playsinline
            preload="metadata">
        </video>


        <button
            class="fullscreen-btn"
            aria-label="Fullscreen">

            <svg viewBox="0 0 24 24">

                <path d="M8 3H3v5"></path>
                <path d="M16 3h5v5"></path>

                <path d="M3 16v5h5"></path>
                <path d="M21 16v5h-5"></path>

            </svg>

        </button>


        <div class="right-actions">


            <!-- PROFILE -->

            <button
                class="profile-action"
                aria-label="Profile">

                <span class="profile-circle">
                    Z
                </span>

                <span class="follow-badge">
                    +
                </span>

            </button>


            <!-- LIKE -->

            <button
                class="action-btn like-btn"
                aria-label="Like">

                <svg viewBox="0 0 24 24">

                    <path d="M12 21S4 16 2.5 10.5C1.4 6.4 4.2 3 7.8 3c2 0 3.5 1.1 4.2 2.7C12.7 4.1 14.2 3 16.2 3c3.6 0 6.4 3.4 5.3 7.5C20 16 12 21 12 21Z"></path>

                </svg>

                <span class="action-count">
                    0
                </span>

            </button>


            <!-- COMMENT -->

            <button
                class="action-btn"
                aria-label="Comments">

                <svg viewBox="0 0 24 24">

                    <path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5H8l-4 3v-6.2A7.5 7.5 0 0 1 4.5 5.5 7.5 7.5 0 0 1 12 3h1a7 7 0 0 1 7 8.5Z"></path>

                </svg>

                <span class="action-count">
                    0
                </span>

            </button>


            <!-- SAVE -->

            <button
                class="action-btn save-btn"
                aria-label="Save">

                <svg viewBox="0 0 24 24">

                    <path d="M6 3h12v18l-6-4-6 4V3Z"></path>

                </svg>

                <span class="action-text">
                    Save
                </span>

            </button>


            <!-- SHARE -->

            <button
                class="action-btn share-btn"
                aria-label="Share">

                <svg viewBox="0 0 24 24">

                    <path d="M21 3 10 14"></path>
                    <path d="m21 3-7 18-4-7-7-4 18-7Z"></path>

                </svg>

                <span class="action-text">
                    Share
                </span>

            </button>


            <!-- MUSIC -->

            <button
                class="music-btn"
                aria-label="Music">

                <span class="music-disc">

                    <svg viewBox="0 0 24 24">

                        <path d="M9 18V6l10-2v12"></path>

                        <circle
                            cx="6"
                            cy="18"
                            r="3">
                        </circle>

                        <circle
                            cx="16"
                            cy="16"
                            r="3">
                        </circle>

                    </svg>

                </span>

            </button>

        </div>


        <!-- VIDEO INFO -->

        <div class="video-info">

            <div class="username">
                @zylo_creator
                <span class="verified">✓</span>
            </div>

            <div class="caption">
                New video on ZYLO 🌎
            </div>

            <div class="tagline">
                Create • Connect • Grow
            </div>

            <div class="hashtags">
                #ZYLO #Create #Connect #Grow
            </div>

            <div class="music-info">

                <svg viewBox="0 0 24 24">

                    <path d="M9 18V6l10-2v12"></path>

                    <circle
                        cx="6"
                        cy="18"
                        r="3">
                    </circle>

                    <circle
                        cx="16"
                        cy="16"
                        r="3">
                    </circle>

                </svg>

                Original sound - ZYLO

            </div>

        </div>
    `;


    videoFeed.prepend(
        page
    );


    initializeVideoPage(
        page
    );


    const video =
        page.querySelector(
            ".video-player"
        );


    if (video) {

        video.play().catch(() => {});

    }


    page.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });
}


/* =========================================================
   TOP TABS
   ========================================================= */

const topTabs =
    document.querySelectorAll(
        ".top-tab"
    );


topTabs.forEach(tab => {

    tab.addEventListener(
        "click",
        () => {

            topTabs.forEach(item => {

                item.classList.remove(
                    "active"
                );

            });


            tab.classList.add(
                "active"
            );


            const text =
                tab.textContent
                    .trim();


            if (
                text === "LIVE"
            ) {

                showToast(
                    "LIVE is coming soon"
                );

            } else if (
                text === "Following"
            ) {

                showToast(
                    "Following feed"
                );

            } else {

                showToast(
                    "For You"
                );

            }

        }
    );

});


/* =========================================================
   SEARCH
   ========================================================= */

if (searchBtn) {

    searchBtn.addEventListener(
        "click",
        () => {

            openSearch();

        }
    );
}


function openSearch() {

    closeSearch();


    const overlay =
        document.createElement("div");

    overlay.className =
        "zylo-search-overlay";


    const box =
        document.createElement("div");

    box.className =
        "zylo-search-box";


    box.innerHTML = `

        <div class="zylo-search-header">

            <strong>
                Search ZYLO
            </strong>

            <button
                class="zylo-search-close">
                ×
            </button>

        </div>


        <div class="zylo-search-row">

            <input
                type="search"
                class="zylo-search-input"
                placeholder="Search creators, videos...">

            <button
                class="zylo-search-submit">
                Search
            </button>

        </div>


        <div class="zylo-search-result">
        </div>
    `;


    overlay.appendChild(box);

    document.body.appendChild(
        overlay
    );


    const input =
        box.querySelector(
            ".zylo-search-input"
        );


    const submit =
        box.querySelector(
            ".zylo-search-submit"
        );


    const result =
        box.querySelector(
            ".zylo-search-result"
        );


    const close =
        box.querySelector(
            ".zylo-search-close"
        );


    close.addEventListener(
        "click",
        closeSearch
    );


    overlay.addEventListener(
        "click",
        event => {

            if (
                event.target === overlay
            ) {

                closeSearch();

            }

        }
    );


    function performSearch() {

        const query =
            input.value.trim();


        if (!query) {

            result.innerHTML =
                "Search something on ZYLO";

            return;
        }


        result.innerHTML = `

            <div class="zylo-search-message">

                Searching for:

                <strong>
                    ${escapeHTML(query)}
                </strong>

                <br><br>

                Search system is ready.
                More creator/video results
                can be connected later.

            </div>
        `;
    }


    submit.addEventListener(
        "click",
        performSearch
    );


    input.addEventListener(
        "keydown",
        event => {

            if (
                event.key === "Enter"
            ) {

                performSearch();

            }

        }
    );


    setTimeout(
        () => input.focus(),
        100
    );
}


function closeSearch() {

    const overlay =
        document.querySelector(
            ".zylo-search-overlay"
        );

    if (overlay) {

        overlay.remove();

    }
}


/* =========================================================
   BOTTOM NAVIGATION
   ========================================================= */

const navItems =
    document.querySelectorAll(
        ".nav-item"
    );


navItems.forEach(item => {

    item.addEventListener(
        "click",
        () => {

            navItems.forEach(nav => {

                nav.classList.remove(
                    "active"
                );

            });


            item.classList.add(
                "active"
            );


            const nav =
                item.dataset.nav;


            if (
                nav === "home"
            ) {

                if (videoFeed) {

                    videoFeed.scrollTo({
                        top: 0,
                        behavior: "smooth"
                    });

                }

            }


            else if (
                nav === "discover"
            ) {

                openSearch();

            }


            else if (
                nav === "inbox"
            ) {

                showToast(
                    "Inbox is ready"
                );

            }


            else if (
                nav === "profile"
            ) {

                showProfile();

            }

        }
    );

});


/* =========================================================
   PROFILE
   ========================================================= */

function showProfile() {

    closeProfile();


    const overlay =
        document.createElement("div");

    overlay.className =
        "zylo-profile-overlay";


    overlay.innerHTML = `

        <div class="zylo-profile-panel">

            <button
                class="zylo-profile-close">
                ×
            </button>


            <div class="zylo-profile-avatar">
                Z
            </div>


            <h2>
                @zylo_creator
            </h2>


            <p>
                Create • Connect • Grow
            </p>


            <div class="zylo-profile-stats">

                <div>
                    <strong>
                        0
                    </strong>
                    <span>
                        Following
                    </span>
                </div>

                <div>
                    <strong>
                        0
                    </strong>
                    <span>
                        Followers
                    </span>
                </div>

                <div>
                    <strong>
                        0
                    </strong>
                    <span>
                        Likes
                    </span>
                </div>

            </div>


            <button
                class="zylo-edit-profile">
                Edit Profile
            </button>

        </div>
    `;


    document.body.appendChild(
        overlay
    );


    overlay
        .querySelector(
            ".zylo-profile-close"
        )
        .addEventListener(
            "click",
            closeProfile
        );


    overlay.addEventListener(
        "click",
        event => {

            if (
                event.target === overlay
            ) {

                closeProfile();

            }

        }
    );


    overlay
        .querySelector(
            ".zylo-edit-profile"
        )
        .addEventListener(
            "click",
            () => {

                showToast(
                    "Profile editing is ready"
                );

            }
        );
}


function closeProfile() {

    const overlay =
        document.querySelector(
            ".zylo-profile-overlay"
        );

    if (overlay) {

        overlay.remove();

    }
}


/* =========================================================
   AUTOPLAY / PAUSE
   ========================================================= */

let videoObserver;


function setupVideoObserver() {

    if (!videoFeed) return;


    if (videoObserver) {

        videoObserver.disconnect();

    }


    videoObserver =
        new IntersectionObserver(
            entries => {

                entries.forEach(entry => {

                    const page =
                        entry.target;


                    const video =
                        page.querySelector(
                            ".video-player"
                        );


                    if (!video) return;


                    if (
                        entry.isIntersecting &&
                        entry.intersectionRatio >= 0.65
                    ) {

                        video.play()
                            .catch(() => {});


                    } else {

                        video.pause();

                    }

                });

            },
            {
                root: videoFeed,
                threshold: [
                    0.25,
                    0.65,
                    0.9
                ]
            }
        );


    document
        .querySelectorAll(
            ".video-page"
        )
        .forEach(page => {

            videoObserver.observe(
                page
            );

        });
}


/* =========================================================
   PAGE VISIBILITY
   ========================================================= */

document.addEventListener(
    "visibilitychange",
    () => {

        if (document.hidden) {

            document
                .querySelectorAll(
                    ".video-player"
                )
                .forEach(video => {

                    video.pause();

                });

        }

    }
);


/* =========================================================
   TOUCH / DOUBLE TAP LIKE
   ========================================================= */

document
    .querySelectorAll(
        ".video-page"
    )
    .forEach(page => {

        let lastTap = 0;


        page.addEventListener(
            "touchend",
            event => {

                const now =
                    Date.now();


                if (
                    now - lastTap < 300
                ) {

                    const likeBtn =
                        page.querySelector(
                            ".like-btn"
                        );


                    if (likeBtn) {

                        const videoId =
                            getVideoId(page);


                        if (!likes[videoId]) {

                            toggleLike(
                                page,
                                videoId
                            );

                            showHeartAnimation(
                                page
                            );

                        }

                    }

                }


                lastTap = now;

            },
            {
                passive: true
            }
        );

    });


/* =========================================================
   HEART ANIMATION
   ========================================================= */

function showHeartAnimation(page) {

    const heart =
        document.createElement(
            "div"
        );


    heart.className =
        "zylo-big-heart";


    heart.innerHTML =
        "♥";


    page.appendChild(
        heart
    );


    setTimeout(
        () => {

            heart.remove();

        },
        800
    );
}


/* =========================================================
   TOAST
   ========================================================= */

function showToast(message) {

    const oldToast =
        document.querySelector(
            ".zylo-toast"
        );


    if (oldToast) {

        oldToast.remove();

    }


    const toast =
        document.createElement(
            "div"
        );


    toast.className =
        "zylo-toast";


    toast.textContent =
        message;


    document.body.appendChild(
        toast
    );


    setTimeout(
        () => {

            toast.classList.add(
                "show"
            );

        },
        20
    );


    setTimeout(
        () => {

            toast.classList.remove(
                "show"
            );


            setTimeout(
                () => toast.remove(),
                250
            );

        },
        1800
    );
}


/* =========================================================
   UPLOAD STATUS
   ========================================================= */

function setUploadStatus(
    message
) {

    if (uploadStatus) {

        uploadStatus.textContent =
            message;
    }
}


/* =========================================================
   FORMAT COUNT
   ========================================================= */

function formatCount(number) {

    const value =
        Number(number) || 0;


    if (value >= 1000000) {

        return (
            (value / 1000000)
                .toFixed(1)
                .replace(".0", "") +
            "M"
        );

    }


    if (value >= 1000) {

        return (
            (value / 1000)
                .toFixed(1)
                .replace(".0", "") +
            "K"
        );

    }


    return String(value);
}


/* =========================================================
   SECURITY HELPERS
   ========================================================= */

function escapeHTML(value) {

    return String(value)
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );
}


function escapeAttribute(value) {

    return escapeHTML(value);
}


/* =========================================================
   EXTRA UI CSS
   These styles are injected automatically.
   No need to change your existing design.
   ========================================================= */

const zyloExtraStyle =
    document.createElement("style");


zyloExtraStyle.textContent = `

/* COMMENTS */

.zylo-comments-overlay,
.zylo-search-overlay,
.zylo-profile-overlay {

    position: fixed;
    inset: 0;
    z-index: 20000;

    display: flex;
    align-items: flex-end;
    justify-content: center;

    background: rgba(0,0,0,.65);

}


.zylo-comments-panel {

    width: 100%;
    max-width: 520px;

    height: 70vh;

    background: #111;

    border-radius: 22px 22px 0 0;

    display: flex;
    flex-direction: column;

    overflow: hidden;

    color: #fff;
}


.zylo-comments-header {

    height: 60px;

    display: flex;
    align-items: center;
    justify-content: center;

    border-bottom:
        1px solid #333;

    position: relative;
}


.zylo-comment-close {

    position: absolute;
    right: 15px;

    width: 38px;
    height: 38px;

    border-radius: 50%;

    background: #222;

    color: #fff;

    font-size: 25px;

}


.zylo-comments-list {

    flex: 1;

    overflow-y: auto;

    padding: 15px;
}


.zylo-comment {

    display: flex;

    gap: 10px;

    margin-bottom: 18px;
}


.zylo-comment-avatar {

    width: 38px;
    height: 38px;

    flex: 0 0 38px;

    border-radius: 50%;

    display: flex;
    align-items: center;
    justify-content: center;

    background: #222;

    border: 1px solid #555;

    font-weight: 700;
}


.zylo-comment-body strong {

    font-size: 14px;
}


.zylo-comment-body p {

    margin-top: 3px;

    font-size: 14px;

    color: #ddd;
}


.zylo-no-comments {

    text-align: center;

    color: #888;

    padding-top: 60px;
}


.zylo-comment-input {

    display: flex;

    gap: 8px;

    padding: 12px;

    border-top:
        1px solid #333;
}


.zylo-comment-field {

    flex: 1;

    min-width: 0;

    border: 0;
    outline: 0;

    border-radius: 22px;

    background: #222;

    color: #fff;

    padding: 12px 15px;

    font-size: 14px;
}


.zylo-comment-send {

    padding: 0 16px;

    border-radius: 20px;

    background: #fff;

    color: #000;

    font-weight: 700;
}


/* SEARCH */

.zylo-search-overlay {

    align-items: flex-start;

    padding-top: 90px;

}


.zylo-search-box {

    width: min(500px, 94%);

    background: #111;

    border-radius: 20px;

    padding: 18px;

    color: #fff;

}


.zylo-search-header {

    display: flex;

    align-items: center;
    justify-content: space-between;

    margin-bottom: 18px;

    font-size: 18px;
}


.zylo-search-close {

    width: 38px;
    height: 38px;

    border-radius: 50%;

    background: #222;

    color: #fff;

    font-size: 24px;
}


.zylo-search-row {

    display: flex;

    gap: 8px;
}


.zylo-search-input {

    flex: 1;

    min-width: 0;

    background: #222;

    color: #fff;

    border: 1px solid #444;

    border-radius: 12px;

    outline: none;

    padding: 13px;

    font-size: 15px;
}


.zylo-search-submit {

    border-radius: 12px;

    padding: 0 15px;

    background: #fff;

    color: #000;

    font-weight: 700;
}


.zylo-search-result {

    margin-top: 18px;

    color: #aaa;

    line-height: 1.5;
}


/* PROFILE */

.zylo-profile-overlay {

    align-items: center;

    padding: 20px;
}


.zylo-profile-panel {

    width: min(420px, 100%);

    position: relative;

    background: #111;

    border-radius: 24px;

    padding: 30px 20px;

    text-align: center;

    color: #fff;
}


.zylo-profile-close {

    position: absolute;

    top: 12px;
    right: 12px;

    width: 40px;
    height: 40px;

    border-radius: 50%;

    background: #222;

    color: #fff;

    font-size: 25px;
}


.zylo-profile-avatar {

    width: 90px;
    height: 90px;

    margin: 10px auto 15px;

    border-radius: 50%;

    display: flex;
    align-items: center;
    justify-content: center;

    background: #222;

    border: 3px solid #fff;

    font-size: 34px;

    font-weight: 700;
}


.zylo-profile-panel h2 {

    margin-bottom: 7px;

}


.zylo-profile-panel p {

    color: #aaa;

}


.zylo-profile-stats {

    display: flex;

    justify-content: space-around;

    margin: 25px 0;
}


.zylo-profile-stats div {

    display: flex;

    flex-direction: column;

    gap: 4px;
}


.zylo-profile-stats span {

    color: #888;

    font-size: 12px;
}


.zylo-edit-profile {

    width: 100%;

    padding: 13px;

    border-radius: 12px;

    background: #fff;

    color: #000;

    font-weight: 700;
}


/* TOAST */

.zylo-toast {

    position: fixed;

    left: 50%;

    bottom: 90px;

    transform:
        translate(-50%, 20px);

    z-index: 30000;

    background: rgba(20,20,20,.92);

    color: #fff;

    padding: 11px 18px;

    border-radius: 22px;

    font-size: 14px;

    opacity: 0;

    transition:
        opacity .2s ease,
        transform .2s ease;

    pointer-events: none;
}


.zylo-toast.show {

    opacity: 1;

    transform:
        translate(-50%, 0);
}


/* DOUBLE TAP HEART */

.zylo-big-heart {

    position: absolute;

    left: 50%;
    top: 50%;

    transform:
        translate(-50%, -50%)
        scale(.5);

    color: #fff;

    font-size: 100px;

    text-shadow:
        0 4px 20px rgba(0,0,0,.5);

    z-index: 100;

    pointer-events: none;

    animation:
        zyloHeart .8s ease forwards;
}


@keyframes zyloHeart {

    0% {

        opacity: 0;

        transform:
            translate(-50%, -50%)
            scale(.3);

    }

    25% {

        opacity: 1;

        transform:
            translate(-50%, -50%)
            scale(1.15);

    }

    100% {

        opacity: 0;

        transform:
            translate(-50%, -50%)
            scale(1.35);

    }

}


.music-btn.music-muted
.music-disc {

    opacity: .45;

}


`;


document.head.appendChild(
    zyloExtraStyle
);


/* =========================================================
   START ZYLO
   ========================================================= */

initializeAllVideos();

setupVideoObserver();


/* =========================================================
   START FIRST VIDEO
   ========================================================= */

setTimeout(
    () => {

        const firstVideo =
            document.querySelector(
                ".video-page .video-player"
            );


        if (firstVideo) {

            firstVideo.play()
                .catch(() => {});

        }

    },
    300
);


console.log(
    "ZYLO is ready — Create • Connect • Grow"
);
