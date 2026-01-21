// ================== VSH TECH • License Bot + API (KV, UUID-lock, allow-list) ==================
// Cloudflare Worker (module syntax). Requires KV binding: KEYS
// Bạn có thể hardcode token/keys trong CFG hoặc set env/secrets (env ưu tiên).

const CFG = {
  // ====== HARD-CODE HERE (bạn muốn thì để trong mã và chỉ sửa chỗ này) ======
  TG_TOKEN:    "8502120269:AAE2UqCmk3OhaWbSqhNef2xlF2TGOagRaow",
  ADMIN_KEY:   "vsh_admin_8G9RzJ42XkM",
  SECRET_PATH: "vsh_tech", // ví dụ: vsh_x9Q7a
  ADMIN_IDS:   "5133353189",           // CSV: "id1,id2"
  // =================================================================

  BRAND:       "VSH TECH",
  KEY_PREFIX:  "iOS_Server_Key_AppStackTeam_Top_One",
  DOWNLOAD_URL:"https://example.com/your-dylib",
  DEVICE_INFO_URL: "",
  ADMIN_NOTIFY_ON_CLAIM: false,
  PUBLIC_MODE: false,
  ALLOW_IDS:   "",

  NOTIFY_BOT_TOKEN: "",
  NOTIFY_CHAT_ID: "-1003669032722",
  NOTIFY_ENABLED: false,
  NOTIFY_ALSO_ADMINS: true,
  TZ:          "Asia/Ho_Chi_Minh",
  MAX_QTY:     200,

  // Rate limits (per IP / minute)
  RL_VERIFY_PER_MIN:   60,  // /api/verify
  RL_ACTIVATE_PER_MIN: 30,  // /api/activate
  RL_OTHER_PER_MIN:    120  // other /api/*
};

const now = () => Date.now();

/* ------------------------------- Config loader (env ưu tiên) ------------------------------- */
function envCfg(env){
  const b = (v, d=false) => {
    if (v == null) return d;
    const s = String(v).trim().toLowerCase();
    if (s === "true" || s === "1" || s === "yes") return true;
    if (s === "false" || s === "0" || s === "no") return false;
    return d;
  };
  return {
    TG_TOKEN:    (env && env.TG_TOKEN)    || CFG.TG_TOKEN,
    ADMIN_KEY:   (env && env.ADMIN_KEY)   || CFG.ADMIN_KEY,
    SECRET_PATH: (env && env.SECRET_PATH) || CFG.SECRET_PATH,

    BRAND: (env && env.BRAND) || CFG.BRAND,
    KEY_PREFIX: (env && env.KEY_PREFIX) || CFG.KEY_PREFIX,
    DOWNLOAD_URL: (env && env.DOWNLOAD_URL) || CFG.DOWNLOAD_URL,
    PUBLIC_MODE: b(env && env.PUBLIC_MODE, CFG.PUBLIC_MODE),
    ADMIN_IDS: (env && env.ADMIN_IDS) || CFG.ADMIN_IDS,
    ALLOW_IDS: (env && env.ALLOW_IDS) || CFG.ALLOW_IDS,
    NOTIFY_BOT_TOKEN: (env && env.NOTIFY_BOT_TOKEN) || CFG.NOTIFY_BOT_TOKEN,
    NOTIFY_CHAT_ID: (env && env.NOTIFY_CHAT_ID) || CFG.NOTIFY_CHAT_ID,
    NOTIFY_ENABLED: b(env && env.NOTIFY_ENABLED, CFG.NOTIFY_ENABLED),
    NOTIFY_ALSO_ADMINS: b(env && env.NOTIFY_ALSO_ADMINS, CFG.NOTIFY_ALSO_ADMINS),
    TZ: (env && env.TZ) || CFG.TZ
  };
}

/* ------------------------------- Response helpers ------------------------------- */
const ok  = (d)=>json({ok:true, ...d});
const bad = (c,m,extra)=>json({ok:false, error:m, ...(extra||{})}, c);
function json(o,code=200){
  return new Response(JSON.stringify(o),{
    status:code,
    headers:{
      "content-type":"application/json; charset=utf-8",
      // CORS: nếu chỉ dùng từ 1 domain, thay '*' bằng domain đó
      "access-control-allow-origin":"*",
      "access-control-allow-headers":"content-type,x-server-key",
      "access-control-allow-methods":"GET,POST,OPTIONS",
    }
  });
}
async function body(req){ try{ return await req.json(); }catch{ return {}; } }

function CSV(s){ return String(s||"").split(",").map(x=>x.trim()).filter(Boolean); }

/* ------------------------------- Time formatting ------------------------------- */
function fmtDate(ts, tz){
  return new Intl.DateTimeFormat("vi-VN",{
    timeZone: tz,
    year:"numeric", month:"2-digit", day:"2-digit",
    hour:"2-digit", minute:"2-digit", second:"2-digit"
  }).format(ts);
}

function fmtFileTime(ts, tz){
  const parts = new Intl.DateTimeFormat("vi-VN",{
    timeZone: tz,
    year:"numeric", month:"2-digit", day:"2-digit",
    hour:"2-digit", minute:"2-digit", second:"2-digit"
  }).formatToParts(ts);
  const get = (t) => parts.find(p => p.type === t)?.value || "00";
  return `${get("year")}${get("month")}${get("day")}-${get("hour")}${get("minute")}${get("second")}`;
}

/* ------------------------------- Device ID normalize/validate ------------------------------- */
function normDevId(s){ return String(s||"").trim().toUpperCase(); }
function isDevId(s){
  const v = normDevId(s);
  const UUID_ANY = /^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/;
  const IOS_UDID = /^[0-9A-F]{40}$/;
  const IOS_FINDER = /^[0-9A-F]{8}-[0-9A-F]{16}$/;
  const HEX_16 = /^[0-9A-F]{16}$/;
  const HEX_32 = /^[0-9A-F]{32}$/;
  return (
    UUID_ANY.test(v) ||
    IOS_UDID.test(v) ||
    IOS_FINDER.test(v) ||
    HEX_16.test(v) ||
    HEX_32.test(v)
  );
}

/* --------------------------- Admin & Allow list (KV) -------------------------------- */
function baseAdmins(cfg){ return CSV(cfg.ADMIN_IDS); }
function baseAllows(cfg){ return CSV(cfg.ALLOW_IDS); }

async function csvGet(env, key){
  const s = await env.KEYS.get(key);
  return s ? CSV(s) : [];
}
async function csvSet(env, key, arr){
  await env.KEYS.put(key, Array.from(new Set(arr)).join(","));
}
async function saveUserProfile(env, fromObj){
  if(!fromObj || !fromObj.id) return;
  const id = String(fromObj.id);
  const username = fromObj.username ? String(fromObj.username) : "";
  const first = fromObj.first_name ? String(fromObj.first_name) : "";
  const last = fromObj.last_name ? String(fromObj.last_name) : "";
  const name = (first + " " + last).trim() || first || username || "Unknown";
  const payload = {
    id,
    username,
    first_name: first,
    last_name: last,
    name,
    updatedAt: now()
  };
  try{
    await env.KEYS.put(`u:${id}`, JSON.stringify(payload));
  }catch{}
}

async function getUserProfile(env, id){
  try{
    const raw = await env.KEYS.get(`u:${id}`);
    return raw ? JSON.parse(raw) : null;
  }catch{
    return null;
  }
}

async function getAdmins(env){
  const cfg = envCfg(env);
  return Array.from(new Set([...baseAdmins(cfg), ...(await csvGet(env,"meta:admins"))]));
}
async function isAdmin(env,id){ return (await getAdmins(env)).includes(String(id)); }
async function addAdmin(env,id){
  id = String(id);
  const cfg = envCfg(env);
  const cur = await csvGet(env,"meta:admins");
  if(!cur.includes(id) && !baseAdmins(cfg).includes(id)){
    cur.push(id);
    await csvSet(env,"meta:admins",cur);
  }
}
async function removeAdmin(env,id){
  id = String(id);
  const cur = await csvGet(env,"meta:admins");
  const i = cur.indexOf(id);
  if(i>-1){ cur.splice(i,1); await csvSet(env,"meta:admins",cur); }
}

async function getAllows(env){
  const cfg = envCfg(env);
  return Array.from(new Set([
    ...baseAllows(cfg),
    ...(await csvGet(env,"meta:allow")),
    ...(await getAdmins(env)) // admin luôn allow
  ]));
}
async function isAllowed(env,id){
  const cfg = envCfg(env);
  if(cfg.PUBLIC_MODE) return true;
  return (await getAllows(env)).includes(String(id));
}
async function allowAdd(env,id){
  id = String(id);
  const cur = await csvGet(env,"meta:allow");
  if(!cur.includes(id)) { cur.push(id); await csvSet(env,"meta:allow",cur); }
}
async function allowDel(env,id){
  id = String(id);
  const cur = await csvGet(env,"meta:allow");
  const i = cur.indexOf(id);
  if(i>-1){ cur.splice(i,1); await csvSet(env,"meta:allow",cur); }
}

/* ------------------------- Duration / Datetime friendly parser --------------------- */
const PLAN_ALIAS = { "1d": 864e5, "7d": 7*864e5, "30d": 30*864e5, "life": null };
function parseDuration(expr){
  if(!expr) throw new Error("Thiếu thời lượng");
  let s = String(expr).trim().toLowerCase();
  s = s
    .replace(/lifetime|vĩnh\s*viễn|vinh\s*vien/g, "life")
    .replace(/ngày|ngay/g, "d")
    .replace(/tuần|tuan/g, "w")
    .replace(/tháng|thang/g, "mo")
    .replace(/giờ|gio|g/g, "h")
    .replace(/phút|phut|ph|p/g, "m")
    .replace(/giây|giay/g, "s");
  if (s == "life") return null;
  if (Object.prototype.hasOwnProperty.call(PLAN_ALIAS, s)) return PLAN_ALIAS[s];
  if (/^\d+$/.test(s)) return Number(s) * 864e5;

  const R = /(\d+)\s*(y|mo|w|d|h|m|s|ms)/g; let ms=0, m;
  while ((m = R.exec(s))) ms += ({y:365*864e5, mo:30*864e5, w:7*864e5, d:864e5, h:36e5, m:6e4, s:1e3, ms:1}[m[2]] * Number(m[1]));
  if (ms <= 0) throw new Error("Thời lượng không hợp lệ (vd: 1d, 12h, 90m, 1d12h30m, life)");
  return ms;
}
function parseUntil(text){
  const t = (text||"").trim().replace("T"," ");
  const m = t.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2})(?::(\d{2})(?::(\d{2}))?)?)?$/);
  if(!m) throw new Error("Sai định dạng thời điểm (vd: 2026-12-31 23:59)");
  const [ , Y, M, D, h="00", mi="00", s="00" ] = m;
  return new Date(Number(Y), Number(M)-1, Number(D), Number(h), Number(mi), Number(s)).getTime();
}


/* ----------------------------------- Storage (KV) ---------------------------------- */
const kvKey = k => `k:${k}`;
async function kvGet(env,k){ const s = await env.KEYS.get(kvKey(k)); return s ? JSON.parse(s) : null; }
async function kvPut(env,row){ await env.KEYS.put(kvKey(row.k), JSON.stringify(row)); }
async function kvDel(env,k){ await env.KEYS.delete(kvKey(k)); }
async function kvList(env, limit=200){
  const out=[]; let cursor=undefined;
  do{
    const r = await env.KEYS.list({ prefix:"k:", limit:1000, cursor });
    out.push(...(r.keys||[]).map(x=>x.name.replace(/^k:/,"")));
    cursor = r.list_complete ? undefined : r.cursor;
  }while(cursor && out.length<limit);
  return out.slice(0,limit);
}

/* ----------------------------------- Rate limiting (KV) ---------------------------------- */
function getIP(req){
  return req.headers.get("cf-connecting-ip")
    || req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || "0.0.0.0";
}
async function rateLimit(env, req, bucketKey, limitPerMin){
  const ip = getIP(req);
  const minute = Math.floor(Date.now()/60000);
  const key = `rl:${bucketKey}:${ip}:${minute}`;
  const cur = Number(await env.KEYS.get(key) || "0");
  if(cur >= limitPerMin) return false;
  await env.KEYS.put(key, String(cur+1), { expirationTtl: 120 });
  return true;
}

/* ----------------------------------- Core logic ------------------------------------ */
function genKey(prefix){
  const A = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const buf = new Uint32Array(24);
  crypto.getRandomValues(buf);
  const s = Array.from(buf, x => A[x % A.length]).join("");
  return `${prefix}-${s.slice(0,8)}-${s.slice(8,16)}-${s.slice(16,24)}`;
}

function view(row){
  return row && ({
    key: row.k,
    plan: row.plan,
    issuedAt: row.t0,
    expiresAt: row.exp ?? null,
    durationMs: row.dur ?? null,
    revoked: !!row.rev,
    activatedAt: row.tA ?? null,
    deviceId: row.did ?? null,
    note: row.note ?? null,
    remainingSeconds: row.exp==null ? null : Math.max(0, Math.floor((row.exp-now())/1000)),
  });
}

async function createKeys(env, cfg, {durationMs=null, untilTs=null, quantity=1, note="", planLabel="", bindDeviceId=null}){
  const n = Math.max(1, Math.min(CFG.MAX_QTY, Number(quantity)||1));
  const out=[];
  for(let i=0;i<n;i++){
    const k = genKey(cfg.KEY_PREFIX), t0 = now();
    const exp = (untilTs!=null) ? untilTs : null;
    const dur = (untilTs!=null) ? null : (durationMs==null ? null : durationMs);
    const label = planLabel || (untilTs!=null ? "until" : (durationMs==null?"life":"custom"));
    const row = {
      k, plan: label, t0, exp, dur, rev:0,
      tA:null,
      did: bindDeviceId || null, // gắn cùng UUID nếu có
      note: note||null
    };
    await kvPut(env,row);
    out.push({ key:k, plan:label, issuedAt:t0, expiresAt:exp, deviceId: row.did });
  }
  return out;
}

function extendExpiry(row, durationMs){
  // Gia hạn cộng thêm, nếu đã hết hạn thì tính từ now
  if(durationMs == null){ row.exp = null; row.plan = "life"; return; }
  const base = (row.exp && row.exp > now()) ? row.exp : now();
  row.exp = base + Math.max(0, durationMs);
  row.plan = "custom";
}

/* -------------------------------- Telegram helpers --------------------------------- */
function canonicalCmd(text){
  if(!text) return "";
  const i = text.indexOf("/");
  return (i>=0) ? text.slice(i).trim() : text.trim();
}

async function tgsend(env, chatId, html, keyboard, opts){
  const cfg = envCfg(env);
  if(!cfg.TG_TOKEN) throw new Error("Missing TG_TOKEN");
  const out = html;
  const u = `https://api.telegram.org/bot${cfg.TG_TOKEN}/sendMessage`;
  const body = {
    chat_id:chatId,
    text:out,
    parse_mode:"HTML",
    disable_web_page_preview:true
  };
  if (keyboard) body.reply_markup = keyboard;
  await fetch(u,{
    method:"POST",
    headers:{ "content-type":"application/json" },
    body:JSON.stringify(body)
  });
}
async function tgCall(token, method, payload){
  const t = token || "";
  if(!t) throw new Error("Missing TG_TOKEN");
  const u = `https://api.telegram.org/bot${t}/${method}`;
  await fetch(u,{
    method:"POST",
    headers:{ "content-type":"application/json" },
    body:JSON.stringify(payload)
  });
}

async function tgSendMessage(token, chatId, html, keyboard){
  const body = {
    chat_id:chatId,
    text:html,
    parse_mode:"HTML",
    disable_web_page_preview:true
  };
  if (keyboard) body.reply_markup = keyboard;
  await tgCall(token, "sendMessage", body);
}

async function tgDeleteMessage(token, chatId, messageId){
  const body = { chat_id:chatId, message_id:messageId };
  await tgCall(token, "deleteMessage", body);
}

async function tgDelete(env, chatId, messageId){
  const cfg = envCfg(env);
  if(!cfg.TG_TOKEN) throw new Error("Missing TG_TOKEN");
  const u = `https://api.telegram.org/bot${cfg.TG_TOKEN}/deleteMessage`;
  const body = { chat_id:chatId, message_id:messageId };
  await fetch(u,{
    method:"POST",
    headers:{ "content-type":"application/json" },
    body:JSON.stringify(body)
  });
}

async function tgSendDocument(env, chatId, filename, textContent, captionHtml){
  const cfg = envCfg(env);
  if(!cfg.TG_TOKEN) throw new Error("Missing TG_TOKEN");
  const u = `https://api.telegram.org/bot${cfg.TG_TOKEN}/sendDocument`;
  const form = new FormData();
  form.append("chat_id", String(chatId));
  if(captionHtml){
    form.append("caption", captionHtml);
    form.append("parse_mode", "HTML");
  }
  form.append("document", new Blob([textContent], { type: "text/plain" }), filename);
  await fetch(u, { method:"POST", body: form });
}

function escapeHTML(s){
  return String(s||"").replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[c]));
}

function msgHeader(cfg, title){
  return `<b>🟣 ${escapeHTML(cfg.BRAND)} • ${escapeHTML(title)}</b>\n`;
}

function line(label, value){
  return `• ${escapeHTML(label)}: ${value}`;
}

function header(cfg, title){
  return msgHeader(cfg, title);
}

function bullet(label, value){
  return line(label, value);
}

function note(text){
  return `<i>${escapeHTML(text)}</i>`;
}

function err(text){
  return `⛔ ${escapeHTML(text)}`;
}
function fmtKey(k){
  return `<code>${escapeHTML(k)}</code>`;
}

function maskDevId(id, mode){
  if(!id) return "";
  const v = String(id);
  if(mode === "admin") return v;
  if(v.length <= 8) return v;
  return `${v.slice(0,4)}…${v.slice(-4)}`;
}

function fmtUuid(id, mode){
  return `<code>${escapeHTML(maskDevId(id, mode))}</code>`;
}

function renderBindLine(deviceId, mode){
  if(!deviceId) return `• Thiết bị: <code>Chưa gắn thiết bị</code>`;
  return `• Thiết bị: ${fmtUuid(deviceId, mode)}`;
}

function fmtTime(ts, cfg){
  return `<code>${escapeHTML(ts ? fmtDate(ts, cfg.TZ) : "-")}</code>`;
}

function head(cfg, title){
  return msgHeader(cfg, title);
}

function box(text){
  return `<blockquote>${text}</blockquote>`;
}

function buildNewHeader(cfg, planText, qty, expSample, note){
  let h = header(cfg, "TẠO KEY MỚI");
  h += [
    bullet("Gói", `<code>${escapeHTML(planText)}</code>`),
    bullet("Số lượng", `<b>${qty}</b>`),
    bullet("Hết hạn mẫu", `<code>${escapeHTML(expSample)}</code>`)
  ].join("\n");
  if(note) h += `\n${bullet("Ghi chú", `<code>${escapeHTML(note)}</code>`)}`;
  return h;
}


function chunkKeyMessages(header, keys, maxLen=4096){
  const open = "<pre><code>";
  const close = "</code></pre>";
  const lines = keys.map(k => escapeHTML(k));
  const chunks = [];
  let buf = [];
  let bufLen = 0;
  const baseLen = header.length + 1 + open.length + close.length;

  for (const line of lines){
    const extra = (buf.length ? 1 : 0) + line.length;
    if (baseLen + bufLen + extra > maxLen) {
      if (buf.length) {
        chunks.push(`${header}\n${open}${buf.join("\n")}${close}`);
        buf = [];
        bufLen = 0;
      }
    }
    buf.push(line);
    bufLen += (buf.length > 1 ? 1 : 0) + line.length;
  }
  if (buf.length) chunks.push(`${header}\n${open}${buf.join("\n")}${close}`);
  return chunks;
}

function chunkText4096(html, maxLen=4096){
  const lines = String(html || "").split("\n");
  const chunks = [];
  let buf = "";
  for (const line of lines){
    const next = buf ? `${buf}\n${line}` : line;
    if (next.length > maxLen){
      if (buf) chunks.push(buf);
      buf = line;
    } else {
      buf = next;
    }
  }
  if (buf) chunks.push(buf);
  return chunks;
}

async function sendLong(env, chatId, htmlParts, keyboard, opts){
  for (const part of htmlParts){
    await tgsend(env, chatId, part, keyboard, opts);
  }
}

async function notifyTargets(env, cfg, payload){
  if(!cfg.NOTIFY_CHAT_ID) return;
  const tokenNotify = cfg.NOTIFY_BOT_TOKEN || cfg.TG_TOKEN;
  const timeText = fmtDate(payload.time || now(), cfg.TZ);
  const expText = payload.expiresAt
    ? fmtDate(payload.expiresAt, cfg.TZ)
    : (payload.durationMs ? "Chưa kích hoạt" : "Vĩnh viễn");
  const statusText = payload.status || "Đã gắn thiết bị";
  let msg = header(cfg, "THÔNG BÁO KÍCH HOẠT") + [
    bullet("Trạng thái", `✅ ${escapeHTML(statusText)}`),
    bullet("Key", fmtKey(payload.key)),
    bullet("Thiết bị", fmtUuid(payload.uuid, "admin")),
    bullet("Hết hạn", `<code>${escapeHTML(expText)}</code>`),
    bullet("Thời gian", `<code>${escapeHTML(timeText)}</code>`)
  ].join("\n");
  if(payload.serial) msg += `\n${bullet("Serial", `<code>${escapeHTML(payload.serial)}</code>`)}`;
  if(payload.imei) msg += `\n${bullet("IMEI", `<code>${escapeHTML(payload.imei)}</code>`)}`;
  try{ await tgSendMessage(tokenNotify, cfg.NOTIFY_CHAT_ID, msg); }catch{}
}

function H(cfg){
  return {
    head:(t)=>header(cfg, t),
    yes:(b)=> b ? "✅" : "❌"
  };
}


function infoLines(cfg, d, mode="user"){
  const expText = d.expiresAt
    ? fmtDate(d.expiresAt, cfg.TZ)
    : (d.durationMs != null && !d.activatedAt ? "Chưa kích hoạt" : "Vĩnh viễn");
  const expHint = (d.durationMs != null && !d.activatedAt)
    ? "Hạn sẽ tính từ lúc kích hoạt"
    : null;
  const remainingText = (d.durationMs != null && !d.activatedAt)
    ? "Chưa kích hoạt"
    : (d.remainingSeconds==null ? "∞" : (d.remainingSeconds + " giây"));
  return [
    bullet("Key", fmtKey(d.key)),
    bullet("Gói", `<code>${escapeHTML(d.plan)}</code>`),
    bullet("Phát hành", fmtTime(d.issuedAt, cfg)),
    bullet("Hết hạn", `<code>${escapeHTML(expText)}</code>`),
    ...(expHint ? [bullet("Ghi chú", `<code>${escapeHTML(expHint)}</code>`)] : []),
    bullet("Còn lại", `<code>${escapeHTML(remainingText)}</code>`),
    renderBindLine(d.deviceId, mode),
    bullet("Đã thu hồi", `<code>${H(cfg).yes(d.revoked)}</code>`)
  ].join("\n");
}

function fmtInfo(cfg, d, mode="user"){
  return `${header(cfg, "TÌNH TRẠNG KEY")}${infoLines(cfg, d, mode)}`;
}


const kbHelpOnly = { keyboard: [[{text:"📘 /help"}]], resize_keyboard:true, one_time_keyboard:false };
const kbDownloadInline = (cfg)=>({ inline_keyboard: [[{text:"⬇️ Tải dylib", url: cfg.DOWNLOAD_URL}]] });

function helpUser(cfg){
return `${header(cfg, "HƯỚNG DẪN (Người dùng)")}
${bullet("Lệnh", "<code>/start</code>, <code>/help</code>")}
${bullet("ID Telegram", "<code>/whoami</code>")}
${bullet("Kiểm tra key", "<code>/verify &lt;KEY&gt;</code>")}
${bullet("Tình trạng key", "<code>/check &lt;KEY&gt;</code>")}
${bullet("Tải dylib", "<code>/download</code> (khi đã được cấp quyền)")}

<i>⏱ Thời gian theo giờ VN (UTC+7).</i>`;
}

function helpPower(cfg){
return `${header(cfg, "TẠO / GIA HẠN")}
${bullet("Tạo key", "<code>/new &lt;dur|life&gt; [qty] [note]</code>")}
${bullet("Tạo theo ngày", "<code>/newuntil &lt;YYYY-MM-DD[ HH:mm]&gt; [qty] [note]</code>")}
${bullet("Tạo + gắn UUID", "<code>/newuuid &lt;UUID&gt; &lt;dur|life&gt; [qty] [note]</code>")}
${bullet("Gia hạn", "<code>/extend &lt;KEY&gt; &lt;dur|life&gt;</code>")}

${header(cfg, "TRA CỨU")}
${bullet("Thông tin", "<code>/info &lt;KEY&gt;</code>")}
${bullet("Thiết bị giữ key", "<code>/who &lt;KEY&gt;</code>")}
${bullet("Thu hồi", "<code>/revoke &lt;KEY&gt;</code>")}`;
}

function helpAdmin(cfg){
return `${header(cfg, "ỦY QUYỀN (Admin)")}
${bullet("Thêm admin", "<code>/op [chatId]</code>")}
${bullet("Gỡ admin", "<code>/deop &lt;chatId&gt;</code>")}
${bullet("Danh sách admin", "<code>/admins</code>")}
${bullet("Cấp quyền", "<code>/allow &lt;chatId&gt;</code>")}
${bullet("Thu quyền", "<code>/deny &lt;chatId&gt;</code>")}
${bullet("Danh sách quyền", "<code>/allowlist</code>")}
${bullet("Gỡ UUID", "<code>/unbind &lt;KEY&gt;</code>")}

<i>🧩 App sẽ yêu cầu thiết bị trùng khớp mới verify/activate được.</i>`;
}
async function needArgs(env, chatId, usage, example){
  const msg = header(envCfg(env), "THIẾU THAM SỐ") +
    bullet("Cú pháp", `<code>${escapeHTML(usage)}</code>`) +
    (example ? `\n${bullet("Ví dụ", `<code>${escapeHTML(example)}</code>`)}` : "") +
    `\n\n<i>Gõ <code>/help</code> để xem hướng dẫn.</i>`;
  return tgsend(env, chatId, msg, kbHelpOnly);
}
async function denyPerm(env, chatId, who, cmd){
  const msg = header(envCfg(env), "KHÔNG ĐỦ QUYỀN") +
    bullet("Bạn là", `<b>${escapeHTML(who)}</b>`) +
    `\n${bullet("Lệnh", `<code>${escapeHTML(cmd)}</code> (chỉ dành cho <b>Admin</b>)`)}`;
  return tgsend(env, chatId, msg, kbHelpOnly);
}


/* ------------------------------------- HTTP API ----------------------------------- */
function needAdminPath(p){
  return [
    "/api/keys", "/api/revoke", "/api/extend", "/api/unbind", "/api/keys/"
  ].some(x => p === x || p.startsWith(x));
}

async function handleAPI(req, env){
  const cfg = envCfg(env);
  const url = new URL(req.url);

  if(req.method==="OPTIONS") return ok({});

  // rate limit for /api/*
  if(url.pathname === "/api/verify"){
    if(!await rateLimit(env, req, "verify", CFG.RL_VERIFY_PER_MIN)) return bad(429,"RATE_LIMIT");
  } else if(url.pathname === "/api/activate"){
    if(!await rateLimit(env, req, "activate", CFG.RL_ACTIVATE_PER_MIN)) return bad(429,"RATE_LIMIT");
  } else if(url.pathname.startsWith("/api/")){
    if(!await rateLimit(env, req, "api", CFG.RL_OTHER_PER_MIN)) return bad(429,"RATE_LIMIT");
  }

  if(url.pathname==="/api/health"){
    return ok({t:Date.now(), store:"KV", brand:cfg.BRAND, tz:cfg.TZ});
  }

  // admin check
  if(needAdminPath(url.pathname)){
    const k = req.headers.get("x-server-key");
    if(!k || !cfg.ADMIN_KEY || k !== cfg.ADMIN_KEY) return bad(401,"UNAUTHORIZED");
  }

  // Create keys (admin)
  if(url.pathname==="/api/keys" && req.method==="POST"){
    try{
      const {duration, quantity=1, note="", until, deviceId} = await body(req);
      let expMs=null, untilTs=null, label="";

      if(until){
        untilTs = parseUntil(until);
        label="until";
      }else{
        if(!duration) throw new Error("duration hoặc until bắt buộc");
        const d = parseDuration(duration);
        expMs = d;
        label = (d==null?"life":"custom");
      }

      let did = null;
      if(deviceId){
        did = normDevId(deviceId);
        if(!isDevId(did)) throw new Error("deviceId phải là UUID hợp lệ");
      }

      const keys = await createKeys(env, cfg, {durationMs:expMs, untilTs, quantity, note, planLabel:label, bindDeviceId:did});
      return ok({keys});
    }catch(e){ return bad(400, String(e.message||e)); }
  }

  // Get key info (admin)
  if(url.pathname.startsWith("/api/keys/") && req.method==="GET"){
    const key = decodeURIComponent(url.pathname.split("/").pop()||"").trim();
    const row = await kvGet(env,key);
    if(!row) return bad(404,"NOT_FOUND");
    return ok({data:view(row)});
  }

  // Revoke (admin)
  if(url.pathname==="/api/revoke" && req.method==="POST"){
    const {key} = await body(req);
    if(!key) return bad(400,"key required");
    const row = await kvGet(env,key);
    if(!row) return bad(404,"NOT_FOUND");
    row.rev=1; await kvPut(env,row);
    return ok({data:view(row)});
  }

  // Extend (admin) - gia hạn cộng thêm
  if(url.pathname==="/api/extend" && req.method==="POST"){
    try{
      const {key, duration} = await body(req);
      if(!key) return bad(400,"key required");
      const row = await kvGet(env,key);
      if(!row) return bad(404,"NOT_FOUND");

      if(!duration) return bad(400,"duration required");
      const d = parseDuration(duration);
      extendExpiry(row, d);
      await kvPut(env,row);
      return ok({data:view(row)});
    }catch(e){
      return bad(400, String(e.message||e));
    }
  }

  // Unbind (admin)
  if(url.pathname==="/api/unbind" && req.method==="POST"){
    const {key} = await body(req);
    if(!key) return bad(400,"key required");
    const row = await kvGet(env,key);
    if(!row) return bad(404,"NOT_FOUND");
    row.did=null; row.tA=null;
    await kvPut(env,row);
    return ok({data:view(row)});
  }

  // Activate (public) - STRICT UUID
  if(url.pathname==="/api/activate" && req.method==="POST"){
    const {key, deviceId, serial, imei} = await body(req);
    if(!key) return bad(400,"key required");
    if(!deviceId) return bad(400,"deviceId required");

    const reqDid = normDevId(deviceId);
    if(!isDevId(reqDid)) return bad(400,"INVALID_DEVICE_ID");

    const row = await kvGet(env,key);
    if(!row) return bad(404,"NOT_FOUND");
    if(row.rev) return bad(403,"REVOKED");
    if(row.exp && now()>row.exp) return bad(403,"EXPIRED");

    if(!row.did){
      row.did = reqDid;
    }
    if(row.did !== reqDid) return bad(403,"BOUND_TO_ANOTHER_DEVICE",{deviceId:row.did});

    const firstActivate = !row.tA;
    if(!row.tA) row.tA = now();
    if(row.exp == null && row.dur != null){
      row.exp = row.tA + row.dur;
    }
    await kvPut(env,row);
    if(firstActivate){
      await notifyTargets(env, cfg, { key: row.k, uuid: reqDid, serial, imei, time: row.tA, expiresAt: row.exp, durationMs: row.dur, status: "Đã kích hoạt" });
    }
    return ok({data:view(row)});
  }

  // Verify (public) - STRICT UUID
  if(url.pathname==="/api/verify" && req.method==="POST"){
    const {key, deviceId, claim, serial, imei} = await body(req);
    if(!key) return bad(400,"key required");
    if(!deviceId) return bad(400,"deviceId required");

    const reqDid = normDevId(deviceId);
    if(!isDevId(reqDid)) return bad(400,"INVALID_DEVICE_ID");

    const row = await kvGet(env,key);
    if(!row) return bad(404,"NOT_FOUND");
    if(row.rev) return bad(403,"REVOKED",{data:view(row)});
    if(row.exp && now()>row.exp) return bad(403,"EXPIRED",{data:view(row)});

    if(!row.did){
      if(claim === true){
        row.did = reqDid;
        await kvPut(env,row);
        await notifyTargets(env, cfg, { key: row.k, uuid: reqDid, serial, imei, time: now(), expiresAt: row.exp, durationMs: row.dur, status: "Đã gắn thiết bị" });
        return ok({data:view(row)});
      }
      return bad(403,"DEVICE_NOT_BOUND",{data:view(row)});
    }
    if(row.did !== reqDid) return bad(403,"BOUND_TO_ANOTHER_DEVICE",{data:view(row), deviceId:row.did});

    return ok({data:view(row)});
  }

  return bad(404,"NO_ROUTE");
}

/* ---------------------------------- Telegram Bot ----------------------------------- */
async function handleBot(req, env){
  const cfg = envCfg(env);
  const upd = await req.json().catch(()=>null);
  if(!upd) return new Response("OK");

  const msg    = upd.message || upd.channel_post;
  if(!msg) return new Response("OK");
  const chat   = msg.chat || {};
  const from   = msg.from || {};
  const chatId = chat.id;
  const fromId = String(from.id);

  const textRaw = typeof msg.text === "string" ? msg.text.trim() : "";
  const cmdIndex = textRaw ? textRaw.indexOf("/") : -1;
  const isCommand = cmdIndex >= 0;
  if(msg.message_id && (!textRaw || !isCommand)){
    await tgDelete(env, chatId, msg.message_id).catch(()=>{});
    return new Response("OK");
  }

  const isNotifyChat = !!cfg.NOTIFY_ENABLED && cfg.NOTIFY_CHAT_ID && String(chatId) === String(cfg.NOTIFY_CHAT_ID);
  if (isNotifyChat && textRaw && !textRaw.startsWith("/") && !(from && from.is_bot)) {
    const senderParts = [];
    if (from && from.username) senderParts.push("@" + String(from.username));
    const fullName = [from && from.first_name, from && from.last_name].filter(Boolean).join(" ");
    if (fullName) senderParts.push(fullName);
    const sender = senderParts.join(" — ") || msg.author_signature || "Ẩn danh";
    const notice = header(cfg, "THÔNG BÁO") +
      bullet("Người gửi", `<code>${escapeHTML(sender)}</code>`) +
      `\n<blockquote>${escapeHTML(textRaw)}</blockquote>`;
    const tokenNotify = cfg.NOTIFY_BOT_TOKEN || cfg.TG_TOKEN;
    try{ await tgSendMessage(tokenNotify, chatId, notice); }catch{}
    try{ await tgDeleteMessage(tokenNotify, chatId, msg.message_id); }catch{}
    return new Response("OK");
  }

  await saveUserProfile(env, from);
  const text   = canonicalCmd((msg.text||"").trim());
  const fromIdSafe = escapeHTML(fromId);
  const chatIdSafe = escapeHTML(String(chatId));
  const brandSafe = escapeHTML(cfg.BRAND);

  const admin   = await isAdmin(env, fromId);
  const allowed = await isAllowed(env, fromId);

  // Người CHƯA allow: chỉ /start /help /whoami
  if(!allowed && !/^\/(start|help|whoami)\b/i.test(text)){
    const msg = header(cfg, "BỊ HẠN CHẾ") +
      bullet("Trạng thái", "🔒 Chưa được cấp quyền") +
      `\n${bullet("ID của bạn", `<code>${fromIdSafe}</code>`)}` +
      `\n\n<i>Liên hệ admin để được cấp quyền.</i>`;
    await tgsend(env, chatId, msg, kbHelpOnly);
    return new Response("OK");
  }

  // /download
  if(/^\/download$/i.test(text)){
    const msg = header(cfg, "TẢI VỀ") + bullet("Tải xuống", "Nhấn nút bên dưới để tải dylib.");
    await tgsend(env, chatId, msg, kbDownloadInline(cfg));
    return new Response("OK");
  }

  // /whoami
  if(/^\/whoami$/i.test(text)){
    const msg = header(cfg, "THÔNG TIN NGƯỜI DÙNG") +
      bullet("Sender", `<code>${fromIdSafe}</code>`) +
      `\n${bullet("Chat", `<code>${chatIdSafe}</code>`)}` +
      `\n${bullet("Quyền", admin ? "✅ Admin" : (allowed ? "✅ Đã cấp quyền" : "❌ Chưa cấp quyền"))}`;
    await tgsend(env, chatId, msg, kbHelpOnly);
    return new Response("OK");
  }

  // Help
  if(/^\/(start|help)$/i.test(text)){
    let html = "";
    if(!allowed){
      html = `${helpUser(cfg)}\n\n<i>ℹ️ Gửi ID của bạn cho admin để được cấp quyền.</i>`;
      await tgsend(env, chatId, html, kbHelpOnly);
    }else if(admin){
      html = `${helpUser(cfg)}\n\n${helpPower(cfg)}\n\n${helpAdmin(cfg)}`;
      await tgsend(env, chatId, html, kbHelpOnly);
      await tgsend(env, chatId, header(cfg, "TẢI VỀ") + bullet("Tải xuống", "Nhấn nút bên dưới để tải dylib."), kbDownloadInline(cfg));
    }else{
      html = `${helpUser(cfg)}\n\n${helpPower(cfg)}`;
      await tgsend(env, chatId, html, kbHelpOnly);
      await tgsend(env, chatId, header(cfg, "TẢI VỀ") + bullet("Tải xuống", "Nhấn nút bên dưới để tải dylib."), kbDownloadInline(cfg));
    }
    return new Response("OK");
  }

  // Admin-only commands
  if(/^\/(op|deop|allow|deny|allowlist|admins|unbind)\b/i.test(text)){
    if(!admin){
      const who = allowed ? "User đã được allow" : "User chưa allow";
      await denyPerm(env, chatId, who, text.split(/\s+/)[0]);
      return new Response("OK");
    }
  }

  // /op
  const opMatch = text.match(/^\/op(?:\s+(-?\d+))?$/i);
  if(opMatch){
    const id = opMatch[1] ? opMatch[1] : String(fromId);
    await addAdmin(env, id);
    await allowAdd(env, id);
    await tgsend(env, chatId, header(cfg, "THÀNH CÔNG") + bullet("Đã thêm admin", `<code>${escapeHTML(id)}</code>`), kbHelpOnly);
    return new Response("OK");
  }

  // /deop
  const deopMatch = text.match(/^\/deop\s+(-?\d+)$/i);
  if(deopMatch){
    const id = deopMatch[1];
    await removeAdmin(env, id);
    await tgsend(env, chatId, header(cfg, "THÀNH CÔNG") + bullet("Đã gỡ admin", `<code>${escapeHTML(id)}</code>`), kbHelpOnly);
    return new Response("OK");
  }

  // /allow
  const allowMatch = text.match(/^\/allow\s+(-?\d+)$/i);
  if(allowMatch){
    const id = allowMatch[1];
    await allowAdd(env, id);
    await tgsend(env, chatId, header(cfg, "THÀNH CÔNG") + bullet("Đã cấp quyền", `<code>${escapeHTML(id)}</code>`), kbHelpOnly);
    return new Response("OK");
  }

  // /deny
  const denyMatch = text.match(/^\/deny\s+(-?\d+)$/i);
  if(denyMatch){
    const id = denyMatch[1];
    await allowDel(env, id);
    await tgsend(env, chatId, header(cfg, "THÀNH CÔNG") + bullet("Đã thu quyền", `<code>${escapeHTML(id)}</code>`), kbHelpOnly);
    return new Response("OK");
  }

  // /admins
  if(/^\/admins$/i.test(text)){
    const list = await getAdmins(env);
    const lines = [];
    let idx = 1;
    for (const id of list) {
      const profile = await getUserProfile(env, id);
      const nameText = profile && profile.name ? `<b>${escapeHTML(profile.name)}</b>` : "(chưa có thông tin, user chưa nhắn bot)";
      const userText = profile && profile.username ? `<code>@${escapeHTML(profile.username)}</code>` : "(chưa có thông tin, user chưa nhắn bot)";
      lines.push(`• <code>${escapeHTML(String(id))}</code> — ${nameText} — ${userText}`);
      idx++;
    }
    const body = lines.length ? "\n" + lines.join("\n") : "\n• (trống)";
    const parts = chunkText4096(header(cfg, "DANH SACH ADMIN") + body);
    for (const part of parts) {
      await tgsend(env, chatId, part, kbHelpOnly);
    }
    return new Response("OK");
  }
  // /allowlist
  if(/^\/allowlist$/i.test(text)){
    const list = await getAllows(env);
    const headerText = header(cfg, "DANH SACH QUYEN") + bullet("Tổng số", `<b>${list.length}</b>`);
    const lines = [];
    let idx = 1;
    for (const id of list) {
      const profile = await getUserProfile(env, id);
      if(profile){
        const uname = profile.username ? "@" + escapeHTML(profile.username) : "";
        const name = profile.name ? escapeHTML(profile.name) : "";
        const meta = [];
        if(uname) meta.push(uname);
        if(name) meta.push(name);
        const tail = meta.length ? meta.join(" — ") : "(chưa có thông tin, user chưa nhắn bot)";
        lines.push(`${idx}) <code>${escapeHTML(String(id))}</code> — ${tail}`);
      }else{
        lines.push(`${idx}) <code>${escapeHTML(String(id))}</code> — (chưa có thông tin, user chưa nhắn bot)`);
      }
      idx++;
    }
    const body = lines.length ? "\n" + lines.join("\n") : "\n(trống)";
    const parts = chunkText4096(headerText + body);
    for (const part of parts) {
      await tgsend(env, chatId, part, kbHelpOnly);
    }
    return new Response("OK");
  }

  // /unbind <KEY>
  if(/^\/unbind\b/i.test(text)){
    const parts = text.split(/\s+/);
    if(parts.length<2){
      await needArgs(env, chatId, "/unbind <KEY>", "/unbind VSHTECH-....");
      return new Response("OK");
    }
    const key = parts[1];
    const row = await kvGet(env,key);
    if(!row){
      await tgsend(env, chatId, header(cfg, "LỖI") + bullet("Kết quả", "⛔ Không tìm thấy key."), kbHelpOnly);
      return new Response("OK");
    }
    row.did=null; row.tA=null;
    await kvPut(env,row);
    await tgsend(env, chatId, header(cfg, "THÀNH CÔNG") + bullet("Đã gỡ UUID cho key", fmtKey(key)), kbHelpOnly);
    return new Response("OK");
  }

  // /verify <KEY> (bot-side check - chỉ xem trạng thái KV)
  if(/^\/verify\b/i.test(text)){
    const parts = text.split(/\s+/);
    if(parts.length<2){
      await needArgs(env, chatId, "/verify <KEY>", "/verify VSHTECH-....");
      return new Response("OK");
    }
    const key = parts[1];
    const row = await kvGet(env,key);
    if(!row){
      await tgsend(env, chatId, header(cfg, "LỖI") + bullet("Kết quả", "⛔ Không tìm thấy key."), kbHelpOnly);
      return new Response("OK");
    }
    const d = view(row);
    const mode = admin ? "admin" : "user";
    if(row.rev){
      await tgsend(env, chatId, `${header(cfg, "KEY BỊ THU HỒI")}${infoLines(cfg, d, mode)}`, kbHelpOnly);
      return new Response("OK");
    }
    if(row.exp && now()>row.exp){
      await tgsend(env, chatId, `${header(cfg, "KEY HẾT HẠN")}${infoLines(cfg, d, mode)}`, kbHelpOnly);
      return new Response("OK");
    }
    await tgsend(env, chatId, `${header(cfg, "KEY HỢP LỆ")}${infoLines(cfg, d, mode)}`, kbHelpOnly);
    return new Response("OK");
  }

  // /check <KEY>
  if(/^\/check\b/i.test(text)){
    const parts = text.split(/\s+/);
    if(parts.length<2){
      await needArgs(env, chatId, "/check <KEY>", "/check VSHTECH-....");
      return new Response("OK");
    }
    const key = parts[1];
    const row = await kvGet(env,key);
    if(!row){
      await tgsend(env, chatId, header(cfg, "LỖI") + bullet("Kết quả", "⛔ Không tìm thấy key."), kbHelpOnly);
      return new Response("OK");
    }
    const d = view(row);
    const mode = admin ? "admin" : "user";
    const expText = d.expiresAt
      ? fmtDate(d.expiresAt, cfg.TZ)
      : (d.durationMs != null && !d.activatedAt ? "Chưa kích hoạt" : "Vĩnh viễn");
    const expHint = (d.durationMs != null && !d.activatedAt)
      ? "Hạn sẽ tính từ lúc kích hoạt"
      : null;
    const msg = header(cfg, "TRẠNG THÁI KEY") + [
      bullet("Key", fmtKey(d.key)),
      renderBindLine(d.deviceId, mode),
      bullet("Hết hạn", `<code>${escapeHTML(expText)}</code>`),
      ...(expHint ? [bullet("Ghi chú", `<code>${escapeHTML(expHint)}</code>`)] : []),
      bullet("Thu hồi", `<code>${H(cfg).yes(!!d.revoked)}</code>`)
    ].join("\n");
    await tgsend(env, chatId, msg, kbHelpOnly);
    return new Response("OK");
  }

  // /new <dur|life> <qty> [note]
  if(/^\/new\b/i.test(text)){
    const m = text.match(/^\/new\s+(\S+)(?:\s+(\d+))?(?:\s+([\s\S]+))?$/i);
    if(!m){
      await needArgs(env, chatId, "/new <dur|life> <qty> [note]", "/new 1d 50 VIP");
      return new Response("OK");
    }
    const durStr = (m[1] || "").toLowerCase();
    const qtyRaw = Number(m[2] || 1);
    const qty = Math.max(1, Math.min(CFG.MAX_QTY, qtyRaw));
    const note = (m[3] || "").trim().slice(0, 200);

    try{
      const d = parseDuration(durStr);
      const keys = await createKeys(env, cfg, {durationMs:d, quantity:qty, note, planLabel: d==null?"life":"custom", bindDeviceId:null});
      if(qty > 20){
        const stamp = fmtFileTime(now(), cfg.TZ);
        const fileName = `vsh_keys_${durStr}_${qty}_${stamp}.txt`;
        const content = keys.map((o,i)=>`KEY ${i+1} | ${o.key}`).join("\n");
        let caption = header(cfg, "TẠO KEY MỚI") +
          bullet("Kết quả", "✅ Đã tạo file key. Tải file bên dưới.") +
          `\n${bullet("Số lượng", `<b>${qty}</b>`)}` +
          `\n${bullet("Gói", `<code>${escapeHTML(d==null ? "vĩnh viễn" : durStr)}</code>`)}`;
        if(note) caption += `\n${bullet("Ghi chú", `<code>${escapeHTML(note)}</code>`)}`;
        await tgSendDocument(env, chatId, fileName, content, caption);
      }else{
        const planText = d==null ? "vĩnh viễn" : durStr;
        const expSample = d==null ? "vĩnh viễn" : fmtDate(keys[0].expiresAt, cfg.TZ);
        const header = buildNewHeader(cfg, planText, keys.length, expSample, note);
        const msgs = chunkKeyMessages(header, keys.map(k => k.key));
        await sendLong(env, chatId, msgs, kbHelpOnly, { raw: true });
      }
    }catch(e){
      await tgsend(env, chatId, header(cfg, "LỖI") + bullet("Chi tiết", `<code>${escapeHTML(e.message||e)}</code>`), kbHelpOnly);
    }
    return new Response("OK");
  }

  // /newuntil <YYYY-MM-DD[ HH:mm]> <qty> [note]
  if(/^\/newuntil\b/i.test(text)){
    const m = text.match(/^\/newuntil\s+(\S+)(?:\s+(\d+))?(?:\s+([\s\S]+))?$/i);
    if(!m){
      await needArgs(env, chatId, "/newuntil <YYYY-MM-DD[ HH:mm]> <qty> [note]", "/newuntil 2026-12-31 50 VIP");
      return new Response("OK");
    }
    const untilStr = m[1];
    const qtyRaw = Number(m[2] || 1);
    const qty = Math.max(1, Math.min(CFG.MAX_QTY, qtyRaw));
    const note = (m[3] || "").trim().slice(0, 200);

    try{
      const untilTs = parseUntil(untilStr);
      const keys = await createKeys(env, cfg, {untilTs, quantity:qty, note, planLabel:"until", bindDeviceId:null});
      const planText = "đến";
      const expSample = fmtDate(untilTs, cfg.TZ);
      const header = buildNewHeader(cfg, planText, keys.length, expSample, note);
      const msgs = chunkKeyMessages(header, keys.map(k => k.key));
      await sendLong(env, chatId, msgs, kbHelpOnly, { raw: true });
    }catch(e){
      await tgsend(env, chatId, header(cfg, "LỖI") + bullet("Chi tiết", `<code>${escapeHTML(e.message||e)}</code>`), kbHelpOnly);
    }
    return new Response("OK");
  }

  // /newuuid <UUID> <dur|life> <qty> [note]
  if(/^\/newuuid\b/i.test(text)){
    const m = text.match(/^\/newuuid\s+(\S+)\s+(\S+)(?:\s+(\d+))?(?:\s+([\s\S]+))?$/i);
    if(!m){
      await needArgs(env, chatId, "/newuuid <UUID> <dur|life> <qty> [note]", "/newuuid 01234567-89AB-CDEF-0123-0123456789AB 1d 10 VIP");
      return new Response("OK");
    }
    const uuid = m[1];
    const durStr = (m[2] || "").toLowerCase();
    const qtyRaw = Number(m[3] || 1);
    const qty = Math.max(1, Math.min(CFG.MAX_QTY, qtyRaw));
    const note = (m[4] || "").trim().slice(0, 200);

    try{
      const did = normDevId(uuid);
      if(!isDevId(did)) throw new Error("UUID không hợp lệ");
      const d = parseDuration(durStr);
      const keys = await createKeys(env, cfg, {durationMs:d, quantity:qty, note, planLabel: d==null?"life":"custom", bindDeviceId:did});
      const planText = d==null ? "vĩnh viễn" : durStr;
      const expSample = d==null ? "vĩnh viễn" : fmtDate(keys[0].expiresAt, cfg.TZ);
      const header = buildNewHeader(cfg, planText, keys.length, expSample, note);
      const msgs = chunkKeyMessages(header, keys.map(k => k.key));
      await sendLong(env, chatId, msgs, kbHelpOnly, { raw: true });
    }catch(e){
      await tgsend(env, chatId, header(cfg, "LỖI") + bullet("Chi tiết", `<code>${escapeHTML(e.message||e)}</code>`), kbHelpOnly);
    }
    return new Response("OK");
  }

  // /extend <KEY> <dur|life>
  if(/^\/extend\b/i.test(text)){
    const parts = text.split(/\s+/);
    if(parts.length<3){
      await needArgs(env, chatId, "/extend <KEY> <dur|life>", "/extend VSHTECH-.... 1d12h");
      return new Response("OK");
    }
    const [ , key, val ] = parts;
    const row = await kvGet(env,key);
    if(!row){
      await tgsend(env, chatId, header(cfg, "LỖI") + bullet("Kết quả", "⛔ Không tìm thấy key."), kbHelpOnly);
      return new Response("OK");
    }

    try{
      const d = parseDuration(val);
      extendExpiry(row, d);
      await kvPut(env,row);
      const msg = header(cfg, "GIA HẠN") + [
        bullet("Key", fmtKey(key)),
        bullet("Hết hạn mới", `<code>${escapeHTML(row.exp? fmtDate(row.exp, cfg.TZ):"vĩnh viễn")}</code>`)
      ].join("\n");
      await tgsend(env, chatId, msg, kbHelpOnly);
    }catch(e){
      await tgsend(env, chatId, header(cfg, "LỖI") + bullet("Chi tiết", `<code>${escapeHTML(e.message||e)}</code>`), kbHelpOnly);
    }
    return new Response("OK");
  }

  // /info
  if(/^\/info\b/i.test(text)){
    const parts = text.split(/\s+/);
    if(parts.length<2){
      await needArgs(env, chatId, "/info <KEY>", "/info VSHTECH-....");
      return new Response("OK");
    }
    const key = parts[1];
    const row = await kvGet(env,key);
    if(!row){
      await tgsend(env, chatId, header(cfg, "LỖI") + bullet("Kết quả", "⛔ Không tìm thấy key."), kbHelpOnly);
      return new Response("OK");
    }
    const mode = admin ? "admin" : "user";
    await tgsend(env, chatId, fmtInfo(cfg, view(row), mode), kbHelpOnly);
    return new Response("OK");
  }

  // /who
  if(/^\/who\b/i.test(text)){
    const parts = text.split(/\s+/);
    if(parts.length<2){
      await needArgs(env, chatId, "/who <KEY>", "/who VSHTECH-....");
      return new Response("OK");
    }
    const key = parts[1];
    const row = await kvGet(env,key);
    if(!row){
      await tgsend(env, chatId, header(cfg, "LỖI") + bullet("Kết quả", "⛔ Không tìm thấy key."), kbHelpOnly);
      return new Response("OK");
    }
    const d = view(row);
    const mode = admin ? "admin" : "user";
    const msg = header(cfg, "AI ĐANG GIỮ KEY?") + [
      bullet("Key", fmtKey(d.key)),
      renderBindLine(d.deviceId, mode),
      bullet("Kích hoạt", fmtTime(d.activatedAt, cfg))
    ].join("\n");
    await tgsend(env, chatId, msg, kbHelpOnly);
    return new Response("OK");
  }

  // /revoke
  if(/^\/revoke\b/i.test(text)){
    const parts = text.split(/\s+/);
    if(parts.length<2){
      await needArgs(env, chatId, "/revoke <KEY>", "/revoke VSHTECH-....");
      return new Response("OK");
    }
    const key = parts[1];
    const row = await kvGet(env,key);
    if(!row){
      await tgsend(env, chatId, header(cfg, "LỖI") + bullet("Kết quả", "⛔ Không tìm thấy key."), kbHelpOnly);
      return new Response("OK");
    }
    row.rev=1; await kvPut(env,row);
    await tgsend(env, chatId, header(cfg, "THÀNH CÔNG") + bullet("Đã thu hồi key", fmtKey(key)), kbHelpOnly);
    return new Response("OK");
  }

  // fallback
  await tgsend(env, chatId, header(cfg, "LỖI") + bullet("Kết quả", "⛔ Lệnh không hợp lệ.") + `\n\n<i>Gõ <code>/help</code> để mở menu.</i>`, kbHelpOnly);
  return new Response("OK");
}

/* -------------------------------------- Router ------------------------------------- */
export default {
  async fetch(req, env){
    const url = new URL(req.url);
    const cfg = envCfg(env);

    // Telegram webhook
    if(req.method==="POST" && cfg.SECRET_PATH && url.pathname===`/${cfg.SECRET_PATH}`){
      if(!cfg.TG_TOKEN) return new Response("Missing TG_TOKEN", {status:500});
      return handleBot(req, env);
    }

    // HTTP API
    if(url.pathname.startsWith("/api/")) return handleAPI(req, env);

    // Home
    if(req.method==="GET" && url.pathname==="/"){
      return new Response(`${cfg.BRAND} Worker (KV) online | TZ=${cfg.TZ}`);
    }

    return new Response("Not Found", {status:404});
  }
};
// UI upgraded: message templates + chunking + safe HTML
// Auto-attach UUID on claim (no manual required)
// /new >20 sends txt via sendDocument
// Auto-attach UUID via web claim; manual disabled










// Only key creation messages are boxed















