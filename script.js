const videos = document.querySelectorAll(".video");


/* =========================
   AUTO PLAY / PAUSE
========================= */

const observer = new IntersectionObserver(
  (entries) => {

    entries.forEach((entry) => {

      const video = entry.target;

      if (
        entry.isIntersecting &&
        entry.intersectionRatio >= 0.6
      ) {

        videos.forEach((v) => {

          if (v !== video) {
            v.pause();
          }

        });

        video.muted = true;

        video.play().catch(() => {});

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


  /* =========================
     VIDEO TAP PLAY / PAUSE
  ========================= */

  video.addEventListener("click", () => {

    const item = video.closest(".video-item");

    const icon = item.querySelector(".play-icon");

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


/* =========================
   LIKE
========================= */

document.querySelectorAll(".like-btn").forEach((button) => {

  button.addEventListener("click", (e) => {

    e.stopPropagation();

    const count = button.querySelector("span");

    let number = Number(count.textContent);

    if (button.classList.contains("liked")) {

      number--;

      button.classList.remove("liked");

    } else {

      number++;

      button.classList.add("liked");

    }

    count.textContent = number;

  });

});


/* =========================
   SAVE
========================= */

document.querySelectorAll(".save-btn").forEach((button) => {

  button.addEventListener("click", (e) => {

    e.stopPropagation();

    const text = button.querySelector("span");

    if (button.classList.contains("saved")) {

      button.classList.remove("saved");

      text.textContent = "Save";

    } else {

      button.classList.add("saved");

      text.textContent = "Saved";

    }

  });

});


/* =========================
   SHARE
========================= */

document.querySelectorAll(".share-btn").forEach((button) => {

  button.addEventListener("click", async (e) => {

    e.stopPropagation();

    const url = window.location.href;

    if (navigator.share) {

      try {

        await navigator.share({
          title: "ZYLO",
          text: "Check this video on ZYLO",
          url: url
        });

      } catch (error) {}

    } else {

      try {

        await navigator.clipboard.writeText(url);

        alert("Video link copied!");

      } catch (error) {

        alert("Share link: " + url);

      }

    }

  });

});


/* =========================
   MUSIC
========================= */

document.querySelectorAll(".music-btn").forEach((button) => {

  button.addEventListener("click", (e) => {

    e.stopPropagation();

    alert("🎵 Original sound");

  });

});


/* =========================
   FIRST VIDEO
========================= */

window.addEventListener("load", () => {

  if (videos.length > 0) {

    videos[0].muted = true;

    videos[0].play().catch(() => {});

  }

});
