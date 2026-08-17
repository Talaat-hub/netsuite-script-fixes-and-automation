# NetSuite Script Fixes & Automation

Real NetSuite SuiteScript solutions focused on fixing issues, automating workflows, and improving system behavior.

---

## About

This repository is a collection of production-style SuiteScript 2.1 customizations built around common NetSuite pain points: manual pricing and exchange-rate lookups on Sales Orders, unenforced Purchase Order approval chains, one-by-one invoice creation, ad hoc employee ID cards, unfollowed overdue invoices, statement generation limited to month-end, and manual order entry from e-commerce platforms. Each example pairs a User Event, Client Script, Suitelet, Map/Reduce, or Scheduled Script with a short write-up of the problem it solves, and a shared utility library (`libraries/lib_utils.js`) is used across the Suitelets and Map/Reduce script to avoid duplicating formatting and validation logic. A RESTlet API layer with a full Postman collection is included for scripts that need to expose NetSuite data to external systems.

---

## What This Covers

- Fixing broken or partially working SuiteScript
- Automating manual, repetitive processes
- Debugging and improving existing scripts
- Building integrations between NetSuite and external systems via REST APIs

---

## Example Work

### 1. Sales Order Automation

**Problem:** Sales team manually calculating margins, looking up exchange rates, and creating invoices one by one. Errors in pricing, outdated rates, hours wasted.

**Solution:** Built User Event + Client Script + Suitelet combination that:
- Auto-calculates margins when line items are entered
- Fetches live exchange rates from an external API with one click, falling back to a cached rate table if the API is unavailable
- Custom PDF printouts matching company branding

**Result:** Eliminated pricing errors, current exchange rates always available, professional documents.

**Files:** `user-event-scripts/so_ue_validation_buttons.js`, `client-scripts/so_cs_buttons.js`, `client-scripts/so_cs_exchange_rate.js`, `suitelets/so_sl_*.js`

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
- Emails a summary with success/error counts when the run completes

**Result:** Hours of work done in minutes, nothing missed, clear reporting.

**Files:** `map-reduce/mr_batch_invoice.js`

---

### 4. Employee ID Card System

**Problem:** No standard employee ID cards, manual employee code assignment causing duplicates, no document tracking.

**Solution:** Built HRMS automation with:
- Auto-generated, configurable-prefix employee codes
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

### 7. E-commerce & EDI Integration APIs

**Problem:** Orders from Shopify/WooCommerce entered manually. Inventory levels out of sync causing oversells. Customer data not flowing between systems.

**Solution:** Built RESTlet API layer for external integrations:
- Customer API: create, read, update, deactivate customers
- Inventory API: real-time stock levels, bulk availability checks
- Order API: automated order creation from e-commerce webhooks

**Result:** Zero manual order entry, real-time inventory sync, single customer record across all systems.

**Files:** `restlets/rl_customer_api.js`, `restlets/rl_inventory_api.js`, `restlets/rl_order_api.js`

**Testing:** Postman collection included in the `postman/` folder.

---

## Tools & Technologies

- NetSuite SuiteScript 2.1 (modern ES6+ syntax)
- JavaScript
- RESTlet APIs with Token-Based Authentication
- Postman for API testing and documentation
- N/render for PDF generation

---

## What This Demonstrates

- Ability to read, debug, and extend existing code quickly
- Solutions tied to specific business problems, not just code for its own sake
- Clean, documented, maintainable script structure
- Coverage across the full SuiteScript surface: User Events, Client Scripts, Suitelets, Map/Reduce, Scheduled Scripts, and RESTlets
- External system integration with proper authentication

---

## Availability

Open to:
- Quick fixes and bug repairs
- Small automation projects
- API integrations (Shopify, WooCommerce, custom systems)
- Part-time, ongoing NetSuite support
- Urgent issues with fast turnaround

---

## Documentation

- [Deployment Guide](docs/DEPLOYMENT.md) — how to install and configure scripts, including known limitations
- [API Reference](docs/API.md) — shared utility library documentation
- [Postman Collection](postman/README.md) — RESTlet API testing guide

---

## Testing

There is no automated test suite in this repository — validating changes means deploying
to a Sandbox account and exercising the scripts directly. The closest thing to a test
harness is the [Postman collection](postman/) for the three RESTlets: import it,
configure the environment variables listed in `postman/README.md`, and run the requests
against a Sandbox account to confirm the Customer/Inventory/Order APIs behave as
documented. For a repository with an actual Jest unit-test setup for SuiteScript, see
[SuiteScript-Usability-and-Documentations](https://github.com/Talaat-hub/SuiteScript-Usability-and-Documentations).

---

## Author

[Mahmoud Talaat](https://www.linkedin.com/in/mahmoudtalaat21/) — NetSuite / SuiteScript Developer

Feel free to connect or reach out with questions about any of the patterns used here.
