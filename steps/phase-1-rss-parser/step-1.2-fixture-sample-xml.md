# Step 1.2 — Sample RSS Fixture

## Goal
Create a deterministic Vollna RSS XML fixture for parser tests.

## File
- `tests/fixtures/vollna-sample.xml`

## Requirements
Include 3 items:
1. Fixed price `1,500 USD`, payment verified, should pass.
2. Fixed price `300 USD`, payment verified, should fail budget.
3. Hourly `$15.00-$30.00/hr`, payment unknown/verified, should pass.

Each item must include:
- title
- CDATA description with `Skills:` and `Categories:` lines
- pubDate
- link with double-encoded Upwork URL in `url=` query
- category tags

Use fake job IDs like `~022065586128771017469`.

## Verification
File exists and tests can read it.
