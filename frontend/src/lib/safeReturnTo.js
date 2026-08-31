// Shared by the auth pages (Login, Register, Reset Password, etc.).
// Keep redirect validation in one place — it is security-sensitive.

/**
 * Resolve ?returnTo= to a safe same-origin path, else "/".
 *
 * Same-origin alone is not enough: values like /.//evil.com or /\evil.com
 * parse as same-origin but become protocol-relative redirects when assigned
 * to location.href. Require exactly one leading slash and no backslashes.
 */
export function safeReturnTo() {
  const raw = new URLSearchParams(window.location.search).get("returnTo");
  if (!raw) return "/";

  try {
    const url = new URL(raw, window.location.origin);

    // Must stay on the same origin
    if (url.origin !== window.location.origin) return "/";

    // Strip any leftover auth/bootstrap params (defensive for old links)
    for (const p of [
      "access_token",
      "clear_access_token",
      "token",
      "app_id",
      "app_base_url",
      "functions_version",
      "from_url",
    ]) {
      url.searchParams.delete(p);
    }

    const path = url.pathname + url.search + url.hash;

    // Block protocol-relative and backslash tricks
    if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) {
      return "/";
    }

    return path;
  } catch {
    return "/";
  }
}
