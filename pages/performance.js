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
// --- 4. Render Doughnut Chart (By Type) ---
function renderByType(queue, history) {
  // 1. Process Data
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

  // Update Table (Same as before)
  const tbody = document.querySelector("#byType tbody");
  tbody.innerHTML = "";
  const data = Array.from(map.entries()).sort((a, b) => (b[1].queued + b[1].completed) - (a[1].queued + a[1].completed));

  data.forEach(([type, v]) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td style="font-weight:500; color:#fff;">${type}</td>
      <td style="color: var(--primary)">${v.queued}</td>
      <td style="color: var(--success)">${v.completed}</td>
    `;
    tbody.appendChild(tr);
  });

  const labels = data.map(d => d[0]);
  const qData = data.map(d => d[1].queued);
  const cData = data.map(d => d[1].completed);

  // 2. Define Colors (Rainbow Palette)
  const baseBgColors = [
    'rgba(255, 99, 132, 0.8)', 'rgba(255, 159, 64, 0.8)', 'rgba(255, 205, 86, 0.8)',
    'rgba(75, 192, 192, 0.8)', 'rgba(54, 162, 235, 0.8)', 'rgba(153, 102, 255, 0.8)',
    'rgba(201, 203, 207, 0.8)'
  ];
  
  // Faded colors for the Inner Ring (Queue)
  const fadedBgColors = [
    'rgba(255, 99, 132, 0.2)', 'rgba(255, 159, 64, 0.2)', 'rgba(255, 205, 86, 0.2)',
    'rgba(75, 192, 192, 0.2)', 'rgba(54, 162, 235, 0.2)', 'rgba(153, 102, 255, 0.2)',
    'rgba(201, 203, 207, 0.2)'
  ];
  
  const borderColors = [
    'rgb(255, 99, 132)', 'rgb(255, 159, 64)', 'rgb(255, 205, 86)',
    'rgb(75, 192, 192)', 'rgb(54, 162, 235)', 'rgb(153, 102, 255)',
    'rgb(201, 203, 207)'
  ];

  // Generator to stretch colors
  const bgMain = [];
  const bgFaded = [];
  const borders = [];
  
  for (let i = 0; i < labels.length; i++) {
    bgMain.push(baseBgColors[i % 7]);
    bgFaded.push(fadedBgColors[i % 7]);
    borders.push(borderColors[i % 7]);
  }

  // 3. Render Chart
  const ctxEl = document.getElementById("chartByType");
  const ctx = ctxEl.getContext('2d');

  if (chartByTypeInstance) chartByTypeInstance.destroy();

  chartByTypeInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [
        { 
          label: 'Completed', 
          data: cData, 
          backgroundColor: bgMain, 
          borderColor: '#2d2d2d', // Dark border to separate segments
          borderWidth: 2,
          hoverOffset: 4
        },
        { 
          label: 'Queued', 
          data: qData, 
          backgroundColor: bgFaded, 
          borderColor: borders,
          borderWidth: 1,
          weight: 0.6 // Makes this ring slightly thinner
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '40%', // Creates the Donut hole
      plugins: { 
        legend: { 
            position: 'right', // Moves legend to side for better use of space
            labels: { 
                color: '#94a3b8', 
                boxWidth: 12,
                font: { size: 11 }
            } 
        },
        tooltip: {
            backgroundColor: 'rgba(30, 30, 30, 0.95)',
            titleColor: '#fff',
            bodyColor: '#cbd5e1',
            borderColor: 'rgba(255,255,255,0.1)',
            borderWidth: 1,
            callbacks: {
                label: function(context) {
                    const label = context.dataset.label || '';
                    const val = context.raw || 0;
                    return `${label}: ${val}`;
                }
            }
        }
      }
    }
  });
}

// --- 5. Render Trend Chart ---
function istDateKey(ts) {
  const d = new Date(ts);
  // Using en-CA (YYYY-MM-DD) for correct sorting
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

function renderTrend(history) {
  // 1. Process Data (Same as before)
  const counts = new Map();
  history.forEach(x => {
    if (!x.completedAt) return;
    const key = istDateKey(x.completedAt);
    counts.set(key, (counts.get(key) || 0) + 1);
  });

  const days = [];
  const today = new Date();
  // Showing last 14 days
  for (let i = 30; i >= 0; i--) { 
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    days.push(istDateKey(d.toISOString()));
  }

  const values = days.map(k => counts.get(k) || 0);
  const displayLabels = days.map(d => {
    const dateObj = new Date(d);
    return dateObj.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
  });

  // 2. Define Colors (From your snippet)
  // We repeat them because your snippet has 7 colors but we display 14 days
  const baseBgColors = [
    'rgba(255, 99, 132, 0.2)', 'rgba(255, 159, 64, 0.2)', 'rgba(255, 205, 86, 0.2)',
    'rgba(75, 192, 192, 0.2)', 'rgba(54, 162, 235, 0.2)', 'rgba(153, 102, 255, 0.2)',
    'rgba(201, 203, 207, 0.2)'
  ];
  const baseBorderColors = [
    'rgb(255, 99, 132)', 'rgb(255, 159, 64)', 'rgb(255, 205, 86)',
    'rgb(75, 192, 192)', 'rgb(54, 162, 235)', 'rgb(153, 102, 255)',
    'rgb(201, 203, 207)'
  ];

  // Create array of 14 colors by repeating the 7 colors
  const finalBgColors = [...baseBgColors, ...baseBgColors];
  const finalBorderColors = [...baseBorderColors, ...baseBorderColors];

  // 3. Render Chart
  const ctxEl = document.getElementById("chartTrend");
  const ctx = ctxEl.getContext('2d');

  if (chartTrendInstance) chartTrendInstance.destroy();

  chartTrendInstance = new Chart(ctx, {
    type: 'bar', // Changed to Bar to match the style snippet
    data: {
      labels: displayLabels,
      datasets: [{
        label: 'Completed',
        data: values,
        backgroundColor: finalBgColors,
        borderColor: finalBorderColors,
        borderWidth: 1,
        borderRadius: 4, // Added slight rounded corners for modern look
        barPercentage: 0.7
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { 
        legend: { display: false },
        tooltip: {
            backgroundColor: 'rgba(30, 30, 30, 0.9)',
            titleColor: '#fff',
            bodyColor: '#cbd5e1',
            borderColor: 'rgba(255,255,255,0.1)',
            borderWidth: 1
        }
      },
      scales: {
        y: { 
            beginAtZero: true, 
            grid: { color: 'rgba(255, 255, 255, 0.05)' }, 
            ticks: { color: '#94a3b8', stepSize: 1 } 
        },
        x: { 
            grid: { display: false }, 
            ticks: { color: '#94a3b8' } 
        }
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