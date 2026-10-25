(function (root) {
  var CFG_KEY = "alphaProposalCfg";
  var HIST_KEY = "alphaProposalHist";
  var PROF_KEY = "alphaProposalProfiles";
  var st = root.__proposalState || (root.__proposalState = {
    tplFile: null,
    srcFiles: [],
    photos: [],
    pageFacts: [],
    hiddenCats: {},
    ingestedKey: "",
    lastBlob: null,
    lastName: "",
    logoData: null,
    trendFiles: [],
    trendText: "",
    lastQa: [],
    ingestJob: null,
    aiModel: null,
    aiTried: false,
    visionOk: null
  });
  function bind(opts) {
  bind._page = (opts && opts.page) || "01";
  if (bind._studio == null) bind._studio = false;
  if (typeof pdfjsLib !== "undefined") {
    pdfjsLib.GlobalWorkerOptions.workerSrc = "vendor/pdf.worker.min.js";
  }

  var tplFile = st.tplFile;
  var srcFiles = st.srcFiles;
  var photos = st.photos;
  var pageFacts = st.pageFacts;
  var hiddenCats = st.hiddenCats;
  var ingestedKey = st.ingestedKey;
  var lastBlob = st.lastBlob;
  var lastName = st.lastName;
  var logoData = st.logoData;
  var trendFiles = st.trendFiles;
  var trendText = st.trendText;
  var lastQa = st.lastQa;
  var ingestJob = st.ingestJob;
  function persist() {
    st.tplFile = tplFile;
    st.srcFiles = srcFiles;
    st.photos = photos;
    st.pageFacts = pageFacts;
    st.hiddenCats = hiddenCats;
    st.ingestedKey = ingestedKey;
    st.lastBlob = lastBlob;
    st.lastName = lastName;
    st.logoData = logoData;
    st.trendFiles = trendFiles;
    st.trendText = trendText;
    st.lastQa = lastQa;
    st.ingestJob = ingestJob;
    st.aiModel = aiModel;
    st.aiTried = aiTried;
    st.visionOk = visionOk;
  }

  var $ = function (id) { return document.getElementById(id); };
  var tplDrop = $("tplDrop"), srcDrop = $("srcDrop");
  var tplInput = $("tplFile"), srcInput = $("srcFiles");
  var go = $("go"), statusEl = $("status"), thumbs = $("thumbs");
  if (!go || !srcDrop) return;

  logoData = null;

  function blobToDataUrl(blob) {
    return new Promise(function (res, rej) {
      var r = new FileReader();
      r.onload = function () { res(r.result); };
      r.onerror = rej;
      r.readAsDataURL(blob);
    });
  }
  function fileToArray(file) {
    return file.arrayBuffer();
  }
  function setStatus(msg, kind) {
    statusEl.className = "status" + (kind ? " " + kind : "");
    statusEl.textContent = msg;
  }
  function setPipe(n, mode) {
    [1, 2, 3, 4].forEach(function (i) {
      var row = $("pipe" + i);
      if (!row) return;
      row.classList.remove("on", "run", "off");
      if (mode === "reset") row.classList.add("off");
      else if (i < n) row.classList.add("on");
      else if (i === n) row.classList.add(mode === "done" ? "on" : "run");
      else row.classList.add("off");
    });
  }
  function bindDrop(el, input, onFiles) {
    if (!el || !input) return;
    el.addEventListener("click", function (e) {
      if (e.target.tagName !== "INPUT") input.click();
    });
    el.addEventListener("dragover", function (e) {
      e.preventDefault(); el.classList.add("on");
    });
    el.addEventListener("dragleave", function () { el.classList.remove("on"); });
    el.addEventListener("drop", function (e) {
      e.preventDefault(); el.classList.remove("on");
      onFiles(e.dataTransfer.files);
    });
    input.addEventListener("change", function () { onFiles(input.files); input.value = ""; });
  }
  function renderList(el, files, onKill) {
    el.innerHTML = files.map(function (f, i) {
      return "<div class='row'><span>" + esc(f.name) + " · " + sizeOf(f.size) +
        "</span><button type='button' data-i='" + i + "'>×</button></div>";
    }).join("");
    el.querySelectorAll("button").forEach(function (b) {
      b.onclick = function () { onKill(+b.getAttribute("data-i")); };
    });
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c];
    });
  }
  function sizeOf(n) {
    if (n > 1e6) return (n / 1e6).toFixed(1) + " MB";
    if (n > 1e3) return (n / 1e3).toFixed(0) + " KB";
    return n + " B";
  }
  function extOf(name) {
    var m = /\.([a-z0-9]+)$/i.exec(name || "");
    return m ? m[1].toLowerCase() : "";
  }

  function parseGrid(str) {
    var m = String(str || "").trim().match(/^(\d+)\s*[x×X]\s*(\d+)$/);
    if (!m) return null;
    var cols = parseInt(m[1], 10);
    var rows = parseInt(m[2], 10);
    if (!cols || !rows || cols > 8 || rows > 8) return null;
    return { cols: cols, rows: rows, per: cols * rows };
  }
  function gridForPreset(n) {
    if (n <= 1) return { cols: 1, rows: 1, per: 1 };
    if (n === 2) return { cols: 2, rows: 1, per: 2 };
    if (n === 4) return { cols: 2, rows: 2, per: 4 };
    if (n === 6) return { cols: 3, rows: 2, per: 6 };
    return { cols: 2, rows: 2, per: 4 };
  }
  function currentGrid() {
    var sel = $("perSlide");
    var v = sel ? sel.value : "4";
    if (v === "original") return { cols: 1, rows: 1, per: 1, original: true };
    if (v === "custom") {
      var typed = $("customGrid") ? $("customGrid").value : "4x4";
      var g = parseGrid(typed);
      if (g) return g;
      return { cols: 4, rows: 4, per: 16, invalid: true, typed: typed };
    }
    return gridForPreset(parseInt(v, 10) || 4);
  }
  function cellAspect(g) {
    var titleOn = $("titleOn") ? $("titleOn").checked : true;
    var top = titleOn ? 0.72 : 0.28;
    var gap = 0.16;
    var areaW = 12.53;
    var areaH = 7.5 - top - 0.28;
    var cols = Math.max(1, g.cols);
    var rows = Math.max(1, g.rows);
    var cellW = (areaW - gap * (cols - 1)) / cols;
    var cellH = (areaH - gap * (rows - 1)) / rows;
    return cellW / cellH;
  }
  function coverCrop(imgW, imgH, cellA) {
    var imgA = imgW / imgH;
    if (imgA > cellA) {
      var w = cellA / imgA;
      return { x: (1 - w) / 2, y: 0, w: w, h: 1 };
    }
    var h = imgA / cellA;
    return { x: 0, y: (1 - h) / 2, w: 1, h: h };
  }
  function applyCoverCrops() {
    photos.forEach(function (p) {
      if (!p.crop) p.crop = { x: 0, y: 0, w: 1, h: 1 };
    });
  }
  function containRect(boxX, boxY, boxW, boxH, imgW, imgH) {
    var a = (imgW || 1) / (imgH || 1);
    var ba = boxW / Math.max(0.01, boxH);
    var w, h;
    if (a > ba) { w = boxW; h = boxW / a; }
    else { h = boxH; w = boxH * a; }
    return {
      x: boxX + (boxW - w) / 2,
      y: boxY + (boxH - h) / 2,
      w: w,
      h: h
    };
  }
  function syncLayoutUi() {
    var wrap = $("customGridWrap");
    var hint = $("gridHint");
    var v = $("perSlide") ? $("perSlide").value : "4";
    if (wrap) wrap.style.display = v === "custom" ? "block" : "none";
    var g = currentGrid();
    if (hint) {
      if (v !== "custom") hint.textContent = "";
      else if (g.invalid) hint.textContent = "Type it as 4x4 (columns × rows). Using 4×4 until that reads.";
      else hint.textContent = g.cols + " columns × " + g.rows + " rows · " + g.per + " photos / slide";
    }
  }

  bindDrop(tplDrop, tplInput, function (list) {
    if (!list || !list.length) return;
    tplFile = list[0];
    persist();
    renderList($("tplList"), [tplFile], function () {
      tplFile = null; persist(); $("tplList").innerHTML = "";
    });
  });
  bindDrop(srcDrop, srcInput, function (list) {
    if (!list || !list.length) return;
    srcFiles = srcFiles.concat([].slice.call(list));
    persist();
    refreshSrc();
    ingestAll();
  });
  function refreshSrc() {
    renderList($("srcList"), srcFiles, function (i) {
      srcFiles.splice(i, 1);
      ingestedKey = "";
      refreshSrc();
      ingestAll();
    });
    go.disabled = false;
    if (srcFiles.length) setStatus(srcFiles.length + " file(s). Reading…");
    else setStatus("Drop a factory PDF / PPT first.");
    paintIssues();
  }

  function onPaste(e) {
    if (!$("srcDrop")) return;
    var items = e.clipboardData && e.clipboardData.items;
    if (!items) return;
    var added = false;
    for (var i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image") === 0) {
        var f = items[i].getAsFile();
        if (f) {
          var named = new File([f], "paste-" + Date.now() + ".png", { type: f.type });
          srcFiles.push(named);
          added = true;
        }
      }
    }
    if (added) { refreshSrc(); ingestAll(); }
  }
  if (bind._paste) document.removeEventListener("paste", bind._paste);
  bind._paste = onPaste;
  document.addEventListener("paste", onPaste);

  go.onclick = function () { run(); };
  bindStudioExtras();
  if ($("perSlide")) $("perSlide").addEventListener("change", function () {
    syncLayoutUi();
    applyCoverCrops();
    paintPreview();
  });
  if ($("customGrid")) {
    $("customGrid").addEventListener("input", function () {
      syncLayoutUi();
      applyCoverCrops();
      paintPreview();
    });
  }
  ["wmOn", "titleOn", "logoOn"].forEach(function (id) {
    if ($(id)) $(id).addEventListener("change", function () {
      if (id === "titleOn") applyCoverCrops();
      paintPreview();
    });
  });
  syncLayoutUi();

  async function ingestAll() {
    if (!srcFiles.length) {
      photos = [];
      pageFacts = [];
      ingestedKey = "";
      paintPreview();
      paintIssues();
      return;
    }
    var key = srcFiles.map(function (f) { return f.name + ":" + f.size; }).join("|");
    if (key === ingestedKey) return;
    ingestedKey = key;
    photos = [];
    pageFacts = [];
    aiTried = false;
    visionOk = null;
    visionUrl = null;
    if (thumbs) thumbs.innerHTML = "";
    ingestJob = (async function () {
      setPipe(1, "run");
      setStatus("Reading factory files · finding products…");
      if ($("aiOn") && $("aiOn").checked) {
        var ok = await pingVision();
        if (!ok) setStatus("AI reader off. Open 4181 on this PC — still reading the file.");
      }
      for (var i = 0; i < srcFiles.length; i++) {
        await ingest(srcFiles[i]);
      }
      setPipe(2, "run");
      if (!photos.length) throw new Error("No photos found in those files.");
      photos.forEach(function (p) {
        if (p.on == null) p.on = true;
        p.cat = p.cat || guessCat(p);
        p.factory = p.factory || ($("factoryName") && $("factoryName").value) || factoryFromName(p.src);
      });
      setPipe(3, "run");
      applyCoverCrops();
      paintPreview();
      paintIssues();
      setPipe(3, "done");
      setStatus(photos.length + " photo(s) ready. Uncheck / edit, then Generate.", "ok");
    })();
    try {
      await ingestJob;
    } catch (err) {
      ingestedKey = "";
      setPipe(1, "reset");
      setStatus(err.message || String(err), "err");
    }
    ingestJob = null;
    persist();
    if (go) go.disabled = false;
  }

  async function run() {
    if (!srcFiles.length && !photos.length) {
      setStatus("Drop a factory PDF / PPT first.", "err");
      return;
    }
    var g = currentGrid();
    if (g.invalid) {
      setStatus("Custom grid must look like 4x4 — columns × rows, same as you type.", "err");
      return;
    }
    if (ingestJob) {
      setStatus("Still reading the factory file…");
      try { await ingestJob; } catch (e) {}
    }
    if (!photos.length) {
      await ingestAll();
    }
    var live = livePhotos();
    if (!live.length) {
      setStatus("No photos ticked. Tick at least one.", "err");
      return;
    }
    paintIssues();
    go.disabled = true;
    showPane("ship");
    try {
      setPipe(4, "run");
      setStatus("Building PPTX · " + live.length + " photo(s)…");
      if (bind._page === "03") await buildFactoryPptx();
      else await buildPptx();
      setPipe(4, "done");
      setStatus("Downloaded. " + live.length + " photo(s) fitted.", "ok");
      pushHist();
      persist();
    } catch (err) {
      setStatus(err.message || String(err), "err");
    }
    go.disabled = false;
  }

  async function ingest(file) {
    var ext = extOf(file.name);
    if (/^(png|jpe?g|webp|gif|bmp)$/.test(ext) || (file.type || "").indexOf("image/") === 0) {
      await explodeIntoPhotos(await photoFromData(file.name, await blobToDataUrl(file), file.name));
      return;
    }
    if (ext === "pdf") {
      await ingestPdf(file);
      return;
    }
    if (ext === "pptx" || ext === "ppt") {
      await ingestPptx(file);
      return;
    }
    throw new Error("Skip " + file.name + " — use PDF, PPTX, or image.");
  }

  function measure(data) {
    return new Promise(function (res, rej) {
      var img = new Image();
      img.onload = function () { res({ w: img.naturalWidth, h: img.naturalHeight }); };
      img.onerror = function () { rej(new Error("Could not read image")); };
      img.src = data;
    });
  }
  async function photoFromData(name, data, src, extra) {
    var m = await measure(data);
    var p = { name: name, data: data, src: src, nw: m.w, nh: m.h, crop: { x: 0, y: 0, w: 1, h: 1 } };
    extra = extra || {};
    if (extra.item) p.item = extra.item;
    if (extra.name) p.nameLabel = extra.name;
    if (extra.material) p.material = extra.material;
    if (extra.size) p.size = extra.size;
    if (extra.price) p.price = extra.price;
    if (extra.moq) p.moq = extra.moq;
    if (extra.lead) p.lead = extra.lead;
    if (extra.note) p.note = extra.note;
    if (extra.lookbook) p.lookbook = true;
    p.on = true;
    p.cat = extra.cat || guessCat(p);
    return p;
  }
  function harvestItem(s) {
    var t = String(s || "");
    var m = t.match(/\b(\d{4})\s*[-–]\s*(\d{4,})\b/);
    if (m) return m[1] + "-" + m[2];
    var packed = t.replace(/(\d)\s+(?=\d)/g, "$1");
    m = packed.match(/\b(\d{4})[-–](\d{4,})\b/);
    return m ? m[1] + "-" + m[2] : "";
  }
  function harvestSize(s) {
    var bits = [];
    String(s || "").replace(
      /(?:[LMS]\s*:\s*)?[DLWH]\s*\d+(?:\.\d+)?(?:\s*[x×\/]\s*(?:[DLWH]\s*)?\d+(?:\.\d+)?)*(?:\s+[DLWH]\s*\d+(?:\.\d+)?)*\s*(?:cm)?/gi,
      function (t) {
        t = t.replace(/\s+/g, " ").trim();
        if (t.length >= 4 && !/^\d{4}-/.test(t) && bits.indexOf(t) < 0 && bits.length < 6) bits.push(t);
        return t;
      }
    );
    return bits.join(" · ");
  }
  function collectSpecs(labels) {
    var blob = (labels || []).map(function (l) { return l.text; }).join(" ");
    var specs = [];
    var re = /ITEM\s*:?\s*([A-Z0-9][A-Z0-9.\-\/]{2,})(?:\s*MATERIAL\s*:?\s*([A-Z][A-Z0-9\/ &\-]{1,28}))?/gi;
    var m;
    while ((m = re.exec(blob))) {
      specs.push({
        item: m[1],
        material: (m[2] || "").replace(/\s+(ITEM|SIZE|AG-).*$/i, "").trim(),
        size: ""
      });
    }
    if (!specs.length) {
      var codes = blob.match(/\bAG-[A-Z0-9.\-]+\b/gi) || [];
      var mats = blob.match(/MATERIAL\s*:?\s*([A-Z][A-Z0-9\/ &\-]{1,28})/gi) || [];
      codes.forEach(function (c, i) {
        var mat = mats[i] ? mats[i].replace(/MATERIAL\s*:?\s*/i, "").trim() : "";
        specs.push({ item: c, material: mat, size: "" });
      });
    }
    if (!specs.length) {
      var seen = {};
      String(blob).replace(/\b(\d{4})\s*[-–]\s*(\d{4,})\b/g, function (_, a, b) {
        var item = a + "-" + b;
        if (seen[item]) return _;
        seen[item] = true;
        specs.push({ item: item, material: "", size: "" });
        return _;
      });
    }
    return specs;
  }
  function deckLang() {
    var vn = $("langVN") && $("langVN").checked;
    var en = $("langEN") && $("langEN").checked;
    var cn = $("langCN") && $("langCN").checked;
    if (!vn && !en && !cn) en = true;
    var packs = {
      en: { item: "ITEM", material: "MATERIAL", size: "SIZE", moq: "MOQ", lt: "LT", thanks: "Thanks!", intro: "from source file only", sales: "From factory file", cover: "Customer presentation from factory proposal" },
      vn: { item: "MÃ", material: "VẢI / CHẤT LIỆU", size: "SIZE", moq: "MOQ", lt: "LEAD", thanks: "Cảm ơn!", intro: "chỉ từ chữ trong file", sales: "Từ file nhà máy", cover: "Đề xuất khách từ file nhà máy" },
      cn: { item: "货号", material: "材质", size: "尺寸", moq: "MOQ", lt: "交期", thanks: "谢谢!", intro: "仅来自工厂文件", sales: "来自工厂文件", cover: "工厂文件客户提案" }
    };
    var keys = [];
    if (en) keys.push("en");
    if (vn) keys.push("vn");
    if (cn) keys.push("cn");
    var primary = packs[keys[0]];
    return {
      primary: primary,
      thanks: keys.map(function (k) { return packs[k].thanks; }).filter(function (v, i, a) { return a.indexOf(v) === i; }).join("  ·  "),
      intro: primary.intro,
      sales: primary.sales,
      cover: primary.cover,
      item: primary.item,
      material: primary.material,
      size: primary.size,
      moq: primary.moq,
      lt: primary.lt
    };
  }
  function specLine(p) {
    var L = deckLang();
    var bits = [];
    if (p.item) bits.push(L.item + " " + p.item);
    if (p.nameLabel) bits.push(p.nameLabel);
    if (p.material) bits.push(L.material + " " + p.material);
    if (p.size) bits.push(L.size + " " + p.size);
    if (p.price) bits.push(p.price);
    if (p.moq) bits.push(L.moq + " " + p.moq);
    if (p.lead) bits.push(L.lt + " " + p.lead);
    return bits.join("  ·  ");
  }
  function factoryFromName(n) {
    n = String(n || "");
    if (/far\s*eastern/i.test(n)) return "Far Eastern";
    if (/in\s*home/i.test(n)) return "In Home";
    return n.replace(/\.[a-z0-9]+$/i, "").slice(0, 40);
  }
  function wordTokens(s) {
    return String(s || "").toLowerCase().match(/[a-z0-9à-ỹ]{3,}/gi) || [];
  }
  function parseSpecBlob(s) {
    s = String(s || "").replace(/\s+/g, " ").trim();
    if (!s) return {};
    var item = (s.match(/ITEM\s*:?\s*([A-Z0-9][A-Z0-9.\-\/]{2,})/i) || [])[1]
      || (s.match(/\b(AG-[A-Z0-9.\-]+)\b/i) || [])[1]
      || harvestItem(s)
      || (s.match(/\b([A-Z]{1,4}-[A-Z0-9]{3,}(?:-[A-Z0-9]+)?)\b/) || [])[1];
    var material = (s.match(/MATERIAL\s*:?\s*([A-Z][A-Z0-9\/ &\-]{1,28})/i) || [])[1];
    if (material) material = material.replace(/\s+(ITEM|SIZE|AG-).*$/i, "").trim();
    var size = (s.match(/SIZE\s*:?\s*([0-9xX×.\s\-cmCMHWlh×x\/]+)/i) || [])[1]
      || (s.match(/(\d+(?:\.\d+)?\s*[x×]\s*\d+(?:\.\d+)?(?:\s*[x×]\s*\d+(?:\.\d+)?)?\s*cm)/i) || [])[1]
      || harvestSize(s);
    if (size) size = size.replace(/\s+/g, " ").trim();
    var price = (s.match(/(?:FOB|CIF|EXW|PRICE|USD|US\$|\$)\s*:?\s*\$?\s*(\d+(?:\.\d+)?)/i) || []);
    var moq = (s.match(/MOQ\s*:?\s*(\d[\d,\s]*)/i) || [])[1];
    var lead = (s.match(/(?:LEAD\s*TIME|L\/T|LT)\s*:?\s*([0-9][0-9A-Za-z\-\/\s]{0,24})/i) || [])[1];
    return {
      item: item || "",
      material: material || "",
      size: size || "",
      price: price[0] ? String(price[0]).replace(/\s+/g, " ").trim() : "",
      moq: moq ? String(moq).replace(/\s+/g, "") : "",
      lead: lead ? String(lead).replace(/\s+/g, " ").trim() : ""
    };
  }
  function guessCat(p) {
    var blob = ((p.item || "") + " " + (p.material || "") + " " + (p.name || "")).toLowerCase();
    if (/garden|planter|pot|lantern|outdoor|patio/.test(blob)) return "Garden";
    if (/home|basket|decor|vase|candle|tray/.test(blob)) return "Home";
    if (/bag|tote|pouch|wallet|backpack/.test(blob)) return "Bags";
    if (/hat|cap|beanie/.test(blob)) return "Hats";
    if (/scarf|shawl/.test(blob)) return "Scarves";
    if (/shirt|tee|top|blouse/.test(blob)) return "Tops";
    if (/pant|short|skirt|dress/.test(blob)) return "Bottoms";
    if (/set|collection|suite/.test(blob)) return "Collection";
    return "Other";
  }
  var FACTORY_PHONE_RE = /(\+?\d[\d\s().-]{7,}\d)/g;
  var FACTORY_MAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
  function stripFactoryContact(s) {
    return String(s || "").replace(FACTORY_PHONE_RE, "").replace(FACTORY_MAIL_RE, "").replace(/\s{2,}/g, " ").trim();
  }
  function harvestFacts(labels, srcName) {
    var blob = stripFactoryContact((labels || []).map(function (l) { return l.text; }).join(" "));
    if (blob.length < 40) return;
    var low = blob.toLowerCase();
    if (!/(factory|established|employee|capacity|certif|iso|bsci|gots|oeko|since\s*19|since\s*20)/i.test(low)) return;
    var snippet = blob.replace(/\s+/g, " ").slice(0, 420);
    if (pageFacts.some(function (f) { return f.text.slice(0, 80) === snippet.slice(0, 80); })) return;
    pageFacts.push({ src: srcName || "", text: snippet });
  }
  function pageLabelsFromText(items, vp) {
    var out = [];
    (items || []).forEach(function (it) {
      var t = String(it.str || "").trim();
      if (!t) return;
      var tr = it.transform || [];
      var pt = vp.convertToViewportPoint ? vp.convertToViewportPoint(tr[4] || 0, tr[5] || 0) : [tr[4] || 0, vp.height - (tr[5] || 0)];
      var scale = vp.scale || 1;
      var h = Math.abs(it.height || tr[3] || 10) * scale;
      var wid = (it.width || Math.max(8, t.length * 5)) * scale;
      out.push({ text: t, x: pt[0], y: pt[1] - h, w: wid, h: h });
    });
    return out;
  }
  function specForRect(labels, rect) {
    if (!labels || !labels.length) return {};
    var placed = labels.some(function (l) { return (l.x || 0) > 2 || (l.y || 0) > 2 || (l.w || 0) > 8; });
    if (!placed) return {};
    var blob = labels.filter(function (l) {
      var cx = l.x + l.w / 2;
      var cy = l.y + l.h / 2;
      return cx >= rect.x - 8 && cx <= rect.x + rect.w + 8
        && cy >= rect.y - 12 && cy <= rect.y + rect.h + 90;
    }).map(function (l) { return l.text; }).join(" ");
    return parseSpecBlob(blob);
  }

  async function ingestPdf(file) {
    var buf = await fileToArray(file);
    var doc = await pdfjsLib.getDocument({ data: buf }).promise;
    var jobs = [];
    for (var p = 1; p <= doc.numPages; p++) {
      var page = await doc.getPage(p);
      var vp = page.getViewport({ scale: 2.4 });
      var canvas = document.createElement("canvas");
      canvas.width = vp.width;
      canvas.height = vp.height;
      var rctx = canvas.getContext("2d");
      rctx.imageSmoothingEnabled = true;
      rctx.imageSmoothingQuality = "high";
      await page.render({ canvasContext: rctx, viewport: vp }).promise;
      var labels = [];
      try {
        var tc = await page.getTextContent();
        labels = pageLabelsFromText(tc.items, vp);
      } catch (e) { labels = []; }
      harvestFacts(labels, file.name);
      jobs.push({
        photo: await photoFromData(file.name + " p" + p, canvas.toDataURL("image/png"), file.name),
        labels: labels
      });
    }
    for (var i = 0; i < jobs.length; i += 3) {
      var batch = jobs.slice(i, i + 3).map(function (j) { return explodeIntoPhotos(j.photo, j.labels); });
      await Promise.all(batch);
    }
  }

  function parseRels(xml) {
    var map = {};
    String(xml || "").replace(/Id="(rId\d+)"[^>]*Target="([^"]+)"/g, function (_, id, t) {
      map[id] = t.replace(/^\.\.\//, "ppt/");
      return _;
    });
    if (!Object.keys(map).length) {
      String(xml || "").replace(/Target="([^"]+)"[^>]*Id="(rId\d+)"/g, function (_, t, id) {
        map[id] = t.replace(/^\.\.\//, "ppt/");
        return _;
      });
    }
    return map;
  }
  function emuInch(n) { return (+n || 0) / 914400; }
  function srcRectCrop(picXml) {
    var m = picXml.match(/<a:srcRect([^/]*?)\/>/);
    if (!m) return { x: 0, y: 0, w: 1, h: 1 };
    var a = m[1];
    function pct(attr) {
      var v = a.match(new RegExp(attr + '="(-?\\d+)"'));
      return v ? Math.max(0, +v[1]) / 100000 : 0;
    }
    var l = pct("l"), t = pct("t"), r = pct("r"), b = pct("b");
    return { x: l, y: t, w: Math.max(0.02, 1 - l - r), h: Math.max(0.02, 1 - t - b) };
  }
  async function cropBySrc(dataUrl, crop) {
    if (!crop || (crop.x === 0 && crop.y === 0 && crop.w === 1 && crop.h === 1)) return dataUrl;
    var img = await loadImage(dataUrl);
    var sx = crop.x * img.width, sy = crop.y * img.height;
    var sw = Math.max(2, crop.w * img.width), sh = Math.max(2, crop.h * img.height);
    var c = document.createElement("canvas");
    c.width = Math.round(sw); c.height = Math.round(sh);
    c.getContext("2d").drawImage(img, sx, sy, sw, sh, 0, 0, c.width, c.height);
    return c.toDataURL("image/png");
  }
  function isLogoPic(name, wIn, hIn, pxW, pxH) {
    var n = (name || "").toLowerCase();
    if (/logo|wordmark|icon|favicon/.test(n)) return true;
    if (wIn && hIn && wIn < 1.35 && hIn < 1.35) return true;
    if (pxW && pxH && pxW < 220 && pxH < 220) return true;
    return false;
  }
  async function ingestPptx(file) {
    var zip = await JSZip.loadAsync(await fileToArray(file));
    var slides = Object.keys(zip.files)
      .filter(function (n) { return /^ppt\/slides\/slide\d+\.xml$/i.test(n); })
      .sort(function (a, b) {
        return parseInt(a.match(/(\d+)/)[1], 10) - parseInt(b.match(/(\d+)/)[1], 10);
      });
    if (!slides.length) {
      await ingestPptxMediaDump(zip, file.name);
      return;
    }
    var got = 0;
    for (var s = 0; s < slides.length; s++) {
      var xml = await zip.files[slides[s]].async("string");
      var relName = slides[s].replace("slides/", "slides/_rels/") + ".rels";
      var rels = zip.files[relName] ? parseRels(await zip.files[relName].async("string")) : {};
      var pics = xml.match(/<p:pic>[\s\S]*?<\/p:pic>/g) || [];
      var slideText = [];
      xml.replace(/<a:t>([^<]*)<\/a:t>/g, function (_, t) {
        t = String(t || "").trim();
        if (t) slideText.push({ text: t, x: 0, y: 0, w: 1, h: 1 });
        return _;
      });
      harvestFacts(slideText, file.name);
      var slidePhotos = [];
      for (var i = 0; i < pics.length; i++) {
        var pic = pics[i];
        var rid = (pic.match(/r:embed="(rId\d+)"/) || [])[1];
        var media = rid && rels[rid];
        if (!media || /\.(emf|wmf)$/i.test(media)) continue;
        var f = zip.files[media] || zip.files["ppt/" + media.replace(/^\/?ppt\//, "")];
        if (!f) continue;
        var ext = pic.match(/<a:ext cx="(\d+)" cy="(\d+)"/);
        var wIn = ext ? emuInch(ext[1]) : 0;
        var hIn = ext ? emuInch(ext[2]) : 0;
        var nm = ((pic.match(/name="([^"]*)"/) || [])[1] || "") + " " + media;
        if (isLogoPic(nm, wIn, hIn, 0, 0)) continue;
        var blob = await f.async("blob");
        var type = blob.type || guessType(media);
        var named = new Blob([blob], { type: type.indexOf("image/") === 0 ? type : "image/jpeg" });
        var data = await blobToDataUrl(named);
        var cropped = await cropBySrc(data, srcRectCrop(pic));
        var ph = await photoFromData(file.name + " s" + (s + 1) + " · " + (slidePhotos.length + 1), cropped, file.name);
        if (isLogoPic(nm, wIn, hIn, ph.nw, ph.nh)) continue;
        if (ph.nw < 140 || ph.nh < 140) continue;
        slidePhotos.push(ph);
      }
      if (slidePhotos.length >= 3) {
        var slideSpecs = collectSpecs(slideText);
        slidePhotos.forEach(function (ph, k) {
          var spx = slideSpecs[k] || {};
          ph.item = ph.item || spx.item || "";
          ph.size = ph.size || spx.size || "";
          ph.material = ph.material || spx.material || "";
          photos.push(ph);
          got++;
        });
      } else {
        for (var sp = 0; sp < slidePhotos.length; sp++) {
          await explodeIntoPhotos(slidePhotos[sp], slideText);
          got++;
        }
      }
    }
    if (!got) await ingestPptxMediaDump(zip, file.name);
  }
  async function ingestPptxMediaDump(zip, srcName) {
    var names = Object.keys(zip.files)
      .filter(function (n) { return /^ppt\/media\//i.test(n) && !zip.files[n].dir; })
      .sort();
    if (!names.length) throw new Error(srcName + " has no media.");
    for (var i = 0; i < names.length; i++) {
      var n = names[i];
      if (/\.(emf|wmf)$/i.test(n)) continue;
      var blob = await zip.files[n].async("blob");
      var type = blob.type || guessType(n);
      if (type.indexOf("image/") !== 0 && !/\.(png|jpe?g|gif|webp|bmp)$/i.test(n)) continue;
      var named = new Blob([blob], { type: type.indexOf("image/") === 0 ? type : "image/jpeg" });
      var ph = await photoFromData(srcName + " · " + n.split("/").pop(), await blobToDataUrl(named), srcName);
      if (ph.nw < 200 || ph.nh < 200) continue;
      await explodeIntoPhotos(ph);
    }
  }

  function keepOriginalPages() {
    var sel = $("perSlide");
    return sel && sel.value === "original";
  }
  async function explodeIntoPhotos(photo, pageLabels) {
    if (keepOriginalPages() || !photo || photo.nw < 280 || photo.nh < 240) {
      photos.push(photo);
      return;
    }
    var cells = await splitCatalogPage(photo, pageLabels);
    if (cells.length >= 2) {
      for (var i = 0; i < cells.length; i++) photos.push(cells[i]);
      return;
    }
    if (cells.length === 1) {
      var c = cells[0];
      photo.item = photo.item || c.item;
      photo.size = photo.size || c.size;
      photo.material = photo.material || c.material;
      photo.nameLabel = photo.nameLabel || c.nameLabel;
      photo.price = photo.price || c.price;
      photo.moq = photo.moq || c.moq;
      photo.lead = photo.lead || c.lead;
      if (c.nw * c.nh < photo.nw * photo.nh * 0.82) {
        photos.push(c);
        return;
      }
    }
    photos.push(photo);
  }
  function loadImage(data) {
    return new Promise(function (res, rej) {
      var img = new Image();
      img.onload = function () { res(img); };
      img.onerror = function () { rej(new Error("Could not read image")); };
      img.src = data;
    });
  }
  function isPaperPx(data, p) {
    var r = data[p], g = data[p + 1], b = data[p + 2];
    var v = (r + g + b) / 3;
    if (v < 214) return false;
    var spread = Math.max(r, g, b) - Math.min(r, g, b);
    return spread < 52;
  }
  function isFloorPx(data, p) {
    var r = data[p], g = data[p + 1], b = data[p + 2];
    var v = (r + g + b) / 3;
    var spread = Math.max(r, g, b) - Math.min(r, g, b);
    if (spread >= 30) return false;
    if (v < 68 || v >= 214) return false;
    return true;
  }
  function lumAt(data, w, h, x, y) {
    if (x < 0 || y < 0 || x >= w || y >= h) return 0;
    var p = (y * w + x) * 4;
    return (data[p] + data[p + 1] + data[p + 2]) / 3;
  }
  function edgeAt(data, w, h, x, y) {
    var c = lumAt(data, w, h, x, y);
    var dx = lumAt(data, w, h, x + 2, y) - lumAt(data, w, h, x - 2, y);
    var dy = lumAt(data, w, h, x, y + 2) - lumAt(data, w, h, x, y - 2);
    return Math.abs(dx) + Math.abs(dy);
  }
  function isObjectPx(data, w, h, x, y) {
    var p = (y * w + x) * 4;
    if (isPaperPx(data, p)) return false;
    if (edgeAt(data, w, h, x, y) > 36) return true;
    if (isFloorPx(data, p)) return false;
    return true;
  }
  function clampRect(r, bw, bh) {
    var x = Math.max(0, Math.floor(r.x));
    var y = Math.max(0, Math.floor(r.y));
    var w = Math.min(bw - x, Math.ceil(r.w));
    var h = Math.min(bh - y, Math.ceil(r.h));
    return { x: x, y: y, w: Math.max(1, w), h: Math.max(1, h) };
  }
  function mergeBoxes(list) {
    var boxes = list.slice();
    var changed = true;
    function iou(a, b) {
      var x1 = Math.max(a.x, b.x), y1 = Math.max(a.y, b.y);
      var x2 = Math.min(a.x + a.w, b.x + b.w), y2 = Math.min(a.y + a.h, b.y + b.h);
      var iw = Math.max(0, x2 - x1), ih = Math.max(0, y2 - y1);
      var inter = iw * ih;
      if (!inter) return 0;
      return inter / (a.w * a.h + b.w * b.h - inter);
    }
    while (changed) {
      changed = false;
      for (var i = 0; i < boxes.length; i++) {
        for (var j = i + 1; j < boxes.length; j++) {
          if (iou(boxes[i], boxes[j]) < 0.12) continue;
          var a = boxes[i], b = boxes[j];
          var x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
          boxes[i] = {
            x: x, y: y,
            w: Math.max(a.x + a.w, b.x + b.w) - x,
            h: Math.max(a.y + a.h, b.y + b.h) - y
          };
          boxes.splice(j, 1);
          changed = true;
          break;
        }
        if (changed) break;
      }
    }
    return boxes;
  }
  function findObjectBoxes(data, w, h, rect) {
    var step = 4;
    var gw = Math.max(1, Math.ceil(rect.w / step));
    var gh = Math.max(1, Math.ceil(rect.h / step));
    var mark = new Uint8Array(gw * gh);
    var gx, gy, x, y;
    for (gy = 0; gy < gh; gy++) {
      for (gx = 0; gx < gw; gx++) {
        x = rect.x + gx * step;
        y = rect.y + gy * step;
        if (x >= rect.x + rect.w || y >= rect.y + rect.h) continue;
        if (isObjectPx(data, w, h, x, y)) mark[gy * gw + gx] = 1;
      }
    }
    var seen = new Uint8Array(gw * gh);
    var boxes = [];
    var minArea = Math.max(28, (gw * gh) * 0.01);
    for (var i = 0; i < mark.length; i++) {
      if (!mark[i] || seen[i]) continue;
      var q = [i], n = 0, minx = gw, miny = gh, maxx = 0, maxy = 0;
      seen[i] = 1;
      while (q.length) {
        var id = q.pop();
        var cx = id % gw, cy = (id / gw) | 0;
        n++;
        if (cx < minx) minx = cx;
        if (cy < miny) miny = cy;
        if (cx > maxx) maxx = cx;
        if (cy > maxy) maxy = cy;
        var nb = [id - 1, id + 1, id - gw, id + gw];
        for (var k = 0; k < 4; k++) {
          var nid = nb[k];
          if (nid < 0 || nid >= mark.length || seen[nid] || !mark[nid]) continue;
          var nx = nid % gw;
          if (k < 2 && Math.abs(nx - cx) !== 1) continue;
          seen[nid] = 1;
          q.push(nid);
        }
      }
      if (n < minArea) continue;
      var box = {
        x: rect.x + minx * step - 10,
        y: rect.y + miny * step - 10,
        w: (maxx - minx + 1) * step + 20,
        h: (maxy - miny + 1) * step + 20
      };
      box = clampRect(box, w, h);
      box = clampRect({
        x: Math.max(rect.x, box.x),
        y: Math.max(rect.y, box.y),
        w: Math.min(rect.x + rect.w, box.x + box.w) - Math.max(rect.x, box.x),
        h: Math.min(rect.y + rect.h, box.y + box.h) - Math.max(rect.y, box.y)
      }, w, h);
      if (box.w < 50 || box.h < 50) continue;
      if (box.w / box.h > 4.8 && box.h < rect.h * 0.22) continue;
      if (box.h / box.w > 4.8 && box.w < rect.w * 0.22) continue;
      boxes.push(box);
    }
    return mergeBoxes(boxes);
  }
  function hasStudioFloor(data, w, rect) {
    var band = {
      x: rect.x + Math.floor(rect.w * 0.08),
      y: rect.y + Math.floor(rect.h * 0.58),
      w: Math.max(20, Math.floor(rect.w * 0.84)),
      h: Math.max(20, Math.floor(rect.h * 0.38))
    };
    var floor = 0, paper = 0, n = 0, x, y, p;
    for (y = band.y; y < band.y + band.h; y += 3) {
      for (x = band.x; x < band.x + band.w; x += 3) {
        p = (y * w + x) * 4;
        if (isFloorPx(data, p)) floor++;
        else if (isPaperPx(data, p)) paper++;
        n++;
      }
    }
    if (!n) return false;
    return floor / n > 0.28 && paper / n < 0.45;
  }
  function paperFrac(data, w, rect) {
    var paper = 0, n = 0, x, y, p;
    for (y = rect.y; y < rect.y + rect.h; y += 4) {
      for (x = rect.x; x < rect.x + rect.w; x += 4) {
        p = (y * w + x) * 4;
        if (isPaperPx(data, p)) paper++;
        n++;
      }
    }
    return n ? paper / n : 0;
  }
  function cellIsJunk(data, w, rect) {
    if (!rect || rect.w < 90 || rect.h < 90) return true;
    if (rect.h < 130 && rect.w / rect.h > 2.8) return true;
    if (rect.w < 130 && rect.h / rect.w > 2.8) return true;
    var obj = 0, floor = 0, paper = 0, edge = 0, n = 0, x, y, p;
    var imgH = ((data.length / 4) / w) | 0;
    for (y = rect.y; y < rect.y + rect.h; y += 3) {
      for (x = rect.x; x < rect.x + rect.w; x += 3) {
        p = (y * w + x) * 4;
        if (isPaperPx(data, p)) paper++;
        else if (isFloorPx(data, p)) floor++;
        else obj++;
        if (edgeAt(data, w, imgH, x, y) > 28) edge++;
        n++;
      }
    }
    if (!n) return true;
    if (obj / n < 0.05 && floor / n > 0.3) return true;
    if (obj / n < 0.045 && paper / n > 0.55) return true;
    if (edge / n < 0.02 && obj / n < 0.12) return true;
    return false;
  }
  function gutterHitsObject(cut, vertical, rect, boxes) {
    if (!boxes || !boxes.length) return false;
    var line = vertical ? rect.x + cut : rect.y + cut;
    var pad = 14;
    for (var i = 0; i < boxes.length; i++) {
      var b = boxes[i];
      if (vertical && b.w > rect.w * 0.48) continue;
      if (!vertical && b.h > rect.h * 0.48) continue;
      if (vertical) {
        if (line > b.x + pad && line < b.x + b.w - pad) return true;
      } else if (line > b.y + pad && line < b.y + b.h - pad) return true;
    }
    return false;
  }
  function filterGutters(cuts, vertical, rect, boxes) {
    if (!cuts || !cuts.length) return [];
    return cuts.filter(function (c) { return !gutterHitsObject(c, vertical, rect, boxes); });
  }
  function wellSeparated(boxes) {
    if (!boxes || boxes.length < 2) return false;
    var i, j, a, b, gap;
    for (i = 0; i < boxes.length; i++) {
      for (j = i + 1; j < boxes.length; j++) {
        a = boxes[i]; b = boxes[j];
        var xGap = Math.max(0, Math.max(a.x - (b.x + b.w), b.x - (a.x + a.w)));
        var yGap = Math.max(0, Math.max(a.y - (b.y + b.h), b.y - (a.y + a.h)));
        gap = Math.max(xGap, yGap);
        if (gap < 4) return false;
      }
    }
    return true;
  }
  function padBox(b, pad, rect) {
    return {
      x: Math.max(rect.x, b.x - pad),
      y: Math.max(rect.y, b.y - pad),
      w: Math.min(rect.x + rect.w, b.x + b.w + pad) - Math.max(rect.x, b.x - pad),
      h: Math.min(rect.y + rect.h, b.y + b.h + pad) - Math.max(rect.y, b.y - pad)
    };
  }
  var aiModel = st.aiModel;
  var aiTried = st.aiTried;
  var visionOk = st.visionOk === true ? true : null;
  var visionUrl = null;
  var VISION_URL = "http://127.0.0.1:4181/cut";
  var VISION_FALLBACK = "http://127.0.0.1:4181/vision";
  var VISION_CLOUD = "https://alpha-proposal-cut.tranchaungoclong.workers.dev/cut";
  function loadScript(src) {
    return new Promise(function (res, rej) {
      if (document.querySelector('script[src="' + src + '"]')) { res(); return; }
      var s = document.createElement("script");
      s.src = src;
      s.onload = function () { res(); };
      s.onerror = function () { rej(new Error("AI script failed")); };
      document.head.appendChild(s);
    });
  }
  async function ensureAi() {
    if (!$("aiOn") || !$("aiOn").checked) return null;
    if (aiModel) return aiModel;
    if (aiTried) return null;
    aiTried = true;
    try {
      setStatus("Loading object AI…");
      await loadScript("https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.17.0/dist/tf.min.js");
      await loadScript("https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd@2.2.3/dist/coco-ssd.min.js");
      if (!root.cocoSsd) return null;
      aiModel = await root.cocoSsd.load({ base: "lite_mobilenet_v2" });
      return aiModel;
    } catch (e) {
      aiModel = null;
      return null;
    }
  }
  async function pingVision() {
    if (visionOk === true && visionUrl) return true;
    try {
      var r = await fetch("http://127.0.0.1:4181/health");
      var j = await r.json();
      if (r.ok && j && j.ok) { visionOk = true; visionUrl = VISION_URL; return true; }
    } catch (e) {}
    try {
      var c = await fetch(VISION_CLOUD.replace(/\/cut$/, "/health"));
      var cj = await c.json();
      if (c.ok && cj && cj.ok) { visionOk = true; visionUrl = VISION_CLOUD; return true; }
    } catch (e) {}
    return false;
  }
  function shrinkCanvas(src, maxEdge) {
    var w = src.width, h = src.height;
    var scale = Math.min(1, maxEdge / Math.max(w, h));
    if (scale >= 1) return src;
    var c = document.createElement("canvas");
    c.width = Math.max(2, Math.round(w * scale));
    c.height = Math.max(2, Math.round(h * scale));
    c.getContext("2d").drawImage(src, 0, 0, c.width, c.height);
    return c;
  }
  function mapVisionBoxes(j, canvas, small, work) {
    var sx = canvas.width / small.width;
    var sy = canvas.height / small.height;
    return (j.boxes || []).map(function (b) {
      var mapped = padBox({
        x: b.x * small.width * sx,
        y: b.y * small.height * sy,
        w: b.w * small.width * sx,
        h: b.h * small.height * sy
      }, 18, work);
      mapped.item = b.item || "";
      mapped.name = b.name || "";
      mapped.material = b.material || "";
      mapped.size = b.size || "";
      mapped.price = b.price || "";
      mapped.moq = b.moq || "";
      mapped.lead = b.lead || "";
      return mapped;
    }).filter(function (b) { return b.w >= 40 && b.h >= 40; });
  }
  async function detectVisionCut(canvas, work) {
    if (!$("aiOn") || !$("aiOn").checked) return null;
    if (!(await pingVision())) return null;
    try {
      setPipe(2, "run");
      setStatus("Agent looking at the page…");
      var small = shrinkCanvas(canvas, 1400);
      var payload = JSON.stringify({ image: small.toDataURL("image/jpeg", 0.9) });
      async function postCut(url) {
        try {
          var rr = await fetch(url, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: payload
          });
          var jj = await rr.json().catch(function () { return {}; });
          return { ok: !!(rr.ok && jj && !jj.error && (jj.boxes || jj.kind)), j: jj };
        } catch (e) {
          return { ok: false, j: {} };
        }
      }
      var r;
      if (visionUrl === VISION_CLOUD) {
        r = await postCut(VISION_CLOUD);
      } else {
        r = await postCut(VISION_URL);
        if (!r.ok) r = await postCut(VISION_FALLBACK);
        if (!r.ok) r = await postCut(VISION_CLOUD);
      }
      if (!r.ok) throw new Error((r.j && r.j.error) || "vision failed");
      var j = r.j;
      var kind = j.kind || (j.boxes && j.boxes.length ? "catalog" : "lifestyle");
      return { kind: kind, boxes: mapVisionBoxes(j, canvas, small, work), reason: j.reason || "" };
    } catch (e) {
      return null;
    }
  }
  async function detectVisionBoxes(canvas, work) {
    var cut = await detectVisionCut(canvas, work);
    if (!cut) return [];
    if (cut.kind === "lifestyle") return [];
    return cut.boxes;
  }
  async function detectCocoBoxes(canvas, work) {
    var model = await ensureAi();
    if (!model) return [];
    try {
      var preds = await model.detect(canvas, 20, 0.32);
      return (preds || []).map(function (p) {
        var b = p.bbox || [0, 0, 0, 0];
        return padBox({ x: b[0], y: b[1], w: b[2], h: b[3] }, 8, work);
      }).filter(function (b) { return b.w >= 40 && b.h >= 40; });
    } catch (e) {
      return [];
    }
  }
  async function detectAiBoxes(canvas, work) {
    var vis = await detectVisionBoxes(canvas, work);
    if (vis.length) return vis;
    return detectCocoBoxes(canvas, work);
  }
  function paperLine(data, w, rect, i, vertical) {
    var paper = 0, n = 0, x, y, p;
    if (vertical) {
      x = rect.x + i;
      for (y = rect.y; y < rect.y + rect.h; y += 2) {
        p = (y * w + x) * 4;
        if (isPaperPx(data, p)) paper++;
        n++;
      }
    } else {
      y = rect.y + i;
      for (x = rect.x; x < rect.x + rect.w; x += 2) {
        p = (y * w + x) * 4;
        if (isPaperPx(data, p)) paper++;
        n++;
      }
    }
    return n ? paper / n : 0;
  }
  function findGutters(data, w, rect, vertical) {
    var len = vertical ? rect.w : rect.h;
    if (len < 40) return [];
    var scores = [];
    var i;
    for (i = 0; i < len; i++) scores.push(paperLine(data, w, rect, i, vertical));
    var sm = scores.slice();
    for (i = 1; i < len - 1; i++) sm[i] = (scores[i - 1] + scores[i] + scores[i + 1]) / 3;
    var max = 0, mid = 0;
    for (i = 0; i < len; i++) {
      if (sm[i] > max) max = sm[i];
      mid += sm[i];
    }
    mid /= len;
    var thresh = Math.max(0.62, Math.min(0.9, max * 0.78, mid + 0.18));
    var edge = Math.max(8, Math.floor(len * 0.04));
    var minRun = 2;
    var maxRun = Math.floor(len * 0.22);
    var cuts = [];
    i = edge;
    while (i < len - edge) {
      if (sm[i] < thresh) { i++; continue; }
      var a = i;
      while (i < len - edge && sm[i] >= thresh) i++;
      var run = i - a;
      if (run >= minRun && run <= maxRun) cuts.push(Math.round(a + run / 2));
    }
    var minGap = Math.max(48, Math.floor(len * 0.08));
    var cleaned = [];
    cuts.forEach(function (c) {
      if (!cleaned.length || c - cleaned[cleaned.length - 1] >= minGap) cleaned.push(c);
    });
    if (!cleaned.length) {
      var lo = Math.floor(len * 0.32);
      var hi = Math.ceil(len * 0.68);
      var best = -1, bestS = thresh;
      for (i = lo; i < hi; i++) {
        var acc = 0, k;
        for (k = -2; k <= 2; k++) acc += sm[i + k] || 0;
        acc /= 5;
        if (acc > bestS) { bestS = acc; best = i; }
      }
      if (best > 0 && bestS >= Math.max(0.55, thresh * 0.92)) cleaned.push(best);
    }
    return cleaned;
  }
  function findSafeGutters(data, w, rect, vertical, boxes) {
    return filterGutters(findGutters(data, w, rect, vertical), vertical, rect, boxes);
  }
  function paperCuts(data, w, rect, vertical) {
    var len = vertical ? rect.w : rect.h;
    if (len < 110) return [];
    var sm = [];
    var i;
    for (i = 0; i < len; i++) sm.push(paperLine(data, w, rect, i, vertical));
    for (i = 1; i < len - 1; i++) sm[i] = (sm[i - 1] + sm[i] + sm[i + 1]) / 3;
    var edge = Math.max(10, Math.floor(len * 0.04));
    var minGap = Math.max(48, Math.floor(len * 0.12));
    var cuts = [];
    i = edge;
    while (i < len - edge) {
      if (sm[i] < 0.38) { i++; continue; }
      var a = i, peak = sm[i];
      while (i < len - edge && sm[i] >= 0.38) { if (sm[i] > peak) peak = sm[i]; i++; }
      if (i - a >= 2 && peak >= 0.46 && (!cuts.length || (a + i) / 2 - cuts[cuts.length - 1] >= minGap)) {
        cuts.push(Math.round((a + i) / 2));
      }
    }
    return cuts;
  }
  function columnCuts(data, w, rect) {
    return paperCuts(data, w, rect, true);
  }
  function copySpec(from, onto) {
    onto.item = from.item || "";
    onto.name = from.name || "";
    onto.material = from.material || "";
    onto.size = from.size || "";
    onto.price = from.price || "";
    onto.moq = from.moq || "";
    onto.lead = from.lead || "";
    return onto;
  }
  function splitBoxOnPaper(data, w, box, work) {
    var v = paperCuts(data, w, box, true);
    var hz = paperCuts(data, w, box, false);
    if (!v.length && !hz.length) return [box];
    var xs = [box.x].concat(v.map(function (c) { return box.x + c; })).concat([box.x + box.w]);
    var ys = [box.y].concat(hz.map(function (c) { return box.y + c; })).concat([box.y + box.h]);
    var out = [];
    var r, c, cell;
    for (r = 0; r < ys.length - 1; r++) {
      for (c = 0; c < xs.length - 1; c++) {
        cell = { x: xs[c], y: ys[r], w: xs[c + 1] - xs[c], h: ys[r + 1] - ys[r] };
        if (cell.w < 50 || cell.h < 50) continue;
        if (cellIsJunk(data, w, cell)) continue;
        out.push(copySpec(box, cell));
      }
    }
    return out.length >= 2 ? out : [box];
  }
  function breakWideBoxes(data, w, boxes, work) {
    var out = [];
    (boxes || []).forEach(function (b) {
      var fat = b.w >= work.w * 0.32 || b.h >= work.h * 0.32 || b.w >= b.h * 1.15;
      if (!fat) { out.push(b); return; }
      var parts = splitBoxOnPaper(data, w, b, work);
      if (parts.length < 2) { out.push(b); return; }
      parts.forEach(function (p) {
        if (p.w >= work.w * 0.4 || p.h >= work.h * 0.4) {
          var again = splitBoxOnPaper(data, w, p, work);
          again.forEach(function (q) { out.push(q); });
        } else {
          out.push(p);
        }
      });
    });
    return out;
  }
  function paperGridCells(data, w, work) {
    var cream = paperFrac(data, w, work);
    if (cream < 0.12) return null;
    var parts = splitBoxOnPaper(data, w, work, work);
    if (!parts || parts.length < 2) return null;
    return parts.filter(function (p) {
      return p.w < work.w * 0.92 || p.h < work.h * 0.92;
    });
  }
  async function splitFatBox(canvas, data, w, h, box, work) {
    var cream = paperFrac(data, w, box);
    if (cream < 0.18) return [box];
    var area = (box.w * box.h) / Math.max(1, work.w * work.h);
    var fat = area > 0.16 || box.w > work.w * 0.3 || box.h > work.h * 0.3;
    if (!fat) return [box];
    var paper = splitBoxOnPaper(data, w, box, work);
    if (paper.length >= 2) {
      var flat = [];
      for (var i = 0; i < paper.length; i++) {
        var more = await splitFatBox(canvas, data, w, h, paper[i], work);
        more.forEach(function (p) { flat.push(p); });
      }
      return flat.length >= 2 ? flat : [box];
    }
    return [box];
  }
  async function explodeGroups(canvas, data, w, h, boxes, work) {
    var out = [];
    for (var i = 0; i < (boxes || []).length; i++) {
      var parts = await splitFatBox(canvas, data, w, h, boxes[i], work);
      parts.forEach(function (p) { out.push(p); });
    }
    return out.length ? out : boxes;
  }
  function contentBox(data, w, h) {
    var minX = w, minY = h, maxX = 0, maxY = 0, x, y, p;
    for (y = 0; y < h; y += 2) {
      for (x = 0; x < w; x += 2) {
        p = (y * w + x) * 4;
        if (!isPaperPx(data, p)) {
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX <= minX || maxY <= minY) return { x: 0, y: 0, w: w, h: h };
    return {
      x: Math.max(0, minX - 4),
      y: Math.max(0, minY - 4),
      w: Math.min(w, maxX + 4) - Math.max(0, minX - 4),
      h: Math.min(h, maxY + 4) - Math.max(0, minY - 4)
    };
  }
  function cropCanvas(src, rect) {
    var c = document.createElement("canvas");
    c.width = Math.max(2, Math.round(rect.w));
    c.height = Math.max(2, Math.round(rect.h));
    c.getContext("2d").drawImage(src, rect.x, rect.y, rect.w, rect.h, 0, 0, c.width, c.height);
    return c;
  }
  function cellBusy(data, w, rect) {
    var dark = 0, n = 0, x, y, p;
    for (y = rect.y; y < rect.y + rect.h; y += 3) {
      for (x = rect.x; x < rect.x + rect.w; x += 3) {
        p = (y * w + x) * 4;
        if (!isPaperPx(data, p)) dark++;
        n++;
      }
    }
    return n ? dark / n : 0;
  }
  function paperBand(data, w, rect, vertical, fromStart) {
    var len = vertical ? rect.w : rect.h;
    var run = 0, i, score;
    var cap = Math.floor(len * 0.18);
    for (i = 0; i < cap; i++) {
      score = paperLine(data, w, rect, fromStart ? i : len - 1 - i, vertical);
      if (score >= 0.82) run = i + 1;
      else if (i > 6) break;
    }
    return run;
  }
  function trimPaper(data, w, rect) {
    var l = paperBand(data, w, rect, true, true);
    var r = paperBand(data, w, rect, true, false);
    var t = paperBand(data, w, rect, false, true);
    var b = paperBand(data, w, rect, false, false);
    var pad = 3;
    return {
      x: rect.x + l + pad,
      y: rect.y + t + pad,
      w: Math.max(40, rect.w - l - r - pad * 2),
      h: Math.max(40, rect.h - t - b - pad * 2)
    };
  }
  function lookbookColumns(data, w, work, boxes) {
    if (hasStudioFloor(data, w, work) && paperFrac(data, w, work) < 0.22) return null;
    var v = findSafeGutters(data, w, work, true, boxes);
    if (v.length < 1) return null;
    var xs = [0].concat(v).concat([work.w]);
    var cols = [];
    var i, cell;
    for (i = 0; i < xs.length - 1; i++) {
      cell = {
        x: work.x + xs[i],
        y: work.y,
        w: xs[i + 1] - xs[i],
        h: work.h
      };
      if (cell.w < 70 || cell.h < 90) continue;
      if (cellBusy(data, w, cell) < 0.025) continue;
      cols.push(cell);
    }
    if (cols.length && cols[0].w < work.w * 0.11) cols = cols.slice(1);
    if (cols.length < 2) return null;
    var widths = cols.map(function (c) { return c.w; }).slice().sort(function (a, b) { return a - b; });
    var median = widths[Math.floor(widths.length / 2)];
    var sku = cols.filter(function (c) { return c.w < median * 1.38; });
    var hero = cols.filter(function (c) { return c.w >= median * 1.5; });
    if (hero.length && sku.length >= 2) return sku;
    if (cols.length >= 3) return cols;
    return cols;
  }
  function bestPaperCut(data, w, rect) {
    var lo = Math.floor(rect.h * 0.28);
    var hi = Math.ceil(rect.h * 0.72);
    var best = -1, bestS = 0.42, i, acc, k;
    for (i = lo; i < hi; i++) {
      acc = 0;
      for (k = -3; k <= 3; k++) acc += paperLine(data, w, rect, i + k, false);
      acc /= 7;
      if (acc > bestS) { bestS = acc; best = i; }
    }
    return best;
  }
  function splitStacked(data, w, rect, boxes) {
    if (!rect || rect.h < 140) return [rect];
    var local = (boxes && boxes.length) ? boxes.filter(function (b) {
      var cx = b.x + b.w / 2, cy = b.y + b.h / 2;
      return cx >= rect.x && cx <= rect.x + rect.w && cy >= rect.y && cy <= rect.y + rect.h;
    }) : [];
    if (local.length === 1 && local[0].h > rect.h * 0.55) return [rect];
    var tall = rect.h / Math.max(1, rect.w) >= 1.15;
    var hz = findSafeGutters(data, w, rect, false, local.length ? local : boxes);
    if (!hz.length && tall) {
      var mid = bestPaperCut(data, w, rect);
      if (mid > 0 && !gutterHitsObject(mid, false, rect, local.length ? local : boxes)) hz = [mid];
    }
    if (!hz.length) return [rect];
    var ys = [0].concat(hz).concat([rect.h]);
    var out = [];
    var r, cell;
    for (r = 0; r < ys.length - 1; r++) {
      cell = {
        x: rect.x,
        y: rect.y + ys[r],
        w: rect.w,
        h: ys[r + 1] - ys[r]
      };
      if (cell.h < 64) continue;
      if (cellBusy(data, w, cell) < 0.03) continue;
      if (cellIsJunk(data, w, cell)) continue;
      out.push(trimPaper(data, w, cell));
    }
    if (out.length < 2) return [rect];
    var again = [];
    out.forEach(function (p) {
      if (p.h / Math.max(1, p.w) >= 1.35 && p.h >= 160) {
        splitStacked(data, w, p, boxes).forEach(function (q) { again.push(q); });
      } else {
        again.push(p);
      }
    });
    return again.length ? again : [rect];
  }
  async function photosFromBoxes(photo, canvas, data, w, boxes, pageLabels, work) {
    var listed = collectSpecs(pageLabels);
    var sorted = (boxes || []).slice().sort(function (a, b) {
      if (Math.abs(a.y - b.y) > 40) return a.y - b.y;
      return a.x - b.x;
    });
    var cells = [];
    var seen = {};
    for (var i = 0; i < sorted.length; i++) {
      var b = sorted[i];
      var ab = padBox(b, 18, work);
      if (ab.w < 90 || ab.h < 90) continue;
      if (cellIsJunk(data, w, ab)) continue;
      var key = [Math.round(ab.x / 8), Math.round(ab.y / 8), Math.round(ab.w / 8), Math.round(ab.h / 8)].join(":");
      if (seen[key]) continue;
      seen[key] = true;
      if (cellBusy(data, w, ab) < 0.02) continue;
      var aspec = specForRect(pageLabels, ab) || {};
      var placed = (pageLabels || []).some(function (l) { return (l.x || 0) > 2 || (l.y || 0) > 2 || (l.w || 0) > 8; });
      var listedRow = placed ? (listed[cells.length] || {}) : {};
      aspec.item = harvestItem(aspec.item || b.item || listedRow.item || "") || "";
      var nm = aspec.name || b.name || "";
      if (nm && !/\d/.test(nm) && /collection|cottage|rattan|pumpkin|decor|harvest/i.test(nm)) nm = "";
      aspec.name = nm;
      aspec.material = aspec.material || b.material || listedRow.material || "";
      aspec.size = aspec.size || b.size || listedRow.size || "";
      aspec.price = aspec.price || b.price || "";
      aspec.moq = aspec.moq || b.moq || "";
      aspec.lead = aspec.lead || b.lead || "";
      aspec.lookbook = true;
      cells.push(await photoFromData(
        photo.name + " · " + (aspec.item || String(cells.length + 1)),
        cropCanvas(canvas, ab).toDataURL("image/png"),
        photo.src,
        aspec
      ));
    }
    return cells;
  }
  async function splitCatalogPage(photo, pageLabels) {
    var img = await loadImage(photo.data);
    var canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    var ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0);
    var w = canvas.width, h = canvas.height;
    var data = ctx.getImageData(0, 0, w, h).data;
    var box = contentBox(data, w, h);
    var head = paperBand(data, w, box, false, true);
    var foot = paperBand(data, w, box, false, false);
    if (head < box.h * 0.03) head = 0;
    if (foot < box.h * 0.02) foot = 0;
    if (head > box.h * 0.28) head = Math.round(box.h * 0.12);
    var sideL = paperBand(data, w, box, true, true);
    var sideR = paperBand(data, w, box, true, false);
    var work = {
      x: box.x + Math.min(sideL, Math.round(box.w * 0.03)),
      y: box.y + head,
      w: Math.max(40, box.w - Math.min(sideL, Math.round(box.w * 0.03)) - Math.min(sideR, Math.round(box.w * 0.03))),
      h: Math.max(40, box.h - head - foot)
    };
    var pixelBoxes = findObjectBoxes(data, w, h, work);
    var cream = paperFrac(data, w, work);
    var studio = hasStudioFloor(data, w, work);
    function notFullPage(b) {
      return !(b.w > work.w * 0.88 && b.h > work.h * 0.88);
    }
    if (cream < 0.20 || (studio && cream < 0.28)) {
      return [];
    }
    var gridCells = paperGridCells(data, w, work);
    var agentCut = await detectVisionCut(canvas, work);
    if (agentCut) {
      var visBoxes = (agentCut.boxes || []).filter(notFullPage);
      var agentCells = await photosFromBoxes(photo, canvas, data, w, visBoxes, pageLabels, work);
      if (agentCells.length >= 2) return agentCells;
      if (agentCells.length === 1 && visBoxes[0] && (visBoxes[0].w < work.w * 0.75 || visBoxes[0].h < work.h * 0.75)) {
        return agentCells;
      }
    }
    if (gridCells && gridCells.length >= 2) {
      var fromGrid = await photosFromBoxes(photo, canvas, data, w, gridCells, pageLabels, work);
      if (fromGrid.length >= 2) return fromGrid;
    }
    var aiBoxes = await detectCocoBoxes(canvas, work);
    aiBoxes = breakWideBoxes(data, w, aiBoxes, work);
    aiBoxes = await explodeGroups(canvas, data, w, h, aiBoxes, work);
    if (gridCells && gridCells.length >= 2 && gridCells.length > aiBoxes.length) {
      aiBoxes = await explodeGroups(canvas, data, w, h, gridCells, work);
    }
    var cocoCells = await photosFromBoxes(photo, canvas, data, w, aiBoxes.filter(notFullPage), pageLabels, work);
    if (cocoCells.length >= 2) return cocoCells;
    var objects = mergeBoxes(aiBoxes.concat(pixelBoxes)).filter(function (b) {
      return !cellIsJunk(data, w, b);
    });
    function pieces(rect, depth) {
      if (depth > 3 || rect.w < 140 || rect.h < 110) return [rect];
      var v = findSafeGutters(data, w, rect, true, objects);
      var hz = findSafeGutters(data, w, rect, false, objects);
      var xs = [0].concat(v).concat([rect.w]);
      var ys = [0].concat(hz).concat([rect.h]);
      if (xs.length === 2 && ys.length === 2) return [rect];
      var out = [];
      var r, c, cell;
      for (r = 0; r < ys.length - 1; r++) {
        for (c = 0; c < xs.length - 1; c++) {
          cell = {
            x: rect.x + xs[c],
            y: rect.y + ys[r],
            w: xs[c + 1] - xs[c],
            h: ys[r + 1] - ys[r]
          };
          if (cell.w < 90 || cell.h < 90) continue;
          if (cellBusy(data, w, cell) < 0.03) continue;
          if (cellIsJunk(data, w, cell)) continue;
          cell = trimPaper(data, w, cell);
          if (depth < 2 && (cell.w > rect.w * 0.58 || cell.h > rect.h * 0.58) && (v.length || hz.length)) {
            pieces(cell, depth + 1).forEach(function (p) { out.push(p); });
          } else {
            out.push(cell);
          }
        }
      }
      return out.length ? out : [rect];
    }
    var look = lookbookColumns(data, w, work, objects);
    var fromLook = !!(look && look.length >= 2);
    var raw = fromLook ? look : pieces(work, 0);
    var rects = [];
    raw.forEach(function (col) {
      splitStacked(data, w, col, objects).forEach(function (p) { rects.push(p); });
    });
    if (rects.length < 2) return [];
    rects.sort(function (a, b) {
      if (Math.abs(a.y - b.y) > 40) return a.y - b.y;
      return a.x - b.x;
    });
    var seen = {};
    var cells = [];
    var listed = collectSpecs(pageLabels);
    for (var i = 0; i < rects.length; i++) {
      var rc = rects[i];
      var key = [Math.round(rc.x / 8), Math.round(rc.y / 8), Math.round(rc.w / 8), Math.round(rc.h / 8)].join(":");
      if (seen[key]) continue;
      seen[key] = true;
      if (cellBusy(data, w, rc) < 0.03) continue;
      if (cellIsJunk(data, w, rc)) continue;
      var spec = specForRect(pageLabels, rc);
      if (!spec.item && listed[cells.length]) spec = listed[cells.length];
      spec = spec || {};
      spec.lookbook = fromLook;
      var cut = cropCanvas(canvas, rc);
      var label = spec.item || String(cells.length + 1);
      cells.push(await photoFromData(photo.name + " · " + label, cut.toDataURL("image/png"), photo.src, spec));
    }
    return cells.length >= 2 ? cells : [];
  }
  function guessType(n) {
    if (/\.png$/i.test(n)) return "image/png";
    if (/\.jpe?g$/i.test(n)) return "image/jpeg";
    if (/\.gif$/i.test(n)) return "image/gif";
    if (/\.webp$/i.test(n)) return "image/webp";
    return "application/octet-stream";
  }

  function livePhotos() {
    var mode = $("groupBy") ? $("groupBy").value : "auto";
    return photos.filter(function (p) {
      if (p.on === false) return false;
      var cat = p.cat || "Other";
      if (mode === "auto" && hiddenCats[cat]) return false;
      if (mode === "file" && hiddenCats[p.src || "file"]) return false;
      return true;
    });
  }
  function paintChips() {
    var el = $("catChips");
    if (!el) return;
    var mode = $("groupBy") ? $("groupBy").value : "auto";
    var counts = {};
    photos.forEach(function (p) {
      var k = mode === "file" ? (p.src || "file") : (p.cat || "Other");
      counts[k] = (counts[k] || 0) + 1;
    });
    var keys = Object.keys(counts);
    el.innerHTML = keys.map(function (k) {
      var on = !hiddenCats[k];
      return "<button type='button' class='chip" + (on ? " on" : "") + "' data-k='" + esc(k) + "'>" +
        esc(k) + " · " + counts[k] + "</button>";
    }).join("");
    el.querySelectorAll("button").forEach(function (b) {
      b.onclick = function () {
        var k = b.getAttribute("data-k");
        hiddenCats[k] = !hiddenCats[k];
        paintPreview();
        paintIssues();
      };
    });
  }
  function paintPhotoList() {
    var el = $("photoList");
    if (!el) return;
    el.innerHTML = "";
    photos.forEach(function (p, i) {
      var card = document.createElement("div");
      card.className = "pcard";
      card.draggable = true;
      card.innerHTML =
        "<input type='checkbox' " + (p.on !== false ? "checked" : "") + " />" +
        "<img alt='' />" +
        "<div>" +
          "<input type='text' data-f='item' placeholder='Item / code' value='" + esc(p.item || "") + "' />" +
          "<div class='row2' style='margin-top:4px'>" +
            "<input type='text' data-f='nameLabel' placeholder='Product name' value='" + esc(p.nameLabel || "") + "' />" +
            "<input type='text' data-f='factory' placeholder='Factory' value='" + esc(p.factory || "") + "' />" +
          "</div>" +
          "<div class='row2' style='margin-top:4px'>" +
            "<input type='text' data-f='material' placeholder='Material' value='" + esc(p.material || "") + "' />" +
            "<input type='text' data-f='size' placeholder='Size if in file' value='" + esc(p.size || "") + "' />" +
          "</div>" +
          "<div class='row2' style='margin-top:4px'>" +
            "<input type='text' data-f='price' placeholder='Price if in file' value='" + esc(p.price || "") + "' />" +
            "<input type='text' data-f='moq' placeholder='MOQ if in file' value='" + esc(p.moq || "") + "' />" +
          "</div>" +
          "<input type='text' data-f='note' placeholder='Note / sales line' value='" + esc(p.note || "") + "' style='margin-top:4px' />" +
        "</div>" +
        "<span class='drag' title='Drag'>⋮⋮</span>";
      card.querySelector("img").src = p.data;
      card.querySelector("input[type=checkbox]").onchange = function () {
        p.on = this.checked;
        paintIssues();
      };
      card.querySelectorAll("input[data-f]").forEach(function (inp) {
        inp.onchange = function () {
          p[inp.getAttribute("data-f")] = inp.value.trim();
        };
      });
      card.addEventListener("dragstart", function (e) {
        e.dataTransfer.setData("text/plain", String(i));
        e.dataTransfer.effectAllowed = "move";
      });
      card.addEventListener("dragover", function (e) { e.preventDefault(); });
      card.addEventListener("drop", function (e) {
        e.preventDefault();
        var from = parseInt(e.dataTransfer.getData("text/plain"), 10);
        if (isNaN(from) || from === i) return;
        var moved = photos.splice(from, 1)[0];
        photos.splice(i, 0, moved);
        paintPreview();
      });
      el.appendChild(card);
    });
  }
  function syncPreviewMeta() {
    var map = [
      ["pvFactory", "factoryName"],
      ["pvCustomer", "customerName"],
      ["pvSeason", "seasonName"]
    ];
    map.forEach(function (pair) {
      var a = $(pair[0]), b = $(pair[1]);
      if (a && b && a.value !== b.value) a.value = b.value;
    });
  }
  function paintPreview() {
    paintChips();
    syncPreviewMeta();
    if (!thumbs) return;
    thumbs.innerHTML = "";
    if (!photos.length) {
      thumbs.innerHTML = "<p class='sub' style='margin:0'>Drop a factory PDF / PPT — mini photos land here.</p>";
      return;
    }
    photos.forEach(function (p, i) {
      thumbs.appendChild(buildMini(p, i));
    });
  }
  function buildMini(p, i) {
    var card = document.createElement("div");
    card.className = "mini" + (p.on === false ? " off" : "");
    card.draggable = true;
    card.innerHTML =
      "<img alt='' draggable='false' />" +
      "<div class='mini-bar'>" +
        "<input type='checkbox' " + (p.on !== false ? "checked" : "") + " />" +
        "<input type='text' data-f='item' placeholder='Item' value='" + esc(p.item || p.nameLabel || "") + "' />" +
        "<input type='text' data-f='size' placeholder='Size' value='" + esc(p.size || "") + "' />" +
        "<span class='drag'>⋮⋮</span>" +
      "</div>";
    card.querySelector("img").src = p.data;
    card.querySelector("input[type=checkbox]").onchange = function () {
      p.on = this.checked;
      card.classList.toggle("off", !this.checked);
      paintIssues();
    };
    card.querySelectorAll("input[data-f]").forEach(function (inp) {
      inp.onchange = function () {
        p[inp.getAttribute("data-f")] = inp.value.trim();
      };
    });
    card.addEventListener("dragstart", function (e) {
      e.dataTransfer.setData("text/plain", String(i));
      e.dataTransfer.effectAllowed = "move";
    });
    card.addEventListener("dragover", function (e) {
      e.preventDefault();
      card.classList.add("over");
    });
    card.addEventListener("dragleave", function () { card.classList.remove("over"); });
    card.addEventListener("drop", function (e) {
      e.preventDefault();
      card.classList.remove("over");
      var from = parseInt(e.dataTransfer.getData("text/plain"), 10);
      if (isNaN(from) || from === i) return;
      var moved = photos.splice(from, 1)[0];
      photos.splice(i, 0, moved);
      paintPreview();
    });
    return card;
  }

  function buildCropCard(p, i, wmOn) {
    var card = document.createElement("div");
    card.className = "crop-card";
    card.innerHTML =
      "<div class='crop-stage' data-i='" + i + "'>" +
        "<img alt='' draggable='false' />" +
        "<div class='crop-box'>" +
          "<i class='crop-h nw' data-c='nw'></i>" +
          "<i class='crop-h ne' data-c='ne'></i>" +
          "<i class='crop-h sw' data-c='sw'></i>" +
          "<i class='crop-h se' data-c='se'></i>" +
        "</div>" +
        (wmOn ? "<div class='wm-preview'><b>ALPHA</b></div>" : "") +
      "</div>" +
      "<div class='cap'>" + (i + 1) + " · " + esc(specLine(p) || p.name) + "</div>";
    var img = card.querySelector("img");
    img.src = p.data;
    var stage = card.querySelector(".crop-stage");
    var box = card.querySelector(".crop-box");
    function layoutBox() {
      var r = imgRect(stage, img, p);
      if (!r) return;
      var c = p.crop || { x: 0, y: 0, w: 1, h: 1 };
      box.style.left = (r.left + c.x * r.w) + "px";
      box.style.top = (r.top + c.y * r.h) + "px";
      box.style.width = (c.w * r.w) + "px";
      box.style.height = (c.h * r.h) + "px";
    }
    img.onload = layoutBox;
    requestAnimationFrame(layoutBox);
    bindCrop(stage, img, box, p);
    return card;
  }

  function imgRect(stage, img, p) {
    var sw = stage.clientWidth, sh = stage.clientHeight;
    if (!sw || !sh || !p.nw || !p.nh) return null;
    var a = p.nw / p.nh, sa = sw / sh;
    var w, h, left, top;
    if (a > sa) { w = sw; h = sw / a; left = 0; top = (sh - h) / 2; }
    else { h = sh; w = sh * a; top = 0; left = (sw - w) / 2; }
    return { left: left, top: top, w: w, h: h };
  }

  function uvRatio(photo, cellA) {
    return cellA / (photo.nw / photo.nh);
  }
  function clampCrop(c, photo, cellA) {
    var r = uvRatio(photo, cellA);
    var minW = 0.18;
    var minH = minW / r;
    if (minH > 0.18) { minH = 0.18; minW = minH * r; }
    c.w = Math.max(minW, Math.min(1, c.w));
    c.h = c.w / r;
    if (c.h > 1) { c.h = 1; c.w = r; }
    if (c.w > 1) { c.w = 1; c.h = 1 / r; }
    if (c.h < minH) { c.h = minH; c.w = minH * r; }
    c.x = Math.max(0, Math.min(1 - c.w, c.x));
    c.y = Math.max(0, Math.min(1 - c.h, c.y));
    return c;
  }
  function moveCrop(e) {
    var drag = bind._crop;
    if (!drag) return;
    e.preventDefault();
    var stage = drag.stage, img = drag.img, box = drag.box, photo = drag.photo;
    var r = imgRect(stage, img, photo);
    if (!r) return;
    var sr = stage.getBoundingClientRect();
    var src = e.touches ? e.touches[0] : e;
    var mx = src.clientX - sr.left;
    var my = src.clientY - sr.top;
    var cellA = cellAspect(currentGrid());
    var ratio = uvRatio(photo, cellA);
    var c = { x: drag.start.x, y: drag.start.y, w: drag.start.w, h: drag.start.h };
    var dx = (mx - drag.mx) / r.w;
    var dy = (my - drag.my) / r.h;
    if (drag.mode === "pan") {
      c.x = drag.start.x + dx;
      c.y = drag.start.y + dy;
    } else {
      var growX = dx;
      var growY = dy * ratio;
      var useX = Math.abs(growX) >= Math.abs(growY);
      if (drag.mode === "se") {
        c.w = drag.start.w + (useX ? growX : growY);
      } else if (drag.mode === "nw") {
        c.w = drag.start.w - (useX ? growX : growY);
        c.x = drag.start.x + drag.start.w - c.w;
      } else if (drag.mode === "ne") {
        c.w = drag.start.w + (useX ? growX : -growY);
      } else if (drag.mode === "sw") {
        c.w = drag.start.w + (useX ? -growX : growY);
        c.x = drag.start.x + drag.start.w - c.w;
      }
      c.h = c.w / ratio;
      if (drag.mode === "nw" || drag.mode === "ne") {
        c.y = drag.start.y + drag.start.h - c.h;
      }
    }
    photo.crop = clampCrop(c, photo, cellA);
    var cc = photo.crop;
    box.style.left = (r.left + cc.x * r.w) + "px";
    box.style.top = (r.top + cc.y * r.h) + "px";
    box.style.width = (cc.w * r.w) + "px";
    box.style.height = (cc.h * r.h) + "px";
  }
  function endCrop() { bind._crop = null; }
  if (!bind._cropWin) {
    bind._cropWin = true;
    window.addEventListener("mousemove", moveCrop);
    window.addEventListener("touchmove", moveCrop, { passive: false });
    window.addEventListener("mouseup", endCrop);
    window.addEventListener("touchend", endCrop);
  }
  function bindCrop(stage, img, box, photo) {
    function down(e, mode) {
      e.preventDefault();
      e.stopPropagation();
      var sr = stage.getBoundingClientRect();
      var src = e.touches ? e.touches[0] : e;
      bind._crop = {
        stage: stage, img: img, box: box, photo: photo, mode: mode,
        mx: src.clientX - sr.left, my: src.clientY - sr.top,
        start: { x: photo.crop.x, y: photo.crop.y, w: photo.crop.w, h: photo.crop.h }
      };
    }
    box.addEventListener("mousedown", function (e) {
      if (e.target.classList.contains("crop-h")) return;
      down(e, "pan");
    });
    box.addEventListener("touchstart", function (e) {
      if (e.target.classList.contains("crop-h")) return;
      down(e, "pan");
    }, { passive: false });
    box.querySelectorAll(".crop-h").forEach(function (h) {
      h.addEventListener("mousedown", function (e) { down(e, h.getAttribute("data-c")); });
      h.addEventListener("touchstart", function (e) { down(e, h.getAttribute("data-c")); }, { passive: false });
    });
  }

  function chunk(arr, n) {
    var out = [];
    for (var i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
    return out;
  }

  function cropToDataUrl(photo) {
    return new Promise(function (res) {
      var img = new Image();
      img.onload = function () {
        var c = photo.crop || { x: 0, y: 0, w: 1, h: 1 };
        var sx = Math.max(0, c.x * img.width);
        var sy = Math.max(0, c.y * img.height);
        var sw = Math.max(2, c.w * img.width);
        var sh = Math.max(2, c.h * img.height);
        if (sx + sw > img.width) sw = img.width - sx;
        if (sy + sh > img.height) sh = img.height - sy;
        var canvas = document.createElement("canvas");
        canvas.width = Math.round(sw);
        canvas.height = Math.round(sh);
        var xctx = canvas.getContext("2d");
        xctx.imageSmoothingEnabled = true;
        xctx.imageSmoothingQuality = "high";
        xctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
        var full = !photo.crop || (photo.crop.x === 0 && photo.crop.y === 0 && photo.crop.w === 1 && photo.crop.h === 1);
        if (full && /^data:image\//i.test(photo.data || "")) { res(photo.data); return; }
        res(canvas.toDataURL("image/png"));
      };
      img.src = photo.data;
    });
  }

  function addWordmark(s, x, y, w) {
    s.addText("Alpha fashion", {
      x: x, y: y, w: w, h: 0.24,
      fontFace: "Arial", fontSize: 8, color: "8A7A6A",
      align: "center", bold: true, charSpacing: 10, margin: 0
    });
  }
  function addWatermark(s, pptx) {
    if (!$("wmOn") || !$("wmOn").checked) return;
    s.addText("ALPHA FASHION", {
      x: 1.6, y: 3.2, w: 10.1, h: 0.7,
      fontFace: "Arial", fontSize: 36, color: "C33D27",
      align: "center", bold: true, charSpacing: 8, transparency: 72, margin: 0
    });
  }

  function groupedPhotos() {
    var live = livePhotos();
    var kind = $("proposalKind") ? $("proposalKind").value : "product";
    var mode = $("groupBy") ? $("groupBy").value : "auto";
    if (kind === "multi") mode = "file";
    if (mode === "none") return [{ key: "", items: live }];
    var map = {};
    var order = [];
    live.forEach(function (p) {
      var k = mode === "file" ? (p.factory || p.src || "Factory") : (p.cat || "Other");
      if (!map[k]) { map[k] = []; order.push(k); }
      map[k].push(p);
    });
    var per = currentGrid().per || 4;
    var out = [];
    order.forEach(function (k) {
      var items = map[k];
      for (var i = 0; i < items.length; i += per) {
        out.push({ key: k, items: items.slice(i, i + per) });
      }
    });
    return out;
  }
  function salesCopy(p) {
    var L = deckLang();
    var bits = [];
    if (p.item) bits.push(L.item + " " + p.item);
    if (p.nameLabel) bits.push(p.nameLabel);
    if (p.material) bits.push(p.material);
    if (p.size) bits.push(p.size);
    if (p.price) bits.push(p.price);
    if (p.moq) bits.push(L.moq + " " + p.moq);
    if (p.lead) bits.push(L.lt + " " + p.lead);
    if (p.note) bits.push(p.note);
    if (!bits.length) return "";
    return L.sales + " · " + bits.join(" · ");
  }
  function addSalesSlide(pptx, title) {
    if (!$("salesOn") || !$("salesOn").checked) return;
    var live = livePhotos();
    var lines = live.map(salesCopy).filter(Boolean).slice(0, 12);
    if (!lines.length) return;
    var s = pptx.addSlide();
    s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.333, h: 7.5, fill: { color: "FFF8F0" } });
    s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.333, h: 0.08, fill: { color: "C33D27" } });
    s.addShape(pptx.ShapeType.rect, { x: 0.16, y: 0.15, w: 0.18, h: 0.66, fill: { color: "C00000" } });
    s.addText(title, {
      x: 0.44, y: 0.18, w: 12, h: 0.58,
      fontFace: "Arial", fontSize: 22, color: "C00000", bold: true, margin: 0
    });
    s.addText(lines.join("\n"), {
      x: 0.5, y: 1.1, w: 12.3, h: 5.6,
      fontFace: "Arial", fontSize: 14, color: "3A2A1C", margin: 0, valign: "top"
    });
    if ($("logoOn") && $("logoOn").checked) addWordmark(s, 4.66, 7.18, 4.02);
  }
  function deckFileName() {
    var stamp = new Date().toISOString().slice(0, 10);
    var who = ($("customerName") && $("customerName").value || "").trim().replace(/[^\w\-]+/g, "_");
    return "Alpha_Proposal_" + (who ? who + "_" : "") + stamp + ".pptx";
  }
  function addIntroSlide(pptx, title, factory) {
    if (!$("introOn") || !$("introOn").checked) return;
    if (!pageFacts.length) return;
    var s = pptx.addSlide();
    s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.333, h: 7.5, fill: { color: "FFF8F0" } });
    s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.333, h: 0.08, fill: { color: "C33D27" } });
    s.addShape(pptx.ShapeType.rect, { x: 0.16, y: 0.15, w: 0.18, h: 0.66, fill: { color: "C00000" } });
    s.addText(title, {
      x: 0.44, y: 0.18, w: 12, h: 0.58,
      fontFace: "Arial", fontSize: 22, color: "C00000", bold: true, margin: 0
    });
    s.addText((factory || "Factory") + " · " + deckLang().intro, {
      x: 0.44, y: 0.9, w: 12, h: 0.32,
      fontFace: "Arial", fontSize: 14, color: "8A7A6A", margin: 0
    });
    var body = pageFacts.map(function (f) { return f.text; }).join("\n\n").slice(0, 1400);
    s.addText(body, {
      x: 0.5, y: 1.4, w: 12.3, h: 5.3,
      fontFace: "Arial", fontSize: 14, color: "3A2A1C", margin: 0, valign: "top"
    });
    if ($("logoOn") && $("logoOn").checked) addWordmark(s, 4.66, 7.18, 4.02);
  }
  function addContactSlide(pptx) {
    if ($("contactOn") && !$("contactOn").checked) return;
    var line = ($("contactLine") && $("contactLine").value || "").trim();
    var owner = ($("ownerName") && $("ownerName").value || "").trim();
    var customer = ($("customerName") && $("customerName").value || "").trim();
    var season = ($("seasonName") && $("seasonName").value || "").trim();
    var end = pptx.addSlide();
    end.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.333, h: 7.5, fill: { color: "F5F5F5" } });
    end.addShape(pptx.ShapeType.rect, { x: 6.23, y: 0.4, w: 0.86, h: 13.3, fill: { color: "B03C27" } });
    end.addText(deckLang().thanks, {
      x: 0.7, y: 2.2, w: 12, h: 1.1,
      fontFace: "Arial", fontSize: 40, color: "B03C27", align: "center", bold: true, margin: 0
    });
    var bits = [line || "Alpha Fashion", owner, customer, season].filter(Boolean).join("  ·  ");
    end.addText(bits, {
      x: 1.2, y: 3.5, w: 10.9, h: 0.5,
      fontFace: "Arial", fontSize: 16, color: "5A4A3A", align: "center", margin: 0
    });
    addWordmark(end, 4.66, 6.95, 4.02);
  }
  async function buildPptx() {
    var g = currentGrid();
    if (g.invalid) throw new Error("Custom grid must look like 4x4.");
    var logoOn = $("logoOn").checked;
    var titleOn = $("titleOn").checked;
    var title = ($("deckTitle").value || "Product proposal").trim();
    var factory = ($("factoryName").value || "").trim();
    var customer = ($("customerName").value || "").trim();
    var season = ($("seasonName") && $("seasonName").value || "").trim();
    var groups = groupedPhotos();
    var flat = [];
    groups.forEach(function (b) { b.items.forEach(function (p) { flat.push(p); }); });
    if (!flat.length) throw new Error("No photos ticked.");

    var pptx = new PptxGenJS();
    pptx.defineLayout({ name: "ALPHA16", width: 13.333, height: 7.5 });
    pptx.layout = "ALPHA16";
    pptx.author = "Alpha Fashion";
    pptx.title = title;

    var cover = pptx.addSlide();
    cover.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.333, h: 7.5, fill: { color: "F5F5F5" } });
    cover.addShape(pptx.ShapeType.rect, { x: 0, y: 1.52, w: 0.32, h: 4.7, fill: { color: "B03C27" } });
    cover.addText("ALPHA  FASHION", {
      x: 0.7, y: 2.35, w: 12, h: 0.7,
      fontFace: "Arial", fontSize: 36, color: "1C1410", align: "right", bold: true, margin: 0
    });
    cover.addText(title, {
      x: 0.7, y: 3.15, w: 12, h: 0.55,
      fontFace: "Arial", fontSize: 22, color: "595959", align: "right", margin: 0
    });
    var L = deckLang();
    var sub = [factory, customer, season].filter(Boolean).join("  ·  ") || L.cover;
    cover.addText(sub, {
      x: 0.7, y: 3.55, w: 12, h: 0.45,
      fontFace: "Arial", fontSize: 16, color: "C9B8A8", margin: 0
    });
    cover.addShape(pptx.ShapeType.rect, { x: 0.7, y: 4.2, w: 1.6, h: 0.07, fill: { color: "C33D27" } });
    var layoutNote = g.original
      ? "Same as original layout"
      : (g.cols + "×" + g.rows + " grid");
    cover.addText(flat.length + " photos  ·  " + groups.length + " slides  ·  " + layoutNote, {
      x: 0.7, y: 6.7, w: 12, h: 0.3,
      fontFace: "Arial", fontSize: 12, color: "8A7A6A", margin: 0
    });

    addIntroSlide(pptx, title, factory);
    addSalesSlide(pptx, title);

    for (var gi = 0; gi < groups.length; gi++) {
      var grp = groups[gi].items;
      var grpKey = groups[gi].key;
      var s = pptx.addSlide();
      s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.333, h: 7.5, fill: { color: "FFF8F0" } });
      s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.333, h: 0.08, fill: { color: "C33D27" } });

      var top = titleOn ? 0.72 : 0.28;
      var bottomPad = 0.28;
      if (titleOn) {
        s.addShape(pptx.ShapeType.rect, { x: 0.16, y: 0.15, w: 0.18, h: 0.66, fill: { color: "C00000" } });
        s.addText(grpKey ? title + "  ·  " + grpKey : title, {
          x: 0.44, y: 0.18, w: 8.4, h: 0.58,
          fontFace: "Arial", fontSize: 22, color: "C00000", bold: true, margin: 0
        });
      }
      if (logoOn) addWordmark(s, 4.66, 7.18, 4.02);

      var gap = 0.16;
      var areaX = 0.4;
      var areaY = top;
      var areaW = 12.53;
      var areaH = 7.5 - top - bottomPad;
      var cols = g.original ? 1 : g.cols;
      var rows = g.original ? 1 : g.rows;
      var cellW = (areaW - gap * (cols - 1)) / cols;
      var cellH = (areaH - gap * (rows - 1)) / rows;

      for (var i = 0; i < grp.length; i++) {
        var ph = grp[i];
        var col = i % cols;
        var row = Math.floor(i / cols);
        var x = areaX + col * (cellW + gap);
        var y = areaY + row * (cellH + gap);
        var data = g.original ? ph.data : await cropToDataUrl(ph);
        var spec = specLine(ph);
        var capH = spec && !g.original ? 0.42 : 0;
        s.addShape(pptx.ShapeType.roundRect, {
          x: x, y: y, w: cellW, h: cellH,
          fill: { color: "F4ECE1" }, rectRadius: 0.06
        });
        var boxW = cellW - 0.08;
        var boxH = cellH - 0.08 - capH;
        var fit = containRect(x + 0.04, y + 0.04, boxW, boxH, ph.nw * (ph.crop && ph.crop.w || 1), ph.nh * (ph.crop && ph.crop.h || 1));
        s.addImage({
          data: data, x: fit.x, y: fit.y, w: fit.w, h: fit.h
        });
        if (spec) {
          s.addText(spec, {
            x: x + 0.04, y: y + cellH - capH - 0.02, w: cellW - 0.08, h: capH,
            fontFace: "Arial", fontSize: 9, color: "5A4A3A",
            align: "center", margin: 0
          });
        }
      }

      addWatermark(s, pptx);

      s.addText((gi + 1) + " / " + groups.length, {
        x: 11.6, y: 7.14, w: 1.4, h: 0.22,
        fontFace: "Arial", fontSize: 10, color: "8A7A6A", align: "right", margin: 0
      });
    }

    addContactSlide(pptx);

    var blob = await pptx.write({ outputType: "blob" });
    lastBlob = blob;
    lastName = deckFileName();
    downloadBlob(blob, lastName);
  }

  function parseProfile() {
    var blob = pageFacts.map(function (f) { return f.text; }).join(" \n ");
    function grab(re) {
      var m = blob.match(re);
      if (!m) return "";
      return stripFactoryContact(String(m[1] || m[0])).replace(/\s+/g, " ").trim().slice(0, 180);
    }
    return {
      established: grab(/(?:established|founded|since)\s*((?:19|20)\d{2})/i),
      people: grab(/(?:employees?|staff|workers?|nhân viên)[^\d]{0,16}(\d[\d,.\s]{0,12}\d|\d+)/i),
      capacity: grab(/(?:capacity|pcs\s*\/\s*(?:month|day)|năng lực)[:\s]([^\n.]{3,60})/i),
      cert: grab(/((?:ISO|BSCI|SEDEX|WRAP|GOTS|OEKO[- ]?TEX|SA8000)[^\n,]{0,40})/i),
      lead: grab(/(?:lead\s*time|L\/T)[:\s]([^\n.]{2,40})/i),
      revenue: grab(/(?:revenue|turnover|doanh thu)[:\s]([^\n.]{2,50})/i),
      customers: grab(/(?:customers?|clients?)[:\s]([^\n.]{3,80})/i)
    };
  }
  function photoKind(p) {
    var n = ((p.name || "") + " " + (p.src || "")).toLowerCase();
    if (/showroom|show-room|display/.test(n)) return "Showroom";
    if (/process|line|workshop|weav|kiln|mould|sewing/.test(n)) return "Process";
    if (/factory|building|gate|yard|office/.test(n)) return "Factory";
    return "Product";
  }
  function addTextSlide(pptx, title, body) {
    var s = pptx.addSlide();
    s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.333, h: 7.5, fill: { color: "FFF8F0" } });
    s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.333, h: 0.08, fill: { color: "C33D27" } });
    s.addShape(pptx.ShapeType.rect, { x: 0.16, y: 0.15, w: 0.18, h: 0.66, fill: { color: "C00000" } });
    s.addText(title, {
      x: 0.44, y: 0.18, w: 12, h: 0.58,
      fontFace: "Arial", fontSize: 22, color: "C00000", bold: true, margin: 0
    });
    s.addText(body || "not in file", {
      x: 0.5, y: 1.05, w: 12.3, h: 5.6,
      fontFace: "Arial", fontSize: 16, color: body ? "3A2A1C" : "8A7A6A", margin: 0, valign: "top"
    });
    if ($("logoOn") && $("logoOn").checked) addWordmark(s, 4.66, 7.18, 4.02);
    return s;
  }
  async function addPhotoSection(pptx, title, items) {
    if (!items.length) {
      addTextSlide(pptx, title, "not in file");
      return;
    }
    var g = { cols: items.length === 1 ? 1 : 2, rows: items.length <= 2 ? 1 : 2, per: Math.min(4, items.length) };
    var chunks = chunk(items, g.per);
    for (var ci = 0; ci < chunks.length; ci++) {
      var grp = chunks[ci];
      var s = pptx.addSlide();
      s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.333, h: 7.5, fill: { color: "FFF8F0" } });
      s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.333, h: 0.08, fill: { color: "C33D27" } });
      s.addShape(pptx.ShapeType.rect, { x: 0.16, y: 0.15, w: 0.18, h: 0.66, fill: { color: "C00000" } });
      s.addText(title, {
        x: 0.44, y: 0.18, w: 12, h: 0.5,
        fontFace: "Arial", fontSize: 22, color: "C00000", bold: true, margin: 0
      });
      var cols = g.cols, rows = Math.max(1, Math.ceil(grp.length / cols));
      var gap = 0.16, areaX = 0.4, areaY = 0.85, areaW = 12.53, areaH = 6.05;
      var cellW = (areaW - gap * (cols - 1)) / cols;
      var cellH = (areaH - gap * (rows - 1)) / rows;
      for (var i = 0; i < grp.length; i++) {
        var ph = grp[i];
        var col = i % cols;
        var row = Math.floor(i / cols);
        var x = areaX + col * (cellW + gap);
        var y = areaY + row * (cellH + gap);
        var data = await cropToDataUrl(ph);
        var spec = specLine(ph);
        var capH = spec ? 0.32 : 0;
        s.addShape(pptx.ShapeType.roundRect, {
          x: x, y: y, w: cellW, h: cellH,
          fill: { color: "F4ECE1" }, rectRadius: 0.06
        });
        var fit = containRect(x + 0.04, y + 0.04, cellW - 0.08, cellH - 0.08 - capH,
          ph.nw * (ph.crop && ph.crop.w || 1), ph.nh * (ph.crop && ph.crop.h || 1));
        s.addImage({ data: data, x: fit.x, y: fit.y, w: fit.w, h: fit.h });
        if (spec) {
          s.addText(spec, {
            x: x + 0.04, y: y + cellH - capH, w: cellW - 0.08, h: capH,
            fontFace: "Arial", fontSize: 9, color: "5A4A3A", align: "center", margin: 0
          });
        }
      }
      if ($("logoOn") && $("logoOn").checked) addWordmark(s, 4.66, 7.18, 4.02);
    }
  }
  async function buildFactoryPptx() {
    var factory = ($("factoryName") && $("factoryName").value || "").trim() || "Factory";
    var title = ($("deckTitle") && $("deckTitle").value || "Factory presentation").trim();
    var live = livePhotos();
    var prof = parseProfile();
    var pptx = new PptxGenJS();
    pptx.defineLayout({ name: "ALPHA16", width: 13.333, height: 7.5 });
    pptx.layout = "ALPHA16";
    pptx.author = "Alpha Fashion";
    pptx.title = title;

    var cover = pptx.addSlide();
    cover.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.333, h: 7.5, fill: { color: "F5F5F5" } });
    cover.addShape(pptx.ShapeType.rect, { x: 0, y: 1.52, w: 0.32, h: 4.7, fill: { color: "B03C27" } });
    cover.addText("ALPHA  FASHION", {
      x: 0.7, y: 2.35, w: 12, h: 0.7,
      fontFace: "Arial", fontSize: 36, color: "1C1410", align: "right", bold: true, margin: 0
    });
    cover.addText(title, {
      x: 0.7, y: 3.15, w: 12, h: 0.55,
      fontFace: "Arial", fontSize: 22, color: "595959", align: "right", margin: 0
    });
    cover.addText(factory, {
      x: 0.7, y: 3.7, w: 12, h: 0.4,
      fontFace: "Arial", fontSize: 16, color: "C9B8A8", align: "right", margin: 0
    });

    var overview = pageFacts.map(function (f) { return f.text; }).join("\n\n").slice(0, 1400);
    addTextSlide(pptx, "Overview", overview || "not in file");
    addTextSlide(pptx, "Capacity", prof.capacity || "not in file");
    addTextSlide(pptx, "Certificates", prof.cert || "not in file");
    addTextSlide(pptx, "People", prof.people ? (prof.people + (prof.established ? " · since " + prof.established : "")) : "not in file");
    addTextSlide(pptx, "Lead time", prof.lead || "not in file");
    addTextSlide(pptx, "Customers", prof.customers || "not in file");
    addTextSlide(pptx, "Revenue", prof.revenue || "not in file");

    var buckets = { Showroom: [], Factory: [], Process: [], Product: [] };
    live.forEach(function (p) { buckets[photoKind(p)].push(p); });
    await addPhotoSection(pptx, "Showroom", buckets.Showroom);
    await addPhotoSection(pptx, "Factory", buckets.Factory);
    await addPhotoSection(pptx, "Process", buckets.Process);
    await addPhotoSection(pptx, "Product", buckets.Product);
    addContactSlide(pptx);

    var blob = await pptx.write({ outputType: "blob" });
    lastBlob = blob;
    lastName = "Alpha_Factory_" + factory.replace(/[^\w\-]+/g, "_") + "_" + new Date().toISOString().slice(0, 10) + ".pptx";
    downloadBlob(blob, lastName);
  }

  function downloadBlob(blob, name) {
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 1500);
  }
  function cfgIds() {
    return ["brandPack", "proposalKind", "deckTitle", "customerName", "seasonName",
      "factoryName", "ownerName", "contactLine", "perSlide", "customGrid", "groupBy"];
  }
  function saveCfg() {
    var o = {};
    cfgIds().forEach(function (id) {
      if ($(id)) o[id] = $(id).value;
    });
    ["langVN", "langEN", "langCN", "aiOn", "logoOn", "wmOn", "titleOn", "introOn", "contactOn", "salesOn"].forEach(function (id) {
      if ($(id)) o[id] = $(id).checked;
    });
    try { localStorage.setItem(CFG_KEY, JSON.stringify(o)); } catch (e) {}
    setStatus("Cấu hình đã lưu trên máy này.", "ok");
  }
  function loadCfg() {
    var raw;
    try { raw = localStorage.getItem(CFG_KEY); } catch (e) { return; }
    if (!raw) return;
    var o;
    try { o = JSON.parse(raw); } catch (e) { return; }
    cfgIds().forEach(function (id) {
      if ($(id) && o[id] != null) $(id).value = o[id];
    });
    ["langVN", "langEN", "langCN", "aiOn", "logoOn", "wmOn", "titleOn", "introOn", "contactOn", "salesOn"].forEach(function (id) {
      if ($(id) && typeof o[id] === "boolean") $(id).checked = o[id];
    });
    syncLayoutUi();
  }
  function runQa() {
    var live = livePhotos();
    var issues = [];
    if (!live.length) issues.push({ ok: false, t: "Chưa tick ảnh nào" });
    else issues.push({ ok: true, t: live.length + " ảnh tick" });
    var missing = live.filter(function (p) { return !p.item && !p.material; });
    if (missing.length) issues.push({ ok: false, t: missing.length + " ảnh không có ITEM/MATERIAL trong file" });
    var noPrice = live.filter(function (p) { return !p.price; }).length;
    if (noPrice) issues.push({ ok: true, t: noPrice + " ảnh không có giá trong file — không bịa giá" });
    var stretch = live.filter(function (p) {
      var a = (p.nw || 1) / (p.nh || 1);
      return a > 4 || a < 0.2;
    });
    if (stretch.length) issues.push({ ok: false, t: stretch.length + " crop méo bất thường" });
    if ($("introOn") && $("introOn").checked && !pageFacts.length) {
      issues.push({ ok: true, t: "Intro tắt vì file không có chữ nhà máy" });
    }
    if ($("salesOn") && $("salesOn").checked && !live.some(function (p) { return p.item || p.material || p.price; })) {
      issues.push({ ok: true, t: "Copy bán hàng tắt — không có field trong file" });
    }
    var factories = {};
    live.forEach(function (p) { factories[p.factory || p.src || ""] = 1; });
    var nF = Object.keys(factories).filter(Boolean).length;
    if ($("proposalKind") && $("proposalKind").value === "multi" && nF < 2) {
      issues.push({ ok: false, t: "Loại nhiều nhà máy nhưng chỉ có 1 nguồn — thả thêm file" });
    } else if (nF > 1) {
      issues.push({ ok: true, t: nF + " nhà máy trong deck" });
    }
    if (trendText && !live.some(function (p) { return p.trendHit; })) {
      issues.push({ ok: false, t: "Có file trend nhưng chưa khớp item — bấm Khớp trend" });
    }
    lastQa = issues;
    return issues;
  }
  function paintIssues() {
    var el = $("issues");
    if (!el) return;
    if (!srcFiles.length && !photos.length) {
      el.innerHTML = "Chưa có file.";
      lastQa = [];
      return;
    }
    var issues = runQa();
    el.innerHTML = issues.map(function (x) {
      return x.ok ? "<b class='ok'>" + x.t + "</b>" : "<b class='warn'>" + x.t + "</b>";
    }).join(" · ");
  }
  function paintHist() {
    var el = $("histBox");
    if (!el) return;
    var list = [];
    try { list = JSON.parse(localStorage.getItem(HIST_KEY) || "[]"); } catch (e) { list = []; }
    if (!list.length) { el.textContent = ""; return; }
    el.innerHTML = list.slice(0, 6).map(function (h) {
      return esc(h.when) + " · " + esc(h.title) + " · " + h.n + " ảnh";
    }).join("<br>");
  }
  function pushHist() {
    var list = [];
    try { list = JSON.parse(localStorage.getItem(HIST_KEY) || "[]"); } catch (e) { list = []; }
    var cats = {};
    livePhotos().forEach(function (p) {
      var k = p.cat || guessCat(p) || "Other";
      cats[k] = (cats[k] || 0) + 1;
    });
    var top = "Other", topN = 0;
    Object.keys(cats).forEach(function (k) { if (cats[k] > topN) { topN = cats[k]; top = k; } });
    list.unshift({
      when: new Date().toISOString().slice(0, 16).replace("T", " "),
      title: ($("deckTitle") && $("deckTitle").value) || "Proposal",
      customer: ($("customerName") && $("customerName").value) || "",
      cat: top,
      page: bind._page || "01",
      n: livePhotos().length
    });
    try { localStorage.setItem(HIST_KEY, JSON.stringify(list.slice(0, 20))); } catch (e) {}
    paintHist();
  }
  function soon(msg) {
    var n = $("stockNote");
    if (n) n.textContent = msg;
    setStatus(msg);
  }
  async function exportPdf() {
    if (!lastBlob) {
      setStatus("Generate PPTX trước, rồi In / PDF.", "err");
      return;
    }
    var url = URL.createObjectURL(lastBlob);
    var w = window.open(url, "_blank");
    if (w) setTimeout(function () { try { w.print(); } catch (e) {} }, 600);
    setStatus("Tab mới · In → Save as PDF. Trình duyệt không convert Office.", "ok");
  }
  function openDb() {
    return new Promise(function (res, rej) {
      var req = indexedDB.open("alphaAtelier", 1);
      req.onupgradeneeded = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains("stock")) db.createObjectStore("stock", { keyPath: "id" });
      };
      req.onsuccess = function () { res(req.result); };
      req.onerror = function () { rej(req.error); };
    });
  }
  async function saveStock() {
    if (!srcFiles.length) {
      soon("Thả file nhà máy trước, rồi cất vào kho.");
      return;
    }
    var db = await openDb();
    var tx = db.transaction("stock", "readwrite");
    var store = tx.objectStore("stock");
    for (var i = 0; i < srcFiles.length; i++) {
      var f = srcFiles[i];
      var buf = await f.arrayBuffer();
      store.put({
        id: f.name + ":" + f.size,
        name: f.name,
        type: f.type || "application/octet-stream",
        size: f.size,
        blob: new Blob([buf], { type: f.type || "application/octet-stream" }),
        when: Date.now()
      });
    }
    await new Promise(function (res, rej) { tx.oncomplete = res; tx.onerror = function () { rej(tx.error); }; });
    soon("Đã cất " + srcFiles.length + " file vào kho máy này.");
    paintStockNote();
  }
  async function listStock() {
    try {
      var db = await openDb();
      return await new Promise(function (res, rej) {
        var req = db.transaction("stock").objectStore("stock").getAll();
        req.onsuccess = function () { res(req.result || []); };
        req.onerror = function () { rej(req.error); };
      });
    } catch (e) { return []; }
  }
  function dataUrlToFile(row) {
    var m = String(row.data || "").match(/^data:([^;]+);base64,(.+)$/);
    if (!m) return null;
    var bin = atob(m[2]);
    var arr = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new File([arr], row.name, { type: row.type || m[1] });
  }
  async function paintStockList() {
    var el = $("stockList");
    if (!el) return;
    var rows = await listStock();
    if (!rows.length) { el.innerHTML = ""; return; }
    el.innerHTML = rows.map(function (r, i) {
      return "<button type='button' data-stock='" + i + "'>" + esc(r.name) + " · " + sizeOf(r.size) + "</button>";
    }).join("");
    el.querySelectorAll("button").forEach(function (b) {
      b.onclick = async function () {
        var rows2 = await listStock();
        var r = rows2[+b.getAttribute("data-stock")];
        if (!r) return;
        if (srcFiles.some(function (f) { return f.name === r.name && f.size === r.size; })) {
          soon("Already in the source list.");
          return;
        }
        srcFiles.push(new File([r.blob], r.name, { type: r.type }));
        ingestedKey = "";
        refreshSrc();
        ingestAll();
      };
    });
  }
  async function loadFolderFromPath() {
    var p = ($("folderPath") && $("folderPath").value || "").trim();
    if (!p) {
      setStatus("Paste a D:\\ folder on this PC.", "err");
      return;
    }
    setStatus("Reading folder on this PC…");
    try {
      var r = await fetch("http://127.0.0.1:4181/folder", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ path: p })
      });
      var j = await r.json();
      if (!r.ok) throw new Error(j.error || "folder failed");
      var added = 0;
      (j.files || []).forEach(function (row) {
        var f = dataUrlToFile(row);
        if (!f) return;
        if (srcFiles.some(function (x) { return x.name === f.name && x.size === f.size; })) return;
        srcFiles.push(f);
        added++;
      });
      if (!added) {
        setStatus((j.n ? "Those files are already in the list." : "No PDF / PPT / photo in that folder."), j.n ? "ok" : "err");
        return;
      }
      ingestedKey = "";
      persist();
      refreshSrc();
      ingestAll();
      setStatus("Loaded " + added + " file(s) from " + (j.path || p), "ok");
    } catch (e) {
      setStatus((e.message || String(e)) + " · 4181 must be on this PC.", "err");
    }
  }
  async function paintStockNote() {
    var rows = await listStock();
    var n = $("stockNote");
    if (!n) return;
    var t = rows.length
      ? ("Kho: " + rows.length + " file · " + rows.map(function (r) { return r.name; }).slice(0, 4).join(", "))
      : "Kho trống đến khi cất file nhà máy. Trend trống đến khi thả file trend.";
    if (trendFiles.length) t += " · Trend: " + trendFiles.map(function (f) { return f.name; }).join(", ");
    n.textContent = t;
    paintStockList();
  }
  async function fromStock() {
    var rows = await listStock();
    if (!rows.length) {
      soon("Kho trống. Thả file nhà máy rồi Cất vào kho.");
      return;
    }
    var added = 0;
    rows.forEach(function (r) {
      if (srcFiles.some(function (f) { return f.name === r.name && f.size === r.size; })) return;
      srcFiles.push(new File([r.blob], r.name, { type: r.type }));
      added++;
    });
    if (!added) {
      soon("Kho đã nằm trong nguồn hiện tại.");
      return;
    }
    ingestedKey = "";
    refreshSrc();
    ingestAll();
  }
  async function extractTextFile(file) {
    var ext = extOf(file.name);
    var out = file.name + " ";
    if (ext === "pdf") {
      var doc = await pdfjsLib.getDocument({ data: await fileToArray(file) }).promise;
      for (var p = 1; p <= doc.numPages; p++) {
        var page = await doc.getPage(p);
        try {
          var tc = await page.getTextContent();
          out += " " + (tc.items || []).map(function (it) { return it.str; }).join(" ");
        } catch (e) {}
      }
      return out;
    }
    if (ext === "pptx" || ext === "ppt") {
      var zip = await JSZip.loadAsync(await fileToArray(file));
      var names = Object.keys(zip.files).filter(function (n) { return /^ppt\/slides\/slide\d+\.xml$/i.test(n); });
      for (var i = 0; i < names.length; i++) {
        var xml = await zip.files[names[i]].async("string");
        xml.replace(/<a:t>([^<]*)<\/a:t>/g, function (_, t) { out += " " + t; return _; });
      }
      return out;
    }
    return out;
  }
  async function ingestTrend() {
    trendText = "";
    for (var i = 0; i < trendFiles.length; i++) {
      try { trendText += " " + await extractTextFile(trendFiles[i]); } catch (e) {}
    }
    trendText = stripFactoryContact(trendText);
    paintStockNote();
  }
  function matchTrend() {
    if (!trendFiles.length) {
      soon("Thả file trend trước.");
      return;
    }
    if (!photos.length) {
      soon("Thả / mở kho catalogue trước.");
      return;
    }
    var tokens = wordTokens(trendText + " " + trendFiles.map(function (f) { return f.name; }).join(" "));
    var stop = { the:1, and:1, for:1, with:1, from:1, this:1, that:1, collection:1, proposal:1, fashion:1, alpha:1, pdf:1, pptx:1 };
    tokens = tokens.filter(function (w) { return !stop[w] && w.length > 2; });
    var hits = 0;
    photos.forEach(function (p) {
      var blob = wordTokens([p.item, p.material, p.cat, p.name, p.src, p.factory, p.note].join(" "));
      var hit = blob.filter(function (w) { return tokens.indexOf(w) >= 0; });
      p.trendHit = hit.length;
      if (p.trendHit) { p.on = true; hits++; }
      else p.on = false;
    });
    var box = $("matchBox");
    if (box) {
      var shown = photos.filter(function (p) { return p.trendHit; }).slice(0, 12);
      box.innerHTML = shown.length
        ? shown.map(function (p) {
            return "<div class='match-row'><span>" + esc(p.item || p.name) + "</span><span>" + p.trendHit + " khớp</span></div>";
          }).join("")
        : "<p class='soon'>Không khớp token nào trong kho. Không bịa SKU.</p>";
    }
    paintPreview();
    paintIssues();
    soon(hits ? ("Tick " + hits + " item khớp trend.") : "Không khớp. Giữ kho, không bịa.");
  }
  function profiles() {
    try { return JSON.parse(localStorage.getItem(PROF_KEY) || "[]"); } catch (e) { return []; }
  }
  function paintProfiles() {
    var sel = $("profilePick");
    if (!sel) return;
    var list = profiles();
    var cur = sel.value;
    sel.innerHTML = "<option value=''>— khách đã lưu —</option>" + list.map(function (p, i) {
      return "<option value='" + i + "'>" + esc(p.customer || p.title || ("#" + (i + 1))) + "</option>";
    }).join("");
    sel.value = cur;
  }
  function saveProfile() {
    var name = ($("customerName") && $("customerName").value || "").trim();
    if (!name) { setStatus("Gõ tên khách trước.", "err"); return; }
    var list = profiles();
    var o = {};
    cfgIds().forEach(function (id) { if ($(id)) o[id] = $(id).value; });
    list = list.filter(function (p) { return p.customer !== name; });
    list.unshift(o);
    try { localStorage.setItem(PROF_KEY, JSON.stringify(list.slice(0, 30))); } catch (e) {}
    paintProfiles();
    setStatus("Đã lưu hồ sơ " + name, "ok");
  }
  function loadProfile() {
    var sel = $("profilePick");
    if (!sel || sel.value === "") return;
    var list = profiles();
    var o = list[+sel.value];
    if (!o) return;
    cfgIds().forEach(function (id) {
      if ($(id) && o[id] != null) $(id).value = o[id];
    });
    syncLayoutUi();
  }
  function showPane(name) {
    ["cut", "match", "ship"].forEach(function (id) {
      var pane = $("pane" + id.charAt(0).toUpperCase() + id.slice(1));
      var nav = $("nav" + id.charAt(0).toUpperCase() + id.slice(1));
      if (pane) pane.classList.toggle("on", id === name);
      if (nav) nav.classList.toggle("on", id === name);
    });
  }
  async function exportPng() {
    var live = livePhotos();
    if (!live.length) {
      setStatus("Chưa có ảnh tick.", "err");
      return;
    }
    for (var i = 0; i < live.length; i++) {
      var data = await cropToDataUrl(live[i]);
      var a = document.createElement("a");
      a.href = data;
      a.download = "Alpha_page_" + String(i + 1).padStart(2, "0") + ".jpg";
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
    setStatus("Đã tải " + live.length + " ảnh.", "ok");
  }
  function exportLink() {
    if (!lastBlob) {
      setStatus("Generate PPTX trước.", "err");
      return;
    }
    var url = URL.createObjectURL(lastBlob);
    window.open(url, "_blank");
    setStatus("Tab mới · link chỉ sống trên máy này.", "ok");
  }
  function bindStudioExtras() {
    loadCfg();
    paintHist();
    paintIssues();
    paintProfiles();
    paintStockNote();
    if ($("fromStock")) $("fromStock").onclick = fromStock;
    if ($("saveStock")) $("saveStock").onclick = saveStock;
    if ($("trendBtn")) $("trendBtn").onclick = matchTrend;
    if ($("folderBtn")) $("folderBtn").onclick = loadFolderFromPath;
    if ($("folderPath")) $("folderPath").onkeydown = function (e) {
      if (e.key === "Enter") loadFolderFromPath();
    };
    paintStockList();
    if ($("trendList")) {
      renderList($("trendList"), trendFiles, function (i) {
        trendFiles.splice(i, 1);
        ingestTrend();
        if ($("trendList")) renderList($("trendList"), trendFiles, arguments.callee);
      });
    }
    var trendDrop = $("trendDrop"), trendInput = $("trendFiles");
    if (trendDrop && trendInput && !trendDrop.getAttribute("data-bound")) {
      trendDrop.setAttribute("data-bound", "1");
      bindDrop(trendDrop, trendInput, function (list) {
        if (!list || !list.length) return;
        trendFiles = trendFiles.concat([].slice.call(list));
        if ($("trendList")) renderList($("trendList"), trendFiles, function (i) {
          trendFiles.splice(i, 1);
          ingestTrend();
        });
        ingestTrend();
      });
    }
    if (bind._studio) return;
    bind._studio = true;
    if ($("saveCfg")) $("saveCfg").onclick = saveCfg;
    if ($("checkBtn")) $("checkBtn").onclick = function () {
      paintIssues();
      var bad = lastQa.filter(function (x) { return !x.ok; });
      setStatus(bad.length ? ("QA: " + bad.length + " điểm cần xem") : "QA sạch — Generate được.", bad.length ? "err" : "ok");
      showPane("ship");
    };
    if ($("exportPdf")) $("exportPdf").onclick = exportPdf;
    if ($("exportPng")) $("exportPng").onclick = exportPng;
    if ($("exportLink")) $("exportLink").onclick = exportLink;
    if ($("saveHist")) $("saveHist").onclick = function () {
      if (!photos.length) { setStatus("Chưa có đề xuất để lưu.", "err"); return; }
      pushHist();
      setStatus("Đã lưu lịch sử trên máy này.", "ok");
    };
    if ($("fromStock")) $("fromStock").onclick = fromStock;
    if ($("saveStock")) $("saveStock").onclick = saveStock;
    if ($("trendBtn")) $("trendBtn").onclick = matchTrend;
    if ($("folderBtn")) $("folderBtn").onclick = loadFolderFromPath;
    if ($("folderPath")) $("folderPath").addEventListener("keydown", function (e) {
      if (e.key === "Enter") loadFolderFromPath();
    });
    paintStockList();
    if ($("saveProfile")) $("saveProfile").onclick = saveProfile;
    if ($("profilePick")) $("profilePick").addEventListener("change", loadProfile);
    if ($("groupBy")) $("groupBy").addEventListener("change", function () {
      hiddenCats = {};
      paintPreview();
    });
    [
      ["pvFactory", "factoryName"],
      ["pvCustomer", "customerName"],
      ["pvSeason", "seasonName"]
    ].forEach(function (pair) {
      var a = $(pair[0]), b = $(pair[1]);
      function copy(from, to) {
        if (!from || !to) return;
        from.addEventListener("input", function () { to.value = from.value; });
      }
      copy(a, b);
      copy(b, a);
    });
    syncPreviewMeta();
    ["introOn", "contactOn", "salesOn", "langVN", "langEN", "langCN", "proposalKind"].forEach(function (id) {
      if ($(id)) $(id).addEventListener("change", function () { paintIssues(); paintPreview(); });
    });
    ["navCut", "navMatch", "navShip"].forEach(function (id) {
      if ($(id)) $(id).onclick = function () { showPane($(id).getAttribute("data-pane")); };
    });
    function refreshTrend() {
      renderList($("trendList"), trendFiles, function (i) {
        trendFiles.splice(i, 1);
        ingestTrend();
        refreshTrend();
      });
    }
    var trendDrop = $("trendDrop"), trendInput = $("trendFiles");
    if (trendDrop && trendInput) {
      bindDrop(trendDrop, trendInput, function (list) {
        if (!list || !list.length) return;
        trendFiles = trendFiles.concat([].slice.call(list));
        refreshTrend();
        ingestTrend();
      });
    }
  }
  }

  root.ProposalDesk = { bind: bind };
  if (document.body && document.body.getAttribute("data-proposal-auto") === "1") bind();
})(window);
