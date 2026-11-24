export default {
  async fetch(request, env) {
    const path = new URL(request.url);
    if (!path.pathname.startsWith("/api/")) return env.ASSETS.fetch(request);
    if (!env.API_ORIGIN)
      return Response.json(
        { detail: "Workspace API is not configured" },
        { status: 503 },
      );
    const upstream = new URL(env.API_ORIGIN);
    if (upstream.protocol !== "https:")
      return new Response("Invalid API configuration", { status: 503 });
    upstream.pathname = path.pathname;
    upstream.search = path.search;
    return fetch(new Request(upstream, request), { redirect: "manual" });
  },
};
