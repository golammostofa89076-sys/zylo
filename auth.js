/* =========================================================
   ZYLO AUTH + PROFILE + FIREBASE FOLLOW SYSTEM
   Project: zylo-217f2
   ========================================================= */

import {
  initializeApp
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";

import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updateProfile
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";

import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  collection,
  query,
  where,
  getDocs,
  getCountFromServer,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";


/* =========================================================
   FIREBASE CONFIG
   ========================================================= */

const firebaseConfig = {
  apiKey: "AIzaSyBc3AVM3BYmKpIbm288w9VR9AVPVIt9Cgo",
  authDomain: "zylo-217f2.firebaseapp.com",
  projectId: "zylo-217f2",
  storageBucket: "zylo-217f2.firebasestorage.app",
  messagingSenderId: "859616472941",
  appId: "1:859616472941:web:6a70b1bc83deaacc213464"
};


/* =========================================================
   INITIALIZE
   ========================================================= */

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentUser = null;


/* =========================================================
   CONSTANTS
   ========================================================= */

const FOLLOWING_CACHE_KEY = "zylo_following_uids";
const FOLLOWING_CACHE_KEY_V3 = "zylo_follows_v3";


/* =========================================================
   BASIC HELPERS
   ========================================================= */

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


function normalizeUsername(value) {
  let username = String(value ?? "").trim();

  if (!username) return "@user";

  if (!username.startsWith("@")) {
    username = "@" + username;
  }

  return username;
}


function formatCount(value) {
  const number = Number(value) || 0;

  if (number >= 1000000000) {
    return (number / 1000000000).toFixed(1).replace(".0", "") + "B";
  }

  if (number >= 1000000) {
    return (number / 1000000).toFixed(1).replace(".0", "") + "M";
  }

  if (number >= 1000) {
    return (number / 1000).toFixed(1).replace(".0", "") + "K";
  }

  return String(number);
}


function errorMessage(error) {
  const code = error?.code || "";

  const messages = {
    "auth/invalid-credential": "Email বা password সঠিক নয়।",
    "auth/invalid-email": "সঠিক email দিন।",
    "auth/email-already-in-use": "এই email দিয়ে আগে থেকেই account আছে।",
    "auth/weak-password": "Password কমপক্ষে 6 অক্ষরের হতে হবে।",
    "auth/user-not-found": "এই email-এর কোনো account পাওয়া যায়নি।",
    "auth/wrong-password": "Password সঠিক নয়।",
    "auth/too-many-requests": "অনেকবার চেষ্টা হয়েছে। কিছুক্ষণ পরে আবার চেষ্টা করুন।",
    "auth/network-request-failed": "Internet connection সমস্যা হয়েছে।"
  };

  return messages[code] || error?.message || "একটি সমস্যা হয়েছে।";
}


function showError(message) {
  const existing = document.querySelector(".zylo-auth-error");

  if (existing) {
    existing.textContent = message;
    return;
  }

  const error = document.createElement("div");

  error.className = "zylo-auth-error";

  error.textContent = message;

  Object.assign(error.style, {
    position: "fixed",
    left: "50%",
    bottom: "25px",
    transform: "translateX(-50%)",
    zIndex: "999999",
    background: "#ff3040",
    color: "#fff",
    padding: "12px 18px",
    borderRadius: "12px",
    fontSize: "14px",
    maxWidth: "90%",
    textAlign: "center",
    boxShadow: "0 8px 30px rgba(0,0,0,.3)"
  });

  document.body.appendChild(error);

  setTimeout(() => {
    error.remove();
  }, 3500);
}


/* =========================================================
   OVERLAY HELPERS
   ========================================================= */

function closeAllZYLOOverlays() {
  [
    "#zyloAuthOverlay",
    "#zyloProfileOverlay",
    "#zyloCreatorProfile",
    "#zyloEditProfileOverlay"
  ].forEach(selector => {
    const element = document.querySelector(selector);
    if (element) element.remove();
  });
}


function closeProfileOverlaysOnly() {
  [
    "#zyloProfileOverlay",
    "#zyloCreatorProfile",
    "#zyloEditProfileOverlay"
  ].forEach(selector => {
    const element = document.querySelector(selector);
    if (element) element.remove();
  });
}


/* =========================================================
   PROFILE STORAGE
   ========================================================= */

async function saveProfile(user, data = {}) {
  if (!user?.uid) return null;

  const ref = doc(db, "users", user.uid);

  const existingSnap = await getDoc(ref);

  const existing = existingSnap.exists()
    ? existingSnap.data()
    : {};

  const profile = {
    uid: user.uid,

    email:
      data.email ??
      existing.email ??
      user.email ??
      "",

    name:
      data.name ??
      existing.name ??
      user.displayName ??
      "ZYLO User",

    username:
      data.username ??
      existing.username ??
      normalizeUsername(
        user.displayName ||
        "user"
      ),

    bio:
      data.bio ??
      existing.bio ??
      "",

    photoURL:
      data.photoURL ??
      existing.photoURL ??
      user.photoURL ??
      "",

    followers:
      Number(data.followers ?? existing.followers ?? 0),

    following:
      Number(data.following ?? existing.following ?? 0),

    likes:
      Number(data.likes ?? existing.likes ?? 0),

    updatedAt: serverTimestamp()
  };

  await setDoc(ref, profile, { merge: true });

  return profile;
}


async function getProfile(userOrUid) {
  const uid =
    typeof userOrUid === "string"
      ? userOrUid
      : userOrUid?.uid;

  if (!uid) return null;

  try {
    const snap = await getDoc(doc(db, "users", uid));

    if (!snap.exists()) {
      return null;
    }

    const data = snap.data();

    return {
      uid,

      email: data.email || "",

      name:
        data.name ||
        "ZYLO User",

      username:
        normalizeUsername(
          data.username ||
          data.name ||
          "user"
        ),

      bio:
        data.bio ||
        "",

      photoURL:
        data.photoURL ||
        "",

      followers:
        Number(data.followers || 0),

      following:
        Number(data.following || 0),

      likes:
        Number(data.likes || 0)
    };

  } catch (error) {
    console.warn("ZYLO profile read error:", error);
    return null;
  }
}


/* =========================================================
   FOLLOW CACHE
   ========================================================= */

function getFollowingUIDs() {
  try {
    const primary =
      JSON.parse(
        localStorage.getItem(FOLLOWING_CACHE_KEY) || "[]"
      );

    if (Array.isArray(primary)) {
      return primary;
    }
  } catch {}

  try {
    const secondary =
      JSON.parse(
        localStorage.getItem(FOLLOWING_CACHE_KEY_V3) || "[]"
      );

    if (Array.isArray(secondary)) {
      return secondary;
    }
  } catch {}

  return [];
}


function saveFollowingUIDs(uids) {
  const unique = [
    ...new Set(
      (uids || [])
        .filter(Boolean)
        .map(String)
    )
  ];

  try {
    localStorage.setItem(
      FOLLOWING_CACHE_KEY,
      JSON.stringify(unique)
    );

    localStorage.setItem(
      FOLLOWING_CACHE_KEY_V3,
      JSON.stringify(unique)
    );
  } catch (error) {
    console.warn("ZYLO follow cache error:", error);
  }
}


function addFollowToCache(uid) {
  const list = getFollowingUIDs();

  if (!list.includes(uid)) {
    list.push(uid);
  }

  saveFollowingUIDs(list);
}


function removeFollowFromCache(uid) {
  const list =
    getFollowingUIDs()
      .filter(id => id !== uid);

  saveFollowingUIDs(list);
}


/* =========================================================
   FOLLOW DOCUMENT
   ========================================================= */

function followDocId(followerUid, followingUid) {
  return `${followerUid}_${followingUid}`;
}


async function isFollowing(followingUid) {
  if (!currentUser?.uid || !followingUid) {
    return false;
  }

  if (currentUser.uid === followingUid) {
    return false;
  }

  try {
    const ref = doc(
      db,
      "follows",
      followDocId(
        currentUser.uid,
        followingUid
      )
    );

    const snap = await getDoc(ref);

    if (snap.exists()) {
      addFollowToCache(followingUid);
      return true;
    }

    removeFollowFromCache(followingUid);

    return false;

  } catch (error) {
    console.warn("ZYLO follow status error:", error);

    return getFollowingUIDs()
      .includes(followingUid);
  }
}


/* =========================================================
   FIREBASE FOLLOW / UNFOLLOW
   ========================================================= */

async function followUser(followingUid) {
  if (!currentUser?.uid) {
    openAuth("login");
    return false;
  }

  if (!followingUid) {
    return false;
  }

  if (currentUser.uid === followingUid) {
    return false;
  }

  const followerUid = currentUser.uid;

  const ref = doc(
    db,
    "follows",
    followDocId(
      followerUid,
      followingUid
    )
  );

  try {
    await setDoc(ref, {
      followerUid,
      followingUid,
      createdAt: serverTimestamp()
    });

    addFollowToCache(followingUid);

    return true;

  } catch (error) {
    console.error("ZYLO follow error:", error);

    showError(
      "Follow করা যায়নি: " +
      errorMessage(error)
    );

    return false;
  }
}


async function unfollowUser(followingUid) {
  if (!currentUser?.uid) {
    return false;
  }

  if (!followingUid) {
    return false;
  }

  const followerUid = currentUser.uid;

  const ref = doc(
    db,
    "follows",
    followDocId(
      followerUid,
      followingUid
    )
  );

  try {
    await deleteDoc(ref);

    removeFollowFromCache(followingUid);

    return true;

  } catch (error) {
    console.error("ZYLO unfollow error:", error);

    showError(
      "Unfollow করা যায়নি: " +
      errorMessage(error)
    );

    return false;
  }
}


/* =========================================================
   FOLLOW COUNTS
   ========================================================= */

async function getFollowersCount(uid) {
  if (!uid) return 0;

  try {
    const q = query(
      collection(db, "follows"),
      where("followingUid", "==", uid)
    );

    const result =
      await getCountFromServer(q);

    return Number(
      result.data().count || 0
    );

  } catch (error) {
    console.warn(
      "ZYLO followers count error:",
      error
    );

    const profile =
      await getProfile(uid);

    return Number(
      profile?.followers || 0
    );
  }
}


async function getFollowingCount(uid) {
  if (!uid) return 0;

  try {
    const q = query(
      collection(db, "follows"),
      where("followerUid", "==", uid)
    );

    const result =
      await getCountFromServer(q);

    return Number(
      result.data().count || 0
    );

  } catch (error) {
    console.warn(
      "ZYLO following count error:",
      error
    );

    const profile =
      await getProfile(uid);

    return Number(
      profile?.following || 0
    );
  }
}


/* =========================================================
   SYNC PROFILE COUNTS
   ========================================================= */

async function getFreshProfile(uid) {
  const profile =
    await getProfile(uid);

  if (!profile) return null;

  const [
    followers,
    following
  ] = await Promise.all([
    getFollowersCount(uid),
    getFollowingCount(uid)
  ]);

  profile.followers = followers;
  profile.following = following;

  return profile;
}


/* =========================================================
   AUTH UI STYLE
   ========================================================= */

function injectZYLOStyles() {
  if (document.getElementById("zylo-auth-styles")) {
    return;
  }

  const style =
    document.createElement("style");

  style.id = "zylo-auth-styles";

  style.textContent = `
    .zylo-auth-overlay,
    .zylo-profile-overlay {
      position: fixed;
      inset: 0;
      z-index: 99990;
      background: rgba(0,0,0,.72);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 18px;
    }

    .zylo-auth-box,
    .zylo-profile-box {
      width: min(520px, 100%);
      max-height: 92vh;
      overflow-y: auto;
      background: #111;
      color: #fff;
      border-radius: 22px;
      box-shadow: 0 20px 70px rgba(0,0,0,.45);
    }

    .zylo-auth-header,
    .zylo-profile-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 18px 20px;
      border-bottom: 1px solid rgba(255,255,255,.1);
    }

    .zylo-close {
      border: 0;
      background: transparent;
      color: #fff;
      font-size: 26px;
      cursor: pointer;
    }

    .zylo-auth-body {
      padding: 20px;
    }

    .zylo-auth-body input,
    .zylo-edit-input,
    .zylo-edit-textarea {
      width: 100%;
      box-sizing: border-box;
      border: 1px solid rgba(255,255,255,.14);
      background: #1d1d1d;
      color: #fff;
      padding: 13px 14px;
      border-radius: 12px;
      margin-bottom: 12px;
      outline: none;
    }

    .zylo-edit-textarea {
      min-height: 90px;
      resize: vertical;
    }

    .zylo-primary-btn {
      width: 100%;
      border: 0;
      border-radius: 12px;
      padding: 13px 16px;
      background: #fe2c55;
      color: #fff;
      font-weight: 700;
      cursor: pointer;
    }

    .zylo-secondary-btn {
      border: 1px solid rgba(255,255,255,.16);
      border-radius: 10px;
      padding: 10px 15px;
      background: transparent;
      color: #fff;
      cursor: pointer;
    }

    .zylo-profile-content {
      padding: 20px;
    }

    .zylo-profile-top {
      text-align: center;
    }

    .zylo-profile-avatar {
      width: 92px;
      height: 92px;
      border-radius: 50%;
      object-fit: cover;
      background: #292929;
      display: block;
      margin: 0 auto 12px;
    }

    .zylo-profile-name {
      font-size: 21px;
      font-weight: 800;
    }

    .zylo-profile-username {
      opacity: .72;
      margin-top: 3px;
    }

    .zylo-profile-bio {
      margin: 12px auto 18px;
      max-width: 420px;
      opacity: .9;
      line-height: 1.45;
    }

    .zylo-profile-stats {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
      margin: 15px 0;
    }

    .zylo-profile-stat {
      text-align: center;
      padding: 10px 4px;
      border-radius: 12px;
      background: rgba(255,255,255,.06);
    }

    .zylo-profile-stat strong {
      display: block;
      font-size: 18px;
    }

    .zylo-profile-stat span {
      font-size: 12px;
      opacity: .65;
    }

    .zylo-profile-actions {
      display: flex;
      justify-content: center;
      gap: 9px;
      flex-wrap: wrap;
      margin: 15px 0 20px;
    }

    .zylo-follow-btn {
      min-width: 120px;
      border: 0;
      border-radius: 10px;
      padding: 11px 18px;
      background: #fe2c55;
      color: #fff;
      font-weight: 700;
      cursor: pointer;
    }

    .zylo-follow-btn.following {
      background: #2b2b2b;
      border: 1px solid rgba(255,255,255,.15);
    }

    .zylo-profile-section-title {
      font-weight: 800;
      margin: 18px 0 12px;
    }

    .zylo-profile-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 3px;
    }

    .zylo-profile-video {
      aspect-ratio: 9 / 14;
      background: #222;
      overflow: hidden;
      cursor: pointer;
    }

    .zylo-profile-video video,
    .zylo-profile-video img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .zylo-empty-profile {
      padding: 30px 10px;
      text-align: center;
      opacity: .6;
    }

    @media (max-width: 480px) {
      .zylo-auth-overlay,
      .zylo-profile-overlay {
        padding: 0;
        align-items: flex-end;
      }

      .zylo-auth-box,
      .zylo-profile-box {
        width: 100%;
        max-height: 94vh;
        border-radius: 22px 22px 0 0;
      }
    }
  `;

  document.head.appendChild(style);
}


/* =========================================================
   AUTH OVERLAY
   ========================================================= */

function openAuth(mode = "login") {
  injectZYLOStyles();

  const old =
    document.getElementById(
      "zyloAuthOverlay"
    );

  if (old) old.remove();

  const overlay =
    document.createElement("div");

  overlay.id =
    "zyloAuthOverlay";

  overlay.className =
    "zylo-auth-overlay";

  overlay.innerHTML = `
    <div class="zylo-auth-box">

      <div class="zylo-auth-header">
        <strong id="zyloAuthTitle">
          ${mode === "register"
            ? "Create ZYLO Account"
            : "Login to ZYLO"}
        </strong>

        <button
          class="zylo-close"
          id="zyloAuthClose"
          type="button"
        >
          ×
        </button>
      </div>

      <div class="zylo-auth-body">

        <form id="zyloAuthForm">

          ${
            mode === "register"
              ? `
                <input
                  id="zyloName"
                  type="text"
                  placeholder="Name"
                  autocomplete="name"
                  required
                >

                <input
                  id="zyloUsername"
                  type="text"
                  placeholder="Username"
                  autocomplete="username"
                  required
                >
              `
              : ""
          }

          <input
            id="zyloEmail"
            type="email"
            placeholder="Email"
            autocomplete="email"
            required
          >

          <input
            id="zyloPassword"
            type="password"
            placeholder="Password"
            autocomplete="${
              mode === "register"
                ? "new-password"
                : "current-password"
            }"
            required
          >

          <button
            class="zylo-primary-btn"
            type="submit"
          >
            ${
              mode === "register"
                ? "Create Account"
                : "Login"
            }
          </button>

        </form>

        <div style="
          text-align:center;
          margin-top:16px;
          opacity:.8;
          font-size:14px;
        ">

          ${
            mode === "register"
              ? `
                Already have an account?
                <button
                  type="button"
                  id="zyloSwitchLogin"
                  class="zylo-secondary-btn"
                >
                  Login
                </button>
              `
              : `
                Don't have an account?
                <button
                  type="button"
                  id="zyloSwitchRegister"
                  class="zylo-secondary-btn"
                >
                  Register
                </button>
              `
          }

        </div>

      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  document
    .getElementById("zyloAuthClose")
    ?.addEventListener(
      "click",
      () => overlay.remove()
    );

  document
    .getElementById("zyloSwitchLogin")
    ?.addEventListener(
      "click",
      () => openAuth("login")
    );

  document
    .getElementById("zyloSwitchRegister")
    ?.addEventListener(
      "click",
      () => openAuth("register")
    );

  document
    .getElementById("zyloAuthForm")
    ?.addEventListener(
      "submit",
      async event => {

        event.preventDefault();

        const email =
          document
            .getElementById("zyloEmail")
            ?.value
            .trim();

        const password =
          document
            .getElementById("zyloPassword")
            ?.value;

        try {

          if (mode === "register") {

            const name =
              document
                .getElementById("zyloName")
                ?.value
                .trim();

            const username =
              normalizeUsername(
                document
                  .getElementById("zyloUsername")
                  ?.value
                  .trim()
              );

            const credential =
              await createUserWithEmailAndPassword(
                auth,
                email,
                password
              );

            await updateProfile(
              credential.user,
              {
                displayName: username
              }
            );

            currentUser =
              credential.user;

            await saveProfile(
              credential.user,
              {
                name,
                username,
                bio: "",
                photoURL:
                  credential.user.photoURL ||
                  ""
              }
            );

          } else {

            const credential =
              await signInWithEmailAndPassword(
                auth,
                email,
                password
              );

            currentUser =
              credential.user;

            await saveProfile(
              credential.user
            );
          }

          overlay.remove();

          window.dispatchEvent(
            new CustomEvent(
              "zylo:authready"
            )
          );

        } catch (error) {

          console.error(
            "ZYLO auth error:",
            error
          );

          showError(
            errorMessage(error)
          );
        }
      }
    );
}


/* =========================================================
   PROFILE AVATAR
   ========================================================= */

function profileAvatarHTML(
  profile,
  className = "zylo-profile-avatar"
) {
  if (profile?.photoURL) {

    return `
      <img
        class="${className}"
        src="${escapeHtml(profile.photoURL)}"
        alt=""
      >
    `;

  }

  const letter =
    escapeHtml(
      (
        profile?.name ||
        profile?.username ||
        "Z"
      )
        .replace("@", "")
        .charAt(0)
        .toUpperCase()
    );

  return `
    <div
      class="${className}"
      style="
        display:flex;
        align-items:center;
        justify-content:center;
        font-size:32px;
        font-weight:800;
        color:#fff;
      "
    >
      ${letter}
    </div>
  `;
}


/* =========================================================
   PROFILE OVERLAY
   ========================================================= */

function createProfileOverlay(
  title = "Profile"
) {
  injectZYLOStyles();

  closeProfileOverlaysOnly();

  const overlay =
    document.createElement("div");

  overlay.id =
    "zyloProfileOverlay";

  overlay.className =
    "zylo-profile-overlay";

  overlay.innerHTML = `
    <div class="zylo-profile-box">

      <div class="zylo-profile-header">

        <strong>
          ${escapeHtml(title)}
        </strong>

        <button
          type="button"
          class="zylo-close"
          data-profile-close
        >
          ×
        </button>

      </div>

      <div
        class="zylo-profile-content"
        id="zyloProfileContent"
      >
        <div class="zylo-empty-profile">
          Loading...
        </div>
      </div>

    </div>
  `;

  document.body.appendChild(overlay);

  overlay
    .querySelector(
      "[data-profile-close]"
    )
    ?.addEventListener(
      "click",
      () => overlay.remove()
    );

  return overlay;
}


/* =========================================================
   VIDEO CREATOR DETECTION
   ========================================================= */

function getCreatorFromVideoPage(page) {
  if (!page) return null;

  const uid =
    page.dataset.creatorUid ||
    page.getAttribute("data-creator-uid") ||
    "";

  const username =
    page.dataset.creatorUsername ||
    page.getAttribute(
      "data-creator-username"
    ) ||
    "";

  return {
    uid,
    username:
      normalizeUsername(
        username || "zylo_creator"
      )
  };
}


function openCreatorProfileFromPage(page) {
  const creator =
    getCreatorFromVideoPage(page);

  if (!creator?.uid) {
    showError(
      "Creator information পাওয়া যায়নি।"
    );
    return;
  }

  openCreatorProfile(
    creator.uid,
    creator.username
  );
}


/* =========================================================
   CREATOR PROFILE
   ========================================================= */

async function openCreatorProfile(
  uid,
  fallbackUsername = ""
) {
  if (!uid) return;

  if (
    currentUser?.uid &&
    currentUser.uid === uid
  ) {
    openMyProfile();
    return;
  }

  const overlay =
    createProfileOverlay(
      "Creator Profile"
    );

  const content =
    overlay.querySelector(
      "#zyloProfileContent"
    );

  try {

    let profile =
      await getFreshProfile(uid);

    if (!profile) {

      profile = {
        uid,
        name:
          fallbackUsername
            .replace("@", "") ||
          "ZYLO Creator",
        username:
          normalizeUsername(
            fallbackUsername ||
            "zylo_creator"
          ),
        bio: "",
        photoURL: "",
        followers: 0,
        following: 0,
        likes: 0
      };
    }

    await renderCreatorProfile(
      content,
      profile
    );

  } catch (error) {

    console.error(
      "Creator profile error:",
      error
    );

    content.innerHTML = `
      <div class="zylo-empty-profile">
        Profile load করা যায়নি।
      </div>
    `;
  }
}


async function renderCreatorProfile(
  content,
  profile
) {
  if (!content) return;

  const following =
    await isFollowing(
      profile.uid
    );

  content.innerHTML = `
    <div class="zylo-profile-top">

      ${profileAvatarHTML(profile)}

      <div class="zylo-profile-name">
        ${escapeHtml(
          profile.name ||
          profile.username
        )}
      </div>

      <div class="zylo-profile-username">
        ${escapeHtml(
          normalizeUsername(
            profile.username
          )
        )}
      </div>

      ${
        profile.bio
          ? `
            <div class="zylo-profile-bio">
              ${escapeHtml(profile.bio)}
            </div>
          `
          : ""
      }

      <div class="zylo-profile-stats">

        <div class="zylo-profile-stat">
          <strong data-followers-count>
            ${formatCount(profile.followers)}
          </strong>
          <span>Followers</span>
        </div>

        <div class="zylo-profile-stat">
          <strong>
            ${formatCount(profile.following)}
          </strong>
          <span>Following</span>
        </div>

        <div class="zylo-profile-stat">
          <strong>
            ${formatCount(profile.likes)}
          </strong>
          <span>Likes</span>
        </div>

      </div>

      <div class="zylo-profile-actions">

        <button
          type="button"
          class="zylo-follow-btn ${
            following ? "following" : ""
          }"
          data-follow-uid="${escapeHtml(profile.uid)}"
        >
          ${
            following
              ? "Following"
              : "Follow"
          }
        </button>

        <button
          type="button"
          class="zylo-secondary-btn"
          data-share-profile="${escapeHtml(profile.uid)}"
        >
          Share Profile
        </button>

      </div>

    </div>

    <div class="zylo-profile-section-title">
      Videos
    </div>

    <div
      class="zylo-profile-grid"
      id="zyloCreatorVideoGrid"
    >
    </div>
  `;


  /* -------------------------------------------------------
     FOLLOW BUTTON
     ------------------------------------------------------- */

  const followButton =
    content.querySelector(
      "[data-follow-uid]"
    );

  followButton?.addEventListener(
    "click",
    async () => {

      if (!currentUser) {
        openAuth("login");
        return;
      }

      followButton.disabled = true;

      const wasFollowing =
        followButton.classList.contains(
          "following"
        );

      let success = false;

      if (wasFollowing) {

        success =
          await unfollowUser(
            profile.uid
          );

        if (success) {

          followButton.classList.remove(
            "following"
          );

          followButton.textContent =
            "Follow";

          const count =
            await getFollowersCount(
              profile.uid
            );

          const counter =
            content.querySelector(
              "[data-followers-count]"
            );

          if (counter) {
            counter.textContent =
              formatCount(count);
          }
        }

      } else {

        success =
          await followUser(
            profile.uid
          );

        if (success) {

          followButton.classList.add(
            "following"
          );

          followButton.textContent =
            "Following";

          const count =
            await getFollowersCount(
              profile.uid
            );

          const counter =
            content.querySelector(
              "[data-followers-count]"
            );

          if (counter) {
            counter.textContent =
              formatCount(count);
          }
        }
      }

      followButton.disabled =
        false;
    }
  );


  /* -------------------------------------------------------
     SHARE PROFILE
     ------------------------------------------------------- */

  content
    .querySelector(
      "[data-share-profile]"
    )
    ?.addEventListener(
      "click",
      async () => {

        const username =
          normalizeUsername(
            profile.username
          );

        const url =
          `${window.location.origin}` +
          `${window.location.pathname}` +
          `#profile/${encodeURIComponent(
            profile.uid
          )}`;

        try {

          if (
            navigator.share
          ) {

            await navigator.share({
              title:
                `${username} on ZYLO`,
              text:
                `Check out ${username} on ZYLO`,
              url
            });

          } else if (
            navigator.clipboard
          ) {

            await navigator.clipboard.writeText(
              url
            );

            showError(
              "Profile link copied!"
            );
          }

        } catch (error) {
          console.warn(
            "Profile share cancelled:",
            error
          );
        }
      }
    );


  /* -------------------------------------------------------
     CREATOR VIDEOS
     ------------------------------------------------------- */

  await renderCreatorVideos(
    profile,
    content.querySelector(
      "#zyloCreatorVideoGrid"
    )
  );
}


/* =========================================================
   FIND VIDEO PAGES
   ========================================================= */

function getAllVideoPages() {
  return Array.from(
    document.querySelectorAll(
      ".video-page"
    )
  );
}


async function renderCreatorVideos(
  profile,
  grid
) {
  if (!grid) return;

  const pages =
    getAllVideoPages()
      .filter(page => {

        const creator =
          getCreatorFromVideoPage(
            page
          );

        return (
          creator?.uid &&
          creator.uid === profile.uid
        );
      });

  if (!pages.length) {

    grid.innerHTML = `
      <div
        class="zylo-empty-profile"
        style="grid-column:1/-1;"
      >
        No videos yet.
      </div>
    `;

    return;
  }

  grid.innerHTML = "";

  pages.forEach(page => {

    const item =
      createProfileVideoItem(
        page
      );

    grid.appendChild(item);
  });
}


function createProfileVideoItem(page) {
  const item =
    document.createElement("div");

  item.className =
    "zylo-profile-video";

  const video =
    page.querySelector("video");

  if (video) {

    const clone =
      video.cloneNode(true);

    clone.controls = false;
    clone.muted = true;
    clone.autoplay = false;
    clone.loop = true;

    item.appendChild(clone);

  } else {

    item.innerHTML = `
      <div
        style="
          width:100%;
          height:100%;
          display:flex;
          align-items:center;
          justify-content:center;
        "
      >
        🎬
      </div>
    `;
  }

  item.addEventListener(
    "click",
    () => {

      closeProfileOverlaysOnly();

      const pages =
        getAllVideoPages();

      const index =
        pages.indexOf(page);

      if (
        index >= 0 &&
        window.ZYLOVideoEngine
      ) {

        try {

          window.ZYLOVideoEngine
            .scrollToPage(
              index,
              "auto"
            );

        } catch {
          page.scrollIntoView({
            behavior: "auto",
            block: "start"
          });
        }
      }
    }
  );

  return item;
}


/* =========================================================
   MY PROFILE
   ========================================================= */

async function openMyProfile() {
  if (!currentUser) {
    openAuth("login");
    return;
  }

  const overlay =
    createProfileOverlay(
      "My Profile"
    );

  const content =
    overlay.querySelector(
      "#zyloProfileContent"
    );

  try {

    const profile =
      await getFreshProfile(
        currentUser.uid
      );

    await renderMyProfile(
      content,
      profile || {
        uid: currentUser.uid,
        name:
          currentUser.displayName ||
          "ZYLO User",
        username:
          normalizeUsername(
            currentUser.displayName ||
            "user"
          ),
        bio: "",
        photoURL:
          currentUser.photoURL ||
          "",
        followers: 0,
        following: 0,
        likes: 0
      }
    );

  } catch (error) {

    console.error(
      "My profile error:",
      error
    );

    content.innerHTML = `
      <div class="zylo-empty-profile">
        Profile load করা যায়নি।
      </div>
    `;
  }
}


async function renderMyProfile(
  content,
  profile
) {
  content.innerHTML = `

    <div class="zylo-profile-top">

      ${profileAvatarHTML(profile)}

      <div class="zylo-profile-name">
        ${escapeHtml(
          profile.name
        )}
      </div>

      <div class="zylo-profile-username">
        ${escapeHtml(
          normalizeUsername(
            profile.username
          )
        )}
      </div>

      ${
        profile.bio
          ? `
            <div class="zylo-profile-bio">
              ${escapeHtml(profile.bio)}
            </div>
          `
          : ""
      }

      <div class="zylo-profile-stats">

        <div class="zylo-profile-stat">
          <strong>
            ${formatCount(
              profile.followers
            )}
          </strong>
          <span>Followers</span>
        </div>

        <div class="zylo-profile-stat">
          <strong>
            ${formatCount(
              profile.following
            )}
          </strong>
          <span>Following</span>
        </div>

        <div class="zylo-profile-stat">
          <strong>
            ${formatCount(
              profile.likes
            )}
          </strong>
          <span>Likes</span>
        </div>

      </div>

      <div class="zylo-profile-actions">

        <button
          type="button"
          class="zylo-secondary-btn"
          id="zyloEditProfileButton"
        >
          Edit Profile
        </button>

        <button
          type="button"
          class="zylo-secondary-btn"
          id="zyloShareMyProfile"
        >
          Share Profile
        </button>

        <button
          type="button"
          class="zylo-secondary-btn"
          id="zyloLogoutButton"
        >
          Logout
        </button>

      </div>

    </div>

    <div class="zylo-profile-section-title">
      My Videos
    </div>

    <div
      class="zylo-profile-grid"
      id="zyloMyVideoGrid"
    ></div>
  `;


  content
    .querySelector(
      "#zyloEditProfileButton"
    )
    ?.addEventListener(
      "click",
      () => openEditProfile(profile)
    );


  content
    .querySelector(
      "#zyloLogoutButton"
    )
    ?.addEventListener(
      "click",
      async () => {

        try {

          await signOut(auth);

          closeAllZYLOOverlays();

        } catch (error) {

          showError(
            errorMessage(error)
          );
        }
      }
    );


  content
    .querySelector(
      "#zyloShareMyProfile"
    )
    ?.addEventListener(
      "click",
      async () => {

        const username =
          normalizeUsername(
            profile.username
          );

        const url =
          `${window.location.origin}` +
          `${window.location.pathname}` +
          `#profile/${encodeURIComponent(
            profile.uid
          )}`;

        try {

          if (
            navigator.share
          ) {

            await navigator.share({
              title:
                `${username} on ZYLO`,
              text:
                `Check out ${username} on ZYLO`,
              url
            });

          } else if (
            navigator.clipboard
          ) {

            await navigator.clipboard.writeText(
              url
            );

            showError(
              "Profile link copied!"
            );
          }

        } catch {}
      }
    );


  await renderMyVideos(
    profile,
    content.querySelector(
      "#zyloMyVideoGrid"
    )
  );
}


/* =========================================================
   MY VIDEOS
   ========================================================= */

async function renderMyVideos(
  profile,
  grid
) {
  if (!grid) return;

  const pages =
    getAllVideoPages()
      .filter(page => {

        const creator =
          getCreatorFromVideoPage(
            page
          );

        return (
          creator?.uid &&
          creator.uid === profile.uid
        );
      });

  if (!pages.length) {

    grid.innerHTML = `
      <div
        class="zylo-empty-profile"
        style="grid-column:1/-1;"
      >
        You haven't uploaded any videos yet.
      </div>
    `;

    return;
  }

  grid.innerHTML = "";

  pages.forEach(page => {

    grid.appendChild(
      createProfileVideoItem(
        page
      )
    );

  });
}


/* =========================================================
   EDIT PROFILE
   ========================================================= */

function openEditProfile(profile) {
  injectZYLOStyles();

  const old =
    document.getElementById(
      "zyloEditProfileOverlay"
    );

  if (old) old.remove();

  const overlay =
    document.createElement("div");

  overlay.id =
    "zyloEditProfileOverlay";

  overlay.className =
    "zylo-profile-overlay";

  overlay.innerHTML = `

    <div class="zylo-profile-box">

      <div class="zylo-profile-header">

        <strong>
          Edit Profile
        </strong>

        <button
          type="button"
          class="zylo-close"
          data-edit-close
        >
          ×
        </button>

      </div>

      <div class="zylo-profile-content">

        <input
          class="zylo-edit-input"
          id="zyloEditName"
          value="${escapeHtml(
            profile.name
          )}"
          placeholder="Name"
        >

        <input
          class="zylo-edit-input"
          id="zyloEditUsername"
          value="${escapeHtml(
            normalizeUsername(
              profile.username
            )
          )}"
          placeholder="@username"
        >

        <textarea
          class="zylo-edit-textarea"
          id="zyloEditBio"
          placeholder="Bio"
        >${escapeHtml(
          profile.bio || ""
        )}</textarea>

        <input
          class="zylo-edit-input"
          id="zyloEditPhoto"
          value="${escapeHtml(
            profile.photoURL || ""
          )}"
          placeholder="Profile photo URL"
        >

        <button
          type="button"
          class="zylo-primary-btn"
          id="zyloSaveProfile"
        >
          Save Profile
        </button>

      </div>

    </div>
  `;

  document.body.appendChild(
    overlay
  );

  overlay
    .querySelector(
      "[data-edit-close]"
    )
    ?.addEventListener(
      "click",
      () => overlay.remove()
    );


  overlay
    .querySelector(
      "#zyloSaveProfile"
    )
    ?.addEventListener(
      "click",
      async () => {

        const name =
          document
            .getElementById(
              "zyloEditName"
            )
            ?.value
            .trim() ||
          "ZYLO User";

        const username =
          normalizeUsername(
            document
              .getElementById(
                "zyloEditUsername"
              )
              ?.value
              .trim()
          );

        const bio =
          document
            .getElementById(
              "zyloEditBio"
            )
            ?.value
            .trim() ||
          "";

        const photoURL =
          document
            .getElementById(
              "zyloEditPhoto"
            )
            ?.value
            .trim() ||
          "";

        try {

          await updateProfile(
            currentUser,
            {
              displayName:
                username,
              photoURL:
                photoURL || null
            }
          );

          await saveProfile(
            currentUser,
            {
              name,
              username,
              bio,
              photoURL
            }
          );

          overlay.remove();

          await openMyProfile();

        } catch (error) {

          console.error(
            "ZYLO profile update error:",
            error
          );

          showError(
            errorMessage(error)
          );
        }
      }
    );
}


/* =========================================================
   CREATOR PROFILE CLICK CAPTURE
   ========================================================= */

document.addEventListener(
  "click",
  event => {

    const button =
      event.target.closest?.(
        ".profile-action"
      );

    if (!button) return;

    const page =
      button.closest(
        ".video-page"
      );

    if (!page) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    openCreatorProfileFromPage(
      page
    );

  },
  true
);


/* =========================================================
   BOTTOM PROFILE
   ========================================================= */

window.addEventListener(
  "zylo:openprofile",
  event => {

    event?.preventDefault?.();

    openMyProfile();

  }
);


document.addEventListener(
  "click",
  event => {

    const button =
      event.target.closest?.(
        ".bottom-nav .nav-item[data-nav='profile']"
      );

    if (!button) return;

    event.preventDefault();
    event.stopPropagation();

    openMyProfile();

  },
  true
);


/* =========================================================
   AUTH STATE
   ========================================================= */

onAuthStateChanged(
  auth,
  async user => {

    currentUser =
      user || null;

    if (user) {

      try {

        const existing =
          await getProfile(
            user.uid
          );

        await saveProfile(
          user,
          {
            name:
              existing?.name ||
              user.displayName ||
              "ZYLO User",

            username:
              existing?.username ||
              normalizeUsername(
                user.displayName ||
                "user"
              ),

            bio:
              existing?.bio ||
              "",

            photoURL:
              existing?.photoURL ||
              user.photoURL ||
              "",

            followers:
              existing?.followers ||
              0,

            following:
              existing?.following ||
              0,

            likes:
              existing?.likes ||
              0
          }
        );

        localStorage.setItem(
          "zylo_uid",
          user.uid
        );

        localStorage.setItem(
          "zylo_username",
          normalizeUsername(
            existing?.username ||
            user.displayName ||
            "user"
          )
        );

      } catch (error) {

        console.warn(
          "ZYLO profile sync error:",
          error
        );
      }

    } else {

      localStorage.removeItem(
        "zylo_uid"
      );

      localStorage.removeItem(
        "zylo_username"
      );

      saveFollowingUIDs([]);
    }


    window.ZYLOAuth = {

      openLogin: () =>
        openAuth("login"),

      openRegister: () =>
        openAuth("register"),

      openMyProfile,

      openCreatorProfile,

      openCreatorProfileFromPage,

      openEditProfile,

      logout: () =>
        signOut(auth),

      getCurrentUser: () =>
        currentUser,

      currentUser,

      getProfile,

      getFreshProfile,

      isFollowing,

      followUser,

      unfollowUser,

      getFollowersCount,

      getFollowingCount
    };


    window.dispatchEvent(
      new CustomEvent(
        "zylo:authready"
      )
    );
  }
);


/* =========================================================
   READY EVENT
   ========================================================= */

injectZYLOStyles();

window.dispatchEvent(
  new CustomEvent(
    "zylo:authjsready"
  )
);
