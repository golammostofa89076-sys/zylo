"use strict";

/* =========================================================
   ZYLO — FINAL COMPLETE FUNCTIONAL SCRIPT
   ========================================================= */

const API_BASE_URL =
    "https://zylo-backend-ec5c.onrender.com";

const CDN_VIDEO_URL =
    "https://cdn.jsdelivr.net/gh/golammostofa89076-sys/zylo@main/backend/uploads/video1.mp4";


/* =========================================================
   STORAGE KEYS
   ========================================================= */

const LIKES_KEY = "zylo_likes";
const SAVES_KEY = "zylo_saves";
const FOLLOWS_KEY = "zylo_follows";
const COMMENTS_KEY = "zylo_comments";
const UPLOADED_KEY = "zylo_uploaded_videos";


/* =========================================================
   PROFILE
   ========================================================= */

const PROFILE_USERNAME = "@zylo_creator";
const PROFILE_NAME = "ZYLO Creator";
const PROFILE_TAGLINE = "Create • Connect • Grow";


/* =========================================================
   STORAGE HELPERS
   ========================================================= */

function getStorage(key, fallback) {
    try {
        const value = localStorage.getItem(key);

        if (!value) {
            return fallback;
        }

        return JSON.parse(value);

    } catch (error) {
        console.warn("ZYLO storage read error:", error);
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
        console.warn("ZYLO storage write error:", error);
    }
}


/* =========================================================
   DOM
   ========================================================= */

const videoFeed =
    document.querySelector(".video-feed");

const videoPages =
    document.querySelectorAll(".video-page");

const videoInput =
    document.getElementById("videoInput");

const uploadBox =
    document.getElementById("uploadBox");

const selectVideo =
    document.getElementById("selectVideo");

const uploadStatus =
    document.getElementById("uploadStatus");

const createBtn =
    document.getElementById("createBtn");


/* =========================================================
   VIDEO INITIALIZATION
   ========================================================= */

function initializeVideos() {

    document
        .querySelectorAll(".video-page video")
        .forEach(video => {

            video.muted = true;
            video.loop = true;
            video.playsInline = true;

            video.addEventListener(
                "error",
                () => {

                    if (
                        !video.dataset.cdnFallback &&
                        CDN_VIDEO_URL
                    ) {

                        video.dataset.cdnFallback = "true";

                        video.src = CDN_VIDEO_URL;

                        video.load();

                        video.play().catch(() => {});
                    }

                },
                { once: true }
            );

            video.play().catch(() => {});
        });
}


/* =========================================================
   GET VIDEO ID
   ========================================================= */

function getVideoId(page) {

    if (!page) {
        return "unknown";
    }

    return (
        page.dataset.videoId ||
        page.getAttribute("data-video-id") ||
        "video"
    );
}


/* =========================================================
   LIKE
   ========================================================= */

function initializeLikes() {

    document
        .querySelectorAll(".like-btn")
        .forEach(button => {

            if (button.dataset.zyloLikeReady) {
                return;
            }

            button.dataset.zyloLikeReady = "true";

            button.addEventListener("click", event => {

                event.preventDefault();
                event.stopPropagation();

                const page =
                    button.closest(".video-page");

                if (!page) {
                    return;
                }

                const videoId =
                    getVideoId(page);

                toggleLike(
                    videoId,
                    button
                );
            });

        });

    restoreLikes();
}


function toggleLike(videoId, button) {

    const likes =
        getStorage(LIKES_KEY, {});

    const current =
        likes[videoId] || 0;

    const liked =
        button.classList.contains("liked");

    if (liked) {

        likes[videoId] =
            Math.max(0, current - 1);

        button.classList.remove("liked");

    } else {

        likes[videoId] =
            current + 1;

        button.classList.add("liked");
    }

    setStorage(
        LIKES_KEY,
        likes
    );

    updateLikeCount(
        button,
        likes[videoId]
    );
}


function restoreLikes() {

    const likes =
        getStorage(LIKES_KEY, {});

    document
        .querySelectorAll(".like-btn")
        .forEach(button => {

            const page =
                button.closest(".video-page");

            if (!page) {
                return;
            }

            const id =
                getVideoId(page);

            const count =
                likes[id] || 0;

            if (count > 0) {
                button.classList.add("liked");
            }

            updateLikeCount(
                button,
                count
            );
        });
}


function updateLikeCount(button, count) {

    const label =
        button.querySelector(".action-count");

    if (label) {
        label.textContent = count;
        return;
    }

    const children =
        Array.from(button.children);

    const countElement =
        children.find(
            el =>
                el.classList.contains(
                    "count"
                )
        );

    if (countElement) {
        countElement.textContent = count;
    }
}


/* =========================================================
   SAVE
   ========================================================= */

function initializeSaves() {

    document
        .querySelectorAll(".save-btn")
        .forEach(button => {

            if (button.dataset.zyloSaveReady) {
                return;
            }

            button.dataset.zyloSaveReady = "true";

            button.addEventListener("click", event => {

                event.preventDefault();
                event.stopPropagation();

                const page =
                    button.closest(".video-page");

                if (!page) {
                    return;
                }

                const videoId =
                    getVideoId(page);

                toggleSave(
                    videoId,
                    button
                );
            });

        });

    restoreSaves();
}


function toggleSave(videoId, button) {

    const saves =
        getStorage(SAVES_KEY, {});

    const saved =
        !!saves[videoId];

    saves[videoId] =
        !saved;

    setStorage(
        SAVES_KEY,
        saves
    );

    button.classList.toggle(
        "saved",
        !saved
    );

    showToast(
        !saved
            ? "Saved"
            : "Removed from saved"
    );
}


function restoreSaves() {

    const saves =
        getStorage(SAVES_KEY, {});

    document
        .querySelectorAll(".save-btn")
        .forEach(button => {

            const page =
                button.closest(".video-page");

            if (!page) {
                return;
            }

            const id =
                getVideoId(page);

            button.classList.toggle(
                "saved",
                !!saves[id]
            );
        });
}


/* =========================================================
   COMMENTS
   ========================================================= */

function initializeComments() {

    document
        .querySelectorAll(".video-page")
        .forEach(page => {

            const buttons =
                page.querySelectorAll(
                    '[aria-label="Comments"]'
                );

            buttons.forEach(button => {

                if (button.dataset.zyloCommentReady) {
                    return;
                }

                button.dataset.zyloCommentReady = "true";

                button.addEventListener(
                    "click",
                    event => {

                        event.preventDefault();
                        event.stopPropagation();

                        openComments(page);
                    }
                );
            });

        });
}


function openComments(page) {

    const videoId =
        getVideoId(page);

    const comments =
        getStorage(
            COMMENTS_KEY,
            {}
        );

    const list =
        comments[videoId] || [];

    closeOverlayByClass(
        "zylo-comments-overlay"
    );

    const overlay =
        document.createElement("div");

    overlay.className =
        "zylo-comments-overlay";

    overlay.innerHTML = `
        <div class="zylo-comments-backdrop"></div>

        <div class="zylo-comments-panel">

            <button
                class="zylo-comments-close"
                type="button"
            >×</button>

            <h3>Comments</h3>

            <div class="zylo-comments-list">
                ${
                    list.length
                        ? list.map(
                            comment => `
                                <div class="zylo-comment">
                                    <strong>
                                        @zylo_user
                                    </strong>
                                    <span>
                                        ${escapeHTML(comment)}
                                    </span>
                                </div>
                            `
                        ).join("")
                        : `
                            <div class="zylo-no-comments">
                                No comments yet
                            </div>
                        `
                }
            </div>

            <form class="zylo-comment-form">

                <input
                    type="text"
                    class="zylo-comment-input"
                    placeholder="Add a comment..."
                    maxlength="300"
                    autocomplete="off"
                />

                <button
                    type="submit"
                    class="zylo-comment-send"
                >
                    Send
                </button>

            </form>

        </div>
    `;

    document.body.appendChild(
        overlay
    );

    overlay
        .querySelector(
            ".zylo-comments-close"
        )
        .addEventListener(
            "click",
            () => overlay.remove()
        );

    overlay
        .querySelector(
            ".zylo-comments-backdrop"
        )
        .addEventListener(
            "click",
            () => overlay.remove()
        );

    overlay
        .querySelector(
            ".zylo-comment-form"
        )
        .addEventListener(
            "submit",
            event => {

                event.preventDefault();

                const input =
                    overlay.querySelector(
                        ".zylo-comment-input"
                    );

                const text =
                    input.value.trim();

                if (!text) {
                    return;
                }

                const data =
                    getStorage(
                        COMMENTS_KEY,
                        {}
                    );

                if (!Array.isArray(data[videoId])) {
                    data[videoId] = [];
                }

                data[videoId].push(text);

                setStorage(
                    COMMENTS_KEY,
                    data
                );

                overlay.remove();

                openComments(page);

                updateCommentCount(
                    page
                );
            }
        );
}


function updateCommentCount(page) {

    const videoId =
        getVideoId(page);

    const comments =
        getStorage(
            COMMENTS_KEY,
            {}
        );

    const count =
        Array.isArray(comments[videoId])
            ? comments[videoId].length
            : 0;

    const button =
        page.querySelector(
            '[aria-label="Comments"]'
        );

    if (!button) {
        return;
    }

    const countElement =
        button.querySelector(
            ".action-count, .count"
        );

    if (countElement) {
        countElement.textContent = count;
    }
}


function restoreCommentCounts() {

    document
        .querySelectorAll(".video-page")
        .forEach(updateCommentCount);
}


/* =========================================================
   SHARE
   ========================================================= */

function initializeShares() {

    document
        .querySelectorAll(".share-btn")
        .forEach(button => {

            if (button.dataset.zyloShareReady) {
                return;
            }

            button.dataset.zyloShareReady = "true";

            button.addEventListener(
                "click",
                async event => {

                    event.preventDefault();
                    event.stopPropagation();

                    const page =
                        button.closest(
                            ".video-page"
                        );

                    const url =
                        window.location.href;

                    try {

                        if (
                            navigator.share
                        ) {

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

                            showToast(
                                "Link copied"
                            );

                        } else {

                            showToast(
                                "Share not supported"
                            );
                        }

                    } catch (error) {

                        if (
                            error &&
                            error.name !==
                                "AbortError"
                        ) {

                            showToast(
                                "Share cancelled"
                            );
                        }
                    }
                }
            );
        });
}


/* =========================================================
   MUSIC
   ========================================================= */

function initializeMusic() {

    document
        .querySelectorAll(".music-btn")
        .forEach(button => {

            if (button.dataset.zyloMusicReady) {
                return;
            }

            button.dataset.zyloMusicReady = "true";

            button.addEventListener(
                "click",
                event => {

                    event.preventDefault();
                    event.stopPropagation();

                    showToast(
                        "Original sound • ZYLO Creator"
                    );
                }
            );
        });
}


/* =========================================================
   FULLSCREEN
   ========================================================= */

function initializeFullscreen() {

    document
        .querySelectorAll(".fullscreen-btn")
        .forEach(button => {

            if (button.dataset.zyloFullscreenReady) {
                return;
            }

            button.dataset.zyloFullscreenReady =
                "true";

            button.addEventListener(
                "click",
                async event => {

                    event.preventDefault();
                    event.stopPropagation();

                    const page =
                        button.closest(
                            ".video-page"
                        );

                    const video =
                        page?.querySelector(
                            "video"
                        );

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

                        } else {

                            showToast(
                                "Fullscreen not supported"
                            );
                        }

                    } catch (error) {
                        console.warn(
                            "Fullscreen error:",
                            error
                        );
                    }
                }
            );
        });
}


/* =========================================================
   DOUBLE TAP LIKE
   ========================================================= */

function initializeDoubleTap() {

    document
        .querySelectorAll(".video-page video")
        .forEach(video => {

            let lastTap = 0;

            video.addEventListener(
                "touchend",
                event => {

                    const now =
                        Date.now();

                    if (
                        now - lastTap <
                        350
                    ) {

                        const page =
                            video.closest(
                                ".video-page"
                            );

                        const button =
                            page?.querySelector(
                                ".like-btn"
                            );

                        if (
                            button &&
                            !button.classList.contains(
                                "liked"
                            )
                        ) {

                            toggleLike(
                                getVideoId(page),
                                button
                            );
                        }

                        showBigHeart(
                            page
                        );
                    }

                    lastTap = now;
                },
                {
                    passive: true
                }
            );

            video.addEventListener(
                "dblclick",
                event => {

                    event.preventDefault();

                    const page =
                        video.closest(
                            ".video-page"
                        );

                    const button =
                        page?.querySelector(
                            ".like-btn"
                        );

                    if (
                        button &&
                        !button.classList.contains(
                            "liked"
                        )
                    ) {

                        toggleLike(
                            getVideoId(page),
                            button
                        );
                    }

                    showBigHeart(page);
                }
            );
        });
}


function showBigHeart(page) {

    if (!page) {
        return;
    }

    const heart =
        document.createElement("div");

    heart.className =
        "zylo-big-heart";

    heart.textContent = "♥";

    page.appendChild(heart);

    requestAnimationFrame(() => {
        heart.classList.add("show");
    });

    setTimeout(() => {
        heart.remove();
    }, 700);
}


/* =========================================================
   CREATOR PROFILE
   RIGHT SIDE Z+
   ========================================================= */

function getFollowingState() {

    const follows =
        getStorage(
            FOLLOWS_KEY,
            {}
        );

    if (Array.isArray(follows)) {

        return follows.includes(
            PROFILE_USERNAME
        );
    }

    if (
        follows &&
        typeof follows === "object"
    ) {

        return !!follows[
            PROFILE_USERNAME
        ];
    }

    return false;
}


function getProfileStats() {

    const likes =
        getStorage(
            LIKES_KEY,
            {}
        );

    const follows =
        getStorage(
            FOLLOWS_KEY,
            {}
        );

    const uploaded =
        getStorage(
            UPLOADED_KEY,
            []
        );

    let totalLikes = 0;

    Object.values(likes).forEach(
        value => {

            if (
                typeof value ===
                "number"
            ) {

                totalLikes += value;

            } else if (
                value === true
            ) {

                totalLikes += 1;
            }
        }
    );

    let totalFollowing = 0;

    if (Array.isArray(follows)) {

        totalFollowing =
            follows.length;

    } else if (
        follows &&
        typeof follows === "object"
    ) {

        totalFollowing =
            Object.values(follows)
                .filter(Boolean)
                .length;
    }

    let videoCount = 2;

    if (Array.isArray(uploaded)) {

        videoCount =
            Math.max(
                2,
                uploaded.length + 2
            );
    }

    return {
        following: totalFollowing,
        followers: 0,
        likes: totalLikes || 5,
        videos: videoCount
    };
}


function showCreatorProfile() {

    closeProfileModal();

    const stats =
        getProfileStats();

    const following =
        getFollowingState();

    createProfileModal({
        title: PROFILE_NAME,
        username: PROFILE_USERNAME,
        verified: true,
        buttonText:
            following
                ? "Following"
                : "Follow",
        myProfile: false,
        stats
    });
}


/* =========================================================
   MY PROFILE
   BOTTOM PROFILE
   ========================================================= */

function showMyProfile() {

    closeProfileModal();

    const stats =
        getProfileStats();

    createProfileModal({
        title: "My Profile",
        username: PROFILE_USERNAME,
        verified: false,
        buttonText: "Edit Profile",
        myProfile: true,
        stats
    });
}


/* =========================================================
   PROFILE MODAL
   ========================================================= */

function createProfileModal(options) {

    const {
        title,
        username,
        verified,
        buttonText,
        myProfile,
        stats
    } = options;

    const modal =
        document.createElement("div");

    modal.className =
        "zylo-profile-modal";

    modal.innerHTML = `
        <div class="zylo-profile-backdrop"></div>

        <div class="zylo-profile-card">

            <button
                class="zylo-profile-close"
                type="button"
                aria-label="Close"
            >
                ×
            </button>

            <div class="zylo-profile-avatar">
                Z
            </div>

            <div class="zylo-profile-name">
                ${escapeHTML(title)}
                ${
                    verified
                        ? '<span class="zylo-verified">✓</span>'
                        : ""
                }
            </div>

            <div class="zylo-profile-username">
                ${escapeHTML(username)}
            </div>

            <div class="zylo-profile-tagline">
                ${PROFILE_TAGLINE}
            </div>

            <div class="zylo-profile-stats">

                <div class="zylo-profile-stat">
                    <strong>
                        ${stats.following}
                    </strong>
                    <span>
                        Following
                    </span>
                </div>

                <div class="zylo-profile-stat">
                    <strong>
                        ${stats.followers}
                    </strong>
                    <span>
                        Followers
                    </span>
                </div>

                <div class="zylo-profile-stat">
                    <strong>
                        ${stats.likes}
                    </strong>
                    <span>
                        Likes
                    </span>
                </div>

            </div>

            <button
                class="zylo-profile-main-btn"
                type="button"
            >
                ${buttonText}
            </button>

            <div class="zylo-profile-divider"></div>

            <div class="zylo-profile-videos">
                ${
                    myProfile
                        ? `
                            My Videos:
                            <span>
                                ${stats.videos}
                            </span>
                        `
                        : "Videos"
                }
            </div>

        </div>
    `;

    document.body.appendChild(
        modal
    );

    modal
        .querySelector(
            ".zylo-profile-close"
        )
        .addEventListener(
            "click",
            closeProfileModal
        );

    modal
        .querySelector(
            ".zylo-profile-backdrop"
        )
        .addEventListener(
            "click",
            closeProfileModal
        );

    modal
        .querySelector(
            ".zylo-profile-main-btn"
        )
        .addEventListener(
            "click",
            () => {

                if (myProfile) {

                    showToast(
                        "Edit Profile coming soon"
                    );

                } else {

                    toggleCreatorFollow();
                }
            }
        );

    injectProfileStyles();
}


/* =========================================================
   FOLLOW / UNFOLLOW
   ========================================================= */

function toggleCreatorFollow() {

    let follows =
        getStorage(
            FOLLOWS_KEY,
            {}
        );

    if (Array.isArray(follows)) {

        if (
            follows.includes(
                PROFILE_USERNAME
            )
        ) {

            follows =
                follows.filter(
                    username =>
                        username !==
                        PROFILE_USERNAME
                );

        } else {

            follows.push(
                PROFILE_USERNAME
            );
        }

    } else {

        if (
            !follows ||
            typeof follows !==
                "object"
        ) {

            follows = {};
        }

        follows[
            PROFILE_USERNAME
        ] =
            !follows[
                PROFILE_USERNAME
            ];
    }

    setStorage(
        FOLLOWS_KEY,
        follows
    );

    updateProfileButtons();

    showCreatorProfile();
}


/* =========================================================
   PROFILE SIDE BUTTON
   ========================================================= */

function initializeProfileButton() {

    document
        .querySelectorAll(
            ".profile-action"
        )
        .forEach(button => {

            if (button.dataset.zyloProfileReady) {
                return;
            }

            button.dataset.zyloProfileReady =
                "true";

            button.addEventListener(
                "click",
                event => {

                    event.preventDefault();
                    event.stopPropagation();

                    showCreatorProfile();
                }
            );
        });

    updateProfileButtons();
}


function updateProfileButtons() {

    const following =
        getFollowingState();

    document
        .querySelectorAll(
            ".profile-action"
        )
        .forEach(button => {

            const badge =
                button.querySelector(
                    ".follow-badge"
                );

            if (!badge) {
                return;
            }

            badge.textContent =
                following
                    ? "✓"
                    : "+";
        });
}


/* =========================================================
   BOTTOM PROFILE BUTTON
   ========================================================= */

function initializeBottomProfile() {

    const profileNav =
        document.querySelector(
            '[data-nav="profile"]'
        );

    if (!profileNav) {
        return;
    }

    if (profileNav.dataset.zyloProfileNavReady) {
        return;
    }

    profileNav.dataset.zyloProfileNavReady =
        "true";

    profileNav.addEventListener(
        "click",
        event => {

            event.preventDefault();
            event.stopPropagation();

            showMyProfile();
        }
    );
}


/* =========================================================
   UPLOAD MODAL
   ========================================================= */

function initializeUpload() {

    if (createBtn) {

        createBtn.addEventListener(
            "click",
            event => {

                event.preventDefault();
                event.stopPropagation();

                openUploadBox();
            }
        );
    }

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

    if (videoInput) {

        videoInput.addEventListener(
            "change",
            handleVideoUpload
        );
    }

    const closeUpload =
        document.querySelector(
            "#uploadBox .upload-close"
        );

    if (closeUpload) {

        closeUpload.addEventListener(
            "click",
            closeUploadBox
        );
    }
}


function openUploadBox() {

    if (!uploadBox) {
        return;
    }

    uploadBox.classList.add(
        "show"
    );

    uploadBox.classList.add(
        "active"
    );
}


function closeUploadBox() {

    if (!uploadBox) {
        return;
    }

    uploadBox.classList.remove(
        "show"
    );

    uploadBox.classList.remove(
        "active"
    );
}


async function handleVideoUpload(event) {

    const file =
        event.target.files?.[0];

    if (!file) {
        return;
    }

    if (
        !file.type.startsWith(
            "video/"
        )
    ) {

        setUploadStatus(
            "Please select a video file."
        );

        return;
    }

    setUploadStatus(
        "Uploading..."
    );

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

        if (!response.ok) {

            throw new Error(
                `Upload failed: ${response.status}`
            );
        }

        const result =
            await response.json();

        if (
            !result ||
            !result.url
        ) {

            throw new Error(
                "Upload response did not contain a video URL."
            );
        }

        saveUploadedVideo(
            result.url
        );

        addUploadedVideo(
            result.url
        );

        setUploadStatus(
            "Upload successful!"
        );

        showToast(
            "Video uploaded"
        );

        setTimeout(
            closeUploadBox,
            800
        );

    } catch (error) {

        console.error(
            "ZYLO upload error:",
            error
        );

        setUploadStatus(
            "Upload failed. Please try again."
        );

        showToast(
            "Upload failed"
        );
    }
}


function setUploadStatus(message) {

    if (uploadStatus) {
        uploadStatus.textContent =
            message;
    }
}


function saveUploadedVideo(url) {

    const videos =
        getStorage(
            UPLOADED_KEY,
            []
        );

    if (!Array.isArray(videos)) {
        return;
    }

    videos.push({
        url,
        createdAt: Date.now()
    });

    setStorage(
        UPLOADED_KEY,
        videos
    );
}


/* =========================================================
   ADD UPLOADED VIDEO TO FEED
   ========================================================= */

function addUploadedVideo(url) {

    if (!videoFeed) {
        return;
    }

    const page =
        document.createElement(
            "section"
        );

    page.className =
        "video-page";

    page.dataset.videoId =
        "uploaded-" +
        Date.now();

    page.innerHTML = `
        <video
            src="${escapeAttribute(url)}"
            loop
            muted
            playsinline
            preload="metadata"
        ></video>

        <div class="video-overlay"></div>

        <button
            class="fullscreen-btn"
            aria-label="Fullscreen"
            type="button"
        >
            <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
            >
                <path
                    d="M4 9V4h5
                       M15 4h5v5
                       M20 15v5h-5
                       M9 20H4v-5"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                />
            </svg>
        </button>

        <div class="right-actions">

            <button
                class="profile-action"
                type="button"
            >
                <span class="profile-circle">
                    Z
                </span>
                <span class="follow-badge">
                    +
                </span>
            </button>

            <button
                class="action-btn like-btn"
                type="button"
            >
                <svg
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                >
                    <path
                        d="M12 21
                           C12 21 4 15.5 4 9.5
                           C4 6.5 6 4 8.8 4
                           C10.5 4 11.7 5
                           12 6
                           C12.3 5 13.5 4 15.2 4
                           C18 4 20 6.5 20 9.5
                           C20 15.5 12 21 12 21Z"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                    />
                </svg>
                <span class="action-count">0</span>
            </button>

            <button
                class="action-btn"
                aria-label="Comments"
                type="button"
            >
                <svg
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                >
                    <path
                        d="M20 11.5
                           C20 15.6 16.4 19 12 19
                           C10.5 19 9 18.6 7.8 18
                           L4 20
                           L5 16.5
                           C4.3 15.1 4 13.7 4 11.5
                           C4 7.4 7.6 4 12 4
                           C16.4 4 20 7.4 20 11.5Z"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                    />
                </svg>
                <span class="action-count">0</span>
            </button>

            <button
                class="action-btn save-btn"
                type="button"
            >
                <svg
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                >
                    <path
                        d="M6 4
                           C6 3.45 6.45 3 7 3
                           H17
                           C17.55 3 18 3.45 18 4
                           V21
                           L12 17.5
                           L6 21
                           V4Z"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linejoin="round"
                    />
                </svg>
                <span class="action-label">
                    Save
                </span>
            </button>

            <button
                class="action-btn share-btn"
                type="button"
            >
                <svg
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                >
                    <path
                        d="M21 3
                           L10 14
                           M21 3
                           L14 21
                           L10 14
                           L3 10
                           L21 3Z"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                    />
                </svg>
                <span class="action-label">
                    Share
                </span>
            </button>

            <button
                class="music-btn"
                type="button"
            >
                <span class="music-disc">
                    ●
                </span>
                <span>
                    Music
                </span>
            </button>

        </div>

        <div class="video-info">

            <div class="username">
                @zylo_creator
            </div>

            <div class="caption">
                Welcome to ZYLO 🌎
            </div>

            <div class="tagline">
                Create • Connect • Grow
            </div>

            <div class="hashtags">
                #ZYLO #ShortVideo #Create
            </div>

            <div class="music-info">
                Original sound • ZYLO Creator
            </div>

        </div>
    `;

    videoFeed.appendChild(
        page
    );

    initializePageFeatures(
        page
    );

    observeVideoPage(
        page
    );
}


/* =========================================================
   INITIALIZE ONE PAGE
   ========================================================= */

function initializePageFeatures(page) {

    const video =
        page.querySelector(
            "video"
        );

    if (video) {

        video.muted = true;
        video.loop = true;
        video.playsInline = true;

        video.addEventListener(
            "error",
            () => {

                if (
                    !video.dataset.cdnFallback
                ) {

                    video.dataset.cdnFallback =
                        "true";

                    video.src =
                        CDN_VIDEO_URL;

                    video.load();

                    video.play().catch(
                        () => {}
                    );
                }
            },
            { once: true }
        );
    }

    const like =
        page.querySelector(
            ".like-btn"
        );

    if (like) {

        like.addEventListener(
            "click",
            event => {

                event.preventDefault();
                event.stopPropagation();

                toggleLike(
                    getVideoId(page),
                    like
                );
            }
        );
    }

    const comment =
        page.querySelector(
            '[aria-label="Comments"]'
        );

    if (comment) {

        comment.addEventListener(
            "click",
            event => {

                event.preventDefault();
                event.stopPropagation();

                openComments(page);
            }
        );
    }

    const save =
        page.querySelector(
            ".save-btn"
        );

    if (save) {

        save.addEventListener(
            "click",
            event => {

                event.preventDefault();
                event.stopPropagation();

                toggleSave(
                    getVideoId(page),
                    save
                );
            }
        );
    }

    const share =
        page.querySelector(
            ".share-btn"
        );

    if (share) {

        share.addEventListener(
            "click",
            event => {

                event.preventDefault();
                event.stopPropagation();

                shareVideo();
            }
        );
    }

    const music =
        page.querySelector(
            ".music-btn"
        );

    if (music) {

        music.addEventListener(
            "click",
            event => {

                event.preventDefault();
                event.stopPropagation();

                showToast(
                    "Original sound • ZYLO Creator"
                );
            }
        );
    }

    const fullscreen =
        page.querySelector(
            ".fullscreen-btn"
        );

    if (fullscreen) {

        fullscreen.addEventListener(
            "click",
            event => {

                event.preventDefault();
                event.stopPropagation();

                toggleFullscreen(
                    video
                );
            }
        );
    }

    const profile =
        page.querySelector(
            ".profile-action"
        );

    if (profile) {

        profile.addEventListener(
            "click",
            event => {

                event.preventDefault();
                event.stopPropagation();

                showCreatorProfile();
            }
        );
    }

    restorePageState(
        page
    );
}


/* =========================================================
   PAGE STATE
   ========================================================= */

function restorePageState(page) {

    const id =
        getVideoId(page);

    const likes =
        getStorage(
            LIKES_KEY,
            {}
        );

    const saves =
        getStorage(
            SAVES_KEY,
            {}
        );

    const comments =
        getStorage(
            COMMENTS_KEY,
            {}
        );

    const like =
        page.querySelector(
            ".like-btn"
        );

    if (like) {

        like.classList.toggle(
            "liked",
            (likes[id] || 0) > 0
        );

        updateLikeCount(
            like,
            likes[id] || 0
        );
    }

    const save =
        page.querySelector(
            ".save-btn"
        );

    if (save) {

        save.classList.toggle(
            "saved",
            !!saves[id]
        );
    }

    const comment =
        page.querySelector(
            '[aria-label="Comments"]'
        );

    if (comment) {

        const count =
            Array.isArray(
                comments[id]
            )
                ? comments[id].length
                : 0;

        const countElement =
            comment.querySelector(
                ".action-count, .count"
            );

        if (countElement) {
            countElement.textContent =
                count;
        }
    }
}


/* =========================================================
   SHARE HELPER
   ========================================================= */

async function shareVideo() {

    const url =
        window.location.href;

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

            showToast(
                "Link copied"
            );

        } else {

            showToast(
                "Share not supported"
            );
        }

    } catch (error) {

        if (
            error?.name !==
            "AbortError"
        ) {

            console.warn(
                "Share error:",
                error
            );
        }
    }
}


/* =========================================================
   FULLSCREEN HELPER
   ========================================================= */

async function toggleFullscreen(video) {

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

        } else {

            showToast(
                "Fullscreen not supported"
            );
        }

    } catch (error) {

        console.warn(
            "Fullscreen error:",
            error
        );
    }
}


/* =========================================================
   VIDEO INTERSECTION OBSERVER
   ========================================================= */

let videoObserver = null;


function initializeVideoObserver() {

    if (!videoFeed) {
        return;
    }

    if (videoObserver) {
        return;
    }

    videoObserver =
        new IntersectionObserver(
            entries => {

                entries.forEach(
                    entry => {

                        const video =
                            entry.target.querySelector(
                                "video"
                            );

                        if (!video) {
                            return;
                        }

                        if (
                            entry.isIntersecting &&
                            entry.intersectionRatio >= 0.65
                        ) {

                            document
                                .querySelectorAll(
                                    ".video-page video"
                                )
                                .forEach(
                                    other => {

                                        if (
                                            other !==
                                            video
                                        ) {

                                            other.pause();
                                        }
                                    }
                                );

                            video.play().catch(
                                () => {}
                            );

                        } else {

                            video.pause();
                        }
                    }
                );
            },
            {
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
        .forEach(
            page => {

                videoObserver.observe(
                    page
                );
            }
        );
}


function observeVideoPage(page) {

    if (
        videoObserver &&
        page
    ) {

        videoObserver.observe(
            page
        );
    }
}


/* =========================================================
   VISIBILITY
   ========================================================= */

document.addEventListener(
    "visibilitychange",
    () => {

        if (
            document.hidden
        ) {

            document
                .querySelectorAll(
                    ".video-page video"
                )
                .forEach(
                    video =>
                        video.pause()
                );

        } else {

            const visiblePage =
                getVisibleVideoPage();

            const video =
                visiblePage?.querySelector(
                    "video"
                );

            if (video) {

                video.play().catch(
                    () => {}
                );
            }
        }
    }
);


function getVisibleVideoPage() {

    const pages =
        Array.from(
            document.querySelectorAll(
                ".video-page"
            )
        );

    let bestPage = null;
    let bestRatio = 0;

    pages.forEach(page => {

        const rect =
            page.getBoundingClientRect();

        const visibleTop =
            Math.max(
                rect.top,
                0
            );

        const visibleBottom =
            Math.min(
                rect.bottom,
                window.innerHeight
            );

        const visible =
            Math.max(
                0,
                visibleBottom -
                visibleTop
            );

        const ratio =
            rect.height
                ? visible / rect.height
                : 0;

        if (ratio > bestRatio) {

            bestRatio =
                ratio;

            bestPage =
                page;
        }
    });

    return bestPage;
}


/* =========================================================
   TOP TABS
   ========================================================= */

function initializeTopTabs() {

    const tabs =
        document.querySelectorAll(
            ".top-bar button, .top-bar .tab"
        );

    tabs.forEach(tab => {

        if (
            tab.dataset.zyloTabReady
        ) {
            return;
        }

        tab.dataset.zyloTabReady =
            "true";

        tab.addEventListener(
            "click",
            () => {

                tabs.forEach(
                    item =>
                        item.classList.remove(
                            "active"
                        )
                );

                tab.classList.add(
                    "active"
                );
            }
        );
    });
}


/* =========================================================
   SEARCH
   ========================================================= */

function initializeSearch() {

    const searchButton =
        document.querySelector(
            ".search-btn"
        ) ||
        document.querySelector(
            '[aria-label="Search"]'
        );

    if (!searchButton) {
        return;
    }

    if (
        searchButton.dataset.zyloSearchReady
    ) {
        return;
    }

    searchButton.dataset.zyloSearchReady =
        "true";

    searchButton.addEventListener(
        "click",
        event => {

            event.preventDefault();
            event.stopPropagation();

            openSearch();
        }
    );
}


function openSearch() {

    closeOverlayByClass(
        "zylo-search-overlay"
    );

    const overlay =
        document.createElement(
            "div"
        );

    overlay.className =
        "zylo-search-overlay";

    overlay.innerHTML = `
        <div class="zylo-search-backdrop"></div>

        <div class="zylo-search-panel">

            <button
                class="zylo-search-close"
                type="button"
            >
                ×
            </button>

            <div class="zylo-search-title">
                Search ZYLO
            </div>

            <input
                class="zylo-search-input"
                type="search"
                placeholder="Search creators..."
                autocomplete="off"
            />

            <div
                class="zylo-search-results"
            ></div>

        </div>
    `;

    document.body.appendChild(
        overlay
    );

    const input =
        overlay.querySelector(
            ".zylo-search-input"
        );

    const results =
        overlay.querySelector(
            ".zylo-search-results"
        );

    overlay
        .querySelector(
            ".zylo-search-close"
        )
        .addEventListener(
            "click",
            () => overlay.remove()
        );

    overlay
        .querySelector(
            ".zylo-search-backdrop"
        )
        .addEventListener(
            "click",
            () => overlay.remove()
        );

    input.addEventListener(
        "input",
        () => {

            const query =
                input.value
                    .trim()
                    .toLowerCase();

            if (!query) {

                results.innerHTML = "";

                return;
            }

            if (
                PROFILE_USERNAME
                    .toLowerCase()
                    .includes(query) ||
                PROFILE_NAME
                    .toLowerCase()
                    .includes(query)
            ) {

                results.innerHTML = `
                    <button
                        class="zylo-search-result"
                        type="button"
                    >
                        <strong>
                            ${PROFILE_NAME}
                        </strong>
                        <span>
                            ${PROFILE_USERNAME}
                        </span>
                    </button>
                `;

                results
                    .querySelector(
                        ".zylo-search-result"
                    )
                    .addEventListener(
                        "click",
                        () => {

                            overlay.remove();

                            showCreatorProfile();
                        }
                    );

            } else {

                results.innerHTML = `
                    <div class="zylo-no-results">
                        No results found
                    </div>
                `;
            }
        }
    );

    setTimeout(
        () => input.focus(),
        50
    );
}


/* =========================================================
   BOTTOM NAVIGATION
   ========================================================= */

function initializeBottomNavigation() {

    document
        .querySelectorAll(
            "[data-nav]"
        )
        .forEach(nav => {

            if (
                nav.dataset.zyloNavReady
            ) {
                return;
            }

            nav.dataset.zyloNavReady =
                "true";

            const type =
                nav.dataset.nav;

            if (
                type === "profile"
            ) {
                return;
            }

            nav.addEventListener(
                "click",
                event => {

                    event.preventDefault();

                    document
                        .querySelectorAll(
                            "[data-nav]"
                        )
                        .forEach(
                            item =>
                                item.classList.remove(
                                    "active"
                                )
                        );

                    nav.classList.add(
                        "active"
                    );

                    if (
                        type === "home"
                    ) {

                        videoFeed?.scrollTo({
                            top: 0,
                            behavior: "smooth"
                        });

                    } else if (
                        type === "discover"
                    ) {

                        showToast(
                            "Discover coming soon"
                        );

                    } else if (
                        type === "inbox"
                    ) {

                        showToast(
                            "Inbox coming soon"
                        );
                    }
                }
            );
        });
}


/* =========================================================
   ESCAPE KEY
   ========================================================= */

document.addEventListener(
    "keydown",
    event => {

        if (
            event.key !==
            "Escape"
        ) {
            return;
        }

        closeProfileModal();

        document
            .querySelectorAll(
                ".zylo-comments-overlay, .zylo-search-overlay"
            )
            .forEach(
                overlay =>
                    overlay.remove()
            );

        closeUploadBox();
    }
);


/* =========================================================
   TOAST
   ========================================================= */

function showToast(message) {

    const old =
        document.querySelector(
            ".zylo-toast"
        );

    if (old) {
        old.remove();
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

    requestAnimationFrame(
        () => {
            toast.classList.add(
                "show"
            );
        }
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
   HELPERS
   ========================================================= */

function closeProfileModal() {

    document
        .querySelectorAll(
            ".zylo-profile-modal"
        )
        .forEach(
            modal =>
                modal.remove()
        );
}


function closeOverlayByClass(className) {

    document
        .querySelectorAll(
            "." + className
        )
        .forEach(
            element =>
                element.remove()
        );
}


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
   PROFILE / COMMENTS / SEARCH STYLES
   These styles do NOT modify your existing main UI.
   ========================================================= */

function injectProfileStyles() {

    if (
        document.getElementById(
            "zylo-dynamic-styles"
        )
    ) {
        return;
    }

    const style =
        document.createElement(
            "style"
        );

    style.id =
        "zylo-dynamic-styles";

    style.textContent = `

        .zylo-profile-modal,
        .zylo-comments-overlay,
        .zylo-search-overlay {

            position: fixed;
            inset: 0;
            z-index: 99999;

            display: flex;
            align-items: center;
            justify-content: center;

            font-family:
                Arial,
                sans-serif;
        }


        .zylo-profile-backdrop,
        .zylo-comments-backdrop,
        .zylo-search-backdrop {

            position: absolute;
            inset: 0;

            background:
                rgba(0,0,0,.72);

            backdrop-filter:
                blur(3px);
        }


        .zylo-profile-card {

            position: relative;
            z-index: 2;

            width:
                min(635px, 92vw);

            min-height: 650px;

            padding:
                62px 42px 42px;

            box-sizing:
                border-box;

            background:
                #111;

            color:
                #fff;

            border-radius:
                30px;

            text-align:
                center;

            box-shadow:
                0 20px 60px
                rgba(0,0,0,.55);
        }


        .zylo-profile-close {

            position: absolute;

            top: 24px;
            right: 20px;

            width: 64px;
            height: 64px;

            border: 0;

            border-radius: 50%;

            background:
                #303030;

            color:
                #fff;

            font-size:
                38px;

            line-height:
                1;

            cursor:
                pointer;
        }


        .zylo-profile-avatar {

            width: 145px;
            height: 145px;

            margin:
                0 auto 28px;

            display: flex;

            align-items:
                center;

            justify-content:
                center;

            border:
                3px solid #fff;

            border-radius:
                50%;

            font-size:
                70px;

            font-weight:
                500;
        }


        .zylo-profile-name {

            font-size:
                35px;

            font-weight:
                700;

            margin-bottom:
                10px;
        }


        .zylo-verified {

            margin-left:
                5px;
        }


        .zylo-profile-username {

            font-size:
                24px;

            opacity:
                .85;

            margin-bottom:
                18px;
        }


        .zylo-profile-tagline {

            font-size:
                23px;

            margin-bottom:
                48px;
        }


        .zylo-profile-stats {

            display:
                flex;

            justify-content:
                space-around;

            margin-bottom:
                42px;
        }


        .zylo-profile-stat {

            display:
                flex;

            flex-direction:
                column;

            gap:
                10px;
        }


        .zylo-profile-stat strong {

            font-size:
                30px;
        }


        .zylo-profile-stat span {

            font-size:
                19px;

            opacity:
                .75;
        }


        .zylo-profile-main-btn {

            width:
                100%;

            min-height:
                72px;

            border:
                0;

            border-radius:
                18px;

            background:
                #fff;

            color:
                #111;

            font-size:
                24px;

            font-weight:
                600;

            cursor:
                pointer;
        }


        .zylo-profile-divider {

            height:
                1px;

            background:
                rgba(255,255,255,.12);

            margin:
                34px 0 28px;
        }


        .zylo-profile-videos {

            font-size:
                25px;
        }


        .zylo-profile-videos span {

            display:
                inline-block;
        }


        .zylo-comments-panel,
        .zylo-search-panel {

            position: relative;
            z-index: 2;

            width:
                min(620px, 92vw);

            max-height:
                82vh;

            overflow:
                hidden;

            background:
                #111;

            color:
                #fff;

            border-radius:
                25px;

            padding:
                30px;

            box-sizing:
                border-box;
        }


        .zylo-comments-close,
        .zylo-search-close {

            position: absolute;

            top: 15px;
            right: 18px;

            border: 0;

            background: transparent;

            color: #fff;

            font-size: 35px;

            cursor:
                pointer;
        }


        .zylo-comments-panel h3 {

            text-align:
                center;

            font-size:
                24px;

            margin:
                0 0 25px;
        }


        .zylo-comments-list {

            max-height:
                48vh;

            overflow-y:
                auto;

            margin-bottom:
                20px;
        }


        .zylo-comment {

            padding:
                12px 0;

            border-bottom:
                1px solid
                rgba(255,255,255,.1);

            display:
                flex;

            flex-direction:
                column;

            gap:
                4px;
        }


        .zylo-no-comments,
        .zylo-no-results {

            text-align:
                center;

            opacity:
                .65;

            padding:
                30px;
        }


        .zylo-comment-form {

            display:
                flex;

            gap:
                8px;
        }


        .zylo-comment-input,
        .zylo-search-input {

            flex:
                1;

            min-width:
                0;

            padding:
                14px 16px;

            border:
                0;

            outline:
                none;

            border-radius:
                12px;

            background:
                #252525;

            color:
                #fff;

            font-size:
                16px;
        }


        .zylo-comment-send {

            border:
                0;

            border-radius:
                12px;

            padding:
                0 18px;

            background:
                #fff;

            color:
                #111;

            font-weight:
                600;
        }


        .zylo-search-title {

            font-size:
                25px;

            font-weight:
                700;

            margin-bottom:
                20px;

            text-align:
                center;
        }


        .zylo-search-results {

            margin-top:
                20px;
        }


        .zylo-search-result {

            width:
                100%;

            display:
                flex;

            flex-direction:
                column;

            align-items:
                flex-start;

            gap:
                5px;

            padding:
                15px;

            border:
                0;

            border-radius:
                14px;

            background:
                #222;

            color:
                #fff;

            text-align:
                left;
        }


        .zylo-big-heart {

            position:
                absolute;

            left:
                50%;

            top:
                50%;

            z-index:
                20;

            transform:
                translate(-50%,-50%)
                scale(.3);

            opacity:
                0;

            color:
                #fff;

            font-size:
                110px;

            pointer-events:
                none;

            transition:
                .25s ease;
        }


        .zylo-big-heart.show {

            transform:
                translate(-50%,-50%)
                scale(1.15);

            opacity:
                1;
        }


        .zylo-toast {

            position:
                fixed;

            left:
                50%;

            bottom:
                95px;

            z-index:
                100000;

            transform:
                translate(-50%,20px);

            opacity:
                0;

            background:
                rgba(30,30,30,.95);

            color:
                #fff;

            padding:
                12px 20px;

            border-radius:
                25px;

            font-size:
                14px;

            pointer-events:
                none;

            transition:
                .25s ease;
        }


        .zylo-toast.show {

            opacity:
                1;

            transform:
                translate(-50%,0);
        }


        @media (max-width: 600px) {

            .zylo-profile-card {

                width:
                    92vw;

                min-height:
                    0;

                padding:
                    62px 25px 30px;

                border-radius:
                    28px;
            }

            .zylo-profile-avatar {

                width:
                    148px;

                height:
                    148px;
            }

            .zylo-profile-name {

                font-size:
                    30px;
            }

            .zylo-profile-username {

                font-size:
                    21px;
            }

            .zylo-profile-tagline {

                font-size:
                    21px;

                margin-bottom:
                    40px;
            }

            .zylo-profile-stat strong {

                font-size:
                    28px;
            }

            .zylo-profile-stat span {

                font-size:
                    17px;
            }

            .zylo-profile-main-btn {

                min-height:
                    70px;

                font-size:
                    22px;
            }
        }

    `;

    document.head.appendChild(
        style
    );
}


/* =========================================================
   UPLOADED VIDEO PERSISTENCE
   ========================================================= */

function restoreUploadedVideos() {

    const videos =
        getStorage(
            UPLOADED_KEY,
            []
        );

    if (
        !Array.isArray(videos) ||
        !videoFeed
    ) {
        return;
    }

    /*
     * Do not automatically recreate old uploaded
     * videos on every reload when Render storage
     * may have expired. They remain in localStorage
     * for profile counting.
     */
}


/* =========================================================
   GLOBAL INITIALIZATION
   ========================================================= */

function initializeZYLO() {

    injectProfileStyles();

    initializeVideos();

    initializeLikes();

    initializeSaves();

    initializeComments();

    initializeShares();

    initializeMusic();

    initializeFullscreen();

    initializeDoubleTap();

    initializeProfileButton();

    initializeBottomProfile();

    initializeUpload();

    initializeTopTabs();

    initializeSearch();

    initializeBottomNavigation();

    initializeVideoObserver();

    restoreCommentCounts();

    restoreUploadedVideos();

    updateProfileButtons();

    document
        .querySelectorAll(
            ".video-page"
        )
        .forEach(
            page =>
                initializePageFeatures(
                    page
                )
        );

    /*
     * Start first visible video
     */
    setTimeout(
        () => {

            const page =
                getVisibleVideoPage();

            const video =
                page?.querySelector(
                    "video"
                );

            if (video) {

                video.play().catch(
                    () => {}
                );
            }

        },
        250
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
        initializeZYLO
    );

} else {

    initializeZYLO();
}
