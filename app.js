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

  let savedHtml;
  if (entry.discarded) {
    savedHtml = `<span class="saved-indicator saved-discarded">✗ Descartado</span>`;
  } else if (entry.name) {
    savedHtml = `<span class="saved-indicator saved-yes">✓ Guardado</span>`;
  } else {
    savedHtml = `<span class="saved-indicator saved-no">⚠ Sin decidir</span>`;
  }

  const sourceBadge = t.source
    ? `<span class="source-badge source-${t.source.toLowerCase()}">${t.source}</span>`
    : "";
  document.getElementById("topic-card").innerHTML = `
    <div class="card-header">
      <h2>${t.label} ${sourceBadge} ${savedHtml}</h2>
      <div class="stats">${t.n_docs_dominant} docs con este tópico dominante</div>
    </div>

    <div class="bars">${bars}</div>

    <div class="country-list">${countries || "<em>Sin datos por país</em>"}</div>

    <div class="label-form">
      <label for="topic-name">Nombre interpretativo</label>
      <input type="text" id="topic-name" value="${escapeAttr(entry.name)}">
      <textarea id="topic-notes" placeholder="Notas opcionales (subtemas, dudas, autores asociados…)">${escapeHtml(entry.notes)}</textarea>
      <div class="action-row">
        <button id="btn-save-next" class="btn-save-next">
          Guardar y avanzar →
        </button>
        <button id="btn-discard" class="btn-discard" title="Descartar este tópico y seguir al próximo">
          ✗ Descartar
        </button>
      </div>
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
      doSaveAndAdvance(nameInput, notesInput);
    }
  });

  // Botón "Guardar y avanzar"
  document.getElementById("btn-save-next").addEventListener("click", () => {
    doSaveAndAdvance(nameInput, notesInput);
  });

  // Botón "Descartar"
  document.getElementById("btn-discard").addEventListener("click", () => {
    doDiscard(notesInput.value);
  });

  // Pos and progress
  document.getElementById("pos").textContent = `${current + 1} / ${DATA.topics.length}`;
  updateProgress();

  // Nav buttons
  document.getElementById("btn-prev").disabled = current === 0;
  document.getElementById("btn-next").disabled = current === DATA.topics.length - 1;
}

function doSaveAndAdvance(nameInput, notesInput) {
  const val = nameInput.value.trim();
  if (!val) {
    // Shake visual si está vacío
    nameInput.classList.add("shake");
    setTimeout(() => nameInput.classList.remove("shake"), 400);
    nameInput.focus();
    return;
  }
  saveCurrent(nameInput.value, notesInput.value, false);
  goNext();
}

function doDiscard(notes) {
  // Marca como descartado y avanza. Conserva notas si las hay.
  saveCurrent("", notes, true);
  goNext();
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

  // Estamos en el último. ¿Quedan tópicos SIN decidir (ni etiquetados ni descartados)?
  const sinDecidir = DATA.topics
    .map((t, i) => ({ i, entry: labels[t.id] || {} }))
    .filter(o => !(o.entry.name || "").trim() && !o.entry.discarded);

  if (sinDecidir.length > 0) {
    current = sinDecidir[0].i;
    render();
    return;
  }

  // ¡Terminó todos!
  showFinalScreen();
}

function showFinalScreen() {
  const labels = loadLabels();
  const n_labeled = DATA.topics.filter(t => (labels[t.id]?.name || "").length > 0).length;
  const n_discarded = DATA.topics.filter(t => labels[t.id]?.discarded).length;
  const stats = `<strong>${n_labeled} etiquetado${n_labeled !== 1 ? "s" : ""}</strong>` +
    (n_discarded > 0 ? ` y <strong>${n_discarded} descartado${n_discarded > 1 ? "s" : ""}</strong>` : "");
  document.getElementById("topic-card").innerHTML = `
    <div class="final-screen">
      <h2>🎉 ¡Terminaste!</h2>
      <p>${stats} de ${DATA.topics.length} tópicos.</p>
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
  document.getElementById("pos").textContent = `${n_labeled} / ${DATA.topics.length}`;
}

function saveCurrent(name, notes, discarded = false) {
  const labels = loadLabels();
  const t = DATA.topics[current];
  labels[t.id] = {
    name: name.trim(),
    notes: notes.trim(),
    discarded: !!discarded,
  };
  saveLabels(labels);
  updateProgress();
  // update saved indicator inline
  const ind = document.querySelector(".saved-indicator");
  if (ind) {
    if (discarded) {
      ind.className = "saved-indicator saved-discarded";
      ind.textContent = "✗ Descartado";
    } else if (name.trim()) {
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
  const n_discarded = DATA.topics.filter(t => labels[t.id]?.discarded).length;
  const n_decided = n_labeled + n_discarded;
  const pct = (n_decided / DATA.topics.length) * 100;
  document.getElementById("progress").style.width = pct.toFixed(1) + "%";
  const discTxt = n_discarded > 0 ? ` (${n_discarded} descartado${n_discarded > 1 ? "s" : ""})` : "";
  document.getElementById("progress-label").textContent =
    `${n_labeled} etiquetado${n_labeled !== 1 ? "s" : ""}${discTxt} / ${DATA.topics.length}`;
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
      source: t.source || "",
      top_words: t.top_words.slice(0, 5).map(w => w.word),
      name: labels[t.id]?.name || "",
      notes: labels[t.id]?.notes || "",
      discarded: !!labels[t.id]?.discarded,
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
    const entry = labels[t.id] || {};
    let name;
    if (entry.discarded) name = "*(descartado)*";
    else if (entry.name) name = entry.name;
    else name = "*(sin decidir)*";
    const notes = (entry.notes || "").replace(/\n/g, " ");
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
  const total = DATA.n_topics_total || DATA.k || DATA.topics.length;
  const breakdown = (DATA.n_nmf !== undefined)
    ? ` (${DATA.n_nmf} NMF + ${DATA.n_lda_inedito} LDA inéditos + ${DATA.n_bert_inedito} BERT inéditos)`
    : "";
  document.getElementById("meta").textContent =
    `${total} tópicos${breakdown} · ${DATA.n_docs_total.toLocaleString()} documentos · ${DATA.subset || DATA.model}`;

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
