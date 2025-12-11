(() => {
  const API_BASE = 'https://botkey.vshtechteam.workers.dev';
  const BRAND_TITLE = 'VSH TECH API SERVER KEY';
  const TZ = 'Asia/Ho_Chi_Minh';
  const ALWAYS_PROMPT = false;
  const LS = { DEVICE: 'vsh_license_device', KEY: 'vsh_license_key' };

  let deviceId = localStorage.getItem(LS.DEVICE);
  if (!deviceId) {
    const rand = Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
    deviceId = (crypto.randomUUID?.() || rand).toUpperCase();
    localStorage.setItem(LS.DEVICE, deviceId);
  }

  const summaryRefs = { status: null, expiry: null, device: null };

  const fmt = (ts) =>
    ts == null
      ? 'Không giới hạn'
      : new Intl.DateTimeFormat('vi-VN', {
          timeZone: TZ,
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }).format(ts);

  async function post(url, data) {
    const r = await fetch(API_BASE + url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return r.json().catch(() => ({ ok: false, error: 'PARSE_ERROR' }));
  }

  function ting() {
    try {
      const AC = new (window.AudioContext || window.webkitAudioContext)();
      const osc = AC.createOscillator();
      const gain = AC.createGain();
      const t = AC.currentTime;
      osc.type = 'sine';
      osc.frequency.value = 1180;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.18, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      osc.connect(gain).connect(AC.destination);
      osc.start(t);
      osc.stop(t + 0.2);
    } catch {}
  }

  const css = `
  #vgGate{position:fixed;inset:0;z-index:2147483647;display:grid;place-items:center;background:rgba(3,6,18,.82);backdrop-filter:blur(20px)}
  #vgGate .vg-panel{width:min(860px,95vw);max-height:min(720px,95vh);overflow-y:auto;border-radius:32px;padding:36px;background:linear-gradient(135deg,rgba(12,17,38,.95),rgba(26,33,72,.9));color:#f4f6ff;font-family:"Inter","SF Pro Display",system-ui,-apple-system,sans-serif;border:1px solid rgba(119,139,255,.25);box-shadow:0 45px 95px rgba(2,4,12,.9)}
  #vgGate .vg-hd{display:flex;align-items:flex-start;justify-content:space-between;gap:24px;margin-bottom:32px}
  #vgGate .vg-brand-block{display:flex;flex-direction:column;gap:6px}
  #vgGate .vg-tag{margin:0;font-size:0.75rem;letter-spacing:0.38em;color:#7dc8ff;text-transform:uppercase}
  #vgGate .vg-brand{margin:0;font-size:2rem;font-weight:800;letter-spacing:0.06em;color:#fff}
  #vgGate .vg-close{border:none;background:rgba(255,255,255,.08);color:#fff;border-radius:50%;width:46px;height:46px;display:grid;place-items:center;font-size:1.3rem;cursor:pointer;transition:.2s}
  #vgGate .vg-close:hover{background:rgba(255,255,255,.16)}
  #vgGate .vg-body{display:grid;grid-template-columns:1.15fr .85fr;gap:26px}
  #vgGate .vg-card{background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.08);border-radius:22px;padding:22px;box-shadow:0 22px 40px rgba(3,5,12,.6)}
  #vgGate .vg-label{font-size:0.75rem;color:#9fb6ff;margin-bottom:8px;letter-spacing:0.26em;text-transform:uppercase}
  #vgGate .vg-field{display:grid;grid-template-columns:1fr auto auto;gap:12px;align-items:center}
  #vgGate .vg-input{padding:14px;border-radius:16px;border:1px solid rgba(255,255,255,.18);background:rgba(5,8,22,.92);color:#fff;font-size:1.05rem;width:100%}
  #vgGate .vg-icon{display:inline-flex;align-items:center;gap:8px;padding:12px 14px;border-radius:14px;border:1px solid rgba(130,148,255,.45);background:rgba(9,14,32,.95);color:#e5eaff;cursor:pointer;transition:transform .2s,border-color .2s}
  #vgGate .vg-icon:hover{transform:translateY(-1px);border-color:rgba(152,170,255,.75)}
  #vgGate .vg-icon svg{width:17px;height:17px;display:block}
  #vgGate .vg-actions{display:flex;flex-wrap:wrap;gap:14px;margin-top:20px}
  #vgGate .vg-btn{border:none;border-radius:16px;padding:13px 22px;font-weight:650;letter-spacing:.18em;text-transform:uppercase;cursor:pointer;transition:.2s}
  #vgGate .vg-btn--pri{background:linear-gradient(120deg,#6286ff,#8ab6ff);color:#040611;box-shadow:0 16px 35px rgba(98,134,255,.45)}
  #vgGate .vg-btn--ghost{background:rgba(255,255,255,.05);color:#e9edff;border:1px solid rgba(255,255,255,.14)}
  #vgGate .vg-btn:hover{transform:translateY(-2px)}
  #vgGate .vg-summary{display:grid;gap:18px}
  #vgGate .vg-summary-block{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);border-radius:18px;padding:18px}
  #vgGate .vg-summary-block h4{margin:0 0 6px;font-size:0.78rem;letter-spacing:.3em;color:#7da4ff;text-transform:uppercase}
  #vgGate .vg-summary-block p{margin:0;color:#f5f7ff;font-size:1.05rem;font-weight:600}
  #vgGate .vg-msg{margin-top:24px;padding:14px 18px;border-radius:16px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.03);font-size:.95rem;color:#d7e2ff}
  #vgGate .vg-msg.ok{border-color:rgba(73,245,196,.4);background:rgba(73,245,196,.14);color:#d5ffef}
  #vgGate .vg-msg.warn{border-color:rgba(255,214,102,.4);background:rgba(255,214,102,.12);color:#fff2c0}
  #vgGate .vg-msg.err{border-color:rgba(255,115,115,.45);background:rgba(255,95,95,.12);color:#ffd7d7}
  body.vg-locked{overflow:hidden}
  body.vg-locked>*:not(#vgGate){filter:blur(4px);pointer-events:none !important;user-select:none !important}
  #vgGate details{margin-top:16px;border:1px dashed rgba(255,255,255,.14);border-radius:14px;overflow:hidden}
  #vgGate summary{padding:12px 18px;cursor:pointer;list-style:none;background:rgba(4,7,18,.92);color:#c1ceff;font-weight:600}
  #vgGate summary::-webkit-details-marker{display:none}
  #vgGate .vg-pre{margin:0;padding:14px 18px;background:rgba(2,4,12,.9);color:#d1dbff;max-height:220px;overflow:auto;font-family:"JetBrains Mono","SFMono-Regular",monospace;font-size:0.85rem}
  #vgGate .vg-foot{display:flex;justify-content:space-between;align-items:center;margin-top:16px;color:#b8c6ff;font-size:.85rem;letter-spacing:.18em;text-transform:uppercase}
  #vgGate .vg-foot strong{font-size:1rem;color:#fff}
  @media(max-width:720px){
    #vgGate .vg-body{grid-template-columns:1fr}
    #vgGate .vg-field{grid-template-columns:1fr}
    #vgGate .vg-panel{padding:28px}
  }`;

  const st = document.createElement('style');
  st.textContent = css;
  document.head.appendChild(st);

  function $(sel, root = document) {
    return root.querySelector(sel);
  }

  function build() {
    let wrap = $('#vgGate');
    if (wrap) return wrap;
    wrap = document.createElement('div');
    wrap.id = 'vgGate';
    wrap.innerHTML = `
      <div class="vg-panel">
        <div class="vg-hd">
          <div class="vg-brand-block">
            <p class="vg-tag">Secure Access</p>
            <h3 class="vg-brand">${BRAND_TITLE}</h3>
          </div>
          <button class="vg-close" id="vgReset" aria-label="Nhập lại key">&#8635;</button>
        </div>
        <div class="vg-body">
          <section class="vg-card">
            <div class="vg-label">Mã kích hoạt</div>
            <div class="vg-field">
              <input id="vgKey" class="vg-input" type="text" placeholder="VSHTECH-XXXX-XXXX-XXXX" autocomplete="one-time-code" inputmode="latin">
              <button class="vg-icon" id="vgPasteKey" title="Dán mã">
                <svg viewBox="0 0 24 24" fill="none"><path d="M8 4h8v4h4v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4h4Z" stroke="currentColor" stroke-width="1.6"/><path d="M9 2h6v3a1 1 0 0 1-1 1H10a1 1 0 0 1-1-1V2Z" stroke="currentColor" stroke-width="1.6"/></svg>
                <span>Dán</span>
              </button>
              <button class="vg-icon" id="vgDelKey" title="Xóa mã">
                <svg viewBox="0 0 24 24" fill="none"><path d="M4 7h16M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13" stroke="currentColor" stroke-width="1.6"/><path d="M10 11v7M14 11v7" stroke="currentColor" stroke-width="1.6"/></svg>
                <span>Xóa</span>
              </button>
            </div>

            <div style="margin-top:18px">
              <div class="vg-label">Mã thiết bị</div>
              <div class="vg-field">
                <input id="vgDev" class="vg-input" type="text" readonly>
                <button class="vg-icon" id="vgCopyDev" title="Sao chép mã thiết bị">
                  <svg viewBox="0 0 24 24" fill="none"><path d="M9 9h8a2 2 0 0 1 2 2v8a 2 2 0 0 1-2 2H9a 2 2 0 0 1-2-2v-8a 2 2 0 0 1 2-2Z" stroke="currentColor" stroke-width="1.6"/><path d="M7 15H6a 2 2 0 0 1-2-2V5a 2 2 0 0 1 2-2h8a 2 2 0 0 1 2 2v1" stroke="currentColor" stroke-width="1.6"/></svg>
                  <span>Sao chép</span>
                </button>
              </div>
            </div>

            <div class="vg-actions">
              <button class="vg-btn vg-btn--ghost" id="vgCheck">Kiểm tra</button>
              <button class="vg-btn vg-btn--pri" id="vgActive">Kích hoạt</button>
            </div>
          </section>

          <section class="vg-card vg-summary">
            <div class="vg-summary-block">
              <h4>Trạng thái</h4>
              <p id="vgState">Chưa kích hoạt</p>
            </div>
            <div class="vg-summary-block">
              <h4>Hạn sử dụng</h4>
              <p id="vgExpiry">--/--/--</p>
            </div>
            <div class="vg-summary-block">
              <h4>ID Thiết bị</h4>
              <p id="vgDevDisplay">${deviceId}</p>
            </div>
          </section>
        </div>

        <div class="vg-msg" id="vgMsg">Sẵn sàng kiểm tra key.</div>

        <details id="vgDtl" hidden>
          <summary>Chi tiết kỹ thuật</summary>
          <pre class="vg-pre" id="vgRaw"></pre>
        </details>

        <div class="vg-foot">
          <span>Lớp bảo vệ VSH TECH</span>
          <strong id="vgSta">Chưa kích hoạt</strong>
        </div>
      </div>`;

    document.body.appendChild(wrap);

    summaryRefs.status = $('#vgState');
    summaryRefs.expiry = $('#vgExpiry');
    summaryRefs.device = $('#vgDevDisplay');
    if (summaryRefs.device) summaryRefs.device.textContent = deviceId;

    const lastKey = localStorage.getItem(LS.KEY) || '';
    if (lastKey) $('#vgKey').value = lastKey;
    $('#vgDev').value = deviceId;
    $('#vgPasteKey').onclick = pasteIntoKey;
    $('#vgDelKey').onclick = deleteKeyLocal;
    $('#vgCopyDev').onclick = () =>
      copyToClipboard($('#vgDev').value.trim(), 'Đã sao chép Mã Thiết Bị.');
    $('#vgReset').onclick = () => {
      localStorage.removeItem(LS.KEY);
      updateStatus(null);
      show();
    };
    $('#vgCheck').onclick = onCheck;
    $('#vgActive').onclick = onActivate;
    return wrap;
  }

  function setMsg(type, html, raw) {
    const box = document.querySelector('#vgMsg');
    box.className = 'vg-msg ' + (type || '');
    box.innerHTML = html;
    ting();
    const dtl = document.querySelector('#vgDtl');
    const pre = document.querySelector('#vgRaw');
    if (raw) {
      dtl.hidden = false;
      pre.textContent = typeof raw === 'string' ? raw : JSON.stringify(raw, null, 2);
    } else {
      dtl.hidden = true;
      pre.textContent = '';
    }
  }

  function updateStatus(data) {
    const el = document.querySelector('#vgSta');
    if (!el) return;
    if (!data) {
      el.textContent = 'Chưa kích hoạt';
      if (summaryRefs.status) summaryRefs.status.textContent = 'Chưa kích hoạt';
      if (summaryRefs.expiry) summaryRefs.expiry.textContent = '--/--/--';
      return;
    }
    el.textContent = `Hết hạn: ${fmt(data.expiresAt)}`;
    if (summaryRefs.status) summaryRefs.status.textContent = 'Đã kích hoạt';
    if (summaryRefs.expiry) summaryRefs.expiry.textContent = fmt(data.expiresAt);
  }

  function copyToClipboard(text, okText) {
    navigator.clipboard?.writeText(text).then(() => setMsg('ok', okText));
  }

  async function pasteIntoKey() {
    const inp = document.querySelector('#vgKey');
    try {
      const txt = await navigator.clipboard.readText();
      inp.value = (txt || '').trim();
      setMsg('ok', 'Đã dán vào ô Mã Kích Hoạt.');
    } catch {
      const txt = prompt('Dán mã kích hoạt tại đây:', '') || '';
      inp.value = txt.trim();
      setMsg('ok', 'Đã dán vào ô Mã Kích Hoạt.');
    }
    inp.focus();
  }

  function deleteKeyLocal() {
    const inp = document.querySelector('#vgKey');
    inp.value = '';
    localStorage.removeItem(LS.KEY);
    updateStatus(null);
    setMsg('ok', 'Đã xoá mã khỏi thiết bị này.');
  }

  async function onCheck() {
    const key = document.querySelector("#vgKey").value.trim();
    if (!key) return setMsg("warn", "Vui long nhap Ma Kich Hoat.");
    setMsg("", "Dang kiem tra...");
    const j = await post("/api/verify", { key, deviceId });
    if (j.ok) {
      const d = j.data || {};
      const boundDev = d.deviceId || d.device || null;
      if (boundDev && boundDev !== deviceId) {
        setMsg("err", "Ma da gan voi thiet bi khac.", j);
        return;
      }
      localStorage.setItem(LS.KEY, key);
      updateStatus(d);
      setMsg("ok", `Ma hop le<br>Het han: <b>${fmt(d.expiresAt)}</b>`, j);
    } else {
      const map = {
        EXPIRED: "Mã đã hết hạn.",
        REVOKED: "Mã đã bị thu hồi.",
        NOT_FOUND: "Không tìm thấy mã.",
        BOUND_TO_ANOTHER_DEVICE: "Mã đã gắn với thiết bị khác.",
      };
      setMsg("err", map[(j.error || "").toUpperCase()] || "Loi khong xac dinh", j);
    }
  }
async function onActivate() {
    const key = document.querySelector('#vgKey').value.trim();
    if (!key) return setMsg('warn', 'Vui lòng nhập Mã Kích Hoạt.');
    setMsg('', 'Đang kích hoạt…');
    const j = await post('/api/activate', { key, deviceId });
    if (j.ok) {
      localStorage.setItem(LS.KEY, key);
      const d = j.data;
      updateStatus(d);
      setMsg('ok', `✅ Kích hoạt thành công<br>Hết hạn: <b>${fmt(d.expiresAt)}</b>`, j);
      setTimeout(() => hide(), 1200);
      window.dispatchEvent(
        new CustomEvent('vsh-license-change', { detail: { state: 'activated', data: d } }),
      );
    } else {
      const why = (j.error || '').toUpperCase();
            const map = {
        BOUND_TO_ANOTHER_DEVICE: 'Mã đã gắn với thiết bị khác.',
        EXPIRED: 'Mã đã hết hạn.',
        REVOKED: 'Mã đã bị thu hồi.',
        NOT_FOUND: 'Không tìm thấy mã.',
      };
      setMsg('err', map[why] || '❌ Lỗi kích hoạt', j);
      window.dispatchEvent(
        new CustomEvent('vsh-license-change', { detail: { state: 'invalid', data: j } }),
      );
    }
  }

  function show() {
    build();
    document.body.classList.add('vg-locked');
    document.getElementById('vgGate').style.display = 'grid';
  }

  function hide() {
    const g = document.getElementById('vgGate');
    if (g) g.style.display = 'none';
    document.body.classList.remove('vg-locked');
  }

  async function guardOnLoad() {
    if (ALWAYS_PROMPT) {
      show();
      return;
    }
    const savedKey = localStorage.getItem(LS.KEY);
    if (!savedKey) {
      show();
      return;
    }
    const v = await post('/api/verify', { key: savedKey, deviceId });
    if (!v.ok) {
      show();
      return;
    }
    if (!v.data.deviceId || v.data.deviceId !== deviceId) {
      show();
      return;
    }
    updateStatus(v.data);
    document.addEventListener(
      'visibilitychange',
      () => {
        if (document.visibilityState === 'visible') guardOnLoad();
      },
      { once: true },
    );
    setTimeout(() => guardOnLoad(), 10 * 60 * 1000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', guardOnLoad);
  } else {
    guardOnLoad();
  }

  window.VSHKeyGate = {
    show,
    hide,
    reset() {
      localStorage.removeItem(LS.KEY);
      show();
    },
  };
})();


