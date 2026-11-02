const API = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080').replace(/\/$/, '');

// Dedicated fetch calls never read the real account's token or send its cookies.
export async function demoRequest(path, options = {}) {
  const response = await fetch(`${API}/api/demo${path}`, { ...options, credentials: 'omit' });
  let data;
  try { data = await response.json(); }
  catch { throw new Error('The demo service returned an unreadable response. Please try again.'); }
  if (!response.ok) throw new Error(data.message || data.response || 'The demo service is unavailable. Please try again.');
  return data;
}

function fileStore(operation, key, file) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('ally-respondent-demo-files', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('files');
    request.onerror = () => reject(new Error('Local demo storage is unavailable. Allow browser storage and try again.'));
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction('files', operation === 'get' ? 'readonly' : 'readwrite');
      const store = transaction.objectStore('files');
      const result = operation === 'put' ? store.put(file, key) : operation === 'delete' ? store.delete(key) : store.get(key);
      transaction.oncomplete = () => { resolve(result.result); db.close(); };
      transaction.onerror = () => { reject(new Error('Unable to save the demo PDF in this browser.')); db.close(); };
      transaction.onabort = () => { reject(new Error('Demo file storage was interrupted.')); db.close(); };
    };
  });
}

export const getDemoFile = key => fileStore('get', key);
export const saveDemoFile = (key, file) => fileStore('put', key, file);
export const deleteDemoFile = key => fileStore('delete', key);
