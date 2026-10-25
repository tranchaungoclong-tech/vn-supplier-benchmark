var CUT_PROMPT =
  "Factory catalog or lookbook. Cut each SKU PHOTO / catalog CELL. Return JSON only, no markdown:\n" +
  '{"boxes":[{"x":0,"y":0,"w":1,"h":1,"item":"","name":"","material":"","size":"","price":"","moq":"","lead":""}]}\n' +
  "x,y,w,h are fractions 0-1 of the FULL image.\n" +
  "A cream/white lookbook PAGE with several separate photos = one box per photo/cell. 4 SKU photos on one sheet = 4 boxes.\n" +
  "ONE factory shot of a size set (3 pumpkins L/M/S, one item code under the group) = ONE box around the whole set. Do not split those pumpkins.\n" +
  "A room / garden / table lifestyle = ONE box. Keep the scene.\n" +
  "Tight on the photo. Skip email, logo, empty paper.\n" +
  "For every box, READ the printed text that appears INSIDE or DIRECTLY UNDER the photo: ITEM code, size, material, price, MOQ. If the text is printed on the product or on the label under it, copy it exactly. If no text is visible inside the box, leave the field empty. Do not invent values.\n" +
  "At most 12 boxes.";

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

function normBox(b) {
  return {
    x: Math.max(0, Math.min(1, +b.x || 0)),
    y: Math.max(0, Math.min(1, +b.y || 0)),
    w: Math.max(0, Math.min(1, +b.w || 0)),
    h: Math.max(0, Math.min(1, +b.h || 0)),
    item: clipField(b.item || b.code, 40),
    name: clipField(b.name, 60),
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

function localCritic(boxes) {
  return (boxes || []).filter(function (b) {
    if (b.w < 0.04 || b.h < 0.04) return false;
    if (b.w > 0.92 && b.h > 0.92) return false;
    if (b.w / b.h > 6 || b.h / b.w > 6) return false;
    return true;
  });
}

async function callModel(env, image) {
  var key = env.ALPHA_API_KEY;
  if (!key) throw new Error("ALPHA_API_KEY secret missing.");
  var split = splitDataUrl(image);
  var payload = {
    model: env.CUT_MODEL || "claude-sonnet-4-6",
    max_tokens: 1800,
    messages: [{
      role: "user",
      content: [
        { type: "image", source: { type: "base64", media_type: split.mediaType, data: split.data } },
        { type: "text", text: CUT_PROMPT }
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
      return json({ ok: !!env.ALPHA_API_KEY, service: "proposal-cut", graph: true });
    }
    if (req.method === "POST" && (path === "/cut" || path === "/vision")) {
      try {
        var body = await req.json();
        var text = await callModel(env, body.image);
        var boxes = localCritic(parseBoxes(text));
        return json({ kind: "catalog", boxes: boxes, steps: ["cut:" + boxes.length] });
      } catch (err) {
        return json({ error: err.message || String(err) }, 500);
      }
    }
    return json({ error: "not found" }, 404);
  }
};
