# NetSuite Script Fixes & Automation

Real NetSuite SuiteScript solutions focused on fixing issues, automating workflows, and improving system behavior.

---

## 🔧 What I Do

I help businesses:

- **Fix broken or partially working SuiteScript** — Debug and repair scripts that aren't working correctly
- **Automate manual processes** — Turn repetitive tasks into automated workflows
- **Debug and improve existing scripts** — Find and fix logic issues, improve performance
- **Build integrations** — Connect NetSuite to external systems via REST APIs

---

## 📁 Example Work

### 1. Sales Order Automation

**Problem:** Sales team manually calculating margins, looking up exchange rates, and creating invoices one by one. Errors in pricing, outdated rates, hours wasted.

**Solution:** Built User Event + Client Script + Suitelet combination that:
- Auto-calculates margins when line items are entered
- Fetches live exchange rates from external API with one click
- Custom PDF printouts matching company branding

**Result:** Eliminated pricing errors, current exchange rates always available, professional documents.

**Files:** `user-event-scripts/so_ue_validation_buttons.js`, `client-scripts/so_cs_buttons.js`, `suitelets/so_sl_*.js`

---

### 2. Purchase Order Approval Workflow

**Problem:** POs going through without proper approval. Budget overruns discovered too late. No audit trail of who approved what.

**Solution:** Built approval workflow with:
- Approve/Reject buttons based on user role
- Automatic budget validation before approval
- Vendor status checking
- Email notifications on status changes

**Result:** Enforced approval chain, no more budget surprises, full audit history.

**Files:** `user-event-scripts/po_ue_approval.js`, `client-scripts/po_cs_buttons.js`

---

### 3. Batch Invoice Generation

**Problem:** Finance team creating invoices one-by-one from Sales Orders. Takes hours, orders get missed, no visibility into progress.

**Solution:** Built Map/Reduce script that:
- Finds all pending Sales Orders marked for invoicing
- Transforms each to Invoice automatically
- Sends email summary with success/error counts

**Result:** Hours of work done in minutes, nothing missed, clear reporting.

**Files:** `map-reduce/mr_batch_invoice.js`

---

### 4. Employee ID Card System

**Problem:** No standard employee ID cards, manual employee code assignment causing duplicates, no document tracking.

**Solution:** Built HRMS automation with:
- Auto-generated unique employee codes
- One-click ID card PDF printing
- Document serial number tracking

**Result:** Professional ID cards, no duplicate codes, complete document trail.

**Files:** `user-event-scripts/emp_ue_hrms.js`, `suitelets/emp_sl_print.js`

---

### 5. Automated Payment Reminders

**Problem:** Overdue invoices not followed up. Quotes expiring without sales rep knowing. Collections suffering.

**Solution:** Built Scheduled Script that:
- Sends payment reminders X days before invoice due date
- Alerts sales reps when quotes are about to expire
- Reminds assignees of upcoming task deadlines

**Result:** Proactive follow-up, better collections, fewer missed opportunities.

**Files:** `scheduled-scripts/ss_email_reminders.js`

---

### 6. Customer Statement Generator

**Problem:** Standard NetSuite statements only for month-end. Customers asking for custom date ranges. No running balance shown.

**Solution:** Built Suitelet with:
- Date picker for custom start/end dates
- Running balance calculation per transaction
- Professional PDF with company branding

**Result:** Any date range on demand, clear balance history, professional appearance.

**Files:** `suitelets/cust_sl_statement.js`

---

## 🧰 Tools & Technologies

- **NetSuite SuiteScript 2.1** — Modern ES6+ syntax
- **JavaScript** — Clean, maintainable code
- **REST APIs** — External system integration
- **PDF Generation** — N/render for professional documents

---

## 🎯 What This Shows

- **Fast debugging** — Can understand and fix existing code quickly
- **Business focus** — Solutions tied to real problems, not just code
- **Clean code** — Well-documented, maintainable, follows best practices
- **Full stack** — User Events, Client Scripts, Suitelets, Map/Reduce, Scheduled

---

## 📌 Availability

Available for:
- Quick fixes and bug repairs
- Small automation tasks
- Part-time ongoing NetSuite support
- Urgent issues with fast turnaround

---

## 📂 Documentation

- [Deployment Guide](docs/DEPLOYMENT.md) — How to install and configure scripts
- [API Reference](docs/API.md) — Utility library documentation