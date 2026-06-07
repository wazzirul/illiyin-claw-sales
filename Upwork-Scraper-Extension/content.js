// content.js

// Tunable timings for the "humanize scroll" gimmick.
// Values are chosen to look like a person reading through results
// rather than a robot jumping straight to the bottom.
const HUMANIZE_MIN_DELAY_MS = 250;
const HUMANIZE_MAX_DELAY_MS = 700;
const HUMANIZE_SETTLE_MS = 300; // wait for layout / lazy-rendered content
const HUMANIZE_MAX_STEPS = 500; // safety cap so it never spins forever
const HUMANIZE_FADE_MS = 900; // how long the highlight stays on each article
const HUMANIZE_ACTIVE_BREATHING_PX = 48; // ~3rem of space above the active article

// Overlay element IDs/classes — keep them namespaced so we don't
// collide with Upwork's own classes (which all start with `air3-`).
const OVERLAY_ID = "usx-humanize-overlay";
const OVERLAY_HOST_ATTR = "data-usx-overlay";

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "PING") {
    sendResponse({ pong: true });
    return;
  }
  if (message.action === "CAPTURE_VISIBLE_JOBS") {
    try {
      const jobs = parseVisibleJobs();
      sendResponse({ jobs });
    } catch (error) {
      console.error("Error parsing jobs:", error);
      sendResponse({ jobs: [], error: error.message });
    }
    return;
  }
  if (message.action === "HUMANIZE_AND_CAPTURE") {
    // Run the full experience in the page: show floating overlay,
    // scroll the page one article at a time, then return parsed jobs.
    // The async work happens inside; we return true to keep the
    // message channel open until we're done.
    humanizeScrollAndCapture()
      .then((jobs) => sendResponse({ jobs }))
      .catch((error) => {
        console.error("Humanize+Capture failed:", error);
        sendResponse({ jobs: [], error: error.message });
      });
    return true;
  }
});

// ---- Floating overlay (top-right) ----
//
// Injects a small fixed-position card into the page so the user
// sees a "Reading results…" indicator while the page scrolls on its
// own, one article at a time.
function ensureOverlay() {
  let host = document.getElementById(OVERLAY_ID);
  if (host) return host;

  host = document.createElement("div");
  host.id = OVERLAY_ID;
  host.setAttribute(OVERLAY_HOST_ATTR, "true");
  // Use a Shadow DOM root so Upwork's CSS can't bleed in or out.
  const root = host.attachShadow({ mode: "open" });
  root.innerHTML = `
    <style>
      :host { all: initial; }
      .card {
        position: fixed;
        top: 16px;
        right: 16px;
        z-index: 2147483646;
        width: 260px;
        padding: 12px 14px;
        border-radius: 10px;
        background: #ffffff;
        color: #1a1a1a;
        font: 13px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI",
              Roboto, Helvetica, Arial, sans-serif;
        box-shadow: 0 8px 24px rgba(0,0,0,0.18),
                    0 2px 6px rgba(0,0,0,0.08);
        border: 1px solid #e5e7eb;
        transition: opacity 0.2s ease, transform 0.2s ease;
      }
      .card.hidden {
        opacity: 0;
        transform: translateY(-6px);
        pointer-events: none;
      }
      .row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 8px;
      }
      .label {
        font-weight: 600;
        color: #14a800;
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #14a800;
        box-shadow: 0 0 0 0 rgba(20,168,0,0.6);
        animation: pulse 1.4s ease-out infinite;
      }
      @keyframes pulse {
        0%   { box-shadow: 0 0 0 0 rgba(20,168,0,0.55); }
        70%  { box-shadow: 0 0 0 10px rgba(20,168,0,0); }
        100% { box-shadow: 0 0 0 0 rgba(20,168,0,0); }
      }
      .count {
        font-size: 12px;
        color: #6b7280;
        font-variant-numeric: tabular-nums;
      }
      .track {
        width: 100%;
        height: 6px;
        background: #eef0f1;
        border-radius: 999px;
        overflow: hidden;
      }
      .bar {
        height: 100%;
        width: 0%;
        background: linear-gradient(90deg, #14a800 0%, #3ec23e 100%);
        border-radius: 999px;
        transition: width 0.35s ease-out;
      }
      .hint {
        font-size: 11px;
        color: #9ca3af;
        margin-top: 6px;
        font-style: italic;
      }
    </style>
    <div class="card hidden" part="card">
      <div class="row">
        <span class="label"><span class="dot"></span><span class="text">Reading results…</span></span>
        <span class="count">0</span>
      </div>
      <div class="track"><div class="bar"></div></div>
      <div class="hint">Humanized scroll — taking it slow.</div>
    </div>
  `;
  document.documentElement.appendChild(host);
  return host;
}

function showOverlay() {
  const host = ensureOverlay();
  const card = host.shadowRoot.querySelector(".card");
  const bar = host.shadowRoot.querySelector(".bar");
  const count = host.shadowRoot.querySelector(".count");
  const text = host.shadowRoot.querySelector(".text");
  card.classList.remove("hidden");
  bar.style.width = "0%";
  count.textContent = "0";
  text.textContent = "Reading results…";
}

function updateOverlay({ pct, count, label }) {
  const host = document.getElementById(OVERLAY_ID);
  if (!host) return;
  const bar = host.shadowRoot.querySelector(".bar");
  const countEl = host.shadowRoot.querySelector(".count");
  const textEl = host.shadowRoot.querySelector(".text");
  if (typeof pct === "number") bar.style.width = pct + "%";
  if (typeof count === "number" || typeof count === "string") {
    countEl.textContent = String(count);
  }
  if (label) textEl.textContent = label;
}

function hideOverlay(delayMs = 1200) {
  const host = document.getElementById(OVERLAY_ID);
  if (!host) return;
  const card = host.shadowRoot.querySelector(".card");
  setTimeout(() => {
    card.classList.add("hidden");
  }, delayMs);
}

function removeOverlay() {
  const host = document.getElementById(OVERLAY_ID);
  if (host) host.remove();
}

// Transform the overlay into a persistent success card that the user
// can dismiss at their leisure. Shows the count of scraped jobs and
// a brief success message so the user gets visual confirmation that
// the capture worked.
function showOverlaySuccess(count) {
  const host = document.getElementById(OVERLAY_ID);
  if (!host) return;

  const bar = host.shadowRoot.querySelector(".bar");
  const countEl = host.shadowRoot.querySelector(".count");
  const textEl = host.shadowRoot.querySelector(".text");
  const dot = host.shadowRoot.querySelector(".dot");
  const hint = host.shadowRoot.querySelector(".hint");
  const track = host.shadowRoot.querySelector(".track");
  const row = host.shadowRoot.querySelector(".row");

  // Swap the dot animation to a static checkmark-like style.
  if (dot) {
    dot.style.animation = "none";
    dot.style.background = "#137333";
    dot.style.boxShadow = "none";
  }

  // Fill the progress bar fully green.
  if (bar) {
    bar.style.width = "100%";
    bar.style.background = "linear-gradient(90deg, #137333 0%, #14a800 100%)";
  }

  // Label
  if (textEl) textEl.textContent = "Capture complete";
  if (countEl) countEl.textContent = `${count} jobs`;

  // Hide the track (progress bar section) and replace the hint with
  // a small dismiss button and a "Capture This Page" button.
  if (track) track.style.display = "none";
  if (hint) {
    hint.innerHTML = `
      <div style="display:flex;gap:6px;margin-top:6px;">
        <button id="usx-overlay-dismiss" style="cursor:pointer;border:1px solid #ccc;border-radius:4px;padding:3px 10px;background:#fff;font-size:11px;color:#555;">Dismiss</button>
        <button id="usx-overlay-capture-this" style="cursor:pointer;border:1px solid #14a800;border-radius:4px;padding:3px 10px;background:#14a800;font-size:11px;color:#fff;font-weight:600;">Capture This Page</button>
      </div>
    `;

    // Attach click handler to dismiss.
    const btn = hint.querySelector("#usx-overlay-dismiss");
    btn.addEventListener("click", () => hideOverlay(0));

    const captureThisBtn = hint.querySelector("#usx-overlay-capture-this");
    
    // Check if the current URL has already been captured
    const checkUrlCaptured = () => {
      chrome.storage.local.get(["lastCapturedUrl"], (result) => {
        const lastUrl = result.lastCapturedUrl || "";
        if (lastUrl === window.location.href) {
          captureThisBtn.disabled = true;
          captureThisBtn.style.opacity = "0.5";
          captureThisBtn.style.cursor = "not-allowed";
          captureThisBtn.textContent = "Captured";
        } else {
          captureThisBtn.disabled = false;
          captureThisBtn.style.opacity = "1";
          captureThisBtn.style.cursor = "pointer";
          captureThisBtn.textContent = "Capture This Page";
        }
      });
    };
    
    checkUrlCaptured();

    // Listen for URL / history changes on SPA navigation (Upwork pagination is client-side history navigation)
    let lastUrlToCheck = window.location.href;
    const urlObserver = setInterval(() => {
      if (window.location.href !== lastUrlToCheck) {
        lastUrlToCheck = window.location.href;
        checkUrlCaptured();
      }
    }, 500);

    captureThisBtn.addEventListener("click", () => {
      captureThisBtn.disabled = true;
      captureThisBtn.style.opacity = "0.5";
      captureThisBtn.style.cursor = "not-allowed";
      captureThisBtn.textContent = "Capturing...";
      
      // Store current location URL as last captured URL
      chrome.storage.local.set({ lastCapturedUrl: window.location.href }, () => {
        // Send request to background script to trigger capture
        chrome.runtime.sendMessage({ action: "START_CAPTURE" }, (response) => {
          // Once capture finishes, clear the check loop and let the new success overlay rebuild it
          clearInterval(urlObserver);
        });
      });
    });
  }
}

// Sleep helper for the humanize loop.
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function randomHumanizeDelay() {
  return Math.floor(
    HUMANIZE_MIN_DELAY_MS +
      Math.random() * (HUMANIZE_MAX_DELAY_MS - HUMANIZE_MIN_DELAY_MS),
  );
}

// Pick the article nearest the top of the viewport (the one the
// user would be reading right now). Falls back to the first one.
function pickCurrentArticle() {
  const articles = getJobArticles();
  if (articles.length === 0) return null;

  let best = articles[0];
  let bestDist = Math.abs(articles[0].getBoundingClientRect().top);
  for (let i = 1; i < articles.length; i++) {
    const top = articles[i].getBoundingClientRect().top;
    const dist = Math.abs(top);
    if (dist < bestDist) {
      best = articles[i];
      bestDist = dist;
    }
  }
  return best;
}

// Highlight multiple active articles at once (e.g. up to 3 for faster scanning).
// The previous active articles (if any) are faded back to their normal state.
function setActiveArticles(articles) {
  if (!articles || articles.length === 0) return;

  // Clear all previous active styles
  const previous = document.querySelectorAll(
    'article[data-test="JobTile"].usx-active',
  );
  previous.forEach((el) => {
    if (!articles.includes(el)) {
      el.classList.remove("usx-active");
    }
  });

  // Highlight all new active articles
  articles.forEach((article) => {
    article.classList.add("usx-active");
  });
}

// Inject the CSS used for the "active article" highlight. Only one
// article is ever styled at a time; the transition animates the
// colors so it looks interactive as the user scrolls past.
function ensureScrapedStyles() {
  if (document.getElementById("usx-scraped-styles")) return;
  const style = document.createElement("style");
  style.id = "usx-scraped-styles";
  style.textContent = `
    article[data-test="JobTile"] {
      transition:
        background-color 0.85s ease,
        border-color 0.85s ease,
        box-shadow 0.85s ease,
        transform 0.4s ease;
      border: 1px solid transparent;
      border-radius: 16px;
      box-sizing: border-box;
    }
    article[data-test="JobTile"].usx-active {
      border: 1px solid #91aeff !important;
      background: #ebf2ff !important;
      box-shadow: 0 4px 14px rgba(145, 174, 255, 0.35) !important;
      transform: translateY(-2px);
    }
  `;
  document.documentElement.appendChild(style);
}

// Full capture flow: show overlay, walk the page one article at a
// time, then parse all jobs that are now in the DOM and return them.
//
// Visual sequence per article on the page:
//   1. Scroll smoothly so the next article lands ~3rem below the
//      top of the viewport (so it has breathing room from the page
//      header / search filters).
//   2. After the scroll settles, cross-fade the highlight from the
//      previous article to the new one (old fades back, new fades in).
//   3. Long read pause so the user clearly sees the highlighted card
//      before the next scroll.
//
// Only ONE article is ever highlighted at a time so the user's eye
// is clearly drawn to whichever card is "being read" right now.
async function humanizeScrollAndCapture() {
  // Make sure the highlight CSS is present in the page.
  ensureScrapedStyles();
  
  const BATCH_SIZE = 3;

  // Start from the top so the scroll is always top → bottom.
  window.scrollTo({ top: 0, behavior: "auto" });
  await sleep(150);

  showOverlay();

  // Highlight the first batch of articles immediately.
  const allInitial = getJobArticles();
  const initialBatch = allInitial.slice(0, BATCH_SIZE);
  if (initialBatch.length > 0) setActiveArticles(initialBatch);

  let lastCount = initialBatch.length;
  let steps = 0;
  let lastMaxY = 0;
  let reachedBottom = false;
  let currentBatch = initialBatch;

  // Helper: scroll so the first article in the batch lands HUMANIZE_ACTIVE_BREATHING_PX
  // below the top of the viewport. This gives the highlighted batch
  // ~3rem of breathing room above it.
  function scrollToBatchFirst(batch) {
    if (!batch || batch.length === 0) return;
    const firstArticle = batch[0];
    const rect = firstArticle.getBoundingClientRect();
    const targetY = window.scrollY + rect.top - HUMANIZE_ACTIVE_BREATHING_PX;
    window.scrollTo({ top: targetY, behavior: "smooth" });
  }

  try {
    while (steps < HUMANIZE_MAX_STEPS) {
      // Find the next batch of articles (next 3) immediately following the current batch.
      const all = getJobArticles();
      let nextBatch = [];
      if (currentBatch.length > 0) {
        const lastIdx = all.indexOf(currentBatch[currentBatch.length - 1]);
        if (lastIdx >= 0 && lastIdx + 1 < all.length) {
          nextBatch = all.slice(lastIdx + 1, lastIdx + 1 + BATCH_SIZE);
        }
      } else {
        nextBatch = all.slice(0, BATCH_SIZE);
      }

      // If there's no next batch, we're done.
      if (nextBatch.length === 0) break;

      // Scroll so the next batch's first item lands below the top of the viewport
      scrollToBatchFirst(nextBatch);

      // Wait for the smooth scroll to settle.
      await sleep(HUMANIZE_SETTLE_MS);

      // Highlight the next batch (cross-fades the old ones back to normal)
      setActiveArticles(nextBatch);
      currentBatch = nextBatch;
      
      lastCount = Math.max(lastCount, all.length);

      // Update overlay progress + count.
      const maxY = document.documentElement.scrollHeight - window.innerHeight;
      lastMaxY = maxY || lastMaxY;
      const pct =
        lastMaxY > 0
          ? Math.min(99, Math.round((window.scrollY / lastMaxY) * 100))
          : Math.min(95, steps * 12);
      updateOverlay({
        pct,
        count: `${lastCount} jobs seen`,
      });

      // Pause to scan
      await sleep(HUMANIZE_FADE_MS);

      reachedBottom = window.scrollY >= lastMaxY - 2;
      if (reachedBottom) break;

      await sleep(randomHumanizeDelay());
      steps++;
    }

    // Parse jobs
    const jobs = parseVisibleJobs();
    const parsedCount = jobs.length;

    updateOverlay({
      pct: 100,
      count: `${parsedCount} scraped`,
      label: "Capture complete",
    });
    showOverlaySuccess(parsedCount);

    // Clear active highlights
    await sleep(500);
    const finalActive = document.querySelectorAll('article[data-test="JobTile"].usx-active');
    finalActive.forEach(el => el.classList.remove("usx-active"));

    return jobs;
  } catch (e) {
    updateOverlay({
      pct: 100,
      count: "Error",
      label: "Something went wrong",
    });
    const finalActive = document.querySelectorAll('article[data-test="JobTile"].usx-active');
    finalActive.forEach(el => el.classList.remove("usx-active"));
    hideOverlay(1500);
    throw e;
  }
}

function getJobArticles() {
  return Array.from(document.querySelectorAll('article[data-test="JobTile"]'));
}

function parseVisibleJobs() {
  const jobs = [];

  // Select all job tile articles on the page
  const jobArticles = document.querySelectorAll('article[data-test="JobTile"]');
  if (jobArticles.length === 0) {
    console.warn("No job tiles found on page");
    return jobs;
  }

  jobArticles.forEach((article) => {
    // --- Job ID ---
    // Prefer the data-ev-job-uid attribute on the article
    // Also extract from the title link URL as fallback
    let jobId =
      article.getAttribute("data-ev-job-uid") ||
      article.getAttribute("data-test-key");

    // --- Title & URL ---
    // Upwork uses space-separated values in data-test (e.g., "job-tile-title-link UpLink")
    // so we must use ~= (attribute contains word) instead of =
    const titleLink =
      article.querySelector('a[data-test~="job-tile-title-link"]') ||
      article.querySelector('a[data-test~="UpLink"]') ||
      article.querySelector('a[href*="/jobs/"]');
    if (!titleLink) return; // skip if no link found

    const url = titleLink.getAttribute("href");
    if (!url) return;

    const fullUrl = url.startsWith("http")
      ? url
      : `https://www.upwork.com${url}`;

    // If no jobId from attributes, extract from URL
    if (!jobId) {
      const jobIdMatch =
        url.match(/_(~[a-zA-Z0-9]+)/) || url.match(/(~[a-zA-Z0-9]+)/);
      jobId = jobIdMatch ? jobIdMatch[1] : generateHash(fullUrl);
    }

    // Title: get text content, stripping highlight span markup
    const title = titleLink.textContent.trim().replace(/\s+/g, " ");

    // --- Description ---
    let description = "";
    const descClamp =
      article.querySelector(
        '[data-test~="UpCLineClamp"][data-test~="JobDescription"]',
      ) || article.querySelector('[data-test="JobDescription"]');
    if (descClamp) {
      const descP =
        descClamp.querySelector("p.mb-0") || descClamp.querySelector("p");
      if (descP) {
        description = descP.textContent
          .trim()
          .replace(/\s+/g, " ")
          .substring(0, 500);
      }
    }

    // --- Budget / Rate ---
    let budgetType = "unknown";
    let budgetMin = null;
    let budgetMax = null;

    const jobTypeLabel = article.querySelector('[data-test="job-type-label"]');
    if (jobTypeLabel) {
      const budgetText = jobTypeLabel.textContent.trim();

      if (
        budgetText.includes("Fixed-price") ||
        budgetText.startsWith("Budget")
      ) {
        budgetType = "fixed";
        const rangeMatch = budgetText.match(
          /\$(\d+(?:,\d+)*)\s*(?:to|-)\s*\$(\d+(?:,\d+)*)/i,
        );
        const singleMatch = budgetText.match(/\$(\d+(?:,\d+)*)/);

        if (rangeMatch) {
          budgetMin = parseCurrency(rangeMatch[1]);
          budgetMax = parseCurrency(rangeMatch[2]);
        } else if (singleMatch) {
          budgetMin = parseCurrency(singleMatch[1]);
          budgetMax = budgetMin;
        }
      } else if (budgetText.includes("Hourly")) {
        budgetType = "hourly";
        const rateRangeMatch = budgetText.match(
          /\$(\d+(?:\.\d+)?)\s*(?:-|to)\s*\$(\d+(?:\.\d+)?)/,
        );
        const rateSingleMatch = budgetText.match(/\$(\d+(?:\.\d+)?)/);

        if (rateRangeMatch) {
          budgetMin = parseFloat(rateRangeMatch[1]);
          budgetMax = parseFloat(rateRangeMatch[2]);
        } else if (rateSingleMatch) {
          budgetMin = parseFloat(rateSingleMatch[1]);
          budgetMax = budgetMin;
        }
      }
    }

    // --- Payment Verification ---
    let paymentMethodVerified = "unknown";
    const verifiedBadge = article.querySelector(
      '[data-test="UpCVerifiedBadge"]',
    );
    if (verifiedBadge) {
      if (verifiedBadge.classList.contains("is-verified")) {
        paymentMethodVerified = "verified";
      } else if (verifiedBadge.classList.contains("is-unverified")) {
        paymentMethodVerified = "unverified";
      }
    } else {
      // Fallback: check the text in the payment-verified li
      const paymentLi = article.querySelector('[data-test="payment-verified"]');
      if (paymentLi) {
        const paymentText = paymentLi.textContent.trim();
        // Must check "unverified" first to avoid substring match issue
        if (paymentText.includes("unverified")) {
          paymentMethodVerified = "unverified";
        } else if (paymentText.includes("verified")) {
          paymentMethodVerified = "verified";
        }
      }
    }

    // --- Client Country ---
    let clientCountry = "unknown";
    const locationLi = article.querySelector('[data-test="location"]');
    if (locationLi) {
      // Country is inside a span.rr-mask (after the sr-only span)
      const countrySpan = locationLi.querySelector("span.rr-mask");
      if (countrySpan) {
        // The sr-only span contains "Location ", the visible span has the country
        const countryText = countrySpan.textContent.trim();
        // Remove the "Location" prefix if present
        clientCountry = countryText.replace(/^Location\s*/i, "").trim();
      } else {
        // Fallback: get text from the li, remove known prefixes
        const locationText = locationLi.textContent.trim();
        clientCountry = locationText.replace(/^Location\s*/i, "").trim();
      }
    }

    // --- Posted At ---
    let postedAt = "unknown";
    const postedDateEl =
      article.querySelector('[data-test="job-pubilshed-date"]') ||
      article.querySelector('[data-test="job-published-date"]') ||
      article.querySelector("time");
    if (postedDateEl) {
      postedAt =
        postedDateEl.getAttribute("datetime") ||
        postedDateEl.textContent.trim();
    }

    // --- Required Skills ---
    let requiredSkills = "";
    // TokenClamp container uses space-separated data-test values
    let skillTokens = article.querySelectorAll(
      '[data-test~="TokenClamp"][data-test~="JobAttrs"] button[data-test="token"]',
    );
    if (skillTokens.length === 0) {
      // Fallback: try direct token buttons
      skillTokens = article.querySelectorAll('[data-test="token"]');
    }
    if (skillTokens.length > 0) {
      const skills = new Set();
      skillTokens.forEach((token) => {
        const text = token.textContent.trim();
        if (text.length > 2) skills.add(text);
      });
      requiredSkills = Array.from(skills).join(";");
    } else {
      // Fallback: look for skill-related elements
      const skillElements = article.querySelectorAll('[data-test="Skill"]');
      const skills = new Set();
      skillElements.forEach((el) => {
        const text = el.textContent.trim();
        if (text.length > 2) skills.add(text);
      });
      requiredSkills = Array.from(skills).join(";");
    }

    // --- Experience Level ---
    let experienceLevel = "";
    const expLevelLi = article.querySelector('[data-test="experience-level"]');
    if (expLevelLi) {
      experienceLevel = expLevelLi.textContent.trim();
    }

    // --- Proposals ---
    let proposals = "";
    const proposalsLi = article.querySelector('[data-test="proposals-tier"]');
    if (proposalsLi) {
      // Strips "Proposals: " prefix if present in the text content
      proposals = proposalsLi.textContent.replace(/^Proposals:\s*/i, "").trim();
    }

    // --- Total Feedback ---
    let totalFeedback = "";
    const feedbackEl = article.querySelector('[data-test="total-feedback"]');
    if (feedbackEl) {
      // Find rating or text content inside
      const ratingValEl = feedbackEl.querySelector(".air3-rating-value-text");
      if (ratingValEl) {
        totalFeedback = ratingValEl.textContent.trim();
      } else {
        totalFeedback = feedbackEl.textContent.trim();
      }
    }

    // --- Total Spent ---
    let totalSpent = "";
    const spentEl = article.querySelector('[data-test="total-spent"]');
    if (spentEl) {
      // Gets text inside total spent tags (like "$0spent" or similar), format: strip labels
      totalSpent = spentEl.textContent.replace(/spent/i, "").trim();
    }

    jobs.push({
      job_id: jobId,
      source: "upwork_visible_page",
      source_url: fullUrl,
      title: title,
      description: description,
      budget_type: budgetType,
      budget_min: budgetMin,
      budget_max: budgetMax,
      payment_method_verified: paymentMethodVerified,
      client_country: clientCountry,
      posted_at: postedAt,
      required_skills: requiredSkills,
      experience_level: experienceLevel,
      proposals: proposals,
      total_feedback: totalFeedback,
      total_spent: totalSpent,
      fit_score: "",
      captured_by: "",
      manual_notes: "",
    });
  });

  return jobs;
}

function parseCurrency(str) {
  return parseFloat(str.replace(/,/g, ""));
}

function generateHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return "hash_" + Math.abs(hash).toString(16);
}
