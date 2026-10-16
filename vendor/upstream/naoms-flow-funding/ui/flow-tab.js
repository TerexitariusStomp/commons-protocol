/**
 * src/packages/flow-funding/ui/flow-tab.js — 1644 Flow feature tab.
 *
 * The Flow Funding surfaces (velocity / policy / agreement / simulation).
 *
 * @competitors: Open Collective, Grassroots Economics (Sarafu), Circles UBI
 * @competitor-reference: src/packages/flow-funding/docs/design/flow-funding-competitor-reference.md
 */
// Mounts the four REAL surfaces (flow-surfaces.js — hand-maintained honest
// markup, 1710 mock purge; no seeded figures, no synthetic peers) behind a
// small surface nav and wires them to the live flow.* ops:
//   - Policy    → ctx.api.get_policy / policy_set
//   - Agreement → ctx.api.agreement_propose
//   - Velocity  → graph reads (flow_agreement / flow_settlement / flow_policy)
//   - Simulate  → ctx.api.simulate (real engine, dry-run, commits nothing)
// Sections without a backing op (felt-threshold inference, anti-hoarding,
// commons tithe, transparency = M-TRANSPARENCY) carry an explicit
// "preview · not yet saved" tag in the static markup — never
// synthetic-as-real (Honesty axiom / Honor Rule). The same real DOM renders
// under NAOMS_UI_MOCK (skip-login testing mode): skip-login opens the real WS
// and real feature registry, so the surfaces read real (usually empty) data.

(function () {
  "use strict";

  if (!window._naomsFeatures) window._naomsFeatures = {};

  window._naomsFeatures["flow-funding"] = {
    id: "flow-funding",
    name: "Flow Funding",
    category: "data",
    placement: { category: "data" },
    init: init,
    activate: activate,
    destroy: destroy,
  };

  var ctx = null;
  var container = null;

  // C1/G1: contexts are enumerated from the user's REAL hives at activate time
  // (loadContexts → ctx.graphQuery({type:"hive"})), plus the holon-local
  // "Personal" self-context. NO hardcoded example contexts. Populated into
  // state.contexts; the Policy nav/pills render from it.
  var PERSONAL_CONTEXT = { id: "personal", label: "Personal" };
  var CURVE_GRADIENT = {
    "Generous early": 0.8,
    "Linear": 0.5,
    "Cautious": 0.2,
  };
  var CCY_LABEL = {
    USD: "US dollars ($)",
    NAO: "NAO hours",
    CARE: "Care credits",
  };
  var CCY_FMT = {
    USD: { sym: "$", suf: "" },
    NAO: { sym: "", suf: " hrs" },
    CARE: { sym: "", suf: " cr" },
  };

  var SURFACES = [
    { id: "policy", label: "Policy" },
    { id: "agreement", label: "New agreement" },
    { id: "velocity", label: "Flow" },
    { id: "simulate", label: "Simulate" },
  ];

  var state = {
    context: "personal",
    ccy: "USD",
    gradient: 0.5,
    felt: false,
    contributorTier: "founding",
    duration: "none",
    contexts: [PERSONAL_CONTEXT],
    contextsLoaded: false,
    // C7 — the REAL token this flow moves value with. token.pay/balance need a
    // real tokenId node (not the KIND label custom), else UI-armed settlement
    // is refused (paid:0). Populated from the token.list op (reuse, not a new
    // widget). Null when the user holds no token → honest empty-state, never a
    // silent custom fallback.
    tokenId: null,
    tokenLabel: "",
    tokens: [],
  };

  function init(featureCtx) {
    if (!featureCtx) return;
    ctx = featureCtx;
    container = ctx.container;
  }

  function activate() {
    if (!container) return;
    loadSurfacesModule(function () {
      // C7 — load the user's REAL tokens (token.list) BEFORE surfaces mount so
      // ALL surfaces (velocity settle + policy) see state.tokenId.
      loadContexts(function () {
        loadTokens(mountWired);
      });
    });
  }

  // C7 — enumerate the REAL tokens the user holds by REUSING the token.list op
  // (src/packages/token/tools-list-show.ts handleList). No new token-list op or
  // widget. filter:"all" so the payer sees tokens they issued/minted (the ones
  // they can flow value with). Defaults state.tokenId to the first token that
  // carries a real id (preferring one with a non-zero balance). Tolerant of an
  // absent/failing sendReq (unit context) — leaves state.tokenId null for the
  // honest empty-state. ALWAYS calls done() (chains the mount; never blocks it).
  function loadTokens(done) {
    var q = null;
    try {
      if (typeof ctx.sendReq === "function") {
        q = ctx.sendReq({ type: "token.list", filter: "all" });
      }
    } catch (_e) {
      q = null;
    }
    if (!q) return done();
    Promise.resolve(q).then(function (resp) {
      if (resp && resp.ok && Array.isArray(resp.tokens)) {
        state.tokens = resp.tokens.filter(function (t) {
          return t && t.id;
        });
        var chosen = null;
        for (var i = 0; i < state.tokens.length; i++) {
          var t = state.tokens[i];
          var held = (Number(t.final) || 0) + (Number(t.pending) || 0);
          if (held > 0) {
            chosen = t;
            break;
          }
        }
        if (!chosen && state.tokens.length > 0) chosen = state.tokens[0];
        if (chosen) {
          state.tokenId = chosen.id;
          state.tokenLabel = chosen.humanLabel || chosen.kind || chosen.id;
        }
      }
      done();
    }, function () {
      done();
    });
  }

  // C1/G1 — enumerate the REAL contexts a policy can bind to: the holon-local
  // "Personal" self-context + every hive the user actually belongs to
  // (ctx.graphQuery({type:"hive"}), the same read wallet-tab/repos-tab use). No
  // hardcoded example contexts. Honest empty-state = only "Personal" when the
  // user has no hives. Tolerant of an absent graphQuery (unit context) — falls
  // back to the Personal self-context alone.
  function loadContexts(done) {
    var base = [PERSONAL_CONTEXT];
    var q = null;
    try {
      if (typeof ctx.graphQuery === "function") {
        q = ctx.graphQuery({ type: "hive", limit: 200 });
      }
    } catch (_e) {
      q = null;
    }
    if (!q) {
      state.contexts = base;
      state.context = base[0].id;
      state.contextsLoaded = true;
      return done();
    }
    Promise.resolve(q).then(function (r) {
      var nodes = (r && r.nodes) ? r.nodes : (Array.isArray(r) ? r : []);
      var hives = [];
      for (var i = 0; i < nodes.length; i++) {
        var p = propsOf(nodes[i]);
        var id = p.chainId || p.chain_id || p.hiveChainId || p.id ||
          nodes[i].id || "";
        var label = p.name || p.label || nodes[i].label || id;
        if (id) hives.push({ id: String(id), label: String(label) });
      }
      state.contexts = base.concat(hives);
      state.context = state.contexts[0].id;
      state.contextsLoaded = true;
      done();
    }, function () {
      state.contexts = base;
      state.context = base[0].id;
      state.contextsLoaded = true;
      done();
    });
  }

  function contextById(id) {
    for (var i = 0; i < state.contexts.length; i++) {
      if (state.contexts[i].id === id) return state.contexts[i];
    }
    return null;
  }

  function destroy() {
    if (container) container.innerHTML = "";
  }

  // ── wired shell: surface nav + content + status ─────────────────────────────

  function mountWired() {
    var surfaces = window.__flowSurfaces;
    if (!surfaces || !surfaces.policy) {
      container.textContent = "Flow surfaces failed to load.";
      return;
    }
    if (
      !ctx.api || typeof ctx.api.get_policy !== "function" ||
      typeof ctx.api.policy_set !== "function"
    ) {
      container.textContent =
        "Flow operations are unavailable on this context — cannot wire the surfaces.";
      return;
    }
    ensureSurfacesCss();
    container.innerHTML = "";

    var root = document.createElement("div");
    root.id = "flow-app";
    root.style.cssText =
      "position:relative;height:100%;min-height:0;overflow:hidden;display:flex;flex-direction:column;background:var(--color-surface-0,#0d1117)";

    var nav = document.createElement("div");
    nav.id = "flow-wired-nav";
    nav.style.cssText =
      "flex:0 0 auto;display:flex;gap:6px;padding:8px 12px;border-bottom:1px solid var(--color-border,#30363d);background:var(--color-surface-1,#161b22);align-items:center";
    SURFACES.forEach(function (s) {
      var b = document.createElement("button");
      b.textContent = s.label;
      b.dataset.surface = s.id;
      b.style.cssText =
        "font:inherit;cursor:pointer;padding:5px 12px;border-radius:8px;border:1px solid var(--color-border,#30363d);background:var(--color-surface-2,#21262d);color:var(--color-text-secondary,#8b949e);font-size:.82rem;font-weight:600";
      b.onclick = function () {
        showSurface(s.id);
      };
      nav.appendChild(b);
    });

    var content = document.createElement("div");
    content.id = "flow-wired-content";
    content.style.cssText =
      "flex:1;min-height:0;position:relative;overflow:auto";

    var status = document.createElement("div");
    status.id = "flow-status";
    status.style.cssText =
      "flex:0 0 auto;font-size:.82rem;padding:8px 16px;border-top:1px solid var(--color-border,#30363d);background:var(--color-surface-1,#161b22);color:var(--color-text-secondary,#8b949e)";

    root.appendChild(nav);
    root.appendChild(content);
    root.appendChild(status);
    container.appendChild(root);

    window.__flowShowSurface = showSurface;
    showSurface("policy");
  }

  function showSurface(name) {
    var nav = document.getElementById("flow-wired-nav");
    if (nav) {
      Array.prototype.forEach.call(
        nav.querySelectorAll("button"),
        function (b) {
          var on = b.dataset.surface === name;
          b.style.background = on
            ? "var(--color-primary-muted,rgba(88,166,255,.15))"
            : "var(--color-surface-2,#21262d)";
          b.style.color = on
            ? "var(--color-primary,#58a6ff)"
            : "var(--color-text-secondary,#8b949e)";
          b.style.borderColor = on
            ? "var(--color-primary,#58a6ff)"
            : "var(--color-border,#30363d)";
        },
      );
    }
    if (name === "policy") return mountPolicy();
    if (name === "agreement") return mountAgreement();
    if (name === "simulate") return mountSimulate();
    if (name === "velocity") return mountVelocity();
    return mountPlaceholder(name);
  }

  function contentEl() {
    return document.getElementById("flow-wired-content");
  }

  function mountPlaceholder(name) {
    var c = contentEl();
    if (!c) return;
    var label = (SURFACES.filter(function (s) {
      return s.id === name;
    })[0] || {}).label || name;
    c.innerHTML =
      '<div style="padding:2rem;max-width:620px;color:var(--color-text-secondary,#8b949e)">' +
      '<h2 style="color:var(--color-text-primary,#c9d1d9);margin-top:0">' +
      label +
      "</h2><p>This surface is being wired to its real flow.* operations in M6.2 " +
      "(Velocity → epoch reads; Simulation → flow.simulate). It is intentionally " +
      "not showing synthetic data.</p></div>";
    showStatus("", "");
  }

  // ── Policy surface (M6.1) ────────────────────────────────────────────────────

  function pq(sel) {
    return document.querySelector("#flow-policy " + sel);
  }

  function mountPolicy() {
    var c = contentEl();
    if (!c) return;
    c.innerHTML = '<div id="flow-policy" class="flow-surface">' +
      window.__flowSurfaces.policy.html + "</div>";
    renderContextChoosers();
    bindPolicyGlobals();
    populateTokenSelect();
    loadPolicy();
  }

  // C7 — fill the #tokenSelect from the REAL token.list results. No seeded
  // options: each option is a token the user actually holds. When the user holds
  // no token, reveal the honest empty-state (#tokenEmpty) — never silently keep the
  // custom label.
  function populateTokenSelect() {
    var sel = pq("#tokenSelect");
    var empty = pq("#tokenEmpty");
    var hasTokens = state.tokens && state.tokens.length > 0;
    if (sel) {
      sel.innerHTML = "";
      for (var i = 0; i < state.tokens.length; i++) {
        var t = state.tokens[i];
        var opt = document.createElement("option");
        opt.value = t.id;
        opt.textContent = t.humanLabel || t.kind || t.id;
        sel.appendChild(opt);
      }
      if (state.tokenId) sel.value = state.tokenId;
    }
    if (empty) {
      if (hasTokens) empty.classList.add("hidden");
      else empty.classList.remove("hidden");
    }
  }

  // C1/G1 — inject the real-context nav (.cfg-nav .it) + pills (.ctx-pill) from
  // state.contexts (Personal + the user's hives). No hardcoded literals. When the
  // user has only the Personal self-context, that is an HONEST minimal list, not
  // an empty render.
  function renderContextChoosers() {
    var nav = pq("#ctxNav");
    var pills = pq(".ctx-pills");
    if (nav) nav.innerHTML = "";
    if (pills) pills.innerHTML = "";
    state.contexts.forEach(function (cx) {
      if (nav) {
        var b = document.createElement("button");
        b.className = "it" + (cx.id === state.context ? " on" : "");
        b.textContent = cx.label;
        b.onclick = function () {
          window.switchCtx(b, cx.id);
        };
        nav.appendChild(b);
      }
      if (pills) {
        var d = document.createElement("div");
        d.className = "ctx-pill" + (cx.id === state.context ? " on" : "");
        d.textContent = cx.label;
        d.onclick = function () {
          window.selectCtx(d, cx.label);
        };
        pills.appendChild(d);
      }
    });
    if (state.contexts.length <= 1) {
      var help = pq(".cfg-sub");
      if (help) {
        help.textContent =
          "These settings govern how value flows for you. You have no hives " +
          "yet — this is your Personal band. Join or create a hive to arm a " +
          "context-scoped policy.";
      }
    }
  }

  function fmtCcy(n) {
    var f = CCY_FMT[state.ccy] || CCY_FMT.USD;
    return f.sym + Number(n || 0).toLocaleString() + f.suf;
  }

  function bindPolicyGlobals() {
    window.updateBand = function () {
      var floor = parseFloat((pq("#floorInput") || {}).value) || 0;
      var ceil = parseFloat((pq("#ceilingInput") || {}).value) || 0;
      var fl = pq("#floorLabel");
      var cl = pq("#ceilingLabel");
      if (fl) fl.textContent = fmtCcy(floor);
      if (cl) cl.textContent = fmtCcy(ceil);
    };
    window.setCurrency = function (v) {
      state.ccy = CCY_FMT[v] ? v : "USD";
      var f = CCY_FMT[state.ccy];
      var units = document.querySelectorAll("#flow-policy .th-field .unit");
      Array.prototype.forEach.call(units, function (u) {
        u.textContent = (f.suf ? f.suf.trim() : f.sym) + " / month";
      });
      window.updateBand();
    };
    window.selectCurve = function (el) {
      var opts = document.querySelectorAll("#flow-policy .curve-opt");
      Array.prototype.forEach.call(opts, function (c) {
        c.classList.remove("on");
      });
      el.classList.add("on");
      var nm = ((el.querySelector(".cnm") || {}).textContent || "").trim();
      state.gradient = typeof CURVE_GRADIENT[nm] === "number"
        ? CURVE_GRADIENT[nm]
        : 0.5;
    };
    window.selectCtx = function (el, label) {
      var pills = document.querySelectorAll("#flow-policy .ctx-pill");
      Array.prototype.forEach.call(pills, function (p) {
        p.classList.remove("on");
      });
      el.classList.add("on");
      var lbl = pq("#ctxLabel");
      if (lbl) lbl.textContent = label;
      var match = state.contexts.filter(function (c) {
        return c.label === label;
      })[0];
      state.context = match ? match.id : state.context;
      syncCtxNav();
      loadPolicy();
    };
    window.switchCtx = function (el, id) {
      var its = document.querySelectorAll("#flow-policy .cfg-nav .it");
      Array.prototype.forEach.call(its, function (i) {
        i.classList.remove("on");
      });
      if (el) el.classList.add("on");
      state.context = id || state.context;
      syncCtxPills();
      loadPolicy();
    };
    // G6 felt-threshold toggle — WIRED: records the owner's felt-threshold
    // preference onto the policy (persists in policy_set params, re-read on load).
    window.toggleFelt = function () {
      state.felt = !state.felt;
      var t = pq("#feltToggle");
      if (t) {
        if (state.felt) t.classList.add("on");
        else t.classList.remove("on");
      }
    };
    window.openSim = function () {
      showSurface("simulate");
    };
    // C7 — pick the REAL token this flow moves value with (from token.list).
    window.selectFlowToken = function (id) {
      var match = null;
      for (var i = 0; i < state.tokens.length; i++) {
        if (state.tokens[i].id === id) {
          match = state.tokens[i];
          break;
        }
      }
      if (match) {
        state.tokenId = match.id;
        state.tokenLabel = match.humanLabel || match.kind || match.id;
      }
      loadPolicy();
    };
    window.savePolicy = savePolicy;
  }

  function loadPolicy() {
    var lbl = pq("#ctxLabel");
    if (lbl) lbl.textContent = ctxLabel();
    // C7 — no token held → skip the read (a null/custom tokenKind moves no
    // value) and show the honest empty-state instead.
    if (!state.tokenId) {
      var em = pq("#tokenEmpty");
      if (em) em.classList.remove("hidden");
      showStatus(
        "You hold no tokens yet — define or receive a token to flow value.",
        "warn",
      );
      return;
    }
    ctx.api.get_policy({ context: state.context, tokenKind: state.tokenId })
      .then(
        function (res) {
          if (res && res.ok && res.found && res.params) {
            var p = res.params;
            var fi = pq("#floorInput");
            var ci = pq("#ceilingInput");
            if (fi && typeof p.floor === "number") fi.value = p.floor;
            if (ci && typeof p.ceiling === "number") ci.value = p.ceiling;
            if (typeof p.gradient === "number") {
              state.gradient = p.gradient;
              markCurveByGradient(p.gradient);
            }
            if (p.humanLabel) setCcyByLabel(p.humanLabel);
            // Restore the wired controls so a saved policy re-reads (no silent
            // loss of the felt/tithe/transparency/caps the owner set).
            state.felt = !!p.feltThresholds;
            var ft = pq("#feltToggle");
            if (ft) {
              if (state.felt) ft.classList.add("on");
              else ft.classList.remove("on");
            }
            var tr = pq("#titheRange");
            if (tr && typeof p.commonsTithePct === "number") {
              tr.value = p.commonsTithePct;
              var tv = pq("#titheVal");
              if (tv) tv.textContent = p.commonsTithePct + "%";
            }
            if (p.transparencyLevel) {
              var radios = document.querySelectorAll(
                '#flow-policy input[name="transp"]',
              );
              Array.prototype.forEach.call(radios, function (r) {
                r.checked = r.value === p.transparencyLevel;
              });
            }
            var pcc = pq("#perClaimantCap");
            if (pcc && typeof p.perClaimantCap === "number") {
              pcc.value = p.perClaimantCap;
            }
            var pec = pq("#perEpochCap");
            if (pec && typeof p.perEpochCap === "number") {
              pec.value = p.perEpochCap;
            }
            var asc = pq("#automatedSettlementCap");
            if (asc && typeof p.automatedSettlementCap === "number") {
              asc.value = p.automatedSettlementCap;
            }
            window.updateBand();
            showStatus(
              "Loaded saved FlowPolicy v" + res.version + " for " + ctxLabel() +
                ".",
              "ok",
            );
          } else {
            var fi2 = pq("#floorInput");
            var ci2 = pq("#ceilingInput");
            if (fi2) fi2.value = "";
            if (ci2) ci2.value = "";
            window.updateBand();
            showStatus(
              "No FlowPolicy saved yet for " + ctxLabel() +
                " — set a floor and ceiling, then Save.",
              "",
            );
          }
        },
        function (err) {
          showStatus("Could not load policy: " + errMsg(err), "warn");
        },
      );
  }

  function savePolicy() {
    // C7 — refuse to arm without a REAL token (never send the string custom).
    if (!state.tokenId) {
      return showStatus(
        "Select or hold a token to arm a flow policy.",
        "warn",
      );
    }
    var floor = parseFloat((pq("#floorInput") || {}).value);
    var ceil = parseFloat((pq("#ceilingInput") || {}).value);
    if (!isFinite(floor) || !isFinite(ceil)) {
      return showStatus("Enter both a floor and a ceiling first.", "warn");
    }
    if (ceil < floor) {
      return showStatus("Ceiling must be at or above the floor.", "warn");
    }
    var params = {
      floor: floor,
      ceiling: ceil,
      gradient: state.gradient,
      humanLabel: CCY_LABEL[state.ccy] || CCY_LABEL.USD,
      // G6 — felt-threshold preference (recorded on the policy, re-read on load).
      feltThresholds: !!state.felt,
    };
    // G7 — commons tithe %: read the live slider value.
    var titheEl = pq("#titheRange");
    if (titheEl && titheEl.value !== "" && titheEl.value != null) {
      var titheVal = parseFloat(titheEl.value);
      if (isFinite(titheVal)) params.commonsTithePct = titheVal;
    }
    // G8 — transparency level (design §5 transparency_level). Read the checked
    // radio tolerantly (deno-dom does not implement the :checked pseudo-class):
    // prefer the .checked property, fall back to the [checked] attribute.
    var transpVal = readCheckedRadio("#flow-policy", "transp");
    if (transpVal) params.transparencyLevel = transpVal;
    // CRITICAL — automated-settlement cap (absolute owner-signed ceiling). This
    // is the ONE param that arms the delegation root (policy-set.ts mints it only
    // when automatedSettlementCap > 0), so without it a UI-armed policy records
    // settlements but moves NO token value. Only send a finite, positive amount;
    // blank/0 = arm the band for simulation only (omit → no delegation root).
    var ascEl = pq("#automatedSettlementCap");
    if (ascEl && ascEl.value !== "" && ascEl.value != null) {
      var asc = parseFloat(ascEl.value);
      if (isFinite(asc) && asc > 0) params.automatedSettlementCap = asc;
    }
    // G10/B-3 — fairness caps the allocator honors (HC-05). Only send finite,
    // in-range fractions; blank = no cap (omit).
    var pccEl = pq("#perClaimantCap");
    if (pccEl && pccEl.value !== "" && pccEl.value != null) {
      var pcc = parseFloat(pccEl.value);
      if (isFinite(pcc)) params.perClaimantCap = pcc;
    }
    var pecEl = pq("#perEpochCap");
    if (pecEl && pecEl.value !== "" && pecEl.value != null) {
      var pec = parseFloat(pecEl.value);
      if (isFinite(pec)) params.perEpochCap = pec;
    }

    showStatus("Saving…", "");
    return ctx.api.policy_set({
      context: state.context,
      tokenKind: state.tokenId,
      params: params,
    }).then(function (res) {
      if (res && res.ok) {
        showStatus(
          "Saved FlowPolicy v" + res.version + " for " + ctxLabel() +
            ". Takes effect at the next flow epoch.",
          "ok",
        );
      } else {
        showStatus("Save failed: " + ((res && res.error) || "unknown"), "warn");
      }
    }, function (err) {
      showStatus("Save failed: " + errMsg(err), "warn");
    });
  }

  function ctxLabel() {
    var m = contextById(state.context);
    return m ? m.label : state.context;
  }

  // Keep the nav buttons + pills reflecting the selected context (they are two
  // views of the same state.contexts list).
  function syncCtxPills() {
    var lbl = ctxLabel();
    Array.prototype.forEach.call(
      document.querySelectorAll("#flow-policy .ctx-pill"),
      function (p) {
        p.classList.toggle("on", (p.textContent || "").trim() === lbl);
      },
    );
    var l = pq("#ctxLabel");
    if (l) l.textContent = lbl;
  }
  function syncCtxNav() {
    var lbl = ctxLabel();
    Array.prototype.forEach.call(
      document.querySelectorAll("#flow-policy .cfg-nav .it"),
      function (i) {
        i.classList.toggle("on", (i.textContent || "").trim() === lbl);
      },
    );
  }

  function markCurveByGradient(g) {
    var best = "Linear";
    var bestD = Infinity;
    Object.keys(CURVE_GRADIENT).forEach(function (k) {
      var d = Math.abs(CURVE_GRADIENT[k] - g);
      if (d < bestD) {
        bestD = d;
        best = k;
      }
    });
    var opts = document.querySelectorAll("#flow-policy .curve-opt");
    Array.prototype.forEach.call(opts, function (c) {
      var nm = ((c.querySelector(".cnm") || {}).textContent || "").trim();
      c.classList.toggle("on", nm === best);
    });
  }

  function setCcyByLabel(label) {
    var code = Object.keys(CCY_LABEL).filter(function (k) {
      return CCY_LABEL[k] === label;
    })[0] || "USD";
    state.ccy = code;
    var sel = pq("#ccySelect");
    if (sel) sel.value = code;
    window.setCurrency(code);
  }

  // ── Velocity surface — the flow "river", a READ aggregation ─────────────────

  function vq(sel) {
    return document.querySelector("#flow-velocity " + sel);
  }

  function mountVelocity() {
    var c = contentEl();
    if (!c) return;
    if (typeof ctx.graphQuery !== "function") {
      return mountPlaceholder("velocity");
    }
    c.innerHTML = '<div id="flow-velocity" class="flow-surface">' +
      window.__flowSurfaces.velocity.html + "</div>";
    bindVelocityGlobals();
    loadVelocity();
  }

  function bindVelocityGlobals() {
    // First-run toggle: empty state vs the real river render. No synthetic
    // balance/state numbers; the populated case is rendered by renderVelocity
    // from real data.
    window.setState = function (s) {
      var firstrun = s === "firstrun";
      var fr = vq("#firstRun");
      var rc = vq("#riverContent");
      if (fr) setHidden(fr, !firstrun);
      if (rc) setHidden(rc, firstrun);
    };
    // C3/G4 — accept an incoming flow agreement from the UI.
    window.agreementAccept = agreementAccept;
    // C2/G3 — settle a flow epoch from the UI.
    window.settleEpoch = settleEpoch;
  }

  // ── C3/G4 — accept an incoming agreement ─────────────────────────────────────
  function agreementAccept(agreementId) {
    if (!agreementId || typeof ctx.api.agreement_accept !== "function") return;
    showStatus("Accepting agreement…", "");
    return ctx.api.agreement_accept({ agreementId: agreementId }).then(
      function (res) {
        if (res && res.ok) {
          showStatus("Agreement " + agreementId + " is now active.", "ok");
          loadVelocity();
        } else {
          showStatus(
            "Accept failed: " + ((res && res.error) || "unknown"),
            "warn",
          );
        }
      },
      function (err) {
        showStatus("Accept failed: " + errMsg(err), "warn");
      },
    );
  }

  // ── C2/G3 — settle a flow epoch from the UI ──────────────────────────────────
  // Sources balance + claimants from REAL data (HC-C1): balance from the owner's
  // real epoch-balance input (design HC-04 — settlement is explicit, the caller
  // supplies the balance), and claimants from the holon's REAL flow relationships
  // (active/proposed agreements' counterparties, else non-self trust contacts).
  // NO fabricated peers/amounts. If there is no surplus or no claimant, the
  // daemon refuses LOUD (HC-01) and the UI surfaces it — never a silent success.
  function settleEpoch() {
    var balEl = vq("#settleBalance");
    var balance = parseFloat(balEl && balEl.value);
    if (!isFinite(balance) || balance < 0) {
      return showStatus(
        "Enter your balance this epoch to settle (design: settlement is explicit).",
        "warn",
      );
    }
    var claimants = state.settleClaimants || [];
    // Read the armed band so the claimant need covers the surplus (conservation).
    showStatus("Settling epoch…", "");
    return ctx.api.get_policy({
      context: state.context,
      tokenKind: state.tokenId,
    })
      .then(function (pol) {
        var ceiling = (pol && pol.found && pol.params &&
            typeof pol.params.ceiling === "number")
          ? pol.params.ceiling
          : 0;
        var surplus = Math.max(0, balance - ceiling);
        // Each real claimant can absorb up to the full surplus (headroom); the
        // conserved allocator distributes by need × trust-weight. Need = the
        // surplus the owner is flowing out this epoch (a real, visible figure).
        var payload = {
          context: state.context,
          balance: balance,
          claimants: claimants.map(function (c) {
            return {
              id: c.id,
              need: surplus > 0 ? surplus : (c.need || 0),
              trustWeight: typeof c.trustWeight === "number"
                ? c.trustWeight
                : 1,
            };
          }),
        };
        return ctx.api.epoch_settle(payload);
      })
      .then(function (res) {
        if (res && res.ok) {
          showStatus(
            "Settled epoch for " + ctxLabel() + " — flowed out " +
              fmtNum(res.settledTotal) + " (conserved: " +
              (res.conserved ? "yes" : "no") + ").",
            "ok",
          );
          renderSettlementResult();
          loadVelocity();
        } else {
          showStatus(
            "Settle refused: " + ((res && res.error) || "unknown") +
              (res && res.residual !== undefined
                ? " (residual " + fmtNum(res.residual) + ")"
                : ""),
            "warn",
          );
        }
      }, function (err) {
        showStatus("Settle failed: " + errMsg(err), "warn");
      });
  }

  // Read the committed settlement back (paid/indeterminate per leg) and render it.
  function renderSettlementResult() {
    if (typeof ctx.api.get_settlement !== "function") return;
    var out = vq("#settleResult");
    ctx.api.get_settlement({ context: state.context }).then(function (r) {
      if (!out) return;
      var settlements = (r && r.settlements) || [];
      if (settlements.length === 0) {
        out.innerHTML =
          '<div style="font-size:.82rem;color:var(--text3,#8b939d)">' +
          "No settlement recorded.</div>";
        return;
      }
      var s = settlements[settlements.length - 1];
      var legs = (s.legs || []).map(function (l) {
        var mark = l.status === "paid"
          ? "paid ✓"
          : (l.status === "unconfirmed" ? "unconfirmed …" : esc(l.status));
        return "<li>" + esc(shortDid(l.id)) + " · " + fmtNum(l.amount) + " · " +
          mark + "</li>";
      }).join("");
      out.innerHTML =
        '<div style="font-size:.82rem;color:var(--text2,#8b949e);margin-bottom:4px">' +
        "Settlement " + esc(shortDid(String(s.settlementId || ""))) +
        " — settled " + fmtNum(s.settledTotal) + "</div>" +
        "<ul style='margin:0;padding-left:18px;font-size:.82rem'>" +
        (legs ||
          "<li style='list-style:none;color:var(--text3,#8b939d)'>no legs</li>") +
        "</ul>";
    }, function () {/* best-effort render */});
  }

  function shortDid(d) {
    d = String(d || "");
    if (d.length <= 16) return d;
    return d.slice(0, 10) + "…" + d.slice(-6);
  }

  function nodesOf(res) {
    if (!res) return [];
    if (Array.isArray(res)) return res;
    if (Array.isArray(res.nodes)) return res.nodes;
    return [];
  }

  function propsOf(n) {
    return (n && (n.properties || n.props)) || n || {};
  }

  function loadVelocity() {
    var self = ctx.ownerDid || "";
    showStatus("Loading your flows…", "");
    Promise.all([
      ctx.graphQuery({ type: "flow_agreement" }),
      ctx.graphQuery({ type: "flow_settlement", where: { holon: self } }),
      ctx.graphQuery({ type: "flow_policy", where: { holon: self } }),
      // C4/G2 (velocity part) — "Received" reads the cross-boundary flow_outcome
      // node (the node that ACTUALLY crosses to the payee), NOT self settlements.
      ctx.graphQuery({ type: "flow_outcome", where: { source: "received" } }),
      // C2 claimant sourcing — real trust relationships (contacts).
      ctx.graphQuery({ type: "contact" }),
    ]).then(function (rs) {
      var agreements = nodesOf(rs[0]).map(propsOf).filter(function (a) {
        return !self || a.proposer === self || a.counterparty === self;
      });
      var settlements = nodesOf(rs[1]).map(propsOf);
      var policies = nodesOf(rs[2]).map(propsOf);
      var outcomes = nodesOf(rs[3]).map(propsOf).filter(function (o) {
        return o.source === "received" && !o.deleted;
      });
      var contacts = nodesOf(rs[4]).map(propsOf);

      // C2 — derive the real claimant set for a settle: active/proposed agreement
      // counterparties first, else non-self trust contacts. REAL DIDs only.
      state.settleClaimants = deriveClaimants(agreements, contacts, self);
      populateSettleCard(self);

      // Incoming proposals I can accept (proposed, I'm the counterparty).
      var incoming = agreements.filter(function (a) {
        return (a.status === "proposed") && a.counterparty === self &&
          a.proposer !== self && a.agreementId;
      });

      if (
        agreements.length === 0 && settlements.length === 0 &&
        policies.length === 0 && outcomes.length === 0
      ) {
        if (typeof window.setState === "function") window.setState("firstrun");
        showStatus(
          "No flows yet — arm a FlowPolicy or propose an agreement to begin.",
          "",
        );
        return;
      }
      renderVelocity(
        agreements,
        settlements,
        policies,
        outcomes,
        incoming,
        self,
      );
    }, function (err) {
      showStatus("Could not load flows: " + errMsg(err), "warn");
    });
  }

  // Real claimant DIDs from the holon's relationships (HC-C1 — no fabrication).
  function deriveClaimants(agreements, contacts, self) {
    var seen = {};
    var out = [];
    agreements.forEach(function (a) {
      var who = a.proposer === self ? a.counterparty : a.proposer;
      if (who && who !== self && !seen[who]) {
        seen[who] = 1;
        out.push({ id: who, trustWeight: 1, label: shortDid(who) });
      }
    });
    contacts.forEach(function (c) {
      var did = c.did || c.peer_did || "";
      var isSelf = c.is_self === true || c.is_self === "true" || did === self;
      if (did && !isSelf && !seen[did]) {
        seen[did] = 1;
        out.push({ id: did, trustWeight: 1, label: c.name || shortDid(did) });
      }
    });
    return out;
  }

  function populateSettleCard(_self) {
    var card = vq("#settleCard");
    if (card && card.style) card.style.display = "block";
    var lbl = vq("#settleCtxLabel");
    if (lbl) lbl.textContent = ctxLabel();
    var prev = vq("#settlePreview");
    var claimants = state.settleClaimants || [];
    // Prefill the balance from the real token balance if we can read it.
    var balEl = vq("#settleBalance");
    if (balEl && (balEl.value === "" || balEl.value == null)) {
      readContextBalance().then(function (bal) {
        if (bal != null && balEl.value === "") balEl.value = bal;
      });
    }
    if (prev) {
      if (claimants.length === 0) {
        prev.innerHTML =
          "You have no flow relationships to receive surplus yet — propose a " +
          "flow agreement or add a contact first. Settling now would refuse " +
          "loud (no claimant to absorb surplus).";
      } else {
        prev.innerHTML = "Surplus above your ceiling will flow to " +
          claimants.length + " trusted relationship(s): " +
          claimants.map(function (c) {
            return "<strong>" + esc(c.label) + "</strong>";
          }).join(", ") + ".";
      }
    }
  }

  // Read the owner's real balance for the flow's REAL token, if available.
  function readContextBalance() {
    // C7 — no token held → nothing to read (never query balance for custom).
    if (!state.tokenId) return Promise.resolve(null);
    try {
      if (typeof ctx.api.balance === "function") {
        return Promise.resolve(ctx.api.balance({ token: state.tokenId })).then(
          function (r) {
            var b = r && (r.total != null ? r.total : r.balance);
            return typeof b === "number" ? b : null;
          },
          function () {
            return null;
          },
        );
      }
    } catch (_e) { /* no balance op */ }
    return Promise.resolve(null);
  }

  function renderVelocity(
    agreements,
    settlements,
    policies,
    outcomes,
    incoming,
    self,
  ) {
    // Show the river, hide the empty state.
    var fr = vq("#firstRun");
    if (fr) fr.classList.add("hidden");
    var rc = vq("#riverContent");

    // Real aggregates from settlement history (Honesty: only what we can read).
    var totalOut = settlements.reduce(function (s, x) {
      return s + (Number(x.settledTotal) || 0);
    }, 0);
    // C4/G2 — Received = the cross-boundary flow_outcome total (what actually
    // arrived from peers), NOT a self-settlement allocation (which never
    // replicates to the payee).
    var received = outcomes.reduce(function (s, o) {
      return s + (Number(o.total_flowed) || 0);
    }, 0);
    var band = policies.filter(function (p) {
      return p.is_latest === true || p.is_latest === "true";
    })[0] || policies[0];

    var agRows = agreements.map(function (a) {
      var who = a.proposer === self ? a.counterparty : a.proposer;
      return "<li><strong>" + esc(shortDid(who) || "peer") + "</strong> · " +
        esc(a.status || "proposed") + "</li>";
    }).join("");

    // Incoming proposals with a real Accept control (C3/G4).
    var incRows = (incoming || []).map(function (a) {
      return '<li style="margin-bottom:6px"><strong>' +
        esc(shortDid(a.proposer)) + "</strong> proposed an agreement · " +
        esc(a.status || "proposed") +
        ' <button class="btn p" data-testid="flow-agreement-accept" ' +
        'data-agreement-id="' + esc(a.agreementId) +
        '" onclick="agreementAccept(\'' + esc(a.agreementId) +
        '\')" style="margin-left:8px;padding:2px 10px;font-size:.78rem">' +
        "Accept</button></li>";
    }).join("");

    if (rc) {
      rc.classList.remove("hidden");
      rc.innerHTML =
        '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px">' +
        simCard("Settlements", String(settlements.length)) +
        simCard("Flowed out", fmtNum(totalOut)) +
        simCard("Received", fmtNum(received)) +
        (band
          ? simCard(
            "Band",
            fmtNum(band.floor) + "–" + fmtNum(band.ceiling),
          )
          : "") +
        "</div>" +
        ((incoming && incoming.length)
          ? ('<div style="font-size:.8rem;color:var(--text2,#8b949e);margin-bottom:6px">' +
            "Incoming proposals</div><ul style='margin:0 0 14px;padding-left:18px'>" +
            incRows + "</ul>")
          : "") +
        '<div style="font-size:.8rem;color:var(--text2,#8b949e);margin-bottom:6px">' +
        "Flow agreements</div><ul style='margin:0;padding-left:18px'>" +
        (agRows ||
          "<li style='list-style:none;color:var(--text3,#8b939d)'>none yet</li>") +
        "</ul>";
    }
    showStatus(
      "Your flows: " + agreements.length + " agreement(s), " +
        settlements.length + " settlement(s), flowed out " + fmtNum(totalOut) +
        ".",
      "ok",
    );
  }

  // ── Simulation surface ───────────────────────────────────────────────────────

  function sq(sel) {
    return document.querySelector("#flow-simulate " + sel);
  }

  function mountSimulate() {
    var c = contentEl();
    if (!c) return;
    if (typeof ctx.api.simulate !== "function") {
      return mountPlaceholder("simulate");
    }
    c.innerHTML = '<div id="flow-simulate" class="flow-surface">' +
      window.__flowSurfaces.simulate.html + "</div>";
    // Run the REAL engine over a clearly-labelled synthetic network
    // (flow.simulate is a dry-run over synthetic state by design — design §6.5).
    bindSimulateGlobals();
    showStatus(
      "Choose a scenario and run — the real flow engine simulates an illustrative network (commits nothing).",
      "",
    );
  }

  // Scenario → the self holon's starting balance for an illustrative 3-holon
  // network (self + two below-floor claimants). Synthetic INPUT to a dry-run; the
  // report rendered below is the real engine's output.
  var SCENARIO_BALANCE = {
    steady: 12000,
    volatile: 4500,
    growth: 16000,
    hard: 5000,
    historical: 11000,
  };

  function buildSimHolons(scenario) {
    var selfBal = SCENARIO_BALANCE[scenario] || 12000;
    return [
      {
        id: "you",
        balance: selfBal,
        floor: 7000,
        ceiling: 10000,
        gradient: state.gradient,
        channels: [
          { to: "peer-a", trustWeight: 1 },
          { to: "peer-b", trustWeight: 0.6 },
        ],
      },
      { id: "peer-a", balance: 2000, floor: 5000, ceiling: 8000 },
      { id: "peer-b", balance: 1000, floor: 4000, ceiling: 7000 },
    ];
  }

  function bindSimulateGlobals() {
    window.updateScenarioDesc = function () {
      var v = (sq("#simScenario") || {}).value;
      var descs = {
        steady: "Stable income — no floor/ceiling crossings.",
        volatile: "Income dips below floor — tests deficit + recovery.",
        growth: "Revenue grows — tests ceiling crossing + outflow ramp.",
        hard: "Below floor most epochs — tests floor adequacy.",
        historical: "An illustrative recent-history shape.",
      };
      var el = sq("#scenarioDesc");
      if (el) el.textContent = descs[v] || "";
    };
    window.runSimulation = runSimulation;
  }

  function runSimulation() {
    var scenario = (sq("#simScenario") || {}).value || "steady";
    var holons = buildSimHolons(scenario);
    showStatus("Running the flow engine…", "");
    var btn = sq("#runBtn");
    if (btn) btn.textContent = "Running…";
    return ctx.api.simulate({ holons: holons, epochs: 3 }).then(function (res) {
      if (btn) btn.textContent = "⊕ Run simulation";
      if (res && res.ok && res.report) {
        renderSimReport(res.report, res.committed === false);
      } else {
        showStatus(
          "Simulation failed: " + ((res && res.error) || "unknown"),
          "warn",
        );
      }
    }, function (err) {
      if (btn) btn.textContent = "⊕ Run simulation";
      showStatus("Simulation failed: " + errMsg(err), "warn");
    });
  }

  // Replace the mock's fabricated results panel with the REAL engine report.
  function renderSimReport(report, committedNothing) {
    var prompt = sq("#promptState");
    if (prompt) prompt.classList.add("hidden");
    var results = sq("#resultsState");
    if (!results) return;
    results.classList.remove("hidden");

    var rows = (report.perHolon || []).map(function (h) {
      return "<tr><td>" + esc(h.id) + "</td><td style='text-align:right'>" +
        fmtNum(h.startBalance) + "</td><td style='text-align:right'>" +
        fmtNum(h.outflow) + "</td><td style='text-align:right'>" +
        fmtNum(h.received) + "</td><td style='text-align:right'>" +
        fmtNum(h.endBalance) + "</td></tr>";
    }).join("");

    results.innerHTML =
      '<div style="padding:4px 0 12px;font-size:.8rem;color:var(--text3,#8b939d)">' +
      "Illustrative synthetic network · real flow engine · " +
      (committedNothing ? "committed nothing" : "preview") + "</div>" +
      '<div style="display:flex;gap:10px;margin-bottom:12px;flex-wrap:wrap">' +
      simCard("Epochs", String(report.epochs)) +
      simCard("Total flowed", fmtNum(report.totalFlowed)) +
      simCard("Conserved", report.conserved ? "yes" : "no") +
      "</div>" +
      '<table style="width:100%;border-collapse:collapse;font-size:.84rem">' +
      "<thead><tr style='color:var(--text2,#8b949e);text-align:left'>" +
      "<th>Holon</th><th style='text-align:right'>Start</th>" +
      "<th style='text-align:right'>Out</th><th style='text-align:right'>In</th>" +
      "<th style='text-align:right'>End</th></tr></thead><tbody>" + rows +
      "</tbody></table>" +
      ((report.refusals && report.refusals.length)
        ? '<div style="margin-top:10px;color:var(--yellow,#d29922);font-size:.8rem">' +
          report.refusals.length +
          " unconservable epoch(s) refused (surplus the channels could not absorb).</div>"
        : "");

    showStatus(
      "Simulated " + report.epochs + " epoch(s) — total flowed " +
        fmtNum(report.totalFlowed) + ", conserved: " +
        (report.conserved ? "yes" : "no") + ". Nothing committed.",
      "ok",
    );
  }

  function simCard(label, val) {
    return '<div style="flex:1;min-width:120px;background:var(--bg2,#161b22);' +
      'border:1px solid var(--border,#30363d);border-radius:10px;padding:10px 14px">' +
      '<div style="font-size:.7rem;color:var(--text3,#8b939d);text-transform:uppercase;letter-spacing:.04em">' +
      esc(label) +
      '</div><div style="font-size:1.2rem;font-weight:700;margin-top:2px">' +
      esc(val) + "</div></div>";
  }

  function fmtNum(n) {
    return Number(n || 0).toLocaleString(undefined, {
      maximumFractionDigits: 2,
    });
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  // ── Agreement surface ────────────────────────────────────────────────────────

  function aq(sel) {
    return document.querySelector("#flow-agreement " + sel);
  }

  function mountAgreement() {
    var c = contentEl();
    if (!c) return;
    c.innerHTML = '<div id="flow-agreement" class="flow-surface">' +
      window.__flowSurfaces.agreement.html + "</div>";
    bindAgreementGlobals();
    showStatus(
      "Propose a flow agreement — set the counterparty, dial the formality, then Create.",
      "",
    );
  }

  function bindAgreementGlobals() {
    window.onDial = function (v) {
      var pct = parseInt(v, 10) || 0;
      var dial = aq("#formalityDial");
      if (dial && dial.style && dial.style.setProperty) {
        dial.style.setProperty("--val", pct + "%");
      }
      var badge = aq("#dialBadge");
      if (badge) badge.textContent = dialLabel(pct);
      var rel = aq("#lbl-relational");
      var con = aq("#lbl-contract");
      if (rel) rel.classList.toggle("active", pct < 50);
      if (con) con.classList.toggle("active", pct >= 50);
      var isContract = pct >= 60;
      var rf = aq("#relationalFields");
      var cf = aq("#contractFields");
      if (rf) rf.classList.toggle("hidden", isContract);
      if (cf) cf.classList.toggle("hidden", !isContract);
    };
    // G9 — contributor tier: record the selected tier (carried into
    // agreement_propose terms), not just a CSS class.
    window.selectTier = function (el) {
      var opts = document.querySelectorAll("#flow-agreement .tier-opt");
      Array.prototype.forEach.call(opts, function (t) {
        t.classList.remove("on");
      });
      el.classList.add("on");
      var tier = (el.getAttribute && el.getAttribute("data-tier")) ||
        ((el.querySelector(".nm") || {}).textContent || "").trim()
          .toLowerCase();
      if (tier) state.contributorTier = tier;
    };
    // G9 — duration: record the selected duration (carried into terms).
    window.selectDur = function (el, val) {
      var bs = document.querySelectorAll("#flow-agreement #durSeg button");
      Array.prototype.forEach.call(bs, function (b) {
        b.classList.remove("on");
      });
      el.classList.add("on");
      state.duration = val || "none";
      var cd = aq("#customDurField");
      if (cd) cd.classList.toggle("hidden", val !== "custom");
    };
    window.toggleIOU = function () {
      var t = aq("#iouToggle");
      var b = aq("#iouBody");
      if (t) t.classList.toggle("on");
      if (b) b.classList.toggle("hidden");
    };
    window.updateSplit = function () {
      var inputs = document.querySelectorAll(
        "#flow-agreement .spct input",
      );
      var total = 0;
      Array.prototype.forEach.call(inputs, function (i) {
        total += parseFloat(i.value) || 0;
      });
      var fill = aq("#splitFill");
      if (fill && fill.style) fill.style.width = Math.min(total, 100) + "%";
      var lbl = aq("#splitTotalLabel");
      if (lbl) {
        lbl.textContent = total.toFixed(1) + " % of revenue";
        lbl.className = total > 100 ? "over" : "ok";
      }
    };
    window.handleCreate = handleCreate;
  }

  function handleCreate() {
    var counterparty = ((aq("#flowAgreementCounterparty") || {}).value || "")
      .trim();
    if (!counterparty) {
      return showStatus(
        "Enter a counterparty (peer handle or DID) to propose to.",
        "warn",
      );
    }
    var dial = parseFloat((aq("#formalityDial") || {}).value) || 0;
    var formality = Math.max(0, Math.min(1, dial / 100));
    var terms = { formality: formality, tier: formalityToTier(formality) };
    var isContract = dial >= 60;
    if (isContract) {
      var sp = aq(".spct input");
      if (sp) {
        var v = parseFloat(sp.value);
        if (isFinite(v) && v > 0) {
          terms.sharePct = Math.max(0, Math.min(1, v / 100));
        }
      }
      // G9 — contributor tier + duration from the grid/segmented control.
      if (state.contributorTier) terms.contributorTier = state.contributorTier;
      if (state.duration) terms.duration = state.duration;
      if (state.duration === "custom") {
        var expEl = aq("#customDurField input");
        var exp = expEl && expEl.value ? String(expEl.value).trim() : "";
        if (exp) terms.expiry = exp;
      }
      var revSrc = ((aq("#revenueSource") || {}).value || "").trim();
      if (revSrc) terms.revenueSource = revSrc;
      var iouT = aq("#iouToggle");
      if (iouT && iouT.classList.contains("on")) {
        var out = parseFloat((aq("#iouOutstanding") || {}).value);
        var cap = parseFloat((aq("#iouCap") || {}).value);
        terms.iou = {
          outstanding: isFinite(out) ? out : 0,
          currency: (aq("#iouCurrency") || {}).value || "USD",
          capPerPeriod: isFinite(cap) ? cap : 0,
        };
      }
    } else {
      // relational channel: bind the visible channel-width fields
      var w = parseFloat((aq("#channelWidth") || {}).value);
      if (isFinite(w) && w > 0) {
        terms.channel = {
          width: w,
          period: (aq("#channelPeriod") || {}).value || "per month",
          unit: (aq("#channelUnit") || {}).value || "NAO hours",
        };
      }
      var note = ((aq("#agreementNote") || {}).value || "").trim();
      if (note) terms.note = note;
    }
    var transp = aq('input[name="agreementTransp"]:checked');
    if (transp && transp.value) terms.transparency = transp.value;

    showStatus("Proposing…", "");
    return ctx.api.agreement_propose({
      counterparty: counterparty,
      terms: terms,
    }).then(function (res) {
      if (res && res.ok) {
        showStatus(
          "Proposed agreement " + res.agreementId + " to " + counterparty +
            " — awaiting their co-sign.",
          "ok",
        );
      } else {
        showStatus(
          "Propose failed: " + ((res && res.error) || "unknown"),
          "warn",
        );
      }
    }, function (err) {
      showStatus("Propose failed: " + errMsg(err), "warn");
    });
  }

  function formalityToTier(f) {
    if (f < 0.2) return "relational";
    if (f < 0.45) return "channel";
    if (f < 0.8) return "revenue-share";
    return "contract";
  }

  var DIAL_POSITIONS = [
    { max: 20, label: "Trust-weight channel" },
    { max: 45, label: "Relational flow channel" },
    { max: 65, label: "Hybrid agreement" },
    { max: 80, label: "Codified share" },
    { max: 100, label: "Revenue-share contract" },
  ];
  function dialLabel(pct) {
    var p = DIAL_POSITIONS.filter(function (d) {
      return pct <= d.max;
    })[0];
    return (p || DIAL_POSITIONS[DIAL_POSITIONS.length - 1]).label;
  }

  // ── shared helpers ───────────────────────────────────────────────────────────

  function errMsg(err) {
    return err && err.message ? err.message : String(err);
  }

  // Read the selected radio's value in a deno-dom-tolerant way (no :checked
  // pseudo-class): prefer the .checked property, fall back to the [checked]
  // attribute. scope = a container selector prefix, name = the radio group.
  function readCheckedRadio(scope, name) {
    var radios = document.querySelectorAll(
      scope + ' input[name="' + name + '"]',
    );
    var byProp = "";
    var byAttr = "";
    Array.prototype.forEach.call(radios, function (r) {
      // deno-dom does not expose `.value` for a markup-set attribute — fall back
      // to getAttribute("value"). Real browsers return the property directly.
      var val = r.value || (r.getAttribute && r.getAttribute("value")) || "";
      if (!byProp && r.checked === true && val) byProp = val;
      if (
        !byAttr && r.hasAttribute && r.hasAttribute("checked") && val
      ) byAttr = val;
    });
    return byProp || byAttr || "";
  }

  // Explicit hidden toggle (deno-dom's classList.toggle(token, force) is
  // unreliable; add/remove is portable).
  function setHidden(el, hide) {
    if (!el) return;
    if (hide) el.classList.add("hidden");
    else el.classList.remove("hidden");
  }

  function showStatus(msg, kind) {
    var bar = document.getElementById("flow-status");
    if (!bar) return;
    bar.style.color = kind === "ok"
      ? "var(--color-success,#3fb950)"
      : kind === "warn"
      ? "var(--color-warning,#d29922)"
      : "var(--color-text-secondary,#8b949e)";
    bar.textContent = msg;
  }

  function ensureSurfacesCss() {
    if (document.getElementById("flow-surfaces-css")) return;
    var l = document.createElement("link");
    l.id = "flow-surfaces-css";
    l.rel = "stylesheet";
    l.href = "/features/flow-funding/flow-surfaces.css?v=" +
      (window.__naomsBuild || Date.now());
    document.head.appendChild(l);
  }

  function loadSurfacesModule(cb) {
    if (window.__flowSurfaces) return cb();
    var existing = document.getElementById("flow-surfaces-module");
    if (existing) {
      existing.addEventListener("load", cb);
      return;
    }
    var s = document.createElement("script");
    s.id = "flow-surfaces-module";
    s.src = "/features/flow-funding/flow-surfaces.js?v=" +
      (window.__naomsBuild || Date.now());
    s.onload = cb;
    s.onerror = function () {
      if (container) {
        container.textContent = "flow surface module failed to load.";
      }
    };
    document.body.appendChild(s);
  }
})();
