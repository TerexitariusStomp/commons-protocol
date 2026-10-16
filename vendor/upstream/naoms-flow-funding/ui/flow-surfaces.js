/**
 * src/packages/flow-funding/ui/flow-surfaces.js — the four REAL Flow surfaces.
 *
 * Hand-maintained production markup for the 1644 Flow Funding feature tab
 * (velocity / policy / agreement / simulation), in the approved 1644 design
 * language. This replaced the generated flow-mock module (1710 mock purge):
 * the markup is static and HONEST — no seeded figures, no synthetic peers, no
 * fabricated history. All dynamic data is rendered by flow-tab.js from the
 * real flow.* operations and graph reads; sections without a backing op carry
 * an explicit "preview · not yet saved" tag.
 *
 * @competitors: Open Collective, Grassroots Economics (Sarafu), Circles UBI
 * @competitor-reference: src/packages/flow-funding/docs/design/flow-funding-competitor-reference.md
 */
(function () {
  "use strict";

  var PREVIEW_TAG = '<span class="preview-tag">preview · not yet saved</span>';

  // ── Velocity — the flow "river" (real READ aggregation) ────────────────────
  // Static chrome only: the empty state + the container flow-tab.js renders
  // real agreements/settlements/policies into. No synthetic hero, period nav,
  // sparkline, or cascade — those depended on fabricated figures.
  var VELOCITY_HTML = '<div class="page">' +
    '<div class="firstrun hidden" id="firstRun">' +
    '<div class="ico">🌊</div>' +
    "<h3>Your river is quiet</h3>" +
    "<p>You have no flow policies, agreements, or settlements yet. Set your " +
    "viability band and propose your first flow agreement to start the river " +
    "flowing.</p>" +
    '<div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">' +
    '<button class="btn p" onclick="__flowShowSurface(\'policy\')">Set viability band</button>' +
    '<button class="btn" onclick="__flowShowSurface(\'agreement\')">Create flow agreement</button>' +
    "</div></div>" +
    '<div id="riverContent"></div>' +
    // C2/G3 — settle an epoch from the UI. flow-tab.js populates the context +
    // real balance/claimant preview and settleEpoch() calls flow.epoch_settle.
    '<div class="card" id="settleCard" style="display:none;margin-top:14px">' +
    '<div class="card-head">Settle this epoch</div>' +
    '<p style="font-size:.85rem;color:var(--text2);margin:0 0 var(--s3)">Run one ' +
    'flow settlement for <strong id="settleCtxLabel"></strong>: distribute your ' +
    "surplus above the ceiling to your below-floor claimants, conserved and " +
    "capped. Value only moves if you hold surplus and have claimants who can " +
    "absorb it — otherwise the daemon refuses loud (nothing is fabricated).</p>" +
    '<div id="settlePreview" style="font-size:.82rem;color:var(--text2);margin-bottom:var(--s3)"></div>' +
    '<div class="th-field" style="max-width:280px;margin-bottom:var(--s3)">' +
    "<label>Your balance this epoch</label>" +
    '<div class="inp-row">' +
    '<input type="number" id="settleBalance" min="0" placeholder="e.g. 700"/>' +
    "</div></div>" +
    '<button class="btn p" id="flow-settle-btn" data-flow-settle="1" data-flow-action="settle" onclick="settleEpoch()">Settle epoch</button>' +
    '<div id="settleResult" style="margin-top:12px"></div>' +
    "</div>" +
    "</div>";

  // ── Policy — FlowPolicy config (flow.get_policy / flow.policy_set) ─────────
  // C1/G1: the context list is NO LONGER hardcoded. flow-tab.js enumerates the
  // user's REAL hives (ctx.graphQuery({type:"hive"})) plus the holon-local
  // "Personal" self-context and injects the nav (.cfg-nav .it) + pills
  // (.ctx-pills .ctx-pill) into the placeholders below. Honest empty-state when
  // the user has no hives (only the Personal self-context).

  var POLICY_HTML = '<div class="cfg-root">' +
    '<div class="cfg-nav">' +
    '<div class="gh">Context</div><div id="ctxNav"></div>' +
    "</div>" +
    '<div class="cfg-content" id="cfgContent">' +
    '<h2 class="cfg-h2">FlowPolicy — <span id="ctxLabel"></span></h2>' +
    '<p class="cfg-sub">These settings govern how value flows for you in this ' +
    "context. Changes take effect at the next flow epoch.</p>" +
    '<div class="ctx-pills"></div>' +
    // denomination
    '<div class="ccy-row">' +
    '<div class="ccy-field">' +
    "<label>Currency / unit this policy governs</label>" +
    '<select id="ccySelect" onchange="setCurrency(this.value)">' +
    '<option value="USD">US dollars ($)</option>' +
    '<option value="NAO">NAO hours</option>' +
    '<option value="CARE">Care credits</option>' +
    "</select></div>" +
    '<div class="ccy-help">A FlowPolicy governs <strong>one</strong> ' +
    "denomination — the floor, ceiling and gradient below all apply to this " +
    "unit. Hold more than one currency or token? Set a separate band for each " +
    "by switching here.</div>" +
    "</div>" +
    // C7 — the REAL token this flow moves value with. Populated at mount by
    // flow-tab.js populateTokenSelect() from the token.list op (no seeded
    // options). token.pay/balance need a real tokenId node; the honest
    // empty-state (#tokenEmpty) shows when the user holds no token.
    '<div class="ccy-row">' +
    '<div class="ccy-field">' +
    "<label>Token this flow moves value with</label>" +
    '<select id="tokenSelect" onchange="selectFlowToken(this.value)"></select>' +
    "</div>" +
    '<div class="ccy-help hidden" id="tokenEmpty">You hold no tokens yet — ' +
    "define or receive a token to flow value.</div>" +
    "</div>" +
    // viability band (live)
    '<div class="card" id="sectionBand">' +
    '<div class="card-head">Viability band</div>' +
    '<div class="felt-toggle" onclick="toggleFelt()">' +
    '<span class="label">Use felt thresholds (no amounts — inferred from your ' +
    "flow history)</span>" +
    '<div class="toggle" id="feltToggle"></div>' +
    "</div>" +
    '<div class="threshold-row" id="numericThresholds">' +
    '<div class="th-field">' +
    "<label>Floor — support flows in below this</label>" +
    '<div class="inp-row">' +
    '<input type="number" id="floorInput" oninput="updateBand()"/>' +
    '<span class="unit">$ / month</span>' +
    "</div></div>" +
    '<div class="th-field">' +
    "<label>Ceiling — surplus flows out above this</label>" +
    '<div class="inp-row">' +
    '<input type="number" id="ceilingInput" oninput="updateBand()"/>' +
    '<span class="unit">$ / month</span>' +
    "</div></div>" +
    "</div>" +
    '<div class="band-viz">' +
    '<div class="band-track">' +
    '<div class="band-region band-deficit" style="left:0;width:32%">In deficit</div>' +
    '<div class="band-region band-gradient" style="left:32%;width:40%">Gradient</div>' +
    '<div class="band-region band-surplus" style="left:72%;width:28%">My cup is full</div>' +
    "</div>" +
    '<div class="band-labels">' +
    '<div class="marker"><span class="mval" id="floorLabel">—</span><span class="mlbl">Floor</span></div>' +
    '<div class="marker" style="margin-left:auto;margin-right:auto"><span class="mval" style="color:var(--text2);font-size:.7rem">← gradient band →</span></div>' +
    '<div class="marker"><span class="mval" id="ceilingLabel">—</span><span class="mlbl">Ceiling</span></div>' +
    "</div></div>" +
    "</div>" +
    // gradient curve (live — folds into params.gradient)
    '<div class="card">' +
    '<div class="card-head">Gradient curve</div>' +
    '<p style="font-size:.85rem;color:var(--text2);margin:0 0 var(--s3)">Flow ' +
    "is not a tap — it is a gradient. Choose how quickly outward flow ramps up " +
    "as your balance moves from floor toward ceiling.</p>" +
    '<div class="curve-grid">' +
    '<div class="curve-opt" onclick="selectCurve(this)">' +
    '<svg width="60" height="32" viewBox="0 0 60 32"><path d="M4 28 C 10 28, 12 4, 56 4" fill="none" stroke="#58a6ff" stroke-width="2"/></svg>' +
    '<div class="cnm">Generous early</div>' +
    '<div class="cds">Start flowing just above floor; full output near ceiling</div>' +
    "</div>" +
    '<div class="curve-opt on" onclick="selectCurve(this)">' +
    '<svg width="60" height="32" viewBox="0 0 60 32"><line x1="4" y1="28" x2="56" y2="4" stroke="#58a6ff" stroke-width="2"/></svg>' +
    '<div class="cnm">Linear</div>' +
    '<div class="cds">Even ramp from floor to ceiling; equal proportion at each point</div>' +
    "</div>" +
    '<div class="curve-opt" onclick="selectCurve(this)">' +
    '<svg width="60" height="32" viewBox="0 0 60 32"><path d="M4 28 C 44 28, 50 8, 56 4" fill="none" stroke="#58a6ff" stroke-width="2"/></svg>' +
    '<div class="cnm">Cautious</div>' +
    '<div class="cds">Hold most back until close to abundance; surge near ceiling</div>' +
    "</div></div>" +
    '<div class="note" style="margin-top:var(--s4)">Almost everyone is always ' +
    "flowing something. The gradient model means you give a little while still " +
    "receiving a little — that simultaneous give-and-receive is what keeps the " +
    "web alive.</div>" +
    "</div>" +
    // anti-hoarding (unbacked — preview)
    '<div class="card">' +
    '<div class="card-head">Anti-hoarding mechanisms ' + PREVIEW_TAG +
    "</div>" +
    '<div class="mech-row">' +
    '<div class="mech-left">' +
    '<div class="mech-name">Gradient outflow</div>' +
    '<div class="mech-desc">Surplus above ceiling flows out automatically ' +
    "through your trust channels toward need. The gradient curve above governs " +
    "the ramp.</div>" +
    "</div></div>" +
    '<div class="mech-row">' +
    '<div class="mech-left">' +
    '<div class="mech-name">Activity-decay</div>' +
    '<div class="mech-desc">Flow entitlement diminishes as a contributor ' +
    "becomes inactive — they &quot;drift from the river.&quot; Reduces future " +
    "flow allocation, never the recipient's actual balance.</div>" +
    "</div></div>" +
    '<div class="mech-row">' +
    '<div class="mech-left">' +
    '<div class="mech-name">Demurrage — balance decay</div>' +
    '<div class="mech-desc">Idle balances lose a small % per period, ' +
    "incentivising circulation. Explore the effect on the Simulate surface — " +
    "the real engine runs it as a dry-run before anything is armed live.</div>" +
    "</div></div>" +
    "</div>" +
    // automated settlement (LIVE — the owner-signed absolute ceiling that ARMS
    // the delegation root; policy-set.ts mints the root ONLY when this > 0. This
    // is what authorizes automated value movement at settle. Without it, a
    // settlement records allocations but moves NO token value.)
    '<div class="card">' +
    '<div class="card-head">Automated settlement</div>' +
    '<p style="font-size:.85rem;color:var(--text2);margin:0 0 var(--s4)">The ' +
    "owner-signed ceiling that authorizes value to move <em>automatically</em> " +
    "when you settle a flow epoch. This mints the delegation root the settler " +
    "uses to pay claimants on your behalf — the total it may ever move over the " +
    "policy's life. Leave blank (or 0) to arm the band for simulation only: " +
    "settlements will be recorded but <strong>no value will move</strong> until " +
    "you set a cap.</p>" +
    '<div class="threshold-row">' +
    '<div class="th-field">' +
    "<label>Automated-settlement cap (absolute total)</label>" +
    '<div class="inp-row">' +
    '<input type="number" id="automatedSettlementCap" min="0" step="1" placeholder="e.g. 1000"/>' +
    "</div></div>" +
    "</div>" +
    "</div>" +
    // fairness caps (LIVE — allocator honors perClaimantCap/perEpochCap, HC-05)
    '<div class="card">' +
    '<div class="card-head">Fairness caps</div>' +
    '<p style="font-size:.85rem;color:var(--text2);margin:0 0 var(--s4)">Bound ' +
    "the blast radius of a settlement (HC-05). Per-claimant cap limits the " +
    "fraction of one epoch's surplus any single below-floor claimant may " +
    "receive; per-epoch cap limits the fraction of your balance that may flow " +
    "out in one epoch. Leave blank for no cap.</p>" +
    '<div class="threshold-row">' +
    '<div class="th-field">' +
    "<label>Per-claimant cap (fraction 0–1)</label>" +
    '<div class="inp-row">' +
    '<input type="number" id="perClaimantCap" min="0" max="1" step="0.05" placeholder="e.g. 0.5"/>' +
    "</div></div>" +
    '<div class="th-field">' +
    "<label>Per-epoch cap (fraction of balance 0–1)</label>" +
    '<div class="inp-row">' +
    '<input type="number" id="perEpochCap" min="0" max="1" step="0.05" placeholder="e.g. 0.2"/>' +
    "</div></div>" +
    "</div>" +
    "</div>" +
    // commons tithe (recorded on the policy; no live tithe engine yet in 1644)
    '<div class="card">' +
    '<div class="card-head">Commons tithe</div>' +
    '<p style="font-size:.85rem;color:var(--text2);margin:0 0 var(--s4)">A ' +
    "fraction of every flow passing through you siphons into the commons pool " +
    "— collective insurance and purpose-pool funding. Recorded on your policy " +
    "and re-read when you return.</p>" +
    '<div class="range-row">' +
    "<label>Tithe %</label>" +
    '<input type="range" id="titheRange" min="0" max="15" step="0.5" value="3" oninput="document.getElementById(\'titheVal\').textContent=this.value+\'%\'"/>' +
    '<span class="val" id="titheVal">3%</span>' +
    "</div>" +
    "</div>" +
    // transparency (recorded on the policy — outcome-transparency scope, design §5)
    '<div class="card">' +
    '<div class="card-head">Transparency for this context</div>' +
    '<div style="background:var(--bg3);border:1px solid var(--border);border-radius:var(--r-md);padding:0 var(--s4)">' +
    '<div class="transp-opt"><div class="to-text"><div class="to-name">Outcome-transparent</div><div class="to-sub">Network sees that value flowed and its purpose — not exact amounts</div></div><input type="radio" name="transp" value="outcome" checked/></div>' +
    '<div class="transp-opt"><div class="to-text"><div class="to-name">Story-gated transparency</div><div class="to-sub">Flow becomes visible once the recipient shares a story-upstream outcome</div></div><input type="radio" name="transp" value="story-gated"/></div>' +
    '<div class="transp-opt"><div class="to-text"><div class="to-name">Fully transparent</div><div class="to-sub">All participants see exact amounts, timing, and terms</div></div><input type="radio" name="transp" value="full"/></div>' +
    '<div class="transp-opt"><div class="to-text"><div class="to-name">Private edges</div><div class="to-sub">Only the parties to each flow relationship see details</div></div><input type="radio" name="transp" value="private"/></div>' +
    "</div></div>" +
    // action bar
    '<div class="action-bar">' +
    '<button class="btn ghost" onclick="openSim()">⊕ Simulate before saving</button>' +
    '<div class="spacer"></div>' +
    '<button class="btn p" onclick="savePolicy()">Save policy</button>' +
    "</div>" +
    "</div></div>";

  // ── Agreement — propose a bilateral flow agreement ─────────────────────────
  var AGREEMENT_HTML = '<div class="page">' +
    '<div class="ph">' +
    "<h1>New flow agreement</h1>" +
    '<p class="sub">A flow agreement sets how value moves between you and ' +
    "someone in your network — from a light relational channel to a codified " +
    "revenue-share contract.</p>" +
    "</div>" +
    // formality dial
    '<div class="dial-wrap">' +
    '<div class="dial-labels">' +
    '<span class="dial-label active" id="lbl-relational">Relational</span>' +
    '<span class="dial-label" id="lbl-contract">Contract</span>' +
    "</div>" +
    '<input type="range" id="formalityDial" min="0" max="100" value="30" style="--val:30%" oninput="onDial(this.value)"/>' +
    '<div class="dial-position"><span class="dial-badge" id="dialBadge">Relational flow channel</span></div>' +
    '<div class="dial-desc">' +
    "<p>A lightweight channel — channel width sets how much can flow; no " +
    "formal terms required. Good for ongoing mutual support.</p>" +
    "<p>A codified agreement — parties, %, revenue source, duration, and " +
    "optional IOU. Executes exactly what was negotiated.</p>" +
    "</div></div>" +
    // parties
    '<div class="sect">' +
    '<div class="sect-head">Parties</div>' +
    '<div class="party-row">' +
    '<div class="party-avatar">◈</div>' +
    '<div><div class="party-name">You</div><div class="party-meta">Initiating party</div></div>' +
    "</div>" +
    '<div class="field">' +
    "<label>Counterparty — peer handle or DID</label>" +
    '<input class="ctl" id="flowAgreementCounterparty" type="text" placeholder="e.g. did:key:… or @handle"/>' +
    '<div class="help">A bilateral flow agreement rides your established ' +
    "friendship lane with this peer — you must already be paired.</div>" +
    "</div></div>" +
    // relational fields (dial < 60)
    '<div class="relational-fields" id="relationalFields">' +
    '<div class="sect">' +
    '<div class="sect-head">Channel</div>' +
    '<div class="field">' +
    "<label>Channel width — maximum flow per period</label>" +
    '<div class="frow">' +
    '<div class="field"><input class="ctl" id="channelWidth" type="number" placeholder="Max amount"/></div>' +
    '<div class="field"><select class="ctl" id="channelPeriod"><option>per month</option><option>per week</option><option>per year</option></select></div>' +
    '<div class="field"><select class="ctl" id="channelUnit"><option>NAO hours</option><option>kudos</option><option>USD</option></select></div>' +
    "</div>" +
    '<div class="help">Flow only moves when you are above your ceiling. This ' +
    "is the maximum that can flow per period — actual flow may be less " +
    "depending on gradient position.</div>" +
    "</div>" +
    '<div class="field">' +
    "<label>Note (optional)</label>" +
    '<textarea class="ctl" id="agreementNote" rows="2" placeholder="What\'s this channel for?"></textarea>' +
    "</div></div></div>" +
    // contract fields (dial >= 60)
    '<div class="contract-fields hidden" id="contractFields">' +
    '<div class="sect">' +
    '<div class="sect-head">Revenue source</div>' +
    '<div class="field">' +
    "<label>Which revenue stream does this agreement apply to?</label>" +
    '<input class="ctl" id="revenueSource" type="text" placeholder="e.g. all revenue, or a named stream"/>' +
    '<div class="help">The agreement executes as a percentage of this stream.</div>' +
    "</div></div>" +
    '<div class="sect">' +
    '<div class="sect-head">Revenue split</div>' +
    '<div class="split-row">' +
    '<span class="sname">Counterparty share</span>' +
    '<div class="spct"><input class="ctl" type="number" value="" min="0" max="100" placeholder="0" oninput="updateSplit()"/> %</div>' +
    "</div>" +
    '<div class="split-bar"><div class="fill" id="splitFill" style="width:0%"></div></div>' +
    '<div class="split-total">' +
    '<span style="color:var(--text2)">Total allocated</span>' +
    '<span class="ok" id="splitTotalLabel">0 % of revenue</span>' +
    "</div></div>" +
    '<div class="sect">' +
    '<div class="sect-head">Contributor tier</div>' +
    '<div class="tier-grid">' +
    '<div class="tier-opt on" data-tier="founding" onclick="selectTier(this)"><div class="ico">🌱</div><div class="nm">Founding</div><div class="ds">No expiration; permanent share for life of the org</div></div>' +
    '<div class="tier-opt" data-tier="active" onclick="selectTier(this)"><div class="ico">⚡</div><div class="nm">Active</div><div class="ds">Flows while active; diminishes on departure</div></div>' +
    '<div class="tier-opt" data-tier="time-limited" onclick="selectTier(this)"><div class="ico">📅</div><div class="nm">Time-limited</div><div class="ds">Contract defines the exact expiry and amount</div></div>' +
    "</div></div>" +
    '<div class="sect">' +
    '<div class="sect-head">Duration</div>' +
    '<div class="dur-seg" id="durSeg">' +
    '<button class="on" onclick="selectDur(this,\'none\')">No expiry</button>' +
    "<button onclick=\"selectDur(this,'1y')\">1 year</button>" +
    "<button onclick=\"selectDur(this,'2y')\">2 years</button>" +
    "<button onclick=\"selectDur(this,'custom')\">Custom</button>" +
    "</div>" +
    '<div class="field hidden" id="customDurField">' +
    "<label>Expiry date</label>" +
    '<input class="ctl" type="date"/>' +
    "</div></div>" +
    // IOU
    '<div class="sect">' +
    '<div class="sect-head">IOU (optional)</div>' +
    '<div class="iou-toggle" onclick="toggleIOU()">' +
    '<span class="label">This agreement repays an IOU</span>' +
    '<div class="toggle" id="iouToggle"></div>' +
    "</div>" +
    '<div class="iou-body hidden" id="iouBody">' +
    '<div class="frow" style="margin-top:var(--s2)">' +
    '<div class="field"><label>Outstanding amount</label><input class="ctl" id="iouOutstanding" type="number" placeholder="e.g. 20000"/></div>' +
    '<div class="field"><label>Currency</label><select class="ctl" id="iouCurrency"><option>USD</option><option>NAO hours</option></select></div>' +
    "</div>" +
    '<div class="field"><label>Repayment cap per period</label><input class="ctl" id="iouCap" type="number" placeholder="e.g. 2 % of revenue until cleared"/></div>' +
    '<div class="help">Once the IOU is fully repaid, this agreement ' +
    "transitions to the revenue-share terms above (or ends if the tier is " +
    "time-limited).</div>" +
    "</div></div>" +
    "</div>" +
    // transparency (both modes)
    '<div class="sect">' +
    '<div class="sect-head">Transparency</div>' +
    '<div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--r-md);padding:0 var(--s4)">' +
    '<div class="transp-row"><div><div class="tr-label">Outcome-transparent</div><div class="tr-sub">Network sees that value flowed and its purpose — not exact amounts</div></div><input type="radio" name="agreementTransp" value="outcome" checked/></div>' +
    '<div class="transp-row"><div><div class="tr-label">Fully transparent</div><div class="tr-sub">All participants see exact amounts, timing, and terms</div></div><input type="radio" name="agreementTransp" value="full"/></div>' +
    '<div class="transp-row"><div><div class="tr-label">Private</div><div class="tr-sub">Only the parties to this agreement see details</div></div><input type="radio" name="agreementTransp" value="private"/></div>' +
    "</div></div>" +
    '<div class="divider"></div>' +
    '<div class="note warn">Both parties must confirm this agreement before ' +
    "it takes effect. The counterparty will receive the proposal to review " +
    "and co-sign.</div>" +
    '<div class="btnrow">' +
    '<button class="btn p" onclick="handleCreate()">Create agreement</button>' +
    "</div>" +
    "</div>";

  // ── Simulate — dry-run the REAL flow engine (flow.simulate) ────────────────
  var SIMULATE_HTML = '<div class="page">' +
    '<div class="ph">' +
    "<h1>Simulate a flow epoch</h1>" +
    '<p class="sub">Run the real flow engine over an illustrative scenario ' +
    "and watch the epoch play out — before committing any real value.</p>" +
    "</div>" +
    '<div class="sim-banner">' +
    '<span class="sb-icon">⊕</span>' +
    "<span><strong>Simulation mode.</strong> Nothing here affects your live " +
    "ledger or real flow agreements. The engine dry-runs an illustrative " +
    "3-holon network and commits nothing.</span>" +
    "</div>" +
    '<div class="sim-layout">' +
    '<div class="ctrl-panel">' +
    '<div class="ctrl-head">Scenario</div>' +
    '<div class="field">' +
    "<label>Income shape</label>" +
    '<select class="ctl" id="simScenario" onchange="updateScenarioDesc()">' +
    '<option value="steady">Steady income</option>' +
    '<option value="volatile">Volatile — dips below floor</option>' +
    '<option value="growth">Growing revenue</option>' +
    '<option value="hard">Hard year — below floor most epochs</option>' +
    '<option value="historical">Illustrative recent-history shape</option>' +
    "</select>" +
    '<div class="help" id="scenarioDesc">Stable income — no floor/ceiling crossings.</div>' +
    "</div>" +
    '<button class="run-btn" id="runBtn" onclick="runSimulation()">⊕ Run simulation</button>' +
    "</div>" +
    '<div class="results-panel">' +
    '<div id="promptState" style="text-align:center;padding:var(--s6) var(--s4)">' +
    '<div style="font-size:2.4rem;opacity:.5;margin-bottom:var(--s3)">⊕</div>' +
    '<div style="font-weight:600;font-size:1.1rem;margin-bottom:var(--s2)">Choose a scenario and run</div>' +
    '<div style="font-size:.9rem;color:var(--text2);max-width:380px;margin:0 auto">The real flow engine simulates an illustrative network and reports the epoch — nothing is committed.</div>' +
    "</div>" +
    '<div id="resultsState" class="hidden"></div>' +
    "</div></div>" +
    "</div>";

  // Surface registry consumed by flow-tab.js (order = nav order).
  window.__flowSurfaces = {
    velocity: { label: "Flow", html: VELOCITY_HTML },
    policy: { label: "Policy", html: POLICY_HTML },
    agreement: { label: "New agreement", html: AGREEMENT_HTML },
    simulate: { label: "Simulate", html: SIMULATE_HTML },
  };
})();
