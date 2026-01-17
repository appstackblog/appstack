(() => {
  // =========================================================
  // CONFIG
  // =========================================================
  const API_BASE = "https://uchihakey.vshtechofficial.workers.dev"; // KHÔNG có dấu / cuối
  const DEVICE_INFO_URL = "https://appstack.blog/app/getuuid/get_mobileconfig.php";
  const DEVICE_KEY  = "vsh_license_device_id";   // lưu UDID/UUID
  const DEVICE_SERIAL_KEY = "vsh_device_serial";
  const DEVICE_IMEI_KEY = "vsh_device_imei";
  const LICENSE_KEY = "vsh_license_key";

  // Chấp nhận:
  // - UUID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
  // - iOS UDID: 40 hex
  // - iOS Finder ID: 8-16 hex (vd 00008140-000E50D22687001C)
  // - Android ID: 16 hex
  // - Linux machine-id: 32 hex
  const UUID_ANY = /^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/;
  const IOS_UDID = /^[0-9A-F]{40}$/;
  const IOS_FINDER = /^[0-9A-F]{8}-[0-9A-F]{16}$/;
  const HEX_16 = /^[0-9A-F]{16}$/;
  const HEX_32 = /^[0-9A-F]{32}$/;

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

  function normDevId(s){ return String(s || "").trim().toUpperCase(); }
  function isDevId(s){
    const v = normDevId(s);
    return (
      UUID_ANY.test(v) ||
      IOS_UDID.test(v) ||
      IOS_FINDER.test(v) ||
      HEX_16.test(v) ||
      HEX_32.test(v)
    );
  }

  // Load stored device id (UDID/UUID)
  let deviceId = normDevId(localStorage.getItem(DEVICE_KEY) || "");

  async function api(path, payload, timeoutMs = 10000) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(`${API_BASE}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: ctrl.signal,
      });
      const data = await res.json().catch(() => null);
      return data || { ok: false, error: "PARSE_ERROR" };
    } catch (e) {
      return { ok: false, error: e?.name === "AbortError" ? "TIMEOUT" : "NETWORK_ERROR" };
    } finally {
      clearTimeout(t);
    }
  }

  // =========================================================
  // UI CSS
  // =========================================================
  const style = document.createElement("style");
  style.textContent = `
  #vgGate{--bg:#0b0f14;--surface:#121a24;--surface2:#0f1620;--border:#223041;--text:#e6edf3;--muted:#9fb0c0;--accent:#00d1ff;--success:#2dff7a;--warning:#ffb020;--danger:#ff3b3b;position:fixed;inset:0;z-index:2147483647;display:grid;place-items:center;background:rgba(11,15,20,.86);backdrop-filter:blur(16px)}
  #vgGate .vg-panel{width:min(920px,95vw);max-height:min(760px,95vh);overflow-y:auto;border-radius:28px;padding:32px;
    background:linear-gradient(160deg,rgba(18,26,36,.98),rgba(15,22,32,.95));color:var(--text);
    font-family:system-ui,-apple-system,"Segoe UI",sans-serif;border:1px solid var(--border);
    box-shadow:0 35px 85px rgba(2,4,12,.7)}
  #vgGate .vg-hd{display:flex;align-items:flex-start;justify-content:space-between;gap:24px;margin-bottom:24px}
  #vgGate .vg-tag{margin:0;font-size:0.72rem;letter-spacing:0.3em;color:var(--accent);text-transform:uppercase}
  #vgGate .vg-brand{margin:0;font-size:2rem;font-weight:800;letter-spacing:0.06em;color:var(--text)}
  #vgGate .vg-close{border:none;background:rgba(255,255,255,.06);color:var(--text);border-radius:50%;width:44px;height:44px;display:grid;place-items:center;font-size:1.2rem;cursor:pointer;transition:.2s}
  #vgGate .vg-close:hover{background:rgba(255,255,255,.12)}
  #vgGate .vg-body{display:grid;grid-template-columns:1fr;gap:22px}
  #vgGate .vg-topstats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-bottom:18px}
  #vgGate .vg-stat{background:rgba(255,255,255,.02);border:1px solid var(--border);border-radius:16px;padding:14px;display:grid;gap:6px}
  #vgGate .vg-stat span{font-size:.7rem;letter-spacing:.22em;text-transform:uppercase;color:var(--muted)}
  #vgGate .vg-stat strong{font-size:1.05rem;color:var(--text);word-break:break-word}
  #vgGate .vg-card{background:rgba(255,255,255,.02);border:1px solid var(--border);border-radius:20px;padding:20px;box-shadow:0 18px 36px rgba(3,5,12,.5)}
  #vgGate .vg-label{font-size:0.7rem;color:var(--muted);margin-bottom:8px;letter-spacing:0.22em;text-transform:uppercase}
  #vgGate .vg-field{display:grid;grid-template-columns:1fr auto auto;gap:12px;align-items:center}
  #vgGate .vg-field.uuid{grid-template-columns:1fr}
  #vgGate .vg-field-actions{display:flex;flex-wrap:wrap;gap:12px;margin-top:12px}
  #vgGate .vg-field.two{grid-template-columns:1fr auto}
  #vgGate .vg-input{padding:13px;border-radius:14px;border:1px solid var(--border);background:rgba(10,18,26,.95);color:var(--text);font-size:1rem;width:100%}
  #vgGate .vg-icon{display:inline-flex;align-items:center;gap:8px;padding:11px 13px;border-radius:12px;border:1px solid rgba(0,209,255,.35);
    background:rgba(9,14,22,.95);color:var(--text);cursor:pointer;transition:transform .2s,border-color .2s;white-space:nowrap}
  #vgGate .vg-icon:hover{transform:translateY(-1px);border-color:rgba(0,209,255,.6)}
  #vgGate .vg-icon svg{width:17px;height:17px;display:block}
  #vgGate .vg-actions{display:flex;flex-wrap:wrap;gap:12px;margin-top:18px}
  #vgGate .vg-btn{border:none;border-radius:14px;padding:12px 20px;font-weight:650;letter-spacing:.16em;text-transform:uppercase;cursor:pointer;transition:.2s}
  #vgGate .vg-btn--pri{background:linear-gradient(120deg,#00d1ff,#7fe9ff);color:#041018;box-shadow:0 12px 28px rgba(0,209,255,.35)}
  #vgGate .vg-btn--ghost{background:rgba(255,255,255,.04);color:var(--text);border:1px solid var(--border)}
  #vgGate .vg-btn:hover{transform:translateY(-2px)}
  #vgGate .vg-summary{display:grid;gap:16px}
  #vgGate .vg-summary-block{background:rgba(255,255,255,.02);border:1px solid var(--border);border-radius:16px;padding:16px}
  #vgGate .vg-summary-block h4{margin:0 0 6px;font-size:0.72rem;letter-spacing:.28em;color:var(--muted);text-transform:uppercase}
  #vgGate .vg-summary-block p{margin:0;color:var(--text);font-size:1.02rem;font-weight:600;word-break:break-word}
  #vgGate .vg-msg{margin-top:18px;padding:13px 16px;border-radius:14px;border:1px solid var(--border);background:rgba(255,255,255,.03);font-size:.92rem;color:var(--text)}
  #vgGate .vg-msg.ok{border-color:rgba(45,255,122,.4);background:rgba(45,255,122,.12);color:#dfffee}
  #vgGate .vg-msg.warn{border-color:rgba(255,176,32,.45);background:rgba(255,176,32,.12);color:#fff2c0}
  #vgGate .vg-msg.err{border-color:rgba(255,59,59,.45);background:rgba(255,59,59,.12);color:#ffd7d7}
  body.vg-locked{overflow:hidden}
  body.vg-locked>*:not(#vgGate){filter:blur(4px);pointer-events:none !important;user-select:none !important}
  #vgGate details{margin-top:14px;border:1px dashed rgba(255,255,255,.12);border-radius:12px;overflow:hidden}
  #vgGate summary{padding:12px 16px;cursor:pointer;list-style:none;background:rgba(9,14,22,.92);color:var(--muted);font-weight:600}
  #vgGate summary::-webkit-details-marker{display:none}
  #vgGate .vg-pre{margin:0;padding:14px 16px;background:rgba(2,4,12,.9);color:#d1dbff;max-height:220px;overflow:auto;font-family:ui-monospace,Menlo,Monaco,Consolas,"JetBrains Mono",monospace;font-size:0.85rem}
  #vgGate .vg-foot{display:flex;justify-content:space-between;align-items:center;margin-top:14px;color:var(--muted);font-size:.8rem;letter-spacing:.16em;text-transform:uppercase}
  #vgGate .vg-foot strong{font-size:1rem;color:var(--text)}
  @media(max-width:760px){
    #vgGate .vg-body{grid-template-columns:1fr}
    #vgGate .vg-topstats{grid-template-columns:1fr}
    #vgGate .vg-field{grid-template-columns:1fr}
    #vgGate .vg-panel{padding:26px}
  }`;
  document.head.appendChild(style);

  const $ = (sel, root = document) => root.querySelector(sel);

  // =========================================================
  // UI Build
  // =========================================================
  function buildUI() {
    let wrap = $("#vgGate");
    if (wrap) return wrap;

    wrap = document.createElement("div");
    wrap.id = "vgGate";
    wrap.innerHTML = `
      <div class="vg-panel">
        <div class="vg-hd">
          <div>
            <p class="vg-tag">UCHIHA ACCESS</p>
            <h3 class="vg-brand">UCHIHA KEY</h3>
          </div>
          <button class="vg-close" id="vgReset" title="Nhập lại key">&#8635;</button>
        </div>

        <div class="vg-topstats">
          <div class="vg-stat">
            <span>Trạng thái</span>
            <strong id="vgState">Chưa kích hoạt</strong>
          </div>
          <div class="vg-stat">
            <span>Hạn sử dụng</span>
            <strong id="vgExpiry">--/--/--</strong>
          </div>
          <div class="vg-stat">
            <span>Device ID</span>
            <strong id="vgDevDisplay">--</strong>
          </div>
        </div>

        <div class="vg-body">
          <section class="vg-card">
            <div class="vg-label">Mã kích hoạt</div>
            <div class="vg-field">
              <input id="vgKey" class="vg-input" type="text" placeholder="VSH...-XXXX-XXXX-XXXX" autocomplete="one-time-code" inputmode="latin">
              <button class="vg-icon" id="vgPasteKey" title="Dán mã">
                <svg viewBox="0 0 24 24" fill="none"><path d="M8 4h8v4h4v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4h4Z" stroke="currentColor" stroke-width="1.6"/><path d="M9 2h6v3a1 1 0 0 1-1 1H10a 1 1 0 0 1-1-1V2Z" stroke="currentColor" stroke-width="1.6"/></svg>
                <span>Dán</span>
              </button>
              <button class="vg-icon" id="vgDelKey" title="Xóa mã">
                <svg viewBox="0 0 24 24" fill="none"><path d="M4 7h16M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13" stroke="currentColor" stroke-width="1.6"/><path d="M10 11v7M14 11v7" stroke="currentColor" stroke-width="1.6"/></svg>
                <span>Xóa</span>
              </button>
            </div>

            <div style="margin-top:18px">
              <div class="vg-label">UUID / UDID thiết bị</div>
              <div class="vg-field uuid">
                <input id="vgDev" class="vg-input" type="text" placeholder="UUID (có -) hoặc UDID iOS (40 ký tự)">
              </div>
              <div class="vg-field-actions">
                <button class="vg-icon" id="vgGetDev" title="Lấy UDID bằng cấu hình">
                  <span>Lấy UUID</span>
                </button>
                <button class="vg-icon" id="vgCopyDev" title="Dán Device ID">
                  <svg viewBox="0 0 24 24" fill="none"><path d="M9 9h8a2 2 0 0 1 2 2v8a 2 2 0 0 1-2 2H9a2 2 0 0 1-2-2v-8a 2 2 0 0 1 2-2Z" stroke="currentColor" stroke-width="1.6"/><path d="M7 15H6a 2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1" stroke="currentColor" stroke-width="1.6"/></svg>
                  <span>Dán</span>
                </button>
                <button class="vg-icon" id="vgClearDev" title="Xóa Device ID">
                  <svg viewBox="0 0 24 24" fill="none"><path d="M4 7h16M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13" stroke="currentColor" stroke-width="1.6"/><path d="M10 11v7M14 11v7" stroke="currentColor" stroke-width="1.6"/></svg>
                  <span>Xóa</span>
                </button>
              </div>
              <div style="margin-top:10px;color:#b8c6ff;font-size:.9rem;line-height:1.45">
                • iOS: bấm <b>Lấy UUID</b> → cài Profile → UDID sẽ tự điền vào đây.<br>
                • Android/PC: bạn tự nhập UUID/ID theo hệ bạn dùng.<br>
                • Thiết bị sẽ tự gắn với key khi bạn bấm <b>Kiểm tra</b> hoặc <b>Kích hoạt</b> lần đầu.
              </div>
            </div>

            <div class="vg-actions">
              <button class="vg-btn vg-btn--ghost" id="vgCheck">Kiểm tra</button>
              <button class="vg-btn vg-btn--pri" id="vgActive">Kích hoạt</button>
            </div>
          </section>
        </div>

        <div class="vg-msg" id="vgMsg">Nhập Device ID + Key để kiểm tra.</div>

        <details id="vgDtl" hidden>
          <summary>Chi tiết kỹ thuật</summary>
          <pre class="vg-pre" id="vgRaw"></pre>
        </details>

        <div class="vg-foot">
          <span>Lớp bảo vệ UCHIHA</span>
          <strong id="vgSta"></strong>
        </div>
      </div>`;
    document.body.appendChild(wrap);

    refs.status = $("#vgState");
    refs.expiry = $("#vgExpiry");
    refs.device = $("#vgDevDisplay");

    // fill stored
    const storedKey = localStorage.getItem(LICENSE_KEY) || "";
    if (storedKey) $("#vgKey").value = storedKey;

    const devInput = $("#vgDev");
    devInput.value = deviceId;
    refs.device.textContent = deviceId || "--";

    $("#vgPasteKey").onclick = pasteKey;
    $("#vgDelKey").onclick = clearKey;

    $("#vgCopyDev").onclick = async () => {
      try {
        const txt = await navigator.clipboard.readText();
        const value = (txt || "").trim();
        if(!value) return showMsg("warn","Chưa có Device ID để dán.");
        $("#vgDev").value = value;
        onDevChange();
        showMsg("ok","Đã dán Device ID.");
      } catch {
        const txt = prompt("Dán Device ID tại đây:", "") || "";
        const value = txt.trim();
        if(!value) return showMsg("warn","Chưa có Device ID để dán.");
        $("#vgDev").value = value;
        onDevChange();
        showMsg("ok","Đã dán Device ID.");
      }
    };
    $("#vgClearDev").onclick = () => {
      $("#vgDev").value = "";
      deviceId = "";
      localStorage.removeItem(DEVICE_KEY);
      refs.device && (refs.device.textContent = "--");
      showMsg("ok","Đã xóa Device ID.");
    };

    devInput.oninput = () => onDevChange();

    // Open device capture page
    $("#vgGetDev").onclick = () => { window.location.href = "https://appstack.blog/app/getuuid/"; };

    $("#vgReset").onclick = () => {
      localStorage.removeItem(LICENSE_KEY);
      setState(null);
      openGate();
      showMsg("ok","Đã reset key. Nhập lại để kích hoạt.");
    };

    $("#vgCheck").onclick = verifyKey;
    $("#vgActive").onclick = activateKey;

    // Listen postMessage from /device/done
    window.addEventListener("message", onDeviceMessage);

    return wrap;
  }

  // =========================================================
  // Device capture integration
  // =========================================================
  let devWin = null;

  function currentUrlNoHash(){
    const u = new URL(window.location.href);
    u.hash = "";
    return u.toString();
  }

  function openDeviceCapture(){
    // return = trang hiện tại (để /device quay lại)
    const returnUrl = currentUrlNoHash();
    const u = `${DEVICE_INFO_URL}?return=${encodeURIComponent(returnUrl)}`;

    // iOS Safari có thể chặn popup nếu không trực tiếp từ click -> mình mở luôn trong onclick
    const a = document.createElement("a");
    a.href = u;
    a.target = "_blank";
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => { window.location.href = u; }, 200);
    showMsg("", "Đang mở trang lấy UDID… Nếu bị chặn popup, hãy cho phép mở tab mới.");
  }

  // Device-info redirect + claim verify
  function parseDeviceHash(){
    const hash = window.location.hash || "";
    if(!hash.startsWith("#")) return;
    const params = new URLSearchParams(hash.slice(1));
    if(params.get("vsh") !== "1") return;

    const uuid = params.get("uuid") || "";
    const serial = params.get("serial") || "";
    const imei = params.get("imei") || "";

    if(uuid) setDeviceId(uuid);
    if(serial) localStorage.setItem(DEVICE_SERIAL_KEY, serial);
    if(imei) localStorage.setItem(DEVICE_IMEI_KEY, imei);

    showMsg("ok", "Đã nhận UUID từ thiết bị.");
    history.replaceState(null, "", window.location.pathname + window.location.search);
  }

  function onDeviceMessage(ev){
    const msg = ev?.data;
    if(!msg || !msg.vshDevice || !msg.data) return;

    const udid = normDevId(msg.data.udid || "");
    if(udid && isDevId(udid)){
      setDeviceId(udid);
      showMsg("ok", "✅ Đã nhận UDID từ cấu hình và tự điền vào Device ID.");
      try{ devWin && devWin.close && devWin.close(); }catch{}
    }else{
      showMsg("warn", "Đã nhận dữ liệu nhưng UDID không hợp lệ. Bạn copy UDID trên trang đó rồi dán vào ô này.");
    }
  }

  function setDeviceId(v){
    deviceId = normDevId(v);
    localStorage.setItem(DEVICE_KEY, deviceId);
    const dev = $("#vgDev");
    if(dev) dev.value = deviceId;
    refs.device && (refs.device.textContent = deviceId || "--");
  }

  // =========================================================
  // UI helpers
  // =========================================================
  function showMsg(type, msg, detail) {
    const el = $("#vgMsg");
    el.className = "vg-msg " + (type || "");
    el.innerHTML = msg;

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
      refs.status && (refs.status.textContent = "Chưa kích hoạt");
      refs.expiry && (refs.expiry.textContent = "--/--/--");
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
      showMsg("ok", "Đã dán key.");
    } catch {
      const txt = prompt("Dán key tại đây:", "") || "";
      input.value = txt.trim();
      showMsg("ok", "Đã dán key.");
    }
    input.focus();
  }

  function clearKey() {
    $("#vgKey").value = "";
    localStorage.removeItem(LICENSE_KEY);
    setState(null);
    showMsg("ok", "Đã xóa key khỏi thiết bị này.");
  }

  function onDevChange(){
    const v = normDevId($("#vgDev").value);
    deviceId = v;
    localStorage.setItem(DEVICE_KEY, deviceId);
    refs.device && (refs.device.textContent = deviceId || "--");

    if(deviceId && !isDevId(deviceId)){
      showMsg("warn","Device ID chưa đúng. Hỗ trợ: <b>UUID</b> (có dấu -) hoặc <b>UDID iOS</b> (40 ký tự hex).");
    }
  }

  function ensureInputs(){
    const key = $("#vgKey").value.trim();
    if (!deviceId) { showMsg("warn","Vui lòng nhập Device ID."); return null; }
    if (!isDevId(deviceId)) { showMsg("warn","Device ID không hợp lệ."); return null; }
    if (!key) { showMsg("warn","Vui lòng nhập Key."); return null; }
    return { key, deviceId };
  }

  function getDeviceMeta(){
    return {
      serial: localStorage.getItem(DEVICE_SERIAL_KEY) || "",
      imei: localStorage.getItem(DEVICE_IMEI_KEY) || ""
    };
  }

  function mapError(res){
    const e = (res?.error || "").toUpperCase();
    return {
      RATE_LIMIT: "Bạn thao tác quá nhanh. Thử lại sau.",
      TIMEOUT: "Timeout kết nối. Thử lại.",
      NETWORK_ERROR: "Mất kết nối mạng.",
      PARSE_ERROR: "Lỗi phản hồi server.",
      INVALID_DEVICE_ID: "Device ID không hợp lệ.",
      DEVICE_NOT_BOUND: "Key chưa gắn thiết bị. Hãy bấm <b>Kiểm tra</b> hoặc <b>Kích hoạt</b> để tự gắn lần đầu.",
      BOUND_TO_ANOTHER_DEVICE: "Key đã bind thiết bị khác.",
      EXPIRED: "Key đã hết hạn.",
      REVOKED: "Key đã bị thu hồi.",
      NOT_FOUND: "Không tìm thấy key.",
      UNAUTHORIZED: "Thiếu quyền truy cập.",
      NO_ROUTE: "Sai đường dẫn API."
    }[e] || "Có lỗi xảy ra.";
  }

  // =========================================================
  // Actions
  // =========================================================
  async function verifyKey() {
    const p = ensureInputs();
    if(!p) return;

    showMsg("", "Đang kiểm tra...");
    const meta = getDeviceMeta();
    const res = await api("/api/verify", { ...p, claim: true, serial: meta.serial, imei: meta.imei });

    if (res.ok) {
      const data = res.data || {};
      localStorage.setItem(LICENSE_KEY, p.key);
      setState(data);
      showMsg("ok", `Hợp lệ<br>Hết hạn: <b>${formatDate(data.expiresAt)}</b>`, res);
      return;
    }
    showMsg("err", mapError(res), res);
  }

  async function activateKey() {
    const p = ensureInputs();
    if(!p) return;

    showMsg("", "Đang kích hoạt…");
    const meta = getDeviceMeta();
    const res = await api("/api/activate", { ...p, serial: meta.serial, imei: meta.imei });

    if (res.ok) {
      const data = res.data || {};
      localStorage.setItem(LICENSE_KEY, p.key);
      setState(data);
      showMsg("ok", `Kích hoạt thành công<br>Hết hạn: <b>${formatDate(data.expiresAt)}</b>`, res);
      setTimeout(() => closeGate(), 900);
      window.dispatchEvent(new CustomEvent("vsh-license-change", { detail: { state: "activated", data } }));
      return;
    }
    showMsg("err", mapError(res), res);
    window.dispatchEvent(new CustomEvent("vsh-license-change", { detail: { state: "invalid", data: res } }));
  }

  // =========================================================
  // Gate open/close + bootstrap
  // =========================================================
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
    buildUI();
    parseDeviceHash();
    onDevChange();

    const storedKey = localStorage.getItem(LICENSE_KEY);
    if (!storedKey) return openGate();

    if(!deviceId || !isDevId(deviceId)) return openGate();

    const res = await api("/api/verify", { key: storedKey, deviceId });
    if (res.ok) {
      setState(res.data);
      closeGate();
      setTimeout(() => bootstrap(), 600000);
    } else {
      openGate();
    }
  }

  buildUI();
  window.addEventListener("hashchange", parseDeviceHash);
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootstrap);
  } else {
    bootstrap();
  }

  // Expose helpers
  window.VSHKeyGate = {
    show: openGate,
    hide: closeGate,
    reset(){
      localStorage.removeItem(LICENSE_KEY);
      openGate();
    },
    setDeviceId(v){
      setDeviceId(v);
    }
  };
})();




