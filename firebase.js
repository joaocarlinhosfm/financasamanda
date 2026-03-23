// =====================================================
//  FINANÇA ROSA — Firebase Config & Helpers
//  Base de dados: Firebase Realtime Database
// =====================================================

const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyCzZC8HBWofFsURRVsuLMUFtKkoOkooHEQ",
  authDomain:        "financas-f4bfe.firebaseapp.com",
  projectId:         "financas-f4bfe",
  storageBucket:     "financas-f4bfe.firebasestorage.app",
  messagingSenderId: "711422028123",
  appId:             "1:711422028123:web:90747c00bf525edf5d927e",
  measurementId:     "G-70X7DHN855",
  databaseURL:       "https://financas-f4bfe-default-rtdb.europe-west1.firebasedatabase.app"
};

firebase.initializeApp(FIREBASE_CONFIG);
const auth = firebase.auth();
const db   = firebase.database();


// ─────────────────────────────────────────────────────
//  AUTH
// ─────────────────────────────────────────────────────

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
      return (await current.linkWithPopup(provider)).user;
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


// ─────────────────────────────────────────────────────
//  PATH HELPERS
//  Estrutura: users/{uid}/{collection}/{id}
// ─────────────────────────────────────────────────────
const _ref     = path => db.ref(path);
const _userRef = uid  => `users/${uid}`;
const _colRef  = (uid, col) => `users/${uid}/${col}`;
const _docRef  = (uid, col, id) => `users/${uid}/${col}/${id}`;
const _monthKey = (m, y) => `${y}-${String(m).padStart(2, '0')}`;


// ─────────────────────────────────────────────────────
//  DB API  (espelha a interface anterior do Firestore)
// ─────────────────────────────────────────────────────
const DB = {

  // Criar registo com ID automático (push)
  async add(uid, col, data) {
    const ref  = _ref(_colRef(uid, col)).push();
    const payload = { ...data, createdAt: Date.now() };
    await ref.set(payload);
    return ref.key;
  },

  // Atualizar campos (merge parcial)
  async update(uid, col, id, data) {
    await _ref(_docRef(uid, col, id)).update(data);
  },

  // Apagar registo
  async delete(uid, col, id) {
    await _ref(_docRef(uid, col, id)).remove();
  },

  // Buscar todos os registos de um mês/ano
  async getByMonth(uid, col, month, year) {
    const snap = await _ref(_colRef(uid, col))
      .orderByChild('month')
      .equalTo(month)
      .once('value');
    const raw = snap.val() || {};
    // filtrar também por ano (RTDB só permite 1 orderByChild)
    return Object.entries(raw)
      .filter(([, v]) => v.year === year)
      .map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  },

  // Buscar todos os registos de uma coleção
  async getAll(uid, col) {
    const snap = await _ref(_colRef(uid, col)).once('value');
    const raw  = snap.val() || {};
    return Object.entries(raw).map(([id, v]) => ({ id, ...v }));
  },

  // Definições do utilizador
  async getSettings(uid) {
    const snap = await _ref(`${_userRef(uid)}/settings`).once('value');
    return snap.val() || null;
  },

  async saveSettings(uid, data) {
    await _ref(`${_userRef(uid)}/settings`).update(data);
  },

  // Investimentos: 1 registo por mês-ano
  async getInvestment(uid, month, year) {
    const key  = _monthKey(month, year);
    const snap = await _ref(`${_userRef(uid)}/investments/${key}`).once('value');
    return snap.val() || {};
  },

  async saveInvestment(uid, month, year, data) {
    const key = _monthKey(month, year);
    await _ref(`${_userRef(uid)}/investments/${key}`).update({
      ...data, month, year, updatedAt: Date.now()
    });
  },

  // Importar batch de documentos (Excel)
  async importBatch(uid, col, docs) {
    const updates = {};
    const ts = Date.now();
    docs.forEach(doc => {
      const key = _ref(_colRef(uid, col)).push().key;
      updates[`${_colRef(uid, col)}/${key}`] = { ...doc, createdAt: ts };
    });
    await _ref('/').update(updates);
  }
};
