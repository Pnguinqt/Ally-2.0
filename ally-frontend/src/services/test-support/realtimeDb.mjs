export function memoryRealtimeDb(seed = {}) {
  let data = structuredClone(seed);
  let sequence = 0;
  const listeners = new Set();
  const read = path => path.split('/').filter(Boolean).reduce((value, key) => value?.[key], data) ?? null;
  const write = (path, value) => {
    const keys = path.split('/').filter(Boolean);
    if (!keys.length) { data = value || {}; return; }
    let parent = data;
    for (const key of keys.slice(0, -1)) parent = parent[key] ??= {};
    if (value === null) delete parent[keys.at(-1)];
    else parent[keys.at(-1)] = structuredClone(value);
  };
  const snapshot = path => { const value = structuredClone(read(path)); return { val: () => value, exists: () => value !== null }; };
  const notify = changed => {
    for (const listener of listeners) if (changed.some(path => path === listener.path || path.startsWith(`${listener.path}/`) || listener.path.startsWith(`${path}/`))) {
      const value = snapshot(listener.path);
      queueMicrotask(() => { if (listeners.has(listener)) listener.callback(value); });
    }
  };
  const db = {
    beforeTransaction: null,
    ref: path => path,
    push: () => ({ key: `message-${String(++sequence).padStart(6, '0')}` }),
    get: async path => snapshot(path),
    update: async (base, updates) => {
      const changed = Object.entries(updates).map(([path, value]) => { const full = [base, path].filter(Boolean).join('/'); write(full, value); return full; });
      notify(changed);
    },
    remove: async path => { write(path, null); notify([path]); },
    onValue: (path, callback, onError) => {
      const listener = { path, callback, onError }; listeners.add(listener);
      const initial = snapshot(path);
      queueMicrotask(() => { if (listeners.has(listener)) callback(initial); });
      return () => listeners.delete(listener);
    },
    runTransaction: async (path, change) => {
      db.beforeTransaction?.(path);
      const result = change(structuredClone(read(path)));
      if (result === undefined) return { committed: false, snapshot: snapshot(path) };
      write(path, result); notify([path]);
      return { committed: true, snapshot: snapshot(path) };
    },
    value: path => structuredClone(read(path)),
    listenerCount: () => listeners.size,
    fail: (path, error) => { for (const listener of listeners) if (listener.path === path) listener.onError?.(error); },
  };
  return db;
}
