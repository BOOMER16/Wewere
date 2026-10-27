import { handleApi } from "./api";
const pages = new Set([
  "/",
  "/teams",
  "/fixtures",
  "/scoreboard",
  "/reports",
  "/spectator",
  "/tracker",
]);
export default {
  async fetch(request: Request, env: any) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) return handleApi(request, env.DB);
    if (!request.headers.get("oai-authenticated-user-id"))
      return Response.redirect(
        url.origin +
          "/signin-with-chatgpt?return_to=" +
          encodeURIComponent(url.pathname + url.search),
        302,
      );
    // Route app pages explicitly: the hosting asset service may not retain SPA fallback settings.
    if (
      (request.method === "GET" || request.method === "HEAD") &&
      pages.has(url.pathname.replace(/\/$/, "") || "/")
    ) {
      url.pathname = "/";
      url.search = "";
      return env.ASSETS.fetch(new Request(url, request));
    }
    return env.ASSETS.fetch(request);
  },
};
