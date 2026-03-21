(() => {
  const APP = {
    tier: "free",
    label: "FREE",
    storageKey: "flametech_free_license_key",
    badge: "Free Access",
    title: "FREE License Gateway",
    description: "Xác thực key FREE để tiếp tục sử dụng phiên bản tiêu chuẩn của FLAME TECH.",
    helper: "Key FREE chỉ dùng cho ứng dụng FREE và chỉ hoạt động trên đúng thiết bị đã liên kết."
  };
  const API_BASE = "https://flametech.hdangchinhchu.workers.dev/".replace(/\/+$/, "");
  const DEVICE_KEY = "vsh_license_device_id";
  const DEVICE_SERIAL_KEY = "vsh_device_serial";
  const DEVICE_IMEI_KEY = "vsh_device_imei";
  const LICENSE_KEY = APP.storageKey;
  const ALLOWED_PAGE = "settings";
  const UUID_ANY = /^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/;
  const IOS_UDID = /^[0-9A-F]{40}$/;
  const IOS_FINDER = /^[0-9A-F]{8}-[0-9A-F]{16}$/;
  const HEX_16 = /^[0-9A-F]{16}$/;
  const HEX_32 = /^[0-9A-F]{32}$/;

  const refs = { gate: null, state: null, expiry: null, device: null };
  let deviceId = normDevId(localStorage.getItem(DEVICE_KEY) || "");
  let unlocked = false;
  let pendingPage = null;
  let initialPage = "home";
  let originalSwitchPage = null;
  let originalOpenPopup = null;
  let gateTimer = 0;
  let toastTimer = 0;

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (match) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[match]);
  }

  function normDevId(value) {
    return String(value || "").trim().toUpperCase();
  }

  function isDevId(value) {
    const normalized = normDevId(value);
    return UUID_ANY.test(normalized) || IOS_UDID.test(normalized) || IOS_FINDER.test(normalized) || HEX_16.test(normalized) || HEX_32.test(normalized);
  }

  function formatDate(ts) {
    if (ts == null) return "Không giới hạn";
    return new Intl.DateTimeFormat("vi-VN", {
      timeZone: "Asia/Ho_Chi_Minh",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    }).format(ts);
  }

  function tierLabel(value) {
    return ({ vip: "VIP", free: "FREE" })[String(value || "").toLowerCase()] || APP.label;
  }

  function statusLabel(data) {
    return ({
      ACTIVE: "Đã kích hoạt",
      READY: "Sẵn sàng",
      EXPIRED: "Đã hết hạn",
      REVOKED: "Đã thu hồi"
    })[String(data?.status || "").toUpperCase()] || "Chưa kích hoạt";
  }

  async function api(path, payload, timeoutMs = 12000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(`${API_BASE}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      const data = await response.json().catch(() => null);
      return data || { ok: false, error: "PARSE_ERROR" };
    } catch (error) {
      return { ok: false, error: error?.name === "AbortError" ? "TIMEOUT" : "NETWORK_ERROR" };
    } finally {
      clearTimeout(timer);
    }
  }

  function ensureStyle() {
    if ($("#vgGateStyle")) return;
    const style = document.createElement("style");
    style.id = "vgGateStyle";
    style.textContent = `
      #vgGate{
        --line:rgba(255,255,255,.08);
        --line-strong:rgba(255,255,255,.14);
        --text:#f5f6fb;
        --muted:#929ab4;
        --red:#e8001e;
        --red-2:#ff4455;
        --red-3:#ff7083;
        position:fixed;
        inset:0;
        z-index:2147483647;
        display:none;
        padding:0;
        overflow-y:auto;
        overflow-x:hidden;
        overscroll-behavior:contain;
        scrollbar-width:none;
        -ms-overflow-style:none;
        color:var(--text);
        font-family:"Trebuchet MS","Segoe UI",sans-serif;
        background:
          radial-gradient(circle at 12% 10%, rgba(255,61,85,.18), transparent 28%),
          radial-gradient(circle at 88% 82%, rgba(232,0,30,.16), transparent 26%),
          linear-gradient(180deg, rgba(6,6,8,.96), rgba(10,10,16,.94) 46%, rgba(8,8,12,.97));
        backdrop-filter:blur(18px);
        -webkit-backdrop-filter:blur(18px);
      }
      #vgGate::-webkit-scrollbar{width:0;height:0}
      #vgGate *{box-sizing:border-box}
      #vgGate .vg-shell{
        position:relative;
        width:min(100%, 1180px);
        min-height:100dvh;
        margin:0 auto;
        padding:
          calc(24px + env(safe-area-inset-top))
          calc(18px + env(safe-area-inset-right))
          calc(28px + env(safe-area-inset-bottom))
          calc(18px + env(safe-area-inset-left));
        overflow:visible;
      }
      #vgGate .vg-shell::before{
        display:none;
      }
      #vgGate .vg-shell::after{
        content:"";
        position:absolute;
        right:clamp(-60px, -4vw, -24px);
        top:120px;
        width:320px;
        height:320px;
        border-radius:50%;
        background:radial-gradient(circle, rgba(255,61,85,.14), transparent 72%);
        pointer-events:none;
        z-index:0;
      }
      #vgGate .vg-header,
      #vgGate .vg-stats,
      #vgGate .vg-actions,
      #vgGate .vg-card,
      #vgGate .vg-msg,
      #vgGate details{position:relative;z-index:1}
      #vgGate .vg-header{
        display:grid;
        grid-template-columns:minmax(0,1fr) auto;
        gap:18px;
        align-items:start;
        margin-bottom:18px;
        padding:clamp(22px, 3vw, 32px);
        border-radius:34px;
        border:1px solid var(--line);
        background:linear-gradient(180deg, rgba(255,255,255,.055), rgba(255,255,255,.018)), rgba(15,15,22,.82);
        box-shadow:0 30px 72px rgba(0,0,0,.42)
      }
      #vgGate .vg-badge{
        display:inline-flex;align-items:center;min-height:34px;padding:0 14px;border-radius:999px;
        border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.04);color:var(--red-3);
        font:700 11px/1 "Courier New",monospace;letter-spacing:1.8px;text-transform:uppercase
      }
      #vgGate .vg-brand{margin-top:18px;font:700 clamp(34px, 6vw, 66px)/.92 "Courier New",monospace;letter-spacing:clamp(3px, .6vw, 8px);text-transform:uppercase}
      #vgGate .vg-title{margin-top:16px;max-width:36rem;font-size:clamp(1.06rem, 1.6vw, 1.34rem);font-weight:700}
      #vgGate .vg-desc{margin:12px 0 0;max-width:42rem;color:var(--muted);font-size:.98rem;line-height:1.7}
      #vgGate .vg-close{
        flex-shrink:0;width:48px;height:48px;border:none;border-radius:18px;border:1px solid var(--line);
        background:rgba(255,255,255,.04);color:var(--text);cursor:pointer;transition:.22s;font-size:1.25rem
      }
      #vgGate .vg-close:hover,
      #vgGate .vg-tool:hover,
      #vgGate .vg-btn--ghost:hover{transform:translateY(-2px);border-color:var(--line-strong);background:rgba(255,255,255,.07)}
      #vgGate .vg-stats{display:grid;grid-template-columns:repeat(3, minmax(0,1fr));gap:14px;margin-bottom:18px}
      #vgGate .vg-stat{padding:18px 20px;border-radius:24px;border:1px solid var(--line);background:rgba(255,255,255,.035);box-shadow:inset 0 1px 0 rgba(255,255,255,.04)}
      #vgGate .vg-stat span{display:block;color:var(--muted);font:700 10px/1 "Courier New",monospace;letter-spacing:1.8px;text-transform:uppercase}
      #vgGate .vg-stat strong{display:block;margin-top:12px;font-size:1rem;font-weight:700;word-break:break-word}
      #vgGate .vg-card{
        display:grid;grid-template-columns:repeat(12, minmax(0,1fr));gap:20px 16px;
        padding:clamp(20px, 3vw, 28px);border-radius:32px;border:1px solid var(--line);
        background:linear-gradient(180deg, rgba(255,255,255,.04), rgba(255,255,255,.015)), rgba(18,18,26,.92);
        box-shadow:0 28px 70px rgba(0,0,0,.38)
      }
      #vgGate .vg-eyebrow{grid-column:1 / -1;color:var(--red-3);font:700 11px/1 "Courier New",monospace;letter-spacing:2.1px;text-transform:uppercase}
      #vgGate .vg-field{grid-column:span 6}
      #vgGate .vg-label{margin-bottom:10px;color:var(--muted);font:700 11px/1 "Courier New",monospace;letter-spacing:1.8px;text-transform:uppercase}
      #vgGate .vg-row{display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:10px;align-items:center}
      #vgGate .vg-input{
        width:100%;min-width:0;min-height:56px;padding:14px 16px;border-radius:18px;border:1px solid var(--line);
        background:rgba(8,8,12,.68);color:var(--text);outline:none;font-size:16px;transition:.22s
      }
      #vgGate .vg-input:focus{
        border-color:rgba(255,112,131,.65);
        box-shadow:0 0 0 3px rgba(232,0,30,.14), 0 0 24px rgba(232,0,30,.18);
        background:rgba(10,10,15,.78)
      }
      #vgGate .vg-tool{
        min-height:56px;padding:0 18px;border-radius:16px;border:1px solid var(--line);
        background:rgba(255,255,255,.04);color:var(--text);cursor:pointer;transition:.22s
      }
      #vgGate .vg-device{display:flex;flex-wrap:wrap;justify-content:space-between;gap:10px;margin-top:14px;padding:14px 16px;border-radius:20px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.03);color:var(--muted);font-size:.92rem;line-height:1.5}
      #vgGate .vg-device strong{color:var(--text)}
      #vgGate .vg-helper{margin-top:14px;color:var(--muted);font-size:.93rem;line-height:1.7}
      #vgGate .vg-actions{grid-column:1 / -1;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:0}
      #vgGate .vg-btn{
        min-height:54px;padding:0 22px;border-radius:18px;border:none;cursor:pointer;
        font:700 11px/1 "Courier New",monospace;letter-spacing:1.9px;text-transform:uppercase;transition:.22s
      }
      #vgGate .vg-btn:hover{transform:translateY(-2px)}
      #vgGate .vg-btn--ghost{color:var(--text);background:rgba(255,255,255,.05);border:1px solid var(--line)}
      #vgGate .vg-btn--pri{
        color:#fff7fa;background:linear-gradient(135deg, var(--red), var(--red-2));
        box-shadow:0 18px 34px rgba(232,0,30,.3), 0 0 24px rgba(255,68,85,.18)
      }
      #vgGate .vg-msg{margin-top:18px;padding:16px 18px;border-radius:22px;border:1px solid var(--line);background:rgba(255,255,255,.04);font-size:.95rem;line-height:1.7}
      #vgGate .vg-msg.ok{border-color:rgba(69,255,160,.32);background:rgba(35,125,84,.18);color:#e8fff1}
      #vgGate .vg-msg.warn{border-color:rgba(255,190,92,.28);background:rgba(110,74,20,.18);color:#fff2d9}
      #vgGate .vg-msg.err{border-color:rgba(255,97,97,.3);background:rgba(116,31,40,.2);color:#ffe2e5}
      #vgGate details{margin-top:16px;border-radius:22px;border:1px dashed rgba(255,255,255,.14);background:rgba(8,8,12,.5);overflow:hidden}
      #vgGate summary{padding:14px 18px;cursor:pointer;list-style:none;background:rgba(8,8,12,.62);color:var(--muted);font:700 11px/1 "Courier New",monospace;letter-spacing:1.7px;text-transform:uppercase}
      #vgGate summary::-webkit-details-marker{display:none}
      #vgGate .vg-pre{margin:0;padding:0 18px 18px;max-height:none;overflow:visible;background:transparent;color:#d9dfef;font:12px/1.72 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;white-space:pre-wrap;word-break:break-word}
      body.vg-locked{overflow:hidden}
      body.vg-locked > *:not(#vgGate){filter:blur(4px) saturate(.86);pointer-events:none !important;user-select:none !important}
      .ft-tab-locked{position:relative;opacity:.55}
      .ft-tab-locked::after{
        content:"LOCK";position:absolute;top:6px;right:6px;padding:2px 6px;border-radius:999px;
        background:rgba(232,0,30,.16);border:1px solid rgba(255,68,85,.22);color:#ffb6c0;
        font:700 8px/1 "Courier New",monospace;letter-spacing:1px
      }
      .ft-action-locked{opacity:.55;filter:saturate(.65)}
      #page-settings .ft-setup-lock-note{
        margin:0 0 16px;padding:14px 16px;border-radius:18px;border:1px solid rgba(255,190,92,.24);
        background:rgba(110,74,20,.18);color:#fff2d9;line-height:1.6
      }
      #page-settings .ft-setup-disabled{opacity:.5;filter:saturate(.65)}
      #ftAccessToast{
        position:fixed;left:50%;bottom:calc(18px + env(safe-area-inset-bottom));transform:translateX(-50%);
        z-index:2147483646;min-width:min(92vw, 320px);max-width:min(92vw, 420px);padding:14px 16px;border-radius:18px;
        border:1px solid rgba(255,190,92,.24);background:rgba(22,18,16,.92);color:#fff2d9;
        box-shadow:0 18px 38px rgba(0,0,0,.32);opacity:0;pointer-events:none;transition:.22s;font-size:.92rem;line-height:1.6
      }
      #ftAccessToast.show{opacity:1}
      @media (max-width:960px){
        #vgGate .vg-card{grid-template-columns:1fr}
        #vgGate .vg-field{grid-column:1 / -1}
      }
      @media (max-width:640px){
        #vgGate .vg-shell{
          width:100%;
          padding:
            calc(16px + env(safe-area-inset-top))
            calc(14px + env(safe-area-inset-right))
            calc(18px + env(safe-area-inset-bottom))
            calc(14px + env(safe-area-inset-left))
        }
        #vgGate .vg-header{
          grid-template-columns:minmax(0,1fr) auto;
          gap:14px;
          padding:20px 18px;
          border-radius:28px
        }
        #vgGate .vg-brand{margin-top:14px;font-size:clamp(28px, 10vw, 42px);letter-spacing:3px}
        #vgGate .vg-title{font-size:1rem}
        #vgGate .vg-desc{font-size:.92rem;line-height:1.62}
        #vgGate .vg-stats{grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
        #vgGate .vg-stat{padding:14px 12px}
        #vgGate .vg-stat span{font-size:9px;letter-spacing:1.2px}
        #vgGate .vg-stat strong{margin-top:10px;font-size:.86rem}
        #vgGate .vg-card{padding:18px;border-radius:28px;gap:16px}
        #vgGate .vg-row{grid-template-columns:minmax(0,1fr) auto auto;gap:8px}
        #vgGate .vg-tool{min-height:48px;padding:0 14px}
        #vgGate .vg-btn{width:100%;min-height:50px}
        #vgGate .vg-actions{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
        #vgGate .vg-device{font-size:.88rem}
        #vgGate details{border-radius:18px}
      }
    `;
    document.head.appendChild(style);
  }

  function buildUI() {
    ensureStyle();
    let gate = $("#vgGate");
    if (gate) return gate;
    gate = document.createElement("div");
    gate.id = "vgGate";
    gate.innerHTML = `
      <div class="vg-shell">
        <div class="vg-header">
          <div>
            <div class="vg-badge">${APP.badge}</div>
            <div class="vg-brand">FLAME TECH</div>
            <div class="vg-title">${APP.title}</div>
            <p class="vg-desc">${APP.description}</p>
          </div>
          <button class="vg-close" id="vgClose" type="button" title="Đóng giao diện">&times;</button>
        </div>
        <div class="vg-stats">
          <div class="vg-stat"><span>Ứng dụng</span><strong>${APP.label}</strong></div>
          <div class="vg-stat"><span>Trạng thái</span><strong id="vgState">Chưa kích hoạt</strong></div>
          <div class="vg-stat"><span>Hạn sử dụng</span><strong id="vgExpiry">--/--/--</strong></div>
        </div>
        <section class="vg-card">
          <div class="vg-eyebrow">Xác thực bản quyền</div>
          <div class="vg-field">
            <div class="vg-label">Key bản quyền</div>
            <div class="vg-row">
              <input id="vgKey" class="vg-input" type="text" placeholder="Nhập key ${APP.label}" autocomplete="one-time-code" inputmode="latin" spellcheck="false">
              <button class="vg-tool" id="vgPasteKey" type="button">Dán</button>
              <button class="vg-tool" id="vgDelKey" type="button">Xóa</button>
            </div>
          </div>
          <div class="vg-field">
            <div class="vg-label">Device ID / UUID</div>
            <div class="vg-row">
              <input id="vgDev" class="vg-input" type="text" placeholder="Nhập Device ID hiện tại" autocomplete="off" inputmode="latin" spellcheck="false">
              <button class="vg-tool" id="vgPasteDev" type="button">Dán</button>
              <button class="vg-tool" id="vgClearDev" type="button">Xóa</button>
            </div>
            <div class="vg-device"><div>Thiết bị hiện tại: <strong id="vgDevDisplay">--</strong></div></div>
            <div class="vg-helper">${APP.helper}</div>
          </div>
          <div class="vg-actions">
            <button class="vg-btn vg-btn--ghost" id="vgCheck" type="button">Kiểm tra</button>
            <button class="vg-btn vg-btn--pri" id="vgActive" type="button">Kích hoạt</button>
          </div>
        </section>
        <div class="vg-msg" id="vgMsg">Kích hoạt key để mở khóa đầy đủ ứng dụng.</div>
        <details id="vgDtl" hidden>
          <summary>Chi tiết phản hồi</summary>
          <pre class="vg-pre" id="vgRaw"></pre>
        </details>
      </div>
    `;
    document.body.appendChild(gate);

    refs.gate = gate;
    refs.state = $("#vgState");
    refs.expiry = $("#vgExpiry");
    refs.device = $("#vgDevDisplay");

    const storedKey = localStorage.getItem(LICENSE_KEY) || "";
    if (storedKey) $("#vgKey").value = storedKey;
    $("#vgDev").value = deviceId;
    refs.device.textContent = deviceId || "--";

    $("#vgClose").onclick = () => closeGate(true);
    $("#vgPasteKey").onclick = pasteKey;
    $("#vgDelKey").onclick = clearKey;
    $("#vgPasteDev").onclick = pasteDeviceId;
    $("#vgClearDev").onclick = clearDeviceId;
    $("#vgCheck").onclick = verifyKey;
    $("#vgActive").onclick = () => activateKey();
    $("#vgKey").addEventListener("keydown", (event) => { if (event.key === "Enter") { event.preventDefault(); activateKey(); } });
    $("#vgDev").addEventListener("keydown", (event) => { if (event.key === "Enter") { event.preventDefault(); activateKey(); } });
    $("#vgDev").addEventListener("input", () => onDevChange());
    setState(null);
    return gate;
  }

  function showMsg(type, message, detail) {
    const el = $("#vgMsg");
    if (!el) return;
    el.className = `vg-msg${type ? ` ${type}` : ""}`;
    el.innerHTML = message;
    const detailWrap = $("#vgDtl");
    const raw = $("#vgRaw");
    if (!detailWrap || !raw) return;
    if (detail) {
      detailWrap.hidden = false;
      raw.textContent = typeof detail === "string" ? detail : JSON.stringify(detail, null, 2);
    } else {
      detailWrap.hidden = true;
      raw.textContent = "";
    }
  }

  function setState(data) {
    if (refs.state) refs.state.textContent = statusLabel(data);
    if (refs.expiry) refs.expiry.textContent = data ? formatDate(data.expiresAt) : "--/--/--";
    if (refs.device) refs.device.textContent = deviceId || data?.deviceId || "--";
  }

  function setDeviceId(value, silent = false) {
    deviceId = normDevId(value);
    const input = $("#vgDev");
    if (input) input.value = deviceId;
    if (deviceId) localStorage.setItem(DEVICE_KEY, deviceId);
    else localStorage.removeItem(DEVICE_KEY);
    if (refs.device) refs.device.textContent = deviceId || "--";
    if (!silent && deviceId && !isDevId(deviceId)) {
      showMsg("warn", "Device ID chưa hợp lệ. Hệ thống hỗ trợ UUID, UDID iOS, Android ID hoặc machine ID.");
    }
  }

  function onDevChange(silent = false) {
    setDeviceId($("#vgDev")?.value || "", true);
    if (!silent && deviceId && !isDevId(deviceId)) {
      showMsg("warn", "Device ID chưa hợp lệ. Vui lòng kiểm tra lại định dạng trước khi xác thực.");
    }
  }

  async function pasteKey() {
    const input = $("#vgKey");
    if (!input) return;
    try {
      input.value = (await navigator.clipboard.readText() || "").trim();
    } catch {
      input.value = (prompt("Dán key tại đây:", "") || "").trim();
    }
    input.focus();
    showMsg(input.value ? "ok" : "warn", input.value ? "Đã dán key vào biểu mẫu." : "Chưa có key để dán.");
  }

  async function pasteDeviceId() {
    const input = $("#vgDev");
    if (!input) return;
    try {
      input.value = (await navigator.clipboard.readText() || "").trim();
    } catch {
      input.value = (prompt("Dán Device ID tại đây:", "") || "").trim();
    }
    onDevChange();
    showMsg(input.value ? "ok" : "warn", input.value ? "Đã cập nhật Device ID." : "Chưa có Device ID để dán.");
  }

  function clearKey() {
    const input = $("#vgKey");
    if (input) input.value = "";
    localStorage.removeItem(LICENSE_KEY);
    setState(null);
    showMsg("ok", "Đã xóa key đã lưu trên ứng dụng này.");
  }

  function clearDeviceId() {
    setDeviceId("", true);
    showMsg("ok", "Đã xóa Device ID.");
  }

  function ensureInputs() {
    const key = ($("#vgKey")?.value || "").trim();
    if (!deviceId) {
      showMsg("warn", "Vui lòng nhập Device ID trước khi tiếp tục.");
      return null;
    }
    if (!isDevId(deviceId)) {
      showMsg("warn", "Device ID không hợp lệ. Vui lòng kiểm tra lại.");
      return null;
    }
    if (!key) {
      showMsg("warn", "Vui lòng nhập key bản quyền.");
      return null;
    }
    return { key, deviceId };
  }

  function getDeviceMeta() {
    return {
      serial: localStorage.getItem(DEVICE_SERIAL_KEY) || "",
      imei: localStorage.getItem(DEVICE_IMEI_KEY) || ""
    };
  }

  function mapError(res) {
    const code = String(res?.error || "").toUpperCase();
    if (code === "WRONG_KEY_TIER" || code === "KEY_NOT_ALLOWED_FOR_APP") {
      return `Key này thuộc gói <b>${escapeHtml(tierLabel(res?.actual || res?.actualTier || res?.data?.tier))}</b> và không thể dùng cho ứng dụng <b>${APP.label}</b>.`;
    }
    if (code === "DEVICE_MISMATCH" || code === "BOUND_TO_ANOTHER_DEVICE" || code === "KEY_ALREADY_BOUND" || code === "KEY_IN_USE_ON_ANOTHER_DEVICE") {
      return "Thiết bị hiện tại không khớp với thiết bị đã liên kết.";
    }
    return ({
      RATE_LIMIT: "Bạn thao tác quá nhanh. Vui lòng thử lại sau ít phút.",
      TIMEOUT: "Kết nối đến máy chủ bị quá thời gian chờ.",
      NETWORK_ERROR: "Không thể kết nối đến máy chủ. Vui lòng kiểm tra mạng.",
      PARSE_ERROR: "Phản hồi từ máy chủ không hợp lệ.",
      APP_TYPE_REQUIRED: "Thiếu thông tin loại ứng dụng khi xác thực key.",
      INVALID_DEVICE_ID: "Device ID không hợp lệ.",
      DEVICE_ID_REQUIRED: "Vui lòng nhập Device ID.",
      DEVICE_NOT_BOUND: "Key chưa được liên kết thiết bị. Hãy bấm Kiểm tra hoặc Kích hoạt để liên kết lần đầu.",
      EXPIRED: "Key đã hết hạn sử dụng.",
      REVOKED: "Key đã bị thu hồi.",
      NOT_FOUND: "Không tìm thấy key hợp lệ.",
      KEY_REQUIRED: "Vui lòng nhập key bản quyền.",
      UNAUTHORIZED: "Yêu cầu hiện tại không có quyền truy cập.",
      NO_ROUTE: "Đường dẫn API không hợp lệ."
    })[code] || "Có lỗi xảy ra trong quá trình xác thực.";
  }

  function shouldClearStoredKey(res) {
    return [
      "WRONG_KEY_TIER",
      "NOT_FOUND",
      "REVOKED",
      "EXPIRED",
      "DEVICE_MISMATCH",
      "BOUND_TO_ANOTHER_DEVICE",
      "KEY_ALREADY_BOUND",
      "KEY_IN_USE_ON_ANOTHER_DEVICE"
    ].includes(String(res?.error || "").toUpperCase());
  }

  function emitLicenseEvent(state, data) {
    window.dispatchEvent(new CustomEvent("vsh-license-change", { detail: { state, tier: APP.tier, data } }));
  }

  function showToast(type, title, message) {
    if (typeof window.showSystemNotification === "function") {
      window.showSystemNotification(type, title, message, { force: true, withSound: false, duration: 2600 });
      return;
    }
    let toast = $("#ftAccessToast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "ftAccessToast";
      document.body.appendChild(toast);
    }
    toast.innerHTML = `<strong>${escapeHtml(title)}</strong><br>${message}`;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 2400);
  }

  function directSwitchPage(pageId) {
    $$(".page").forEach((page) => page.classList.remove("active"));
    $$(".nav-btn").forEach((button) => button.classList.remove("active"));
    $$(".bnav-btn").forEach((button) => button.classList.remove("active"));
    const page = document.getElementById(`page-${pageId}`);
    if (page) page.classList.add("active");
    $$(`[data-page="${pageId}"]`).forEach((button) => button.classList.add("active"));
  }

  function navigatePage(pageId) {
    (originalSwitchPage || directSwitchPage)(pageId);
  }

  function getCurrentPage() {
    const active = $(".page.active");
    return active && active.id.startsWith("page-") ? active.id.slice(5) : null;
  }

  function canAccessPage(pageId) {
    return unlocked || pageId === ALLOWED_PAGE;
  }

  function syncLockedTabs() {
    $$("[data-page]").forEach((button) => {
      const lockedTab = !unlocked && button.dataset.page !== ALLOWED_PAGE;
      button.classList.toggle("ft-tab-locked", lockedTab);
      button.setAttribute("aria-disabled", lockedTab ? "true" : "false");
      if (lockedTab) button.title = "Vui lòng kích hoạt key để truy cập khu vực này.";
      else button.removeAttribute("title");
    });
  }

  function syncSetupAccess() {
    const settingsPage = $("#page-settings");
    if (!settingsPage) return;

    let note = $("#ftSetupLockNote", settingsPage);
    if (!note) {
      note = document.createElement("div");
      note.id = "ftSetupLockNote";
      note.className = "ft-setup-lock-note";
      note.innerHTML = "Bạn đang ở chế độ truy cập giới hạn. Chỉ <b>Setup</b> và nút <b>Log Out</b> khả dụng cho đến khi key được kích hoạt.";
      settingsPage.prepend(note);
    }
    note.hidden = unlocked;

    const controls = $$("button, input, select, textarea", settingsPage).filter((element) => !element.classList.contains("logout-btn") && !element.closest(".logout-btn"));
    const containers = new Set();

    controls.forEach((element) => {
      const container = element.closest(".setting-row, .settings-actions");
      if (container) containers.add(container);
      if (!("ftPrevDisabled" in element.dataset)) element.dataset.ftPrevDisabled = element.disabled ? "1" : "0";
      element.disabled = unlocked ? element.dataset.ftPrevDisabled === "1" : true;
    });

    containers.forEach((container) => container.classList.toggle("ft-setup-disabled", !unlocked));

    const logoutButton = $(".logout-btn", settingsPage);
    if (logoutButton) logoutButton.disabled = false;
  }

  function syncGlobalAccess() {
    const launcherButton = $("#launcher .launcher-btn");
    if (launcherButton) {
      launcherButton.classList.toggle("ft-action-locked", !unlocked);
      launcherButton.setAttribute("aria-disabled", !unlocked ? "true" : "false");
      if (!unlocked) launcherButton.title = "Vui lòng kích hoạt key để mở Control Center.";
      else launcherButton.removeAttribute("title");
    }

    if (!unlocked && $("#popup-overlay") && typeof window.closePopup === "function") {
      window.closePopup();
    }
  }

  function openGate(message) {
    buildUI();
    if (refs.gate) refs.gate.style.display = "grid";
    document.body.classList.add("vg-locked");
    if (message) showMsg("warn", message);
  }

  function closeGate(clearPending = false) {
    if (refs.gate) refs.gate.style.display = "none";
    document.body.classList.remove("vg-locked");
    if (clearPending) pendingPage = null;
  }

  function setUnlocked(next, options = {}) {
    unlocked = !!next;
    syncLockedTabs();
    syncSetupAccess();
    syncGlobalAccess();

    if (unlocked) {
      closeGate();
      const targetPage = options.targetPage || pendingPage;
      pendingPage = null;
      if (targetPage && targetPage !== getCurrentPage()) navigatePage(targetPage);
    } else if (options.redirect !== false && getCurrentPage() !== ALLOWED_PAGE) {
      navigatePage(ALLOWED_PAGE);
    }
  }

  function requestUnlock(pageId, options = {}) {
    pendingPage = typeof pageId === "string" && document.getElementById(`page-${pageId}`) ? pageId : null;
    showToast("warning", options.title || "Truy cập bị giới hạn", options.toastMessage || "Vui lòng kích hoạt key để truy cập khu vực này.");
    clearTimeout(gateTimer);
    gateTimer = setTimeout(() => openGate(options.gateMessage || "Khu vực bạn chọn chỉ khả dụng sau khi key được kích hoạt."), 180);
  }

  function installSwitchGuard() {
    const base = typeof window.switchPage === "function" ? window.switchPage.bind(window) : directSwitchPage;
    if (window.switchPage && window.switchPage.__ftWrapped) {
      originalSwitchPage = window.switchPage.__ftOriginal || base;
      return;
    }
    originalSwitchPage = base;
    const wrapped = function(pageId) {
      if (!canAccessPage(pageId)) {
        requestUnlock(pageId);
        return;
      }
      return originalSwitchPage(pageId);
    };
    wrapped.__ftWrapped = true;
    wrapped.__ftOriginal = base;
    window.switchPage = wrapped;
  }

  function installActionGuards() {
    if (typeof window.openPopup !== "function" || !$("#popup-overlay")) return;
    const base = window.openPopup.bind(window);
    if (window.openPopup && window.openPopup.__ftWrapped) {
      originalOpenPopup = window.openPopup.__ftOriginal || base;
      return;
    }
    originalOpenPopup = base;
    const wrapped = function(...args) {
      if (!unlocked) {
        requestUnlock(null, {
          toastMessage: "Vui lòng kích hoạt key để mở Control Center.",
          gateMessage: "Control Center chỉ khả dụng sau khi key được kích hoạt."
        });
        return;
      }
      return originalOpenPopup(...args);
    };
    wrapped.__ftWrapped = true;
    wrapped.__ftOriginal = base;
    window.openPopup = wrapped;
  }

  async function verifyKey() {
    const payload = ensureInputs();
    if (!payload) return false;

    showMsg("", "Đang kiểm tra key...");
    const meta = getDeviceMeta();
    const res = await api("/api/verify", {
      ...payload,
      appType: APP.tier,
      claim: true,
      serial: meta.serial,
      imei: meta.imei
    });

    if (!res?.ok) {
      showMsg("err", mapError(res), res);
      emitLicenseEvent("invalid", res);
      return false;
    }

    const data = res.data || {};
    setState(data);
    showMsg("ok", `Key hợp lệ cho ứng dụng <b>${APP.label}</b>.<br>Thiết bị đã sẵn sàng để kích hoạt.`, res);
    emitLicenseEvent("verified", data);
    return true;
  }

  async function activateKey(options = {}) {
    const { silent = false } = options;
    const payload = ensureInputs();
    if (!payload) return false;

    if (!silent) showMsg("", "Đang kích hoạt key...");
    const meta = getDeviceMeta();
    const res = await api("/api/activate", {
      ...payload,
      appType: APP.tier,
      serial: meta.serial,
      imei: meta.imei
    });

    if (!res?.ok) {
      if (shouldClearStoredKey(res)) localStorage.removeItem(LICENSE_KEY);
      if (!silent) showMsg("err", mapError(res), res);
      emitLicenseEvent("invalid", res);
      return false;
    }

    const data = res.data || {};
    localStorage.setItem(LICENSE_KEY, payload.key);
    setState(data);
    if (!silent) showMsg("ok", `Kích hoạt thành công.<br>Hết hạn: <b>${escapeHtml(formatDate(data.expiresAt))}</b>`, res);
    setUnlocked(true, { redirect: false, targetPage: pendingPage });
    showToast("success", "Kích hoạt thành công", "Toàn bộ khu vực của ứng dụng đã được mở khóa.");
    emitLicenseEvent(silent ? "restored" : "activated", data);
    return true;
  }

  async function restoreAccess() {
    const storedKey = localStorage.getItem(LICENSE_KEY) || "";
    if (!storedKey || !deviceId || !isDevId(deviceId)) return false;
    const keyInput = $("#vgKey");
    if (keyInput) keyInput.value = storedKey;

    const meta = getDeviceMeta();
    const res = await api("/api/verify", {
      key: storedKey,
      deviceId,
      appType: APP.tier,
      serial: meta.serial,
      imei: meta.imei
    });

    if (!res?.ok) {
      if (shouldClearStoredKey(res)) localStorage.removeItem(LICENSE_KEY);
      return false;
    }

    const data = res.data || {};
    setState(data);
    setUnlocked(true, { redirect: false });
    emitLicenseEvent("restored", data);
    return true;
  }

  function resetStoredKey() {
    localStorage.removeItem(LICENSE_KEY);
    const keyInput = $("#vgKey");
    if (keyInput) keyInput.value = "";
    setState(null);
    pendingPage = null;
    setUnlocked(false);
    openGate("Đã xóa key đã lưu. Vui lòng kích hoạt lại để mở khóa đầy đủ ứng dụng.");
    emitLicenseEvent("reset", null);
  }

  async function bootstrap() {
    buildUI();
    installSwitchGuard();
    installActionGuards();
    initialPage = getCurrentPage() || "home";
    onDevChange(true);
    setUnlocked(false);

    const restored = await restoreAccess();
    if (restored) {
      if (initialPage && initialPage !== ALLOWED_PAGE) navigatePage(initialPage);
      return;
    }

    setState(null);
    showMsg("", "Kích hoạt key để mở khóa toàn bộ khu vực chức năng của ứng dụng.");
  }

  buildUI();
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bootstrap);
  else bootstrap();

  window.VSHKeyGate = {
    show: () => openGate(),
    hide: () => closeGate(true),
    reset: resetStoredKey,
    setDeviceId(value) { setDeviceId(value); },
    appType: APP.tier
  };
})();
