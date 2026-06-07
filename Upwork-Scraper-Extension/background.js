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
    return true;
  }

  if (message.action === "EXPORT_CSV") {
    handleExportCsv(message.filter);
    sendResponse({ success: true });
  }

  if (message.action === "RESET_ALL_DATA") {
    handleResetData();
    sendResponse({ success: true });
  }

  if (message.action === "DELETE_REJECTED") {
    handleDeleteRejected()
      .then((removedCount) => sendResponse({ success: true, removedCount }))
      .catch((err) => {
        console.error("Delete rejected failed:", err);
        sendResponse({ success: false, error: err.message });
      });
    return true;
  }
});

async function getActiveTabId(sender) {
  if (sender.tab && sender.tab.id) {
    return sender.tab.id;
  }
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tabs || tabs.length === 0) {
    throw new Error("No active tab found");
  }
  return tabs[0].id;
}

async function handleCapture(tabId) {
  try {
    try {
      await chrome.tabs.sendMessage(tabId, { action: "PING" });
    } catch (e) {
      console.log("Content script not found, injecting...");
      await chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ["content.js"],
      });
      await new Promise((r) => setTimeout(r, 100));
    }

    const response = await chrome.tabs.sendMessage(tabId, {
      action: "HUMANIZE_AND_CAPTURE",
    });

    if (!response || !response.jobs || response.jobs.length === 0) {
      updateStats({ lastCaptureCount: 0 });
      notifyPopup("CAPTURE_COMPLETE", { addedCount: 0 });
      return;
    }

    const storageData = await chrome.storage.local.get(["filters", "jobs"]);
    const filters = storageData.filters || {
      fixedMin: 500,
      hourlyMin: 15,
      paymentVerified: true,
    };
    const existingJobs = storageData.jobs || [];
    const existingJobIds = new Set(existingJobs.map((j) => j.job_id));

    const now = new Date().toISOString();
    const newJobs = [];
    let addedCount = 0;

    for (const job of response.jobs) {
      if (existingJobIds.has(job.job_id)) {
        continue;
      }

      const riskFlags = [];
      let recommendedAction = "review";

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

      if (
        filters.paymentVerified &&
        job.payment_method_verified === "unverified"
      ) {
        riskFlags.push("payment_unverified");
        recommendedAction = "reject";
      } else if (job.payment_method_verified === "unknown") {
        recommendedAction = "review";
      }

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

    const updatedJobs = [...existingJobs, ...newJobs];
    await chrome.storage.local.set({ jobs: updatedJobs });

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

async function handleExportCsv(filter) {
  try {
    const storageData = await chrome.storage.local.get(["jobs"]);
    const allJobs = storageData.jobs || [];

    if (allJobs.length === 0) {
      console.warn("No jobs to export.");
      notifyPopup("EXPORT_COMPLETE", { stats: {}, empty: true });
      return;
    }

    let jobs;
    let filename;
    if (filter === "review") {
      jobs = allJobs.filter(
        (j) => (j.recommended_action || "review") === "review",
      );
      const ts = new Date().toISOString().replace(/:/g, "-");
      filename = `scraped-jobs-review-${ts}.csv`;
    } else {
      jobs = allJobs;
      const ts2 = new Date().toISOString().replace(/:/g, "-");
      filename = `scraped-jobs-list-${ts2}.csv`;
    }

    if (jobs.length === 0) {
      console.warn("No jobs match the requested filter:", filter);
      notifyPopup("EXPORT_COMPLETE", { stats: {}, empty: true });
      return;
    }

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
      "experience_level",
      "proposals",
      "total_feedback",
      "total_spent",
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

    // In Manifest V3 service workers, Blob and URL.createObjectURL
    // don't exist. Use a data URL instead.
    const dataUrl =
      "data:text/csv;charset=utf-8," + encodeURIComponent(csvContent);

    await chrome.downloads.download({
      url: dataUrl,
      filename: filename,
      saveAs: true,
    });

    const stats = { lastExportTime: new Date().toISOString() };
    await updateStats(stats);
    notifyPopup("EXPORT_COMPLETE", {
      stats,
      filter,
      exportedCount: jobs.length,
    });
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

async function handleDeleteRejected() {
  try {
    const storageData = await chrome.storage.local.get(["jobs"]);
    const allJobs = storageData.jobs || [];
    const kept = allJobs.filter(
      (j) => (j.recommended_action || "review") !== "reject",
    );
    const removedCount = allJobs.length - kept.length;

    await chrome.storage.local.set({ jobs: kept });

    const stats = { totalSavedJobs: kept.length };
    await updateStats(stats);

    notifyPopup("REJECTED_DELETED", {
      removedCount,
      remaining: kept.length,
      stats,
    });

    return removedCount;
  } catch (error) {
    console.error("Error deleting rejected jobs:", error);
    throw error;
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
