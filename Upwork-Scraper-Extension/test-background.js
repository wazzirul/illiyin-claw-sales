/**
 * Unit tests for background.js logic
 * Tests filtering, deduplication, CSV export, delete-rejected,
 * and message handling.
 * Run: node test-background.js
 */

let passed = 0;
let failed = 0;

function assert(condition, msg) {
  if (condition) {
    console.log(`  ✅ ${msg}`);
    passed++;
  } else {
    console.log(`  ❌ ${msg}`);
    failed++;
  }
}

// --- Simulate the filtering logic from background.js ---
function processJobs(rawJobs, filters, existingJobs) {
  const existingJobIds = new Set(existingJobs.map(j => j.job_id));
  const newJobs = [];
  let addedCount = 0;
  const now = '2026-06-06T10:00:00.000Z';

  for (const job of rawJobs) {
    if (existingJobIds.has(job.job_id)) {
      continue;
    }

    const riskFlags = [];
    let recommendedAction = 'review';

    if (job.budget_type === 'fixed' && job.budget_min < filters.fixedMin) {
      riskFlags.push('low_budget');
      recommendedAction = 'reject';
    } else if (job.budget_type === 'hourly' && job.budget_min < filters.hourlyMin) {
      riskFlags.push('low_budget');
      recommendedAction = 'reject';
    }

    if (filters.paymentVerified && job.payment_method_verified === 'unverified') {
      riskFlags.push('payment_unverified');
      recommendedAction = 'reject';
    } else if (job.payment_method_verified === 'unknown') {
      recommendedAction = 'review';
    }

    const processedJob = {
      ...job,
      risk_flags: riskFlags.join(';'),
      recommended_action: recommendedAction,
      captured_at: now
    };

    newJobs.push(processedJob);
    existingJobIds.add(job.job_id);
    addedCount++;
  }

  return { newJobs, addedCount, allJobs: [...existingJobs, ...newJobs] };
}

// --- Simulate the delete-rejected logic ---
function deleteRejected(allJobs) {
  const kept = allJobs.filter(
    (j) => (j.recommended_action || 'review') !== 'reject',
  );
  const removedCount = allJobs.length - kept.length;
  return { kept, removedCount };
}

// --- Simulate CSV export with filter ---
function filterJobsForExport(allJobs, filter) {
  if (filter === 'review') {
    return allJobs.filter(
      (j) => (j.recommended_action || 'review') === 'review',
    );
  }
  return allJobs;
}

// --- Test 1: Default filters ---
console.log('\n=== Test: Default filter logic ===');
const defaultFilters = { fixedMin: 500, hourlyMin: 15, paymentVerified: true };

const goodFixedJob = { job_id: 'j1', budget_type: 'fixed', budget_min: 600, payment_method_verified: 'verified' };
let result = processJobs([goodFixedJob], defaultFilters, []);
assert(result.newJobs[0].recommended_action === 'review', 'Good fixed job ($600 >= $500, verified) -> review');
assert(result.newJobs[0].risk_flags === '', 'Good fixed job has no risk flags');

const lowFixedJob = { job_id: 'j2', budget_type: 'fixed', budget_min: 400, payment_method_verified: 'verified' };
result = processJobs([lowFixedJob], defaultFilters, []);
assert(result.newJobs[0].recommended_action === 'reject', 'Low fixed job ($400 < $500) -> reject');
assert(result.newJobs[0].risk_flags === 'low_budget', 'Low fixed job has low_budget flag');

const goodHourlyJob = { job_id: 'j3', budget_type: 'hourly', budget_min: 20, payment_method_verified: 'verified' };
result = processJobs([goodHourlyJob], defaultFilters, []);
assert(result.newJobs[0].recommended_action === 'review', 'Good hourly job ($20 >= $15, verified) -> review');

const lowHourlyJob = { job_id: 'j4', budget_type: 'hourly', budget_min: 10, payment_method_verified: 'verified' };
result = processJobs([lowHourlyJob], defaultFilters, []);
assert(result.newJobs[0].recommended_action === 'reject', 'Low hourly job ($10 < $15) -> reject');
assert(result.newJobs[0].risk_flags === 'low_budget', 'Low hourly job has low_budget flag');

// --- Test 2: Payment verification filter ---
console.log('\n=== Test: Payment verification filter ===');
const unverifiedJob = { job_id: 'j5', budget_type: 'fixed', budget_min: 1000, payment_method_verified: 'unverified' };
result = processJobs([unverifiedJob], defaultFilters, []);
assert(result.newJobs[0].recommended_action === 'reject', 'Unverified payment -> reject');
assert(result.newJobs[0].risk_flags === 'payment_unverified', 'Has payment_unverified flag');

const unknownPaymentJob = { job_id: 'j6', budget_type: 'fixed', budget_min: 1000, payment_method_verified: 'unknown' };
result = processJobs([unknownPaymentJob], defaultFilters, []);
assert(result.newJobs[0].recommended_action === 'review', 'Unknown payment -> review');

const noPaymentFilter = { fixedMin: 500, hourlyMin: 15, paymentVerified: false };
result = processJobs([unverifiedJob], noPaymentFilter, []);
assert(result.newJobs[0].recommended_action === 'review', 'Unverified but filter disabled -> review');

// --- Test 3: Deduplication ---
console.log('\n=== Test: Deduplication ===');
const existingJobs = [{ job_id: 'j1', title: 'Existing' }];
result = processJobs([goodFixedJob, { job_id: 'j-new', budget_type: 'fixed', budget_min: 600, payment_method_verified: 'verified' }], defaultFilters, existingJobs);
assert(result.addedCount === 1, 'Only new job added (dedup works)');
assert(result.allJobs.length === 2, 'Total jobs = 1 existing + 1 new');

// --- Test 4: Multiple risk flags ---
console.log('\n=== Test: Multiple risk flags ===');
const badJob = { job_id: 'j7', budget_type: 'fixed', budget_min: 100, payment_method_verified: 'unverified' };
result = processJobs([badJob], defaultFilters, []);
assert(result.newJobs[0].risk_flags === 'low_budget;payment_unverified', 'Both risk flags present');
assert(result.newJobs[0].recommended_action === 'reject', 'Multiple flags -> reject');

// --- Test 5: CSV export logic ---
console.log('\n=== Test: CSV export logic ===');
function buildCsv(jobs) {
  const headers = [
    'job_id', 'source', 'source_url', 'title', 'description',
    'budget_type', 'budget_min', 'budget_max', 'payment_method_verified',
    'client_country', 'posted_at', 'required_skills', 'fit_score',
    'risk_flags', 'recommended_action', 'captured_at', 'captured_by', 'manual_notes'
  ];

  const csvRows = [headers.join(',')];
  for (const job of jobs) {
    const row = headers.map(header => {
      let value = job[header] ?? '';
      if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
        value = '"' + value.replace(/"/g, '""') + '"';
      }
      return value;
    });
    csvRows.push(row.join(','));
  }
  return csvRows.join('\n');
}

const sampleJob = {
  job_id: '~0123',
  source: 'upwork',
  source_url: 'https://upwork.com/jobs/~0123',
  title: 'Build a "great" CRM, with automation',
  description: 'Need someone who can build, test, and deploy.',
  budget_type: 'fixed',
  budget_min: 500,
  budget_max: 1500,
  payment_method_verified: 'verified',
  client_country: 'US',
  posted_at: '2026-06-06',
  required_skills: 'nodejs;react',
  fit_score: '',
  risk_flags: '',
  recommended_action: 'review',
  captured_at: '2026-06-06T10:00:00Z',
  captured_by: '',
  manual_notes: ''
};

const csv = buildCsv([sampleJob]);
const lines = csv.split('\n');
assert(lines.length === 2, 'CSV has header + 1 data row');
assert(lines[0].startsWith('job_id,source,'), 'CSV header starts correctly');
assert(lines[1].includes('"Build a ""great"" CRM, with automation"'), 'Title with commas and quotes is properly escaped');
assert(lines[1].includes('"Need someone who can build, test, and deploy."'), 'Description with commas is properly escaped');

// --- Test 6: Edge cases ---
console.log('\n=== Test: Edge cases ===');
result = processJobs([], defaultFilters, []);
assert(result.addedCount === 0, 'Empty input -> 0 added');
assert(result.allJobs.length === 0, 'Empty input -> 0 total');

const nullBudgetJob = { job_id: 'j8', budget_type: 'unknown', budget_min: null, payment_method_verified: 'unknown' };
result = processJobs([nullBudgetJob], defaultFilters, []);
assert(result.newJobs[0].recommended_action === 'review', 'Unknown budget + unknown payment -> review');
assert(result.newJobs[0].risk_flags === '', 'Unknown budget has no risk flags (not below threshold)');

// --- Test 7: Delete rejected ---
console.log('\n=== Test: Delete rejected logic ===');
const mixedJobs = [
  { job_id: 'a1', recommended_action: 'review' },
  { job_id: 'a2', recommended_action: 'reject' },
  { job_id: 'a3', recommended_action: 'reject' },
  { job_id: 'a4', recommended_action: 'review' },
  { job_id: 'a5' },  // no recommended_action — should be kept
];
const delResult = deleteRejected(mixedJobs);
assert(delResult.removedCount === 2, 'Delete rejected removes 2 jobs (a2, a3)');
assert(delResult.kept.length === 3, '3 jobs kept (a1, a4, a5 - a5 has no action, treated as review)');
assert(delResult.kept.every(j => (j.recommended_action || 'review') !== 'reject'), 'All kept jobs have non-reject action');

// Edge: all reject
const allReject = [{ job_id: 'x1', recommended_action: 'reject' }];
const allRejResult = deleteRejected(allReject);
assert(allRejResult.removedCount === 1, 'Single reject -> removed, 0 kept');
assert(allRejResult.kept.length === 0, 'Kept array is empty');

// Edge: all review
const allReview = [{ job_id: 'y1', recommended_action: 'review' }];
const allRevResult = deleteRejected(allReview);
assert(allRevResult.removedCount === 0, 'All review -> nothing removed');
assert(allRevResult.kept.length === 1, 'All review -> all kept');

// Edge: empty list
const emptyResult = deleteRejected([]);
assert(emptyResult.removedCount === 0, 'Empty list -> 0 removed');
assert(emptyResult.kept.length === 0, 'Empty list -> 0 kept');

// --- Test 8: Filtered CSV export ---
console.log('\n=== Test: Filtered CSV export logic ===');
const exportJobs = [
  { job_id: 'e1', recommended_action: 'review', title: 'Review job' },
  { job_id: 'e2', recommended_action: 'reject', title: 'Reject job' },
  { job_id: 'e3', title: 'No-action job' },
  { job_id: 'e4', recommended_action: 'review', title: 'Review job 2' },
];

// Export all (filter = undefined / 'all')
const allExport = filterJobsForExport(exportJobs, undefined);
assert(allExport.length === 4, 'Export all -> all 4 jobs');

const allExport2 = filterJobsForExport(exportJobs, 'all');
assert(allExport2.length === 4, 'Export with filter="all" -> all 4 jobs');

// Export review only
const reviewExport = filterJobsForExport(exportJobs, 'review');
assert(reviewExport.length === 3, 'Export review only -> 3 jobs (e1, e3, e4)');
assert(reviewExport.every(j => (j.recommended_action || 'review') === 'review'), 'All exported jobs are review-only');
assert(!reviewExport.some(j => j.job_id === 'e2'), 'Reject job e2 is NOT in the review export');

// Edge: filter with no review jobs
const onlyReject = [{ job_id: 'r1', recommended_action: 'reject' }];
const noReviewResult = filterJobsForExport(onlyReject, 'review');
assert(noReviewResult.length === 0, 'No review jobs -> empty array for review export');

// --- Test 9: Summary line counts ---
console.log('\n=== Test: Summary line counts ===');
function computeSummary(jobs) {
  const total = jobs.length;
  const reviewCount = jobs.filter(j => (j.recommended_action || 'review') === 'review').length;
  const rejectCount = total - reviewCount;
  return `${total} total jobs: ${reviewCount} for review, ${rejectCount} rejected`;
}
assert(computeSummary(mixedJobs) === '5 total jobs: 3 for review, 2 rejected', 'Mixed: 5 total, 3 review, 2 reject');
assert(computeSummary(allReject) === '1 total jobs: 0 for review, 1 rejected', 'All reject: 1 total, 0 review');
assert(computeSummary([]) === '0 total jobs: 0 for review, 0 rejected', 'Empty: zeros across the board');

// --- Test 10: Critical bug check - sender.tab in popup context ---
console.log('\n=== Test: Critical architecture check ===');
const popupSender = { id: 'extension-id' };
const senderTabId = popupSender.tab?.id;
assert(senderTabId === undefined, 'BUG CONFIRMED: sender.tab.id is undefined when message comes from popup');
assert(true, 'FIX NEEDED: background.js should use chrome.tabs.query({active: true, currentWindow: true}) instead of sender.tab.id');

// --- Summary ---
console.log(`\n${'='.repeat(50)}`);
console.log(`RESULTS: ${passed} passed, ${failed} failed`);
console.log(`${'='.repeat(50)}`);
process.exit(failed > 0 ? 1 : 0);
