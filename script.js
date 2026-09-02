const videos = document.querySelectorAll(".video");

const observer = new IntersectionObserver(
  (entries) => {

    entries.forEach((entry) => {

      const video = entry.target;

      if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {

        videos.forEach((v) => {
          if (v !== video) {
            v.pause();
          }
        });

        video.play().catch(() => {
          console.log("Autoplay অপেক্ষা করছে...");
        });

      } else {

        video.pause();

      }

    });

  },
  {
    threshold: [0.6]
  }
);


videos.forEach((video) => {

  observer.observe(video);


  // Video tap = play/pause

  video.addEventListener("click", () => {

    const parent = video.closest(".video-item");
    const icon = parent.querySelector(".play-icon");

    if (video.paused) {

      video.play();

      icon.textContent = "▶";

    } else {

      video.pause();

      icon.textContent = "❚❚";

    }

    icon.classList.add("show");

    setTimeout(() => {
      icon.classList.remove("show");
    }, 600);

  });

});


/* Like button */

document.querySelectorAll(".like-btn").forEach((button) => {

  button.addEventListener("click", (event) => {

    event.stopPropagation();

    const count = button.querySelector("span");

    let likes = Number(count.textContent);

    if (button.classList.contains("liked")) {

      likes--;

      button.classList.remove("liked");

    } else {

      likes++;

      button.classList.add("liked");

    }

    count.textContent = likes;

  });

});


/* Prevent buttons from affecting video */

document.querySelectorAll(".action-btn").forEach((button) => {

  button.addEventListener("click", (event) => {
    event.stopPropagation();
  });

});


/* প্রথম ভিডিও চালানোর চেষ্টা */

window.addEventListener("load", () => {

  const firstVideo = videos[0];

  if (firstVideo) {

    firstVideo.muted = true;

    firstVideo.play().catch(() => {
      console.log("User interaction required");
    });

  }

});
