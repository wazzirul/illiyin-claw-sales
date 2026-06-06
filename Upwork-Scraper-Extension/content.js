// content.js

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
  }
});

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
      proposals = proposalsLi.textContent.trim();
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
