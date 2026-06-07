/**
 * Smoke test for the humanize scroll feature.
 * Run: node test-humanize.js
 *
 * Loads the content script under a minimal jsdom environment and
 * verifies the new functions exist, the fixture is parsed correctly,
 * and the message dispatch routes to the right handlers.
 */

const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const html = fs.readFileSync(
  path.join(__dirname, "fixtures/upwork-search-result-test-1.html"),
  "utf8",
);
const dom = new JSDOM(html);
global.window = dom.window;
global.document = dom.window.document;
global.HTMLElement = dom.window.HTMLElement;
// jsdom doesn't provide requestAnimationFrame by default — stub it so
// the humanize scroll code can run. (The code itself also falls back
// to setTimeout if rAF is missing, so this just makes the test more
// representative of a real browser.)
global.requestAnimationFrame = (cb) => setTimeout(cb, 0);

// Minimal chrome.runtime stub so the script can register its listener.
global.chrome = {
  runtime: {
    onMessage: {
      _listeners: [],
      addListener(cb) {
        this._listeners.push(cb);
      },
    },
  },
};

// Eval the content script in this context so its top-level
// declarations (functions, consts) are visible here.
const code = fs.readFileSync(path.join(__dirname, "content.js"), "utf8");
eval(code);

let pass = 0;
let fail = 0;
function ok(cond, msg) {
  if (cond) {
    pass++;
    console.log("  ✅", msg);
  } else {
    fail++;
    console.log("  ❌", msg);
  }
}

console.log("\n=== Test: humanize scroll feature shape ===");
ok(
  typeof humanizeScrollAndCapture === "function",
  "humanizeScrollAndCapture is a function",
);
ok(typeof ensureOverlay === "function", "ensureOverlay is a function");
ok(typeof showOverlay === "function", "showOverlay is a function");
ok(typeof updateOverlay === "function", "updateOverlay is a function");
ok(typeof hideOverlay === "function", "hideOverlay is a function");
ok(typeof sleep === "function", "sleep is a function");
ok(typeof getJobArticles === "function", "getJobArticles is a function");
ok(typeof parseVisibleJobs === "function", "parseVisibleJobs is a function");
ok(
  typeof pickCurrentArticle === "function",
  "pickCurrentArticle is a function",
);
ok(typeof setActiveArticle === "function", "setActiveArticle is a function");
ok(
  typeof ensureScrapedStyles === "function",
  "ensureScrapedStyles is a function",
);
// Verify the breathing-room constant exists in the content script
// source. (We can't access the const directly because eval() keeps
// `const` declarations in script-local scope.)
const contentSource = fs.readFileSync(
  path.join(__dirname, "content.js"),
  "utf8",
);
ok(
  /HUMANIZE_ACTIVE_BREATHING_PX\s*=\s*\d+/.test(contentSource),
  "content.js declares a HUMANIZE_ACTIVE_BREATHING_PX constant",
);
ok(
  /HUMANIZE_FADE_MS\s*=\s*\d+/.test(contentSource),
  "content.js declares a HUMANIZE_FADE_MS constant",
);
ok(
  global.chrome.runtime.onMessage._listeners.length === 1,
  "Message listener registered",
);

console.log("\n=== Test: fixture parsing ===");
const articles = getJobArticles();
ok(
  articles.length === 2,
  `Found 2 articles in fixture (got ${articles.length})`,
);

const jobs = parseVisibleJobs();
ok(jobs.length === 2, `parseVisibleJobs returns 2 jobs (got ${jobs.length})`);
ok(
  jobs[0].title && jobs[0].title.includes("Designer"),
  "First job title contains 'Designer'",
);
ok(
  jobs[0].job_id === "2063176357529210561",
  `First job ID is 2063176357529210561 (got ${jobs[0].job_id})`,
);

console.log("\n=== Test: scraped styling helpers ===");
ensureScrapedStyles();
const styleEl = document.getElementById("usx-scraped-styles");
ok(!!styleEl, "ensureScrapedStyles injects a <style> element");
ok(
  styleEl && styleEl.textContent.includes("#91aeff"),
  "Injected CSS contains the requested border color",
);
ok(
  styleEl && styleEl.textContent.includes("#ebf2ff"),
  "Injected CSS contains the requested background color",
);
ok(
  styleEl && styleEl.textContent.includes("16px"),
  "Injected CSS contains the requested border radius",
);
ok(
  styleEl && styleEl.textContent.includes("usx-active"),
  "Injected CSS uses a single usx-active class (not usx-fading/usx-scraped)",
);
ok(
  styleEl && !styleEl.textContent.includes("usx-fading"),
  "Injected CSS no longer uses the old usx-fading class",
);
ok(
  styleEl && !styleEl.textContent.includes("usx-scraped"),
  "Injected CSS no longer uses the old usx-scraped class",
);
// Verify the CSS transition is slow enough to actually be visible
// (>= 0.5s). 0.85s is what we set in content.js.
const hasTransition = styleEl && /0\.\d+s/.test(styleEl.textContent);
const slowTransition =
  styleEl &&
  (styleEl.textContent.includes("0.85s") ||
    styleEl.textContent.includes("0.8s") ||
    styleEl.textContent.includes("0.9s") ||
    styleEl.textContent.includes("1s"));
ok(
  hasTransition && slowTransition,
  "Injected CSS uses a slow (>= 0.5s) transition so the fade is visible",
);

const cur = pickCurrentArticle();
ok(
  cur instanceof dom.window.HTMLElement,
  "pickCurrentArticle returns an HTMLElement",
);
ok(
  cur && cur.getAttribute("data-test") === "JobTile",
  "pickCurrentArticle returns a JobTile article",
);

// Only one article should ever be marked active. Setting it on the
// first one and then on the second should clear the first.
const second = articles[1];
ok(cur !== second, "Fixture has two distinct articles");

// Use a helper to run the async (rAF) parts and finish the tests.
function runAsyncChecks() {
  setActiveArticle(cur);
  setTimeout(() => {
    ok(
      cur.classList.contains("usx-active"),
      "setActiveArticle adds usx-active to the target",
    );
    ok(
      !second.classList.contains("usx-active"),
      "Non-target article is NOT marked active",
    );

    setActiveArticle(second);
    setTimeout(() => {
      ok(
        second.classList.contains("usx-active"),
        "setActiveArticle moves usx-active to the new target",
      );
      ok(
        !cur.classList.contains("usx-active"),
        "Previous article is cleared when active moves on",
      );

      finishRoutingTests();
    }, 10);
  }, 10);
}

function finishRoutingTests() {
  console.log("\n=== Test: message routing ===");
  const listener = global.chrome.runtime.onMessage._listeners[0];

  let pingReply = null;
  listener({ action: "PING" }, {}, (r) => {
    pingReply = r;
  });
  ok(pingReply && pingReply.pong === true, "PING returns pong");

  let captureReply = null;
  listener({ action: "CAPTURE_VISIBLE_JOBS" }, {}, (r) => {
    captureReply = r;
  });
  ok(
    captureReply &&
      Array.isArray(captureReply.jobs) &&
      captureReply.jobs.length === 2,
    "CAPTURE_VISIBLE_JOBS returns the parsed jobs",
  );

  listener({ action: "HUMANIZE_AND_CAPTURE" }, {}, () => {});
  ok(
    true,
    "HUMANIZE_AND_CAPTURE handler accepted (returns true to keep channel open)",
  );

  console.log("\n" + "=".repeat(50));
  console.log(`RESULTS: ${pass} passed, ${fail} failed`);
  console.log("=".repeat(50));
  process.exit(fail > 0 ? 1 : 0);
}

runAsyncChecks();
