/// <reference types="chrome" />

/** Split "/path?query" for HashRouter navigate targets. */
export function parseExtensionRoute(route: string): { pathname: string; search: string } {
  const trimmed = route.trim();
  if (!trimmed || trimmed === "/") {
    return { pathname: "/", search: "" };
  }
  const queryIndex = trimmed.indexOf("?");
  if (queryIndex === -1) {
    return { pathname: trimmed, search: "" };
  }
  return {
    pathname: trimmed.slice(0, queryIndex) || "/",
    search: trimmed.slice(queryIndex),
  };
}

export function formatExtensionRoute(pathname: string, search: string): string {
  if (!search || search === "?") {
    return pathname || "/";
  }
  return `${pathname}${search}`;
}
