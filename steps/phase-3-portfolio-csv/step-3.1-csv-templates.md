# Step 3.1 — CSV Templates

## Goal
Create empty/sample CSV data files that PM/Sales will fill.

## Files
- `data/portfolio.csv`
- `data/upwork-work-done.csv`
- `tests/fixtures/portfolio.sample.csv`
- `tests/fixtures/upwork-work-done.sample.csv`

## portfolio.csv header + 3 sample rows
```csv
id,title,service_category,industry,skills,tools,summary,case_study_url,image_url,client_name,year,team_role,proof_strength,notes
PF-001,"SaaS CRM Dashboard UI/UX","UI/UX Design","SaaS","dashboard;crm;saas;figma;design system","Figma;FigJam","Designed CRM dashboard with role-based analytics, pipeline tracking, and responsive layouts.","https://example.com/case-study/crm","","Confidential SaaS Client",2025,"UI/UX design;design system","high","Good for SaaS dashboard, admin panel, CRM"
PF-002,"E-commerce Mobile App Redesign","Mobile App Design","E-commerce","mobile app;checkout;ux audit;figma;prototype","Figma;Maze","Redesigned mobile shopping flow.","https://example.com/case-study/ecom","","Retail Client",2024,"UX audit;UI redesign","medium","Good for e-commerce, mobile app"
PF-003,"AI Automation Dashboard","AI Automation","Agency","automation;api;dashboard;node.js;notion;telegram","Node.js;Notion API;Telegram","Built automation dashboard.","","","Internal",2026,"automation;backend","high","Good for automation, API, dashboard"
```

## upwork-work-done.csv header + 3 sample rows
```csv
id,upwork_contract_title,client_industry,service_category,skills,job_summary,result_summary,budget_or_earning,client_feedback,upwork_profile_url,portfolio_url,completed_date,permission_to_mention,notes
UW-001,"Figma SaaS Dashboard","SaaS","UI/UX Design","figma;dashboard;saas;design system","Subscription analytics dashboard.","Delivered prototype and reusable components.","$2,400","Great communication.","https://www.upwork.com/freelancers/example","","2025-11-10","yes","Good for SaaS, dashboard"
UW-002,"Agency Workflow Automation","Agency","AI Automation","node.js;api;automation;notion;telegram","Notion+Telegram automation.","Saved hours every week.","$1,200","Saved us hours.","https://www.upwork.com/freelancers/example","","2026-02-14","yes","Strong for automation/API"
UW-003,"Landing Page UX","Marketing","Web Design","landing page;figma;webflow;conversion","Conversion-focused funnel.","Improved messaging and layout.","$850","Fast turnaround.","https://www.upwork.com/freelancers/example","","2025-08-22","no","Do not mention client"
```

## Notes
- Sample CSV for tests should be in tests/fixtures/
- Real CSV in data/ will be filled by PM/Sales.
