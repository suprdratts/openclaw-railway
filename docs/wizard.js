(function () {
  "use strict";

  var DEPLOY_URL =
    "https://railway.com/deploy/openclaw-railway?referralCode=slayga&utm_medium=integration&utm_source=template&utm_campaign=wizard";

  // Provider definitions for card grid
  var PROVIDERS = [
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
    { id: "moonshot", name: "Moonshot", tag: "", keys: ["MOONSHOT_API_KEY"] },
    { id: "venice", name: "Venice", tag: "Privacy", keys: ["VENICE_API_KEY"] },
    { id: "cloudflare", name: "Cloudflare", tag: "", keys: ["CLOUDFLARE_API_KEY"] },
    { id: "zai", name: "Z.AI", tag: "GLM", keys: ["ZAI_API_KEY"] },
    { id: "minimax", name: "MiniMax", tag: "API + Plan", keys: ["MINIMAX_API_KEY", "MINIMAX_CODE_PLAN_KEY"] },
    { id: "stepfun", name: "StepFun", tag: "", keys: ["STEPFUN_API_KEY"] },
    { id: "arcee", name: "Arcee AI", tag: "Trinity", keys: ["ARCEEAI_API_KEY"] },
    { id: "vercel", name: "Vercel AI", tag: "Gateway", keys: ["VERCEL_GATEWAY_API_KEY"] },
    { id: "aws", name: "AWS Bedrock", tag: "3 keys", keys: ["AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "AWS_REGION"] },
  ];

  var CHANNELS = ["telegram", "discord", "slack"];

  // Step sequences for each mode
  var QUICK_STEPS = ["provider", "model", "channel", "output"];
  var FULL_STEPS = ["provider", "model", "channel", "security", "identity", "search", "advanced", "output"];

  var varsData = null;
  var currentMode = null; // "quick" or "full"
  var activeSteps = [];
  var currentStepIndex = 0;
  var selectedProviders = new Set();
  var selectedChannels = new Set();
  var selectedTier = "0";
  var fieldValues = {};

  // Load vars.json and initialize
  fetch("vars.json")
    .then(function (r) { return r.json(); })
    .then(function (data) {
      varsData = data;
      init();
    });

  function init() {
    buildProviderStep();
    buildModelStep();
    buildChannelStep();
    buildSecurityStep();
    buildFieldStep("identity", "#identity-fields");
    buildFieldStep("search", "#search-fields");
    buildFieldStep("advanced", "#advanced-fields");
    bindModeSelector();
    bindNav();
  }

  function $(sel, parent) {
    return (parent || document).querySelector(sel);
  }
  function $$(sel, parent) {
    return Array.from((parent || document).querySelectorAll(sel));
  }

  // --- Mode selector ---

  function bindModeSelector() {
    $$(".mode-card").forEach(function (card) {
      card.addEventListener("click", function () {
        currentMode = card.dataset.mode;
        activeSteps = currentMode === "quick" ? QUICK_STEPS.slice() : FULL_STEPS.slice();
        $("#mode-selector").style.display = "none";
        $("#wizard").style.display = "block";
        $("#progress-bar").style.display = "flex";
        buildProgressDots();
        showStep(0);
      });
    });
  }

  function buildProgressDots() {
    var bar = $("#progress-bar");
    bar.innerHTML = "";
    activeSteps.forEach(function () {
      var dot = document.createElement("div");
      dot.className = "progress-dot";
      bar.appendChild(dot);
    });
  }

  // --- Step builders ---

  function buildProviderStep() {
    var grid = $(".provider-grid");
    PROVIDERS.forEach(function (p) {
      var card = document.createElement("div");
      card.className = "provider-card";
      card.dataset.provider = p.id;
      card.innerHTML =
        '<div class="name">' + esc(p.name) + "</div>" +
        (p.tag ? '<div class="tag ' + (p.tagClass || "") + '">' + esc(p.tag) + "</div>" : "");
      card.addEventListener("click", function () { toggleProvider(p.id, card); });
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
    var container = $("#provider-fields");
    container.innerHTML = "";
    var step = findStep("provider");
    var neededKeys = new Set();
    selectedProviders.forEach(function (pid) {
      var prov = PROVIDERS.find(function (p) { return p.id === pid; });
      if (prov) prov.keys.forEach(function (k) { neededKeys.add(k); });
    });
    step.fields.forEach(function (f) {
      if (neededKeys.has(f.key)) {
        container.appendChild(buildField(f));
      }
    });
  }

  function buildModelStep() {
    var container = $("#model-fields");
    var step = findStep("model");
    var mainFields = step.fields.filter(function (f) { return !f.advanced; });
    var advFields = step.fields.filter(function (f) { return f.advanced; });

    mainFields.forEach(function (f) { container.appendChild(buildField(f)); });

    if (advFields.length) {
      var toggle = document.createElement("button");
      toggle.className = "advanced-toggle";
      toggle.type = "button";
      toggle.innerHTML = "More model options";
      var advContainer = document.createElement("div");
      advContainer.className = "advanced-fields";
      advFields.forEach(function (f) { advContainer.appendChild(buildField(f)); });
      toggle.addEventListener("click", function () {
        toggle.classList.toggle("open");
        advContainer.classList.toggle("open");
        toggle.innerHTML = toggle.classList.contains("open") ? "Fewer model options" : "More model options";
      });
      container.appendChild(toggle);
      container.appendChild(advContainer);
    }
  }

  function buildChannelStep() {
    var grid = $(".channel-grid");
    CHANNELS.forEach(function (ch) {
      var card = document.createElement("div");
      card.className = "channel-card";
      card.dataset.channel = ch;
      card.innerHTML = '<div class="name">' + esc(ch.charAt(0).toUpperCase() + ch.slice(1)) + "</div>";
      card.addEventListener("click", function () { toggleChannel(ch, card); });
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
    var container = $("#channel-fields");
    container.innerHTML = "";
    var step = findStep("channel");
    step.fields.forEach(function (f) {
      if (f.group && selectedChannels.has(f.group)) {
        container.appendChild(buildField(f));
      }
    });
  }

  function buildSecurityStep() {
    var list = $(".tier-list");
    var step = findStep("security");
    var field = step.fields[0];
    field.options.forEach(function (opt) {
      var card = document.createElement("div");
      card.className = "tier-card" + (opt.value === "0" ? " selected" : "");
      card.dataset.tier = opt.value;
      var badgeHtml = opt.badge ? '<span class="tier-badge">' + esc(opt.badge) + "</span>" : "";
      card.innerHTML =
        '<div class="tier-label">' + esc(opt.label) + badgeHtml + "</div>" +
        '<div class="tier-desc">' + esc(opt.description) + "</div>";
      card.addEventListener("click", function () {
        $$(".tier-card").forEach(function (c) { c.classList.remove("selected"); });
        card.classList.add("selected");
        selectedTier = opt.value;
      });
      list.appendChild(card);
    });
  }

  function buildFieldStep(stepId, containerSel) {
    var container = $(containerSel);
    var step = findStep(stepId);
    if (!step) return;
    step.fields.forEach(function (f) {
      container.appendChild(buildField(f));
    });
  }

  // --- Field builder ---

  function buildField(f) {
    var group = document.createElement("div");
    group.className = "field-group";
    group.dataset.key = f.key;

    // Handle dependsOn visibility
    if (f.dependsOn) {
      group.dataset.dependsOnKey = f.dependsOn.key;
      group.dataset.dependsOnValue = f.dependsOn.value;
      if (fieldValues[f.dependsOn.key] !== f.dependsOn.value) {
        group.classList.add("hidden");
      }
    }

    var labelHtml =
      '<label for="f-' + f.key + '">' + esc(f.label) +
      (f.required ? '<span class="required">*</span>' : "") +
      "</label>";

    var descHtml = "";
    if (f.description) {
      var desc = esc(f.description);
      if (f.link) {
        desc += ' <a href="' + esc(f.link) + '" target="_blank" rel="noopener">Get one</a>';
      }
      descHtml = '<div class="field-desc">' + desc + "</div>";
    }

    var inputHtml = "";
    if (f.type === "select" && f.options) {
      inputHtml = '<select id="f-' + f.key + '" data-key="' + f.key + '">';
      if (!f.required) {
        inputHtml += '<option value="">-</option>';
      }
      f.options.forEach(function (opt) {
        var sel = f.default === opt.value ? " selected" : "";
        inputHtml +=
          '<option value="' + esc(opt.value) + '"' + sel + ">" + esc(opt.label) + "</option>";
      });
      inputHtml += "</select>";
    } else {
      var ph = f.placeholder ? ' placeholder="' + esc(f.placeholder) + '"' : "";
      inputHtml =
        '<input type="' + (f.type || "text") + '" id="f-' + f.key + '" data-key="' +
        f.key + '"' + ph + ' autocomplete="off">';
    }

    var errorHtml = '<div class="field-error"></div>';

    group.innerHTML = labelHtml + descHtml + inputHtml + errorHtml;

    // Bind value tracking
    var input = group.querySelector("input, select");
    var onUpdate = function () {
      fieldValues[f.key] = input.value;
      group.classList.remove("error");
      updateDependentFields(f.key, input.value);
      updateNav();
    };
    input.addEventListener("input", onUpdate);
    input.addEventListener("change", onUpdate);

    // Restore value if exists
    if (fieldValues[f.key]) {
      input.value = fieldValues[f.key];
    }

    return group;
  }

  function updateDependentFields(key, value) {
    $$('[data-depends-on-key="' + key + '"]').forEach(function (group) {
      var expectedValue = group.dataset.dependsOnValue;
      group.classList.toggle("hidden", value !== expectedValue);
    });
  }

  // --- Model hint + autofill ---

  function updateModelHint() {
    var hint = $(".model-hint");
    var autofill = $(".model-autofill");
    var autofillBtn = $(".btn-autofill");
    if (!hint) return;

    var step = findStep("model");
    var modelField = step.fields[0];

    if (selectedProviders.size === 1) {
      var pid = Array.from(selectedProviders)[0];
      var example = modelField.examples && modelField.examples[pid];
      if (example) {
        hint.textContent = "Suggested for " + providerName(pid) + ":";
        hint.style.display = "block";
        autofillBtn.textContent = example;
        autofill.style.display = "block";
        autofillBtn.onclick = function () {
          var input = $("#f-LLM_PRIMARY_MODEL");
          if (input) {
            input.value = example;
            fieldValues["LLM_PRIMARY_MODEL"] = example;
            updateNav();
          }
        };
        // Update placeholder
        var input = $("#f-LLM_PRIMARY_MODEL");
        if (input && !input.value) {
          input.placeholder = example;
        }
        return;
      }
    }
    hint.style.display = "none";
    autofill.style.display = "none";
  }

  function providerName(pid) {
    var p = PROVIDERS.find(function (pr) { return pr.id === pid; });
    return p ? p.name : pid;
  }

  // --- Navigation ---

  function currentStepId() {
    return activeSteps[currentStepIndex];
  }

  function showStep(idx) {
    currentStepIndex = idx;
    var stepId = activeSteps[idx];

    // Hide all steps, show active
    $$(".step").forEach(function (s) { s.classList.remove("active"); });
    var activeStep = $('[data-step-id="' + stepId + '"]');
    if (activeStep) activeStep.classList.add("active");

    // Progress dots
    $$(".progress-dot").forEach(function (dot, i) {
      dot.classList.toggle("done", i < idx);
      dot.classList.toggle("active", i === idx);
    });

    // Step-specific triggers
    if (stepId === "model") updateModelHint();
    if (stepId === "output") generateOutput();

    updateNav();
    window.scrollTo(0, 0);
  }

  function updateNav() {
    $$(".step").forEach(function (step) {
      var stepId = step.dataset.stepId;
      var nextBtn = step.querySelector(".btn-next");
      if (!nextBtn) return;

      if (stepId === "provider") {
        nextBtn.disabled = selectedProviders.size === 0;
      } else if (stepId === "model") {
        nextBtn.disabled = !fieldValues["LLM_PRIMARY_MODEL"];
      } else if (stepId === "channel") {
        nextBtn.disabled = selectedChannels.size === 0;
      } else {
        nextBtn.disabled = false;
      }

      // Update label on last step before output
      var stepIdx = activeSteps.indexOf(stepId);
      if (stepIdx === activeSteps.length - 2) {
        nextBtn.textContent = "Generate Config";
      }
    });
  }

  function bindNav() {
    document.addEventListener("click", function (e) {
      if (e.target.closest(".btn-next") && !e.target.closest(".btn-next").disabled) {
        if (currentStepIndex < activeSteps.length - 1) showStep(currentStepIndex + 1);
      }
      if (e.target.closest(".btn-back")) {
        if (currentStepIndex > 0) {
          showStep(currentStepIndex - 1);
        } else {
          // Back from first step goes to mode selector
          resetToModeSelector();
        }
      }
      if (e.target.closest(".btn-restart")) {
        resetToModeSelector();
      }
    });
  }

  function resetToModeSelector() {
    $("#wizard").style.display = "none";
    $("#progress-bar").style.display = "none";
    $("#mode-selector").style.display = "block";
    $$(".step").forEach(function (s) { s.classList.remove("active"); });
    currentMode = null;
    activeSteps = [];
    currentStepIndex = 0;
  }

  // --- Output generation ---

  function generateOutput() {
    var lines = [];
    function comment(text) { lines.push("# " + text); }
    function blank() { lines.push(""); }

    // Provider keys
    comment("LLM Provider");
    selectedProviders.forEach(function (pid) {
      var prov = PROVIDERS.find(function (p) { return p.id === pid; });
      if (prov) {
        prov.keys.forEach(function (k) {
          var val = fieldValues[k] || "";
          if (val) lines.push(k + "=" + val);
        });
      }
    });
    blank();

    // Model
    comment("Model");
    var primary = fieldValues["LLM_PRIMARY_MODEL"] || "";
    if (primary) lines.push("LLM_PRIMARY_MODEL=" + primary);
    ["LLM_HEARTBEAT_MODEL", "LLM_SUBAGENT_MODEL", "LLM_FALLBACK_MODELS", "LLM_IMAGE_MODEL"].forEach(function (k) {
      if (fieldValues[k]) lines.push(k + "=" + fieldValues[k]);
    });
    blank();

    // Channel
    comment("Channel");
    selectedChannels.forEach(function (ch) {
      var step = findStep("channel");
      step.fields.forEach(function (f) {
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

    // Identity
    var identityLines = collectStepValues("identity");
    if (identityLines.length) {
      comment("Identity");
      identityLines.forEach(function (l) { lines.push(l); });
      blank();
    }

    // Search
    var searchLines = collectStepValues("search");
    if (searchLines.length) {
      comment("Search");
      searchLines.forEach(function (l) { lines.push(l); });
      blank();
    }

    // Advanced
    var advancedLines = collectStepValues("advanced");
    if (advancedLines.length) {
      comment("Advanced");
      advancedLines.forEach(function (l) { lines.push(l); });
      blank();
    }

    // Count actual vars (non-comment, non-blank)
    var varCount = lines.filter(function (l) { return l && !l.startsWith("#"); }).length;

    // Render
    var block = $(".output-text");
    block.textContent = lines.join("\n").trim();

    $(".var-count").textContent = varCount + " variable" + (varCount !== 1 ? "s" : "");

    // Deploy URL
    $(".deploy-link a").href = DEPLOY_URL;
  }

  function collectStepValues(stepId) {
    var step = findStep(stepId);
    if (!step) return [];
    var out = [];
    step.fields.forEach(function (f) {
      var val = fieldValues[f.key];
      if (val && val !== f.default && val !== "") {
        // Skip hidden dependent fields
        if (f.dependsOn && fieldValues[f.dependsOn.key] !== f.dependsOn.value) return;
        out.push(f.key + "=" + val);
      }
    });
    return out;
  }

  // Copy button
  document.addEventListener("click", function (e) {
    var btn = e.target.closest(".copy-btn");
    if (!btn) return;
    var block = btn.closest(".output-block").querySelector(".output-text");
    var text = block.textContent.replace(/^# .+$/gm, "").replace(/\n{2,}/g, "\n").trim();
    navigator.clipboard.writeText(text).then(function () {
      btn.textContent = "Copied!";
      btn.classList.add("copied");
      setTimeout(function () {
        btn.textContent = "Copy";
        btn.classList.remove("copied");
      }, 2000);
    });
  });

  // --- Utilities ---

  function findStep(id) {
    return varsData.steps.find(function (s) { return s.id === id; });
  }

  function esc(str) {
    var div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }
})();
