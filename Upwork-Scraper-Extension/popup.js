document.addEventListener("DOMContentLoaded", () => {
  const tabStatus = document.getElementById("tab-status");
  const captureBtn = document.getElementById("captureBtn");
  const captureThisPageBtn = document.getElementById("captureThisPageBtn");
  const resultsBtn = document.getElementById("resultsBtn");
  const exportBtn = document.getElementById("exportBtn");
  const resetBtn = document.getElementById("resetBtn");
  const saveFiltersBtn = document.getElementById("saveFilters");
  const filterSaveStatus = document.getElementById("filterSaveStatus");

  const fixedMinInput = document.getElementById("fixedMin");
  const hourlyMinInput = document.getElementById("hourlyMin");
  const paymentVerifiedInput = document.getElementById("paymentVerified");

  const lastCaptureCount = document.getElementById("lastCaptureCount");
  const totalSavedJobs = document.getElementById("totalSavedJobs");
  const lastExportTime = document.getElementById("lastExportTime");
  const lastResetTime = document.getElementById("lastResetTime");

  // Load settings, stats, and last captured URL state
  chrome.storage.local.get(["filters", "stats", "lastCapturedUrl"], (result) => {
    if (result.filters) {
      fixedMinInput.value = result.filters.fixedMin ?? 500;
      hourlyMinInput.value = result.filters.hourlyMin ?? 15;
      paymentVerifiedInput.checked = result.filters.paymentVerified ?? true;
    }
    updateStats(result.stats);
    
    // Check if the current URL matches the last captured URL to determine the visibility and state of buttons
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (tab && tab.url && tab.url.startsWith("https://www.upwork.com/nx/search/jobs/")) {
        tabStatus.textContent = "Supported Page";
        tabStatus.classList.remove("unsupported");
        tabStatus.classList.add("supported");
        
        const lastUrl = result.lastCapturedUrl || "";
        if (lastUrl === tab.url) {
          // If URL matches last captured URL, show "Capture This Page" but disable it
          captureBtn.style.display = "none";
          captureThisPageBtn.style.display = "block";
          captureThisPageBtn.disabled = true;
          captureThisPageBtn.textContent = "Capture This Page (Captured)";
        } else {
          // If URL changed (e.g. user navigated / pagination), show "Capture This Page" active
          captureBtn.style.display = "none";
          captureThisPageBtn.style.display = "block";
          captureThisPageBtn.disabled = false;
          captureThisPageBtn.textContent = "Capture This Page";
        }
      } else {
        tabStatus.textContent = "Unsupported Page";
        tabStatus.classList.remove("supported");
        tabStatus.classList.add("unsupported");
        captureBtn.style.display = "block";
        captureBtn.disabled = true;
        captureThisPageBtn.style.display = "none";
      }
    });
  });

  // Re-check current tab periodically or when popup is loaded
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    if (
      tab &&
      tab.url &&
      tab.url.startsWith("https://www.upwork.com/nx/search/jobs/")
    ) {
      tabStatus.textContent = "Supported Page";
      tabStatus.classList.remove("unsupported");
      tabStatus.classList.add("supported");
    } else {
      tabStatus.textContent = "Unsupported Page";
      tabStatus.classList.remove("supported");
      tabStatus.classList.add("unsupported");
    }
  });

  // Save Filters
  saveFiltersBtn.addEventListener("click", () => {
    const filters = {
      fixedMin: parseInt(fixedMinInput.value, 10) || 500,
      hourlyMin: parseInt(hourlyMinInput.value, 10) || 15,
      paymentVerified: paymentVerifiedInput.checked,
    };
    chrome.storage.local.set({ filters }, () => {
      filterSaveStatus.textContent = "Filters saved!";
      setTimeout(() => {
        filterSaveStatus.textContent = "";
      }, 2000);
    });
  });

  // Capture Current Page
  captureBtn.addEventListener("click", () => {
    captureBtn.disabled = true;
    captureBtn.textContent = "Capturing...";
    chrome.runtime.sendMessage({ action: "START_CAPTURE" }, (response) => {
      if (chrome.runtime.lastError) {
        captureBtn.textContent = "Capture Current Page";
        captureBtn.disabled = false;
        alert("Capture failed: " + chrome.runtime.lastError.message);
      }
    });
  });

  // Capture This Page
  captureThisPageBtn.addEventListener("click", () => {
    captureThisPageBtn.disabled = true;
    captureThisPageBtn.textContent = "Capturing...";
    
    // Store current tab URL as last captured URL once capture starts/completes
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (tab && tab.url) {
        chrome.storage.local.set({ lastCapturedUrl: tab.url });
      }
    });

    chrome.runtime.sendMessage({ action: "START_CAPTURE" }, (response) => {
      if (chrome.runtime.lastError) {
        captureThisPageBtn.textContent = "Capture This Page";
        captureThisPageBtn.disabled = false;
        alert("Capture failed: " + chrome.runtime.lastError.message);
      }
    });
  });

  // Open Results
  resultsBtn.addEventListener("click", () => {
    chrome.tabs.create({ url: chrome.runtime.getURL("result.html") });
  });

  // Export CSV
  exportBtn.addEventListener("click", () => {
    chrome.runtime.sendMessage({ action: "EXPORT_CSV" });
  });

  // Reset All Data
  resetBtn.addEventListener("click", () => {
    if (
      confirm(
        "Are you sure you want to reset all captured data? This cannot be undone.",
      )
    ) {
      chrome.runtime.sendMessage({ action: "RESET_ALL_DATA" });
    }
  });

  // Listen for messages from background
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "CAPTURE_COMPLETE") {
      captureBtn.textContent = "Capture Current Page";
      
      // Update the "Capture This Page" button state based on the current URL
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tab = tabs[0];
        if (tab && tab.url && tab.url.startsWith("https://www.upwork.com/nx/search/jobs/")) {
          chrome.storage.local.get(["lastCapturedUrl"], (result) => {
            const lastUrl = result.lastCapturedUrl || "";
            if (lastUrl === tab.url) {
              captureThisPageBtn.disabled = true;
              captureThisPageBtn.textContent = "Capture This Page (Captured)";
            } else {
              captureThisPageBtn.disabled = false;
              captureThisPageBtn.textContent = "Capture This Page";
            }
          });
        }
      });

      if (message.stats) {
        updateStats(message.stats);
      }
      // Show error details when capture fails
      if (message.error) {
        alert(`Capture failed: ${message.error}`);
      } else {
        alert(`Capture complete! Added ${message.addedCount} new jobs.`);
      }
    } else if (message.action === "EXPORT_COMPLETE") {
      if (message.stats) {
        updateStats(message.stats);
      }
    } else if (message.action === "RESET_COMPLETE") {
      if (message.stats) {
        updateStats(message.stats);
      }
    }
  });

  function updateStats(stats) {
    if (!stats) return;
    lastCaptureCount.textContent = stats.lastCaptureCount ?? 0;
    totalSavedJobs.textContent = stats.totalSavedJobs ?? 0;
    lastExportTime.textContent = stats.lastExportTime
      ? new Date(stats.lastExportTime).toLocaleString()
      : "Never";
    lastResetTime.textContent = stats.lastResetTime
      ? new Date(stats.lastResetTime).toLocaleString()
      : "Never";
  }
});
