// v2.89.137 — Performance Dashboard webview script.
// state schema: {
//   loading: bool, error: string|null,
//   data: {
//     totals: { by_currency: {USD: {gross, refunds, fees, count}}, by_period: {today, week, month} },
//     by_project: { 'neon-survivor': {gross, count, currency, items: {...}} },
//     by_day: { '2026-05-12': {USD: {gross, count}} },
//     transactions: [{id, ts, ts_epoch, value, currency, subject, event_code, is_refund}]
//   }
// }

const vscode = acquireVsCodeApi();
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
const fmtNum = (n) => Number(n||0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2});
const fmtInt = (n) => Number(n||0).toLocaleString();

let lastData = null;
let firstRender = true;

// ───────── Glyph rain (background) ─────────
function spawnGlyphRain() {
  const wrap = $('glyphRain');
  if (!wrap) return;
  const W = window.innerWidth;
  const cols = Math.min(40, Math.floor(W / 28));
  const glyphs = 'ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿ$01_-アエ◆◇⬢⬡';
  for (let i = 0; i < cols; i++) {
    const col = document.createElement('div');
    col.className = 'col';
    col.style.left = (i / cols * 100) + '%';
    col.style.animationDuration = (10 + Math.random() * 25) + 's';
    col.style.animationDelay = (-Math.random() * 20) + 's';
    let txt = '';
    for (let r = 0; r < 30; r++) txt += glyphs[Math.floor(Math.random()*glyphs.length)] + '\n';
    col.textContent = txt;
    wrap.appendChild(col);
  }
}

// ───────── Count-up animation ─────────
function countUp(el, target, opts = {}) {
  const duration = opts.duration || 1100;
  const decimals = opts.decimals != null ? opts.decimals : 2;
  const startVal = parseFloat(el.dataset.last || '0');
  const t0 = performance.now();
  function tick(now) {
    const p = Math.min(1, (now - t0) / duration);
    const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
    const v = startVal + (target - startVal) * eased;
    el.textContent = v.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    if (p < 1) requestAnimationFrame(tick);
    else {
      el.dataset.last = String(target);
      // v2.89.150 — 완료 시 부모 .kpi 카드에 burst 효과
      if (target > 0 && target !== startVal) {
        const card = el.closest('.kpi');
        if (card) {
          card.classList.add('complete-burst');
          setTimeout(() => card.classList.remove('complete-burst'), 800);
        }
      }
    }
  }
  requestAnimationFrame(tick);
}





function renderCeoSummary(data) {
  const main = $('ceoSummaryMain');
  const sub = $('ceoSummarySub');
  const badge = $('ceoSummaryBadge');
  if (!main || !sub || !badge) return;

  const mv = data.market_view || {};
  const risk = data.risk_status || {};
  const perf = data.performance || {};
  const flow = data.investor_flow || {};

  const market = mv.market_view || 'UNKNOWN';
  const riskStatus = risk.status || 'UNKNOWN';
  const monthPct = Number(perf.month_return_pct || 0);
  const pnl = Number((data.totals?.by_period || {}).thirty || 0);
  const tradeCount = Number((data.totals?.by_currency?.KRW || {}).count || 0);

  const flowThemes = Array.isArray(flow.top_real_themes) ? flow.top_real_themes : [];
  const meaningfulThemes = flowThemes.filter(t => String(t.theme || '') !== '미분류');

  const trendLeaders = meaningfulThemes
    .filter(t => Number(t.trend_5d?.sum_est_qty || t.trend_3d?.sum_est_qty || 0) > 0)
    .sort((a, b) => Number(b.trend_5d?.sum_est_qty || b.trend_3d?.sum_est_qty || 0) - Number(a.trend_5d?.sum_est_qty || a.trend_3d?.sum_est_qty || 0));

  const positiveThemes = meaningfulThemes
    .filter(t => Number(t.sum_est_qty || 0) > 0)
    .sort((a, b) => Number(b.sum_est_qty || 0) - Number(a.sum_est_qty || 0));

  const fallbackThemes = meaningfulThemes
    .slice()
    .sort((a, b) => Math.abs(Number(b.sum_est_qty || 0)) - Math.abs(Number(a.sum_est_qty || 0)));

  const topTheme = trendLeaders[0] || positiveThemes[0] || fallbackThemes[0] || flowThemes[0] || null;

  const topTrend = topTheme ? (topTheme.trend_5d || topTheme.trend_3d || null) : null;
  const topThemeSum = topTheme ? Number(topTrend?.sum_est_qty ?? topTheme.sum_est_qty ?? 0) : 0;
  const topThemeLabel = topTheme
    ? (topTrend && Number(topTrend.seen_days || 0) >= 2
      ? `${Number(topTrend.seen_days || 0)}일 누적`
      : (topThemeSum > 0 ? '오늘 주도' : (topThemeSum < 0 ? '오늘 이탈' : '관찰')))
    : '';
  const topThemeText = topTheme
    ? `${topTheme.theme} ${topThemeSum >= 0 ? '+' : ''}${Math.round(topThemeSum).toLocaleString('ko-KR')} (${topThemeLabel})`
    : '수급 대기';

  const pnlText = `${pnl >= 0 ? '+' : ''}${Math.round(pnl).toLocaleString('ko-KR')} KRW`;
  const pctText = `${monthPct >= 0 ? '+' : ''}${monthPct.toFixed(3)}%`;

  let verdict = 'WATCH';
  let color = '#67e8f9';
  if (riskStatus === 'NORMAL' && market === 'RISK_ON') {
    verdict = 'GO';
    color = '#34d399';
  }
  if (riskStatus !== 'NORMAL' || market === 'RISK_OFF') {
    verdict = 'CAUTION';
    color = '#fbbf24';
  }

  main.textContent = `${market} · ${riskStatus} · ${tradeCount}건 · ${pctText}`;
  sub.textContent = `누적손익 ${pnlText} · 수급 ${topThemeText} · 보유 ${Number(risk.positions_count || 0)} · 셧다운 ${risk.shutdown ? 'ON' : 'OFF'}`;

  badge.textContent = verdict;
  badge.style.color = color;
  badge.style.textShadow = `0 0 12px ${color}`;
  badge.style.borderColor = color;
}


function renderRiskStatus(risk) {
  const box = $('riskStatusBox');
  if (!box) return;

  if (!risk) {
    box.innerHTML = '<div style="color:var(--text-3);font-size:.9rem;">office_inspection_report.json 대기 중</div>';
    return;
  }

  const status = risk.status || 'UNKNOWN';
  const dangerCount = Array.isArray(risk.dangers) ? risk.dangers.length : 0;
  const warningCount = Array.isArray(risk.warnings) ? risk.warnings.length : 0;
  const statusColor = status === 'NORMAL' ? '#34d399' : (dangerCount > 0 ? '#fb7185' : '#fbbf24');

  const krw = (v) => {
    const n = Number(v || 0);
    return (n > 0 ? '+' : '') + Math.round(n).toLocaleString('ko-KR');
  };

  const pill = (label, value, color) => `<div style="
    border:1px solid rgba(103,232,249,.20);
    background:rgba(15,23,42,.46);
    border-radius:16px;
    padding:14px 16px;
    min-height:74px;
  ">
    <div style="font-size:.72rem;color:#94a3b8;margin-bottom:6px;">${label}</div>
    <div style="font-size:1.15rem;font-weight:1000;color:${color || '#e2e8f0'};text-shadow:0 0 8px ${color || 'transparent'};">${value}</div>
  </div>`;

  box.innerHTML =
    `<div style="
      border:1px solid rgba(103,232,249,.26);
      background:rgba(15,23,42,.56);
      border-radius:18px;
      padding:16px;
      min-height:74px;
    ">
      <div style="font-size:.72rem;color:#94a3b8;margin-bottom:6px;">감사관 상태</div>
      <div style="font-size:1.5rem;font-weight:1000;color:${statusColor};text-shadow:0 0 12px ${statusColor};">${esc(status)}</div>
    </div>` +
    pill('경고 / 위험', `${warningCount} / ${dangerCount}`, dangerCount > 0 ? '#fb7185' : '#67e8f9') +
    pill('일일손익', `${krw(risk.daily_pnl)} KRW`, Number(risk.daily_pnl || 0) >= 0 ? '#67e8f9' : '#fb7185') +
    pill('잔고', `${Math.round(Number(risk.balance || 0)).toLocaleString('ko-KR')} KRW`, '#e2e8f0') +
    pill('보유 / 셧다운', `${Number(risk.positions_count || 0)} / ${risk.shutdown ? 'ON' : 'OFF'}`, risk.shutdown ? '#fb7185' : '#34d399');
}


function renderInvestorFlow(flow) {
  const box = $('investorFlowBox');
  if (!box) return;

  if (!flow || !Array.isArray(flow.top_real_themes) || flow.top_real_themes.length === 0) {
    box.innerHTML = '<div style="color:var(--text-3);font-size:.9rem;">investor_flow_report.json 대기 중</div>';
    return;
  }

  box.innerHTML = flow.top_real_themes.slice(0, 6).map(t => {
    const sum = Number(t.sum_est_qty || 0);
    const clsColor = sum > 0 ? '#67e8f9' : (sum < 0 ? '#fb7185' : '#fbbf24');
    const sign = sum > 0 ? '+' : '';
    const t3 = t.trend_3d || null;
    const t5 = t.trend_5d || null;
    const trendBase = t5 || t3 || null;
    const trendSum = Number(trendBase?.sum_est_qty || 0);
    const positiveDays = Number(trendBase?.positive_days || 0);
    const seenDays = Number(trendBase?.seen_days || 0);

    let flowLabel = sum > 0 ? '오늘 주도' : (sum < 0 ? '오늘 이탈' : '오늘 관찰');
    if (trendBase && seenDays >= 2 && trendSum > 0 && positiveDays >= Math.min(3, seenDays)) {
      flowLabel = `${seenDays}일 누적 주도`;
    } else if (trendBase && seenDays >= 2 && trendSum < 0) {
      flowLabel = `${seenDays}일 누적 이탈`;
    }

    const labelColor = flowLabel.includes('주도') ? '#34d399' : (flowLabel.includes('이탈') ? '#fb7185' : '#fbbf24');
    const stocks = Array.isArray(t.stocks)
      ? t.stocks.slice(0, 2).map(s => esc(s.name || s.ticker || '')).filter(Boolean).join(' · ')
      : '';

    return `<div style="
      border:1px solid rgba(103,232,249,.22);
      background:rgba(15,23,42,.46);
      border-radius:16px;
      padding:14px 16px;
      min-height:92px;
      box-shadow:inset 0 0 18px rgba(34,211,238,.05);
    ">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px;">
        <div style="font-size:.82rem;color:#94a3b8;">${esc(t.theme)}</div>
        <div style="font-size:.68rem;font-weight:900;color:${labelColor};border:1px solid ${labelColor};border-radius:999px;padding:3px 8px;background:rgba(15,23,42,.45);">${flowLabel}</div>
      </div>
      <div style="font-size:1.35rem;font-weight:1000;color:${clsColor};text-shadow:0 0 10px ${clsColor};">
        ${sign}${Math.round(sum).toLocaleString('ko-KR')}
      </div>
      <div style="font-size:.72rem;color:#64748b;margin-top:6px;">
        오늘 외 ${Math.round(Number(t.foreign_est_qty || 0)).toLocaleString('ko-KR')}
        · 기 ${Math.round(Number(t.institution_est_qty || 0)).toLocaleString('ko-KR')}
      </div>
      <div style="font-size:.72rem;color:#94a3b8;margin-top:4px;">
        누적 ${trendBase ? `${seenDays}일 ${Math.round(trendSum).toLocaleString('ko-KR')}` : '데이터 부족'}
      </div>
      <div style="font-size:.72rem;color:#94a3b8;margin-top:4px;">${stocks || '종목 없음'}</div>
    </div>`;
  }).join('');
}


function renderMarketView(view) {
  const badge = $('marketViewBadge');
  const sectors = $('marketViewSectors');
  const rationale = $('marketViewRationale');
  if (!badge || !sectors || !rationale) return;

  if (!view) {
    badge.textContent = 'UNKNOWN';
    sectors.textContent = 'market_view.json 없음';
    rationale.textContent = 'Market Analyst 실행 후 시장 뷰가 표시됩니다.';
    return;
  }

  const favored = Array.isArray(view.favored_sectors) ? view.favored_sectors : [];
  const disfavored = Array.isArray(view.disfavored_sectors) ? view.disfavored_sectors : [];

  badge.textContent = view.market_view || 'UNKNOWN';
  sectors.innerHTML =
    '<span style="color:#34d399;font-weight:800;">선호</span> ' + esc(favored.join(' · ') || '-') +
    ' <span style="color:#64748b;margin:0 8px;">|</span> ' +
    '<span style="color:#fb7185;font-weight:800;">주의</span> ' + esc(disfavored.join(' · ') || '-');

  rationale.textContent = view.rationale || '시장 뷰 근거 없음';
}


// ───────── Sparkline (daily revenue) ─────────
function renderSparkline(byDay, primaryCur) {
  const svg = $('sparkSvg');
  if (!svg) return;
  const days = [];
  const today = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const day = byDay[key];
    const v = day && day[primaryCur] ? day[primaryCur].gross : 0;
    days.push({ key, value: v, date: d });
  }
  const maxV = Math.max(...days.map(d => d.value), 1);
  const W = 800, H = 160, padL = 36, padR = 8, padT = 16, padB = 24;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const xOf = (i) => padL + (i / (days.length - 1)) * innerW;
  const yOf = (v) => padT + innerH - (v / maxV) * innerH;

  const pts = days.map((d, i) => `${xOf(i).toFixed(1)},${yOf(d.value).toFixed(1)}`).join(' ');
  const areaPts = `${padL},${padT + innerH} ${pts} ${xOf(days.length-1)},${padT + innerH}`;

  const peakIdx = days.reduce((acc, d, i) => d.value > days[acc].value ? i : acc, 0);

  const dots = days.map((d, i) => {
    if (d.value <= 0) return '';
    const isPeak = i === peakIdx && d.value > 0;
    return `<circle class="spark-dot${isPeak?' peak':''}" cx="${xOf(i).toFixed(1)}" cy="${yOf(d.value).toFixed(1)}" r="${isPeak?5:3}"></circle>`;
  }).join('');

  // Y-axis labels (3 levels)
  const yLabels = [maxV, maxV/2, 0].map((v, i) => {
    const y = yOf(v) + 4;
    return `<text class="spark-label" x="${padL - 6}" y="${y.toFixed(1)}" text-anchor="end">${v.toFixed(0)}</text>`;
  }).join('');

  // X-axis labels (start, middle, end)
  const xTicks = [0, Math.floor(days.length/2), days.length-1].map(i => {
    const d = days[i].date;
    const label = (d.getMonth()+1) + '/' + d.getDate();
    return `<text class="spark-label" x="${xOf(i).toFixed(1)}" y="${H-6}" text-anchor="middle">${label}</text>`;
  }).join('');

  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.innerHTML = `
    <defs>
      <linearGradient id="gradArea" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#22d3ee" stop-opacity="0.45"></stop>
        <stop offset="100%" stop-color="#22d3ee" stop-opacity="0"></stop>
      </linearGradient>
    </defs>
    <polygon class="spark-area" points="${areaPts}"></polygon>
    <polyline class="spark-line" points="${pts}"></polyline>
    ${dots}
    ${yLabels}
    ${xTicks}
  `;
}

// ───────── Donut (project mix) ─────────
const PROJECT_COLORS = ['#22d3ee', '#a78bfa', '#fbbf24', '#34d399', '#f0abfc', '#fb923c', '#67e8f9'];

function renderDonut(byProject, primaryCur) {
  const svg = $('donutSvg');
  const legend = $('donutLegend');
  const centerVal = $('donutCenterVal');
  if (!svg || !legend) return;

  const entries = Object.entries(byProject || {})
    .map(([name, p]) => ({ name, gross: Math.abs(p.pnl ?? p.gross ?? 0), pnl: p.pnl ?? p.gross ?? 0, count: p.count || 0 }))
    .filter(p => p.gross > 0)
    .sort((a, b) => b.gross - a.gross);

  const total = entries.reduce((s, p) => s + p.gross, 0);
  if (centerVal) {
    centerVal.dataset.last = centerVal.dataset.last || '0';
    countUp(centerVal, total, { decimals: 2 });
  }

  if (entries.length === 0) {
    svg.innerHTML = `<circle cx="100" cy="100" r="80" fill="none" stroke="rgba(255,255,255,0.05)" stroke-width="18"></circle>`;
    legend.innerHTML = '<div style="color: var(--text-3); font-size: 0.85rem; padding: 10px 0;">매매 0건</div>';
    return;
  }

  const R = 80, CX = 100, CY = 100;
  const C = 2 * Math.PI * R;
  let accum = 0;
  const segs = entries.map((p, i) => {
    const frac = p.gross / total;
    const dash = C * frac;
    const gap = C - dash;
    const offset = -accum * C;
    accum += frac;
    return `<circle cx="${CX}" cy="${CY}" r="${R}" fill="none"
            stroke="${PROJECT_COLORS[i % PROJECT_COLORS.length]}"
            stroke-width="18"
            stroke-dasharray="${dash.toFixed(2)} ${gap.toFixed(2)}"
            stroke-dashoffset="${offset.toFixed(2)}"
            transform="rotate(-90 ${CX} ${CY})"
            style="filter: drop-shadow(0 0 6px ${PROJECT_COLORS[i % PROJECT_COLORS.length]}); transition: stroke-dashoffset 0.6s ease;"></circle>`;
  }).join('');

  svg.setAttribute('viewBox', '0 0 200 200');
  svg.innerHTML = segs;

  legend.innerHTML = entries.map((p, i) => {
    const pct = (p.gross / total * 100).toFixed(1);
    const color = PROJECT_COLORS[i % PROJECT_COLORS.length];
    return `<div class="item">
      <div class="swatch" style="background:${color}; color:${color};"></div>
      <div class="name">${esc(p.name)}</div>
      <div class="pct">${pct}%</div>
    </div>`;
  }).join('');
}

// ───────── Project bars (detailed breakdown) ─────────
function renderProjectBars(byProject) {
  const wrap = $('projBars');
  if (!wrap) return;
  const entries = Object.entries(byProject || {})
    .map(([name, p]) => ({ name, gross: Math.abs(p.pnl ?? p.gross ?? 0), pnl: p.pnl ?? p.gross ?? 0, count: p.count || 0, items: p.items || {} }))
    .filter(p => p.gross > 0)
    .sort((a, b) => b.gross - a.gross);

  if (entries.length === 0) {
    wrap.innerHTML = '';
    return;
  }
  const maxV = Math.max(...entries.map(p => p.gross), 1);
  wrap.innerHTML = entries.map(p => {
    const w = (p.gross / maxV * 100).toFixed(1);
    const items = Object.entries(p.items || {}).sort((a,b) => Math.abs(b[1].pnl ?? b[1].gross ?? 0) - Math.abs(a[1].pnl ?? a[1].gross ?? 0)).slice(0, 3);
    const itemsTxt = items.map(([k,v]) => `${esc(k)} ×${v.count}`).join(' · ');
    return `<div class="proj-bar">
      <div class="name">${esc(p.name)}</div>
      <div class="bar-track"><div class="bar-fill" style="width:${w}%"></div></div>
      <div class="val">${(p.pnl >= 0 ? "+" : "") + Math.round(p.pnl).toLocaleString("ko-KR")} KRW</div>
    </div>
    <div style="font-size: 0.72rem; color: var(--text-3); padding: 0 0 8px 154px;">${itemsTxt}</div>`;
  }).join('');
}

// ───────── Transaction feed ─────────
const KNOWN_TX_IDS = new Set();
function renderTransactions(txs) {
  const feed = $('feed');
  if (!feed) return;
  if (!txs || txs.length === 0) {
    feed.innerHTML = `<div class="empty">
      <div class="emoji">📭</div>
      <h3>아직 매매 기록이 없어요</h3>
      <p>Hermes 매매 로그가 쌓이면 최근 매매가 표시됩니다.</p>
    </div>`;
    return;
  }

  feed.innerHTML = txs.slice(0, 30).map(tx => {
    const isNew = !firstRender && !KNOWN_TX_IDS.has(tx.id);
    KNOWN_TX_IDS.add(tx.id);
    const cls = tx.is_refund ? 'refund' : 'payment';
    const icon = tx.is_refund ? '▼' : '▲';
    const sign = tx.value < 0 ? '-' : '+';
    const subj = tx.subject || '(설명 없음)';
    const ts = tx.ts ? new Date(tx.ts) : null;
    const tsStr = ts ? `${ts.getMonth()+1}/${ts.getDate()} ${String(ts.getHours()).padStart(2,'0')}:${String(ts.getMinutes()).padStart(2,'0')}` : '?';
    return `<div class="tx${isNew?' new':''}" data-id="${esc(tx.id)}">
      <div class="tx-icon ${cls}">${icon}</div>
      <div class="tx-body">
        <div class="tx-subject">${esc(subj)}</div>
        <div class="tx-meta">${tsStr} · ${esc(tx.currency)} · ${esc(tx.event_code || '')}</div>
      </div>
      <div class="tx-amount ${cls}">${sign}${fmtNum(Math.abs(tx.value))}</div>
    </div>`;
  }).join('');

  if (!firstRender) {
    // 새 거래가 있으면 burst alert
    const newOnes = txs.slice(0, 30).filter(tx => {
      const known = feed.querySelector(`[data-id="${tx.id}"]`);
      return known && known.classList.contains('new');
    });
    if (newOnes.length > 0) showBurst(newOnes[0]);
  }
}

// ───────── New payment burst alert ─────────
function showBurst(tx) {
  const burst = $('burst');
  if (!burst) return;
  const isRefund = tx.is_refund;
  const sign = isRefund ? '-' : '+';
  burst.innerHTML = `
    <div class="big">${sign}$${Math.abs(tx.value).toFixed(2)}</div>
    <div class="sub">${esc(tx.subject || '새 매매')}</div>
  `;
  burst.classList.remove('show');
  void burst.offsetWidth;
  burst.classList.add('show');
}

// ───────── KPI strip render ─────────
function renderKPI(data) {
  const perf = data?.performance || {};
  const totals = data?.totals || {};
  const period = totals.by_period || {};
  const byCur = totals.by_currency || {};
  const krw = byCur.KRW || {};
  const tradeCount = Number(krw.count || 0);

  const pct = (v) => {
    const n = Number(v || 0);
    return (n > 0 ? '+' : '') + n.toFixed(3) + '%';
  };
  const krwFmt = (v) => {
    const n = Number(v || 0);
    return (n > 0 ? '+' : '') + Math.round(n).toLocaleString('ko-KR') + ' KRW';
  };

  $('curLabel').textContent = '수익률';
  $('kpiToday').textContent = pct(perf.today_return_pct);
  $('kpiWeek').textContent = pct(perf.seven_day_return_pct);
  $('kpiMonth').textContent = pct(perf.month_return_pct);
  $('kpiNet').textContent = krwFmt(period.thirty ?? krw.gross ?? 0);
  $('kpiCount').textContent = String(tradeCount);

  $('kpiMonthSub').textContent =
    `${tradeCount}건 · 승률 ${Number(perf.win_rate_pct || 0).toFixed(1)}% · 손절 ${Number(perf.stop_losses || 0)} · 익절 ${Number(perf.take_profits || 0)}`;

  return 'KRW';
}

// ───────── Master render ─────────
function render(state) {
  if (state.loading) {
    $('emptyArea')?.classList.add('hidden');
    return;
  }
  if (state.error) {
    $('emptyArea').classList.remove('hidden');
    $('emptyArea').innerHTML = `<div class="empty">
      <div class="emoji">⚠️</div>
      <h3>수익률 데이터 가져오기 실패</h3>
      <p>${esc(state.error)}</p>
      <p style="margin-top:10px;">
        Hermes 성과 데이터 파일 연결을 확인하세요.<br>
        performance_summary.json 생성 여부를 확인하세요.
      </p>
    </div>`;
    return;
  }
  const data = state.data;
  if (!data) return;
  lastData = data;
  $('emptyArea').classList.add('hidden');

  const primaryCur = renderKPI(data);
  renderCeoSummary(data);
  renderMarketView(data.market_view || null);
  renderRiskStatus(data.risk_status || null);
  renderInvestorFlow(data.investor_flow || null);
  renderSparkline(data.by_day || {}, primaryCur);
  renderDonut(data.by_project || {}, primaryCur);
  renderProjectBars(data.by_project || {});
  renderTransactions(data.transactions || []);

  $('generated').textContent = data.generated_at ? new Date(data.generated_at).toLocaleString() : '';
  firstRender = false;
}

// ───────── Wire UI ─────────
$('refreshBtn')?.addEventListener('click', () => {
  vscode.postMessage({ type: 'refresh' });
  $('refreshBtn').textContent = '⏳ 새로고침 중...';
  setTimeout(() => $('refreshBtn').textContent = '🔄 새로고침', 800);
});
$('settingsBtn')?.addEventListener('click', () => {
  vscode.postMessage({ type: 'openSettings' });
});

window.addEventListener('message', e => {
  const m = e.data;
  if (m.type === 'state') render(m);
});

spawnGlyphRain();
vscode.postMessage({ type: 'ready' });
