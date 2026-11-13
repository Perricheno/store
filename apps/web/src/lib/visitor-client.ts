// Every visitor-scoped client request waits for this one cookie-creating request.
// The HttpOnly cookie is deliberately never read or written by client code.
let visitorReady: Promise<void> | undefined;
export function ensureVisitor(): Promise<void> {
  if (!visitorReady) {
    visitorReady = fetch("/api/cart", {
      credentials: "same-origin",
      cache: "no-store",
      keepalive: true,
      signal: AbortSignal.timeout(10000),
    })
      .then((response) => {
        if (!response.ok) throw new Error("Visitor initialization failed");
      })
      .catch((error: unknown) => {
        visitorReady = undefined;
        throw error;
      });
  }
  return visitorReady;
}
