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
 * Because the result is a modified copy of someone else's documentation, every
 * page also gets a banner pointing at the official MDN page, a `noindex` robots
 * directive, and a canonical link to MDN, so a reader (or a crawler) who lands
 * here is sent to the real thing. Set `PAGES_NOTICE` to change the wording.
 *
 * It also writes the `.nojekyll` marker that stops Pages from running Jekyll
 * (which would drop the `_`-prefixed files that MDN's output contains),
 * a `robots.txt`, and a root `index.html` that redirects to the landing page.
 *
 * Usage: node .github/scripts/prepare-pages.mjs <buildRoot> <basePath> <homePath>
 */

import { existsSync, statSync } from "node:fs";
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const UPSTREAM = "https://developer.mozilla.org";

const NOTICE =
  process.env.PAGES_NOTICE ||
  "<strong>Unofficial copy.</strong> These pages are a modified mirror of MDN " +
    'Web Docs kept for <a href="https://w3.cs.jmu.edu/cs347">CS 347</a>. They ' +
    "are not maintained or reviewed by Mozilla, and the content differs from " +
    "the original.";

const NOTICE_STYLE = [
  "box-sizing:border-box",
  "margin:0",
  "padding:0.7rem 1rem",
  "background:#ffe9a8",
  "color:#2b2000",
  "border-bottom:2px solid #c9971a",
  "font:500 0.95rem/1.5 system-ui,-apple-system,sans-serif",
  "text-align:center",
].join(";");

const NOTICE_LINK_STYLE =
  "color:#5a3d00;text-decoration:underline;font-weight:700";

/**
 * The banner shown at the top of every page.
 *
 * @param {string | undefined} mdnUrl the official page this one was copied from
 */
function notice(mdnUrl) {
  const href = mdnUrl ?? UPSTREAM;
  const label = mdnUrl ? "Read the official page on MDN" : "Go to MDN Web Docs";
  // Links written into PAGES_NOTICE get the same styling as the one we add,
  // so the notice can be plain HTML.
  const body = NOTICE.replace(
    /<a (?![^>]*\bstyle=)/gi,
    `<a style="${NOTICE_LINK_STYLE}" `,
  );
  return (
    `<aside role="note" style="${NOTICE_STYLE}">${body} ` +
    `<a href="${href}" style="${NOTICE_LINK_STYLE}">${label}</a>.</aside>`
  );
}

const [buildRoot, rawBasePath = "", homePath = "/"] = process.argv.slice(2);

if (!buildRoot) {
  console.error("usage: prepare-pages.mjs <buildRoot> [basePath] [homePath]");
  process.exit(1);
}

// `actions/configure-pages` reports "/repo" for a project site and "" for a
// user or organization site. Normalize away any trailing slash.
const basePath = rawBasePath.replace(/\/+$/, "");

/** Collect every file matching `ext` in the build. */
async function findFiles(dir, ext) {
  const found = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...(await findFiles(full, ext)));
    } else if (entry.name.endsWith(ext)) {
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

// Rewrite root-absolute url() references in CSS files so assets resolve
// correctly when the site is served from a sub-path (GitHub project site).
if (basePath) {
  const cssFiles = await findFiles(buildRoot, ".css");
  for (const file of cssFiles) {
    const original = await readFile(file, "utf-8");
    const updated = original.replace(
      /\burl\((['"]?)(\/(?!\/)[^)'"\s]+)\1\)/g,
      (whole, quote, url) => {
        const target = resolve(url);
        return target === url ? whole : `url(${quote}${target}${quote})`;
      },
    );
    if (updated !== original) {
      await writeFile(file, updated);
    }
  }
}

const files = await findFiles(buildRoot, ".html");
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

  // This is a copy of someone else's documentation: say so, keep it out of
  // search results, and point both readers and crawlers at the original.
  const mdnUrl = original.match(
    /<meta\s+name="og:url"\s+content="([^"]+)"/i,
  )?.[1];

  const isDjango = /\/django\//i.test(file);
  updated = updated.replace(
    /<head(\s[^>]*)?>/i,
    (tag) =>
      `${tag}<meta name="robots" content="noindex, nofollow">` +
      (mdnUrl ? `<link rel="canonical" href="${mdnUrl}">` : "") +
      (isDjango ? `<style>body{background-color:#450084 !important}</style>` : ""),
  );

  updated = updated.replace(/<body(\s[^>]*)?>/i, (tag) => tag + notice(mdnUrl));

  if (updated !== original) {
    await writeFile(file, updated);
  }
}

await writeFile(path.join(buildRoot, ".nojekyll"), "");

// Note that a project site is served from a sub-path, so crawlers read the
// robots.txt at the *domain* root, not this one. The per-page `noindex` above
// is what actually keeps these pages out of search results; this file is here
// for anyone who looks, and for the case where the site moves to its own host.
await writeFile(
  path.join(buildRoot, "robots.txt"),
  "User-agent: *\nDisallow: /\n",
);

const home = resolve(homePath);
await writeFile(
  path.join(buildRoot, "index.html"),
  `<!doctype html>
<meta charset="utf-8">
<meta name="robots" content="noindex, nofollow">
<title>Redirecting…</title>
<meta http-equiv="refresh" content="0; url=${home}">
<link rel="canonical" href="${home}">
<p>Redirecting to <a href="${home}">${home}</a>.</p>
`,
);

console.log(
  `Rewrote ${files.length} pages: ${rewritten} local links, ${toUpstream} sent to ${UPSTREAM}.`,
);
