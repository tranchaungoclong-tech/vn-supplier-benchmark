(function (root) {
  function bind() {
  if (typeof pdfjsLib !== "undefined") {
    pdfjsLib.GlobalWorkerOptions.workerSrc = "vendor/pdf.worker.min.js";
  }

  var tplFile = null;
  var srcFiles = [];
  var photos = [];
  var logoData = null;

  var $ = function (id) { return document.getElementById(id); };
  var tplDrop = $("tplDrop"), srcDrop = $("srcDrop");
  var tplInput = $("tplFile"), srcInput = $("srcFiles");
  var go = $("go"), statusEl = $("status"), thumbs = $("thumbs");
  if (!go || !srcDrop) return;

  fetch("alpha-a.png").then(function (r) { return r.blob(); }).then(blobToDataUrl).then(function (d) {
    logoData = d;
  }).catch(function () {});

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
  function bindDrop(el, input, onFiles) {
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

  bindDrop(tplDrop, tplInput, function (list) {
    if (!list || !list.length) return;
    tplFile = list[0];
    renderList($("tplList"), [tplFile], function () {
      tplFile = null; $("tplList").innerHTML = "";
    });
  });
  bindDrop(srcDrop, srcInput, function (list) {
    if (!list || !list.length) return;
    srcFiles = srcFiles.concat([].slice.call(list));
    refreshSrc();
  });
  function refreshSrc() {
    renderList($("srcList"), srcFiles, function (i) {
      srcFiles.splice(i, 1); refreshSrc();
    });
    go.disabled = !srcFiles.length;
    if (srcFiles.length) setStatus(srcFiles.length + " file(s). Generate when ready.");
    else setStatus("Drop a factory PDF / PPT first.");
  }

  document.addEventListener("paste", function (e) {
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
    if (added) refreshSrc();
  });

  go.onclick = function () { run(); };

  async function run() {
    go.disabled = true;
    photos = [];
    thumbs.innerHTML = "";
    try {
      setStatus("Reading factory files…");
      for (var i = 0; i < srcFiles.length; i++) {
        await ingest(srcFiles[i]);
      }
      if (!photos.length) throw new Error("No photos found in those files.");
      paintThumbs();
      setStatus("Building PPTX · " + photos.length + " photo(s)…");
      await buildPptx();
      setStatus("Downloaded. " + photos.length + " photo(s) fitted.", "ok");
    } catch (err) {
      setStatus(err.message || String(err), "err");
    }
    go.disabled = !srcFiles.length;
  }

  async function ingest(file) {
    var ext = extOf(file.name);
    if (/^(png|jpe?g|webp|gif|bmp)$/.test(ext) || (file.type || "").indexOf("image/") === 0) {
      photos.push({ name: file.name, data: await blobToDataUrl(file), src: file.name });
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

  async function ingestPdf(file) {
    var buf = await fileToArray(file);
    var doc = await pdfjsLib.getDocument({ data: buf }).promise;
    for (var p = 1; p <= doc.numPages; p++) {
      var page = await doc.getPage(p);
      var vp = page.getViewport({ scale: 1.6 });
      var canvas = document.createElement("canvas");
      canvas.width = vp.width;
      canvas.height = vp.height;
      await page.render({ canvasContext: canvas.getContext("2d"), viewport: vp }).promise;
      photos.push({
        name: file.name + " p" + p,
        data: canvas.toDataURL("image/jpeg", 0.88),
        src: file.name
      });
    }
  }

  async function ingestPptx(file) {
    var zip = await JSZip.loadAsync(await fileToArray(file));
    var names = Object.keys(zip.files)
      .filter(function (n) { return /^ppt\/media\//i.test(n) && !zip.files[n].dir; })
      .sort();
    if (!names.length) throw new Error(file.name + " has no media.");
    for (var i = 0; i < names.length; i++) {
      var n = names[i];
      var blob = await zip.files[n].async("blob");
      var type = blob.type || guessType(n);
      if (type.indexOf("image/") !== 0 && !/\.(png|jpe?g|gif|webp|bmp|emf|wmf)$/i.test(n)) continue;
      if (/\.(emf|wmf)$/i.test(n)) continue;
      var named = new Blob([blob], { type: type.indexOf("image/") === 0 ? type : "image/jpeg" });
      photos.push({
        name: file.name + " · " + n.split("/").pop(),
        data: await blobToDataUrl(named),
        src: file.name
      });
    }
  }
  function guessType(n) {
    if (/\.png$/i.test(n)) return "image/png";
    if (/\.jpe?g$/i.test(n)) return "image/jpeg";
    if (/\.gif$/i.test(n)) return "image/gif";
    if (/\.webp$/i.test(n)) return "image/webp";
    return "application/octet-stream";
  }

  function paintThumbs() {
    thumbs.innerHTML = "";
    photos.forEach(function (p, i) {
      var d = document.createElement("div");
      d.className = "thumb";
      d.innerHTML = "<img alt='' /><div class='cap'>" + (i + 1) + " · " + esc(p.name) + "</div>";
      d.querySelector("img").src = p.data;
      thumbs.appendChild(d);
    });
  }

  function chunk(arr, n) {
    var out = [];
    for (var i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
    return out;
  }

  function gridFor(count) {
    if (count <= 1) return { cols: 1, rows: 1 };
    if (count === 2) return { cols: 2, rows: 1 };
    if (count <= 4) return { cols: 2, rows: 2 };
    return { cols: 3, rows: 2 };
  }

  async function buildPptx() {
    var per = Math.max(1, parseInt($("perSlide").value, 10) || 4);
    var logoOn = $("logoOn").checked;
    var wmOn = $("wmOn").checked;
    var titleOn = $("titleOn").checked;
    var title = ($("deckTitle").value || "Product proposal").trim();
    var factory = ($("factoryName").value || "").trim();
    var customer = ($("customerName").value || "").trim();
    var groups = chunk(photos, per);

    var pptx = new PptxGenJS();
    pptx.defineLayout({ name: "ALPHA16", width: 13.333, height: 7.5 });
    pptx.layout = "ALPHA16";
    pptx.author = "Alpha Fashion";
    pptx.title = title;

    var cover = pptx.addSlide();
    cover.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.333, h: 7.5, fill: { color: "1C1410" } });
    if (logoData) {
      cover.addImage({ data: logoData, x: 0.7, y: 0.55, w: 0.72, h: 0.72 });
    }
    cover.addText("ALPHA FASHION", {
      x: 1.6, y: 0.68, w: 6, h: 0.4,
      fontFace: "Arial", fontSize: 12, color: "E8B4AA", bold: true, margin: 0
    });
    cover.addText(title, {
      x: 0.7, y: 2.4, w: 12, h: 1.1,
      fontFace: "Arial", fontSize: 36, color: "FFF8F0", bold: true, margin: 0
    });
    var sub = [factory, customer].filter(Boolean).join("  ·  ") || "Customer presentation from factory proposal";
    cover.addText(sub, {
      x: 0.7, y: 3.55, w: 12, h: 0.45,
      fontFace: "Arial", fontSize: 16, color: "C9B8A8", margin: 0
    });
    cover.addShape(pptx.ShapeType.rect, { x: 0.7, y: 4.2, w: 1.6, h: 0.07, fill: { color: "C33D27" } });
    cover.addText(photos.length + " photos  ·  " + groups.length + " slides", {
      x: 0.7, y: 6.7, w: 12, h: 0.3,
      fontFace: "Arial", fontSize: 12, color: "8A7A6A", margin: 0
    });

    groups.forEach(function (g, gi) {
      var s = pptx.addSlide();
      s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.333, h: 7.5, fill: { color: "FFF8F0" } });
      s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.333, h: 0.08, fill: { color: "C33D27" } });

      var top = titleOn ? 0.72 : 0.28;
      var bottomPad = 0.28;
      if (titleOn) {
        var line = title;
        if (factory) line += "  ·  " + factory;
        s.addText(line, {
          x: 0.55, y: 0.22, w: 10.4, h: 0.38,
          fontFace: "Arial", fontSize: 16, color: "1C1410", bold: true, margin: 0
        });
      }
      if (logoOn && logoData) {
        s.addImage({ data: logoData, x: 12.28, y: 0.16, w: 0.72, h: 0.72 });
      }
      if (wmOn && logoData) {
        s.addImage({ data: logoData, x: 5.4, y: 2.4, w: 2.5, h: 2.5, transparency: 88 });
      }

      var gdef = gridFor(g.length);
      var gap = 0.16;
      var areaX = 0.4;
      var areaY = top;
      var areaW = 12.53;
      var areaH = 7.5 - top - bottomPad;
      var cellW = (areaW - gap * (gdef.cols - 1)) / gdef.cols;
      var cellH = (areaH - gap * (gdef.rows - 1)) / gdef.rows;
      g.forEach(function (ph, i) {
        var col = i % gdef.cols;
        var row = Math.floor(i / gdef.cols);
        var x = areaX + col * (cellW + gap);
        var y = areaY + row * (cellH + gap);
        s.addShape(pptx.ShapeType.roundRect, {
          x: x, y: y, w: cellW, h: cellH,
          fill: { color: "F4ECE1" }, rectRadius: 0.06
        });
        s.addImage({
          data: ph.data, x: x + 0.06, y: y + 0.06,
          w: cellW - 0.12, h: cellH - 0.12,
          sizing: { type: "contain", w: cellW - 0.12, h: cellH - 0.12 }
        });
      });
      s.addText((gi + 1) + " / " + groups.length, {
        x: 11.6, y: 7.14, w: 1.4, h: 0.22,
        fontFace: "Arial", fontSize: 10, color: "8A7A6A", align: "right", margin: 0
      });
    });

    var end = pptx.addSlide();
    end.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.333, h: 7.5, fill: { color: "C33D27" } });
    if (logoData) end.addImage({ data: logoData, x: 6.3, y: 2.1, w: 0.74, h: 0.74 });
    end.addText("Thank you", {
      x: 0.7, y: 3.1, w: 12, h: 0.7,
      fontFace: "Arial", fontSize: 32, color: "FFF8F0", align: "center", bold: true, margin: 0
    });
    end.addText("Alpha Fashion  ·  CREATE BETTER LIVES!", {
      x: 0.7, y: 3.9, w: 12, h: 0.4,
      fontFace: "Arial", fontSize: 14, color: "F3D0C8", align: "center", margin: 0
    });

    var stamp = new Date().toISOString().slice(0, 10);
    var fname = "Alpha_Proposal_" + stamp + ".pptx";
    await pptx.writeFile({ fileName: fname });
  }
  }

  root.ProposalDesk = { bind: bind };
  if (document.body && document.body.getAttribute("data-proposal-auto") === "1") bind();
})(window);
