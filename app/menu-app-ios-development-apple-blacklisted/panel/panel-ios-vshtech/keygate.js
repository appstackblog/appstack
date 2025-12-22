(() => {
  const DEVICE_KEY = "vsh_license_device";
  const LICENSE_KEY = "vsh_license_key";

  // Lấy/generate deviceId và lưu vào localStorage
  let deviceId = localStorage.getItem(DEVICE_KEY);
  if (!deviceId) {
    const fallbackId = Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
    deviceId = (crypto.randomUUID?.() || fallbackId).toUpperCase();
    localStorage.setItem(DEVICE_KEY, deviceId);
  }

  const refs = { status: null, expiry: null, device: null };

  const formatDate = (ts) =>
    ts == null
      ? "Không giới hạn"
      : new Intl.DateTimeFormat("vi-VN", {
          timeZone: "Asia/Ho_Chi_Minh",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }).format(ts);

  async function api(path, payload) {
    try {
      const res = await fetch(`https://botkey.vshtechteam.workers.dev${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      return await res.json();
    } catch {
      return { ok: false, error: "PARSE_ERROR" };
    }
  }

  // Validate dữ liệu: thu hồi/hết hạn coi như không hợp lệ
  function validateData(data) {
    if (!data) return { ok: false, code: "INVALID" };
    const status = (data.status || "").toUpperCase();
    if (data.revoked || status === "REVOKED") return { ok: false, code: "REVOKED" };
    if (data.expiresAt && Date.now() > data.expiresAt) return { ok: false, code: "EXPIRED" };
    return { ok: true };
  }

  const style = document.createElement("style");
  style.textContent = `
  #vgGate{position:fixed;inset:0;width:100vw;height:100vh;z-index:2147483647;display:grid;place-items:center;background:rgba(3,6,18,.82);backdrop-filter:blur(20px);touch-action:none;overscroll-behavior:none}
  #vgGate .vg-panel{width:min(860px,95vw);max-height:min(720px,95vh);overflow-y:auto;border-radius:32px;padding:36px;
    background:linear-gradient(135deg,rgba(12,17,38,.95),rgba(26,33,72,.9));color:#f4f6ff;
    font-family:"Inter","SF Pro Display",system-ui,-apple-system,sans-serif;border:1px solid rgba(119,139,255,.25);
    box-shadow:0 45px 95px rgba(2,4,12,.9)}
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
  #vgGate .vg-icon{display:inline-flex;align-items:center;gap:8px;padding:12px 14px;border-radius:14px;border:1px solid rgba(130,148,255,.45);
    background:rgba(9,14,32,.95);color:#e5eaff;cursor:pointer;transition:transform .2s,border-color .2s}
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
  document.head.appendChild(style);

  const $ = (sel, root = document) => root.querySelector(sel);

  function buildUI() {
    let wrap = $("#vgGate");
    if (wrap) return wrap;

    wrap = document.createElement("div");
    wrap.id = "vgGate";
    wrap.innerHTML = `
      <div class="vg-panel">
        <div class="vg-hd">
          <div class="vg-brand-block">
            <p class="vg-tag">Secure Access</p>
            <h3 class="vg-brand">VSH TECH API SERVER KEY</h3>
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

    refs.status = $("#vgState");
    refs.expiry = $("#vgExpiry");
    refs.device = $("#vgDevDisplay");
    if (refs.device) refs.device.textContent = deviceId;

    const storedKey = localStorage.getItem(LICENSE_KEY) || "";
    if (storedKey) $("#vgKey").value = storedKey;
    $("#vgDev").value = deviceId;

    $("#vgPasteKey").onclick = pasteKey;
    $("#vgDelKey").onclick = clearKey;
    $("#vgCopyDev").onclick = () => {
      const text = $("#vgDev").value.trim();
      navigator.clipboard?.writeText(text).then(() => showMsg("ok", "Đã sao chép Mã Thiết Bị."));
    };
    $("#vgReset").onclick = () => {
      localStorage.removeItem(LICENSE_KEY);
      setState(null);
      openGate();
    };
    $("#vgCheck").onclick = verifyKey;
    $("#vgActive").onclick = activateKey;

    return wrap;
  }

  function showMsg(type, msg, detail) {
    const el = $("#vgMsg");
    el.className = "vg-msg " + (type || "");
    el.innerHTML = msg;

    // beep feedback
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const now = ctx.currentTime;
      osc.type = "sine";
      osc.frequency.value = 1180;
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.18, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.2);
    } catch {}

    const dtl = $("#vgDtl");
    const raw = $("#vgRaw");
    if (detail) {
      dtl.hidden = false;
      raw.textContent = typeof detail === "string" ? detail : JSON.stringify(detail, null, 2);
    } else {
      dtl.hidden = true;
      raw.textContent = "";
    }
  }

  function setState(data) {
    const sta = $("#vgSta");
    if (!sta) return;
    if (!data) {
      sta.textContent = "Chưa kích hoạt";
      if (refs.status) refs.status.textContent = "Chưa kích hoạt";
      if (refs.expiry) refs.expiry.textContent = "--/--/--";
      return;
    }
    sta.textContent = `Hết hạn: ${formatDate(data.expiresAt)}`;
    refs.status && (refs.status.textContent = "Đã kích hoạt");
    refs.expiry && (refs.expiry.textContent = formatDate(data.expiresAt));
  }

  async function pasteKey() {
    const input = $("#vgKey");
    try {
      const txt = await navigator.clipboard.readText();
      input.value = (txt || "").trim();
      showMsg("ok", "Đã dán vào ô Mã Kích Hoạt.");
    } catch {
      const txt = prompt("Dán mã kích hoạt tại đây:", "") || "";
      input.value = txt.trim();
      showMsg("ok", "Đã dán vào ô Mã Kích Hoạt.");
    }
    input.focus();
  }

  function clearKey() {
    $("#vgKey").value = "";
    localStorage.removeItem(LICENSE_KEY);
    setState(null);
    showMsg("ok", "Đã xóa mã khỏi thiết bị này.");
  }

  async function verifyKey() {
    const key = $("#vgKey").value.trim();
    if (!key) return showMsg("warn", "Vui lòng nhập Mã Kích Hoạt.");
    showMsg("", "Đang kiểm tra...");
    const res = await api("/api/verify", { key, deviceId });
    if (res.ok) {
      const data = res.data || {};
      const boundDevice = data.deviceId || data.device || null;
      if (boundDevice && boundDevice !== deviceId) {
        return showMsg("err", "Mã đã gán với thiết bị khác.", res);
      }
      const validity = validateData(data);
      if (!validity.ok) {
        const msg =
          {
            EXPIRED: "Mã đã hết hạn.",
            REVOKED: "Mã đã bị thu hồi.",
          }[validity.code] || "Mã không hợp lệ.";
        return showMsg("err", msg, res);
      }
      localStorage.setItem(LICENSE_KEY, key);
      setState(data);
      showMsg("ok", `Mã hợp lệ<br>Hết hạn: <b>${formatDate(data.expiresAt)}</b>`, res);
    } else {
      const msg =
        {
          EXPIRED: "Mã đã hết hạn.",
          REVOKED: "Mã đã bị thu hồi.",
          NOT_FOUND: "Không tìm thấy mã.",
          BOUND_TO_ANOTHER_DEVICE: "Mã đã gán với thiết bị khác.",
        }[(res.error || "").toUpperCase()] || "Lỗi không xác định";
      showMsg("err", msg, res);
    }
  }

  async function activateKey() {
    const key = $("#vgKey").value.trim();
    if (!key) return showMsg("warn", "Vui lòng nhập Mã Kích Hoạt.");
    showMsg("", "Đang kích hoạt…");
    const res = await api("/api/activate", { key, deviceId });
    if (res.ok) {
      const validity = validateData(res.data);
      if (!validity.ok) {
        const msg =
          {
            EXPIRED: "Mã đã hết hạn.",
            REVOKED: "Mã đã bị thu hồi.",
          }[validity.code] || "Mã không hợp lệ.";
        return showMsg("err", msg, res);
      }
      localStorage.setItem(LICENSE_KEY, key);
      const data = res.data;
      setState(data);
      showMsg("ok", `Kích hoạt thành công<br>Hết hạn: <b>${formatDate(data.expiresAt)}</b>`, res);
      setTimeout(() => closeGate(), 1200);
      window.dispatchEvent(new CustomEvent("vsh-license-change", { detail: { state: "activated", data } }));
    } else {
      const msg =
        {
          BOUND_TO_ANOTHER_DEVICE: "Mã đã gán với thiết bị khác.",
          EXPIRED: "Mã đã hết hạn.",
          REVOKED: "Mã đã bị thu hồi.",
          NOT_FOUND: "Không tìm thấy mã.",
        }[(res.error || "").toUpperCase()] || "Đã có lỗi kích hoạt";
      showMsg("err", msg, res);
      window.dispatchEvent(new CustomEvent("vsh-license-change", { detail: { state: "invalid", data: res } }));
    }
  }

  function openGate() {
    buildUI();
    document.body.classList.add("vg-locked");
    document.getElementById("vgGate").style.display = "grid";
  }

  function closeGate() {
    const el = document.getElementById("vgGate");
    if (el) el.style.display = "none";
    document.body.classList.remove("vg-locked");
  }

  async function bootstrap() {
    const storedKey = localStorage.getItem(LICENSE_KEY);
    if (!storedKey) return openGate();
    const res = await api("/api/verify", { key: storedKey, deviceId });
    if (res.ok && res.data.deviceId && res.data.deviceId === deviceId) {
      const validity = validateData(res.data);
      if (!validity.ok) return openGate();
      setState(res.data);
      document.addEventListener(
        "visibilitychange",
        () => {
          if (document.visibilityState === "visible") bootstrap();
        },
        { once: true }
      );
      setTimeout(() => bootstrap(), 600000);
    } else {
      openGate();
    }
  }

  buildUI();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootstrap);
  } else {
    bootstrap();
  }

  // Expose helpers
  window.VSHKeyGate = {
    show: openGate,
    hide: closeGate,
    reset() {
      localStorage.removeItem(LICENSE_KEY);
      openGate();
    },
  };
})();
