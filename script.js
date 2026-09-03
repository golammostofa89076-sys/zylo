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
