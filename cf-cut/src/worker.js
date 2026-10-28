var CUT_PROMPT =
  "Look at THIS image only. Return JSON, no markdown:\n" +
  '{"boxes":[{"x":0,"y":0,"w":1,"h":1,"item":"","name":"","material":"","size":"","price":"","moq":"","lead":""}]}\n' +
  "x,y,w,h = fractions of THIS image, 0-1.\n" +
  "Count separate photographs on the page (photos divided by pale paper, not objects inside one photo).\n" +
  "If count >= 2: one box per photograph. The box MUST include the printed caption under or beside that photograph (item name + size). Title / heading / Thank You / FOR WATCHING / QR / email / phone / logo / empty paper = not a box. A group of the same product in several sizes with one caption under the group = one photograph. A room shot sitting next to other photos = one photograph.\n" +
  "If count == 1: exactly one box around that photograph including its caption. Do not split a table scene, a garden, a single product, or a size set.\n" +
  "item = digits printed for that photograph (NNNN-NNNNN only). size = the printed size for that photograph, under it OR beside it (L/M/S, SIZE L, H22, H21/H19, D28 × H6cm, D27 × H25/18cm, D19 × H19/13cm). Copy those printed digits. Leave \"\" only if none is printed. Never put size in item. Do not invent.\n" +
  "At most 16 boxes.";

var LOOK_KINDS = { tray: 1, vase: 1, basket: 1, pumpkin: 1, lantern: 1, wreath: 1, planter: 1, bowl: 1, other: 1 };

var LOOK_PROMPT =
  "Look at THIS image only. Return JSON, no markdown:\n" +
  '{"kind":"other","material":"","shape":"","construction":"","canMake":"unknown","similar":false,"score":0,"reason":""}\n' +
  "kind MUST be exactly one of: tray, vase, basket, pumpkin, lantern, wreath, planter, bowl, other. Default kind is other until the silhouette is clear.\n" +
  "Name kind from THIS photo's silhouette. Do not copy a kind from any other product.\n" +
  "tray = low flat serving/display surface, usually wider than tall, often with side handles. A scalloped plate, charger, platter, or shallow dish is a tray. NEVER a jug, amphora, pitcher, urn, bottle, or flower vessel.\n" +
  "vase = tall vessel for flowers or water (neck, belly, or two body handles). If the object is taller than it is wide AND there is no tray in the foreground, it is NOT a tray.\n" +
  "basket = open container with HIGH walls or a handle arch (can hold volume). A low scalloped plate is NOT a basket.\n" +
  "planter = pot to hold a plant. bowl = deep round dish that is not a plate.\n" +
  "Tray and vase are NEVER the same kind. A water-hyacinth jug is a vase, not a tray.\n" +
  "Buyer trend photos often stage a TRAY in front with bottles, jugs, or baskets behind. If a handled tray / platter / charger is in the foreground, kind = tray. Do not name the background bottles.\n" +
  "If two products sit in one photo, name the MAIN product that fills the frame. A tray in front wins over bottles behind.\n" +
  "material / shape / construction = only what you see. Leave \"\" if unsure.\n" +
  "canMake = yes if this looks like a hand-woven natural-fiber home item (rattan, hyacinth, seagrass, bamboo) a weaving factory already makes. canMake = no if ceramic, glass, metal spinning, injection plastic, or a round/oval lighting body that is not a woven lantern. canMake = unknown if you cannot tell. Do not invent item code, $, MOQ, or size.\n" +
  "similar = false and score = 0 on this classify call. reason = one short sentence of what you see.";

var LOOK_COMPARE =
  "Look at THIS factory catalogue photo. Return JSON, no markdown:\n" +
  '{"kind":"other","material":"","shape":"","construction":"","canMake":"unknown","similar":false,"score":0,"reason":""}\n' +
  "kind MUST be exactly one of: tray, vase, basket, pumpkin, lantern, wreath, planter, bowl, other. Default kind is other until the silhouette is clear.\n" +
  "Name kind from THIS photo only. Do not copy the buyer trend kind. A jug/amphora/pitcher/bottle/flower vessel is vase even if the buyer trend is a tray. A low rectangle, scalloped plate, charger, or platter is tray. If taller than wide with a neck or belly and no serving surface, not a tray. A low plate is not a basket.\n" +
  "similar is true only if THIS photo is the SAME product kind as the buyer trend (tray with tray, vase with vase). similar is false if the kind is different. A vase is never similar to a tray.\n" +
  "score is 0 to 1 for look closeness among the SAME kind. Same-kind trays usually 0.55–0.90. A close scalloped or handled tray to a scalloped/handled trend should score 0.75+. Round vs rectangle can stay 0.50–0.65. 0 if different kind. Do not zero a tray just because it is not the single closest.\n" +
  "canMake = yes/no/unknown for a rattan/hyacinth/seagrass weaving factory. Do not invent item code, $, MOQ, or size.\n" +
  "reason = one short sentence.\n" +
  "Buyer trend: ";

function cors(headers) {
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "content-type");
  return headers;
}

function json(data, status) {
  var h = cors(new Headers({ "content-type": "application/json" }));
  return new Response(JSON.stringify(data), { status: status || 200, headers: h });
}

function parseJsonObject(text) {
  var s = String(text || "").trim();
  var fence = s.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) s = fence[1].trim();
  var start = s.indexOf("{");
  var end = s.lastIndexOf("}");
  if (start < 0 || end <= start) return {};
  try { return JSON.parse(s.slice(start, end + 1)); } catch (e) { return {}; }
}

function clipField(v, n) {
  return String(v || "").replace(/\s+/g, " ").trim().slice(0, n || 40);
}

function printedSize(s) {
  var t = String(s || "");
  var m = t.match(/\bSIZE\s*:?\s*(L\s*\/\s*M\s*\/\s*S|[LMS])/i)
    || t.match(/\b[DLWH]\s*\d[\w./\-x× ]{0,28}(?:cm)?/i)
    || t.match(/\b\d+(?:\.\d+)?\s*[x×]\s*\d+(?:\.\d+)?(?:\s*cm)?/i);
  return m ? clipField(m[0].replace(/\s+/g, " "), 40) : "";
}

function onlyItemCode(s) {
  var t = String(s || "");
  var m = t.match(/\b(\d{4})\s*[-–]\s*(\d{4,})\b/);
  if (m) return m[1] + "-" + m[2];
  m = t.replace(/(\d)\s+(?=\d)/g, "$1").match(/\b(\d{4})[-–](\d{4,})\b/);
  return m ? m[1] + "-" + m[2] : "";
}

function dropHeading(s) {
  var t = clipField(s, 60);
  if (!t) return "";
  if (!/\d/.test(t) && /collection|cottage|rattan|pumpkin|decor|harvest/i.test(t)) return "";
  if (!/\d/.test(t) && t === t.toUpperCase() && t.length <= 28) return "";
  return t;
}

function normBox(b) {
  return {
    x: Math.max(0, Math.min(1, +b.x || 0)),
    y: Math.max(0, Math.min(1, +b.y || 0)),
    w: Math.max(0, Math.min(1, +b.w || 0)),
    h: Math.max(0, Math.min(1, +b.h || 0)),
    item: onlyItemCode(b.item || b.code || b.name),
    name: dropHeading(b.name),
    material: clipField(b.material, 40),
    size: printedSize(b.size) || printedSize(b.name) || clipField(b.size, 40),
    price: clipField(b.price, 24),
    moq: clipField(b.moq, 16),
    lead: clipField(b.lead || b.leadTime, 24)
  };
}

function parseBoxes(text) {
  var obj = parseJsonObject(text);
  var boxes = obj.boxes || obj.objects || [];
  if (!Array.isArray(boxes)) return [];
  return boxes.map(normBox).filter(function (b) { return b.w >= 0.04 && b.h >= 0.04; });
}

function splitDataUrl(dataUrl) {
  var m = String(dataUrl || "").match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/i);
  if (!m) throw new Error("Need a JPEG/PNG data URL.");
  return { mediaType: m[1].toLowerCase(), data: m[2] };
}

function extractText(body) {
  var text = "";
  (body.content || []).forEach(function (c) {
    if (c.type === "text") text += c.text || "";
  });
  return text;
}

function isScrapLabel(b) {
  var t = [b.item, b.name, b.size].join(" ");
  return /thank\s*you|thanks\s*!|for\s*watching|please\s*scan|scan\s*me|harvest\s*gather|^alpha\s*fashion$/i.test(t);
}

function localCritic(boxes) {
  var out = (boxes || []).filter(function (b) {
    if (b.w < 0.08 || b.h < 0.08) return false;
    if (b.w / b.h > 3.5 && Math.min(b.w, b.h) < 0.12) return false;
    if (b.h / b.w > 3.5 && Math.min(b.w, b.h) < 0.12) return false;
    if (isScrapLabel(b)) return false;
    return true;
  });
  if (out.length >= 2) {
    out = out.filter(function (b) { return !(b.w > 0.92 && b.h > 0.92); });
  }
  return out;
}

function clipLook(v, n) {
  return String(v || "").replace(/\s+/g, " ").trim().slice(0, n || 80);
}

function lookText(o) {
  return String([o && o.reason, o && o.shape, o && o.construction].join(" ").toLowerCase())
    .replace(/\bnot an?\s+(?:tray|vase|basket|platter|charger)[^,.!]*/g, " ")
    .replace(/\bno tray\b|\bunlike the [^,.]*tray/g, " ");
}

function vaseWords(blob) {
  return /vase|amphora|pitcher|urn|\bjug\b|\bbottle\b|flower vessel|hyacinth jug|water[- ]hyacinth|neck.{0,40}handles|handles.{0,40}neck/.test(blob);
}

function trayWords(blob) {
  return /\btrays?\b|platter|charger|scalloped plate|handled rect|side handles|serving board/.test(blob);
}

function mixedTrayScene(blob) {
  return trayWords(blob) && /(foreground|in front|handled (?:serving )?tray|rectangular tray)/.test(blob);
}

function parseLook(text, trendKind) {
  var o = parseJsonObject(text);
  var kind = String(o.kind || "other").toLowerCase().replace(/[^a-z]/g, "");
  if (!LOOK_KINDS[kind]) kind = "other";
  var reason = clipLook(o.reason, 160);
  var shape = clipLook(o.shape, 24);
  var construction = clipLook(o.construction, 24);
  var blob = lookText({ reason: reason, shape: shape, construction: construction });
  if (!trendKind && mixedTrayScene(blob)) kind = "tray";
  if (vaseWords(blob) && !trayWords(blob) && kind === "tray") kind = "vase";
  var canMake = String(o.canMake || o.can_make || "unknown").toLowerCase();
  if (canMake !== "yes" && canMake !== "no") canMake = "unknown";
  var similar = o.similar === true || o.similar === "true";
  var score = Math.max(0, Math.min(1, Number(o.score)));
  if (!isFinite(score)) score = similar ? 0.6 : 0;
  if (trendKind === "tray" && (kind === "vase" || kind === "planter" || kind === "lantern" || (vaseWords(blob) && !trayWords(blob)))) {
    if (kind === "tray") kind = "vase";
    similar = false;
    score = 0;
  } else if (trendKind && kind !== trendKind) {
    similar = false;
    score = 0;
  } else if (trendKind && kind === trendKind) {
    if (score >= 0.5) similar = true;
    if (similar && score < 0.5) score = 0.55;
  }
  return {
    kind: kind,
    material: clipLook(o.material, 40),
    shape: shape,
    construction: construction,
    canMake: canMake,
    similar: similar,
    score: score,
    reason: reason
  };
}

async function callModel(env, image, prompt, maxTokens) {
  var key = env.ALPHA_API_KEY;
  if (!key) throw new Error("ALPHA_API_KEY secret missing.");
  var split = splitDataUrl(image);
  var payload = {
    model: env.CUT_MODEL || "claude-sonnet-4-6",
    max_tokens: maxTokens || 2200,
    messages: [{
      role: "user",
      content: [
        { type: "image", source: { type: "base64", media_type: split.mediaType, data: split.data } },
        { type: "text", text: prompt || CUT_PROMPT }
      ]
    }]
  };
  var res = await fetch("https://alphaiapi.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify(payload)
  });
  var raw = await res.text();
  if (!res.ok) {
    var msg = "Vision " + res.status;
    try {
      var err = JSON.parse(raw);
      msg = (err.error && (err.error.message || err.error.type)) || err.message || msg;
    } catch (e) {}
    throw new Error(msg);
  }
  return extractText(JSON.parse(raw));
}

export default {
  async fetch(req, env) {
    var headers = cors(new Headers());
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: headers });
    var url = new URL(req.url);
    var path = url.pathname;
    if (req.method === "GET" && (path === "/" || path === "/health")) {
      return json({ ok: !!env.ALPHA_API_KEY, service: "proposal-cut", graph: true, look: true });
    }
    if (req.method === "POST" && (path === "/cut" || path === "/vision")) {
      try {
        var body = await req.json();
        var text = await callModel(env, body.image, CUT_PROMPT, 2200);
        var boxes = localCritic(parseBoxes(text));
        return json({ kind: "catalog", boxes: boxes, steps: ["cut:" + boxes.length] });
      } catch (err) {
        return json({ error: err.message || String(err) }, 500);
      }
    }
    if (req.method === "POST" && path === "/look") {
      try {
        var lookBody = await req.json();
        var trend = lookBody.trend || null;
        var trendKind = trend && LOOK_KINDS[String(trend.kind || "").toLowerCase()] ? String(trend.kind).toLowerCase() : "";
        var prompt = trendKind
          ? LOOK_COMPARE + JSON.stringify({
              kind: trendKind,
              material: clipLook(trend.material, 40),
              shape: clipLook(trend.shape, 24),
              construction: clipLook(trend.construction, 24)
            })
          : LOOK_PROMPT;
        var lookText = await callModel(env, lookBody.image, prompt, 400);
        return json(parseLook(lookText, trendKind));
      } catch (err) {
        return json({ error: err.message || String(err) }, 500);
      }
    }
    return json({ error: "not found" }, 404);
  }
};
