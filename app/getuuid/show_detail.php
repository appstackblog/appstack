<?php
  $udid = htmlspecialchars($_GET['UDID'] ?? '', ENT_QUOTES, 'UTF-8');
  $product = htmlspecialchars($_GET['DEVICE_PRODUCT'] ?? '', ENT_QUOTES, 'UTF-8');
  $version = htmlspecialchars($_GET['DEVICE_VERSION'] ?? '', ENT_QUOTES, 'UTF-8');
  $name = htmlspecialchars($_GET['DEVICE_NAME'] ?? '', ENT_QUOTES, 'UTF-8');
?>
<!DOCTYPE html>
<html lang="vi">
  <head>
    <meta charset="utf-8" />
    <title>Thông tin UUID thiết bị</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      :root{
        --bg:#0b0f14;
        --panel:#121a24;
        --panel2:#0f1620;
        --border:#223041;
        --text:#e6edf3;
        --muted:#9fb0c0;
        --accent:#00d1ff;
        --success:#2dff7a;
      }
      *{box-sizing:border-box}
      body{
        margin:0;
        font-family:"Trebuchet MS","Lucida Sans Unicode","Lucida Sans",sans-serif;
        color:var(--text);
        background:
          radial-gradient(1100px 600px at 5% 20%, rgba(0,209,255,.12), transparent 60%),
          radial-gradient(900px 500px at 95% 30%, rgba(45,255,122,.08), transparent 60%),
          var(--bg);
        min-height:100vh;
        display:flex;
        align-items:center;
        justify-content:center;
        padding:24px;
      }
      .wrap{
        width:min(980px, 96vw);
        background:linear-gradient(140deg, rgba(18,26,36,.98), rgba(15,22,32,.96));
        border:1px solid var(--border);
        border-radius:24px;
        padding:28px;
        box-shadow:0 35px 80px rgba(2,6,14,.7);
      }
      .head{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:16px;
        margin-bottom:20px;
      }
      .title h1{
        margin:0;
        font-size:1.6rem;
      }
      .title p{
        margin:6px 0 0;
        color:var(--muted);
      }
      .grid{
        display:grid;
        grid-template-columns:1.2fr .8fr;
        gap:14px;
      }
      .card{
        background:rgba(255,255,255,.02);
        border:1px solid var(--border);
        border-radius:18px;
        padding:16px;
      }
      .label{
        font-size:.72rem;
        letter-spacing:.18em;
        text-transform:uppercase;
        color:var(--muted);
      }
      .value{
        margin:10px 0 0;
        font-size:1.05rem;
        font-weight:700;
        word-break:break-all;
      }
      .actions{
        display:flex;
        flex-wrap:wrap;
        gap:10px;
        margin-top:16px;
      }
      .btn{
        display:inline-flex;
        align-items:center;
        justify-content:center;
        gap:8px;
        padding:10px 14px;
        border-radius:12px;
        border:1px solid rgba(0,209,255,.45);
        background:rgba(0,209,255,.16);
        color:var(--text);
        text-decoration:none;
        font-weight:700;
      }
      .btn.secondary{
        background:rgba(255,255,255,.04);
        border:1px solid var(--border);
        color:var(--text);
      }
      .tip{
        margin-top:14px;
        color:var(--muted);
        line-height:1.6;
      }
      @media(max-width:820px){
        .grid{grid-template-columns:1fr}
      }
    </style>
  </head>
  <body>
    <main class="wrap">
      <div class="head">
        <div class="title">
          <h1>Thông tin thiết bị đã lấy</h1>
          <p>Vui lòng kiểm tra lại UUID trước khi sử dụng.</p>
        </div>
        <span class="label">DEVICE INFO</span>
      </div>

      <section class="grid">
        <div class="card">
          <div class="label">UUID / UDID</div>
          <div class="value" id="udidValue"><?php echo $udid ?: '--'; ?></div>
          <div class="actions">
            <button class="btn" id="copyUdid">Sao chép UUID</button>
            <a class="btn secondary" href="index.html">Quay lại</a>
          </div>
        </div>
        <div class="card">
          <div class="label">Thiết bị</div>
          <div class="value"><?php echo $name ?: '--'; ?></div>
          <div class="label" style="margin-top:14px;">Model</div>
          <div class="value"><?php echo $product ?: '--'; ?></div>
          <div class="label" style="margin-top:14px;">Phiên bản iOS</div>
          <div class="value"><?php echo $version ?: '--'; ?></div>
        </div>
      </section>

      <p class="tip">
        Bạn có thể sao chép UUID và quay lại trang kích hoạt để dán vào ô Device ID.
      </p>
    </main>
    <script>
      const btn = document.getElementById("copyUdid");
      const val = document.getElementById("udidValue");
      btn?.addEventListener("click", () => {
        const text = val?.textContent || "";
        if (!text || text === "--") return;
        navigator.clipboard?.writeText(text);
        btn.textContent = "Đã sao chép";
        setTimeout(() => (btn.textContent = "Sao chép UUID"), 1400);
      });
    </script>
  </body>
</html>
