# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

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
