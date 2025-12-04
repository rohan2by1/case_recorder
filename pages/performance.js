// --- 1. Communication ---
async function send(message) {
  return await chrome.runtime.sendMessage(message);
}

// --- 2. Chart Instances ---
let chartByTypeInstance = null;
let chartTrendInstance = null;

// --- 3. Render Stats Cards ---
function renderStats(queue, history) {
  const el = document.getElementById("stats");
  const totalQueued = queue.length;
  const totalCompleted = history.length;

  // --- FIX: Count ANY case type that contains "abort" (case-insensitive) ---
  // This covers "Abort-PIV", "Abort-MULTI", "Abort-NEW", etc.
  const abortCount = history.filter(x => 
    (x.caseType || "").toLowerCase().includes("abort")
  ).length;

  // --- Calculate AHT (Average Handling Time) ---
  let totalDurationMs = 0;
  let validCases = 0;

  history.forEach(item => {
    // Optional: If you want to EXCLUDE Abort cases from the AHT calculation,
    // uncomment the line below:
    if ((item.caseType || "").toLowerCase().includes("abort")) return;

    if (item.openedAt && item.completedAt) {
      const start = new Date(item.openedAt).getTime();
      const end = new Date(item.completedAt).getTime();
      
      if (!isNaN(start) && !isNaN(end) && end >= start) {
        totalDurationMs += (end - start);
        validCases++;
      }
    }
  });

  const averageMs = validCases > 0 ? totalDurationMs / validCases : 0;

  // Helper to format ms
  const formatAHT = (ms) => {
    if (ms === 0) return "0s";
    const seconds = Math.floor((ms / 1000) % 60);
    const minutes = Math.floor((ms / (1000 * 60)) % 60);
    const hours = Math.floor(ms / (1000 * 60 * 60));

    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
  };

  const ahtDisplay = formatAHT(averageMs);

  el.innerHTML = `
    <div class="stats-grid">
      <div class="stat-card">
        <span class="stat-label">Queue Load</span>
        <span class="stat-value" style="color: #3b82f6">${totalQueued}</span>
      </div>
      
      <div class="stat-card">
        <span class="stat-label">Total Completed</span>
        <div style="display: flex; flex-direction: column;">
          <span class="stat-value" style="color: #10b981; line-height: 1;">${totalCompleted}</span>
          <span style="font-size: 11px; color: #ef4444; margin-top: 6px; font-weight: 600;">
            ${abortCount} Aborted
          </span>
        </div>
      </div>
      
      <div class="stat-card">
        <span class="stat-label">Avg Handling Time</span>
        <span class="stat-value" style="color: #f59e0b">${ahtDisplay}</span>
      </div>
    </div>
  `;
}

// --- 4. Render Bar Chart (By Type) ---
function renderByType(queue, history) {
  const map = new Map();
  const process = (list, key) => {
    list.forEach(x => {
      const k = x.caseType || "Unspecified";
      const v = map.get(k) || { queued: 0, completed: 0 };
      v[key]++;
      map.set(k, v);
    });
  };
  
  process(queue, 'queued');
  process(history, 'completed');

  // Table Data
  const tbody = document.querySelector("#byType tbody");
  tbody.innerHTML = "";
  const data = Array.from(map.entries()).sort((a, b) => (b[1].queued + b[1].completed) - (a[1].queued + a[1].completed));

  data.forEach(([type, v]) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${type}</td><td style="color: #3b82f6">${v.queued}</td><td style="color: #10b981">${v.completed}</td>`;
    tbody.appendChild(tr);
  });

  // Chart Data
  const labels = data.map(d => d[0]);
  const qData = data.map(d => d[1].queued);
  const cData = data.map(d => d[1].completed);

  const ctx = document.getElementById("chartByType");
  if (chartByTypeInstance) chartByTypeInstance.destroy();

  chartByTypeInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        { label: 'Queued', data: qData, backgroundColor: '#3b82f6', borderRadius: 4 },
        { label: 'Completed', data: cData, backgroundColor: '#10b981', borderRadius: 4 }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { labels: { color: '#94a3b8', font: {size: 11} } } },
      scales: {
        y: { beginAtZero: true, grid: { color: '#334155' }, ticks: { color: '#94a3b8' } },
        x: { grid: { display: false }, ticks: { color: '#94a3b8' } }
      }
    }
  });
}

// --- 5. Render Trend Chart ---
function istDateKey(ts) {
  const d = new Date(ts);
  const s = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  const [day, month, year] = s.split("/");
  return `${year}-${month}-${day}`;
}

function renderTrend(history) {
  const counts = new Map();
  history.forEach(x => {
    if (!x.completedAt) return;
    const key = istDateKey(x.completedAt);
    counts.set(key, (counts.get(key) || 0) + 1);
  });

  const days = [];
  const today = new Date();
  for (let i = 13; i >= 0; i--) { 
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    days.push(istDateKey(d.toISOString()));
  }

  const values = days.map(k => counts.get(k) || 0);
  const displayLabels = days.map(d => {
    const dateObj = new Date(d);
    return dateObj.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
  });

  const ctx = document.getElementById("chartTrend");
  if (chartTrendInstance) chartTrendInstance.destroy();

  chartTrendInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: displayLabels,
      datasets: [{
        label: 'Completed',
        data: values,
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        tension: 0.4,
        fill: true,
        pointRadius: 3
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, grid: { color: '#334155' }, ticks: { color: '#94a3b8', stepSize: 1 } },
        x: { grid: { display: false }, ticks: { color: '#94a3b8' } }
      }
    }
  });
}

// --- 6. Core Logic ---
let currentRange = null;

function parseIstInput(str) {
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d.getTime();
}

function inRange(ms) {
  if (!currentRange) return true;
  const t = typeof ms === "string" ? Date.parse(ms) : ms;
  return !Number.isNaN(t) && t >= currentRange.start && t <= currentRange.end;
}

function applyRangeFilter(queue, history) {
  if (!currentRange) return { queue, history };
  return {
    queue: queue.filter(x => inRange(x.openedAt)),
    history: history.filter(x => inRange(x.completedAt))
  };
}

// --- 7. Set Defaults Helper ---
function formatDefaultDate(date) {
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const yyyy = date.getFullYear();
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  return `${mm}/${dd}/${yyyy} ${hh}:${min}:${ss}`;
}

function setDefaults() {
  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0); 

  const startVal = formatDefaultDate(startOfDay);
  const endVal = formatDefaultDate(now);

  document.getElementById("startRange").value = startVal;
  document.getElementById("endRange").value = endVal;

  currentRange = {
    start: startOfDay.getTime(),
    end: now.getTime()
  };
  
  document.getElementById("applyRange").textContent = "Active";
}

async function load() {
  const r = await send({ type: "GET_DATA" });
  const f = applyRangeFilter(r.queue || [], r.history || []);
  renderStats(f.queue, f.history);
  renderByType(f.queue, f.history);
  renderTrend(f.history);
}

setDefaults();
load();

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && (changes.queue || changes.history)) load();
});

document.getElementById("applyRange").addEventListener("click", () => {
  const s = parseIstInput(document.getElementById("startRange").value);
  const e = parseIstInput(document.getElementById("endRange").value);
  if (s && e && e >= s) {
    currentRange = { start: s, end: e };
    document.getElementById("applyRange").textContent = "Active";
  } else {
    currentRange = null;
    alert("Invalid Date Range (Use MM/DD/YYYY)");
  }
  load();
});

document.getElementById("clearRange").addEventListener("click", () => {
  document.getElementById("startRange").value = "";
  document.getElementById("endRange").value = "";
  document.getElementById("applyRange").textContent = "Apply";
  currentRange = null;
  load();
});