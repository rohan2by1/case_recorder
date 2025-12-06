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

async function load() {
  const r = await send({ type: "GET_DATA" });
  const tbody = document.querySelector("#table tbody");
  tbody.innerHTML = "";
  const list = r.queue || [];
  const types = r.caseTypes || [];
  const dl = document.querySelector("#caseTypes");
  dl.innerHTML = types.map(t => `<option value="${t}"></option>`).join("");
  list.forEach((item, i) => {
    const tr = document.createElement("tr");
    const tdIndex = document.createElement("td");
    tdIndex.textContent = String(i + 1);
    const tdLink = document.createElement("td");
    tdLink.textContent = item.url;
    const tdOpened = document.createElement("td");
    tdOpened.textContent = fmt(item.openedAt);
    const tdType = document.createElement("td");
    const input = document.createElement("input");
    input.setAttribute("list", "caseTypes");
    input.value = item.caseType || "";
    input.addEventListener("input", async () => {
      const v = input.value.trim();
      if (!v || v.length < 2) return;
      const lower = v.toLowerCase();
      const starts = (types || []).filter(t => t.toLowerCase().startsWith(lower));
      let best = null;
      if (starts.length === 1) {
        best = starts[0];
      } else if (starts.length === 0) {
        const contains = (types || []).filter(t => t.toLowerCase().includes(lower));
        if (contains.length === 1) best = contains[0];
      }
      if (best) {
        input.value = best;
        await send({ type: "UPDATE_CASE_TYPE", url: item.url, caseType: best });
        btnComplete.disabled = false;
      }
    });
    input.addEventListener("change", async () => {
      const v = input.value.trim();
      if (v.length === 0) return;
      await send({ type: "UPDATE_CASE_TYPE", url: item.url, caseType: v });
      btnComplete.disabled = !(v.length > 0);
    });
    tdType.appendChild(input);
    const tdActions = document.createElement("td");
    tdActions.className = "actions";
    const btnOpen = document.createElement("button");
    btnOpen.textContent = "Open";
    btnOpen.addEventListener("click", () => {
      chrome.tabs.create({ url: item.url });
    });
    const btnComplete = document.createElement("button");
    btnComplete.textContent = "Complete";
    btnComplete.disabled = !((item.caseType || "").trim().length > 0);
    btnComplete.addEventListener("click", async () => {
      await send({ type: "MARK_COMPLETED", url: item.url });
      await load();
    });
    const btnRemove = document.createElement("button");
    btnRemove.className = "secondary";
    btnRemove.textContent = "Remove";
    btnRemove.addEventListener("click", async () => {
      await send({ type: "REMOVE_QUEUE_ITEM", url: item.url });
      await load();
    });
    tdActions.appendChild(btnOpen);
    tdActions.appendChild(btnComplete);
    tdActions.appendChild(btnRemove);
    tr.appendChild(tdIndex);
    tr.appendChild(tdLink);
    tr.appendChild(tdOpened);
    tr.appendChild(tdType);
    tr.appendChild(tdActions);
    tbody.appendChild(tr);
  });
}

document.getElementById("refresh").addEventListener("click", load);
load();

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if (changes.queue || changes.caseTypes) load();
});
