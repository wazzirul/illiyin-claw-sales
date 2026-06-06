// background.js

// Listen for messages from popup or content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "START_CAPTURE") {
    getActiveTabId(sender)
      .then((tabId) => handleCapture(tabId))
      .then(() => sendResponse({ success: true }))
      .catch((err) => {
        console.error("Capture failed:", err);
        sendResponse({ success: false, error: err.message });
      });
    return true; // Keep message channel open for async response
  }

  if (message.action === "EXPORT_CSV") {
    handleExportCsv();
    sendResponse({ success: true });
  }

  if (message.action === "RESET_ALL_DATA") {
    handleResetData();
    sendResponse({ success: true });
  }
});

async function getActiveTabId(sender) {
  // When message comes from a content script, sender.tab is available
  if (sender.tab && sender.tab.id) {
    return sender.tab.id;
  }
  // When message comes from popup, sender.tab is undefined,
  // so we query for the active tab in the current window
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tabs || tabs.length === 0) {
    throw new Error("No active tab found");
  }
  return tabs[0].id;
}

async function handleCapture(tabId) {
  try {
    // Ensure content script is injected (it may not be if extension was reloaded while page was open)
    try {
      await chrome.tabs.sendMessage(tabId, { action: "PING" });
    } catch (e) {
      // Content script not injected yet, inject it now
      console.log("Content script not found, injecting...");
      await chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ["content.js"],
      });
      // Give it a moment to initialize
      await new Promise((r) => setTimeout(r, 100));
    }

    // 1. Ask content script to parse visible jobs
    const response = await chrome.tabs.sendMessage(tabId, {
      action: "CAPTURE_VISIBLE_JOBS",
    });

    if (!response || !response.jobs || response.jobs.length === 0) {
      updateStats({ lastCaptureCount: 0 });
      notifyPopup("CAPTURE_COMPLETE", { addedCount: 0 });
      return;
    }

    // 2. Get current filters
    const storageData = await chrome.storage.local.get(["filters", "jobs"]);
    const filters = storageData.filters || {
      fixedMin: 500,
      hourlyMin: 15,
      paymentVerified: true,
    };
    const existingJobs = storageData.jobs || [];
    const existingJobIds = new Set(existingJobs.map((j) => j.job_id));

    // 3. Process and filter new jobs
    const now = new Date().toISOString();
    const newJobs = [];
    let addedCount = 0;

    for (const job of response.jobs) {
      // Deduplication
      if (existingJobIds.has(job.job_id)) {
        continue;
      }

      // Apply default business filters
      const riskFlags = [];
      let recommendedAction = "review";

      // Budget checks
      if (job.budget_type === "fixed" && job.budget_min < filters.fixedMin) {
        riskFlags.push("low_budget");
        recommendedAction = "reject";
      } else if (
        job.budget_type === "hourly" &&
        job.budget_min < filters.hourlyMin
      ) {
        riskFlags.push("low_budget");
        recommendedAction = "reject";
      }

      // Payment verification check
      if (
        filters.paymentVerified &&
        job.payment_method_verified === "unverified"
      ) {
        riskFlags.push("payment_unverified");
        recommendedAction = "reject";
      } else if (job.payment_method_verified === "unknown") {
        recommendedAction = "review";
      }

      // Finalize job object
      const processedJob = {
        ...job,
        risk_flags: riskFlags.join(";"),
        recommended_action: recommendedAction,
        captured_at: now,
      };

      newJobs.push(processedJob);
      existingJobIds.add(job.job_id);
      addedCount++;
    }

    // 4. Save to storage
    const updatedJobs = [...existingJobs, ...newJobs];
    await chrome.storage.local.set({ jobs: updatedJobs });

    // 5. Update stats and notify popup
    const stats = {
      lastCaptureCount: addedCount,
      totalSavedJobs: updatedJobs.length,
    };
    await updateStats(stats);
    notifyPopup("CAPTURE_COMPLETE", { addedCount, stats });
  } catch (error) {
    console.error("Error during capture:", error);
    notifyPopup("CAPTURE_COMPLETE", { addedCount: 0, error: error.message });
  }
}

async function handleExportCsv() {
  try {
    const storageData = await chrome.storage.local.get(["jobs"]);
    const jobs = storageData.jobs || [];

    if (jobs.length === 0) {
      alert("No jobs to export.");
      return;
    }

    // Confirm before export
    // Note: We can't use window.confirm in background script easily,
    // so we rely on the popup to show a confirmation or just proceed if triggered from popup.
    // For simplicity, we'll proceed, but the plan mentions a confirmation.
    // We'll add a note in the CSV or handle it via popup message if needed.

    const headers = [
      "job_id",
      "source",
      "source_url",
      "title",
      "description",
      "budget_type",
      "budget_min",
      "budget_max",
      "payment_method_verified",
      "client_country",
      "posted_at",
      "required_skills",
      "fit_score",
      "risk_flags",
      "recommended_action",
      "captured_at",
      "captured_by",
      "manual_notes",
    ];

    const csvRows = [headers.join(",")];
    for (const job of jobs) {
      const row = headers.map((header) => {
        let value = job[header] ?? "";
        // Escape quotes and wrap in quotes if contains comma or newline
        if (
          typeof value === "string" &&
          (value.includes(",") || value.includes('"') || value.includes("\n"))
        ) {
          value = '"' + value.replace(/"/g, '""') + '"';
        }
        return value;
      });
      csvRows.push(row.join(","));
    }

    const csvContent = csvRows.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const filename = `scraped-jobs-list-${new Date().toISOString().slice(0, 10)}.csv`;

    await chrome.downloads.download({
      url: url,
      filename: filename,
      saveAs: true,
    });

    const stats = { lastExportTime: new Date().toISOString() };
    await updateStats(stats);
    notifyPopup("EXPORT_COMPLETE", { stats });
  } catch (error) {
    console.error("Error exporting CSV:", error);
  }
}

async function handleResetData() {
  try {
    await chrome.storage.local.set({ jobs: [] });
    const stats = {
      totalSavedJobs: 0,
      lastResetTime: new Date().toISOString(),
      lastCaptureCount: 0,
    };
    await updateStats(stats);
    notifyPopup("RESET_COMPLETE", { stats });
  } catch (error) {
    console.error("Error resetting data:", error);
  }
}

async function updateStats(newStats) {
  const currentStats = (await chrome.storage.local.get("stats")).stats || {};
  const updatedStats = { ...currentStats, ...newStats };
  await chrome.storage.local.set({ stats: updatedStats });
}

function notifyPopup(action, payload) {
  chrome.runtime.sendMessage({ action, ...payload }).catch(() => {
    // Popup might be closed, which is fine.
  });
}
