import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";

import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";

import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";


/* =========================
   FIREBASE CONFIG
========================= */

const firebaseConfig = {
  apiKey: "AIzaSyBc3AVM3BYmKpIbm288w9VR9AVPVIt9Cgo",
  authDomain: "zylo-217f2.firebaseapp.com",
  projectId: "zylo-217f2",
  storageBucket: "zylo-217f2.firebasestorage.app",
  messagingSenderId: "859616472941",
  appId: "1:859616472941:web:6a70b1bc83deaacc213464"
};


/* =========================
   INITIALIZE FIREBASE
========================= */

const app = initializeApp(firebaseConfig);

const auth = getAuth(app);

const db = getFirestore(app);

let currentUser = null;


/* =========================
   STYLE
========================= */

const style = document.createElement("style");

style.textContent = `

.zylo-auth-overlay {
  position: fixed;
  inset: 0;
  z-index: 99999;
  background: rgba(0,0,0,.72);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.zylo-auth-card {
  width: min(420px, 100%);
  max-height: 90vh;
  overflow-y: auto;
  background: #fff;
  border-radius: 22px;
  padding: 24px;
  box-sizing: border-box;
  font-family: Arial, sans-serif;
}

.zylo-auth-card h2 {
  margin: 0 0 8px;
  color: #111;
}

.zylo-auth-sub {
  color: #666;
  font-size: 14px;
  margin-bottom: 20px;
}

.zylo-auth-card label {
  display: block;
  margin: 13px 0 6px;
  font-size: 14px;
  font-weight: 600;
}

.zylo-auth-card input {
  width: 100%;
  height: 48px;
  border: 1px solid #ddd;
  border-radius: 12px;
  padding: 0 14px;
  box-sizing: border-box;
  font-size: 15px;
  outline: none;
}

.zylo-auth-primary {
  width: 100%;
  height: 48px;
  border: 0;
  border-radius: 12px;
  background: #111;
  color: white;
  font-size: 15px;
  font-weight: 700;
  margin-top: 18px;
}

.zylo-auth-secondary {
  width: 100%;
  height: 46px;
  border: 1px solid #ddd;
  border-radius: 12px;
  background: white;
  color: #111;
  font-size: 15px;
  font-weight: 600;
  margin-top: 10px;
}

.zylo-auth-close {
  float: right;
  border: 0;
  background: transparent;
  font-size: 28px;
}

.zylo-auth-switch {
  text-align: center;
  margin-top: 16px;
  font-size: 14px;
}

.zylo-auth-switch button {
  border: 0;
  background: transparent;
  font-weight: 700;
}

.zylo-auth-error {
  display: none;
  margin-top: 12px;
  padding: 10px;
  border-radius: 10px;
  background: #fff0f0;
  color: #b00020;
  font-size: 13px;
}

.zylo-avatar {
  width: 84px;
  height: 84px;
  border-radius: 50%;
  background: #111;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 12px;
  font-size: 30px;
  font-weight: 800;
}

.zylo-profile-card {
  text-align: center;
}

.zylo-profile-name {
  font-size: 22px;
  font-weight: 800;
}

.zylo-profile-username {
  color: #777;
  margin-top: 5px;
}

.zylo-profile-bio {
  color: #555;
  margin: 14px 0;
}

.zylo-profile-email {
  color: #777;
  font-size: 13px;
}

`;

document.head.appendChild(style);


/* =========================
   HELPERS
========================= */

function closeOverlay() {

  document
    .querySelectorAll(".zylo-auth-overlay")
    .forEach(el => el.remove());

}


function errorMessage(error) {

  const messages = {

    "auth/email-already-in-use":
      "এই ইমেইল দিয়ে আগে থেকেই অ্যাকাউন্ট আছে।",

    "auth/invalid-email":
      "ইমেইল ঠিকানা সঠিক নয়।",

    "auth/weak-password":
      "পাসওয়ার্ড আরও শক্তিশালী দিন।",

    "auth/invalid-credential":
      "ইমেইল অথবা পাসওয়ার্ড ভুল।",

    "auth/user-not-found":
      "এই ইমেইলে কোনো অ্যাকাউন্ট পাওয়া যায়নি।",

    "auth/wrong-password":
      "পাসওয়ার্ড ভুল।",

    "auth/network-request-failed":
      "ইন্টারনেট সংযোগ পরীক্ষা করুন।"

  };

  return messages[error.code] ||
    "সমস্যা হয়েছে। আবার চেষ্টা করুন।";
}


function showError(box, message) {

  box.textContent = message;

  box.style.display = "block";

}


function escapeHtml(value) {

  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

}


/* =========================
   SAVE PROFILE
========================= */

async function saveProfile(user, data = {}) {

  const ref = doc(db, "users", user.uid);

  await setDoc(
    ref,
    {
      uid: user.uid,

      email: user.email || "",

      name:
        data.name ||
        user.displayName ||
        "ZYLO Creator",

      username:
        data.username ||
        "@zylo_creator",

      bio:
        data.bio ||
        "Create • Connect • Grow",

      updatedAt: serverTimestamp()

    },
    {
      merge: true
    }
  );

}


/* =========================
   GET PROFILE
========================= */

async function getProfile(user) {

  const ref = doc(db, "users", user.uid);

  const snap = await getDoc(ref);

  if (snap.exists()) {

    return snap.data();

  }

  return {

    uid: user.uid,

    email: user.email || "",

    name: user.displayName || "ZYLO Creator",

    username: "@zylo_creator",

    bio: "Create • Connect • Grow"

  };

}


/* =========================
   LOGIN / REGISTER
========================= */

function openAuth(mode = "login") {

  closeOverlay();

  const overlay = document.createElement("div");

  overlay.className = "zylo-auth-overlay";

  overlay.innerHTML = `

    <div class="zylo-auth-card">

      <button
        class="zylo-auth-close"
        type="button">
        ×
      </button>

      <h2>
        ${
          mode === "login"
          ? "Login to ZYLO"
          : "Create your ZYLO account"
        }
      </h2>

      <p class="zylo-auth-sub">
        ${
          mode === "login"
          ? "আপনার অ্যাকাউন্টে Login করুন।"
          : "নতুন ZYLO অ্যাকাউন্ট তৈরি করুন।"
        }
      </p>

      ${
        mode === "register"
        ? `

          <label>Name</label>

          <input
            id="zylo-name"
            type="text"
            placeholder="Your name">

          <label>Username</label>

          <input
            id="zylo-username"
            type="text"
            placeholder="@username">

        `
        : ""
      }

      <label>Email</label>

      <input
        id="zylo-email"
        type="email"
        placeholder="you@example.com">

      <label>Password</label>

      <input
        id="zylo-password"
        type="password"
        placeholder="Password">

      <div class="zylo-auth-error"></div>

      <button
        class="zylo-auth-primary"
        id="zylo-submit"
        type="button">

        ${
          mode === "login"
          ? "Login"
          : "Create Account"
        }

      </button>

      <div class="zylo-auth-switch">

        ${
          mode === "login"

          ? `
            অ্যাকাউন্ট নেই?
            <button id="zylo-switch">
              Create Account
            </button>
          `

          : `
            অ্যাকাউন্ট আছে?
            <button id="zylo-switch">
              Login
            </button>
          `
        }

      </div>

    </div>
  `;

  document.body.appendChild(overlay);


  overlay
    .querySelector(".zylo-auth-close")
    .onclick = closeOverlay;


  overlay
    .querySelector("#zylo-switch")
    .onclick = () => {

      openAuth(
        mode === "login"
        ? "register"
        : "login"
      );

    };


  overlay
    .querySelector("#zylo-submit")
    .onclick = async () => {

      const email =
        overlay
          .querySelector("#zylo-email")
          .value
          .trim();

      const password =
        overlay
          .querySelector("#zylo-password")
          .value;

      const errorBox =
        overlay
          .querySelector(".zylo-auth-error");

      if (!email || !password) {

        showError(
          errorBox,
          "ইমেইল ও পাসওয়ার্ড দিন।"
        );

        return;

      }


      const button =
        overlay
          .querySelector("#zylo-submit");

      button.disabled = true;

      button.textContent =
        mode === "login"
        ? "Logging in..."
        : "Creating...";


      try {

        if (mode === "login") {

          const result =
            await signInWithEmailAndPassword(
              auth,
              email,
              password
            );

          await saveProfile(result.user);

          closeOverlay();

          openMyProfile();

        }

        else {

          const name =
            overlay
              .querySelector("#zylo-name")
              .value
              .trim()
              || "ZYLO Creator";


          let username =
            overlay
              .querySelector("#zylo-username")
              .value
              .trim()
              || "@zylo_creator";


          if (!username.startsWith("@")) {

            username = "@" + username;

          }


          const result =
            await createUserWithEmailAndPassword(
              auth,
              email,
              password
            );


          await updateProfile(
            result.user,
            {
              displayName: name
            }
          );


          await saveProfile(
            result.user,
            {
              name,
              username,
              bio: "Create • Connect • Grow"
            }
          );


          closeOverlay();

          openMyProfile();

        }

      }

      catch (error) {

        console.error(error);

        showError(
          errorBox,
          errorMessage(error)
        );

        button.disabled = false;

        button.textContent =
          mode === "login"
          ? "Login"
          : "Create Account";

      }

    };

}


/* =========================
   MY PROFILE
========================= */

async function openMyProfile() {

  if (!currentUser) {

    openAuth("login");

    return;

  }


  closeOverlay();


  const profile =
    await getProfile(currentUser);


  const overlay =
    document.createElement("div");

  overlay.className =
    "zylo-auth-overlay";


  overlay.innerHTML = `

    <div class="zylo-auth-card zylo-profile-card">

      <button
        class="zylo-auth-close"
        type="button">
        ×
      </button>

      <div class="zylo-avatar">
        Z
      </div>

      <div class="zylo-profile-name">

        ${escapeHtml(
          profile.name ||
          "ZYLO Creator"
        )}

      </div>

      <div class="zylo-profile-username">

        ${escapeHtml(
          profile.username ||
          "@zylo_creator"
        )}

      </div>

      <div class="zylo-profile-bio">

        ${escapeHtml(
          profile.bio ||
          "Create • Connect • Grow"
        )}

      </div>

      <div class="zylo-profile-email">

        ${escapeHtml(
          profile.email ||
          currentUser.email ||
          ""
        )}

      </div>

      <button
        class="zylo-auth-primary"
        id="zylo-edit"
        type="button">

        Edit Profile

      </button>

      <button
        class="zylo-auth-secondary"
        id="zylo-logout"
        type="button">

        Logout

      </button>

    </div>
  `;


  document.body.appendChild(overlay);


  overlay
    .querySelector(".zylo-auth-close")
    .onclick = closeOverlay;


  overlay
    .querySelector("#zylo-edit")
    .onclick = () => {

      openEditProfile(profile);

    };


  overlay
    .querySelector("#zylo-logout")
    .onclick = async () => {

      await signOut(auth);

      closeOverlay();

    };

}


/* =========================
   EDIT PROFILE
========================= */

function openEditProfile(profile) {

  closeOverlay();


  const overlay =
    document.createElement("div");

  overlay.className =
    "zylo-auth-overlay";


  overlay.innerHTML = `

    <div class="zylo-auth-card">

      <button
        class="zylo-auth-close"
        type="button">
        ×
      </button>

      <h2>Edit Profile</h2>

      <p class="zylo-auth-sub">
        আপনার প্রোফাইলের তথ্য পরিবর্তন করুন।
      </p>

      <label>Name</label>

      <input
        id="edit-name"
        value="${escapeHtml(
          profile.name ||
          "ZYLO Creator"
        )}">

      <label>Username</label>

      <input
        id="edit-username"
        value="${escapeHtml(
          profile.username ||
          "@zylo_creator"
        )}">

      <label>Bio</label>

      <input
        id="edit-bio"
        value="${escapeHtml(
          profile.bio ||
          "Create • Connect • Grow"
        )}">

      <div class="zylo-auth-error"></div>

      <button
        class="zylo-auth-primary"
        id="save-profile"
        type="button">

        Save Changes

      </button>

    </div>
  `;


  document.body.appendChild(overlay);


  overlay
    .querySelector(".zylo-auth-close")
    .onclick = openMyProfile;


  overlay
    .querySelector("#save-profile")
    .onclick = async () => {

      const name =
        overlay
          .querySelector("#edit-name")
          .value
          .trim()
          || "ZYLO Creator";


      let username =
        overlay
          .querySelector("#edit-username")
          .value
          .trim()
          || "@zylo_creator";


      const bio =
        overlay
          .querySelector("#edit-bio")
          .value
          .trim()
          || "Create • Connect • Grow";


      if (!username.startsWith("@")) {

        username = "@" + username;

      }


      const button =
        overlay
          .querySelector("#save-profile");


      const errorBox =
        overlay
          .querySelector(".zylo-auth-error");


      button.disabled = true;

      button.textContent = "Saving...";


      try {

        await updateProfile(
          currentUser,
          {
            displayName: name
          }
        );


        await saveProfile(
          currentUser,
          {
            name,
            username,
            bio
          }
        );


        closeOverlay();

        await openMyProfile();

      }

      catch (error) {

        console.error(error);

        showError(
          errorBox,
          errorMessage(error)
        );

        button.disabled = false;

        button.textContent =
          "Save Changes";

      }

    };

}


/* =========================
   AUTH STATE
========================= */

onAuthStateChanged(
  auth,
  user => {

    currentUser = user;

    window.ZYLOAuth = {

      openLogin: () =>
        openAuth("login"),

      openRegister: () =>
        openAuth("register"),

      openMyProfile,

      openEditProfile,

      logout: () =>
        signOut(auth),

      getCurrentUser: () =>
        currentUser

    };

  }
);


/* =========================
   PROFILE BUTTON
========================= */

document.addEventListener(
  "click",
  event => {

    const button =
      event.target.closest(
        ".bottom-nav .nav-item"
      );

    if (!button) return;


    const text =
      button.textContent
        .trim()
        .toLowerCase();


    if (text.includes("profile")) {

      event.preventDefault();

      event.stopImmediatePropagation();

      openMyProfile();

    }

  },
  true
);
