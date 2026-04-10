(function () {
  "use strict";

  const DEPLOY_URL =
    "https://railway.com/deploy/openclaw-railway?referralCode=slayga&utm_medium=integration&utm_source=template&utm_campaign=wizard";

  // Provider definitions for step 1 card grid
  const PROVIDERS = [
    { id: "openrouter", name: "OpenRouter", tag: "Recommended", tagClass: "recommended", keys: ["OPENROUTER_API_KEY"] },
    { id: "openai", name: "OpenAI", tag: "GPT + voice", keys: ["OPENAI_API_KEY"] },
    { id: "anthropic", name: "Anthropic", tag: "Claude", keys: ["ANTHROPIC_API_KEY"] },
    { id: "google", name: "Google AI", tag: "Gemini", keys: ["GOOGLE_AI_API_KEY"] },
    { id: "groq", name: "Groq", tag: "Fast + voice", keys: ["GROQ_API_KEY"] },
    { id: "deepseek", name: "DeepSeek", tag: "", keys: ["DEEPSEEK_API_KEY"] },
    { id: "mistral", name: "Mistral", tag: "", keys: ["MISTRAL_API_KEY"] },
    { id: "xai", name: "xAI", tag: "Grok", keys: ["XAI_API_KEY"] },
    { id: "together", name: "Together AI", tag: "", keys: ["TOGETHER_API_KEY"] },
    { id: "fireworks", name: "Fireworks", tag: "", keys: ["FIREWORKS_API_KEY"] },
    { id: "kimi", name: "Kimi", tag: "", keys: ["KIMI_API_KEY"] },
    { id: "venice", name: "Venice", tag: "Privacy", keys: ["VENICE_API_KEY"] },
    { id: "aws", name: "AWS Bedrock", tag: "3 keys", keys: ["AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "AWS_REGION"] },
  ];

  const CHANNELS = ["telegram", "discord", "slack"];

  let varsData = null;
  let currentStep = 0;
  let selectedProviders = new Set();
  let selectedChannels = new Set();
  let selectedTier = "0";
  let fieldValues = {};

  // Load vars.json and initialize
  fetch("vars.json")
    .then((r) => r.json())
    .then((data) => {
      varsData = data;
      init();
    });

  function init() {
    buildProviderStep();
    buildModelStep();
    buildChannelStep();
    buildSecurityStep();
    buildExtrasStep();
    buildOutputStep();
    showStep(0);
  }

  function $(sel, parent) {
    return (parent || document).querySelector(sel);
  }
  function $$(sel, parent) {
    return Array.from((parent || document).querySelectorAll(sel));
  }

  // --- Step builders ---

  function buildProviderStep() {
    const grid = $(".provider-grid");
    PROVIDERS.forEach((p) => {
      const card = document.createElement("div");
      card.className = "provider-card";
      card.dataset.provider = p.id;
      card.innerHTML =
        '<div class="name">' + esc(p.name) + "</div>" +
        (p.tag ? '<div class="tag ' + (p.tagClass || "") + '">' + esc(p.tag) + "</div>" : "");
      card.addEventListener("click", () => toggleProvider(p.id, card));
      grid.appendChild(card);
    });
  }

  function toggleProvider(id, card) {
    if (selectedProviders.has(id)) {
      selectedProviders.delete(id);
      card.classList.remove("selected");
    } else {
      selectedProviders.add(id);
      card.classList.add("selected");
    }
    showProviderFields();
    updateModelHint();
    updateNav();
  }

  function showProviderFields() {
    const container = $("#provider-fields");
    container.innerHTML = "";
    const step = varsData.steps[0];
    const neededKeys = new Set();
    selectedProviders.forEach((pid) => {
      const prov = PROVIDERS.find((p) => p.id === pid);
      if (prov) prov.keys.forEach((k) => neededKeys.add(k));
    });
    step.fields.forEach((f) => {
      if (neededKeys.has(f.key)) {
        container.appendChild(buildField(f));
      }
    });
  }

  function buildModelStep() {
    const container = $("#model-fields");
    const step = varsData.steps[1];
    const mainFields = step.fields.filter((f) => !f.advanced);
    const advFields = step.fields.filter((f) => f.advanced);

    mainFields.forEach((f) => container.appendChild(buildField(f)));

    if (advFields.length) {
      const toggle = document.createElement("button");
      toggle.className = "advanced-toggle";
      toggle.type = "button";
      toggle.innerHTML = '<span class="chevron">&#9654;</span> Advanced model options';
      const advContainer = document.createElement("div");
      advContainer.className = "advanced-fields";
      advFields.forEach((f) => advContainer.appendChild(buildField(f)));
      toggle.addEventListener("click", () => {
        toggle.classList.toggle("open");
        advContainer.classList.toggle("open");
      });
      container.appendChild(toggle);
      container.appendChild(advContainer);
    }
  }

  function buildChannelStep() {
    const grid = $(".channel-grid");
    CHANNELS.forEach((ch) => {
      const card = document.createElement("div");
      card.className = "channel-card";
      card.dataset.channel = ch;
      card.innerHTML = '<div class="name">' + esc(ch.charAt(0).toUpperCase() + ch.slice(1)) + "</div>";
      card.addEventListener("click", () => toggleChannel(ch, card));
      grid.appendChild(card);
    });
  }

  function toggleChannel(ch, card) {
    if (selectedChannels.has(ch)) {
      selectedChannels.delete(ch);
      card.classList.remove("selected");
    } else {
      selectedChannels.add(ch);
      card.classList.add("selected");
    }
    showChannelFields();
    updateNav();
  }

  function showChannelFields() {
    const container = $("#channel-fields");
    container.innerHTML = "";
    const step = varsData.steps[2];
    step.fields.forEach((f) => {
      if (f.group && selectedChannels.has(f.group)) {
        container.appendChild(buildField(f));
      }
    });
  }

  function buildSecurityStep() {
    const list = $(".tier-list");
    const step = varsData.steps[3];
    const field = step.fields[0];
    field.options.forEach((opt) => {
      const card = document.createElement("div");
      card.className = "tier-card" + (opt.value === "0" ? " selected" : "");
      card.dataset.tier = opt.value;
      card.innerHTML =
        '<div class="tier-label">' + esc(opt.label) + "</div>" +
        '<div class="tier-desc">' + esc(opt.description) + "</div>";
      card.addEventListener("click", () => {
        $$(".tier-card").forEach((c) => c.classList.remove("selected"));
        card.classList.add("selected");
        selectedTier = opt.value;
      });
      list.appendChild(card);
    });
  }

  function buildExtrasStep() {
    const container = $("#extras-fields");
    const step = varsData.steps[4];
    const mainFields = step.fields.filter((f) => !f.advanced);
    const advFields = step.fields.filter((f) => f.advanced);

    mainFields.forEach((f) => container.appendChild(buildField(f)));

    if (advFields.length) {
      const toggle = document.createElement("button");
      toggle.className = "advanced-toggle";
      toggle.type = "button";
      toggle.innerHTML = '<span class="chevron">&#9654;</span> Advanced options';
      const advContainer = document.createElement("div");
      advContainer.className = "advanced-fields";
      advFields.forEach((f) => advContainer.appendChild(buildField(f)));
      toggle.addEventListener("click", () => {
        toggle.classList.toggle("open");
        advContainer.classList.toggle("open");
      });
      container.appendChild(toggle);
      container.appendChild(advContainer);
    }
  }

  function buildOutputStep() {
    // Built dynamically when shown
  }

  // --- Field builder ---

  function buildField(f) {
    const group = document.createElement("div");
    group.className = "field-group";
    group.dataset.key = f.key;

    let labelHtml =
      '<label for="f-' + f.key + '">' + esc(f.label) +
      (f.required ? '<span class="required">*</span>' : "") +
      "</label>";

    let descHtml = "";
    if (f.description) {
      let desc = esc(f.description);
      if (f.link) {
        desc += ' <a href="' + esc(f.link) + '" target="_blank" rel="noopener">Get one</a>';
      }
      descHtml = '<div class="field-desc">' + desc + "</div>";
    }

    let inputHtml = "";
    if (f.type === "select" && f.options) {
      inputHtml = '<select id="f-' + f.key + '" data-key="' + f.key + '">';
      if (!f.required) {
        inputHtml += "<option value=\"\">-</option>";
      }
      f.options.forEach((opt) => {
        const sel = f.default === opt.value ? " selected" : "";
        inputHtml +=
          '<option value="' + esc(opt.value) + '"' + sel + ">" + esc(opt.label) + "</option>";
      });
      inputHtml += "</select>";
    } else {
      const ph = f.placeholder ? ' placeholder="' + esc(f.placeholder) + '"' : "";
      inputHtml =
        '<input type="' + (f.type || "text") + '" id="f-' + f.key + '" data-key="' +
        f.key + '"' + ph + ' autocomplete="off">';
    }

    const errorHtml = '<div class="field-error"></div>';

    group.innerHTML = labelHtml + descHtml + inputHtml + errorHtml;

    // Bind value tracking
    const input = group.querySelector("input, select");
    input.addEventListener("input", () => {
      fieldValues[f.key] = input.value;
      group.classList.remove("error");
      updateNav();
    });
    input.addEventListener("change", () => {
      fieldValues[f.key] = input.value;
      updateNav();
    });

    // Restore value if exists
    if (fieldValues[f.key]) {
      input.value = fieldValues[f.key];
    }

    return group;
  }

  // --- Model hint ---

  function updateModelHint() {
    const hint = $(".model-hint");
    if (!hint) return;
    const step = varsData.steps[1];
    const modelField = step.fields[0];
    if (selectedProviders.size === 1) {
      const pid = Array.from(selectedProviders)[0];
      const example = modelField.examples && modelField.examples[pid];
      if (example) {
        hint.textContent = "Example: " + example;
        hint.style.display = "block";
        // Auto-fill placeholder
        const input = $("#f-LLM_PRIMARY_MODEL");
        if (input && !input.value) {
          input.placeholder = example;
        }
        return;
      }
    }
    hint.textContent = "";
    hint.style.display = "none";
  }

  // --- Navigation ---

  const STEP_COUNT = 6; // provider, model, channel, security, extras, output

  function showStep(idx) {
    currentStep = idx;
    $$(".step").forEach((s, i) => s.classList.toggle("active", i === idx));

    // Progress dots
    $$(".progress-dot").forEach((dot, i) => {
      dot.classList.toggle("done", i < idx);
      dot.classList.toggle("active", i === idx);
    });

    // On model step, update hint
    if (idx === 1) updateModelHint();

    // On output step, generate output
    if (idx === STEP_COUNT - 1) generateOutput();

    updateNav();
  }

  function updateNav() {
    $$(".step").forEach((step, idx) => {
      const nextBtn = step.querySelector(".btn-next");
      if (!nextBtn) return;
      if (idx === 0) {
        nextBtn.disabled = selectedProviders.size === 0;
      } else if (idx === 1) {
        nextBtn.disabled = !fieldValues["LLM_PRIMARY_MODEL"];
      } else if (idx === 2) {
        nextBtn.disabled = selectedChannels.size === 0;
      } else {
        nextBtn.disabled = false;
      }
    });
  }

  // Bind navigation buttons
  document.addEventListener("click", (e) => {
    if (e.target.closest(".btn-next") && !e.target.closest(".btn-next").disabled) {
      if (currentStep < STEP_COUNT - 1) showStep(currentStep + 1);
    }
    if (e.target.closest(".btn-back")) {
      if (currentStep > 0) showStep(currentStep - 1);
    }
  });

  // --- Output generation ---

  function generateOutput() {
    const lines = [];
    const comment = (text) => lines.push("# " + text);
    const blank = () => lines.push("");

    // Provider keys
    comment("LLM Provider");
    selectedProviders.forEach((pid) => {
      const prov = PROVIDERS.find((p) => p.id === pid);
      if (prov) {
        prov.keys.forEach((k) => {
          const val = fieldValues[k] || "";
          if (val) lines.push(k + "=" + val);
        });
      }
    });
    blank();

    // Model
    comment("Model");
    const primary = fieldValues["LLM_PRIMARY_MODEL"] || "";
    if (primary) lines.push("LLM_PRIMARY_MODEL=" + primary);
    ["LLM_HEARTBEAT_MODEL", "LLM_SUBAGENT_MODEL", "LLM_FALLBACK_MODELS", "LLM_IMAGE_MODEL"].forEach((k) => {
      if (fieldValues[k]) lines.push(k + "=" + fieldValues[k]);
    });
    blank();

    // Channel
    comment("Channel");
    selectedChannels.forEach((ch) => {
      const step = varsData.steps[2];
      step.fields.forEach((f) => {
        if (f.group === ch && fieldValues[f.key]) {
          lines.push(f.key + "=" + fieldValues[f.key]);
        }
      });
    });
    blank();

    // Security tier (skip if 0 / default)
    if (selectedTier !== "0") {
      comment("Security");
      lines.push("SECURITY_TIER=" + selectedTier);
      blank();
    }

    // Extras — only non-empty, non-default values
    const extrasStep = varsData.steps[4];
    const extrasLines = [];
    extrasStep.fields.forEach((f) => {
      const val = fieldValues[f.key];
      if (val && val !== f.default && val !== "") {
        extrasLines.push(f.key + "=" + val);
      }
    });
    if (extrasLines.length) {
      comment("Extras");
      extrasLines.forEach((l) => lines.push(l));
      blank();
    }

    // Count actual vars (non-comment, non-blank)
    const varCount = lines.filter((l) => l && !l.startsWith("#")).length;

    // Render
    const block = $(".output-text");
    block.textContent = lines.join("\n").trim();

    $(".var-count").textContent = varCount + " variable" + (varCount !== 1 ? "s" : "");

    // Deploy URL
    $(".deploy-link a").href = DEPLOY_URL;
  }

  // Copy button
  document.addEventListener("click", (e) => {
    const btn = e.target.closest(".copy-btn");
    if (!btn) return;
    const block = btn.closest(".output-block").querySelector(".output-text");
    const text = block.textContent.replace(/^# .+$/gm, "").replace(/\n{2,}/g, "\n").trim();
    navigator.clipboard.writeText(text).then(() => {
      btn.textContent = "Copied!";
      btn.classList.add("copied");
      setTimeout(() => {
        btn.textContent = "Copy";
        btn.classList.remove("copied");
      }, 2000);
    });
  });

  // --- Utilities ---

  function esc(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }
})();
