import {
  signInWithGoogle,
  signInWithEmail,
  signUpWithEmail,
  getSession,
  onAuthStateChange
} from './src/lib/auth.js';
import { isSupabaseConfigured } from './src/lib/supabase.js';

const loginTab = document.getElementById("loginTab");
const signupTab = document.getElementById("signupTab");
const bottomSwitch = document.getElementById("bottomSwitch");
const modeSwitch = document.querySelector(".mode-switch");
const signupOnly = document.querySelectorAll(".signup-only");

const heading = document.getElementById("heading");
const subheading = document.getElementById("subheading");
const googleAuthBtn = document.getElementById("googleAuthBtn");
const googleBtnLabel = document.getElementById("googleBtnLabel");
const submitBtn = document.getElementById("submitBtn");
const bottomPrompt = document.getElementById("bottomPrompt");

const authForm = document.getElementById("authForm");
const password = document.getElementById("password");
const confirmPassword = document.getElementById("confirmPassword");
const showPassword = document.getElementById("showPassword");
const forgotBtn = document.getElementById("forgotBtn");
const toast = document.getElementById("toast");

let mode = "login";

function showToast(message) {
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 3500);
}

// Check for OAuth error in URL hash or query string
function checkUrlAuthStatus() {
  const urlParams = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(window.location.hash.substring(1));

  const error = urlParams.get("error") || hashParams.get("error");
  const errorDescription = urlParams.get("error_description") || hashParams.get("error_description");

  if (error || errorDescription) {
    const msg = errorDescription || error;
    showToast(`Google Auth: ${decodeURIComponent(msg.replace(/\+/g, " "))}`);
    window.history.replaceState({}, document.title, window.location.pathname);
    return true;
  }

  const isAuthCallback = window.location.search.includes("code=") || window.location.hash.includes("access_token=");
  if (isAuthCallback) {
    showToast("Completing sign in...");
  }
  return false;
}

// Check if user is already authenticated on startup
async function checkInitialSession() {
  checkUrlAuthStatus();

  try {
    const session = await getSession();
    if (session?.user) {
      window.location.replace("/dashboard/index.html");
    }
  } catch (err) {
    console.error("Session check error:", err);
  }
}

// Listen for all auth state changes
onAuthStateChange((event, session) => {
  if ((event === "SIGNED_IN" || event === "INITIAL_SESSION" || event === "TOKEN_REFRESHED") && session?.user) {
    window.location.replace("/dashboard/index.html");
  }
});

function setMode(nextMode) {
  mode = nextMode;
  const signup = mode === "signup";

  loginTab.classList.toggle("active", !signup);
  signupTab.classList.toggle("active", signup);
  modeSwitch.classList.toggle("signup", signup);

  signupOnly.forEach(el => el.classList.toggle("hidden", !signup));

  heading.textContent = signup ? "Create your account" : "Welcome back";
  subheading.textContent = signup
    ? "Create your workspace and start taking notes."
    : "Log in to continue to your notes.";

  if (googleBtnLabel) {
    googleBtnLabel.textContent = signup ? "Sign up with Google" : "Continue with Google";
  }

  submitBtn.textContent = signup ? "Create account" : "Log in";

  bottomPrompt.textContent = signup
    ? "Already have an account?"
    : "Don't have an account?";

  bottomSwitch.textContent = signup ? "Log in" : "Sign up";

  password.setAttribute("autocomplete", signup ? "new-password" : "current-password");
  confirmPassword.required = signup;
}

loginTab.addEventListener("click", () => setMode("login"));
signupTab.addEventListener("click", () => setMode("signup"));
bottomSwitch.addEventListener("click", () => {
  setMode(mode === "login" ? "signup" : "login");
});

showPassword.addEventListener("click", () => {
  const visible = password.type === "text";
  password.type = visible ? "password" : "text";
  showPassword.textContent = visible ? "Show" : "Hide";
});

// Google OAuth via Supabase
if (googleAuthBtn) {
  googleAuthBtn.addEventListener("click", async () => {
    if (!isSupabaseConfigured()) {
      showToast("Please add your Supabase credentials in .env to connect Google Auth.");
      return;
    }

    try {
      showToast("Redirecting to Google...");
      await signInWithGoogle();
    } catch (error) {
      console.error("Google sign in error:", error);
      showToast(error.message || "Google sign-in could not be completed.");
    }
  });
}

forgotBtn.addEventListener("click", () => {
  showToast("Password reset email feature is available via Supabase Auth.");
});

// Email/Password Auth Form
authForm.addEventListener("submit", async event => {
  event.preventDefault();

  if (!isSupabaseConfigured()) {
    showToast("Please add your Supabase credentials in .env first.");
    return;
  }

  const nameInput = document.getElementById("name");
  const emailInput = document.getElementById("email");
  const email = emailInput.value.trim();
  const passwordValue = password.value;

  if (!email || !passwordValue) {
    showToast("Please fill in your email and password.");
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = mode === "signup" ? "Creating account..." : "Logging in...";

  try {
    if (mode === "signup") {
      if (passwordValue.length < 6) {
        showToast("Password should be at least 6 characters.");
        submitBtn.disabled = false;
        submitBtn.textContent = "Create account";
        return;
      }

      if (passwordValue !== confirmPassword.value) {
        showToast("Passwords do not match.");
        submitBtn.disabled = false;
        submitBtn.textContent = "Create account";
        return;
      }

      if (!document.getElementById("terms").checked) {
        showToast("Please accept the Terms and Privacy Policy.");
        submitBtn.disabled = false;
        submitBtn.textContent = "Create account";
        return;
      }

      const userName = nameInput.value.trim() || email.split("@")[0] || "User";
      const { user, session } = await signUpWithEmail(email, passwordValue, {
        full_name: userName,
        name: userName
      });

      if (session) {
        showToast("Account created! Redirecting to your workspace...");
        setTimeout(() => window.location.replace("/dashboard/index.html"), 600);
      } else {
        showToast("Account created! Please check your email for confirmation link, or log in.");
        setMode("login");
      }
    } else {
      await signInWithEmail(email, passwordValue);
      showToast("Welcome back! Redirecting to your notes...");
      setTimeout(() => window.location.replace("/dashboard/index.html"), 600);
    }
  } catch (error) {
    console.error("Auth error:", error);
    showToast(error.message || "Authentication failed. Please check your credentials.");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = mode === "signup" ? "Create account" : "Log in";
  }
});

setMode("login");
checkInitialSession();
