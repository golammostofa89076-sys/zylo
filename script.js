document.addEventListener("DOMContentLoaded", () => {

    const video = document.querySelector(".video");

    const likeBtn = document.getElementById("likeBtn");
    const saveBtn = document.getElementById("saveBtn");
    const shareBtn = document.getElementById("shareBtn");
    const commentBtn = document.getElementById("commentBtn");
    const musicBtn = document.getElementById("musicBtn");
    const fullscreenBtn = document.getElementById("fullscreenBtn");

    const likeCount = document.getElementById("likeCount");


    /* =========================
       VIDEO AUTOPLAY
    ========================= */

    const playVideo = () => {

        video.play().catch(() => {
            console.log("Autoplay blocked");
        });

    };


    playVideo();


    /* =========================
       TAP VIDEO PLAY / PAUSE
    ========================= */

    video.addEventListener("click", () => {

        if (video.paused) {
            video.play();
        } else {
            video.pause();
        }

    });


    /* =========================
       LIKE
    ========================= */

    let liked = false;
    let likes = 0;

    likeBtn.addEventListener("click", (e) => {

        e.stopPropagation();

        liked = !liked;

        if (liked) {

            likes++;

            likeBtn.classList.add("like-active");

            likeBtn.querySelector(".action-icon").textContent = "♥";

        } else {

            likes--;

            likeBtn.classList.remove("like-active");

            likeBtn.querySelector(".action-icon").textContent = "♡";

        }

        likeCount.textContent = likes;

    });


    /* =========================
       SAVE
    ========================= */

    let saved = false;

    saveBtn.addEventListener("click", (e) => {

        e.stopPropagation();

        saved = !saved;

        if (saved) {

            saveBtn.classList.add("save-active");

            saveBtn.querySelector(".action-icon").textContent = "🔖";

            saveBtn.querySelector(".action-label").textContent = "Saved";

        } else {

            saveBtn.classList.remove("save-active");

            saveBtn.querySelector(".action-label").textContent = "Save";

        }

    });


    /* =========================
       COMMENT
    ========================= */

    commentBtn.addEventListener("click", (e) => {

        e.stopPropagation();

        alert("Comments coming soon!");

    });


    /* =========================
       SHARE
    ========================= */

    shareBtn.addEventListener("click", async (e) => {

        e.stopPropagation();

        const shareData = {
            title: "ZYLO",
            text: "Check out this video on ZYLO!",
            url: window.location.href
        };

        if (navigator.share) {

            try {

                await navigator.share(shareData);

            } catch (error) {

                console.log("Share cancelled");

            }

        } else {

            try {

                await navigator.clipboard.writeText(
                    window.location.href
                );

                alert("Video link copied!");

            } catch (error) {

                alert("Share not supported");

            }

        }

    });


    /* =========================
       MUSIC
    ========================= */

    let muted = true;

    musicBtn.addEventListener("click", (e) => {

        e.stopPropagation();

        muted = !muted;

        video.muted = muted;

        if (muted) {

            musicBtn.querySelector(".music-action span");

        }

    });


    /* =========================
       FULLSCREEN
    ========================= */

    fullscreenBtn.addEventListener("click", async (e) => {

        e.stopPropagation();

        try {

            if (!document.fullscreenElement) {

                await document.documentElement.requestFullscreen();

            } else {

                await document.exitFullscreen();

            }

        } catch (error) {

            console.log("Fullscreen unavailable");

        }

    });


    /* =========================
       AUTOPLAY WHEN VISIBLE
    ========================= */

    const observer = new IntersectionObserver(
        (entries) => {

            entries.forEach(entry => {

                if (entry.isIntersecting) {

                    video.play().catch(() => {});

                } else {

                    video.pause();

                }

            });

        },
        {
            threshold: 0.6
        }
    );


    observer.observe(video);


    /* =========================
       VIDEO ERROR
    ========================= */

    video.addEventListener("error", () => {

        console.log("Video could not be loaded.");

    });

});
