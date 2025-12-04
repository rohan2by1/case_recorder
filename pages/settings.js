async function send(message) {
  return await chrome.runtime.sendMessage(message);
}

// Format Date to IST
function fmtIST(ts) {
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

// Calculate Duration (Time Taken)
function calcDuration(start, end) {
  if (!start || !end) return "";
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  
  if (isNaN(s) || isNaN(e) || e < s) return "0s";
  
  const ms = e - s;
  const seconds = Math.floor((ms / 1000) % 60);
  const minutes = Math.floor((ms / (1000 * 60)) % 60);
  const hours = Math.floor(ms / (1000 * 60 * 60));

  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

// Generic CSV Downloader
function downloadCsv(name, rows) {
  if (!rows.length) return;
  
  // Get headers from the first object keys to ensure order
  const keys = Object.keys(rows[0]);
  
  const escape = v => {
    const s = String(v ?? "");
    if (s.includes(",") || s.includes("\n") || s.includes("\"")) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const header = keys.join(",");
  const body = rows.map(r => keys.map(k => escape(r[k])).join(",")).join("\n");
  const csv = header + "\n" + body;

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function loadTypes() {
  const r = await send({ type: "GET_DATA" });
  const tbody = document.querySelector("#typesTable tbody");
  tbody.innerHTML = "";
  const list = r.caseTypes || [];

  list.forEach((name, i) => {
    const tr = document.createElement("tr");
    
    // Index Column
    const tdIndex = document.createElement("td");
    tdIndex.textContent = String(i + 1);
    
    // Name Column
    const tdName = document.createElement("td");
    tdName.textContent = name;
    
    // Actions Column
    const tdActions = document.createElement("td");
    tdActions.className = "actions"; // Matches your CSS
    
    const btnRemove = document.createElement("button");
    btnRemove.className = "secondary";
    btnRemove.textContent = "Remove";
    btnRemove.addEventListener("click", async () => {
      await send({ type: "REMOVE_CASE_TYPE", name });
      await loadTypes();
    });
    
    tdActions.appendChild(btnRemove);
    tr.appendChild(tdIndex);
    tr.appendChild(tdName);
    tr.appendChild(tdActions);
    tbody.appendChild(tr);
  });
}

// Add Type Listener
document.getElementById("addType").addEventListener("click", async () => {
  const input = document.getElementById("typeName");
  const name = input.value.trim();
  if (!name) return;
  await send({ type: "ADD_CASE_TYPE", name });
  input.value = "";
  await loadTypes();
});

// Export Queue
document.getElementById("exportQueue").addEventListener("click", async () => {
  const r = await send({ type: "GET_DATA" });
  
  // Mapping Queue Data
  const rows = (r.queue || []).map(x => ({
    "URL": x.url,
    "Case Type": x.caseType || "",
    "Opened": fmtIST(x.openedAt)
  }));
  
  downloadCsv("queue.csv", rows);
});

// Export History (With Time Taken)
document.getElementById("exportHistory").addEventListener("click", async () => {
  const r = await send({ type: "GET_DATA" });
  
  // Mapping History Data (Order determines CSV Column Order)
  const rows = (r.history || []).map(x => ({
    "URL": x.url,
    "Case Type": x.caseType || "",
    "Opened": fmtIST(x.openedAt),
    "Completed": fmtIST(x.completedAt),
    "Time Taken": calcDuration(x.openedAt, x.completedAt)
  }));
  
  downloadCsv("history.csv", rows);
});

// Initial Load
loadTypes();

// Listen for updates
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if (changes.caseTypes) loadTypes();
});