import { auth, db } from "../firebase-config.js";
import {
  signInAnonymously,
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/12.10.0/firebase-auth.js";
import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  collection,
  getDocs,
  serverTimestamp,
  runTransaction,
} from "https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js";

/** Normalized key used for global name uniqueness (lowercase, collapsed spaces). */
function charNameKey(name) {
  return name.toLowerCase().replace(/\s+/g, " ").trim();
}

const SESSION_KEY = "aidle_session";
const USERNAME_RE = /^[a-z0-9-]{3,20}$/;

/**
 * Session object shape:
 *   Named account: { type: "account", username: "brad", userKey: "brad",        displayName: "brad" }
 *   Guest:         { type: "guest",   uid: "abc123",   userKey: "_guest_abc123", displayName: "Guest" }
 *
 * userKey is what we use as the Firestore path segment for character storage.
 * Firebase anonymous auth is used solely to satisfy Firestore's auth requirement.
 */

const FirebaseService = {
  // ── Firebase anonymous auth (internal) ────────────────────────

  /** Ensures an anonymous Firebase session exists. Resolves with the Firebase user. */
  _ensureFirebaseAuth() {
    return new Promise((resolve, reject) => {
      const unsub = onAuthStateChanged(auth, user => {
        if (user) { unsub(); resolve(user); }
        else { signInAnonymously(auth).catch(reject); }
      });
    });
  },

  /** Sign out of Firebase (called on full log out). */
  async _firebaseSignOut() {
    await signOut(auth);
  },

  // ── Session (localStorage) ────────────────────────────────────

  saveSession(session) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  },

  loadSession() {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY)); }
    catch { return null; }
  },

  clearSession() {
    localStorage.removeItem(SESSION_KEY);
  },

  // ── App boot ──────────────────────────────────────────────────

  /**
   * Called once on startup.
   * Ensures Firebase auth is ready (anonymous), then returns any saved session.
   * Returns: { firebaseUser, session } — session may be null.
   */
  async boot() {
    const firebaseUser = await this._ensureFirebaseAuth();
    const session      = this.loadSession();
    return { firebaseUser, session };
  },

  // ── Account management ────────────────────────────────────────

  /**
   * Creates a new account. Checks uniqueness, saves plaintext password.
   * Returns a session object.
   */
  async createAccount(username, password) {
    const clean = username.toLowerCase().trim();
    if (!USERNAME_RE.test(clean)) {
      throw new Error("Username must be 3–20 characters: letters, numbers, and dashes only.");
    }
    if (!password || password.length < 4) {
      throw new Error("Password must be at least 4 characters.");
    }

    const ref  = doc(db, "accounts", clean);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      throw new Error("That username is already taken.");
    }

    await setDoc(ref, { password });

    const session = { type: "account", username: clean, userKey: clean, displayName: clean };
    this.saveSession(session);
    return session;
  },

  /**
   * Signs in with username + password.
   * Returns a session object.
   */
  async signInWithCredentials(username, password) {
    const clean = username.toLowerCase().trim();
    const snap  = await getDoc(doc(db, "accounts", clean));

    if (!snap.exists()) {
      throw new Error("No account found with that username.");
    }
    if (snap.data().password !== password) {
      throw new Error("Incorrect password.");
    }

    const session = { type: "account", username: clean, userKey: clean, displayName: clean };
    this.saveSession(session);
    return session;
  },

  /** Clears the local session. Keeps Firebase anonymous auth alive for continued Firestore access. */
  signOut() {
    this.clearSession();
  },

  // ── Global character name reservation ────────────────────────

  /**
   * Atomically checks and reserves a character name globally.
   * Throws if the name is already taken.
   */
  async reserveCharName(name, userKey, charId) {
    const key     = charNameKey(name);
    const nameRef = doc(db, "charNames", key);
    await runTransaction(db, async tx => {
      const snap = await tx.get(nameRef);
      if (snap.exists()) throw new Error("That name is already taken by another hero.");
      tx.set(nameRef, { userKey, charId });
    });
  },

  /** Releases a reserved character name (call on delete). */
  async releaseCharName(name) {
    await deleteDoc(doc(db, "charNames", charNameKey(name)));
  },

  // ── Character CRUD (keyed by session.userKey) ─────────────────

  async saveCharacter(userKey, characterId, data) {
    const { lastSaveTime: _ts, ...rest } = data;
    const ref = doc(db, "users", userKey, "characters", characterId);
    await setDoc(ref, { ...rest, lastSaveTime: serverTimestamp() }, { merge: true });
  },

  async loadCharacter(userKey, characterId) {
    const snap = await getDoc(doc(db, "users", userKey, "characters", characterId));
    return snap.exists() ? snap.data() : null;
  },

  async listCharacters(userKey) {
    const snap = await getDocs(collection(db, "users", userKey, "characters"));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  async deleteCharacter(userKey, characterId, charName) {
    await deleteDoc(doc(db, "users", userKey, "characters", characterId));
    // Best-effort — stale charNames entries are harmless (just block name reuse).
    if (charName) {
      try { await this.releaseCharName(charName); } catch { /* ignore */ }
    }
  },

  /**
   * Permanently deletes the account and all its characters.
   * Clears the local session.
   */
  async deleteAccount(userKey) {
    // Delete all characters (name release is best-effort inside deleteCharacter).
    const chars = await this.listCharacters(userKey);
    for (const char of chars) {
      await this.deleteCharacter(userKey, char.id, char.profile?.name);
    }
    // Delete the account document itself.
    await deleteDoc(doc(db, "accounts", userKey));
    this.clearSession();
  },
};

export default FirebaseService;
