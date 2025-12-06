const QUEUE_KEY = "queue";
const HISTORY_KEY = "history";
const TYPES_KEY = "caseTypes";

async function get(key) {
  const r = await chrome.storage.local.get([key]);
  return r[key] || null;
}

async function set(key, value) {
  await chrome.storage.local.set({ [key]: value });
}

async function init() {
  const q = await get(QUEUE_KEY);
  const h = await get(HISTORY_KEY);
  const t = await get(TYPES_KEY);
  if (!Array.isArray(q)) await set(QUEUE_KEY, []);
  if (!Array.isArray(h)) await set(HISTORY_KEY, []);
  if (!Array.isArray(t)) await set(TYPES_KEY, ["Other", "Claim Reason", "Counterfeit", "Seller Status", "MSS Check", "ASIN Check", "Return Request", "Abort-PIV", "Abort-MULTI", "Abort-NEW" ]);
}

function nowIso() {
  return new Date().toISOString();
}

async function addToQueueIfUnique(url, openedAt) {
  const [queue, history] = await Promise.all([get(QUEUE_KEY), get(HISTORY_KEY)]);
  const exists = (Array.isArray(queue) ? queue : []).some(x => x.url === url) || (Array.isArray(history) ? history : []).some(x => x.url === url);
  if (exists) return false;
  const item = { url, openedAt, caseType: "" };
  const next = (Array.isArray(queue) ? queue : []);
  next.push(item);
  await set(QUEUE_KEY, next);
  return true;
}

async function updateCaseType(url, caseType) {
  const queue = await get(QUEUE_KEY);
  const history = await get(HISTORY_KEY);
  let updated = false;
  if (Array.isArray(queue)) {
    for (let i = 0; i < queue.length; i++) {
      if (queue[i].url === url) {
        queue[i].caseType = caseType;
        updated = true;
        break;
      }
    }
    if (updated) await set(QUEUE_KEY, queue);
  }
  if (!updated && Array.isArray(history)) {
    for (let i = 0; i < history.length; i++) {
      if (history[i].url === url) {
        history[i].caseType = caseType;
        updated = true;
        break;
      }
    }
    if (updated) await set(HISTORY_KEY, history);
  }
  return updated;
}

async function markCompleted(url) {
  const queue = await get(QUEUE_KEY);
  const history = await get(HISTORY_KEY);
  if (!Array.isArray(queue)) return false;
  const idx = queue.findIndex(x => x.url === url);
  if (idx === -1) return false;
  const item = queue[idx];
  if (!item.caseType || !item.caseType.trim()) return false;
  queue.splice(idx, 1);
  const completedAt = nowIso();
  const nextHistory = Array.isArray(history) ? history : [];
  nextHistory.push({ ...item, completedAt });
  await Promise.all([set(QUEUE_KEY, queue), set(HISTORY_KEY, nextHistory)]);
  return true;
}

async function removeQueueItem(url) {
  const queue = await get(QUEUE_KEY);
  if (!Array.isArray(queue)) return false;
  const next = queue.filter(x => x.url !== url);
  const changed = next.length !== queue.length;
  if (changed) await set(QUEUE_KEY, next);
  return changed;
}

async function addCaseType(name) {
  const types = await get(TYPES_KEY);
  const arr = Array.isArray(types) ? types : [];
  if (arr.includes(name)) return false;
  arr.push(name);
  await set(TYPES_KEY, arr);
  return true;
}

async function removeCaseType(name) {
  const types = await get(TYPES_KEY);
  const arr = Array.isArray(types) ? types : [];
  const next = arr.filter(x => x !== name);
  const changed = next.length !== arr.length;
  if (changed) await set(TYPES_KEY, next);
  return changed;
}

chrome.runtime.onInstalled.addListener(() => {
  init();
});

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const handle = async () => {
      if (message.type === "CAPTURE_LINK") {
        const url = message.url;
        const openedAt = message.openedAt || nowIso();
        const added = await addToQueueIfUnique(url, openedAt);
        return { ok: true, added };
      }
    if (message.type === "UPDATE_CASE_TYPE") {
      const updated = await updateCaseType(message.url, message.caseType);
      return { ok: updated };
    }
    if (message.type === "MARK_COMPLETED") {
      const done = await markCompleted(message.url);
      return { ok: done };
    }
    if (message.type === "REMOVE_QUEUE_ITEM") {
      const done = await removeQueueItem(message.url);
      return { ok: done };
    }
    if (message.type === "ADD_CASE_TYPE") {
      const ok = await addCaseType(message.name);
      return { ok };
    }
      if (message.type === "REMOVE_CASE_TYPE") {
        const ok = await removeCaseType(message.name);
        return { ok };
      }
      if (message.type === "CLEAR_HISTORY") {
        await set(HISTORY_KEY, []);
        return { ok: true };
      }
      if (message.type === "GET_DATA") {
        const [queue, history, caseTypes] = await Promise.all([
          get(QUEUE_KEY),
          get(HISTORY_KEY),
          get(TYPES_KEY)
        ]);
        return { queue: queue || [], history: history || [], caseTypes: caseTypes || [] };
      }
      return { ok: false };
    };
    handle().then(r => sendResponse(r));
    return true;
  });

chrome.action.onClicked.addListener(() => {
  const url = chrome.runtime.getURL("pages/queued.html");
  chrome.tabs.query({ url }, tabs => {
    if (tabs && tabs.length) {
      chrome.tabs.update(tabs[0].id, { active: true });
    } else {
      chrome.tabs.create({ url });
    }
  });
});