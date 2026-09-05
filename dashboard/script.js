import {
  getSession,
  signOut,
  onAuthStateChange,
  getUserProfileInfo
} from '../src/lib/auth.js';
import {
  fetchNotes,
  createNote as apiCreateNote,
  updateNote as apiUpdateNote,
  deleteNote as apiDeleteNote
} from '../src/lib/notes.js';
import {
  inviteCollaborator,
  fetchNoteCollaborators,
  fetchIncomingInvitations,
  respondToInvitation,
  removeCollaborator
} from '../src/lib/collaborators.js';
import { isSupabaseConfigured } from '../src/lib/supabase.js';

let currentUser = null;
let notes = [];
let currentId = null;
let saveTimer = null;
let sessionInitialized = false;
let activeCollabNoteId = null;
let incomingInvitations = [];

const noteList = document.getElementById("noteList");
const titleInput = document.getElementById("titleInput");
const editor = document.getElementById("editor");
const breadcrumbTitle = document.getElementById("breadcrumbTitle");
const dateLabel = document.getElementById("dateLabel");
const savedStatus = document.getElementById("savedStatus");
const searchInput = document.getElementById("searchInput");
const profileBtn = document.getElementById("profileBtn");
const profileMenu = document.getElementById("profileMenu");
const toast = document.getElementById("toast");

const workspace = document.getElementById("workspace");
const sidebar = document.getElementById("sidebar");
const sidebarBackdrop = document.getElementById("sidebarBackdrop");
const menuToggleBtn = document.getElementById("menuToggleBtn");
const sidebarCloseBtn = document.getElementById("sidebarCloseBtn");
const backToListBtn = document.getElementById("backToListBtn");
const signOutBtn = document.getElementById("signOutBtn");
const notifBtn = document.getElementById("notifBtn");
const notifBadge = document.getElementById("notifBadge");

// In-Dashboard Incoming Requests Elements
const incomingRequestsBox = document.getElementById("incomingRequestsBox");
const requestsList = document.getElementById("requestsList");

// Collaboration Modal Elements
const collabModalBackdrop = document.getElementById("collabModalBackdrop");
const collabCloseBtn = document.getElementById("collabCloseBtn");
const collabNoteTitle = document.getElementById("collabNoteTitle");
const collabInviteForm = document.getElementById("collabInviteForm");
const collabEmailInput = document.getElementById("collabEmailInput");
const collabSendBtn = document.getElementById("collabSendBtn");
const collabLinkBox = document.getElementById("collabLinkBox");
const collabLinkInput = document.getElementById("collabLinkInput");
const copyCollabLinkBtn = document.getElementById("copyCollabLinkBtn");
const mailtoCollabLink = document.getElementById("mailtoCollabLink");
const collabList = document.getElementById("collabList");

// Top Invitation Banner Elements
const inviteBanner = document.getElementById("inviteBanner");
const inviteBannerText = document.getElementById("inviteBannerText");
const bannerAcceptBtn = document.getElementById("bannerAcceptBtn");
const bannerDeclineBtn = document.getElementById("bannerDeclineBtn");
let currentBannerInvite = null;

function showToast(message) {
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 3500);
}

function openSidebar() {
  if (sidebar) sidebar.classList.add("open");
  if (sidebarBackdrop) sidebarBackdrop.classList.add("active");
}

function closeSidebar() {
  if (sidebar) sidebar.classList.remove("open");
  if (sidebarBackdrop) sidebarBackdrop.classList.remove("active");
}

if (menuToggleBtn) menuToggleBtn.addEventListener("click", openSidebar);
if (sidebarCloseBtn) sidebarCloseBtn.addEventListener("click", closeSidebar);
if (sidebarBackdrop) sidebarBackdrop.addEventListener("click", closeSidebar);

function showEditorView() {
  if (workspace) {
    workspace.classList.add("view-editor");
    workspace.classList.remove("view-list");
  }
}

function showListView() {
  if (workspace) {
    workspace.classList.add("view-list");
    workspace.classList.remove("view-editor");
  }
}

if (backToListBtn) {
  backToListBtn.addEventListener("click", showListView);
}

function renderUserProfile(user) {
  const { name, email, avatarUrl, initial } = getUserProfileInfo(user);

  document.querySelectorAll(".avatar").forEach(el => {
    if (avatarUrl) {
      el.innerHTML = `<img src="${escapeHtml(avatarUrl)}" alt="${escapeHtml(name)}" onerror="this.parentElement.textContent='${initial}'" />`;
    } else {
      el.textContent = initial;
    }
  });

  document.querySelectorAll(".user-name").forEach(el => {
    el.textContent = name;
  });

  const emailEl = document.getElementById("profileMenuEmail");
  if (emailEl && email) {
    emailEl.textContent = email;
  }
}

function getCurrentNote() {
  return notes.find(note => note.id === currentId);
}

function formatRelativeTime(dateString) {
  if (!dateString) return "Just now";
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMin < 2) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function extractPreview(htmlContent) {
  if (!htmlContent) return "Empty note";
  const temp = document.createElement("div");
  temp.innerHTML = htmlContent;
  const text = temp.textContent.replace(/\s+/g, " ").trim();
  return text.slice(0, 80) || "Empty note";
}

function renderNotes(filter = "") {
  const q = filter.trim().toLowerCase();

  const filtered = notes.filter(note => {
    const title = (note.title || "").toLowerCase();
    const preview = extractPreview(note.content).toLowerCase();
    return title.includes(q) || preview.includes(q);
  });

  if (filtered.length === 0) {
    if (notes.length === 0) {
      noteList.innerHTML = `
        <div class="empty-state">
          <p>No notes yet</p>
          <button type="button" id="emptyNewNoteBtn">＋ Create your first note</button>
        </div>
      `;
      const btn = document.getElementById("emptyNewNoteBtn");
      if (btn) btn.addEventListener("click", handleCreateNote);
    } else {
      noteList.innerHTML = `
        <div class="empty-state">
          <p>No notes matching "${escapeHtml(filter)}"</p>
        </div>
      `;
    }
    return;
  }

  noteList.innerHTML = filtered.map(note => {
    const isActive = note.id === currentId;
    const preview = extractPreview(note.content);
    const updatedLabel = formatRelativeTime(note.updated_at);
    const isShared = Boolean(note.is_shared);

    return `
      <div class="note-card ${isActive ? "active" : ""}" data-id="${note.id}">
        <div class="note-card-main">
          ${isShared ? '<span class="shared-badge">✦ Collaborated</span>' : ''}
          <h3>${escapeHtml(note.title || "Untitled Note")}</h3>
          <p>${escapeHtml(preview)}</p>
          <time>${escapeHtml(updatedLabel)}</time>
        </div>
        <button type="button" class="collab-btn" data-collab-id="${note.id}" title="Invite collaborators">COLLABORATE</button>
      </div>
    `;
  }).join("");

  document.querySelectorAll(".note-card").forEach(card => {
    card.addEventListener("click", (event) => {
      if (event.target.closest(".collab-btn")) return;
      selectNote(card.dataset.id);
      if (window.innerWidth <= 720) {
        showEditorView();
      }
    });
  });

  document.querySelectorAll(".collab-btn").forEach(button => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      const noteId = button.dataset.collabId;
      openCollabModal(noteId);
    });
  });
}

function selectNote(id) {
  currentId = id;
  const note = getCurrentNote();
  if (!note) {
    titleInput.value = "";
    editor.innerHTML = "";
    breadcrumbTitle.textContent = "Notes";
    dateLabel.textContent = "No note selected";
    renderNotes(searchInput.value);
    return;
  }

  titleInput.value = note.title || "Untitled Note";
  editor.innerHTML = note.content || "";
  breadcrumbTitle.textContent = note.title || "Untitled Note";
  dateLabel.textContent = `Updated ${formatRelativeTime(note.updated_at).toLowerCase()}`;
  if (savedStatus) savedStatus.textContent = "Saved";
  renderNotes(searchInput.value);
}

async function handleCreateNote() {
  const defaultContent = "<h2>Start writing...</h2><p>Type your thoughts here.</p>";

  try {
    if (savedStatus) savedStatus.textContent = "Creating...";
    const newNote = await apiCreateNote(currentUser?.id, {
      title: "Untitled Note",
      content: defaultContent
    });

    notes.unshift(newNote);
    selectNote(newNote.id);
    closeSidebar();
    if (window.innerWidth <= 720) {
      showEditorView();
    }
    titleInput.focus();
    titleInput.select();
    if (savedStatus) savedStatus.textContent = "Saved";
  } catch (error) {
    console.error("Failed to create note:", error);
    const msg = error?.message || "Failed to create note.";
    showToast(msg);
    if (savedStatus) savedStatus.textContent = "Save failed";
  }
}

async function performSave() {
  const note = getCurrentNote();
  if (!note) return;

  // Sync checkboxes in editor HTML before saving
  editor.querySelectorAll('input[type="checkbox"]').forEach(cb => {
    if (cb.checked) {
      cb.setAttribute("checked", "checked");
    } else {
      cb.removeAttribute("checked");
    }
  });

  const updatedTitle = titleInput.value.trim() || "Untitled Note";
  const updatedContent = editor.innerHTML;

  note.title = updatedTitle;
  note.content = updatedContent;
  note.updated_at = new Date().toISOString();

  breadcrumbTitle.textContent = updatedTitle;
  dateLabel.textContent = "Updated just now";
  renderNotes(searchInput.value);

  try {
    if (savedStatus) savedStatus.textContent = "Saving...";
    await apiUpdateNote(note.id, {
      title: updatedTitle,
      content: updatedContent
    });
    if (savedStatus) savedStatus.textContent = "Saved";
  } catch (error) {
    console.error("Failed to save note:", error);
    showToast(error.message || "Couldn't save your changes.");
    if (savedStatus) savedStatus.textContent = "Save failed";
  }
}

function scheduleSave() {
  if (savedStatus) savedStatus.textContent = "Saving...";
  clearTimeout(saveTimer);
  saveTimer = setTimeout(performSave, 500);
}

async function handleDeleteNote() {
  if (!currentId) return;

  const noteToDelete = getCurrentNote();
  if (!noteToDelete) return;

  if (noteToDelete.is_shared) {
    if (!confirm("Remove this collaborated note from your dashboard?")) {
      return;
    }
  }

  try {
    if (savedStatus) savedStatus.textContent = "Deleting...";
    await apiDeleteNote(currentId);

    const index = notes.findIndex(n => n.id === currentId);
    if (index !== -1) {
      notes.splice(index, 1);
    }

    if (notes.length > 0) {
      const nextIndex = Math.max(0, index - 1);
      selectNote(notes[nextIndex].id);
    } else {
      currentId = null;
      selectNote(null);
    }

    showToast("Note removed");
    if (window.innerWidth <= 720 && notes.length === 0) {
      showListView();
    }
  } catch (error) {
    console.error("Failed to delete note:", error);
    showToast("Couldn't delete this note.");
    if (savedStatus) savedStatus.textContent = "Saved";
  }
}

// ==============================================================================
// COLLABORATION MODAL LOGIC
// ==============================================================================

async function openCollabModal(noteId) {
  activeCollabNoteId = noteId;
  const note = notes.find(n => n.id === noteId);
  if (!note) return;

  if (collabNoteTitle) {
    collabNoteTitle.textContent = `Collaborate on "${note.title || 'Untitled Note'}"`;
  }
  if (collabEmailInput) collabEmailInput.value = "";
  if (collabLinkBox) collabLinkBox.classList.add("hidden");

  collabModalBackdrop?.classList.remove("hidden");
  await loadCollaboratorsList(noteId);
}

function closeCollabModal() {
  collabModalBackdrop?.classList.add("hidden");
  activeCollabNoteId = null;
}

collabCloseBtn?.addEventListener("click", closeCollabModal);
collabModalBackdrop?.addEventListener("click", (e) => {
  if (e.target === collabModalBackdrop) closeCollabModal();
});

async function loadCollaboratorsList(noteId) {
  if (!collabList) return;
  collabList.innerHTML = `<div class="collab-empty">Loading collaborators...</div>`;

  try {
    const collabs = await fetchNoteCollaborators(noteId);
    if (!collabs || collabs.length === 0) {
      collabList.innerHTML = `<div class="collab-empty">No collaborators yet. Invite someone above!</div>`;
      return;
    }

    collabList.innerHTML = collabs.map(c => `
      <div class="collab-item" data-id="${c.id}">
        <span class="collab-item-email" title="${escapeHtml(c.invitee_email)}">${escapeHtml(c.invitee_email)}</span>
        <div class="collab-item-right">
          <span class="status-badge ${c.status}">${c.status}</span>
          <button type="button" class="collab-remove-btn" data-remove-id="${c.id}" title="Remove access">✕</button>
        </div>
      </div>
    `).join("");

    collabList.querySelectorAll(".collab-remove-btn").forEach(btn => {
      btn.addEventListener("click", async () => {
        const removeId = btn.dataset.removeId;
        try {
          await removeCollaborator(removeId);
          showToast("Collaborator removed.");
          await loadCollaboratorsList(noteId);
        } catch (err) {
          showToast("Couldn't remove collaborator.");
        }
      });
    });
  } catch (error) {
    console.error("Error loading collaborators:", error);
    collabList.innerHTML = `<div class="collab-empty">Couldn't load collaborators.</div>`;
  }
}

collabInviteForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!activeCollabNoteId || !currentUser) return;

  const email = collabEmailInput.value.trim();
  if (!email) return;

  const note = notes.find(n => n.id === activeCollabNoteId);
  const noteTitle = note?.title || "Untitled Note";
  const inviterEmail = currentUser.email || "";

  collabSendBtn.disabled = true;
  collabSendBtn.textContent = "Inviting...";

  try {
    const result = await inviteCollaborator(
      activeCollabNoteId,
      currentUser.id,
      email,
      inviterEmail,
      noteTitle
    );

    showToast(`Request sent! ${email} will see this request on their dashboard.`);
    collabEmailInput.value = "";

    if (collabLinkBox && collabLinkInput) {
      collabLinkInput.value = result.acceptUrl;
      collabLinkBox.classList.remove("hidden");
    }

    await loadCollaboratorsList(activeCollabNoteId);
  } catch (error) {
    console.error("Failed to invite collaborator:", error);
    showToast(error.message || "Failed to invite collaborator.");
  } finally {
    collabSendBtn.disabled = false;
    collabSendBtn.textContent = "Send Invite";
  }
});

copyCollabLinkBtn?.addEventListener("click", async () => {
  if (!collabLinkInput?.value) return;
  try {
    await navigator.clipboard.writeText(collabLinkInput.value);
    showToast("Direct invitation link copied!");
  } catch (err) {
    collabLinkInput.select();
    document.execCommand("copy");
    showToast("Direct invitation link copied!");
  }
});

// ==============================================================================
// INCOMING DASHBOARD COLLABORATION REQUESTS
// ==============================================================================

async function checkPendingInvitations() {
  if (!currentUser) return;

  try {
    incomingInvitations = await fetchIncomingInvitations(currentUser.email, currentUser.id);
    renderIncomingRequests();
  } catch (err) {
    console.error("Error checking pending invitations:", err);
  }
}

function renderIncomingRequests() {
  if (!incomingRequestsBox || !requestsList) return;

  if (!incomingInvitations || incomingInvitations.length === 0) {
    incomingRequestsBox.classList.add("hidden");
    inviteBanner?.classList.add("hidden");
    if (notifBadge) notifBadge.classList.add("hidden");
    return;
  }

  // Update notification badge
  if (notifBadge) {
    notifBadge.textContent = String(incomingInvitations.length);
    notifBadge.classList.remove("hidden");
  }

  // Render cards in the Notes Column
  requestsList.innerHTML = incomingInvitations.map(inv => {
    const noteName = inv.note_title || "Untitled Note";
    const sender = inv.inviter_email ? `Invited by ${inv.inviter_email}` : "Collaborative note invite";

    return `
      <div class="request-card" data-inv-id="${inv.id}">
        <strong class="request-note-name">✦ ${escapeHtml(noteName)}</strong>
        <span class="request-sender">${escapeHtml(sender)}</span>
        <div class="request-btn-group">
          <button type="button" class="btn-request-accept" data-accept-id="${inv.id}">✓ Accept</button>
          <button type="button" class="btn-request-decline" data-decline-id="${inv.id}">✕ Decline</button>
        </div>
      </div>
    `;
  }).join("");

  incomingRequestsBox.classList.remove("hidden");

  // Wire Accept & Decline buttons on each request card
  requestsList.querySelectorAll(".btn-request-accept").forEach(btn => {
    btn.addEventListener("click", async () => {
      const invId = btn.dataset.acceptId;
      await handleAcceptInvitation(invId);
    });
  });

  requestsList.querySelectorAll(".btn-request-decline").forEach(btn => {
    btn.addEventListener("click", async () => {
      const invId = btn.dataset.declineId;
      await handleDeclineInvitation(invId);
    });
  });

  // Also display the top banner for the first pending request
  currentBannerInvite = incomingInvitations[0];
  if (inviteBanner && inviteBannerText) {
    const senderInfo = currentBannerInvite.inviter_email ? ` from ${currentBannerInvite.inviter_email}` : '';
    inviteBannerText.textContent = `You've been invited to collaborate on "${currentBannerInvite.note_title || 'a note'}"${senderInfo}.`;
    inviteBanner.classList.remove("hidden");
  }
}

async function handleAcceptInvitation(invitationId) {
  if (!currentUser) return;
  try {
    showToast("Accepting collaboration request...");
    const accepted = await respondToInvitation(invitationId, 'accept', currentUser.id);
    showToast(`Accepted! "${accepted.note_title || 'Collaborated Note'}" added to your dashboard.`);

    inviteBanner?.classList.add("hidden");
    await loadUserNotes();
    await checkPendingInvitations();

    // Automatically select the accepted note
    if (accepted.note_id) {
      selectNote(accepted.note_id);
    }
  } catch (err) {
    console.error("Error accepting invitation:", err);
    showToast("Couldn't accept request. Please try again.");
  }
}

async function handleDeclineInvitation(invitationId) {
  if (!currentUser) return;
  try {
    await respondToInvitation(invitationId, 'decline', currentUser.id);
    showToast("Invitation declined.");
    inviteBanner?.classList.add("hidden");
    await checkPendingInvitations();
  } catch (err) {
    console.error("Error declining invitation:", err);
    showToast("Couldn't decline request.");
  }
}

bannerAcceptBtn?.addEventListener("click", async () => {
  if (!currentBannerInvite) return;
  await handleAcceptInvitation(currentBannerInvite.id);
});

bannerDeclineBtn?.addEventListener("click", async () => {
  if (!currentBannerInvite) return;
  await handleDeclineInvitation(currentBannerInvite.id);
});

// Check URL parameters for direct invitation token action
async function handleUrlInvitation() {
  const urlParams = new URLSearchParams(window.location.search);
  const inviteToken = urlParams.get("invite");
  const inviteAction = urlParams.get("action") || "accept";

  if (inviteToken && currentUser) {
    try {
      showToast(`Processing collaboration ${inviteAction}...`);
      const result = await respondToInvitation(inviteToken, inviteAction, currentUser.id);
      const noteTitle = result.note_title || "the note";

      if (inviteAction === "accept") {
        showToast(`You are now collaborating on "${noteTitle}"!`);
      } else {
        showToast(`Declined collaboration on "${noteTitle}".`);
      }

      window.history.replaceState({}, document.title, window.location.pathname);
      await loadUserNotes();
      await checkPendingInvitations();
    } catch (err) {
      console.error("Error processing invite link:", err);
      showToast("Invitation link is invalid or expired.");
    }
  }
}

function escapeHtml(value) {
  if (!value) return "";
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[char]));
}

// Event Listeners
document.getElementById("newNoteBtn")?.addEventListener("click", handleCreateNote);
document.getElementById("newNoteBtn2")?.addEventListener("click", handleCreateNote);
document.getElementById("deleteBtn")?.addEventListener("click", handleDeleteNote);

titleInput.addEventListener("input", scheduleSave);
editor.addEventListener("input", scheduleSave);

editor.addEventListener("change", (event) => {
  if (event.target.matches('input[type="checkbox"]')) {
    const item = event.target.closest(".task-item");
    if (item) {
      item.classList.toggle("completed", event.target.checked);
    }
    scheduleSave();
  }
});

searchInput.addEventListener("input", e => renderNotes(e.target.value));

editor.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && event.target.closest(".task-item")) {
    event.preventDefault();
    const current = event.target.closest(".task-item");
    const next = document.createElement("li");
    next.className = "task-item";
    next.innerHTML = '<input type="checkbox"> ';
    current.parentNode.insertBefore(next, current.nextSibling);

    const range = document.createRange();
    range.selectNodeContents(next);
    range.collapse(false);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    scheduleSave();
  }
});

document.querySelectorAll(".toolbar-btn").forEach(button => {
  button.addEventListener("click", () => {
    const cmd = button.dataset.cmd;
    const value = button.dataset.value;
    document.execCommand(cmd, false, value || null);
    editor.focus();
    scheduleSave();
  });
});

profileBtn?.addEventListener("click", e => {
  e.stopPropagation();
  profileMenu?.classList.toggle("hidden");
});

document.addEventListener("click", () => profileMenu?.classList.add("hidden"));

notifBtn?.addEventListener("click", () => {
  if (incomingInvitations.length > 0) {
    showToast(`You have ${incomingInvitations.length} collaboration request(s) on your dashboard.`);
  } else {
    showToast("No new collaboration requests.");
  }
});

if (signOutBtn) {
  signOutBtn.addEventListener("click", async () => {
    try {
      await signOut();
    } catch (err) {
      console.error("Sign out error:", err);
      window.location.replace("/index.html");
    }
  });
}

window.addEventListener("resize", () => {
  if (window.innerWidth > 720) {
    closeSidebar();
  }
});

async function loadUserNotes() {
  noteList.innerHTML = `<div class="empty-state"><p>Loading your notes...</p></div>`;

  try {
    notes = await fetchNotes(currentUser?.id);

    if (notes.length > 0) {
      selectNote(notes[0].id);
    } else {
      renderNotes();
      selectNote(null);
    }
  } catch (error) {
    console.error("Dashboard notes fetch error:", error);
    const errorMsg = error?.message || "Unable to load notes.";
    showToast(errorMsg);
    noteList.innerHTML = `
      <div class="empty-state">
        <p>${escapeHtml(errorMsg)}</p>
        <button type="button" id="retryNotesBtn">Retry Connection</button>
      </div>
    `;
    document.getElementById("retryNotesBtn")?.addEventListener("click", loadUserNotes);
  }
}

async function handleAuthenticatedUser(user) {
  if (sessionInitialized && currentUser?.id === user?.id) return;
  sessionInitialized = true;
  currentUser = user;

  renderUserProfile(currentUser);

  await loadUserNotes();
  await handleUrlInvitation();
  await checkPendingInvitations();

  // Periodic check for new requests every 12 seconds
  setInterval(checkPendingInvitations, 12000);
}

// App Initialization
async function initializeDashboard() {
  if (!isSupabaseConfigured()) {
    showToast("Supabase is not configured yet. Please check .env file.");
    renderUserProfile(null);
    return;
  }

  // Check URL for OAuth errors
  const urlParams = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(window.location.hash.substring(1));
  const oauthError = urlParams.get("error_description") || urlParams.get("error") || hashParams.get("error_description") || hashParams.get("error");
  if (oauthError) {
    showToast(`Google login error: ${decodeURIComponent(oauthError.replace(/\+/g, " "))}`);
    setTimeout(() => window.location.replace("/index.html"), 2500);
    return;
  }

  const isAuthCallback = window.location.search.includes("code=") || window.location.hash.includes("access_token=");
  if (isAuthCallback) {
    noteList.innerHTML = `<div class="empty-state"><p>Verifying Google session...</p></div>`;
  }

  // Subscribe to auth state changes
  onAuthStateChange(async (event, session) => {
    if (session?.user) {
      await handleAuthenticatedUser(session.user);
    } else if (event === "SIGNED_OUT") {
      window.location.replace("/index.html");
    }
  });

  // Check existing session
  try {
    const session = await getSession();
    if (session?.user) {
      await handleAuthenticatedUser(session.user);
    } else if (!isAuthCallback) {
      // Delay before redirect to allow any async token restore
      setTimeout(async () => {
        if (!sessionInitialized) {
          const retrySession = await getSession();
          if (retrySession?.user) {
            await handleAuthenticatedUser(retrySession.user);
          } else {
            window.location.replace("/index.html");
          }
        }
      }, 700);
    } else {
      // Wait for OAuth callback exchange
      setTimeout(async () => {
        if (!sessionInitialized) {
          const finalSession = await getSession();
          if (finalSession?.user) {
            await handleAuthenticatedUser(finalSession.user);
          } else {
            showToast("Session could not be verified. Please log in again.");
            setTimeout(() => window.location.replace("/index.html"), 1500);
          }
        }
      }, 3500);
    }
  } catch (error) {
    console.error("Session verification error:", error);
  }
}

initializeDashboard();
