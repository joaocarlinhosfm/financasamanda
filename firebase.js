// =====================================================
//  FINANÇA ROSA — Firebase Config & Helpers
//  Base de dados: Firebase Realtime Database
//  + Fila offline via IndexedDB
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
// ─────────────────────────────────────────────────────
const _ref      = path => db.ref(path);
const _userRef  = uid  => `users/${uid}`;
const _colRef   = (uid, col) => `users/${uid}/${col}`;
const _docRef   = (uid, col, id) => `users/${uid}/${col}/${id}`;
const _monthKey = (m, y) => `${y}-${String(m).padStart(2, '0')}`;


// ─────────────────────────────────────────────────────
//  FILA OFFLINE — IndexedDB
// ─────────────────────────────────────────────────────
const QUEUE_DB_NAME    = 'financa-rosa-queue';
const QUEUE_STORE_NAME = 'writes';

let _idb = null;

function _openQueueDB() {
  if (_idb) return Promise.resolve(_idb);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(QUEUE_DB_NAME, 1);
    req.onupgradeneeded = e => {
      const idb = e.target.result;
      if (!idb.objectStoreNames.contains(QUEUE_STORE_NAME)) {
        idb.createObjectStore(QUEUE_STORE_NAME, { keyPath: 'queueId', autoIncrement: true });
      }
    };
    req.onsuccess = e => { _idb = e.target.result; resolve(_idb); };
    req.onerror   = e => reject(e.target.error);
  });
}

async function _queueWrite(op) {
  const idb = await _openQueueDB();
  return new Promise((resolve, reject) => {
    const tx    = idb.transaction(QUEUE_STORE_NAME, 'readwrite');
    const store = tx.objectStore(QUEUE_STORE_NAME);
    const req   = store.add({ ...op, queuedAt: Date.now() });
    req.onsuccess = () => resolve(req.result);
    req.onerror   = e  => reject(e.target.error);
  });
}

async function _dequeueWrite(queueId) {
  const idb = await _openQueueDB();
  return new Promise((resolve, reject) => {
    const tx    = idb.transaction(QUEUE_STORE_NAME, 'readwrite');
    const store = tx.objectStore(QUEUE_STORE_NAME);
    const req   = store.delete(queueId);
    req.onsuccess = () => resolve();
    req.onerror   = e  => reject(e.target.error);
  });
}

async function _getAllQueued() {
  const idb = await _openQueueDB();
  return new Promise((resolve, reject) => {
    const tx    = idb.transaction(QUEUE_STORE_NAME, 'readonly');
    const store = tx.objectStore(QUEUE_STORE_NAME);
    const req   = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror   = e  => reject(e.target.error);
  });
}

function _tempId() {
  return 'tmp_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
}

// ── Flush: executa operações em fila quando online ──
let _flushing = false;
async function flushOfflineQueue() {
  if (_flushing || !navigator.onLine) return;
  _flushing = true;
  try {
    const ops = await _getAllQueued();
    if (!ops.length) return;

    console.log(`[Queue] A sincronizar ${ops.length} operação(ões)…`);
    let synced = 0;

    for (const op of ops) {
      try {
        await _executeOp(op);
        await _dequeueWrite(op.queueId);
        synced++;
      } catch (e) {
        console.warn('[Queue] Falhou:', op, e);
        break; // parar se falhou (provavelmente sem rede ainda)
      }
    }

    if (synced > 0 && typeof showToast === 'function') {
      showToast(`✓ ${synced} registo(s) sincronizado(s)`);
    }
  } finally {
    _flushing = false;
  }
}

async function _executeOp(op) {
  switch (op.type) {
    case 'add': {
      const ref = _ref(op.path).push();
      await ref.set(op.data);
      break;
    }
    case 'set':
      await _ref(op.path).set(op.data);
      break;
    case 'update':
      await _ref(op.path).update(op.data);
      break;
    case 'remove':
      await _ref(op.path).remove();
      break;
    case 'multiUpdate':
      await _ref('/').update(op.data);
      break;
  }
}

// Ouvir eventos de rede
window.addEventListener('online',  () => {
  if (typeof updateFirebaseStatus === 'function') updateFirebaseStatus(true);
  flushOfflineQueue();
});
window.addEventListener('offline', () => {
  if (typeof updateFirebaseStatus === 'function') updateFirebaseStatus(false);
});


// ─────────────────────────────────────────────────────
//  WRAPPER: tenta Firebase; se offline → fila
// ─────────────────────────────────────────────────────
async function _tryWrite(firebaseFn, queueOp) {
  if (!navigator.onLine) {
    await _queueWrite(queueOp);
    return queueOp.tempId || null;
  }
  try {
    return await firebaseFn();
  } catch (e) {
    // Falhou (sem rede apesar de onLine=true, ou timeout)
    await _queueWrite(queueOp);
    return queueOp.tempId || null;
  }
}


// ─────────────────────────────────────────────────────
//  DB API
// ─────────────────────────────────────────────────────
const DB = {

  async add(uid, col, data) {
    const tempId  = _tempId();
    const payload = { ...data, createdAt: Date.now() };
    const id = await _tryWrite(
      async () => {
        const ref = _ref(_colRef(uid, col)).push();
        await ref.set(payload);
        return ref.key;
      },
      { type: 'add', path: _colRef(uid, col), data: payload, tempId }
    );
    return id || tempId;
  },

  async update(uid, col, id, data) {
    if (String(id).startsWith('tmp_')) return;
    await _tryWrite(
      async () => { await _ref(_docRef(uid, col, id)).update(data); },
      { type: 'update', path: _docRef(uid, col, id), data }
    );
  },

  async delete(uid, col, id) {
    if (String(id).startsWith('tmp_')) return;
    await _tryWrite(
      async () => { await _ref(_docRef(uid, col, id)).remove(); },
      { type: 'remove', path: _docRef(uid, col, id) }
    );
  },

  // ── LEITURAS ──────────────────────────────────────

  async getByMonth(uid, col, month, year) {
    const snap = await _ref(_colRef(uid, col))
      .orderByChild('month').equalTo(month).once('value');
    const raw = snap.val() || {};
    return Object.entries(raw)
      .filter(([, v]) => v.year === year)
      .map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  },

  async getAll(uid, col) {
    const snap = await _ref(_colRef(uid, col)).once('value');
    const raw  = snap.val() || {};
    return Object.entries(raw).map(([id, v]) => ({ id, ...v }));
  },

  async getByYear(uid, col, year) {
    const snap = await _ref(_colRef(uid, col))
      .orderByChild('year').equalTo(year).once('value');
    const raw = snap.val() || {};
    return Object.entries(raw).map(([id, v]) => ({ id, ...v }));
  },

  async getSettings(uid) {
    const snap = await _ref(`${_userRef(uid)}/settings`).once('value');
    return snap.val() || null;
  },

  async saveSettings(uid, data) {
    await _tryWrite(
      async () => { await _ref(`${_userRef(uid)}/settings`).update(data); },
      { type: 'update', path: `${_userRef(uid)}/settings`, data }
    );
  },

  async getInvestment(uid, month, year) {
    const key  = _monthKey(month, year);
    const snap = await _ref(`${_userRef(uid)}/investments/${key}`).once('value');
    return snap.val() || {};
  },

  async saveInvestment(uid, month, year, data) {
    const key     = _monthKey(month, year);
    const payload = { ...data, month, year, updatedAt: Date.now() };
    await _tryWrite(
      async () => { await _ref(`${_userRef(uid)}/investments/${key}`).update(payload); },
      { type: 'update', path: `${_userRef(uid)}/investments/${key}`, data: payload }
    );
  },

  async importBatch(uid, col, docs) {
    const updates = {};
    const ts = Date.now();
    docs.forEach(doc => {
      const key = _ref(_colRef(uid, col)).push().key;
      updates[`${_colRef(uid, col)}/${key}`] = { ...doc, createdAt: ts };
    });
    await _tryWrite(
      async () => { await _ref('/').update(updates); },
      { type: 'multiUpdate', data: updates }
    );
  },

  // ── PRESTAÇÕES ────────────────────────────────────

  async getAllPrestacoes(uid) {
    const snap = await _ref(_colRef(uid, 'prestacoes')).once('value');
    const raw  = snap.val() || {};
    return Object.entries(raw).map(([id, v]) => ({ id, ...v }));
  },

  async addPrestacao(uid, data) {
    const tempId  = _tempId();
    const payload = { ...data, createdAt: Date.now() };
    const id = await _tryWrite(
      async () => {
        const ref = _ref(_colRef(uid, 'prestacoes')).push();
        await ref.set(payload);
        return ref.key;
      },
      { type: 'add', path: _colRef(uid, 'prestacoes'), data: payload, tempId }
    );
    return id || tempId;
  },

  async deletePrestacao(uid, id) {
    if (String(id).startsWith('tmp_')) return;
    await _tryWrite(
      async () => { await _ref(_docRef(uid, 'prestacoes', id)).remove(); },
      { type: 'remove', path: _docRef(uid, 'prestacoes', id) }
    );
  },

  async togglePrestacaoPaid(uid, id, monthKey, paid) {
    if (String(id).startsWith('tmp_')) return;
    const path = `${_docRef(uid, 'prestacoes', id)}/paid/${monthKey}`;
    await _tryWrite(
      async () => { await _ref(path).set(paid); },
      { type: 'set', path, data: paid }
    );
  }
};
