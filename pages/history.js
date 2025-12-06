async function send(message) {
  return await chrome.runtime.sendMessage(message);
}

function fmt(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).format(d);
}

function fmtDuration(openedAt, completedAt) {
  if (!openedAt || !completedAt) return "";
  const start = Date.parse(openedAt);
  const end = Date.parse(completedAt);
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return "";
  const ms = end - start;
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");
  return `${mm}:${ss}`;
}

async function load() {
  const r = await send({ type: "GET_DATA" });
  const filter = document.getElementById("filter").value.trim().toLowerCase();
  const tbody = document.querySelector("#table tbody");
  tbody.innerHTML = "";
  let list = r.history || [];
  if (filter.length) list = list.filter(x => (x.caseType || "").toLowerCase().includes(filter));
  list.forEach((item, i) => {
    const tr = document.createElement("tr");
    const tdIndex = document.createElement("td");
    tdIndex.textContent = String(i + 1);
    const tdLink = document.createElement("td");
    tdLink.textContent = item.url;
    const tdOpened = document.createElement("td");
    tdOpened.textContent = fmt(item.openedAt);
    const tdType = document.createElement("td");
    tdType.textContent = item.caseType || "";
    const tdCompleted = document.createElement("td");
    tdCompleted.textContent = fmt(item.completedAt);
    const tdTimeTaken = document.createElement("td");
    tdTimeTaken.textContent = fmtDuration(item.openedAt, item.completedAt);
    const tdActions = document.createElement("td");
    const btnOpen = document.createElement("button");
    btnOpen.textContent = "Open";
    btnOpen.addEventListener("click", () => {
      chrome.tabs.create({ url: item.url });
    });
    tdActions.appendChild(btnOpen);
    tr.appendChild(tdIndex);
    tr.appendChild(tdLink);
    tr.appendChild(tdOpened);
    tr.appendChild(tdType);
    tr.appendChild(tdCompleted);
    tr.appendChild(tdTimeTaken);
    tr.appendChild(tdActions);
    tbody.appendChild(tr);
  });
}

document.getElementById("refresh").addEventListener("click", load);
document.getElementById("filter").addEventListener("input", load);
document.getElementById("clearHistory").addEventListener("click", async () => {
  const ok = confirm("This will permanently clear all case history. Proceed?");
  if (!ok) return;
  await send({ type: "CLEAR_HISTORY" });
});
load();

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if (changes.history) load();
});
