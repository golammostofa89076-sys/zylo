document.addEventListener("DOMContentLoaded", () => {


    /* ================= VIDEOS ================= */

    const videos = document.querySelectorAll(".video");


    const observer = new IntersectionObserver(
        (entries) => {

            entries.forEach(entry => {

                const video = entry.target;

                if (entry.isIntersecting) {

                    video.play().catch(() => {});

                } else {

                    video.pause();

                }

            });

        },
        {
            threshold: 0.65
        }
    );


    videos.forEach(video => {

        observer.observe(video);

        video.muted = true;

        video.setAttribute("playsinline", "");

    });


    /* ================= TAP VIDEO ================= */

    videos.forEach(video => {

        video.addEventListener("click", () => {

            if (video.paused) {

                video.play().catch(() => {});

            } else {

                video.pause();

            }

        });

    });


    /* ================= LIKE ================= */

    document.querySelectorAll(".like-btn").forEach(button => {

        button.addEventListener("click", event => {

            event.stopPropagation();

            button.classList.toggle("liked");

        });

    });


    /* ================= SAVE ================= */

    document.querySelectorAll(".save-btn").forEach(button => {

        button.addEventListener("click", event => {

            event.stopPropagation();

            button.classList.toggle("saved");

        });

    });


    /* ================= SHARE ================= */

    document.querySelectorAll(".share-btn").forEach(button => {

        button.addEventListener("click", async event => {

            event.stopPropagation();

            const url = window.location.href;

            try {

                if (navigator.share) {

                    await navigator.share({

                        title: "ZYLO",
                        text: "এই ভিডিওটি ZYLO-তে দেখুন!",
                        url: url

                    });

                } else {

                    await navigator.clipboard.writeText(url);

                    alert("ভিডিওর লিংক কপি হয়েছে!");

                }

            } catch (error) {

                console.log("Share cancelled");

            }

        });

    });


    /* ================= FOLLOW ================= */

    document.querySelectorAll(".profile-action").forEach(button => {

        button.addEventListener("click", event => {

            event.stopPropagation();

            const plus = button.querySelector(".follow-plus");

            if (!plus) return;

            if (plus.textContent.trim() === "+") {

                plus.textContent = "✓";

            } else {

                plus.textContent = "+";

            }

        });

    });


    /* ================= FULLSCREEN ================= */

    document.querySelectorAll(".fullscreen-btn").forEach(button => {

        button.addEventListener("click", event => {

            event.stopPropagation();

            const page = button.closest(".video-page");

            if (!page) return;

            const video = page.querySelector(".video");

            if (!video) return;


            if (document.fullscreenElement) {

                document.exitFullscreen().catch(() => {});

            } else {

                if (video.requestFullscreen) {

                    video.requestFullscreen().catch(() => {});

                } else if (page.requestFullscreen) {

                    page.requestFullscreen().catch(() => {});

                }

            }

        });

    });


    /* ================= MUSIC ================= */

    document.querySelectorAll(".music-btn").forEach(button => {

        button.addEventListener("click", event => {

            event.stopPropagation();

            button.classList.toggle("music-active");

        });

    });


    /* ================= SEARCH ================= */

    const searchButton = document.querySelector(".search-btn");

    if (searchButton) {

        searchButton.addEventListener("click", () => {

            alert("ZYLO Search");

        });

    }


    /* ================= TOP TABS ================= */

    document.querySelectorAll(".feed-tabs button").forEach(button => {

        button.addEventListener("click", () => {

            document
                .querySelectorAll(".feed-tabs button")
                .forEach(btn => btn.classList.remove("active"));

            button.classList.add("active");

        });

    });


    /* ================= BOTTOM NAV ================= */

    document.querySelectorAll(".nav-item").forEach(button => {

        button.addEventListener("click", () => {

            document
                .querySelectorAll(".nav-item")
                .forEach(btn => btn.classList.remove("active"));

            button.classList.add("active");

        });

    });


    /* ================= VIDEO ERROR ================= */

    videos.forEach(video => {

        video.addEventListener("error", () => {

            const original = video.getAttribute("src");

            if (
                original &&
                !video.dataset.fallback
            ) {

                video.dataset.fallback = "true";

                video.src =
                    "https://cdn.jsdelivr.net/gh/" +
                    "golammostofa89076-sys/zylo@main/" +
                    "backend/uploads/video1.mp4";

                video.load();

                video.play().catch(() => {});

            }

        });

    });

});

/* ============================= */
/* ZYLO VIDEO UPLOAD SYSTEM */
/* ============================= */

const API_BASE_URL = "https://zylo-backend-ec5c.onrender.com";

const createBtn = document.getElementById("createBtn");
const videoInput = document.getElementById("videoInput");
const uploadBox = document.getElementById("uploadBox");
const closeUpload = document.getElementById("closeUpload");
const selectVideo = document.getElementById("selectVideo");
const uploadStatus = document.getElementById("uploadStatus");

/* Open upload window */
if (createBtn) {
    createBtn.addEventListener("click", () => {
        uploadBox.classList.add("show");
    });
}

/* Close upload window */
if (closeUpload) {
    closeUpload.addEventListener("click", () => {
        uploadBox.classList.remove("show");
        videoInput.value = "";
        uploadStatus.textContent = "আপনার ভিডিও নির্বাচন করুন";
    });
}

/* Click Select Video */
if (selectVideo) {
    selectVideo.addEventListener("click", () => {
        videoInput.click();
    });
}

/* Select video */
if (videoInput) {
    videoInput.addEventListener("change", async () => {

        const file = videoInput.files[0];

        if (!file) return;

        /* Check video */
        if (!file.type.startsWith("video/")) {
            uploadStatus.textContent = "শুধু ভিডিও ফাইল নির্বাচন করুন";
            return;
        }

        /* 200 MB limit */
        if (file.size > 200 * 1024 * 1024) {
            uploadStatus.textContent =
                "ভিডিও 200 MB-এর বেশি হতে পারবে না";
            return;
        }

        uploadStatus.textContent = "ভিডিও আপলোড হচ্ছে...";
        selectVideo.disabled = true;
        selectVideo.textContent = "Uploading...";

        try {

            const formData = new FormData();

            formData.append("video", file);

            const response = await fetch(
                `${API_BASE_URL}/api/upload`,
                {
                    method: "POST",
                    body: formData
                }
            );

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(
                    data.message || "Upload failed"
                );
            }

            console.log("ZYLO Upload:", data);

            uploadStatus.textContent =
                "ভিডিও সফলভাবে আপলোড হয়েছে ✓";

            selectVideo.textContent = "Uploaded ✓";

            /*
             * Uploaded video URL
             */
            const videoUrl = data.video.url;

            console.log("Video URL:", videoUrl);

            /*
             * নতুন ভিডিও feed-এ যোগ করা
             */
            addUploadedVideo(videoUrl);

            setTimeout(() => {
                uploadBox.classList.remove("show");

                videoInput.value = "";

                uploadStatus.textContent =
                    "আপনার ভিডিও নির্বাচন করুন";

                selectVideo.disabled = false;
                selectVideo.textContent = "Select Video";

            }, 1000);

        } catch (error) {

            console.error(error);

            uploadStatus.textContent =
                "ভিডিও আপলোড করা যায়নি";

            selectVideo.disabled = false;
            selectVideo.textContent = "Try Again";
        }
    });
}


/* ============================= */
/* ADD UPLOADED VIDEO TO FEED */
/* ============================= */

function addUploadedVideo(videoUrl) {

    const videoFeed = document.querySelector(".video-feed");

    if (!videoFeed) return;

    const page = document.createElement("section");

    page.className = "video-page";

    page.innerHTML = `
        <video
            class="video-player"
            src="${videoUrl}"
            loop
            playsinline
            preload="metadata">
        </video>

        <div class="video-info">
            <strong>@zylo_creator</strong>
            <p>New video on ZYLO</p>
            <p>Create • Connect • Grow</p>
        </div>
    `;

    videoFeed.prepend(page);

    const newVideo = page.querySelector("video");

    if (newVideo) {
        newVideo.play().catch(() => {});
    }

    page.scrollIntoView({
        behavior: "smooth"
    });
}
