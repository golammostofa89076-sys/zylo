"use strict";

/* =========================================================
   ZYLO — FINAL STABLE JAVASCRIPT
   UI/CSS unchanged
   ========================================================= */

const API_BASE_URL = "https://zylo-backend-ec5c.onrender.com";

const CDN_VIDEO_URL =
    "https://cdn.jsdelivr.net/gh/golammostofa89076-sys/zylo@main/backend/uploads/video1.mp4";

const STORAGE_KEYS = {
    likes: "zylo_likes",
    saves: "zylo_saves",
    follows: "zylo_follows",
    comments: "zylo_comments",
    uploadedVideos: "zylo_uploaded_videos"
};

/* =========================================================
   STORAGE
   ========================================================= */

function getStorage(key, fallback = {}) {
    try {
        const value = localStorage.getItem(key);
        return value ? JSON.parse(value) : fallback;
    } catch (error) {
        return fallback;
    }
}

function setStorage(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
        console.warn("Storage error:", error);
    }
}

let likes = getStorage(STORAGE_KEYS.likes);
let saves = getStorage(STORAGE_KEYS.saves);
let follows = getStorage(STORAGE_KEYS.follows);
let comments = getStorage(STORAGE_KEYS.comments);

/* =========================================================
   DOM
   ========================================================= */

const videoFeed = document.querySelector(".video-feed");
const videoPages = () =>
    Array.from(document.querySelectorAll(".video-page"));

const createBtn = document.getElementById("createBtn");
const videoInput = document.getElementById("videoInput");

const uploadBox = document.getElementById("uploadBox");
const closeUpload = document.getElementById("closeUpload");
const selectVideo = document.getElementById("selectVideo");
const uploadStatus = document.getElementById("uploadStatus");

/* =========================================================
   HELPERS
   ========================================================= */

function escapeHTML(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function getCreatorUsername(page) {
    const element = page.querySelector(".username, .video-username");

    if (element && element.textContent.trim()) {
        return element.textContent.trim();
    }

    return "@zylo_creator";
}

function makeStableId(page, index) {
    if (page.dataset.videoId) {
        return page.dataset.videoId;
    }

    const source = page.querySelector("video source")?.src ||
        page.querySelector("video")?.src ||
        `video-${index}`;

    let hash = 0;

    for (let i = 0; i < source.length; i++) {
        hash = ((hash << 5) - hash) + source.charCodeAt(i);
        hash |= 0;
    }

    const id = `video_${Math.abs(hash)}_${index}`;

    page.dataset.videoId = id;

    return id;
}

function showToast(message) {
    let toast = document.getElementById("zyloToast");

    if (!toast) {
        toast = document.createElement("div");
        toast.id = "zyloToast";

        Object.assign(toast.style, {
            position: "fixed",
            left: "50%",
            bottom: "90px",
            transform: "translateX(-50%)",
            zIndex: "99999",
            background: "rgba(0,0,0,.82)",
            color: "#fff",
            padding: "10px 16px",
            borderRadius: "20px",
            fontSize: "14px",
            pointerEvents: "none",
            opacity: "0",
            transition: "opacity .2s"
        });

        document.body.appendChild(toast);
    }

    toast.textContent = message;
    toast.style.opacity = "1";

    clearTimeout(toast._timer);

    toast._timer = setTimeout(() => {
        toast.style.opacity = "0";
    }, 1800);
}

/* =========================================================
   VIDEO
   ========================================================= */

function setupVideo(page, index) {
    const video = page.querySelector("video");

    if (!video) return;

    const videoId = makeStableId(page, index);

    video.loop = true;
    video.muted = true;
    video.playsInline = true;
    video.setAttribute("playsinline", "");

    restoreLikeUI(page, videoId);
    restoreSaveUI(page, videoId);
    restoreFollowUI(page, videoId);

    video.addEventListener("click", () => {
        if (video.paused) {
            video.play().catch(() => {});
        } else {
            video.pause();
        }
    });

    video.addEventListener("error", () => {
        if (video.dataset.cdnTried === "1") return;

        video.dataset.cdnTried = "1";
        video.src = CDN_VIDEO_URL;
        video.load();
        video.play().catch(() => {});
    });

    const likeBtn = page.querySelector(".like-btn");
    const saveBtn = page.querySelector(".save-btn");
    const commentBtn = page.querySelector(".action-btn[aria-label='Comments']");
    const shareBtn = page.querySelector(".share-btn");
    const profileBtn = page.querySelector(".profile-action");
    const musicBtn = page.querySelector(".music-btn");
    const fullscreenBtn = page.querySelector(".fullscreen-btn");

    likeBtn?.addEventListener("click", event => {
        event.stopPropagation();
        toggleLike(page, videoId);
    });

    saveBtn?.addEventListener("click", event => {
        event.stopPropagation();
        toggleSave(page, videoId);
    });

    commentBtn?.addEventListener("click", event => {
        event.stopPropagation();
        showComments(page, videoId);
    });

    shareBtn?.addEventListener("click", event => {
        event.stopPropagation();
        shareVideo(page);
    });

    profileBtn?.addEventListener("click", event => {
        event.stopPropagation();
        showCreatorProfile(page, videoId);
    });

    musicBtn?.addEventListener("click", event => {
        event.stopPropagation();

        video.muted = !video.muted;

        musicBtn.classList.toggle("active", !video.muted);

        showToast(video.muted ? "Sound off" : "Sound on");
    });

    fullscreenBtn?.addEventListener("click", event => {
        event.stopPropagation();
        enterFullscreen(video);
    });

    setupDoubleTap(page, videoId);
}

/* =========================================================
   LIKE
   ========================================================= */

function toggleLike(page, videoId) {
    likes[videoId] = !likes[videoId];

    setStorage(STORAGE_KEYS.likes, likes);

    updateLikeUI(page, videoId);
}

function updateLikeUI(page, videoId) {
    const button = page.querySelector(".like-btn");

    if (!button) return;

    const active = !!likes[videoId];

    /* CSS expects .liked */
    button.classList.toggle("liked", active);
    button.classList.remove("active");

    const count = button.querySelector(".action-count");

    if (count) {
        count.textContent = active ? "1" : "0";
    }
}

function restoreLikeUI(page, videoId) {
    updateLikeUI(page, videoId);
}

/* =========================================================
   SAVE
   ========================================================= */

function toggleSave(page, videoId) {
    saves[videoId] = !saves[videoId];

    setStorage(STORAGE_KEYS.saves, saves);

    updateSaveUI(page, videoId);

    showToast(saves[videoId] ? "Saved" : "Removed from saved");
}

function updateSaveUI(page, videoId) {
    const button = page.querySelector(".save-btn");

    if (!button) return;

    const active = !!saves[videoId];

    /* CSS expects .saved */
    button.classList.toggle("saved", active);
    button.classList.remove("active");
}

function restoreSaveUI(page, videoId) {
    updateSaveUI(page, videoId);
}

/* =========================================================
   FOLLOW
   ========================================================= */

function toggleFollow(page, videoId) {
    const username = getCreatorUsername(page);

    const key = `${username}_${videoId}`;

    follows[key] = !follows[key];

    setStorage(STORAGE_KEYS.follows, follows);

    updateFollowUI(page, videoId);
}

function updateFollowUI(page, videoId) {
    const username = getCreatorUsername(page);
    const key = `${username}_${videoId}`;

    const badge = page.querySelector(".follow-badge");

    if (badge) {
        badge.textContent = follows[key] ? "✓" : "+";
    }
}

function restoreFollowUI(page, videoId) {
    updateFollowUI(page, videoId);
}

/* =========================================================
   CREATOR PROFILE
   ========================================================= */

function showCreatorProfile(page, videoId) {
    removeOverlay("zyloCreatorProfile");

    const username = getCreatorUsername(page);
    const followKey = `${username}_${videoId}`;
    const isFollowing = !!follows[followKey];

    const overlay = document.createElement("div");

    overlay.id = "zyloCreatorProfile";

    overlay.innerHTML = `
        <div class="zylo-profile-backdrop"></div>

        <div class="zylo-profile-card">

            <button class="zylo-overlay-close" aria-label="Close">×</button>

            <div class="zylo-profile-avatar">Z</div>

            <h2>ZYLO Creator <span>✓</span></h2>

            <div class="zylo-profile-username">
                ${escapeHTML(username)}
            </div>

            <p>Create • Connect • Grow</p>

            <div class="zylo-profile-stats">
                <div>
                    <strong>1</strong>
                    <span>Following</span>
                </div>

                <div>
                    <strong>0</strong>
                    <span>Followers</span>
                </div>

                <div>
                    <strong>5</strong>
                    <span>Likes</span>
                </div>
            </div>

            <button class="zylo-follow-btn">
                ${isFollowing ? "Following" : "Follow"}
            </button>

            <div class="zylo-profile-videos">
                Videos
            </div>

        </div>
    `;

    document.body.appendChild(overlay);

    const followButton =
        overlay.querySelector(".zylo-follow-btn");

    followButton.addEventListener("click", () => {
        follows[followKey] = !follows[followKey];

        setStorage(STORAGE_KEYS.follows, follows);

        followButton.textContent =
            follows[followKey] ? "Following" : "Follow";

        updateFollowUI(page, videoId);
    });

    setupOverlayClose(
        overlay,
        "zyloCreatorProfile"
    );
}

/* =========================================================
   COMMENTS
   ========================================================= */

function showComments(page, videoId) {
    removeOverlay("zyloComments");

    const list = comments[videoId] || [];

    const overlay = document.createElement("div");

    overlay.id = "zyloComments";

    overlay.innerHTML = `
        <div class="zylo-comments-backdrop"></div>

        <div class="zylo-comments-box">

            <div class="zylo-comments-header">
                <strong>Comments</strong>
                <button class="zylo-overlay-close">×</button>
            </div>

            <div class="zylo-comments-list">
                ${
                    list.length
                        ? list.map(comment => `
                            <div class="zylo-comment">
                                <strong>@you</strong>
                                <span>${escapeHTML(comment)}</span>
                            </div>
                        `).join("")
                        : `
                            <div class="zylo-empty-comments">
                                No comments yet
                            </div>
                        `
                }
            </div>

            <form class="zylo-comment-form">

                <input
                    type="text"
                    maxlength="200"
                    placeholder="Add a comment..."
                    autocomplete="off"
                >

                <button type="submit">
                    Send
                </button>

            </form>

        </div>
    `;

    document.body.appendChild(overlay);

    const form = overlay.querySelector(".zylo-comment-form");
    const input = form.querySelector("input");

    form.addEventListener("submit", event => {
        event.preventDefault();

        const value = input.value.trim();

        if (!value) return;

        if (!comments[videoId]) {
            comments[videoId] = [];
        }

        comments[videoId].push(value);

        setStorage(STORAGE_KEYS.comments, comments);

        removeOverlay("zyloComments");

        updateCommentCount(page, videoId);

        showComments(page, videoId);
    });

    setupOverlayClose(
        overlay,
        "zyloComments"
    );
}

function updateCommentCount(page, videoId) {
    const button =
        page.querySelector(".action-btn[aria-label='Comments']");

    if (!button) return;

    const count = button.querySelector(".action-count");

    if (count) {
        count.textContent =
            String((comments[videoId] || []).length);
    }
}

/* =========================================================
   SHARE
   ========================================================= */

async function shareVideo(page) {
    const username = getCreatorUsername(page);

    const data = {
        title: "ZYLO",
        text: `Watch this video from ${username}`,
        url: window.location.href
    };

    try {
        if (navigator.share) {
            await navigator.share(data);
            return;
        }

        await navigator.clipboard.writeText(
            window.location.href
        );

        showToast("Link copied");
    } catch (error) {
        showToast("Share cancelled");
    }
}

/* =========================================================
   FULLSCREEN
   ========================================================= */

async function enterFullscreen(video) {
    try {
        if (video.requestFullscreen) {
            await video.requestFullscreen();
            return;
        }

        if (video.webkitEnterFullscreen) {
            video.webkitEnterFullscreen();
            return;
        }

        if (video.webkitRequestFullscreen) {
            await video.webkitRequestFullscreen();
            return;
        }

        showToast("Fullscreen not supported");
    } catch (error) {
        console.warn("Fullscreen error:", error);
    }
}

/* =========================================================
   DOUBLE TAP LIKE
   ========================================================= */

function setupDoubleTap(page, videoId) {
    let lastTap = 0;

    page.addEventListener("touchend", event => {
        const now = Date.now();

        if (now - lastTap < 300) {
            toggleLike(page, videoId);
            showBigHeart(page);
        }

        lastTap = now;
    }, { passive: true });
}

function showBigHeart(page) {
    const heart = document.createElement("div");

    heart.textContent = "♥";

    Object.assign(heart.style, {
        position: "absolute",
        left: "50%",
        top: "50%",
        transform: "translate(-50%, -50%) scale(.5)",
        fontSize: "100px",
        color: "#ff1744",
        zIndex: "100",
        pointerEvents: "none",
        transition: "transform .25s, opacity .4s",
        opacity: "1"
    });

    page.appendChild(heart);

    requestAnimationFrame(() => {
        heart.style.transform =
            "translate(-50%, -50%) scale(1.15)";
    });

    setTimeout(() => {
        heart.style.opacity = "0";
        heart.style.transform =
            "translate(-50%, -50%) scale(1.4)";
    }, 250);

    setTimeout(() => {
        heart.remove();
    }, 700);
}

/* =========================================================
   UPLOAD
   ========================================================= */

function openUpload() {
    if (!uploadBox) return;

    uploadBox.classList.add("show");
    uploadBox.classList.add("active");

    uploadBox.style.display = "flex";

    if (uploadStatus) {
        uploadStatus.textContent = "";
    }
}

function closeUploadModal() {
    if (!uploadBox) return;

    uploadBox.classList.remove("show");
    uploadBox.classList.remove("active");

    uploadBox.style.display = "none";
}

createBtn?.addEventListener("click", event => {
    event.preventDefault();
    openUpload();
});

closeUpload?.addEventListener(
    "click",
    closeUploadModal
);

selectVideo?.addEventListener("click", () => {
    videoInput?.click();
});

videoInput?.addEventListener("change", async () => {
    const file = videoInput.files?.[0];

    if (!file) return;

    if (!file.type.startsWith("video/")) {
        showToast("Please select a video");
        return;
    }

    await uploadVideo(file);
});

async function uploadVideo(file) {
    if (!uploadStatus) return;

    uploadStatus.textContent =
        "Uploading video...";

    const formData = new FormData();

    formData.append("video", file);

    try {
        const response = await fetch(
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

        const data = await response.json();

        const videoUrl =
            data.videoUrl ||
            data.url ||
            data.path;

        if (!videoUrl) {
            throw new Error(
                "Server did not return video URL"
            );
        }

        addUploadedVideo(videoUrl);

        uploadStatus.textContent =
            "Upload successful!";

        setTimeout(() => {
            closeUploadModal();
        }, 700);

        showToast("Video uploaded");
    } catch (error) {
        console.error(error);

        uploadStatus.textContent =
            "Upload failed. Please try again.";

        showToast("Upload failed");
    }
}

/* =========================================================
   ADD UPLOADED VIDEO
   ========================================================= */

function addUploadedVideo(videoUrl) {
    if (!videoFeed) return;

    const page = document.createElement("section");

    page.className = "video-page";

    page.dataset.videoId =
        "upload_" +
        Date.now() +
        "_" +
        Math.random().toString(36).slice(2, 8);

    page.innerHTML = `
        <video
            src="${escapeHTML(videoUrl)}"
            loop
            muted
            playsinline
            preload="metadata"
        ></video>

        <div class="video-overlay"></div>

        <button
            class="fullscreen-btn"
            aria-label="Fullscreen"
        >
            <svg viewBox="0 0 24 24">
                <path d="M8 3H3v5"></path>
                <path d="M16 3h5v5"></path>
                <path d="M8 21H3v-5"></path>
                <path d="M21 16v5h-5"></path>
            </svg>
        </button>

        <div class="right-actions">

            <button
                class="profile-action"
                aria-label="Profile"
            >
                <span class="profile-circle">Z</span>
                <span class="follow-badge">+</span>
            </button>

            <button
                class="action-btn like-btn"
                aria-label="Like"
            >
                <svg viewBox="0 0 24 24">
                    <path d="M20.8 8.8c0 5.2-8.8 11-8.8 11S3.2 14 3.2 8.8A5 5 0 0 1 12 5.4a5 5 0 0 1 8.8 3.4Z"></path>
                </svg>
                <span class="action-count">0</span>
            </button>

            <button
                class="action-btn"
                aria-label="Comments"
            >
                <svg viewBox="0 0 24 24">
                    <path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5H8l-4 2v-4.2A7.5 7.5 0 1 1 20 11.5Z"></path>
                </svg>
                <span class="action-count">0</span>
            </button>

            <button
                class="action-btn save-btn"
                aria-label="Save"
            >
                <svg viewBox="0 0 24 24">
                    <path d="M6 4.5A2.5 2.5 0 0 1 8.5 2h7A2.5 2.5 0 0 1 18 4.5V22l-6-3.8L6 22V4.5Z"></path>
                </svg>
                <span class="action-label">Save</span>
            </button>

            <button
                class="action-btn share-btn"
                aria-label="Share"
            >
                <svg viewBox="0 0 24 24">
                    <path d="M21 3 10.5 13.5"></path>
                    <path d="m21 3-6.7 18-3.8-7.5L3 9.7 21 3Z"></path>
                </svg>
                <span class="action-label">Share</span>
            </button>

            <button
                class="music-btn"
                aria-label="Music"
            >
                <svg viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="8"></circle>
                    <circle cx="12" cy="12" r="2"></circle>
                </svg>
                <span>Music</span>
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

    videoFeed.appendChild(page);

    const allPages = videoPages();

    setupVideo(
        page,
        allPages.length - 1
    );

    observeVideo(page);
}

/* =========================================================
   TOP TABS
   ========================================================= */

document.querySelectorAll(".top-tab").forEach(tab => {
    tab.addEventListener("click", () => {

        document.querySelectorAll(".top-tab")
            .forEach(item =>
                item.classList.remove("active")
            );

        tab.classList.add("active");

        const text =
            tab.textContent.trim();

        if (text === "LIVE") {
            showToast("LIVE is coming soon");
            return;
        }

        if (text === "Following") {
            filterFollowing();
            return;
        }

        showAllVideos();
    });
});

function showAllVideos() {
    videoPages().forEach(page => {
        page.style.display = "";
    });
}

function filterFollowing() {
    const pages = videoPages();

    pages.forEach(page => {
        const id =
            page.dataset.videoId;

        const username =
            getCreatorUsername(page);

        const key =
            `${username}_${id}`;

        page.style.display =
            follows[key] ? "" : "none";
    });

    showToast("Following videos");
}

/* =========================================================
   SEARCH
   ========================================================= */

document.querySelector(".search-btn")
    ?.addEventListener("click", showSearch);

function showSearch() {
    removeOverlay("zyloSearch");

    const overlay =
        document.createElement("div");

    overlay.id = "zyloSearch";

    overlay.innerHTML = `
        <div class="zylo-search-backdrop"></div>

        <div class="zylo-search-box">

            <div class="zylo-search-header">
                <input
                    type="search"
                    placeholder="Search ZYLO..."
                    autocomplete="off"
                >

                <button class="zylo-overlay-close">
                    ×
                </button>
            </div>

            <div class="zylo-search-results"></div>

        </div>
    `;

    document.body.appendChild(overlay);

    const input =
        overlay.querySelector("input");

    const results =
        overlay.querySelector(".zylo-search-results");

    function renderResults(value) {
        const query =
            value.trim().toLowerCase();

        if (!query) {
            results.innerHTML = "";
            return;
        }

        const found = videoPages()
            .filter(page =>
                page.textContent
                    .toLowerCase()
                    .includes(query)
            );

        if (!found.length) {
            results.innerHTML =
                `<div class="zylo-empty-search">No results</div>`;
            return;
        }

        results.innerHTML =
            found.map((page, index) => `
                <button
                    class="zylo-search-result"
                    data-index="${index}"
                >
                    ${escapeHTML(
                        getCreatorUsername(page)
                    )}
                </button>
            `).join("");

        results.querySelectorAll(
            ".zylo-search-result"
        ).forEach((button, index) => {
            button.addEventListener("click", () => {
                const target = found[index];

                removeOverlay("zyloSearch");

                target.scrollIntoView({
                    behavior: "smooth"
                });

                target.querySelector("video")
                    ?.play()
                    .catch(() => {});
            });
        });
    }

    input.addEventListener(
        "input",
        () => renderResults(input.value)
    );

    setupOverlayClose(
        overlay,
        "zyloSearch"
    );

    setTimeout(() => input.focus(), 50);
}

/* =========================================================
   BOTTOM NAV
   ========================================================= */

document.querySelectorAll(
    ".bottom-nav [data-nav]"
).forEach(button => {

    button.addEventListener("click", () => {

        const nav =
            button.dataset.nav;

        if (nav === "home") {

            videoFeed?.scrollTo({
                top: 0,
                behavior: "smooth"
            });

            return;
        }

        if (nav === "discover") {
            showToast("Discover");
            return;
        }

        if (nav === "inbox") {
            showInbox();
            return;
        }

        if (nav === "profile") {
            showMyProfile();
        }
    });
});

/* =========================================================
   MY PROFILE
   ========================================================= */

function showMyProfile() {
    removeOverlay("zyloMyProfile");

    const followingCount =
        Object.values(follows)
            .filter(Boolean).length;

    const likesCount =
        Object.values(likes)
            .filter(Boolean).length;

    const videosCount =
        videoPages().length;

    const overlay =
        document.createElement("div");

    overlay.id = "zyloMyProfile";

    overlay.innerHTML = `
        <div class="zylo-my-profile-backdrop"></div>

        <div class="zylo-profile-card">

            <button class="zylo-overlay-close">
                ×
            </button>

            <div class="zylo-profile-avatar">
                Z
            </div>

            <h2>My Profile</h2>

            <div class="zylo-profile-username">
                @zylo_creator
            </div>

            <p>Create • Connect • Grow</p>

            <div class="zylo-profile-stats">

                <div>
                    <strong>${followingCount}</strong>
                    <span>Following</span>
                </div>

                <div>
                    <strong>0</strong>
                    <span>Followers</span>
                </div>

                <div>
                    <strong>${likesCount}</strong>
                    <span>Likes</span>
                </div>

            </div>

            <button class="zylo-edit-profile">
                Edit Profile
            </button>

            <div class="zylo-profile-videos">
                My Videos: ${videosCount}
            </div>

        </div>
    `;

    document.body.appendChild(overlay);

    overlay.querySelector(
        ".zylo-edit-profile"
    )?.addEventListener("click", () => {
        showToast("Edit Profile coming soon");
    });

    setupOverlayClose(
        overlay,
        "zyloMyProfile"
    );
}

/* =========================================================
   INBOX
   ========================================================= */

function showInbox() {
    removeOverlay("zyloInbox");

    const overlay =
        document.createElement("div");

    overlay.id = "zyloInbox";

    overlay.innerHTML = `
        <div class="zylo-inbox-backdrop"></div>

        <div class="zylo-inbox-box">

            <button class="zylo-overlay-close">
                ×
            </button>

            <h2>Inbox</h2>

            <p>
                Your notifications and messages
                will appear here.
            </p>

        </div>
    `;

    document.body.appendChild(overlay);

    setupOverlayClose(
        overlay,
        "zyloInbox"
    );
}

/* =========================================================
   OVERLAY HELPERS
   ========================================================= */

function removeOverlay(id) {
    document.getElementById(id)?.remove();
}

function setupOverlayClose(overlay, id) {

    overlay.querySelectorAll(
        ".zylo-overlay-close"
    ).forEach(button => {
        button.addEventListener("click", () => {
            removeOverlay(id);
        });
    });

    overlay.addEventListener("click", event => {
        if (
            event.target === overlay ||
            event.target.classList.contains(
                "zylo-profile-backdrop"
            ) ||
            event.target.classList.contains(
                "zylo-comments-backdrop"
            ) ||
            event.target.classList.contains(
                "zylo-search-backdrop"
            ) ||
            event.target.classList.contains(
                "zylo-inbox-backdrop"
            ) ||
            event.target.classList.contains(
                "zylo-my-profile-backdrop"
            )
        ) {
            removeOverlay(id);
        }
    });
}

/* =========================================================
   INTERSECTION OBSERVER
   ========================================================= */

let videoObserver = null;

function setupVideoObserver() {

    if (videoObserver) {
        videoObserver.disconnect();
    }

    videoObserver =
        new IntersectionObserver(
            entries => {

                entries.forEach(entry => {

                    const video =
                        entry.target.querySelector(
                            "video"
                        );

                    if (!video) return;

                    if (
                        entry.isIntersecting &&
                        entry.intersectionRatio >= 0.6
                    ) {

                        video.play()
                            .catch(() => {});

                    } else {

                        video.pause();

                    }

                });

            },
            {
                threshold: [0.6]
            }
        );

    videoPages().forEach(page => {
        videoObserver.observe(page);
    });
}

function observeVideo(page) {
    videoObserver?.observe(page);
}

/* =========================================================
   VISIBILITY
   ========================================================= */

document.addEventListener(
    "visibilitychange",
    () => {

        if (document.hidden) {

            videoPages().forEach(page => {
                page.querySelector("video")?.pause();
            });

        }

    }
);

/* =========================================================
   DYNAMIC OVERLAY CSS
   Does not modify your main style.css
   ========================================================= */

(function injectOverlayCSS() {

    if (document.getElementById(
        "zylo-functional-css"
    )) return;

    const style =
        document.createElement("style");

    style.id =
        "zylo-functional-css";

    style.textContent = `

        #zyloCreatorProfile,
        #zyloComments,
        #zyloSearch,
        #zyloMyProfile,
        #zyloInbox {
            position: fixed;
            inset: 0;
            z-index: 99990;
            font-family: Arial, sans-serif;
        }

        .zylo-profile-backdrop,
        .zylo-comments-backdrop,
        .zylo-search-backdrop,
        .zylo-my-profile-backdrop,
        .zylo-inbox-backdrop {
            position: absolute;
            inset: 0;
            background: rgba(0,0,0,.72);
        }

        .zylo-profile-card,
        .zylo-comments-box,
        .zylo-search-box,
        .zylo-inbox-box {
            position: absolute;
            left: 50%;
            top: 50%;
            transform: translate(-50%,-50%);
            width: min(92vw,420px);
            max-height: 88vh;
            overflow: auto;
            background: #111;
            color: #fff;
            border-radius: 20px;
            padding: 24px;
            box-sizing: border-box;
        }

        .zylo-overlay-close {
            position: absolute;
            top: 12px;
            right: 12px;
            width: 36px;
            height: 36px;
            border: 0;
            border-radius: 50%;
            background: rgba(255,255,255,.12);
            color: #fff;
            font-size: 25px;
            cursor: pointer;
        }

        .zylo-profile-avatar {
            width: 82px;
            height: 82px;
            margin: 10px auto 14px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #222;
            border: 2px solid #fff;
            font-size: 36px;
            font-weight: 800;
        }

        .zylo-profile-card {
            text-align: center;
        }

        .zylo-profile-card h2 {
            margin: 6px 0;
        }

        .zylo-profile-card h2 span {
            font-size: 14px;
        }

        .zylo-profile-username {
            opacity: .8;
            margin: 5px 0;
        }

        .zylo-profile-stats {
            display: flex;
            justify-content: space-around;
            margin: 24px 0;
        }

        .zylo-profile-stats div {
            display: flex;
            flex-direction: column;
            gap: 5px;
        }

        .zylo-profile-stats strong {
            font-size: 20px;
        }

        .zylo-profile-stats span {
            font-size: 12px;
            opacity: .7;
        }

        .zylo-follow-btn,
        .zylo-edit-profile {
            width: 100%;
            border: 0;
            border-radius: 10px;
            padding: 12px;
            background: #fff;
            color: #000;
            font-weight: 700;
            cursor: pointer;
        }

        .zylo-profile-videos {
            margin-top: 20px;
            padding-top: 16px;
            border-top: 1px solid rgba(255,255,255,.12);
        }

        .zylo-comments-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding-bottom: 15px;
            border-bottom: 1px solid rgba(255,255,255,.12);
        }

        .zylo-comments-header
        .zylo-overlay-close {
            position: static;
        }

        .zylo-comments-list {
            max-height: 55vh;
            overflow: auto;
            padding: 12px 0;
        }

        .zylo-comment {
            display: flex;
            flex-direction: column;
            gap: 4px;
            padding: 10px 0;
        }

        .zylo-comment strong {
            font-size: 13px;
        }

        .zylo-comment span {
            opacity: .85;
        }

        .zylo-empty-comments,
        .zylo-empty-search {
            text-align: center;
            opacity: .6;
            padding: 30px 10px;
        }

        .zylo-comment-form {
            display: flex;
            gap: 8px;
            border-top: 1px solid rgba(255,255,255,.12);
            padding-top: 12px;
        }

        .zylo-comment-form input {
            flex: 1;
            min-width: 0;
            border: 0;
            outline: 0;
            border-radius: 20px;
            padding: 11px 14px;
            background: #222;
            color: #fff;
        }

        .zylo-comment-form button {
            border: 0;
            border-radius: 20px;
            padding: 0 15px;
            font-weight: 700;
        }

        .zylo-search-header {
            display: flex;
            gap: 8px;
            align-items: center;
        }

        .zylo-search-header input {
            flex: 1;
            border: 0;
            outline: 0;
            border-radius: 20px;
            padding: 12px 15px;
            background: #222;
            color: #fff;
        }

        .zylo-search-result {
            width: 100%;
            border: 0;
            background: transparent;
            color: #fff;
            text-align: left;
            padding: 14px 5px;
            border-bottom: 1px solid rgba(255,255,255,.1);
        }

        .zylo-inbox-box p {
            opacity: .7;
        }

    `;

    document.head.appendChild(style);

})();

/* =========================================================
   INITIALIZE
   ========================================================= */

function initializeZYLO() {

    videoPages().forEach(
        (page, index) => {
            setupVideo(page, index);
        }
    );

    setupVideoObserver();

    /* Initial first video */
    const firstVideo =
        videoPages()[0]?.querySelector("video");

    firstVideo?.play()
        .catch(() => {});

    /* Restore comment counts */
    videoPages().forEach(page => {
        const id = page.dataset.videoId;

        if (id) {
            updateCommentCount(page, id);
        }
    });

    closeUploadModal();
}

if (document.readyState === "loading") {

    document.addEventListener(
        "DOMContentLoaded",
        initializeZYLO
    );

} else {

    initializeZYLO();

}
