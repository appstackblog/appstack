const homeSection = document.getElementById("homeSection");
const premiumSection = document.getElementById("premiumSection");
const monitorSection = document.getElementById("monitorSection");
const homeBottom = document.getElementById("homeBottom");
const functionBottom = document.getElementById("functionBottom");
const monitorBottom = document.getElementById("monitorBottom");
const noLinkButtons = document.querySelectorAll("[data-no-link]");
const soundToggles = document.querySelectorAll(".sound-toggle");
const modalBackdrop = document.getElementById("modalBackdrop");
const limitModal = document.getElementById("limitModal");
let modalTimer;
let audioContext;

function updateFeatureState(toggle) {
  const card = toggle.closest(".feature-item");
  if (!card) return;
  card.classList.toggle("is-on", toggle.checked);
}

function openLimitModal() {
  document.body.classList.add("modal-open");
  if (modalTimer) {
    clearTimeout(modalTimer);
  }
  modalTimer = setTimeout(() => {
    document.body.classList.remove("modal-open");
  }, 3000);
}

function playToggleSound() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }

  const now = audioContext.currentTime;
  const gain = audioContext.createGain();
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.12, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
  gain.connect(audioContext.destination);

  const osc1 = audioContext.createOscillator();
  osc1.type = "sine";
  osc1.frequency.setValueAtTime(900, now);
  osc1.connect(gain);
  osc1.start(now);
  osc1.stop(now + 0.08);

  const osc2 = audioContext.createOscillator();
  osc2.type = "sine";
  osc2.frequency.setValueAtTime(1200, now + 0.08);
  osc2.connect(gain);
  osc2.start(now + 0.08);
  osc2.stop(now + 0.16);
}

function bindEvents() {
  if (functionBottom) {
    functionBottom.addEventListener("click", (event) => {
      event.preventDefault();
      showSection("premium");
    });
  }

  if (homeBottom) {
    homeBottom.addEventListener("click", (event) => {
      event.preventDefault();
      showSection("home");
    });
  }

  if (monitorBottom) {
    monitorBottom.addEventListener("click", (event) => {
      event.preventDefault();
      showSection("monitor");
    });
  }

  noLinkButtons.forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      const message = button.getAttribute("data-no-link") || "Chưa có liên kết";
      alert(message);
    });
  });

  soundToggles.forEach((toggle) => {
    toggle.addEventListener("change", playToggleSound);
    toggle.addEventListener("change", () => {
      if (toggle.checked) {
        const enabledCount = document.querySelectorAll(".sound-toggle:checked").length;
        if (enabledCount > 4) {
          toggle.checked = false;
          updateFeatureState(toggle);
          openLimitModal();
          return;
        }
      }
      updateFeatureState(toggle);
    });
    updateFeatureState(toggle);
  });

  if (modalBackdrop) {
    modalBackdrop.addEventListener("click", () => {
      document.body.classList.remove("modal-open");
    });
  }
}

function showSection(type) {
  const isPremium = type === "premium";
  const isHome = type === "home";
  if (homeSection) {
    homeSection.classList.toggle("is-hidden", !isHome);
    homeSection.style.display = isHome ? "" : "none";
  }
  if (premiumSection) {
    premiumSection.classList.toggle("is-hidden", !isPremium);
    premiumSection.style.display = isPremium ? "" : "none";
  }
  if (monitorSection) {
    monitorSection.classList.toggle("is-hidden", type !== "monitor");
    monitorSection.style.display = type === "monitor" ? "" : "none";
  }
  if (functionBottom) functionBottom.classList.toggle("is-active", isPremium);
  if (monitorBottom) monitorBottom.classList.toggle("is-active", type === "monitor");
  if (homeBottom) homeBottom.classList.toggle("is-active", isHome);
}

bindEvents();
showSection("home");

function initRealtimeMonitor() {
  const consoleView = document.getElementById("consoleView");
  const cpuCanvas = document.getElementById("cpuCanvas");
  const ramCanvas = document.getElementById("ramCanvas");
  if (!consoleView || !cpuCanvas || !ramCanvas) return;

  const mLogs = document.getElementById("mLogs");
  const mErrs = document.getElementById("mErrs");
  const mFps = document.getElementById("mFps");
  const mFrame = document.getElementById("mFrame");
  const mCpu = document.getElementById("mCpu");
  const mRam = document.getElementById("mRam");
  const mStatus = document.getElementById("mStatus");
  const mTarget = document.getElementById("mTarget");

  const btnLock = document.getElementById("btnLock");
  const btnClearConsole = document.getElementById("btnClearConsole");
  const btnCleanRam = document.getElementById("btnCleanRam");
  const btnCleanCpu = document.getElementById("btnCleanCpu");
  const btnOptRam = document.getElementById("btnOptRam");
  const btnOptCpu = document.getElementById("btnOptCpu");
  const btnOptFps = document.getElementById("btnOptFps");
  const cmd = document.getElementById("cmd");
  const btnExec = document.getElementById("btnExec");

  const MAX_LOG_LINES = 400;
  let logCount = 0;
  let errCount = 0;
  const logLines = [];

  function ts() {
    const d = new Date();
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    const ss = String(d.getSeconds()).padStart(2, "0");
    const ms = String(d.getMilliseconds()).padStart(3, "0");
    return `${hh}:${mm}:${ss}.${ms}`;
  }

  function escapeHtml(value) {
    return value.replace(/[&<>"']/g, (ch) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[ch]));
  }

  function renderConsole() {
    let html = "";
    for (let i = 0; i < logLines.length; i++) {
      const line = logLines[i];
      const raw = String(line.text);
      const splitIndex = raw.indexOf(" > ");
      let body = escapeHtml(raw);
      if (splitIndex !== -1) {
        const prefix = escapeHtml(raw.slice(0, splitIndex));
        const rest = escapeHtml(raw.slice(splitIndex + 3));
        body = `<span class="prefix">${prefix}</span> <span class="prefix">&gt;</span> ${rest}`;
      }
      html += `<p class="logLine ${line.level}"><span class="t">[${line.time}]</span> ${body}</p>`;
    }
    consoleView.innerHTML = html;
    consoleView.scrollTop = consoleView.scrollHeight;
    if (mLogs) mLogs.textContent = String(logCount);
    if (mErrs) mErrs.textContent = String(errCount);
  }

  function pushLine(level, text) {
    logLines.push({ level, text: String(text), time: ts() });
    if (logLines.length > MAX_LOG_LINES) {
      logLines.splice(0, logLines.length - MAX_LOG_LINES);
    }
    renderConsole();
  }

  function updateLine(index, text) {
    if (!logLines[index]) return;
    logLines[index].text = String(text);
    renderConsole();
  }

  function buildSnippets(mode) {
    const base = [
      "init: sync state -> verify checksum -> handoff to runtime",
      "cache: warm layers -> align buffers -> prefetch hot paths",
      "graph: update nodes -> rebuild edges -> commit topology",
      "scheduler: tick -> re-order tasks -> apply budget guard",
      "buffer: reuse pools -> clear stale refs -> seal frame",
      "signal: smooth sample -> clamp noise -> emit spectrum",
      "metrics: commit frame -> write counters -> flush telemetry",
      "kernel: apply filters -> normalize output -> release locks",
      "io: flush queue -> ack packets -> update latency map",
      "core: stabilize loop -> reduce jitter -> sync cadence",
    ];
    const ram = [
      "mem: scan heap -> mark free -> schedule compaction",
      "mem: compact blocks -> merge regions -> defrag map",
      "mem: clear temp buffers -> drop refs -> request GC hint",
      "mem: release cache -> shrink slabs -> free arenas",
      "mem: trim pools -> rebalance buckets -> reduce churn",
      "mem: align pages -> adjust allocator -> optimize layout",
      "mem: reduce churn -> throttle alloc -> stabilize heap",
    ];
    const cpu = [
      "cpu: balance load -> reassign workers -> smooth peaks",
      "cpu: coalesce tasks -> batch ops -> cut overhead",
      "cpu: throttle spikes -> cap bursts -> normalize frame",
      "cpu: reduce jitter -> align cycles -> lock cadence",
      "cpu: align cycles -> optimize loop -> stabilize budget",
      "cpu: stabilize budget -> reduce stalls -> commit sync",
    ];
    const fps = [
      "fps: lock timing -> set target -> clamp drift",
      "fps: stabilize cadence -> smooth delta -> reduce jitter",
      "fps: clamp drift -> align frame -> snap pacing",
      "fps: sync v-blank -> align swap -> reduce tear",
      "fps: optimize pacing -> tune budget -> steady loop",
    ];
    if (mode === "clean-ram") return base.concat(ram, ["gc: sweep", "gc: finalize"]);
    if (mode === "clean-cpu") return base.concat(cpu, ["thread: park idle"]);
    if (mode === "opt-ram") return base.concat(ram, ["heap: optimize layout"]);
    if (mode === "opt-cpu") return base.concat(cpu, ["pipeline: optimize"]);
    if (mode === "opt-fps") return base.concat(fps, ["frame: optimize path"]);
    return base;
  }

  function runProgress(label, mode) {
    const total = 40 + Math.floor(Math.random() * 31);
    const durationMs = 5000;
    const intervalMs = Math.floor(durationMs / total);
    const lineIndex = logLines.length;
    pushLine("info", `${label}: 0%`);
    const snippets = buildSnippets(mode);
    const levels = ["info", "info", "info", "warn", "error"];
    let current = 0;
    const timer = setInterval(() => {
      current += 1;
      const percent = Math.min(100, Math.round((current / total) * 100));
      updateLine(lineIndex, `${label}: ${percent}%`);
      const pick = snippets[Math.floor(Math.random() * snippets.length)];
      const level = levels[Math.floor(Math.random() * levels.length)];
      pushLine(level, `${label} > ${pick}`);
      if (current >= total) {
        clearInterval(timer);
      }
    }, intervalMs);
  }

  const native = {
    log: console.log.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
    info: console.info.bind(console),
  };

  function log(...args) {
    logCount += 1;
    pushLine("info", args.map((item) => (typeof item === "string" ? item : JSON.stringify(item))).join(" "));
    native.log(...args);
  }

  function warn(...args) {
    logCount += 1;
    pushLine("warn", args.map((item) => (typeof item === "string" ? item : JSON.stringify(item))).join(" "));
    native.warn(...args);
  }

  function err(...args) {
    logCount += 1;
    errCount += 1;
    pushLine("error", args.map((item) => (typeof item === "string" ? item : JSON.stringify(item))).join(" "));
    native.error(...args);
  }

  console.log = log;
  console.warn = warn;
  console.error = err;
  console.info = log;

  window.addEventListener("error", (event) => {
    err(`Uncaught: ${event.message} @ ${event.filename}:${event.lineno}:${event.colno}`);
  });
  window.addEventListener("unhandledrejection", (event) => {
    err(`UnhandledRejection: ${event.reason}`);
  });

  window.log = log;
  window.warn = warn;
  window.err = err;
  window.help = () => {
    log("Commands:", "log(x), warn(x), err(x)", "burn(ms) - bận CPU giả lập", "alloc(mb) - tạo rác RAM (demo)", "clearConsole()");
  };

  let tempTrash = [];
  window.burn = (ms = 8) => {
    const t0 = performance.now();
    while (performance.now() - t0 < ms) {
      // busy
    }
    log(`burn(${ms}) done`);
  };

  window.alloc = (mb = 20) => {
    const bytes = Math.max(1, mb) * 1024 * 1024;
    const chunk = new Uint8Array(bytes);
    chunk[0] = 1;
    tempTrash.push(chunk);
    log(`alloc(${mb}MB) -> tempTrash chunks = ${tempTrash.length}`);
  };

  window.clearConsole = () => {
    logLines.length = 0;
    consoleView.innerHTML = "";
    logCount = 0;
    errCount = 0;
    if (mLogs) mLogs.textContent = "0";
    if (mErrs) mErrs.textContent = "0";
  };

  const cpuCtx = cpuCanvas.getContext("2d", { alpha: false, desynchronized: true });
  const ramCtx = ramCanvas.getContext("2d", { alpha: false, desynchronized: true });
  const N = 240;
  const cpuBuf = new Float32Array(N);
  const ramBuf = new Float32Array(N);
  let idx = 0;

  let running = true;
  let lock90 = true;
  let targetFps = 90;
  let targetDt = 1000 / targetFps;

  let lastFpsT = performance.now();
  let frames = 0;
  let fps = 0;
  let fpsSim = 75;
  let fpsSimFree = 46;
  let cpuEst = 0;
  let sampleAcc = 0;
  const sampleInterval = 140;
  let targetAcc = 0;
  const targetInterval = 900;
  let cpuScale = 1;
  let ramScale = 1;
  let waveJitter = 0.02;
  let ramSmooth = 0;
  let ramPhase = 0;
  let ramDrift = 0;

  function setTrend(mode) {
    switch (mode) {
      case "clean-ram":
        ramScale = 0.6;
        waveJitter = 0.015;
        log("Trend: Dọn RAM -> sóng RAM giảm dần.");
        break;
      case "clean-cpu":
        cpuScale = 0.65;
        waveJitter = 0.012;
        log("Trend: Dọn CPU -> sóng CPU giảm dần.");
        break;
      case "opt-ram":
        ramScale = 0.8;
        waveJitter = 0.012;
        log("Trend: Tối ưu RAM -> dao động thấp hơn.");
        break;
      case "opt-cpu":
        cpuScale = 0.8;
        waveJitter = 0.012;
        log("Trend: Tối ưu CPU -> dao động ổn định hơn.");
        break;
      case "opt-fps":
        cpuScale = 0.85;
        ramScale = 0.9;
        waveJitter = 0.01;
        log("Trend: Tối ưu FPS -> sóng mượt và ổn định.");
        break;
      default:
        cpuScale = 1;
        ramScale = 1;
        waveJitter = 0.02;
    }
  }
  const hasMem = !!(performance && performance.memory && performance.memory.usedJSHeapSize);
  if (!hasMem) {
    warn("performance.memory khong co. RAM realtime se hien thi N/A.");
  }

  function resizeCanvasToDPR(canvas, ctx) {
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(300, Math.floor(rect.width * dpr));
    const h = Math.max(140, Math.floor(rect.height * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    }
  }

  function drawWave(ctx, canvas, buf, colorStroke, label, valueText, autoScale = true) {
    const w = canvas.width;
    const h = canvas.height;
    ctx.fillStyle = "#0a0f16";
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = "rgba(255,255,255,0.07)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    const gx = 6;
    const gy = 4;
    for (let i = 1; i < gx; i++) {
      const x = (w * i) / gx;
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
    }
    for (let j = 1; j < gy; j++) {
      const y = (h * j) / gy;
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
    }
    ctx.stroke();

    let maxV = 1;
    if (autoScale) {
      let mv = 0.0001;
      for (let i = 0; i < N; i++) {
        const v = buf[i];
        if (v > mv) mv = v;
      }
      maxV = Math.max(1, mv);
    }

    ctx.strokeStyle = colorStroke;
    ctx.lineWidth = 2;
    ctx.beginPath();
    const step = w / (N - 1);
    for (let i = 0; i < N; i++) {
      const bi = (idx + i) % N;
      const v = buf[bi] / maxV;
      const x = i * step;
      const y = h - v * (h - 18) - 10;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    ctx.fillStyle = "rgba(215,226,240,0.90)";
    ctx.font = "12px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace";
    ctx.fillText(label, 10, 16);

    ctx.fillStyle = "rgba(127,147,173,0.95)";
    ctx.fillText(valueText, 10, h - 10);
  }

  let lastT = performance.now();
  let accumulator = 0;
  let lastRenderT = lastT;

  function loop(t) {
    if (!running) return;
    const dt = t - lastT;
    lastT = t;
    accumulator += dt;
    sampleAcc += dt;

    if (lock90) {
      if (accumulator < targetDt) {
        requestAnimationFrame(loop);
        return;
      }
      accumulator %= targetDt;
    }

    const workStart = performance.now();
    resizeCanvasToDPR(cpuCanvas, cpuCtx);
    resizeCanvasToDPR(ramCanvas, ramCtx);

    const frameMs = t - lastRenderT;
    lastRenderT = t;

    frames += 1;
    if (t - lastFpsT >= 800) {
      fps = Math.round((frames * 1000) / (t - lastFpsT));
      frames = 0;
      lastFpsT = t;
      if (lock90) {
        const target = 60 + Math.random() * 25;
        fpsSim = fpsSim * 0.9 + target * 0.1;
        if (mFps) mFps.textContent = String(Math.round(fpsSim));
      } else if (mFps) {
        const target = 35 + Math.random() * 22;
        fpsSimFree = fpsSimFree * 0.9 + target * 0.1;
        mFps.textContent = String(Math.round(fpsSimFree));
      }
    }
    if (mFrame) mFrame.textContent = frameMs.toFixed(1);

    let usedMB = NaN;
    if (hasMem) {
      usedMB = performance.memory.usedJSHeapSize / 1048576;
      if (mRam) mRam.textContent = `${usedMB.toFixed(0)} MB`;
    } else {
      ramPhase += dt * 0.0009;
      ramDrift += (Math.random() - 0.5) * 0.18;
      ramDrift = Math.max(-6, Math.min(6, ramDrift));
      const sim = 190 + 12 * Math.sin(ramPhase) + 6 * Math.sin(ramPhase * 0.35) + ramDrift;
      usedMB = Math.max(120, sim);
      if (mRam) mRam.textContent = `${usedMB.toFixed(0)} MB`;
    }

    const workEnd = performance.now();
    const busyMs = workEnd - workStart;
    const budget = lock90 ? targetDt : 16.67;
    const cpuNow = Math.max(0, Math.min(100, (busyMs / budget) * 100));
    cpuEst = cpuEst * 0.88 + cpuNow * 0.12;

    if (sampleAcc >= sampleInterval) {
      sampleAcc %= sampleInterval;
      const drift = 0.18 + 0.12 * Math.sin(t / 700) + 0.06 * Math.sin(t / 2100);
      const cpuNoise = (Math.random() - 0.5) * waveJitter * 2;
      const cpuValue = Math.max(
        0.05,
        Math.min(0.95, (cpuEst / 100) * 0.5 * cpuScale + drift + cpuNoise)
      );
      cpuBuf[idx] = cpuValue;

      const ramValue = Number.isFinite(usedMB) ? usedMB : ramSmooth;
      ramSmooth = ramSmooth ? ramSmooth * 0.96 + ramValue * 0.04 : ramValue;
      ramBuf[idx] = ramSmooth * ramScale;
      idx = (idx + 1) % N;
    }

    drawWave(cpuCtx, cpuCanvas, cpuBuf, "rgba(76,201,240,0.95)", "CPU est (%)", `FPS: ${fps} | Frame: ${frameMs.toFixed(1)}ms`, false);
    drawWave(ramCtx, ramCanvas, ramBuf, "rgba(45,212,191,0.95)", "RAM (MB)", hasMem ? `Heap Used: ${usedMB.toFixed(0)} MB` : "Heap Used: N/A", true);

    if (mCpu) mCpu.textContent = String(Math.round(cpuEst));
    if (mTarget) {
      targetAcc += dt;
      if (targetAcc >= targetInterval) {
        targetAcc = 0;
        const targetValue = lock90
          ? 80 + Math.round(Math.random() * 10)
          : 45 + Math.round(Math.random() * 15);
        mTarget.textContent = String(targetValue);
      }
    }

    if (mStatus) {
      if (cpuEst < 55 && fps >= (lock90 ? 80 : 50)) {
        mStatus.textContent = "Ổn định";
        mStatus.className = "v ok";
      } else if (cpuEst < 85) {
        mStatus.textContent = "Đang tải";
        mStatus.className = "v";
      } else {
        mStatus.textContent = "Căng CPU";
        mStatus.className = "v";
      }
    }

    requestAnimationFrame(loop);
  }


  btnLock.addEventListener("click", () => {
    lock90 = !lock90;
    btnLock.textContent = `Lock 90 FPS: ${lock90 ? "ON" : "OFF"}`;
    btnLock.classList.toggle("toggleOn", lock90);
    log("Lock FPS:", lock90 ? "ON (90fps)" : "OFF (native rAF)");
  });

  btnClearConsole.addEventListener("click", () => {
    window.clearConsole();
    log("Console cleared.");
  });

  if (btnCleanRam) {
    btnCleanRam.addEventListener("click", () => {
      tempTrash = [];
      ramBuf.fill(0);
      idx = 0;
      log("Dọn RAM: xóa bộ nhớ giả lập và reset RAM wave.");
      setTrend("clean-ram");
      runProgress("Dọn RAM", "clean-ram");
    });
  }

  if (btnCleanCpu) {
    btnCleanCpu.addEventListener("click", () => {
      cpuBuf.fill(0);
      idx = 0;
      log("Dọn CPU: reset CPU wave và giảm tải demo.");
      setTrend("clean-cpu");
      runProgress("Dọn CPU", "clean-cpu");
    });
  }

  if (btnOptRam) {
    btnOptRam.addEventListener("click", () => {
      tempTrash = [];
      ramBuf.fill(0);
      idx = 0;
      log("Tối ưu RAM: dọn dữ liệu giả lập, ưu tiên heap sạch.");
      setTrend("opt-ram");
      runProgress("Tối ưu RAM", "opt-ram");
    });
  }

  if (btnOptCpu) {
    btnOptCpu.addEventListener("click", () => {
      cpuBuf.fill(0);
      idx = 0;
      log("Tối ưu CPU: reset wave, ưu tiên frame ổn định.");
      setTrend("opt-cpu");
      runProgress("Tối ưu CPU", "opt-cpu");
    });
  }

  if (btnOptFps) {
    btnOptFps.addEventListener("click", () => {
      lock90 = true;
      targetFps = 90;
      targetDt = 1000 / targetFps;
      btnLock.textContent = "Lock 90 FPS: ON";
      btnLock.classList.add("toggleOn");
      log("Tối ưu FPS: bật lock 90 FPS.");
      setTrend("opt-fps");
      runProgress("Tối ưu FPS", "opt-fps");
    });
  }

  function execCmd() {
    const value = cmd.value.trim();
    if (!value) return;
    cmd.value = "";
    try {
      const fn = new Function("log", "warn", "err", `"use strict"; return (${value});`);
      const out = fn(log, warn, err);
      if (out !== undefined) log(out);
    } catch (error) {
      try {
        const fn2 = new Function("log", "warn", "err", `"use strict"; ${value}`);
        const out2 = fn2(log, warn, err);
        if (out2 !== undefined) log(out2);
      } catch (error2) {
        err(String(error2));
      }
    }
  }

  cmd.addEventListener("keydown", (event) => {
    if (event.key === "Enter") execCmd();
  });
  btnExec.addEventListener("click", execCmd);

  log("Ready. Type help() to see commands.");
  requestAnimationFrame(loop);
}

initRealtimeMonitor();
