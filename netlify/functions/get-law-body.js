const LAW_BASE_URL = "http://www.law.go.kr/DRF/lawService.do";

function jsonResponse(statusCode, data) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, x-proxy-key",
      "Access-Control-Allow-Methods": "GET, OPTIONS"
    },
    body: JSON.stringify(data)
  };
}

function checkProxyKey(event) {
  const expectedKey = process.env.PROXY_API_KEY;

  if (!expectedKey) {
    return true;
  }

  const headerKey =
    event.headers["x-proxy-key"] ||
    event.headers["X-Proxy-Key"];

  const queryKey = event.queryStringParameters?._key;

  return headerKey === expectedKey || queryKey === expectedKey;
}

exports.handler = async function(event) {
  if (event.httpMethod === "OPTIONS") {
    return jsonResponse(200, { ok: true });
  }

  if (event.httpMethod !== "GET") {
    return jsonResponse(405, {
      ok: false,
      error: "Method Not Allowed"
    });
  }

  if (!checkProxyKey(event)) {
    return jsonResponse(401, {
      ok: false,
      error: "Unauthorized",
      message: "Invalid proxy API key"
    });
  }

  const lawOc = process.env.LAW_OC;

  if (!lawOc) {
    return jsonResponse(500, {
      ok: false,
      error: "Missing LAW_OC",
      message: "Netlify environment variable LAW_OC is not set"
    });
  }

  const qs = event.queryStringParameters || {};

  const target = qs.target;
  const type = qs.type || "JSON";

  if (!target) {
    return jsonResponse(400, {
      ok: false,
      error: "Missing required parameter",
      required: ["target"]
    });
  }

  if (!["eflaw", "admrul"].includes(target)) {
    return jsonResponse(400, {
      ok: false,
      error: "Invalid target",
      allowed: ["eflaw", "admrul"]
    });
  }

  const hasLookupKey = qs.ID || qs.MST || qs.LM;

  if (!hasLookupKey) {
    return jsonResponse(400, {
      ok: false,
      error: "Missing lookup parameter",
      message: "One of ID, MST, or LM is required"
    });
  }

  const params = new URLSearchParams();
  params.set("OC", lawOc);
  params.set("target", target);
  params.set("type", type);

  if (qs.ID) params.set("ID", qs.ID);
  if (qs.MST) params.set("MST", qs.MST);
  if (qs.LM) params.set("LM", qs.LM);
  if (qs.JO) params.set("JO", qs.JO);
  if (qs.efYd) params.set("efYd", qs.efYd);

  const url = `${LAW_BASE_URL}?${params.toString()}`;

  try {
    const response = await fetch(url);
    const text = await response.text();

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { raw: text };
    }

    return jsonResponse(response.status, {
      ok: response.ok,
      source: "law.go.kr",
      endpoint: "lawService.do",
      request: {
        target,
        type,
        ID: qs.ID,
        MST: qs.MST,
        LM: qs.LM,
        JO: qs.JO,
        efYd: qs.efYd
      },
      data: parsed
    });
  } catch (error) {
    return jsonResponse(500, {
      ok: false,
      error: "Proxy request failed",
      message: error.message
    });
  }
};
