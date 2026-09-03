/* =========================================================
   ZYLO - FIREBASE ACCOUNT SYSTEM
   Email / Password Authentication
   Profile + Edit Profile + Logout
   ========================================================= */

import {
  initializeApp
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";

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
  setDoc,
  getDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";


/* =========================================================
   1. YOUR FIREBASE CONFIG
   ========================================================= */

const firebaseConfig = {

  apiKey: "PASTE_YOUR_API_KEY_HERE",

  authDomain: "PASTE_YOUR_PROJECT_ID.firebaseapp.com",

  projectId: "PASTE_YOUR_PROJECT_ID",

  storageBucket: "PASTE_YOUR_STORAGE_BUCKET",

  messagingSenderId: "PASTE_YOUR_MESSAGING_SENDER_ID",

  appId: "PASTE_YOUR_APP_ID"

};


/* =========================================================
   2. INITIALIZE FIREBASE
   ========================================================= */

const firebaseApp = initializeApp(firebaseConfig);

const auth = getAuth(firebaseApp);

const db = getFirestore(firebaseApp);


/* =========================================================
   3. CURRENT USER
   ========================================================= */

let currentUser = null;


/* =========================================================
   4. BASIC HELPERS
   ========================================================= */

function escapeHTML(value) {

  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

}


function showAuthMessage(message, type = "error") {

  let box = document.getElementById("zylo-auth-message");

  if (!box) return;

  box.textContent = message;

  box.className =
    "zylo-auth-message " +
    (type === "success" ? "success" : "error");

}


function closeAuthModal() {

  const modal = document.getElementById("zylo-auth-modal");

  if (modal) {

    modal.remove();

  }

}


function closeEditModal() {

  const modal = document.getElementById("zylo-edit-modal");

  if (modal) {

    modal.remove();

  }

}


/* =========================================================
   5. AUTH CSS
   ========================================================= */

function installAuthCSS() {

  if (document.getElementById("zylo-auth-css")) return;

  const style = document.createElement("style");

  style.id = "zylo-auth-css";

  style.textContent = `

    .zylo-auth-overlay {

      position: fixed;
      inset: 0;
      z-index: 999999;

      background: rgba(0,0,0,.78);

      display: flex;
      align-items: center;
      justify-content: center;

      padding: 20px;

    }


    .zylo-auth-box {

      width: min(100%, 430px);

      max-height: 90vh;

      overflow-y: auto;

      background: #111;

      color: #fff;

      border-radius: 24px;

      padding: 28px 22px 24px;

      box-sizing: border-box;

      box-shadow: 0 20px 80px rgba(0,0,0,.6);

      position: relative;

    }


    .zylo-auth-close {

      position: absolute;

      right: 20px;

      top: 15px;

      border: 0;

      background: transparent;

      color: #fff;

      font-size: 32px;

      cursor: pointer;

      line-height: 1;

    }


    .zylo-auth-title {

      text-align: center;

      font-size: 30px;

      font-weight: 700;

      margin: 10px 0 6px;

    }


    .zylo-auth-subtitle {

      text-align: center;

      color: #aaa;

      margin-bottom: 24px;

    }


    .zylo-auth-z {

      width: 76px;

      height: 76px;

      border-radius: 50%;

      background: #242424;

      display: flex;

      align-items: center;

      justify-content: center;

      font-size: 48px;

      font-weight: 700;

      margin: 5px auto 18px;

    }


    .zylo-auth-field {

      margin-bottom: 15px;

    }


    .zylo-auth-field label {

      display: block;

      margin-bottom: 7px;

      font-size: 15px;

      color: #ddd;

    }


    .zylo-auth-field input {

      width: 100%;

      box-sizing: border-box;

      padding: 15px;

      border: 0;

      outline: 0;

      border-radius: 13px;

      background: #fff;

      color: #111;

      font-size: 16px;

    }


    .zylo-auth-main {

      width: 100%;

      border: 0;

      border-radius: 14px;

      padding: 15px;

      margin-top: 8px;

      font-size: 17px;

      font-weight: 700;

      cursor: pointer;

      background: #fff;

      color: #111;

    }


    .zylo-auth-secondary {

      width: 100%;

      border: 1px solid #555;

      border-radius: 14px;

      padding: 14px;

      margin-top: 12px;

      font-size: 16px;

      cursor: pointer;

      background: transparent;

      color: #fff;

    }


    .zylo-auth-switch {

      text-align: center;

      margin-top: 18px;

      color: #aaa;

    }


    .zylo-auth-switch button {

      border: 0;

      background: transparent;

      color: #fff;

      font-weight: 700;

      cursor: pointer;

      font-size: 15px;

    }


    .zylo-auth-message {

      min-height: 22px;

      text-align: center;

      margin: 8px 0 12px;

      font-size: 14px;

    }


    .zylo-auth-message.error {

      color: #ff6b6b;

    }


    .zylo-auth-message.success {

      color: #7dff9b;

    }


    .zylo-user-panel {

      position: fixed;

      inset: 0;

      z-index: 999999;

      background: #111;

      color: #fff;

      overflow-y: auto;

      padding: 25px 20px 100px;

      box-sizing: border-box;

    }


    .zylo-user-top {

      display: flex;

      align-items: center;

      justify-content: space-between;

      margin-bottom: 30px;

    }


    .zylo-user-top h2 {

      margin: 0;

      font-size: 28px;

    }


    .zylo-user-close {

      border: 0;

      background: transparent;

      color: #fff;

      font-size: 34px;

      cursor: pointer;

    }


    .zylo-user-avatar {

      width: 105px;

      height: 105px;

      border-radius: 50%;

      background: #242424;

      display: flex;

      align-items: center;

      justify-content: center;

      font-size: 64px;

      font-weight: 700;

      margin: 20px auto;

    }


    .zylo-user-name {

      text-align: center;

      font-size: 28px;

      font-weight: 700;

    }


    .zylo-user-username {

      text-align: center;

      color: #aaa;

      margin-top: 6px;

      font-size: 17px;

    }


    .zylo-user-bio {

      text-align: center;

      margin: 16px auto 25px;

      max-width: 500px;

      color: #ddd;

      font-size: 16px;

    }


    .zylo-user-actions {

      display: flex;

      gap: 10px;

      margin: 20px auto;

      max-width: 500px;

    }


    .zylo-user-actions button {

      flex: 1;

      padding: 14px;

      border-radius: 13px;

      border: 0;

      background: #fff;

      color: #111;

      font-size: 16px;

      font-weight: 700;

      cursor: pointer;

    }


    .zylo-user-actions .logout {

      background: #2b2b2b;

      color: #fff;

    }


    .zylo-account-note {

      text-align: center;

      color: #888;

      margin-top: 25px;

      font-size: 14px;

    }

  `;

  document.head.appendChild(style);

}


/* =========================================================
   6. LOGIN / REGISTER MODAL
   ========================================================= */

function openAuthModal(mode = "login") {

  closeAuthModal();

  installAuthCSS();

  const modal = document.createElement("div");

  modal.id = "zylo-auth-modal";

  modal.className = "zylo-auth-overlay";

  modal.innerHTML = `

    <div class="zylo-auth-box">

      <button
        class="zylo-auth-close"
        id="zylo-auth-close"
        aria-label="Close"
      >×</button>


      <div class="zylo-auth-z">Z</div>


      <div class="zylo-auth-title">
        ${mode === "login" ? "Welcome Back" : "Create Account"}
      </div>


      <div class="zylo-auth-subtitle">
        ${mode === "login"
          ? "Login to your ZYLO account"
          : "Join ZYLO • Create • Connect • Grow"}
      </div>


      <div id="zylo-auth-message"
           class="zylo-auth-message"></div>


      ${
        mode === "register"
        ? `

          <div class="zylo-auth-field">

            <label>Name</label>

            <input
              id="zylo-register-name"
              type="text"
              placeholder="Your name"
              maxlength="50"
              autocomplete="name"
            >

          </div>


          <div class="zylo-auth-field">

            <label>Username</label>

            <input
              id="zylo-register-username"
              type="text"
              placeholder="@username"
              maxlength="30"
              autocomplete="username"
            >

          </div>

        `
        : ""
      }


      <div class="zylo-auth-field">

        <label>Email</label>

        <input
          id="zylo-auth-email"
          type="email"
          placeholder="you@example.com"
          autocomplete="email"
        >

      </div>


      <div class="zylo-auth-field">

        <label>Password</label>

        <input
          id="zylo-auth-password"
          type="password"
          placeholder="Minimum 6 characters"
          autocomplete="${mode === "login"
            ? "current-password"
            : "new-password"}"
        >

      </div>


      ${
        mode === "register"
        ? `

          <div class="zylo-auth-field">

            <label>Confirm Password</label>

            <input
              id="zylo-register-confirm"
              type="password"
              placeholder="Confirm password"
              autocomplete="new-password"
            >

          </div>

        `
        : ""
      }


      <button
        id="zylo-auth-submit"
        class="zylo-auth-main"
      >
        ${mode === "login" ? "Login" : "Create Account"}
      </button>


      <div class="zylo-auth-switch">

        ${
          mode === "login"
          ? `
            Don't have an account?
            <button id="zylo-show-register">
              Create Account
            </button>
          `
          : `
            Already have an account?
            <button id="zylo-show-login">
              Login
            </button>
          `
        }

      </div>

    </div>

  `;


  document.body.appendChild(modal);


  document
    .getElementById("zylo-auth-close")
    .addEventListener("click", closeAuthModal);


  const submitButton =
    document.getElementById("zylo-auth-submit");


  if (mode === "login") {

    submitButton.addEventListener(
      "click",
      handleLogin
    );


    document
      .getElementById("zylo-show-register")
      .addEventListener("click", () => {

        openAuthModal("register");

      });

  } else {

    submitButton.addEventListener(
      "click",
      handleRegister
    );


    document
      .getElementById("zylo-show-login")
      .addEventListener("click", () => {

        openAuthModal("login");

      });

  }

}


/* =========================================================
   7. REGISTER
   ========================================================= */

async function handleRegister() {

  const name =
    document
      .getElementById("zylo-register-name")
      ?.value
      .trim();


  let username =
    document
      .getElementById("zylo-register-username")
      ?.value
      .trim();


  const email =
    document
      .getElementById("zylo-auth-email")
      ?.value
      .trim();


  const password =
    document
      .getElementById("zylo-auth-password")
      ?.value;


  const confirm =
    document
      .getElementById("zylo-register-confirm")
      ?.value;


  if (!name) {

    showAuthMessage("Please enter your name.");

    return;

  }


  if (!username) {

    showAuthMessage("Please enter a username.");

    return;

  }


  username =
    username
      .replace(/^@+/, "")
      .replace(/\s+/g, "_")
      .toLowerCase();


  if (!/^[a-z0-9_.]{3,30}$/.test(username)) {

    showAuthMessage(
      "Username must be 3-30 characters."
    );

    return;

  }


  if (!email) {

    showAuthMessage("Please enter your email.");

    return;

  }


  if (password.length < 6) {

    showAuthMessage(
      "Password must be at least 6 characters."
    );

    return;

  }


  if (password !== confirm) {

    showAuthMessage(
      "Passwords do not match."
    );

    return;

  }


  const submitButton =
    document.getElementById("zylo-auth-submit");

  submitButton.disabled = true;

  submitButton.textContent = "Creating...";


  try {

    /*
      Create Firebase Authentication account.
    */

    const credential =
      await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );


    const user = credential.user;


    /*
      Save display name.
    */

    await updateProfile(user, {

      displayName: name

    });


    /*
      Save ZYLO profile in Firestore.
    */

    await setDoc(
      doc(db, "users", user.uid),
      {

        uid: user.uid,

        name: name,

        username: username,

        email: email,

        bio: "Create • Connect • Grow",

        followers: 0,

        following: 0,

        likes: 0,

        createdAt: serverTimestamp(),

        updatedAt: serverTimestamp()

      },
      {
        merge: true
      }
    );


    showAuthMessage(
      "Account created successfully!",
      "success"
    );


    setTimeout(() => {

      closeAuthModal();

      refreshZYLOProfile();

    }, 900);


  } catch (error) {

    console.error(error);

    showAuthMessage(
      firebaseErrorMessage(error)
    );

    submitButton.disabled = false;

    submitButton.textContent = "Create Account";

  }

}


/* =========================================================
   8. LOGIN
   ========================================================= */

async function handleLogin() {

  const email =
    document
      .getElementById("zylo-auth-email")
      ?.value
      .trim();


  const password =
    document
      .getElementById("zylo-auth-password")
      ?.value;


  if (!email || !password) {

    showAuthMessage(
      "Please enter email and password."
    );

    return;

  }


  const submitButton =
    document.getElementById("zylo-auth-submit");

  submitButton.disabled = true;

  submitButton.textContent = "Logging in...";


  try {

    await signInWithEmailAndPassword(
      auth,
      email,
      password
    );


    showAuthMessage(
      "Login successful!",
      "success"
    );


    setTimeout(() => {

      closeAuthModal();

      refreshZYLOProfile();

    }, 700);


  } catch (error) {

    console.error(error);

    showAuthMessage(
      firebaseErrorMessage(error)
    );

    submitButton.disabled = false;

    submitButton.textContent = "Login";

  }

}


/* =========================================================
   9. FIREBASE ERROR MESSAGE
   ========================================================= */

function firebaseErrorMessage(error) {

  const code = error?.code || "";


  switch (code) {

    case "auth/email-already-in-use":

      return "This email already has an account.";


    case "auth/invalid-email":

      return "Please enter a valid email.";


    case "auth/weak-password":

      return "Password is too weak. Use at least 6 characters.";


    case "auth/invalid-credential":

      return "Email or password is incorrect.";


    case "auth/user-not-found":

      return "No account found with this email.";


    case "auth/wrong-password":

      return "Incorrect password.";


    case "auth/too-many-requests":

      return "Too many attempts. Please try again later.";


    case "auth/network-request-failed":

      return "Network error. Check your internet connection.";


    default:

      return error?.message ||
        "Something went wrong. Please try again.";

  }

}


/* =========================================================
   10. GET USER PROFILE
   ========================================================= */

async function getZYLOUserProfile(user) {

  if (!user) return null;


  try {

    const profileRef =
      doc(db, "users", user.uid);


    const snapshot =
      await getDoc(profileRef);


    if (snapshot.exists()) {

      return snapshot.data();

    }


    return {

      uid: user.uid,

      name: user.displayName || "ZYLO User",

      username:
        user.email
          ? user.email.split("@")[0]
          : "zylo_user",

      email: user.email || "",

      bio: "Create • Connect • Grow",

      followers: 0,

      following: 0,

      likes: 0

    };

  } catch (error) {

    console.error(
      "Profile loading error:",
      error
    );


    return {

      uid: user.uid,

      name: user.displayName || "ZYLO User",

      username:
        user.email
          ? user.email.split("@")[0]
          : "zylo_user",

      email: user.email || "",

      bio: "Create • Connect • Grow",

      followers: 0,

      following: 0,

      likes: 0

    };

  }

}


/* =========================================================
   11. MY PROFILE
   ========================================================= */

async function openMyFirebaseProfile() {

  if (!currentUser) {

    openAuthModal("login");

    return;

  }


  const profile =
    await getZYLOUserProfile(currentUser);


  installAuthCSS();

  closeEditModal();


  const old =
    document.getElementById("zylo-user-profile");

  if (old) old.remove();


  const panel =
    document.createElement("div");


  panel.id = "zylo-user-profile";

  panel.className = "zylo-user-panel";


  panel.innerHTML = `

    <div class="zylo-user-top">

      <h2>My Profile</h2>

      <button
        class="zylo-user-close"
        id="zylo-my-profile-close"
      >×</button>

    </div>


    <div class="zylo-user-avatar">
      Z
    </div>


    <div class="zylo-user-name">
      ${escapeHTML(profile?.name || "ZYLO User")}
    </div>


    <div class="zylo-user-username">
      @${escapeHTML(profile?.username || "zylo_user")}
    </div>


    <div class="zylo-user-bio">
      ${escapeHTML(
        profile?.bio || "Create • Connect • Grow"
      )}
    </div>


    <div class="zylo-user-actions">

      <button id="zylo-edit-profile-button">
        Edit Profile
      </button>

      <button
        id="zylo-logout-button"
        class="logout"
      >
        Logout
      </button>

    </div>


    <div class="zylo-account-note">

      ${escapeHTML(
        currentUser.email || ""
      )}

    </div>

  `;


  document.body.appendChild(panel);


  document
    .getElementById("zylo-my-profile-close")
    .addEventListener("click", () => {

      panel.remove();

    });


  document
    .getElementById("zylo-edit-profile-button")
    .addEventListener("click", () => {

      openEditProfile();

    });


  document
    .getElementById("zylo-logout-button")
    .addEventListener("click", logoutZYLO);

}


/* =========================================================
   12. EDIT PROFILE
   ========================================================= */

async function openEditProfile() {

  if (!currentUser) {

    openAuthModal("login");

    return;

  }


  const profile =
    await getZYLOUserProfile(currentUser);


  const old =
    document.getElementById("zylo-edit-modal");

  if (old) old.remove();


  const modal =
    document.createElement("div");


  modal.id = "zylo-edit-modal";

  modal.className = "zylo-auth-overlay";


  modal.innerHTML = `

    <div class="zylo-auth-box">

      <button
        class="zylo-auth-close"
        id="zylo-edit-close"
      >×</button>


      <div class="zylo-auth-z">
        Z
      </div>


      <div class="zylo-auth-title">
        Edit Profile
      </div>


      <div
        id="zylo-edit-message"
        class="zylo-auth-message"
      ></div>


      <div class="zylo-auth-field">

        <label>Name</label>

        <input
          id="zylo-edit-name"
          type="text"
          maxlength="50"
          value="${escapeHTML(profile?.name || "")}"
        >

      </div>


      <div class="zylo-auth-field">

        <label>Username</label>

        <input
          id="zylo-edit-username"
          type="text"
          maxlength="30"
          value="@${escapeHTML(
            profile?.username || ""
          )}"
        >

      </div>


      <div class="zylo-auth-field">

        <label>Bio</label>

        <input
          id="zylo-edit-bio"
          type="text"
          maxlength="160"
          value="${escapeHTML(
            profile?.bio ||
            "Create • Connect • Grow"
          )}"
        >

      </div>


      <button
        id="zylo-save-profile"
        class="zylo-auth-main"
      >
        Save Changes
      </button>

    </div>

  `;


  document.body.appendChild(modal);


  document
    .getElementById("zylo-edit-close")
    .addEventListener("click", closeEditModal);


  document
    .getElementById("zylo-save-profile")
    .addEventListener(
      "click",
      saveEditedProfile
    );

}


/* =========================================================
   13. SAVE EDITED PROFILE
   ========================================================= */

async function saveEditedProfile() {

  if (!currentUser) return;


  const name =
    document
      .getElementById("zylo-edit-name")
      ?.value
      .trim();


  let username =
    document
      .getElementById("zylo-edit-username")
      ?.value
      .trim();


  const bio =
    document
      .getElementById("zylo-edit-bio")
      ?.value
      .trim();


  const message =
    document.getElementById(
      "zylo-edit-message"
    );


  const button =
    document.getElementById(
      "zylo-save-profile"
    );


  if (!name) {

    message.textContent =
      "Name is required.";

    return;

  }


  username =
    username
      .replace(/^@+/, "")
      .replace(/\s+/g, "_")
      .toLowerCase();


  if (!/^[a-z0-9_.]{3,30}$/.test(username)) {

    message.textContent =
      "Username must be 3-30 characters.";

    return;

  }


  button.disabled = true;

  button.textContent = "Saving...";


  try {

    await updateProfile(
      currentUser,
      {
        displayName: name
      }
    );


    await setDoc(
      doc(db, "users", currentUser.uid),
      {

        name: name,

        username: username,

        bio:
          bio ||
          "Create • Connect • Grow",

        updatedAt:
          serverTimestamp()

      },
      {
        merge: true
      }
    );


    message.className =
      "zylo-auth-message success";

    message.textContent =
      "Profile updated successfully.";


    setTimeout(async () => {

      closeEditModal();


      const profilePanel =
        document.getElementById(
          "zylo-user-profile"
        );


      if (profilePanel) {

        profilePanel.remove();

      }


      await openMyFirebaseProfile();

      refreshZYLOProfile();

    }, 700);


  } catch (error) {

    console.error(error);

    message.className =
      "zylo-auth-message error";

    message.textContent =
      firebaseErrorMessage(error);


    button.disabled = false;

    button.textContent =
      "Save Changes";

  }

}


/* =========================================================
   14. LOGOUT
   ========================================================= */

async function logoutZYLO() {

  try {

    await signOut(auth);

    const panel =
      document.getElementById(
        "zylo-user-profile"
      );

    if (panel) panel.remove();


    refreshZYLOProfile();

    showZYLOToast(
      "Logged out successfully."
    );

  } catch (error) {

    console.error(error);

    showZYLOToast(
      "Logout failed."
    );

  }

}


/* =========================================================
   15. UPDATE ZYLO PROFILE BUTTON / ACCOUNT STATE
   ========================================================= */

function refreshZYLOProfile() {

  const buttons =
    document.querySelectorAll(
      ".profile-action"
    );


  buttons.forEach(button => {

    if (currentUser) {

      button.classList.add(
        "zylo-authenticated"
      );

      button.setAttribute(
        "title",
        "My Account"
      );

    } else {

      button.classList.remove(
        "zylo-authenticated"
      );

      button.setAttribute(
        "title",
        "Login / Create Account"
      );

    }

  });

}


/* =========================================================
   16. FIND EXISTING PROFILE BUTTONS
   ========================================================= */

function setupProfileButtons() {

  document.addEventListener(
    "click",
    event => {

      const profileButton =
        event.target.closest(
          ".profile-action"
        );


      if (!profileButton) return;


      /*
        Existing creator profile buttons
        can still work normally.

        Bottom Profile navigation will be
        handled separately below.
      */

    }
  );


  document.addEventListener(
    "click",
    event => {

      const navItem =
        event.target.closest(
          ".bottom-nav .nav-item"
        );


      if (!navItem) return;


      const text =
        navItem.textContent
          .trim()
          .toLowerCase();


      if (text.includes("profile")) {

        event.preventDefault();

        event.stopPropagation();

        openMyFirebaseProfile();

      }

    },
    true
  );

}


/* =========================================================
   17. AUTH STATE
   ========================================================= */

onAuthStateChanged(
  auth,
  async user => {

    currentUser = user || null;


    refreshZYLOProfile();


    if (currentUser) {

      console.log(
        "ZYLO logged in:",
        currentUser.uid
      );

    } else {

      console.log(
        "ZYLO guest mode"
      );

    }

  }
);


/* =========================================================
   18. TOAST
   ========================================================= */

function showZYLOToast(message) {

  let toast =
    document.getElementById(
      "zylo-account-toast"
    );


  if (!toast) {

    toast =
      document.createElement("div");

    toast.id =
      "zylo-account-toast";


    toast.style.position =
      "fixed";

    toast.style.left =
      "50%";

    toast.style.bottom =
      "90px";

    toast.style.transform =
      "translateX(-50%)";

    toast.style.zIndex =
      "1000000";

    toast.style.background =
      "#fff";

    toast.style.color =
      "#111";

    toast.style.padding =
      "12px 18px";

    toast.style.borderRadius =
      "12px";

    toast.style.fontWeight =
      "600";

    document.body.appendChild(toast);

  }


  toast.textContent = message;


  clearTimeout(
    window.__zyloToastTimer
  );


  window.__zyloToastTimer =
    setTimeout(() => {

      toast.remove();

    }, 2200);

}


/* =========================================================
   19. PUBLIC HELPERS
   ========================================================= */

window.ZYLOAuth = {

  openLogin() {

    openAuthModal("login");

  },


  openRegister() {

    openAuthModal("register");

  },


  openMyProfile() {

    openMyFirebaseProfile();

  },


  openEditProfile() {

    openEditProfile();

  },


  logout() {

    logoutZYLO();

  },


  getCurrentUser() {

    return currentUser;

  }

};


/* =========================================================
   20. START
   ========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  () => {

    installAuthCSS();

    setupProfileButtons();

    refreshZYLOProfile();

  }
);
