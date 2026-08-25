#!/usr/bin/env node

/**
 * Prepare a `rari` + `fred` build for publishing on GitHub Pages.
 *
 * The build that `fred ssr` produces is meant to be served from the root of a
 * domain: every internal link and asset is a root-absolute URL such as
 * `/en-US/docs/…` or `/static/client/…`. A project site is served from a
 * sub-path instead (`https://<owner>.github.io/<repo>/`), and GitHub Pages is
 * case-sensitive while `rari` writes its output folders in lower case. Both
 * break every link on the page, so we rewrite them here:
 *
 * - a URL whose target exists in the build is pointed at `<basePath>/<target>`,
 *   lower-cased to match the folder `rari` actually wrote;
 * - a URL whose target was not built — anything outside the content we publish,
 *   such as the sidebar links to the rest of MDN — is sent to
 *   `https://developer.mozilla.org`, so the site stays navigable instead of
 *   serving 404s.
 *
 * It also writes the `.nojekyll` marker that stops Pages from running Jekyll
 * (which would drop the `_`-prefixed files that MDN's output contains), and a
 * root `index.html` that redirects to the landing page.
 *
 * Usage: node .github/scripts/prepare-pages.mjs <buildRoot> <basePath> <homePath>
 */

import { existsSync, statSync } from "node:fs";
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const UPSTREAM = "https://developer.mozilla.org";

const [buildRoot, rawBasePath = "", homePath = "/"] = process.argv.slice(2);

if (!buildRoot) {
  console.error("usage: prepare-pages.mjs <buildRoot> [basePath] [homePath]");
  process.exit(1);
}

// `actions/configure-pages` reports "/repo" for a project site and "" for a
// user or organization site. Normalize away any trailing slash.
const basePath = rawBasePath.replace(/\/+$/, "");

/** Collect every `*.html` file in the build. */
async function htmlFiles(dir) {
  const found = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...(await htmlFiles(full)));
    } else if (entry.name.endsWith(".html")) {
      found.push(full);
    }
  }
  return found;
}

/**
 * Resolve one root-absolute URL to what it should become.
 *
 * @param {string} url a URL starting with a single "/"
 * @returns {string}
 */
function resolve(url) {
  const [pathname, suffix = ""] = splitSuffix(url);

  // Document URLs start with a locale (`/en-US/docs/…`) and are written to
  // disk in lower case, so try that spelling first.
  if (/^\/[a-z]{2}(-[a-z]{2})?(\/|$)/i.test(pathname)) {
    for (const candidate of [
      pathname.toLowerCase().replace(/\/$/, ""),
      pathname.replace(/\/$/, ""),
    ]) {
      // An attachment served from inside a page folder, such as a screenshot.
      if (isFile(path.join(buildRoot, candidate))) {
        return `${basePath}${candidate}${suffix}`;
      }
      // A page. Only counts as built if it was actually rendered.
      if (isFile(path.join(buildRoot, candidate, "index.html"))) {
        return `${basePath}${candidate}/${suffix}`;
      }
    }
    return `${UPSTREAM}${pathname}${suffix}`;
  }

  // Everything else is an asset path (`/static/…`, `/favicon.ico`); it is
  // local as long as it exists in the build.
  if (existsSync(path.join(buildRoot, pathname))) {
    return `${basePath}${pathname}${suffix}`;
  }

  return `${UPSTREAM}${pathname}${suffix}`;
}

/** True if the path exists and is a regular file. */
function isFile(candidate) {
  return statSync(candidate, { throwIfNoEntry: false })?.isFile() ?? false;
}

/** Split a URL into its path and its `?query#hash` suffix. */
function splitSuffix(url) {
  const at = url.search(/[?#]/);
  return at === -1 ? [url, ""] : [url.slice(0, at), url.slice(at)];
}

let rewritten = 0;
let toUpstream = 0;

/** Resolve a URL and keep a tally of what happened to it. */
function track(url) {
  const target = resolve(url);
  if (target !== url) {
    if (target.startsWith(UPSTREAM)) {
      toUpstream++;
    } else {
      rewritten++;
    }
  }
  return target;
}

const files = await htmlFiles(buildRoot);
for (const file of files) {
  const original = await readFile(file, "utf-8");

  // Only URL-carrying attributes are rewritten. A blanket search for quoted
  // paths would also hit prose — the Django tutorial quotes "/static/" as the
  // value of Django's own STATIC_URL setting, for instance.
  let updated = original.replace(
    /\b(href|src|action|formaction|poster|data-src)=(["'])(\/(?!\/)[^"'\s>]*)\2/gi,
    (whole, attr, quote, url) => {
      const target = track(url);
      return target === url ? whole : `${attr}=${quote}${target}${quote}`;
    },
  );

  updated = updated.replace(
    /\bsrcset=(["'])([^"']+)\1/gi,
    (whole, quote, value) => {
      const parts = value.split(",").map((part) => {
        const [url, ...rest] = part.trim().split(/\s+/);
        if (!url.startsWith("/") || url.startsWith("//")) {
          return part.trim();
        }
        return [track(url), ...rest].join(" ");
      });
      return `srcset=${quote}${parts.join(", ")}${quote}`;
    },
  );

  if (updated !== original) {
    await writeFile(file, updated);
  }
}

await writeFile(path.join(buildRoot, ".nojekyll"), "");

const home = resolve(homePath);
await writeFile(
  path.join(buildRoot, "index.html"),
  `<!doctype html>
<meta charset="utf-8">
<title>Redirecting…</title>
<meta http-equiv="refresh" content="0; url=${home}">
<link rel="canonical" href="${home}">
<p>Redirecting to <a href="${home}">${home}</a>.</p>
`,
);

console.log(
  `Rewrote ${files.length} pages: ${rewritten} local links, ${toUpstream} sent to ${UPSTREAM}.`,
);
