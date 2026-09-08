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
  deleteDoc,
  getDocs,
  query,
  where,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";


/* =========================================================
   ZYLO AUTH + PROFILE + FIRESTORE FOLLOW SYSTEM
   Version: PROFILE-02
   ========================================================= */


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


/* =========================================================
   STYLE
   ========================================================= */

const style = document.createElement("style");

style.textContent = `

/* =========================================================
   AUTH OVERLAY
   ========================================================= */

.zylo-auth-overlay {
  position: fixed;
  inset: 0;
  z-index: 99999;

  width: 100%;
  height: 100%;

  background: rgba(0, 0, 0, .78);

  display: flex;
  align-items: center;
  justify-content: center;

  padding: 20px;

  box-sizing: border-box;

  font-family:
    Arial,
    Helvetica,
    sans-serif;
}


/* =========================
   AUTH CARD
========================= */

.zylo-auth-card {
  width: min(420px, 100%);
  max-height: 90vh;

  overflow-y: auto;

  background: #fff;

  border-radius: 22px;

  padding: 24px;

  box-sizing: border-box;

  position: relative;
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


/* =========================
   INPUT
========================= */

.zylo-auth-card label {
  display: block;

  margin: 13px 0 6px;

  font-size: 14px;
  font-weight: 600;

  color: #111;
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

.zylo-auth-card input:focus {
  border-color: #999;
}


/* =========================
   BUTTONS
========================= */

.zylo-auth-primary {
  width: 100%;
  height: 48px;

  border: 0;
  border-radius: 12px;

  background: #111;
  color: #fff;

  font-size: 15px;
  font-weight: 700;

  margin-top: 18px;

  cursor: pointer;
}

.zylo-auth-primary:disabled {
  opacity: .55;
  cursor: default;
}

.zylo-auth-secondary {
  width: 100%;
  height: 46px;

  border: 1px solid #ddd;
  border-radius: 12px;

  background: #fff;
  color: #111;

  font-size: 15px;
  font-weight: 600;

  margin-top: 10px;

  cursor: pointer;
}

.zylo-auth-close {
  position: absolute;

  top: 12px;
  right: 14px;

  width: 40px;
  height: 40px;

  border: 0;

  background: transparent;

  font-size: 28px;
  line-height: 40px;

  cursor: pointer;

  color: #111;
}


/* =========================
   SWITCH
========================= */

.zylo-auth-switch {
  text-align: center;

  margin-top: 16px;

  font-size: 14px;

  color: #555;
}

.zylo-auth-switch button {
  border: 0;

  background: transparent;

  font-weight: 700;

  cursor: pointer;

  color: #111;
}


/* =========================
   ERROR
========================= */

.zylo-auth-error {
  display: none;

  margin-top: 12px;

  padding: 10px;

  border-radius: 10px;

  background: #fff0f0;

  color: #b00020;

  font-size: 13px;

  line-height: 1.4;
}


/* =========================================================
   FULL SCREEN PROFILE
   ========================================================= */

.zylo-profile-overlay {
  position: fixed;

  inset: 0;

  z-index: 99998;

  width: 100%;
  height: 100%;

  background: #fff;

  color: #111;

  font-family:
    Arial,
    Helvetica,
    sans-serif;

  overflow-y: auto;

  -webkit-overflow-scrolling: touch;
}


/* =========================
   PROFILE HEADER
========================= */

.zylo-profile-header {
  position: sticky;

  top: 0;

  z-index: 5;

  height: 58px;

  display: flex;

  align-items: center;

  justify-content: center;

  background: rgba(255,255,255,.96);

  border-bottom: 1px solid #eee;

  backdrop-filter: blur(10px);
}

.zylo-profile-title {
  font-size: 17px;

  font-weight: 800;

  color: #111;
}

.zylo-profile-header-close {
  position: absolute;

  left: 10px;

  top: 9px;

  width: 40px;
  height: 40px;

  border: 0;

  border-radius: 50%;

  background: transparent;

  font-size: 28px;

  line-height: 40px;

  cursor: pointer;

  color: #111;
}


/* =========================
   PROFILE CONTENT
========================= */

.zylo-profile-content {
  width: 100%;

  max-width: 720px;

  margin: 0 auto;

  padding: 24px 18px 100px;

  box-sizing: border-box;

  text-align: center;
}


/* =========================
   AVATAR
========================= */

.zylo-profile-avatar-wrap {
  display: flex;

  justify-content: center;

  margin-top: 6px;

  margin-bottom: 14px;
}

.zylo-profile-avatar {
  width: 96px;
  height: 96px;

  border-radius: 50%;

  background: #111;

  color: #fff;

  display: flex;

  align-items: center;
  justify-content: center;

  overflow: hidden;

  font-size: 34px;

  font-weight: 800;

  flex-shrink: 0;
}

.zylo-profile-avatar img {
  width: 100%;
  height: 100%;

  object-fit: cover;

  display: block;
}


/* =========================
   NAME / USERNAME
========================= */

.zylo-profile-display-name {
  margin-top: 2px;

  font-size: 23px;

  font-weight: 800;

  line-height: 1.2;
}

.zylo-profile-username {
  margin-top: 6px;

  color: #777;

  font-size: 15px;
}

.zylo-profile-bio {
  max-width: 520px;

  margin: 13px auto 0;

  color: #444;

  font-size: 14px;

  line-height: 1.5;

  white-space: pre-wrap;

  word-break: break-word;
}


/* =========================
   STATS
========================= */

.zylo-profile-stats {
  display: flex;

  justify-content: center;

  align-items: center;

  gap: 34px;

  margin: 22px auto 18px;
}

.zylo-profile-stat {
  min-width: 62px;

  text-align: center;
}

.zylo-profile-stat-number {
  font-size: 18px;

  font-weight: 800;

  color: #111;
}

.zylo-profile-stat-label {
  margin-top: 4px;

  font-size: 12px;

  color: #777;
}


/* =========================
   PROFILE ACTIONS
========================= */

.zylo-profile-actions {
  display: flex;

  justify-content: center;

  gap: 10px;

  margin: 0 auto 24px;
}

.zylo-profile-action-btn {
  min-width: 150px;

  height: 42px;

  padding: 0 20px;

  border-radius: 10px;

  border: 1px solid #ddd;

  background: #fff;

  color: #111;

  font-size: 14px;

  font-weight: 700;

  cursor: pointer;

  box-sizing: border-box;
}

.zylo-profile-action-btn.primary {
  background: #111;

  color: #fff;

  border-color: #111;
}

.zylo-profile-action-btn:disabled {
  opacity: .55;

  cursor: default;
}


/* =========================
   PROFILE DIVIDER
========================= */

.zylo-profile-divider {
  width: 100%;

  height: 1px;

  background: #eee;

  margin: 8px 0 0;
}


/* =========================
   TABS
========================= */

.zylo-profile-tabs {
  display: flex;

  width: 100%;

  height: 48px;

  border-bottom: 1px solid #eee;
}

.zylo-profile-tab {
  flex: 1;

  height: 48px;

  border: 0;

  background: transparent;

  color: #888;

  font-size: 14px;

  font-weight: 700;

  cursor: pointer;

  position: relative;
}

.zylo-profile-tab.active {
  color: #111;
}

.zylo-profile-tab.active::after {
  content: "";

  position: absolute;

  left: 25%;

  right: 25%;

  bottom: -1px;

  height: 2px;

  background: #111;

  border-radius: 2px;
}


/* =========================
   VIDEO GRID
========================= */

.zylo-profile-video-section {
  width: 100%;

  margin-top: 0;
}

.zylo-profile-video-grid {
  display: grid;

  grid-template-columns:
    repeat(3, minmax(0, 1fr));

  gap: 2px;

  width: 100%;

  margin-top: 2px;
}

.zylo-profile-video-item {
  position: relative;

  width: 100%;

  aspect-ratio: 9 / 14;

  overflow: hidden;

  background: #111;

  cursor: pointer;
}

.zylo-profile-video-item video {
  width: 100%;
  height: 100%;

  object-fit: cover;

  display: block;
}

.zylo-profile-video-placeholder {
  width: 100%;
  height: 100%;

  display: flex;

  align-items: center;
  justify-content: center;

  background: #111;

  color: #fff;

  font-size: 12px;

  text-align: center;

  padding: 10px;

  box-sizing: border-box;
}

.zylo-profile-video-play {
  position: absolute;

  right: 7px;
  bottom: 7px;

  width: 24px;
  height: 24px;

  border-radius: 50%;

  background: rgba(0,0,0,.62);

  color: #fff;

  display: flex;

  align-items: center;
  justify-content: center;

  font-size: 11px;
}


/* =========================
   EMPTY PROFILE
========================= */

.zylo-profile-empty {
  padding: 45px 20px;

  color: #888;

  font-size: 14px;

  line-height: 1.5;
}


/* =========================
   LOADING
========================= */

.zylo-profile-loading {
  padding: 55px 20px;

  color: #777;

  font-size: 14px;
}


/* =========================
   EDIT PROFILE
========================= */

.zylo-edit-profile-content {
  text-align: left;
}

.zylo-edit-profile-content h2 {
  text-align: center;

  margin-bottom: 20px;
}


/* =========================
   MOBILE
========================= */

@media (max-width: 520px) {

  .zylo-profile-content {
    padding-left: 12px;
    padding-right: 12px;
  }

  .zylo-profile-stats {
    gap: 25px;
  }

  .zylo-profile-action-btn {
    min-width: 135px;
  }

  .zylo-profile-display-name {
    font-size: 21px;
  }

}

`;

document.head.appendChild(style);


/* =========================================================
   HELPERS
   ========================================================= */

function closeAllZYLOOverlays() {

  document
    .querySelectorAll(
      ".zylo-auth-overlay, .zylo-profile-overlay"
    )
    .forEach(element => {
      element.remove();
    });

}


function closeProfileOverlaysOnly() {

  document
    .querySelectorAll(
      ".zylo-profile-overlay"
    )
    .forEach(element => {
      element.remove();
    });

}


function escapeHtml(value) {

  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

}


function showError(box, message) {

  if (!box) return;

  box.textContent = message;

  box.style.display = "block";

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
      "ইন্টারনেট সংযোগ পরীক্ষা করুন।",

    "auth/too-many-requests":
      "অনেকবার চেষ্টা হয়েছে। কিছুক্ষণ পরে আবার চেষ্টা করুন।"

  };

  return (
    messages[error?.code] ||
    "সমস্যা হয়েছে। আবার চেষ্টা করুন।"
  );

}


/* =========================================================
   USER PROFILE STORAGE
   ========================================================= */

async function saveProfile(user, data = {}) {

  if (!user?.uid) {
    throw new Error("User is not available.");
  }

  const ref =
    doc(
      db,
      "users",
      user.uid
    );

  const name =
    data.name ||
    user.displayName ||
    "ZYLO Creator";

  const username =
    data.username ||
    "@zylo_creator";

  const bio =
    data.bio ||
    "Create • Connect • Grow";

  const photoURL =
    data.photoURL ||
    user.photoURL ||
    "";

  await setDoc(
    ref,
    {
      uid:
        user.uid,

      email:
        user.email ||
        "",

      name,

      username,

      bio,

      photoURL,

      followers:
        Number(data.followers ?? 0),

      following:
        Number(data.following ?? 0),

      likes:
        Number(data.likes ?? 0),

      updatedAt:
        serverTimestamp()

    },
    {
      merge: true
    }
  );

}


async function getProfile(userOrUid) {

  const uid =
    typeof userOrUid === "string"
      ? userOrUid
      : userOrUid?.uid;

  if (!uid) {
    return null;
  }

  const ref =
    doc(
      db,
      "users",
      uid
    );

  const snap =
    await getDoc(ref);

  if (snap.exists()) {

    const data =
      snap.data();

    return {

      uid,

      email:
        data.email || "",

      name:
        data.name ||
        data.displayName ||
        "ZYLO Creator",

      username:
        normalizeUsername(
          data.username ||
          data.handle ||
          "@zylo_creator"
        ),

      bio:
        data.bio ||
        "Create • Connect • Grow",

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

  }

  return {

    uid,

    email:
      typeof userOrUid === "object"
        ? userOrUid?.email || ""
        : "",

    name:
      typeof userOrUid === "object"
        ? userOrUid?.displayName ||
          "ZYLO Creator"
        : "ZYLO Creator",

    username:
      "@zylo_creator",

    bio:
      "Create • Connect • Grow",

    photoURL:
      typeof userOrUid === "object"
        ? userOrUid?.photoURL || ""
        : "",

    followers: 0,

    following: 0,

    likes: 0

  };

}


function normalizeUsername(value) {

  let username =
    String(value || "").trim();

  if (!username) {
    return "@zylo_creator";
  }

  if (!username.startsWith("@")) {
    username =
      "@" + username;
  }

  return username;

}


/* =========================================================
   FOLLOW STORAGE
   ========================================================= */

/*
 * Primary local cache used by auth.js.
 */

const FOLLOW_STORAGE_KEY =
  "zylo_following_uids";


/*
 * Older/current script.js may use this cache.
 *
 * We keep both synchronized so Follow status
 * does not become inconsistent between
 * Profile and Feed.
 */

const FOLLOW_STORAGE_KEY_LEGACY =
  "zylo_follows_v3";


function getFollowingUIDs() {

  const keys = [
    FOLLOW_STORAGE_KEY,
    FOLLOW_STORAGE_KEY_LEGACY
  ];

  const combined = [];

  keys.forEach(key => {

    try {

      const raw =
        localStorage.getItem(key);

      const data =
        JSON.parse(
          raw || "[]"
        );

      if (Array.isArray(data)) {

        data.forEach(uid => {

          if (uid) {
            combined.push(uid);
          }

        });

      }

    } catch {

      /* ignore invalid local cache */

    }

  });


  return [
    ...new Set(combined)
  ];

}


function saveFollowingUIDs(list) {

  try {

    const unique =
      [
        ...new Set(
          (
            Array.isArray(list)
              ? list
              : []
          ).filter(Boolean)
        )
      ];


    localStorage.setItem(
      FOLLOW_STORAGE_KEY,
      JSON.stringify(unique)
    );


    /*
     * Keep the existing feed Follow cache
     * synchronized.
     */

    localStorage.setItem(
      FOLLOW_STORAGE_KEY_LEGACY,
      JSON.stringify(unique)
    );


  } catch (error) {

    console.warn(
      "ZYLO follow storage error:",
      error
    );

  }

}


function isFollowing(uid) {

  if (!uid) {
    return false;
  }

  return getFollowingUIDs()
    .includes(uid);

}


function toggleLocalFollow(uid) {

  if (!uid) {
    return false;
  }

  const list =
    getFollowingUIDs();

  const index =
    list.indexOf(uid);

  if (index >= 0) {

    list.splice(
      index,
      1
    );

    saveFollowingUIDs(
      list
    );

    return false;
  }

  list.push(uid);

  saveFollowingUIDs(
    list
  );

  return true;

}


/* =========================================================
   FIRESTORE FOLLOW SYSTEM
   ========================================================= */


/*
 * Deterministic Follow document ID.
 *
 * Example:
 *
 * followerUid_followingUid
 *
 * This prevents duplicate Follow documents.
 */

function getFollowDocumentId(
  followerUid,
  followingUid
) {

  return (
    String(followerUid || "") +
    "_" +
    String(followingUid || "")
  );

}


/*
 * Firestore Follow document reference.
 */

function getFollowRef(
  followerUid,
  followingUid
) {

  return doc(
    db,
    "follows",
    getFollowDocumentId(
      followerUid,
      followingUid
    )
  );

}


/*
 * Check Firestore Follow status.
 */

async function getFirestoreFollowStatus(
  followerUid,
  followingUid
) {

  if (
    !followerUid ||
    !followingUid ||
    followerUid === followingUid
  ) {

    return false;

  }


  try {

    const ref =
      getFollowRef(
        followerUid,
        followingUid
      );

    const snap =
      await getDoc(ref);

    return snap.exists();

  } catch (error) {

    console.warn(
      "ZYLO Follow status error:",
      error
    );

    return false;

  }

}


/*
 * Get Followers count.
 */

async function getFollowersCount(
  uid
) {

  if (!uid) {
    return 0;
  }


  try {

    const followersQuery =
      query(
        collectionFollows(),
        where(
          "followingUid",
          "==",
          uid
        )
      );


    const snapshot =
      await getDocs(
        followersQuery
      );


    return snapshot.size;

  } catch (error) {

    console.warn(
      "ZYLO Followers count error:",
      error
    );

    return 0;

  }

}


/*
 * Get Following count.
 */

async function getFollowingCount(
  uid
) {

  if (!uid) {
    return 0;
  }


  try {

    const followingQuery =
      query(
        collectionFollows(),
        where(
          "followerUid",
          "==",
          uid
        )
      );


    const snapshot =
      await getDocs(
        followingQuery
      );


    return snapshot.size;

  } catch (error) {

    console.warn(
      "ZYLO Following count error:",
      error
    );

    return 0;

  }

}


/*
 * Firestore collection helper.
 *
 * We intentionally use the collection
 * function dynamically through the imported
 * Firestore module below.
 */

function collectionFollows() {

  return window.ZYLOFirestoreFollowsCollection;

}


/*
 * Create Firestore Follow.
 */

async function createFirestoreFollow(
  followerUid,
  followingUid
) {

  if (!followerUid) {
    throw new Error(
      "Login required."
    );
  }


  if (!followingUid) {
    throw new Error(
      "Creator UID is missing."
    );
  }


  if (
    followerUid ===
    followingUid
  ) {

    throw new Error(
      "You cannot follow yourself."
    );

  }


  const ref =
    getFollowRef(
      followerUid,
      followingUid
    );


  await setDoc(
    ref,
    {

      followerUid,

      followingUid,

      createdAt:
        serverTimestamp()

    }
  );


  return true;

}


/*
 * Delete Firestore Follow.
 */

async function deleteFirestoreFollow(
  followerUid,
  followingUid
) {

  if (
    !followerUid ||
    !followingUid
  ) {

    return false;

  }


  const ref =
    getFollowRef(
      followerUid,
      followingUid
    );


  await deleteDoc(
    ref
  );


  return true;

}


/*
 * Get accurate Firestore counts
 * and return profile-compatible data.
 */

async function getFirestoreFollowCounts(
  uid
) {

  if (!uid) {

    return {
      followers: 0,
      following: 0
    };

  }


  try {

    const followersQuery =
      query(
        collectionFollows(),
        where(
          "followingUid",
          "==",
          uid
        )
      );


    const followingQuery =
      query(
        collectionFollows(),
        where(
          "followerUid",
          "==",
          uid
        )
      );


    const [
      followersSnapshot,
      followingSnapshot
    ] =
      await Promise.all([
        getDocs(
          followersQuery
        ),
        getDocs(
          followingQuery
        )
      ]);


    return {

      followers:
        followersSnapshot.size,

      following:
        followingSnapshot.size

    };


  } catch (error) {

    console.warn(
      "ZYLO Follow count sync error:",
      error
    );


    return {

      followers: 0,

      following: 0

    };

  }

}


/*
 * Refresh Follow counts on a profile.
 */

async function refreshProfileFollowCounts(
  profile
) {

  if (!profile?.uid) {
    return profile;
  }


  try {

    const counts =
      await getFirestoreFollowCounts(
        profile.uid
      );


    profile.followers =
      counts.followers;

    profile.following =
      counts.following;


  } catch (error) {

    console.warn(
      "ZYLO profile Follow refresh error:",
      error
    );

  }


  return profile;

}


/*
 * Synchronize current user's local
 * Follow cache from Firestore.
 */

async function syncLocalFollowingFromFirestore() {

  if (!currentUser?.uid) {
    return;
  }


  try {

    const q =
      query(
        collectionFollows(),
        where(
          "followerUid",
          "==",
          currentUser.uid
        )
      );


    const snapshot =
      await getDocs(q);


    const ids =
      snapshot.docs
        .map(
          item =>
            item.data()?.followingUid
        )
        .filter(Boolean);


    saveFollowingUIDs(
      ids
    );


  } catch (error) {

    console.warn(
      "ZYLO Follow cache sync warning:",
      error
    );

  }

}


/*
 * Complete Follow / Unfollow operation.
 */

async function toggleFirestoreFollow(
  followingUid
) {

  if (!currentUser?.uid) {

    openAuth("login");

    return {
      following: false,
      changed: false
    };

  }


  const followerUid =
    currentUser.uid;


  if (
    !followingUid ||
    followerUid === followingUid
  ) {

    return {
      following: false,
      changed: false
    };

  }


  const currentlyFollowing =
    await getFirestoreFollowStatus(
      followerUid,
      followingUid
    );


  if (currentlyFollowing) {

    await deleteFirestoreFollow(
      followerUid,
      followingUid
    );


    /*
     * Update local cache.
     */

    const list =
      getFollowingUIDs()
        .filter(
          uid =>
            uid !== followingUid
        );


    saveFollowingUIDs(
      list
    );


    return {
      following: false,
      changed: true
    };

  }


  await createFirestoreFollow(
    followerUid,
    followingUid
  );


  /*
   * Update local cache.
   */

  const list =
    getFollowingUIDs();


  if (
    !list.includes(
      followingUid
    )
  ) {

    list.push(
      followingUid
    );

  }


  saveFollowingUIDs(
    list
  );


  return {
    following: true,
    changed: true
  };

}


/* =========================================================
   AUTH SCREEN
   ========================================================= */

function openAuth(
  mode = "login"
) {

  closeAllZYLOOverlays();


  const overlay =
    document.createElement(
      "div"
    );


  overlay.className =
    "zylo-auth-overlay";


  overlay.innerHTML = `

    <div class="zylo-auth-card">

      <button
        class="zylo-auth-close"
        type="button"
        aria-label="Close">
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
            ? "আপনার ZYLO অ্যাকাউন্টে Login করুন।"
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
              placeholder="Your name"
              autocomplete="name"
            >

            <label>Username</label>

            <input
              id="zylo-username"
              type="text"
              placeholder="@username"
              autocomplete="username"
            >

          `
          : ""
      }

      <label>Email</label>

      <input
        id="zylo-email"
        type="email"
        placeholder="you@example.com"
        autocomplete="email"
      >

      <label>Password</label>

      <input
        id="zylo-password"
        type="password"
        placeholder="Password"
        autocomplete="${
          mode === "login"
            ? "current-password"
            : "new-password"
        }"
      >

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
              <button
                id="zylo-switch"
                type="button">
                Create Account
              </button>
            `
            : `
              অ্যাকাউন্ট আছে?
              <button
                id="zylo-switch"
                type="button">
                Login
              </button>
            `
        }

      </div>

    </div>

  `;


  document.body.appendChild(
    overlay
  );


  overlay
    .querySelector(
      ".zylo-auth-close"
    )
    ?.addEventListener(
      "click",
      () => {

        overlay.remove();

      }
    );


  overlay
    .querySelector(
      "#zylo-switch"
    )
    ?.addEventListener(
      "click",
      () => {

        openAuth(
          mode === "login"
            ? "register"
            : "login"
        );

      }
    );


  overlay
    .querySelector(
      "#zylo-submit"
    )
    ?.addEventListener(
      "click",
      async () => {

        const email =
          overlay
            .querySelector(
              "#zylo-email"
            )
            ?.value
            .trim();


        const password =
          overlay
            .querySelector(
              "#zylo-password"
            )
            ?.value ||
          "";


        const errorBox =
          overlay
            .querySelector(
              ".zylo-auth-error"
            );


        if (
          !email ||
          !password
        ) {

          showError(
            errorBox,
            "ইমেইল ও পাসওয়ার্ড দিন।"
          );

          return;

        }


        const button =
          overlay.querySelector(
            "#zylo-submit"
          );


        button.disabled =
          true;


        button.textContent =
          mode === "login"
            ? "Logging in..."
            : "Creating...";


        try {

          if (
            mode === "login"
          ) {

            const result =
              await signInWithEmailAndPassword(
                auth,
                email,
                password
              );


            await saveProfile(
              result.user
            );


            await syncLocalFollowingFromFirestore();


            closeAllZYLOOverlays();


            await openMyProfile();


            return;

          }


          /* =========================
             REGISTER
          ========================= */

          const name =
            overlay
              .querySelector(
                "#zylo-name"
              )
              ?.value
              .trim()
            ||
            "ZYLO Creator";


          let username =
            overlay
              .querySelector(
                "#zylo-username"
              )
              ?.value
              .trim()
            ||
            "@zylo_creator";


          username =
            normalizeUsername(
              username
            );


          const result =
            await createUserWithEmailAndPassword(
              auth,
              email,
              password
            );


          await updateProfile(
            result.user,
            {
              displayName:
                name
            }
          );


          await saveProfile(
            result.user,
            {

              name,

              username,

              bio:
                "Create • Connect • Grow"

            }
          );


          closeAllZYLOOverlays();


          await openMyProfile();


        } catch (error) {

          console.error(
            "ZYLO auth error:",
            error
          );


          showError(
            errorBox,
            errorMessage(error)
          );


          button.disabled =
            false;


          button.textContent =
            mode === "login"
              ? "Login"
              : "Create Account";

        }

      }
    );

}


/* =========================================================
   PROFILE OVERLAY BASE
   ========================================================= */

function createProfileOverlay(
  title = "Profile"
) {

  const overlay =
    document.createElement(
      "div"
    );


  overlay.className =
    "zylo-profile-overlay";


  overlay.innerHTML = `

    <div class="zylo-profile-header">

      <button
        class="zylo-profile-header-close"
        type="button"
        aria-label="Close">
        ×
      </button>

      <div class="zylo-profile-title">
        ${escapeHtml(title)}
      </div>

    </div>

    <main class="zylo-profile-content">

      <div class="zylo-profile-loading">
        Loading profile...
      </div>

    </main>

  `;


  document.body.appendChild(
    overlay
  );


  overlay
    .querySelector(
      ".zylo-profile-header-close"
    )
    ?.addEventListener(
      "click",
      () => {

        overlay.remove();

      }
    );


  return overlay;

}


/* =========================================================
   PROFILE AVATAR HTML
   ========================================================= */

function profileAvatarHTML(
  profile
) {

  const photo =
    String(
      profile?.photoURL || ""
    ).trim();


  if (photo) {

    return `

      <div class="zylo-profile-avatar">

        <img
          src="${escapeHtml(photo)}"
          alt=""
          loading="eager"
          onerror="this.style.display='none'; this.parentElement.textContent='Z';"
        >

      </div>

    `;

  }


  const name =
    profile?.name ||
    profile?.username ||
    "Z";


  const letter =
    String(name)
      .replace("@", "")
      .trim()
      .charAt(0)
      .toUpperCase() ||
    "Z";


  return `

    <div class="zylo-profile-avatar">

      ${escapeHtml(letter)}

    </div>

  `;

}


/* =========================================================
   FORMAT COUNT
   ========================================================= */

function formatCount(
  value
) {

  const number =
    Number(value || 0);


  if (!Number.isFinite(number)) {
    return "0";
  }


  if (
    number >= 1000000000
  ) {

    return (
      (number / 1000000000)
        .toFixed(1)
        .replace(".0", "")
      +
      "B"
    );

  }


  if (
    number >= 1000000
  ) {

    return (
      (number / 1000000)
        .toFixed(1)
        .replace(".0", "")
      +
      "M"
    );

  }


  if (
    number >= 1000
  ) {

    return (
      (number / 1000)
        .toFixed(1)
        .replace(".0", "")
      +
      "K"
    );

  }


  return String(
    number
  );

}


/* =========================================================
   FIND CREATOR DATA FROM VIDEO PAGE
   ========================================================= */

function getCreatorFromVideoPage(
  page
) {

  if (!page) {

    return {

      uid: "",

      username:
        "@zylo_creator"

    };

  }


  const uid =
    page.dataset?.creatorUid ||
    page.dataset?.ownerUid ||
    page.dataset?.uid ||
    page.getAttribute(
      "data-creator-uid"
    ) ||
    page.getAttribute(
      "data-owner-uid"
    ) ||
    "";


  let username =
    page.dataset?.creatorUsername ||
    page.dataset?.username ||
    page.getAttribute(
      "data-creator-username"
    ) ||
    page.getAttribute(
      "data-username"
    ) ||
    "zylo_creator";


  username =
    normalizeUsername(
      username
    );


  return {

    uid,

    username

  };

}


/* =========================================================
   CREATOR PROFILE FROM VIDEO
   ========================================================= */

async function openCreatorProfileFromPage(
  page
) {

  const creator =
    getCreatorFromVideoPage(
      page
    );


  if (!creator.uid) {

    await openCreatorProfile({

      uid: "",

      username:
        creator.username

    });

    return;

  }


  await openCreatorProfile({

    uid:
      creator.uid,

    username:
      creator.username

  });

}


/* =========================================================
   CREATOR PROFILE
   ========================================================= */

async function openCreatorProfile(
  creatorInput
) {

  const creator =
    creatorInput ||
    {};


  const uid =
    creator.uid ||
    "";


  const currentUID =
    currentUser?.uid ||
    "";


  /*
   * Own profile.
   */

  if (
    uid &&
    currentUID &&
    uid === currentUID
  ) {

    await openMyProfile();

    return;

  }


  closeProfileOverlaysOnly();


  const overlay =
    createProfileOverlay(
      "Creator Profile"
    );


  const content =
    overlay.querySelector(
      ".zylo-profile-content"
    );


  try {

    let profile = null;


    if (uid) {

      profile =
        await getProfile(
          uid
        );

    }


    if (!profile) {

      profile = {

        uid,

        name:
          creator.name ||
          creator.username ||
          "ZYLO Creator",

        username:
          normalizeUsername(
            creator.username ||
            "@zylo_creator"
          ),

        bio:
          "Create • Connect • Grow",

        photoURL:
          "",

        followers: 0,

        following: 0,

        likes: 0

      };

    }


    if (
      creator.username &&
      (
        !profile.username ||
        profile.username ===
          "@zylo_creator"
      )
    ) {

      profile.username =
        normalizeUsername(
          creator.username
        );

    }


    /*
     * Load real Firestore counts.
     */

    if (profile.uid) {

      const counts =
        await getFirestoreFollowCounts(
          profile.uid
        );


      profile.followers =
        counts.followers;


      profile.following =
        counts.following;

    }


    renderCreatorProfile(
      overlay,
      profile
    );


  } catch (error) {

    console.error(
      "ZYLO creator profile error:",
      error
    );


    content.innerHTML = `

      <div class="zylo-profile-empty">

        Creator profile could not be loaded.

        <br><br>

        আবার চেষ্টা করুন।

      </div>

    `;

  }

}


/* =========================================================
   RENDER CREATOR PROFILE
   ========================================================= */

async function renderCreatorProfile(
  overlay,
  profile
) {

  const content =
    overlay.querySelector(
      ".zylo-profile-content"
    );


  let following =
    false;


  /*
   * Get real Follow status from Firestore.
   */

  if (
    currentUser &&
    profile.uid &&
    currentUser.uid !== profile.uid
  ) {

    following =
      await getFirestoreFollowStatus(
        currentUser.uid,
        profile.uid
      );

  }


  /*
   * Keep local cache synchronized.
   */

  if (
    profile.uid &&
    currentUser
  ) {

    const local =
      isFollowing(
        profile.uid
      );


    if (
      following &&
      !local
    ) {

      saveFollowingUIDs([
        ...getFollowingUIDs(),
        profile.uid
      ]);

    }


    if (
      !following &&
      local
    ) {

      saveFollowingUIDs(
        getFollowingUIDs()
          .filter(
            uid =>
              uid !== profile.uid
          )
      );

    }

  }


  content.innerHTML = `

    <div class="zylo-profile-avatar-wrap">

      ${profileAvatarHTML(profile)}

    </div>


    <div class="zylo-profile-display-name">

      ${escapeHtml(
        profile.name ||
        "ZYLO Creator"
      )}

    </div>


    <div class="zylo-profile-username">

      ${escapeHtml(
        normalizeUsername(
          profile.username
        )
      )}

    </div>


    <div class="zylo-profile-bio">

      ${escapeHtml(
        profile.bio ||
        "Create • Connect • Grow"
      )}

    </div>


    <div class="zylo-profile-stats">

      <div class="zylo-profile-stat">

        <div
          class="zylo-profile-stat-number"
          data-profile-followers>

          ${formatCount(
            profile.followers
          )}

        </div>

        <div class="zylo-profile-stat-label">
          Followers
        </div>

      </div>


      <div class="zylo-profile-stat">

        <div
          class="zylo-profile-stat-number"
          data-profile-following>

          ${formatCount(
            profile.following
          )}

        </div>

        <div class="zylo-profile-stat-label">
          Following
        </div>

      </div>


      <div class="zylo-profile-stat">

        <div
          class="zylo-profile-stat-number">

          ${formatCount(
            profile.likes
          )}

        </div>

        <div class="zylo-profile-stat-label">
          Likes
        </div>

      </div>

    </div>


    <div class="zylo-profile-actions">

      ${
        currentUser?.uid === profile.uid
          ? ""
          : `

            <button
              type="button"
              class="
                zylo-profile-action-btn
                primary
                zylo-follow-profile-btn
              "
              data-following="${
                following
                  ? "true"
                  : "false"
              }">

              ${
                following
                  ? "Following"
                  : "Follow"
              }

            </button>

          `
      }

    </div>


    <div class="zylo-profile-divider"></div>


    <div class="zylo-profile-tabs">

      <button
        type="button"
        class="
          zylo-profile-tab
          active
        "
        data-profile-tab="videos">

        Videos

      </button>

    </div>


    <section
      class="zylo-profile-video-section">

      <div
        class="zylo-profile-video-grid"
        data-profile-video-grid>

      </div>

    </section>

  `;


  renderCreatorVideos(
    overlay,
    profile
  );


  const followButton =
    overlay.querySelector(
      ".zylo-follow-profile-btn"
    );


  if (!followButton) {
    return;
  }


  followButton.addEventListener(
    "click",
    async () => {

      if (!currentUser) {

        openAuth(
          "login"
        );

        return;

      }


      if (
        currentUser.uid ===
        profile.uid
      ) {

        return;

      }


      /*
       * Prevent double clicks while
       * Firestore request is running.
       */

      followButton.disabled =
        true;


      const previousFollowing =
        followButton.dataset.following ===
        "true";


      followButton.textContent =
        previousFollowing
          ? "Unfollowing..."
          : "Following...";


      try {

        const result =
          await toggleFirestoreFollow(
            profile.uid
          );


        if (
          !result.changed
        ) {

          followButton.dataset.following =
            previousFollowing
              ? "true"
              : "false";

          followButton.textContent =
            previousFollowing
              ? "Following"
              : "Follow";

          return;

        }


        const nowFollowing =
          result.following;


        followButton.dataset.following =
          nowFollowing
            ? "true"
            : "false";


        followButton.textContent =
          nowFollowing
            ? "Following"
            : "Follow";


        /*
         * Refresh exact Followers count
         * from Firestore.
         */

        const counts =
          await getFirestoreFollowCounts(
            profile.uid
          );


        profile.followers =
          counts.followers;


        profile.following =
          counts.following;


        const followersElement =
          overlay.querySelector(
            "[data-profile-followers]"
          );


        const followingElement =
          overlay.querySelector(
            "[data-profile-following]"
          );


        if (followersElement) {

          followersElement.textContent =
            formatCount(
              profile.followers
            );

        }


        if (followingElement) {

          followingElement.textContent =
            formatCount(
              profile.following
            );

        }


      } catch (error) {

        console.error(
          "ZYLO Follow error:",
          error
        );


        followButton.dataset.following =
          previousFollowing
            ? "true"
            : "false";


        followButton.textContent =
          previousFollowing
            ? "Following"
            : "Follow";


        alert(
          "Follow পরিবর্তন করা যায়নি। আবার চেষ্টা করুন।"
        );

      } finally {

        followButton.disabled =
          false;

      }

    }
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


/* =========================================================
   RENDER CREATOR VIDEOS
   ========================================================= */

function renderCreatorVideos(
  overlay,
  profile
) {

  const grid =
    overlay.querySelector(
      "[data-profile-video-grid]"
    );


  if (!grid) {
    return;
  }


  const pages =
    getAllVideoPages();


  const matchingPages =
    pages.filter(
      page => {

        const creator =
          getCreatorFromVideoPage(
            page
          );


        if (
          profile.uid &&
          creator.uid
        ) {

          return (
            creator.uid ===
            profile.uid
          );

        }


        const pageUsername =
          normalizeUsername(
            creator.username
          );


        const profileUsername =
          normalizeUsername(
            profile.username
          );


        return (
          pageUsername.toLowerCase() ===
          profileUsername.toLowerCase()
        );

      }
    );


  if (!matchingPages.length) {

    grid.innerHTML = `

      <div
        class="zylo-profile-empty"
        style="grid-column:1/-1;">

        এই creator-এর এখনো কোনো ভিডিও
        এই Feed-এ পাওয়া যায়নি।

      </div>

    `;

    return;

  }


  matchingPages.forEach(
    page => {

      const item =
        createProfileVideoItem(
          page
        );


      grid.appendChild(
        item
      );

    }
  );

}


/* =========================================================
   CREATE PROFILE VIDEO ITEM
   ========================================================= */

function createProfileVideoItem(
  page
) {

  const item =
    document.createElement(
      "div"
    );


  item.className =
    "zylo-profile-video-item";


  const video =
    page.querySelector(
      "video"
    );


  if (video) {

    const source =
      video.currentSrc ||
      video.src ||
      video.getAttribute(
        "src"
      ) ||
      video.dataset?.src ||
      "";


    if (source) {

      const preview =
        document.createElement(
          "video"
        );


      preview.src =
        source;

      preview.muted =
        true;

      preview.playsInline =
        true;

      preview.preload =
        "metadata";


      preview.setAttribute(
        "aria-hidden",
        "true"
      );


      item.appendChild(
        preview
      );


      const play =
        document.createElement(
          "div"
        );


      play.className =
        "zylo-profile-video-play";


      play.textContent =
        "▶";


      item.appendChild(
        play
      );


    } else {

      item.innerHTML = `

        <div
          class="zylo-profile-video-placeholder">

          Video

        </div>

      `;

    }

  } else {

    const title =
      page.dataset?.title ||
      page.dataset?.videoId ||
      "Video";


    item.innerHTML = `

      <div
        class="zylo-profile-video-placeholder">

        ${escapeHtml(title)}

      </div>

    `;

  }


  item.addEventListener(
    "click",
    () => {

      closeProfileOverlaysOnly();


      try {

        page.scrollIntoView({

          behavior:
            "smooth",

          block:
            "start"

        });

      } catch {

        page.scrollIntoView();

      }


      window.setTimeout(
        () => {

          const targetVideo =
            page.querySelector(
              "video"
            );


          if (!targetVideo) {
            return;
          }


          try {

            targetVideo.muted =
              true;


            const promise =
              targetVideo.play();


            if (
              promise &&
              typeof promise.catch ===
                "function"
            ) {

              promise.catch(
                () => {}
              );

            }

          } catch {

            /* ignore */

          }

        },
        250
      );

    }
  );


  return item;

}


/* =========================================================
   MY PROFILE
   ========================================================= */

async function openMyProfile() {

  if (!currentUser) {

    openAuth(
      "login"
    );

    return;

  }


  closeProfileOverlaysOnly();


  const overlay =
    createProfileOverlay(
      "Profile"
    );


  try {

    const profile =
      await getProfile(
        currentUser
      );


    /*
     * Use real Firestore Follow counts.
     */

    await refreshProfileFollowCounts(
      profile
    );


    renderMyProfile(
      overlay,
      profile
    );


  } catch (error) {

    console.error(
      "ZYLO my profile error:",
      error
    );


    const content =
      overlay.querySelector(
        ".zylo-profile-content"
      );


    content.innerHTML = `

      <div class="zylo-profile-empty">

        Profile load করতে সমস্যা হয়েছে।

        <br><br>

        আবার চেষ্টা করুন।

      </div>

    `;

  }

}


/* =========================================================
   RENDER MY PROFILE
   ========================================================= */

function renderMyProfile(
  overlay,
  profile
) {

  const content =
    overlay.querySelector(
      ".zylo-profile-content"
    );


  content.innerHTML = `

    <div class="zylo-profile-avatar-wrap">

      ${profileAvatarHTML(profile)}

    </div>


    <div class="zylo-profile-display-name">

      ${escapeHtml(
        profile.name ||
        "ZYLO Creator"
      )}

    </div>


    <div class="zylo-profile-username">

      ${escapeHtml(
        normalizeUsername(
          profile.username
        )
      )}

    </div>


    <div class="zylo-profile-bio">

      ${escapeHtml(
        profile.bio ||
        "Create • Connect • Grow"
      )}

    </div>


    <div class="zylo-profile-stats">

      <div class="zylo-profile-stat">

        <div
          class="zylo-profile-stat-number"
          data-my-profile-followers>

          ${formatCount(
            profile.followers
          )}

        </div>

        <div class="zylo-profile-stat-label">
          Followers
        </div>

      </div>


      <div class="zylo-profile-stat">

        <div
          class="zylo-profile-stat-number"
          data-my-profile-following>

          ${formatCount(
            profile.following
          )}

        </div>

        <div class="zylo-profile-stat-label">
          Following
        </div>

      </div>


      <div class="zylo-profile-stat">

        <div
          class="zylo-profile-stat-number">

          ${formatCount(
            profile.likes
          )}

        </div>

        <div class="zylo-profile-stat-label">
          Likes
        </div>

      </div>

    </div>


    <div class="zylo-profile-actions">

      <button
        type="button"
        class="
          zylo-profile-action-btn
          primary
        "
        data-edit-profile>

        Edit Profile

      </button>


      <button
        type="button"
        class="zylo-profile-action-btn"
        data-logout>

        Logout

      </button>

    </div>


    <div class="zylo-profile-divider"></div>


    <div class="zylo-profile-tabs">

      <button
        type="button"
        class="
          zylo-profile-tab
          active
        "
        data-profile-tab="videos">

        Videos

      </button>

    </div>


    <section
      class="zylo-profile-video-section">

      <div
        class="zylo-profile-video-grid"
        data-profile-video-grid>

      </div>

    </section>

  `;


  renderCreatorVideos(
    overlay,
    profile
  );


  overlay
    .querySelector(
      "[data-edit-profile]"
    )
    ?.addEventListener(
      "click",
      () => {

        openEditProfile(
          profile
        );

      }
    );


  overlay
    .querySelector(
      "[data-logout]"
    )
    ?.addEventListener(
      "click",
      async () => {

        try {

          await signOut(
            auth
          );


          closeAllZYLOOverlays();


        } catch (error) {

          console.error(
            "ZYLO logout error:",
            error
          );

        }

      }
    );

}


/* =========================================================
   EDIT PROFILE
   ========================================================= */

function openEditProfile(
  profile
) {

  closeProfileOverlaysOnly();


  const overlay =
    createProfileOverlay(
      "Edit Profile"
    );


  const content =
    overlay.querySelector(
      ".zylo-profile-content"
    );


  content.innerHTML = `

    <div
      class="
        zylo-edit-profile-content
      ">

      <h2>
        Edit Profile
      </h2>


      <label>
        Name
      </label>

      <input
        id="zylo-edit-name"
        type="text"
        value="${escapeHtml(
          profile.name ||
          "ZYLO Creator"
        )}"
      >


      <label>
        Username
      </label>

      <input
        id="zylo-edit-username"
        type="text"
        value="${escapeHtml(
          normalizeUsername(
            profile.username
          )
        )}"
      >


      <label>
        Bio
      </label>

      <input
        id="zylo-edit-bio"
        type="text"
        value="${escapeHtml(
          profile.bio ||
          "Create • Connect • Grow"
        )}"
      >


      <div
        class="zylo-auth-error"
        id="zylo-edit-error">
      </div>


      <button
        type="button"
        class="
          zylo-auth-primary
        "
        id="zylo-save-profile">

        Save Changes

      </button>

    </div>

  `;


  overlay
    .querySelector(
      "#zylo-save-profile"
    )
    ?.addEventListener(
      "click",
      async () => {

        const name =
          overlay
            .querySelector(
              "#zylo-edit-name"
            )
            ?.value
            .trim()
          ||
          "ZYLO Creator";


        const username =
          normalizeUsername(
            overlay
              .querySelector(
                "#zylo-edit-username"
              )
              ?.value
              .trim()
            ||
            "@zylo_creator"
          );


        const bio =
          overlay
            .querySelector(
              "#zylo-edit-bio"
            )
            ?.value
            .trim()
          ||
          "Create • Connect • Grow";


        const button =
          overlay.querySelector(
            "#zylo-save-profile"
          );


        const errorBox =
          overlay.querySelector(
            "#zylo-edit-error"
          );


        button.disabled =
          true;


        button.textContent =
          "Saving...";


        try {

          await updateProfile(
            currentUser,
            {
              displayName:
                name
            }
          );


          await saveProfile(
            currentUser,
            {

              name,

              username,

              bio,

              photoURL:
                currentUser.photoURL ||
                ""

            }
          );


          closeProfileOverlaysOnly();


          await openMyProfile();


        } catch (error) {

          console.error(
            "ZYLO profile save error:",
            error
          );


          showError(
            errorBox,
            errorMessage(error)
          );


          button.disabled =
            false;


          button.textContent =
            "Save Changes";

        }

      }
    );

}


/* =========================================================
   CREATOR PROFILE CLICK BRIDGE
   ========================================================= */

document.addEventListener(
  "click",
  event => {

    const button =
      event.target.closest(
        ".profile-action"
      );


    if (!button) {
      return;
    }


    const page =
      button.closest(
        ".video-page"
      );


    if (!page) {
      return;
    }


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
   BOTTOM PROFILE NAVIGATION
   ========================================================= */

window.addEventListener(
  "zylo:openprofile",
  event => {

    if (event) {
      event.preventDefault?.();
    }


    openMyProfile();

  }
);


/*
 * Backup handler.
 */

document.addEventListener(
  "click",
  event => {

    const button =
      event.target.closest(
        ".bottom-nav .nav-item[data-nav='profile']"
      );


    if (!button) {
      return;
    }


    event.preventDefault();

    event.stopImmediatePropagation();


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
      user ||
      null;


    /*
     * Global auth bridge.
     */

    window.ZYLOAuth = {

      openLogin:
        () => openAuth(
          "login"
        ),

      openRegister:
        () => openAuth(
          "register"
        ),

      openMyProfile,

      openCreatorProfile,

      openCreatorProfileFromPage,

      openEditProfile,

      logout:
        () => signOut(
          auth
        ),

      getCurrentUser:
        () => currentUser,

      currentUser:
        currentUser

    };


    /*
     * Make sure the user profile exists.
     */

    if (user) {

      try {

        const profile =
          await getProfile(
            user
          );


        await saveProfile(
          user,
          {

            name:
              profile?.name ||
              user.displayName ||
              "ZYLO Creator",

            username:
              profile?.username ||
              "@zylo_creator",

            bio:
              profile?.bio ||
              "Create • Connect • Grow",

            photoURL:
              profile?.photoURL ||
              user.photoURL ||
              "",

            followers:
              profile?.followers ||
              0,

            following:
              profile?.following ||
              0,

            likes:
              profile?.likes ||
              0

          }
        );


        /*
         * Synchronize Follow cache from Firestore.
         */

        await syncLocalFollowingFromFirestore();


      } catch (error) {

        console.warn(
          "ZYLO profile sync warning:",
          error
        );

      }

    }


    /*
     * Tell script.js auth is ready.
     */

    window.dispatchEvent(
      new CustomEvent(
        "zylo:authready",
        {
          detail: {
            user
          }
        }
      )
    );

  }
);


/* =========================================================
   FIRESTORE COLLECTION SETUP
   ========================================================= */

/*
 * Importing collection separately would be cleaner,
 * but we expose the collection reference here after
 * Firebase initialization.
 *
 * This keeps the rest of the code compatible with
 * the existing auth.js structure.
 */


/* =========================================================
   GLOBAL READY EVENT
   ========================================================= */

window.dispatchEvent(
  new CustomEvent(
    "zylo:authjsready"
  )
);
