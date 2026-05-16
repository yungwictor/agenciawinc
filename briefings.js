const HISTORY_STORAGE_KEY = "winc_briefings_history";

const BRIEFING_CONFIG = {
  landing_pages: {
    prefix: "LP",
    tag: "#BriefingLPWinc",
    title: "Briefing Agência Winc | Landing Pages e Funis",
    companyField: "empresa_nome",
    contactField: "telefone_whatsapp",
  },
  identidade_visual: {
    prefix: "ID",
    tag: "#BriefingMarcaWinc",
    title: "Briefing Agência Winc | Posicionamento e Identidade Visual",
    companyField: "empresa_nome",
    contactField: "instagram_site",
  },
};

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll("[data-briefing-form]").forEach(initBriefingForm);
  renderHistoryLists();
});

function initBriefingForm(form) {
  const type = form.dataset.briefingForm;
  const config = BRIEFING_CONFIG[type];

  if (!config) {
    return;
  }

  const draftKey = `winc_draft_${type}`;
  const statusBox = form.querySelector(".briefing-status");

  restoreDraft(form, draftKey);

  form.addEventListener("input", () => persistDraft(form, draftKey));
  form.addEventListener("change", () => persistDraft(form, draftKey));

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    if (!form.reportValidity()) {
      return;
    }

    const protocol = createProtocol(config.prefix);
    const payload = buildBriefingMessage(form, config, protocol);

    saveHistory({
      protocol,
      type,
      tag: config.tag,
      company: payload.company,
      contact: payload.contact,
      createdAt: new Date().toISOString(),
      message: payload.message,
      whatsAppUrl: payload.whatsAppUrl,
    });

    localStorage.removeItem(draftKey);
    showStatus(statusBox, payload);
    renderHistoryLists();
    form.reset();

    const popup = window.open(payload.whatsAppUrl, "_blank", "noopener");
    if (!popup) {
      window.location.href = payload.whatsAppUrl;
    }
  });
}

function buildBriefingMessage(form, config, protocol) {
  const sections = [];

  form.querySelectorAll(".briefing-section").forEach((section) => {
    const title = section.dataset.title;
    const fieldNames = [];
    const seen = new Set();

    section.querySelectorAll("[name][data-label]").forEach((field) => {
      if (!seen.has(field.name)) {
        seen.add(field.name);
        fieldNames.push(field.name);
      }
    });

    const items = fieldNames
      .map((name) => {
        const fields = Array.from(section.querySelectorAll(`[name="${name}"]`));
        const label = fields[0]?.dataset.label || name;
        const value = extractFieldValue(fields);

        if (!value) {
          return null;
        }

        return { label, value };
      })
      .filter(Boolean);

    if (items.length) {
      sections.push({ title, items });
    }
  });

  const receivedAt = new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date());

  const company = getFirstFieldValue(form, config.companyField) || "Não informado";
  const contact = getFirstFieldValue(form, config.contactField) || "Não informado";

  const lines = [
    `*${config.title}*`,
    `Protocolo: ${protocol}`,
    `Tag: ${config.tag}`,
    `Recebido em: ${receivedAt}`,
    `Empresa: ${company}`,
    `Contato-base: ${contact}`,
    "",
  ];

  sections.forEach((section) => {
    lines.push(`*${section.title}*`);
    section.items.forEach((item) => {
      lines.push(`- ${item.label}: ${item.value}`);
    });
    lines.push("");
  });

  const message = lines.join("\n").trim();
  const phone = form.dataset.whatsapp || "558291875154";
  const whatsAppUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;

  return {
    protocol,
    company,
    contact,
    message,
    whatsAppUrl,
  };
}

function extractFieldValue(fields) {
  if (!fields.length) {
    return "";
  }

  const first = fields[0];

  if (first.type === "radio") {
    return fields.find((field) => field.checked)?.value.trim() || "";
  }

  if (first.type === "checkbox") {
    return fields
      .filter((field) => field.checked)
      .map((field) => field.value.trim())
      .join(", ");
  }

  return first.value.trim();
}

function getFirstFieldValue(form, name) {
  const fields = Array.from(form.querySelectorAll(`[name="${name}"]`));
  return extractFieldValue(fields);
}

function persistDraft(form, key) {
  const draft = {};
  const handled = new Set();

  form.querySelectorAll("[name]").forEach((field) => {
    if (handled.has(field.name)) {
      return;
    }

    handled.add(field.name);
    const fields = Array.from(form.querySelectorAll(`[name="${field.name}"]`));
    const first = fields[0];

    if (first.type === "radio") {
      draft[field.name] = fields.find((item) => item.checked)?.value || "";
      return;
    }

    if (first.type === "checkbox") {
      draft[field.name] = fields.filter((item) => item.checked).map((item) => item.value);
      return;
    }

    draft[field.name] = first.value;
  });

  localStorage.setItem(key, JSON.stringify(draft));
}

function restoreDraft(form, key) {
  const raw = localStorage.getItem(key);

  if (!raw) {
    return;
  }

  let draft;

  try {
    draft = JSON.parse(raw);
  } catch {
    return;
  }

  Object.entries(draft).forEach(([name, value]) => {
    const fields = Array.from(form.querySelectorAll(`[name="${name}"]`));
    if (!fields.length) {
      return;
    }

    const first = fields[0];

    if (first.type === "radio") {
      fields.forEach((field) => {
        field.checked = field.value === value;
      });
      return;
    }

    if (first.type === "checkbox") {
      const selected = Array.isArray(value) ? value : [];
      fields.forEach((field) => {
        field.checked = selected.includes(field.value);
      });
      return;
    }

    first.value = typeof value === "string" ? value : "";
  });
}

function saveHistory(entry) {
  let current = loadHistory();

  current.unshift(entry);
  current = current.slice(0, 20);
  localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(current));
}

function loadHistory() {
  let current = [];

  try {
    current = JSON.parse(localStorage.getItem(HISTORY_STORAGE_KEY) || "[]");
  } catch {
    current = [];
  }

  return Array.isArray(current) ? current : [];
}

function renderHistoryLists() {
  const history = loadHistory();

  document.querySelectorAll("[data-briefing-history]").forEach((container) => {
    const type = container.dataset.briefingHistory;
    const items = history.filter((entry) => entry.type === type).slice(0, 8);

    if (!items.length) {
      container.innerHTML =
        '<p class="briefing-inline-note">Nenhum briefing enviado ainda neste navegador. Assim que um envio for feito, ele aparece aqui com protocolo e data.</p>';
      return;
    }

    container.innerHTML = items
      .map((entry) => {
        const createdAt = new Intl.DateTimeFormat("pt-BR", {
          dateStyle: "short",
          timeStyle: "short",
        }).format(new Date(entry.createdAt));

        return `
          <article class="briefing-history-item">
            <div class="briefing-history-copy">
              <strong>${escapeHtml(entry.company || "Empresa não informada")}</strong>
              <span>${escapeHtml(entry.protocol)}</span>
              <p>${escapeHtml(createdAt)} · ${escapeHtml(entry.tag)}</p>
            </div>
            <div class="briefing-history-actions">
              <a href="${escapeAttribute(entry.whatsAppUrl)}" target="_blank" rel="noopener noreferrer">Abrir no WhatsApp</a>
            </div>
          </article>
        `;
      })
      .join("");
  });
}

function showStatus(statusBox, payload) {
  if (!statusBox) {
    return;
  }

  const blob = new Blob([payload.message], { type: "text/plain;charset=utf-8" });
  const downloadUrl = URL.createObjectURL(blob);

  if (statusBox.dataset.downloadUrl) {
    URL.revokeObjectURL(statusBox.dataset.downloadUrl);
  }

  statusBox.dataset.downloadUrl = downloadUrl;
  statusBox.classList.add("is-visible");
  statusBox.innerHTML = `
    <strong>Briefing pronto para envio.</strong>
    <p>O WhatsApp foi aberto com a mensagem organizada. Protocolo gerado: <strong>${payload.protocol}</strong>.</p>
    <div class="briefing-status-actions">
      <a href="${payload.whatsAppUrl}" target="_blank" rel="noopener noreferrer">Abrir WhatsApp novamente</a>
      <a href="${downloadUrl}" download="${payload.protocol}.txt">Baixar cópia em .txt</a>
    </div>
  `;

  statusBox.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function createProtocol(prefix) {
  const now = new Date();
  const parts = [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds()),
  ];

  return `${prefix}-${parts.join("")}`;
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function escapeAttribute(value) {
  return String(value).replaceAll('"', "&quot;");
}
