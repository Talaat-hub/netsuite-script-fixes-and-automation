# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [1.4.0] - 2026-08-18

### Fixed
- Added the missing `N/log` import across every scheduled script, user event script,
  Suitelet, and Map/Reduce script that logged inside a `catch` block — those catches
  would previously throw a `ReferenceError` instead of logging the real error
- `mr_batch_invoice.js` and `ss_daily_reports.js` now actually call `email.send()`
  instead of only logging what the email would have contained
- `mr_inventory_sync.js` now creates a sync tracking record when one doesn't exist yet
  (previously only handled the update case) and advances its own incremental-sync
  watermark at the end of each run
- `so_sl_exchange_rate.js` now calls the live exchange-rate API as the primary path,
  falling back to a small cached rate table only if the API call fails
- Added the missing `client-scripts/so_cs_exchange_rate.js` companion script — the
  "Fetch from API" and "Cancel" buttons on the exchange rate popup had no client script
  behind them
- `so_sl_print.js` and `po_sl_print.js` no longer route already-substituted template
  strings through `render.create()`/`renderAsString()` a second time before
  `xmlToPdf()` — that extra pass was unnecessary and could misfire on field values
  containing literal `${...}` text
- Fixed the Postman collection: all 15 RESTlet requests had an extra `/customer`,
  `/inventory`, or `/order` path segment that doesn't belong in a NetSuite RESTlet URL

### Changed
- `escapeXml`/`formatCurrency` from `libraries/lib_utils.js` are now actually imported
  and used by the Suitelets and Map/Reduce script that previously carried their own
  duplicate copies, instead of the shared library being documented but unused
- Removed unused module imports across several RESTlets, Suitelets, and scheduled
  scripts
- `custscript_min_order_amount`, `custscript_emp_code_prefix`, and
  `custscript_batch_notify_sender`/`custscript_report_sender` are now script parameters
  instead of hardcoded values — see `docs/DEPLOYMENT.md` for the full parameter list
- Documented the handful of buttons (PO approve/reject/receive, employee QR code) that
  call companion Suitelets not included in this repo, so they read as clearly-marked
  examples of the calling pattern rather than silently broken links — see
  `docs/DEPLOYMENT.md` "Known Limitations"

## [1.3.0] - 2026-03-25

### Added
- RESTlet APIs for external system integration
  - Customer API (CRUD operations)
  - Inventory API (real-time stock levels, bulk queries)
  - Order API (e-commerce order creation)
- Postman collection with complete API documentation
- Postman environment template for quick setup
- Token-Based Authentication examples

### Changed
- Updated deployment guide with RESTlet configuration
- Added API integration to README examples

## [1.2.0] - 2026-03-15

### Added
- Customer statement Suitelet with date range picker
- Employee QR code generation for ID cards
- Inventory sync Map/Reduce script

### Changed
- Improved PDF template styling for all printouts
- Enhanced error handling in batch invoice process
- Optimized search queries in daily reports

### Fixed
- Exchange rate popup window sizing issue
- Employee code generation duplicate check

## [1.1.0] - 2026-02-01

### Added
- Email reminder scheduler for invoices, quotes, and tasks
- Daily reports with sales, inventory, and AR aging
- Purchase Order approval workflow

### Changed
- Refactored utility functions into shared library
- Updated governance checks in Map/Reduce scripts

### Fixed
- PO print Suitelet header alignment
- Employee years of service calculation

## [1.0.0] - 2026-01-10

### Added
- Sales Order validation and button injection
- Sales Order PDF printout with custom template
- Exchange rate integration Suitelet
- Purchase Order print Suitelet
- Employee HRMS user event
- Employee ID card and profile printing
- Batch invoice Map/Reduce script
- Shared utility library (lib_utils.js)
