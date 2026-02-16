// ─── DATA LOADER ──────────────────────────────────────────────────────────────
let DATA = [];

async function loadData() {
  const res = await fetch('data/manifest.json');
  if (!res.ok) throw new Error('Could not load data/manifest.json');
  const manifest = await res.json();
  const promises = manifest.items.map(path => fetch(path).then(r => {
    if (!r.ok) throw new Error(`Failed to load ${path}`);
    return r.json();
  }));
  DATA = await Promise.all(promises);
  // Sort by ID to ensure consistent order
  DATA.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
}


const PHASES = ['Phase 1: Quick Wins','Phase 2: Foundational','Phase 3: Efficient','Phase 4: Optimized'];
const PHASE_SHORT = ['Quick Wins','Foundational','Efficient','Optimized'];
const CAPABILITIES = ['Security governance','Security assurance','Identity & access management','Threat detection','Vulnerability management','Infrastructure protection','Data protection','Application security','Incident response','Resiliency'];
const CAP_ICONS = {'Security governance':'🛡️','Security assurance':'✅','Identity & access management':'🔑','Threat detection':'🔭','Vulnerability management':'🔍','Infrastructure protection':'🌐','Data protection':'💾','Application security':'⚡','Incident response':'🚨','Resiliency':'♻️'};
const CAP_COLORS = {'Security governance':'#FF9900','Security assurance':'#ffb733','Identity & access management':'#3ecf8e','Threat detection':'#4da6ff','Vulnerability management':'#b47aff','Infrastructure protection':'#ff6b6b','Data protection':'#ffd93d','Application security':'#6bcb77','Incident response':'#ff4757','Resiliency':'#00d2d3'};

const SCORING_OPTIONS = [
  {label:'-- Select an option --', value: null},
  {label:'100% Aligned - Coverage throughout the organization', value: 1},
  {label:'75% Aligned - Partial Coverage - Advanced', value: 0.75},
  {label:'50% Aligned - Partial Coverage - Medium', value: 0.5},
  {label:'25% Aligned - Partial Coverage - Starting', value: 0.25},
  {label:'0% Aligned - Not Aligned', value: 0},
  {label:'0% Aligned - Unknown', value: 0},
  {label:'Excluded from this analysis', value: 'na'}
];

// STATE
const scores = {};
const comments = {};
let activePhaseFilter = 'all';
let activeCapFilter = 'all';

// STORAGE
const STORAGE_KEY = 'mma_session_v1';

function saveSession() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ scores, comments }));
  } catch(e) {}
}

function loadSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    if (parsed.scores) Object.assign(scores, parsed.scores);
    if (parsed.comments) Object.assign(comments, parsed.comments);
    return Object.keys(scores).length > 0;
  } catch(e) { return false; }
}

// INIT
function init() {
  renderCapNav();
  renderCards();
  updateScores();
}

function renderCapNav() {
  const nav = document.getElementById('capNav');
  nav.innerHTML = '';
  CAPABILITIES.forEach(cap => {
    const count = DATA.filter(d => d.capability === cap).length;
    const div = document.createElement('div');
    div.className = 'cap-nav-item' + (activeCapFilter === cap ? ' active' : '');
    div.onclick = () => filterByCap(cap);
    div.innerHTML = `
      <span class="cap-nav-dot"></span>
      <span class="cap-nav-label" title="${cap}">${cap}</span>
      <span class="cap-nav-count">${count}</span>
    `;
    nav.appendChild(div);
  });
  // All
  const allDiv = document.createElement('div');
  allDiv.className = 'cap-nav-item' + (activeCapFilter === 'all' ? ' active' : '');
  allDiv.onclick = () => filterByCap('all');
  allDiv.innerHTML = `<span class="cap-nav-dot"></span><span class="cap-nav-label">All Capabilities</span><span class="cap-nav-count">${DATA.length}</span>`;
  nav.insertBefore(allDiv, nav.firstChild);
}

function getFilteredData() {
  let filtered = DATA;
  if (activePhaseFilter === 'unassessed') {
    filtered = filtered.filter(d => scores[d.id] === null || scores[d.id] === undefined);
  } else if (activePhaseFilter !== 'all') {
    filtered = filtered.filter(d => d.phase === PHASES[parseInt(activePhaseFilter)]);
  }
  if (activeCapFilter !== 'all') {
    filtered = filtered.filter(d => d.capability === activeCapFilter);
  }
  const search = document.getElementById('searchInput').value.toLowerCase().trim();
  if (search) {
    filtered = filtered.filter(d =>
      d.recommendation.toLowerCase().includes(search) ||
      d.capability.toLowerCase().includes(search) ||
      d.aws_service.toLowerCase().includes(search) ||
      d.id.includes(search)
    );
  }
  return filtered;
}

function getPhaseIndex(phase) {
  return PHASES.indexOf(phase);
}

function renderCards() {
  const container = document.getElementById('cardsContainer');
  const noRes = document.getElementById('noResults');
  const filtered = getFilteredData();

  document.getElementById('itemCountBadge').textContent = `${filtered.length} items`;

  if (filtered.length === 0) {
    container.innerHTML = '';
    noRes.style.display = 'block';
    return;
  }
  noRes.style.display = 'none';

  // Group by capability then phase
  const groups = {};
  filtered.forEach(item => {
    const key = item.capability + '|||' + item.phase;
    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
  });

  // Sort by phase then capability
  const sortedKeys = Object.keys(groups).sort((a, b) => {
    const [capA, phA] = a.split('|||');
    const [capB, phB] = b.split('|||');
    const phDiff = PHASES.indexOf(phA) - PHASES.indexOf(phB);
    if (phDiff !== 0) return phDiff;
    return CAPABILITIES.indexOf(capA) - CAPABILITIES.indexOf(capB);
  });

  container.innerHTML = '';
  const fragment = document.createDocumentFragment();

  sortedKeys.forEach(key => {
    const [cap, phase] = key.split('|||');
    const phIdx = getPhaseIndex(phase);
    const items = groups[key];

    // Group header
    const header = document.createElement('div');
    header.className = 'cap-group-header';
    header.innerHTML = `
      <div class="cap-icon" style="background:${CAP_COLORS[cap]}20; color:${CAP_COLORS[cap]}; border: 1px solid ${CAP_COLORS[cap]}40;">${CAP_ICONS[cap]||'◆'}</div>
      <span class="cap-group-name">${cap}</span>
      <span class="cap-group-phase-badge phase-tag-${phIdx}">${PHASE_SHORT[phIdx]}</span>
    `;
    fragment.appendChild(header);

    items.forEach(item => {
      const card = document.createElement('div');
      card.className = 'rec-card';
      card.id = `card-${item.id}`;

      const scoreClass = getScoreClass(item.id);
      if (scoreClass) card.classList.add(scoreClass);

      const hasGuidance = item.guidance || item.how_to_check;
      const optionsHtml = SCORING_OPTIONS.map(o => `<option value="${o.value ?? ''}">${o.label}</option>`).join('');
      const currentScore = scores[item.id];
      const selectClass = getSelectClass(currentScore);
      
      card.innerHTML = `
        <div class="rec-header" onclick="handleHeaderClick(event, '${item.id}')">
          <span class="rec-id">${item.id}</span>
          <div class="rec-info">
            <div class="rec-title">${item.recommendation}</div>
            <div class="rec-meta">
              ${item.aws_service && item.aws_service !== 'N/A' ? `<span class="rec-service">⚙ ${item.aws_service}</span>` : ''}
            </div>
          </div>
          <div class="rec-select-wrapper" onclick="event.stopPropagation()">
            <select class="rec-select ${selectClass}" id="sel-${item.id}" onchange="setScore('${item.id}', this)">
              ${optionsHtml}
            </select>
          </div>
          ${hasGuidance ? `<button class="rec-expand-btn" id="btn-${item.id}"></button>` : ''}
        </div>
        <div class="rec-detail" id="detail-${id}">
          <div class="rec-detail-inner">
            ${item.guidance ? `<div class="rec-detail-block"><div class="detail-label">Assessment Guidance</div><div class="detail-text">${item.guidance.trim()}</div></div>` : ''}
            ${item.how_to_check ? `<div class="rec-detail-block"><div class="detail-label">How to Check</div><div class="detail-text">${item.how_to_check.trim()}</div></div>` : ''}
          </div>
          <textarea class="comments-input" id="cmt-${item.id}" placeholder="Add comments, owner, or notes..." oninput="setComment('${item.id}', this.value)">${comments[item.id]||''}</textarea>
        </div>
      `;

      // Restore select value
      if (currentScore !== undefined) {
        // Use getElementById because querySelector('#sel-...') fails when id contains dots
        const sel = card.querySelector('#' + CSS.escape('sel-' + item.id));
        if (sel) sel.value = currentScore === 'na' ? 'na' : (currentScore ?? '');
      }

      fragment.appendChild(card);
    });
  });

  container.appendChild(fragment);
}

function getScoreClass(id) {
  const s = scores[id];
  if (s === undefined || s === null || s === 'na') return '';
  if (s === 1) return 'has-score';
  if (s === 0.75) return 'score-75';
  if (s === 0.5) return 'score-50';
  return 'score-low';
}

function getSelectClass(val) {
  if (val === undefined || val === null || val === '') return '';
  if (val === 'na') return 'score-na';
  if (val === 1) return 'score-100';
  if (val === 0.75) return 'score-75';
  if (val === 0.5) return 'score-50';
  if (val === 0.25) return 'score-25';
  if (val === 0) return 'score-0';
  return '';
}

function toggleDetail(id) {
  const detail = document.getElementById(`detail-${id}`);
  const btn = document.getElementById(`btn-${id}`);
  const card = document.getElementById(`card-${id}`);
  
  const isOpen = detail.classList.contains('open');
  
  if (isOpen) {
    detail.classList.remove('open');
    if (btn) btn.classList.remove('open');
    card.classList.remove('expanded');
  } else {
    detail.classList.add('open');
    if (btn) btn.classList.add('open');
    card.classList.add('expanded');
  }
}

function handleHeaderClick(e, id) {
  // Evitar toggle si se hizo clic en el select o sus elementos
  if (e.target.closest('.rec-select-wrapper') || e.target.closest('.rec-select')) {
    return;
  }
  toggleDetail(id);
}

function setScore(id, sel) {
  const raw = sel.value;
  let val;
  if (raw === '' || raw === 'null') val = null;
  else if (raw === 'na') val = 'na';
  else val = parseFloat(raw);

  scores[id] = val;
  saveSession();

  // Update select style
  sel.className = 'rec-select ' + getSelectClass(val);

  // Update card border
  const card = document.getElementById(`card-${id}`);
  if (card) {
    card.className = 'rec-card';
    const sc = getScoreClass(id);
    if (sc) card.classList.add(sc);
  }

  updateScores();
  // If filtering by unassessed, re-render so scored item is removed
  if (activePhaseFilter === 'unassessed') renderCards();
  showSavedToast();
}

let commentSaveTimer = null;
function setComment(id, val) {
  comments[id] = val;
  clearTimeout(commentSaveTimer);
  commentSaveTimer = setTimeout(() => { saveSession(); showSavedToast(); }, 800);
}

function updateScores() {
  // Per phase
  const phasePcts = PHASES.map((ph, pi) => {
    const items = DATA.filter(d => d.phase === ph);
    const scored = items.filter(d => scores[d.id] !== null && scores[d.id] !== undefined && scores[d.id] !== 'na');
    if (scored.length === 0) return 0;
    const total = scored.reduce((sum, d) => sum + (scores[d.id] || 0), 0);
    return (total / scored.length) * 100;
  });

  const phaseCounts = PHASES.map(ph => DATA.filter(d => d.phase === ph).length);

  phasePcts.forEach((pct, i) => {
    const p = Math.round(pct);
    document.getElementById(`bar-p${i}`).style.width = p + '%';
    document.getElementById(`pct-p${i}`).textContent = p + '%';
    document.getElementById(`cnt-p${i}`).textContent = phaseCounts[i] + ' items';
    document.getElementById(`rbar-p${i}`).style.width = p + '%';
    document.getElementById(`rpct-p${i}`).textContent = p + '%';
  });

  // Overall
  const allScored = DATA.filter(d => scores[d.id] !== null && scores[d.id] !== undefined && scores[d.id] !== 'na');
  let overallPct = 0;
  if (allScored.length > 0) {
    overallPct = (allScored.reduce((s, d) => s + (scores[d.id] || 0), 0) / allScored.length) * 100;
  }
  const op = Math.round(overallPct);
  const circumference = 314.2;
  const offset = circumference - (circumference * op / 100);
  document.getElementById('scoreRing').style.strokeDashoffset = offset;
  document.getElementById('scoreRingText').textContent = op + '%';
  document.getElementById('scoreLabel').textContent = allScored.length === 0
    ? 'No assessments yet'
    : `${allScored.length} of ${DATA.length} items assessed`;

  // By capability
  renderCapScores();
  renderRadar();
}

function renderCapScores() {
  const list = document.getElementById('capScoresList');
  list.innerHTML = '';
  CAPABILITIES.forEach(cap => {
    const items = DATA.filter(d => d.capability === cap);
    const scored = items.filter(d => scores[d.id] !== null && scores[d.id] !== undefined && scores[d.id] !== 'na');
    let pct = 0;
    if (scored.length > 0) pct = Math.round((scored.reduce((s, d) => s + (scores[d.id] || 0), 0) / scored.length) * 100);
    const row = document.createElement('div');
    row.className = 'cap-score-row';
    row.innerHTML = `
      <span class="cap-score-label" title="${cap}">${cap}</span>
      <div class="cap-score-bar-track"><div class="cap-score-bar-fill" style="width:${pct}%; background: linear-gradient(90deg, ${CAP_COLORS[cap]}, ${CAP_COLORS[cap]}cc);"></div></div>
      <span class="cap-score-val" style="color:${CAP_COLORS[cap]}">${pct}%</span>
    `;
    list.appendChild(row);
  });
}

function renderRadar() {
  const svg = document.getElementById('radarSvg');
  const cx = 110, cy = 110, r = 75;
  const n = CAPABILITIES.length;
  const capScores = CAPABILITIES.map(cap => {
    const items = DATA.filter(d => d.capability === cap);
    const scored = items.filter(d => scores[d.id] !== null && scores[d.id] !== undefined && scores[d.id] !== 'na');
    if (scored.length === 0) return 0;
    return scored.reduce((s, d) => s + (scores[d.id] || 0), 0) / scored.length;
  });

  svg.innerHTML = '';

  // Grid rings
  [0.25, 0.5, 0.75, 1].forEach(level => {
    const pts = CAPABILITIES.map((_, i) => {
      const angle = (i / n) * 2 * Math.PI - Math.PI / 2;
      return [cx + Math.cos(angle) * r * level, cy + Math.sin(angle) * r * level];
    });
    const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    polygon.setAttribute('points', pts.map(p => p.join(',')).join(' '));
    polygon.setAttribute('fill', 'none');
    polygon.setAttribute('stroke', '#1e3050');
    polygon.setAttribute('stroke-width', '1');
    svg.appendChild(polygon);
  });

  // Axis lines
  CAPABILITIES.forEach((_, i) => {
    const angle = (i / n) * 2 * Math.PI - Math.PI / 2;
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', cx);
    line.setAttribute('y1', cy);
    line.setAttribute('x2', cx + Math.cos(angle) * r);
    line.setAttribute('y2', cy + Math.sin(angle) * r);
    line.setAttribute('stroke', '#1e3050');
    line.setAttribute('stroke-width', '1');
    svg.appendChild(line);
  });

  // Data polygon
  const dataPoints = capScores.map((score, i) => {
    const angle = (i / n) * 2 * Math.PI - Math.PI / 2;
    return [cx + Math.cos(angle) * r * score, cy + Math.sin(angle) * r * score];
  });
  const dataPoly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
  dataPoly.setAttribute('points', dataPoints.map(p => p.join(',')).join(' '));
  dataPoly.setAttribute('fill', 'rgba(255,153,0,0.15)');
  dataPoly.setAttribute('stroke', '#FF9900');
  dataPoly.setAttribute('stroke-width', '1.5');
  svg.appendChild(dataPoly);

  // Data dots
  dataPoints.forEach((pt, i) => {
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', pt[0]);
    circle.setAttribute('cy', pt[1]);
    circle.setAttribute('r', '3');
    circle.setAttribute('fill', CAP_COLORS[CAPABILITIES[i]]);
    svg.appendChild(circle);
  });

  // Labels
  const shortNames = ['Gov','Assur','IAM','Threat','Vuln','Infra','Data','AppSec','IR','Resilience'];
  CAPABILITIES.forEach((_, i) => {
    const angle = (i / n) * 2 * Math.PI - Math.PI / 2;
    const labelR = r + 16;
    const x = cx + Math.cos(angle) * labelR;
    const y = cy + Math.sin(angle) * labelR;
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', x);
    text.setAttribute('y', y);
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('dominant-baseline', 'middle');
    text.setAttribute('font-size', '8');
    text.setAttribute('fill', '#7a9cc4');
    text.textContent = shortNames[i] || CAPABILITIES[i].substring(0, 5);
    svg.appendChild(text);
  });
}

function filterByPhase(phase, el) {
  activePhaseFilter = phase;
  document.querySelectorAll('.phase-pill').forEach(p => {
    p.classList.remove('active-p0','active-p1','active-p2','active-p3','active-unassessed');
  });
  if (phase === 'all') {
    el.classList.add('active-p0');
  } else if (phase === 'unassessed') {
    el.classList.add('active-unassessed');
  } else {
    el.classList.add(`active-p${phase}`);
  }
  renderCards();
}

function filterPhase(phaseIdx) {
  // Update phase stat tabs
  document.querySelectorAll('.phase-stat').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.phase-stat')[phaseIdx].classList.add('active');

  activePhaseFilter = String(phaseIdx);
  // Update pills
  document.querySelectorAll('.phase-pill').forEach(p => {
    p.classList.remove('active-p0','active-p1','active-p2','active-p3','active-unassessed');
    if (p.dataset.p === String(phaseIdx)) p.classList.add(`active-p${phaseIdx}`);
  });
  renderCards();
}

function filterByCap(cap) {
  activeCapFilter = cap;
  renderCapNav();
  renderCards();
}

// ── Debounce para el input de búsqueda ──
let renderDebounceTimer = null;
function applyFilters() {
  clearTimeout(renderDebounceTimer);
  renderDebounceTimer = setTimeout(() => renderCards(), 120);
}

function resetAll() {
  openModal();
}

function openModal() {
  document.getElementById('confirmModal').classList.add('open');
}

function closeModal() {
  document.getElementById('confirmModal').classList.remove('open');
}

function confirmReset() {
  closeModal();
  Object.keys(scores).forEach(k => delete scores[k]);
  Object.keys(comments).forEach(k => delete comments[k]);
  try { localStorage.removeItem(STORAGE_KEY); } catch(e) {}
  renderCards();
  updateScores();
  const toast = document.getElementById('savedToast');
  toast.innerHTML = `<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><circle cx="6" cy="6" r="5.5" stroke="#ff4757"/><path d="M3.5 3.5l5 5M8.5 3.5l-5 5" stroke="#ff4757" stroke-width="1.2" stroke-linecap="round"/></svg> Session cleared`;
  toast.style.borderColor = 'var(--red)';
  toast.style.color = 'var(--red)';
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => {
      toast.innerHTML = `<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><circle cx="6" cy="6" r="5.5" stroke="#00d97e"/><path d="M3.5 6l2 2 3-3" stroke="#00d97e" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg> Session saved`;
      toast.style.borderColor = 'var(--green)';
      toast.style.color = 'var(--green)';
    }, 300);
  }, 2200);
}

function exportCSV() {
  const rows = [['ID','Phase','Capability','Recommendation','AWS Service','Alignment','Score','Comments']];
  DATA.forEach(item => {
    const s = scores[item.id];
    const sel = document.getElementById(`sel-${item.id}`);
    const alignLabel = sel ? sel.options[sel.selectedIndex]?.text : '--';
    const scoreVal = s === 'na' ? 'N/A' : (s === null || s === undefined ? '' : (s * 100) + '%');
    rows.push([item.id, item.phase, item.capability, item.recommendation, item.aws_service, alignLabel, scoreVal, comments[item.id]||'']);
  });
  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], {type:'text/csv'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'maturity-model-assessment.csv'; a.click();
  URL.revokeObjectURL(url);
}

let toastTimer = null;
function showSavedToast() {
  const toast = document.getElementById('savedToast');
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 1800);
}

// ─── PRINT PREVIEW ────────────────────────────────────────────────────────────

function openPrintPreview() {
  // Build capability checkboxes
  const capBox = document.getElementById('capCheckboxes');
  capBox.innerHTML = '';
  CAPABILITIES.forEach((cap, i) => {
    const lbl = document.createElement('label');
    lbl.className = 'print-checkbox-row';
    lbl.innerHTML = `<input type="checkbox" class="cap-chk" value="${i}" checked onchange="refreshPreview()">
      <span class="print-checkbox-label" style="font-size:11px">${cap}</span>`;
    capBox.appendChild(lbl);
  });
  document.getElementById('printModal').classList.add('open');
  refreshPreview();
}

function closePrintModal() {
  document.getElementById('printModal').classList.remove('open');
}

function toggleAllPhases(state) {
  document.querySelectorAll('.phase-chk').forEach(c => { c.checked = state; });
  refreshPreview();
}

function toggleAllCaps(state) {
  document.querySelectorAll('.cap-chk').forEach(c => { c.checked = state; });
  refreshPreview();
}

function getPrintOptions() {
  const format   = document.querySelector('input[name="printFormat"]:checked').value;
  const items    = document.querySelector('input[name="printItems"]:checked').value;
  const color    = document.querySelector('input[name="printColor"]:checked').value;
  const phases   = [...document.querySelectorAll('.phase-chk:checked')].map(c => parseInt(c.value));
  const caps     = [...document.querySelectorAll('.cap-chk:checked')].map(c => parseInt(c.value));
  const guidance = document.getElementById('tog-guidance').checked;
  const howto    = document.getElementById('tog-howto').checked;
  const cmts     = document.getElementById('tog-comments').checked;
  const service  = document.getElementById('tog-service').checked;
  const summary  = document.getElementById('tog-summary').checked;
  return { format, items, color, phases, caps, guidance, howto, cmts, service, summary };
}

function getPrintData(opts) {
  return DATA.filter(d => {
    const phIdx = PHASES.indexOf(d.phase);
    if (!opts.phases.includes(phIdx)) return false;
    const capIdx = CAPABILITIES.indexOf(d.capability);
    if (!opts.caps.includes(capIdx)) return false;
    const s = scores[d.id];
    const hasScore = s !== null && s !== undefined;
    if (opts.items === 'scored' && !hasScore) return false;
    if (opts.items === 'unscored' && hasScore) return false;
    return true;
  });
}

function scoreChipHtml(id, bw) {
  const s = scores[id];
  if (bw) {
    if (s === null || s === undefined) return `<span class="print-score-chip" style="background:#eee;color:#555!important">Not assessed</span>`;
    if (s === 'na')  return `<span class="print-score-chip" style="background:#ddd;color:#444!important">Excluded</span>`;
    if (s === 1)     return `<span class="print-score-chip" style="background:#111;color:#fff!important">100% Aligned</span>`;
    if (s === 0.75)  return `<span class="print-score-chip" style="background:#444;color:#fff!important">75% Aligned</span>`;
    if (s === 0.5)   return `<span class="print-score-chip" style="background:#777;color:#fff!important">50% Aligned</span>`;
    if (s === 0.25)  return `<span class="print-score-chip" style="background:#aaa;color:#fff!important">25% Aligned</span>`;
    return `<span class="print-score-chip" style="background:#f0f0f0;color:#333!important;border:1px solid #ccc">0% Aligned</span>`;
  }
  if (s === null || s === undefined) return `<span class="print-score-chip chip-none">Not assessed</span>`;
  if (s === 'na') return `<span class="print-score-chip chip-na">Excluded</span>`;
  if (s === 1)    return `<span class="print-score-chip chip-100">100% Aligned</span>`;
  if (s === 0.75) return `<span class="print-score-chip chip-75">75% Aligned</span>`;
  if (s === 0.5)  return `<span class="print-score-chip chip-50">50% Aligned</span>`;
  if (s === 0.25) return `<span class="print-score-chip chip-25">25% Aligned</span>`;
  return `<span class="print-score-chip chip-0">0% Aligned</span>`;
}

function buildSummaryGrid(data, accent) {
  const total    = data.length;
  const assessed = data.filter(d => scores[d.id] !== null && scores[d.id] !== undefined && scores[d.id] !== 'na').length;
  const aligned  = data.filter(d => scores[d.id] === 1).length;
  const partial  = data.filter(d => scores[d.id] > 0 && scores[d.id] < 1).length;
  const avg = assessed > 0
    ? Math.round(data.filter(d => scores[d.id] !== null && scores[d.id] !== undefined && scores[d.id] !== 'na')
        .reduce((s,d) => s + (scores[d.id] || 0), 0) / assessed * 100)
    : 0;
  const alignColor  = accent === '#111' ? '#111' : '#00875a';
  const partialColor = accent === '#111' ? '#555' : '#b35a00';
  return `<div class="print-summary-grid">
    <div class="print-summary-box"><div class="psb-val" style="color:${accent}">${total}</div><div class="psb-label">Total Items</div></div>
    <div class="print-summary-box"><div class="psb-val" style="color:${accent}">${assessed}</div><div class="psb-label">Assessed</div></div>
    <div class="print-summary-box"><div class="psb-val" style="color:${alignColor}">${aligned}</div><div class="psb-label">100% Aligned</div></div>
    <div class="print-summary-box"><div class="psb-val" style="color:${partialColor}">${partial}</div><div class="psb-label">Partial</div></div>
    <div class="print-summary-box"><div class="psb-val" style="color:${accent}">${avg}%</div><div class="psb-label">Avg Score</div></div>
  </div>`;
}

function buildPrintDoc(opts, data) {
  const bw = opts.color === 'bw';
  const accent   = bw ? '#111' : '#FF9900';
  const accentBg = bw ? '#f0f0f0' : '#fff3e0';
  const phColors = bw
    ? ['#333','#555','#777','#999']
    : ['#FF9900','#3ecf8e','#4da6ff','#b47aff'];
  const phBgs = bw
    ? ['#f4f4f4','#efefef','#eaeaea','#e5e5e5']
    : ['#fff4e0','#eafaf4','#e8f3ff','#f4eeff'];
  const now = new Date().toLocaleDateString('en-US', {year:'numeric',month:'long',day:'numeric'});

  // Wrap everything in a BW class if needed
  const wrapOpen  = bw ? '<div class="print-bw">' : '<div>';
  const wrapClose = '</div>';

  let html = wrapOpen + `
  <div class="print-doc-header" style="border-bottom-color:${accent}">
    <div class="print-doc-logo">
      <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
        <rect width="36" height="36" rx="8" fill="${accentBg}"/>
        <path d="M18 4L5 11v14l13 7 13-7V11L18 4z" stroke="${accent}" stroke-width="2" fill="${bw?'rgba(0,0,0,0.08)':'rgba(255,153,0,0.15)'}"/>
        <path d="M18 13L12 17v7l6 3.5 6-3.5v-7L18 13z" fill="${accent}"/>
      </svg>
      <div>
        <div class="print-doc-brand">AWS Security <span style="color:${accent}">Maturity Model</span></div>
        <div class="print-doc-sub">Self-Assessment Report · v7 ${bw ? '· B&amp;W' : '· Color'}</div>
      </div>
    </div>
    <div class="print-doc-meta">
      <strong>Generated:</strong> ${now}<br>
      <strong>Items:</strong> ${data.length} selected<br>
      <strong>Phases:</strong> ${opts.phases.map(i => 'P'+(i+1)).join(', ') || '—'}
    </div>
  </div>`;

  if (opts.summary) html += buildSummaryGrid(data, accent);

  // Group by phase → capability
  const grouped = {};
  data.forEach(item => {
    const ph = item.phase;
    const cap = item.capability;
    if (!grouped[ph]) grouped[ph] = {};
    if (!grouped[ph][cap]) grouped[ph][cap] = [];
    grouped[ph][cap].push(item);
  });

  PHASES.forEach((phase, pi) => {
    if (!grouped[phase]) return;
    html += `<div class="print-phase-heading" style="background:${phBgs[pi]};border-left:4px solid ${phColors[pi]}">
      Phase ${pi+1}: ${PHASE_SHORT[pi]}
      <span class="ph-badge" style="background:${phColors[pi]}20;color:${phColors[pi]};border:1px solid ${phColors[pi]}40">${Object.values(grouped[phase]).flat().length} items</span>
    </div>`;

    CAPABILITIES.forEach(cap => {
      if (!grouped[phase][cap]) return;
      const items = grouped[phase][cap];
      html += `<div class="print-cap-heading">${CAP_ICONS[cap]||''} ${cap}</div>`;

      if (opts.format === 'table') {
        let thService = opts.service ? '<th>AWS Service</th>' : '';
        html += `<table class="print-table"><thead><tr>
          <th style="width:40px;border-bottom-color:${accent}">ID</th>
          <th style="border-bottom-color:${accent}">Recommendation</th>
          ${thService ? `<th style="border-bottom-color:${accent}">AWS Service</th>` : ''}
          <th style="width:110px;border-bottom-color:${accent}">Alignment</th>
          ${opts.cmts ? `<th style="border-bottom-color:${accent}">Comments</th>` : ''}
        </tr></thead><tbody>`;
        items.forEach(item => {
          let tdService = opts.service ? `<td>${item.aws_service !== 'N/A' ? item.aws_service : '—'}</td>` : '';
          const guidBorder = bw ? '#999' : '#FF9900';
          const howtoBorder = bw ? '#999' : '#4da6ff';
          html += `<tr>
            <td style="font-family:monospace;color:#888;white-space:nowrap">${item.id}</td>
            <td>${item.recommendation}
              ${opts.guidance && item.guidance ? `<div style="font-size:9px;color:#666;margin-top:3px;padding-left:6px;border-left:2px solid ${guidBorder}">${item.guidance.trim().replace(/\n/g,'<br>')}</div>` : ''}
              ${opts.howto && item.how_to_check ? `<div style="font-size:9px;color:#4a7aaa;margin-top:3px;padding-left:6px;border-left:2px solid ${howtoBorder}">${item.how_to_check.trim().replace(/\n/g,'<br>')}</div>` : ''}
            </td>
            ${tdService}
            <td>${scoreChipHtml(item.id, bw)}</td>
            ${opts.cmts ? `<td style="color:#555;font-size:9px">${comments[item.id]||''}</td>` : ''}
          </tr>`;
        });
        html += '</tbody></table>';
      } else {
        const guidBorder = bw ? '#999' : '#FF9900';
        const howtoBorder = bw ? '#999' : '#4da6ff';
        items.forEach(item => {
          const svc = opts.service && item.aws_service && item.aws_service !== 'N/A'
            ? `<span class="print-card-service" style="${bw?'background:#f0f0f0;border-color:#ccc;color:#333':''}">${item.aws_service}</span>` : '';
          html += `<div class="print-card">
            <div class="print-card-header">
              <span class="print-card-id">${item.id}</span>
              <span class="print-card-title">${item.recommendation}</span>
              ${svc}
            </div>
            <div class="print-card-footer">
              ${scoreChipHtml(item.id, bw)}
            </div>
            ${opts.guidance && item.guidance ? `<div class="print-card-guidance" style="border-left-color:${guidBorder}">${item.guidance.trim().replace(/\n/g,'<br>')}</div>` : ''}
            ${opts.howto && item.how_to_check ? `<div class="print-card-guidance" style="border-left-color:${howtoBorder}">${item.how_to_check.trim().replace(/\n/g,'<br>')}</div>` : ''}
            ${opts.cmts && comments[item.id] ? `<div class="print-card-comment" style="${bw?'background:#f5f5f5;border-left-color:#999':''}">${comments[item.id]}</div>` : ''}
          </div>`;
        });
      }
    });
  });

  html += wrapClose;
  return html;
}

function refreshPreview() {
  const opts = getPrintOptions();
  const data = getPrintData(opts);
  document.getElementById('previewItemCount').textContent = `${data.length} items`;
  const doc = document.getElementById('previewDoc');
  doc.innerHTML = buildPrintDoc(opts, data);
  if (opts.color === 'bw') {
    doc.classList.add('print-bw');
  } else {
    doc.classList.remove('print-bw');
  }
}

function executePrint() {
  const opts = getPrintOptions();
  const data = getPrintData(opts);
  const html = buildPrintDoc(opts, data);
  const printArea = document.getElementById('printArea');
  printArea.innerHTML = `<div class="print-doc">${html}</div>`;
  if (opts.color === 'bw') {
    printArea.classList.add('print-bw');
  } else {
    printArea.classList.remove('print-bw');
  }
  closePrintModal();
  setTimeout(() => { window.print(); }, 100);
}

document.getElementById('printModal').addEventListener('click', function(e) {
  if (e.target === this) closePrintModal();
});

// Close printModal on Escape (already handled confirmModal, extend it)
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') { closePrintModal(); closeModal(); }
});

// ─── END PRINT PREVIEW ────────────────────────────────────────────────────────

// ─── BOOT ─────────────────────────────────────────────────────────────────────
const loadingEl = document.getElementById('loadingScreen');
if (loadingEl) loadingEl.style.display = 'flex';

loadData().then(() => {
  if (loadingEl) loadingEl.style.display = 'none';
  const sessionRestored = loadSession();
  init();
  if (sessionRestored) {
    setTimeout(() => {
      const toast = document.getElementById('savedToast');
      toast.innerHTML = '<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><circle cx="6" cy="6" r="5.5" stroke="#00d97e"/><path d="M3.5 6l2 2 3-3" stroke="#00d97e" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg> Session restored';
      toast.classList.add('show');
      toastTimer = setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
          toast.innerHTML = '<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><circle cx="6" cy="6" r="5.5" stroke="#00d97e"/><path d="M3.5 6l2 2 3-3" stroke="#00d97e" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg> Session saved';
        }, 300);
      }, 2200);
    }, 400);
  }
}).catch(err => {
  if (loadingEl) {
    loadingEl.innerHTML = '<div style="text-align:center;color:#ff4757"><p style="font-size:18px;font-weight:700;margin-bottom:8px">Failed to load assessment data</p><p style="font-size:13px;color:#7a9cc4">' + err.message + '</p><p style="font-size:11px;color:#3d5a7e;margin-top:12px">Run via a local server (npx serve .) or deploy to Vercel.</p></div>';
  }
});
