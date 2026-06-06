/**
 * Unit tests for content.js (parseVisibleJobs logic)
 * Run: node test-content.js
 */

// --- Helper functions from content.js ---

function parseCurrency(str) {
  return parseFloat(str.replace(/,/g, ''));
}

function generateHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return 'hash_' + Math.abs(hash).toString(16);
}

const fixedRangeRegex = /\$(\d+(?:,\d+)*)\s*(?:to|-)\s*\$(\d+(?:,\d+)*)/i;
const fixedSingleRegex = /\$(\d+(?:,\d+)*)/;
const hourlyRangeRegex = /\$(\d+(?:\.\d+)?)\s*(?:-|to)\s*\$(\d+(?:\.\d+)?)\s*\/hr/i;
const hourlySingleRegex = /\$(\d+(?:\.\d+)?)\s*\/hr/i;

function detectBudget(budgetText) {
  let budgetType = 'unknown';
  let budgetMin = null;
  let budgetMax = null;

  if (budgetText.includes('Fixed-price')) {
    budgetType = 'fixed';
    const rangeMatch = budgetText.match(fixedRangeRegex);
    const singleMatch = budgetText.match(fixedSingleRegex);
    if (rangeMatch) {
      budgetMin = parseCurrency(rangeMatch[1]);
      budgetMax = parseCurrency(rangeMatch[2]);
    } else if (singleMatch) {
      budgetMin = parseCurrency(singleMatch[1]);
      budgetMax = budgetMin;
    }
  } else if (budgetText.includes('Hourly')) {
    budgetType = 'hourly';
    const rateRangeMatch = budgetText.match(hourlyRangeRegex);
    const rateSingleMatch = budgetText.match(hourlySingleRegex);
    if (rateRangeMatch) {
      budgetMin = parseFloat(rateRangeMatch[1]);
      budgetMax = parseFloat(rateRangeMatch[2]);
    } else if (rateSingleMatch) {
      budgetMin = parseFloat(rateSingleMatch[1]);
      budgetMax = budgetMin;
    }
  }
  return { budgetType, budgetMin, budgetMax };
}

function detectPayment(cardText) {
  if (cardText.includes('Payment verified')) return 'verified';
  if (cardText.includes('Payment unverified')) return 'unverified';
  return 'unknown';
}

// --- Test framework ---
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

// --- Test 1: parseCurrency ---
console.log('\n=== Test: parseCurrency ===');
assert(parseCurrency('500') === 500, 'parseCurrency("500") === 500');
assert(parseCurrency('1,500') === 1500, 'parseCurrency("1,500") === 1500');
assert(parseCurrency('1,500,000') === 1500000, 'parseCurrency("1,500,000") === 1500000');
assert(parseCurrency('0') === 0, 'parseCurrency("0") === 0');
assert(isNaN(parseCurrency('')), 'parseCurrency("") is NaN');

// --- Test 2: generateHash ---
console.log('\n=== Test: generateHash ===');
const h1 = generateHash('https://www.upwork.com/jobs/~0123456789abcdef01');
assert(h1.startsWith('hash_'), 'generateHash returns hash_ prefix');
assert(h1.length > 5, 'generateHash returns non-trivial hash');
assert(generateHash('abc') !== generateHash('def'), 'Different strings produce different hashes');
assert(generateHash('abc') === generateHash('abc'), 'Same string produces same hash (deterministic)');

// --- Test 3: Job ID extraction regex ---
console.log('\n=== Test: Job ID extraction ===');
const jobIdRegex = /(~[a-zA-Z0-9]+)/;
assert(jobIdRegex.exec('/jobs/~0123456789abcdef01')[1] === '~0123456789abcdef01', 'Extracts job ID from /jobs/~0123456789abcdef01');
assert(jobIdRegex.exec('/jobs/~abcDEF123')[1] === '~abcDEF123', 'Extracts alphanumeric job ID');
assert(jobIdRegex.exec('/other/path') === null, 'Returns null for non-job URL');

// --- Test 4: Fixed budget regex ---
console.log('\n=== Test: Fixed budget regex ===');
let m = 'Fixed-price $500 - $1,500'.match(fixedRangeRegex);
assert(m !== null && m[1] === '500' && m[2] === '1,500', 'Fixed range: $500 - $1,500');

m = 'Fixed-price $1,000 to $5,000'.match(fixedRangeRegex);
assert(m !== null && m[1] === '1,000' && m[2] === '5,000', 'Fixed range: $1,000 to $5,000');

m = 'Fixed-price $250'.match(fixedRangeRegex);
assert(m === null, 'Fixed single: no range match for $250');
m = 'Fixed-price $250'.match(fixedSingleRegex);
assert(m !== null && m[1] === '250', 'Fixed single: $250');

// --- Test 5: Hourly rate regex ---
console.log('\n=== Test: Hourly rate regex ===');
m = '$15.00 - $25.00/hr'.match(hourlyRangeRegex);
assert(m !== null && m[1] === '15.00' && m[2] === '25.00', 'Hourly range: $15.00 - $25.00/hr');

m = '$15/hr'.match(hourlySingleRegex);
assert(m !== null && m[1] === '15', 'Hourly single: $15/hr');

m = '$15.50/hr'.match(hourlySingleRegex);
assert(m !== null && m[1] === '15.50', 'Hourly single with decimal: $15.50/hr');

m = '$10 - $20/hr'.match(hourlyRangeRegex);
assert(m !== null && m[1] === '10' && m[2] === '20', 'Hourly range without decimals: $10 - $20/hr');

// --- Test 6: Budget detection logic edge cases ---
console.log('\n=== Test: Budget detection logic ===');

let budget = detectBudget('Fixed-price $500 - $1,500');
assert(budget.budgetType === 'fixed' && budget.budgetMin === 500 && budget.budgetMax === 1500, 'Fixed $500-$1500');

budget = detectBudget('Hourly: $15.00-$25.00/hr');
assert(budget.budgetType === 'hourly' && budget.budgetMin === 15 && budget.budgetMax === 25, 'Hourly $15-$25/hr');

budget = detectBudget('Some random text without budget info');
assert(budget.budgetType === 'unknown' && budget.budgetMin === null, 'Unknown budget type');

budget = detectBudget('Fixed-price $50');
assert(budget.budgetMin === 50 && budget.budgetMax === 50, 'Fixed single $50 sets min=max');

budget = detectBudget('Hourly: $10/hr');
assert(budget.budgetMin === 10 && budget.budgetMax === 10, 'Hourly single $10/hr sets min=max');

// --- Test 7: Payment verification detection ---
console.log('\n=== Test: Payment verification detection ===');
assert(detectPayment('Payment verified') === 'verified', 'Payment verified detected');
assert(detectPayment('Payment unverified') === 'unverified', 'Payment unverified detected');
assert(detectPayment('No payment info') === 'unknown', 'Payment unknown when not present');

// --- Test 8: URL construction ---
console.log('\n=== Test: URL construction ===');
const url = '/jobs/~0123456789abcdef01';
const fullUrl = `https://www.upwork.com${url}`;
assert(fullUrl === 'https://www.upwork.com/jobs/~0123456789abcdef01', 'Full URL constructed correctly');

// --- Summary ---
console.log(`\n${'='.repeat(50)}`);
console.log(`RESULTS: ${passed} passed, ${failed} failed`);
console.log(`${'='.repeat(50)}`);
process.exit(failed > 0 ? 1 : 0);