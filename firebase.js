// =====================================================
//  FINANÇA ROSA — Firebase Config & Helpers
// =====================================================

const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyCzZC8HBWofFsURRVsuLMUFtKkoOkooHEQ",
  authDomain:        "financas-f4bfe.firebaseapp.com",
  projectId:         "financas-f4bfe",
  storageBucket:     "financas-f4bfe.firebasestorage.app",
  messagingSenderId: "711422028123",
  appId:             "1:711422028123:web:90747c00bf525edf5d927e",
  measurementId:     "G-70X7DHN855"
};

firebase.initializeApp(FIREBASE_CONFIG);
const auth = firebase.auth();
const db   = firebase.firestore();

db.enablePersistence({ synchronizeTabs: true })
  .catch(err => {
    if (err.code === 'failed-precondition') console.warn('[Firebase] Persistência offline: múltiplas tabs.');
    else if (err.code === 'unimplemented')  console.warn('[Firebase] Persistência offline não suportada.');
  });

// ─── AUTH ────────────────────────────────────────────

async function ensureAuth() {
  return new Promise(resolve => {
    const unsub = auth.onAuthStateChanged(user => { unsub(); resolve(user || null); });
  });
}

async function signInWithGoogle() {
  const provider = new firebase.auth.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  const current = auth.currentUser;
  if (current && current.isAnonymous) {
    try {
      const cred = await current.linkWithPopup(provider);
      return cred.user;
    } catch (e) {
      if (e.code === 'auth/credential-already-in-use' || e.code === 'auth/email-already-in-use') {
        return (await auth.signInWithPopup(provider)).user;
      }
      throw e;
    }
  }
  return (await auth.signInWithPopup(provider)).user;
}

async function signInAnonymous() {
  return (await auth.signInAnonymously()).user;
}

async function signOut() {
  await auth.signOut();
}

// ─── PATH HELPERS ────────────────────────────────────
const _userRef = uid => db.collection('users').doc(uid);
const _colRef  = (uid, col) => _userRef(uid).collection(col);
const _docRef  = (uid, col, id) => _colRef(uid, col).doc(id);
const _monthKey = (m, y) => `${y}-${String(m).padStart(2,'0')}`;
const _monthQuery = (uid, col, m, y) =>
  _colRef(uid, col).where('month','==',m).where('year','==',y);

// ─── DB API ──────────────────────────────────────────
const DB = {
  async add(uid, col, data) {
    const ref = await _colRef(uid, col).add({ ...data, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
    return ref.id;
  },
  async update(uid, col, id, data) { await _docRef(uid, col, id).update(data); },
  async delete(uid, col, id)       { await _docRef(uid, col, id).delete(); },
  async getByMonth(uid, col, m, y) {
    try {
      const snap = await _monthQuery(uid, col, m, y).orderBy('createdAt','desc').get();
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch {
      const snap = await _monthQuery(uid, col, m, y).get();
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    }
  },
  async getAll(uid, col) {
    const snap = await _colRef(uid, col).get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },
  async getSettings(uid) {
    const doc = await _userRef(uid).get();
    return doc.exists ? doc.data() : null;
  },
  async saveSettings(uid, data) { await _userRef(uid).set(data, { merge: true }); },
  async getInvestment(uid, m, y) {
    const doc = await _colRef(uid, 'investments').doc(_monthKey(m, y)).get();
    return doc.exists ? doc.data() : {};
  },
  async saveInvestment(uid, m, y, data) {
    await _colRef(uid, 'investments').doc(_monthKey(m, y)).set(
      { ...data, month: m, year: y, updatedAt: firebase.firestore.FieldValue.serverTimestamp() },
      { merge: true }
    );
  },
  async importBatch(uid, col, docs) {
    const batch = db.batch();
    const ts = firebase.firestore.FieldValue.serverTimestamp();
    docs.forEach(doc => batch.set(_colRef(uid, col).doc(), { ...doc, createdAt: ts }));
    await batch.commit();
  }
};
