// result.js

document.addEventListener('DOMContentLoaded', () => {
  const jobsTableBody = document.getElementById('jobsTableBody');
  const emptyState = document.getElementById('emptyState');
  const searchInput = document.getElementById('searchInput');
  const actionFilter = document.getElementById('actionFilter');
  const exportAllBtn = document.getElementById('exportAllBtn');
  const exportReviewBtn = document.getElementById('exportReviewBtn');
  const deleteRejectedBtn = document.getElementById('deleteRejectedBtn');
  const resetBtn = document.getElementById('resetBtn');
  const backToUpworkBtn = document.getElementById('backToUpworkBtn');
  const summaryLine = document.getElementById('summaryLine');

  let allJobs = [];

  // Load jobs on startup
  loadJobs();

  // Event listeners
  searchInput.addEventListener('input', renderJobs);
  actionFilter.addEventListener('change', renderJobs);

  exportAllBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'EXPORT_CSV' });
  });

  exportReviewBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'EXPORT_CSV', filter: 'review' });
  });

  deleteRejectedBtn.addEventListener('click', () => {
    if (confirm('Delete all rejected jobs? This will permanently remove every job marked as "Reject" from local storage.')) {
      chrome.runtime.sendMessage({ action: 'DELETE_REJECTED' }, (response) => {
        if (response && response.success) {
          alert('Deleted ' + (response.removedCount || 0) + ' rejected job(s).');
          loadJobs();
        }
      });
    }
  });

  resetBtn.addEventListener('click', () => {
    if (confirm('Are you sure you want to reset all captured data? This cannot be undone.')) {
      chrome.runtime.sendMessage({ action: 'RESET_ALL_DATA' }, () => {
        loadJobs();
      });
    }
  });

  backToUpworkBtn.addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://www.upwork.com/nx/search/jobs/' });
  });

  // Listen for messages from background
  chrome.runtime.onMessage.addListener((message) => {
    if (
      message.action === 'RESET_COMPLETE' ||
      message.action === 'EXPORT_COMPLETE' ||
      message.action === 'REJECTED_DELETED'
    ) {
      loadJobs();
    }
  });

  function loadJobs() {
    chrome.storage.local.get(['jobs'], (result) => {
      allJobs = result.jobs || [];
      renderJobs();
    });
  }

  function renderJobs() {
    const searchTerm = searchInput.value.toLowerCase();
    const selectedAction = actionFilter.value;

    const filteredJobs = allJobs.filter(job => {
      // Action filter
      if (selectedAction !== 'all' && job.recommended_action !== selectedAction) {
        return false;
      }

      // Search filter
      if (searchTerm) {
        const searchableText = `${job.title} ${job.required_skills} ${job.client_country} ${job.description}`.toLowerCase();
        if (!searchableText.includes(searchTerm)) {
          return false;
        }
      }

      return true;
    });

    // --- Summary line ---
    const total = allJobs.length;
    const reviewCount = allJobs.filter(j => (j.recommended_action || 'review') === 'review').length;
    const rejectCount = total - reviewCount;
    if (summaryLine) {
      summaryLine.textContent = `${total} total jobs: ${reviewCount} for review, ${rejectCount} rejected`;
    }

    // --- Table body ---
    jobsTableBody.innerHTML = '';

    // Update button states: disable delete-rejected if no rejects remain
    if (deleteRejectedBtn) {
      deleteRejectedBtn.disabled = rejectCount === 0;
    }

    if (filteredJobs.length === 0) {
      emptyState.style.display = 'block';
      return;
    }

    emptyState.style.display = 'none';

    filteredJobs.forEach((job, index) => {
      const row = document.createElement('tr');
      
      // Format budget display
      let budgetDisplay = 'Unknown';
      if (job.budget_type === 'fixed' && job.budget_min !== null) {
        budgetDisplay = job.budget_max && job.budget_max !== job.budget_min 
          ? `$${job.budget_min.toLocaleString()} - $${job.budget_max.toLocaleString()} (Fixed)`
          : `$${job.budget_min.toLocaleString()} (Fixed)`;
      } else if (job.budget_type === 'hourly' && job.budget_min !== null) {
        budgetDisplay = job.budget_max && job.budget_max !== job.budget_min
          ? `$${job.budget_min}/hr - $${job.budget_max}/hr (Hourly)`
          : `$${job.budget_min}/hr (Hourly)`;
      }

      // Format payment status
      const paymentClass = job.payment_method_verified === 'verified' ? 'verified' : 
                           job.payment_method_verified === 'unverified' ? 'unverified' : 'unknown';
      const paymentText = job.payment_method_verified === 'unknown' ? 'Unknown' : 
                          job.payment_method_verified.charAt(0).toUpperCase() + job.payment_method_verified.slice(1);

      // Format risk flags
      const riskFlagsHtml = job.risk_flags 
        ? job.risk_flags.split(';').map(flag => `<span class="risk-flag">${flag.replace(/_/g, ' ')}</span>`).join('')
        : '<span style="color:#999;">None</span>';

      // Format action badge
      const actionClass = job.recommended_action || 'review';
      const actionText = (job.recommended_action || 'review').charAt(0).toUpperCase() + (job.recommended_action || 'review').slice(1);

      // Format captured at
      const capturedAt = job.captured_at ? new Date(job.captured_at).toLocaleString() : 'Unknown';

      row.innerHTML = `
        <td>
          <a href="${job.source_url}" target="_blank" title="${job.title}">${job.title || 'Untitled'}</a>
        </td>
        <td>${budgetDisplay}</td>
        <td class="${paymentClass}">${paymentText}</td>
        <td>${job.client_country || 'Unknown'}</td>
        <td>${job.total_feedback || 'No feedback yet'}</td>
        <td>${job.total_spent || '$0'}</td>
        <td>${job.proposals || 'None'}</td>
        <td>${riskFlagsHtml}</td>
        <td><span class="action-badge ${actionClass}">${actionText}</span></td>
        <td>${capturedAt}</td>
        <td>
          <button class="action-btn copy-json" data-index="${index}">Copy JSON</button>
          <button class="action-btn delete" data-job-id="${job.job_id}">Delete</button>
        </td>
      `;

      jobsTableBody.appendChild(row);
    });

    // Attach event listeners to new buttons
    document.querySelectorAll('.copy-json').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const index = parseInt(e.target.dataset.index, 10);
        const job = filteredJobs[index];
        navigator.clipboard.writeText(JSON.stringify(job, null, 2))
          .then(() => {
            const originalText = e.target.textContent;
            e.target.textContent = 'Copied!';
            setTimeout(() => { e.target.textContent = originalText; }, 1500);
          });
      });
    });

    document.querySelectorAll('.delete').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const jobId = e.target.dataset.jobId;
        if (confirm('Delete this job from local storage?')) {
          deleteJob(jobId);
        }
      });
    });
  }

  function deleteJob(jobId) {
    allJobs = allJobs.filter(job => job.job_id !== jobId);
    chrome.storage.local.set({ jobs: allJobs }, () => {
      renderJobs();
    });
  }
});
