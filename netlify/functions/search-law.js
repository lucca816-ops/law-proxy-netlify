const LAW_BASE_URL = "http://www.law.go.kr/DRF/lawSearch.do";

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

  const originalTarget = qs.target;
  let target = originalTarget;

  if (target === "eflaw") {
    target = "law";
  }

  const query = qs.query;
  const type = qs.type || "JSON";
  const display = qs.display || "10";
  const page = qs.page || "1";
  const nw = qs.nw || "1";
  const search = qs.search || "1";

  if (!target || !query) {
    return jsonResponse(400, {
      ok: false,
      error: "Missing required parameters",
      required: ["target", "query"]
    });
  }

  if (!["law", "admrul"].includes(target)) {
    return jsonResponse(400, {
      ok: false,
      error: "Invalid target",
      allowed: ["law", "admrul"]
    });
  }

  const params = new URLSearchParams();
  params.set("OC", lawOc);
  params.set("target", target);
  params.set("query", query);
  params.set("type", type);
  params.set("display", display);
  params.set("page", page);

  if (target === "admrul") {
    params.set("nw", nw);
    params.set("search", search);
  }

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
      version: "search-law-v2",
      source: "law.go.kr",
      endpoint: "lawSearch.do",
      request: {
        originalTarget,
        target,
        query,
        type,
        display,
        page,
        nw: target === "admrul" ? nw : undefined,
        search: target === "admrul" ? search : undefined
      },
      data: parsed
    });
  } catch (error) {
    return jsonResponse(500, {
      ok: false,
      version: "search-law-v2",
      error: "Proxy request failed",
      message: error.message,
      name: error.name,
      cause: error.cause ? String(error.cause) : null
    });
  }
};
