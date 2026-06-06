// test-parser.js
// Static fixture test as per Section 9 of the plan

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

// Read the fixture file
const fixturePath = path.join(__dirname, 'fixtures', 'upwork-search-result.html');
const htmlContent = fs.readFileSync(fixturePath, 'utf-8');

// Mock chrome.runtime for testing
global.chrome = {
  runtime: {
    onMessage: {
      addListener: () => {}
    }
  }
};

// Load the DOM
const dom = new JSDOM(htmlContent);
global.document = dom.window.document;
global.window = dom.window;

// Import the parser function by reading and evaluating content.js
const contentJsPath = path.join(__dirname, 'content.js');
const contentJsSource = fs.readFileSync(contentJsPath, 'utf-8');

// Extract the parseVisibleJobs function and generateHash function
const parseVisibleJobsMatch = contentJsSource.match(/function parseVisibleJobs\(\)[\s\S]*?^}/m);
const generateHashMatch = contentJsSource.match(/function generateHash\([^)]*\)[\s\S]*?^}/m);
const parseCurrencyMatch = contentJsSource.match(/function parseCurrency\([^)]*\)[\s\S]*?^}/m);

if (!parseVisibleJobsMatch) {
  console.error('Could not extract parseVisibleJobs function');
  process.exit(1);
}

// Execute the functions
eval(parseCurrencyMatch[0]);
eval(generateHashMatch[0]);
eval(parseVisibleJobsMatch[0]);

// Run the test
console.log('Running static fixture test...');
const jobs = parseVisibleJobs();

console.log(`Found ${jobs.length} job(s) in the fixture.`);

if (jobs.length > 0) {
  console.log('\nSample parsed job:');
  console.log(JSON.stringify(jobs[0], null, 2));
  console.log('\n✅ Parser successfully extracted jobs from the fixture.');
} else {
  console.log('\n⚠️ No jobs found in the fixture. The DOM structure may have changed or the parser needs adjustment.');
}

// Verify schema compliance
const requiredFields = ['job_id', 'source', 'source_url', 'title', 'description', 'budget_type', 'budget_min', 'budget_max', 'payment_method_verified', 'client_country', 'posted_at', 'required_skills', 'fit_score', 'captured_by', 'manual_notes'];

if (jobs.length > 0) {
  const sampleJob = jobs[0];
  const missingFields = requiredFields.filter(field => !(field in sampleJob));
  if (missingFields.length > 0) {
    console.log(`\n⚠️ Missing fields in parsed job: ${missingFields.join(', ')}`);
  } else {
    console.log('\n✅ All required fields are present in the parsed job.');
  }
}