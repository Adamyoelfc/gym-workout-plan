const API_URL = "https://oss.exercisedb.dev/api/v1/exercises/search";

export async function onRequestGet({ request }) {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") || "";

  if (!search.trim()) {
    return json({ data: [] }, 400);
  }

  const upstream = new URL(API_URL);
  upstream.searchParams.set("search", search);

  try {
    const response = await fetch(upstream, {
      headers: {
        accept: "application/json",
        "user-agent": "adam-shred-cloudflare-pages",
      },
      cf: {
        cacheTtl: 86400,
        cacheEverything: true,
      },
    });

    if (!response.ok) {
      return json({ data: [] }, 200);
    }

    return new Response(await response.text(), {
      headers: {
        "access-control-allow-origin": "*",
        "cache-control": "public, max-age=86400",
        "content-type": response.headers.get("content-type") || "application/json",
      },
    });
  } catch {
    return json({ data: [] }, 200);
  }
}

function json(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      "access-control-allow-origin": "*",
      "cache-control": "public, max-age=300",
      "content-type": "application/json",
    },
  });
}
