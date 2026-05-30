// App de etiquetado de tópicos — Wilkis 2026
// Vanilla JS, sin dependencias. Persistencia en localStorage.

const STORAGE_KEY = "zelizer_topic_labels_v1";
const PALETTE = [
  "#4682B4", "#E91E63", "#FFEB3B", "#2E5C2E", "#8B0000", "#FF9800",
  "#A4C8E1", "#8B4513", "#7B2D8E", "#1ABC9C", "#34495E", "#F8BBD0",
  "#27AE60", "#D35400", "#3498DB", "#9B59B6", "#F1C40F", "#16A085",
  "#C0392B", "#2980B9", "#E67E22", "#7F8C8D", "#BDC3C7", "#95A5A6",
  "#16A085",
];

let DATA = null;
let current = 0;

// ─────────────────────────────────────────────────────────────
// Persistencia
// ─────────────────────────────────────────────────────────────
function loadLabels() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) { return {}; }
}
function saveLabels(labels) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(labels));
}

// ─────────────────────────────────────────────────────────────
// Render
// ─────────────────────────────────────────────────────────────
function render() {
  const t = DATA.topics[current];
  const labels = loadLabels();
  const entry = labels[t.id] || { name: "", notes: "" };

  const maxScore = Math.max(...t.top_words.map(w => w.score));
  const color = PALETTE[current % PALETTE.length];

  const bars = t.top_words.map(w => {
    const pct = Math.max(2, (w.score / maxScore) * 100);
    return `
      <div class="bar-row">
        <span class="bar-word">${escapeHtml(w.word)}</span>
        <div class="bar-track"><div class="bar-fill" style="width: ${pct.toFixed(1)}%; background: ${color};"></div></div>
        <span class="bar-score">${w.score.toFixed(3)}</span>
      </div>
    `;
  }).join("");

  const countries = t.top_countries.filter(c => c.n_docs > 0).map(c =>
    `<span class="country-chip"><strong>${escapeHtml(c.country)}</strong> · ${c.n_docs} docs</span>`
  ).join("");

  const savedHtml = entry.name
    ? `<span class="saved-indicator saved-yes">✓ Guardado</span>`
    : `<span class="saved-indicator saved-no">⚠ Sin nombre</span>`;

  document.getElementById("topic-card").innerHTML = `
    <div class="card-header">
      <h2>${t.label} ${savedHtml}</h2>
      <div class="stats">${t.n_docs_dominant} docs con este tópico dominante</div>
    </div>

    <div class="bars">${bars}</div>

    <div class="country-list">${countries || "<em>Sin datos por país</em>"}</div>

    <div class="label-form">
      <label for="topic-name">Nombre interpretativo</label>
      <input type="text" id="topic-name" placeholder="Ej: Dinero íntimo / familia · Mercados morales · Valuación social…" value="${escapeAttr(entry.name)}">
      <textarea id="topic-notes" placeholder="Notas opcionales (subtemas, dudas, autores asociados…)">${escapeHtml(entry.notes)}</textarea>
    </div>
  `;

  // Wire up inputs
  const nameInput = document.getElementById("topic-name");
  const notesInput = document.getElementById("topic-notes");
  nameInput.focus();
  nameInput.select();
  nameInput.addEventListener("input", () => saveCurrent(nameInput.value, notesInput.value));
  notesInput.addEventListener("input", () => saveCurrent(nameInput.value, notesInput.value));
  // Enter en el nombre → guardar + avanzar al siguiente tópico
  nameInput.addEventListener("keydown", e => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      const val = nameInput.value.trim();
      if (!val) return;  // no avanzar si está vacío
      saveCurrent(nameInput.value, notesInput.value);
      goNext();
    }
  });

  // Pos and progress
  document.getElementById("pos").textContent = `${current + 1} / ${DATA.topics.length}`;
  updateProgress();
  renderList();

  // Nav buttons
  document.getElementById("btn-prev").disabled = current === 0;
  document.getElementById("btn-next").disabled = current === DATA.topics.length - 1;
}

function goNext() {
  // Buscar el próximo tópico sin etiquetar; si todos están etiquetados, ir al siguiente lineal
  const labels = loadLabels();
  const total = DATA.topics.length;

  // Si no estamos en el último, avanzar lineal
  if (current < total - 1) {
    current++;
    render();
    return;
  }

  // Estamos en el último. ¿Quedan no-etiquetados en posiciones anteriores?
  const sinEtiquetar = DATA.topics
    .map((t, i) => ({ i, name: (labels[t.id]?.name || "").trim() }))
    .filter(o => !o.name);

  if (sinEtiquetar.length > 0) {
    current = sinEtiquetar[0].i;
    render();
    return;
  }

  // ¡Terminó todos!
  showFinalScreen();
}

function showFinalScreen() {
  const labels = loadLabels();
  const n_labeled = DATA.topics.filter(t => (labels[t.id]?.name || "").length > 0).length;
  document.getElementById("topic-card").innerHTML = `
    <div class="final-screen">
      <h2>🎉 ¡Terminaste!</h2>
      <p>Etiquetaste los <strong>${n_labeled} tópicos</strong>.</p>
      <p>Ahora descargá el JSON y mandáselo a Joaquín:</p>
      <button id="btn-final-download" class="btn-final-download">
        📥 Descargar JSON con mis nombres
      </button>
      <button id="btn-final-md" class="btn-final-md">
        📋 Copiar como tabla Markdown
      </button>
      <p class="final-hint">
        Mandalo por mail, WhatsApp o como prefieras.<br>
        Si querés revisar / editar algo, podés volver con las flechas
        o clickeando un tópico de la lista de abajo.
      </p>
    </div>
  `;
  document.getElementById("btn-final-download").addEventListener("click", () => {
    exportJson();
    // Después de descargar mostrar un check visual
    const btn = document.getElementById("btn-final-download");
    btn.textContent = "✓ Descargado — ¡mandalo ahora!";
    btn.style.background = "#059669";
  });
  document.getElementById("btn-final-md").addEventListener("click", exportMarkdown);
  updateProgress();
  renderList();
  document.getElementById("pos").textContent = `${n_labeled} / ${DATA.topics.length}`;
}

function saveCurrent(name, notes) {
  const labels = loadLabels();
  const t = DATA.topics[current];
  labels[t.id] = { name: name.trim(), notes: notes.trim() };
  saveLabels(labels);
  updateProgress();
  renderList();
  // update saved indicator inline
  const ind = document.querySelector(".saved-indicator");
  if (ind) {
    if (name.trim()) {
      ind.className = "saved-indicator saved-yes";
      ind.textContent = "✓ Guardado";
    } else {
      ind.className = "saved-indicator saved-no";
      ind.textContent = "⚠ Sin nombre";
    }
  }
}

function updateProgress() {
  const labels = loadLabels();
  const n_labeled = DATA.topics.filter(t => (labels[t.id]?.name || "").length > 0).length;
  const pct = (n_labeled / DATA.topics.length) * 100;
  document.getElementById("progress").style.width = pct.toFixed(1) + "%";
  document.getElementById("progress-label").textContent =
    `${n_labeled} / ${DATA.topics.length} etiquetados`;
}

function renderList() {
  const labels = loadLabels();
  const ol = document.getElementById("topic-list");
  ol.innerHTML = DATA.topics.map((t, i) => {
    const lab = labels[t.id]?.name || "";
    const isCurrent = i === current ? " current" : "";
    const isLabeled = lab ? " labeled" : "";
    const top3 = t.top_words.slice(0, 3).map(w => w.word).join(", ");
    return `<li class="${isCurrent}${isLabeled}" data-idx="${i}">
      <span><span class="topic-num">${t.label}</span> ${lab ? `<span class="topic-name">— ${escapeHtml(lab)}</span>` : `<em style="color:#94a3b8">(${escapeHtml(top3)})</em>`}</span>
    </li>`;
  }).join("");
  ol.querySelectorAll("li").forEach(li => {
    li.addEventListener("click", () => {
      current = parseInt(li.dataset.idx);
      render();
    });
  });
}

// ─────────────────────────────────────────────────────────────
// Export / Import
// ─────────────────────────────────────────────────────────────
function exportJson() {
  const labels = loadLabels();
  const payload = {
    project: "Zelizer / Wilkis 2026",
    model: DATA.model,
    k: DATA.k,
    exported_at: new Date().toISOString(),
    labels: DATA.topics.map(t => ({
      id: t.id,
      label: t.label,
      top_words: t.top_words.slice(0, 5).map(w => w.word),
      name: labels[t.id]?.name || "",
      notes: labels[t.id]?.notes || "",
    })),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `zelizer_topic_labels_${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportMarkdown() {
  const labels = loadLabels();
  const rows = DATA.topics.map(t => {
    const top5 = t.top_words.slice(0, 5).map(w => w.word).join(", ");
    const name = labels[t.id]?.name || "*(sin nombre)*";
    const notes = (labels[t.id]?.notes || "").replace(/\n/g, " ");
    return `| ${t.label} | ${name} | ${top5} | ${notes} |`;
  }).join("\n");
  const md = `| ID | Nombre | Top words | Notas |\n|---|---|---|---|\n${rows}`;
  navigator.clipboard.writeText(md).then(() => {
    alert("✓ Tabla Markdown copiada al portapapeles");
  }).catch(() => {
    alert("No se pudo copiar. Acá va el texto:\n\n" + md);
  });
}

function importJson(file) {
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const parsed = JSON.parse(e.target.result);
      const labels = {};
      (parsed.labels || []).forEach(item => {
        if (item.id !== undefined) {
          labels[item.id] = { name: item.name || "", notes: item.notes || "" };
        }
      });
      saveLabels(labels);
      alert(`✓ Importadas ${Object.keys(labels).length} etiquetas`);
      render();
    } catch (err) {
      alert("Error al leer el JSON: " + err.message);
    }
  };
  reader.readAsText(file);
}

function clearAll() {
  if (!confirm("¿Borrar TODAS las etiquetas y empezar de cero?")) return;
  localStorage.removeItem(STORAGE_KEY);
  render();
}

// ─────────────────────────────────────────────────────────────
// Util
// ─────────────────────────────────────────────────────────────
function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function escapeAttr(s) { return escapeHtml(s); }

// ─────────────────────────────────────────────────────────────
// Init
// ─────────────────────────────────────────────────────────────
async function init() {
  try {
    const resp = await fetch("topics_data.json");
    DATA = await resp.json();
  } catch (e) {
    document.getElementById("topic-card").innerHTML =
      "<p style='color:red'>Error cargando topics_data.json: " + e.message + "</p>";
    return;
  }
  document.getElementById("meta").textContent =
    `Modelo: ${DATA.model} · K=${DATA.k} tópicos · ${DATA.n_docs_total.toLocaleString()} documentos · ${DATA.subset}`;

  document.getElementById("btn-prev").addEventListener("click", () => {
    if (current > 0) { current--; render(); }
  });
  document.getElementById("btn-next").addEventListener("click", () => {
    if (current < DATA.topics.length - 1) { current++; render(); }
  });
  document.getElementById("btn-export").addEventListener("click", exportJson);
  document.getElementById("btn-export-md").addEventListener("click", exportMarkdown);
  document.getElementById("btn-clear").addEventListener("click", clearAll);
  document.getElementById("btn-import").addEventListener("change", e => {
    if (e.target.files[0]) importJson(e.target.files[0]);
  });

  // Keyboard nav
  document.addEventListener("keydown", e => {
    if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
    if (e.key === "ArrowRight" && current < DATA.topics.length - 1) {
      current++; render();
    }
    if (e.key === "ArrowLeft" && current > 0) {
      current--; render();
    }
  });

  render();
}

init();
