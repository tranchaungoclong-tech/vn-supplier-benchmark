var CUT_PROMPT =
  "Look at THIS image only. Return JSON, no markdown:\n" +
  '{"boxes":[{"x":0,"y":0,"w":1,"h":1,"item":"","name":"","material":"","size":"","price":"","moq":"","lead":""}]}\n' +
  "x,y,w,h = fractions of THIS image, 0-1.\n" +
  "Count separate photographs on the page (photos divided by pale paper, not objects inside one photo).\n" +
  "If count >= 2: one box per photograph. The box MUST include the printed caption under that photograph (item code + size). Title / heading / Thank You / FOR WATCHING / QR / email / phone / logo / empty paper = not a box. A group of the same product in several sizes with one caption under the group = one photograph. A room shot sitting next to other photos = one photograph.\n" +
  "If count == 1: exactly one box around that photograph including its caption. Do not split a table scene, a garden, a single product, or a size set.\n" +
  "item = digits printed under that photograph (NNNN-NNNNN only). size = printed size under it (L/M/S, SIZE L/M/S, H22, H21/H19, D28xH21, L45). Leave \"\" if you cannot read it. Never put size or a heading in item. Do not invent.\n" +
  "At most 16 boxes.";

var LOOK_KINDS = { tray: 1, vase: 1, basket: 1, pumpkin: 1, lantern: 1, wreath: 1, planter: 1, bowl: 1, other: 1 };

var LOOK_PROMPT =
  "Look at THIS image only. Return JSON, no markdown:\n" +
  '{"kind":"tray","material":"","shape":"","construction":"","canMake":"unknown","similar":false,"score":0,"reason":""}\n' +
  "kind MUST be exactly one of: tray, vase, basket, pumpkin, lantern, wreath, planter, bowl, other.\n" +
  "Name kind from THIS photo's silhouette. Do not copy a kind from any other product.\n" +
  "tray = low flat serving/display surface, usually wider than tall, often with side handles. NEVER a jug, amphora, pitcher, urn, bottle, or flower vessel.\n" +
  "vase = tall vessel for flowers or water (neck, belly, or two body handles). If the object is taller than it is wide, it is NOT a tray.\n" +
  "basket = open container with high walls or a handle arch. planter = pot to hold a plant. bowl = deep round dish.\n" +
  "Tray and vase are NEVER the same kind. A water-hyacinth jug is a vase, not a tray.\n" +
  "If two products sit in one photo, name the MAIN product that fills the frame. Do not mix them.\n" +
  "material / shape / construction = only what you see. Leave \"\" if unsure.\n" +
  "canMake = yes if this looks like a hand-woven natural-fiber home item (rattan, hyacinth, seagrass, bamboo) a weaving factory already makes. canMake = no if ceramic, glass, metal spinning, injection plastic, or a round/oval lighting body that is not a woven lantern. canMake = unknown if you cannot tell. Do not invent item code, $, MOQ, or size.\n" +
  "similar = false and score = 0 on this classify call. reason = one short sentence of what you see.";

var LOOK_COMPARE =
  "Look at THIS factory catalogue photo. Return JSON, no markdown:\n" +
  '{"kind":"tray","material":"","shape":"","construction":"","canMake":"unknown","similar":false,"score":0,"reason":""}\n' +
  "kind MUST be exactly one of: tray, vase, basket, pumpkin, lantern, wreath, planter, bowl, other.\n" +
  "Name kind from THIS photo only. Do not copy the buyer trend kind. A jug/amphora/pitcher is vase. A low rectangle is tray. If taller than wide, not a tray.\n" +
  "similar is true ONLY if THIS photo is the SAME product kind as the buyer trend AND it is one of the closest looks (same silhouette / weave / handle). Same kind but a different shape, rim, or weave → similar false, score at most 0.45.\n" +
  "score is 0 to 1 for look closeness. 0 if different kind. Do not give 0.7+ just because both are trays.\n" +
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
    size: clipField(b.size, 40),
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

function parseLook(text, trendKind) {
  var o = parseJsonObject(text);
  var kind = String(o.kind || "other").toLowerCase().replace(/[^a-z]/g, "");
  if (!LOOK_KINDS[kind]) kind = "other";
  var canMake = String(o.canMake || o.can_make || "unknown").toLowerCase();
  if (canMake !== "yes" && canMake !== "no") canMake = "unknown";
  var similar = o.similar === true || o.similar === "true";
  var score = Math.max(0, Math.min(1, Number(o.score)));
  if (!isFinite(score)) score = similar ? 0.6 : 0;
  if (trendKind && kind !== trendKind) {
    similar = false;
    score = 0;
  } else if (!similar) {
    score = Math.min(score, 0.45);
  }
  return {
    kind: kind,
    material: clipLook(o.material, 40),
    shape: clipLook(o.shape, 24),
    construction: clipLook(o.construction, 24),
    canMake: canMake,
    similar: similar,
    score: score,
    reason: clipLook(o.reason, 160)
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
