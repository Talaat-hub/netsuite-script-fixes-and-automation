# NetSuite SuiteScript Customizations

Custom SuiteScript 2.1 implementations for NetSuite ERP system.

## Overview

This repository contains production SuiteScript customizations organized by functional area:

- **Transaction Processing** - Sales Orders, Purchase Orders
- **HRMS** - Employee management, ID cards, document tracking
- **Customer Management** - Statements, account management
- **Batch Operations** - Invoice generation, inventory sync
- **Scheduled Jobs** - Reports, notifications, maintenance

## Repository Structure

```
├── SalesOrder/
│   ├── UserEvent/so_ue_validation_buttons.js
│   ├── ClientScript/so_cs_buttons.js
│   └── Suitelet/
│       ├── so_sl_print.js
│       └── so_sl_exchange_rate.js
│
├── PurchaseOrder/
│   ├── UserEvent/po_ue_approval.js
│   ├── ClientScript/po_cs_buttons.js
│   └── Suitelet/po_sl_print.js
│
├── Employee/
│   ├── UserEvent/emp_ue_hrms.js
│   ├── ClientScript/emp_cs_buttons.js
│   └── Suitelet/emp_sl_print.js
│
├── Customer/
│   └── Suitelet/cust_sl_statement.js
│
├── BatchProcessing/
│   └── MapReduce/
│       ├── mr_batch_invoice.js
│       └── mr_inventory_sync.js
│
├── Scheduled/
│   ├── ss_daily_reports.js
│   └── ss_email_reminders.js
│
└── Libraries/
    └── lib_utils.js
```

## Requirements

- NetSuite Account with SuiteScript 2.1 support
- SuiteCloud Development Framework (optional, for local development)
- Appropriate role permissions for script deployment

## Installation

1. Clone the repository
2. Upload scripts to File Cabinet under `SuiteScripts/`
3. Create Script records and deployments as documented in `docs/DEPLOYMENT.md`
4. Configure script parameters per environment

## Script Naming Convention

| Component | Format | Example |
|-----------|--------|---------|
| File | `{module}_{type}_{function}.js` | `so_ue_validation_buttons.js` |
| Script ID | `customscript_{module}_{type}_{function}` | `customscript_so_ue_validation` |
| Deployment | `customdeploy_{module}_{type}_{function}` | `customdeploy_so_ue_validation` |

## Configuration

### Script Parameters

Each script requiring configuration uses script parameters. See individual script headers for required parameters:

- `ss_daily_reports.js` - Report type, recipient list
- `ss_email_reminders.js` - Reminder type, days before due, sender ID
- `mr_batch_invoice.js` - Notification email
- `mr_inventory_sync.js` - Last sync date

### Custom Records

Some scripts depend on custom records:
- `customrecord_employee_documents` - Employee document tracking
- `customrecord_location_sync` - Inventory sync status

### Custom Fields

Required custom fields on standard records:
- `custbody_batch_process` (Transaction) - Flag for batch processing
- `custbody_invoice_created` (Sales Order) - Invoice creation status
- `custentity_employee_code` (Employee) - Auto-generated employee ID
- `custentity_years_of_service` (Employee) - Calculated tenure

## Development

### Local Setup

```bash
# Install SuiteCloud CLI
npm install -g @oracle/suitecloud-cli

# Initialize project
suitecloud project:create -i

# Deploy to sandbox
suitecloud file:upload --paths "/SuiteScripts/**"
```

### Testing

- Test in Sandbox environment before production deployment
- Use Script Debugger for troubleshooting
- Check Execution Log for runtime errors

## Contributing

1. Create feature branch from `main`
2. Follow existing code style and naming conventions
3. Test thoroughly in sandbox
4. Submit pull request with description of changes

## License

Proprietary - Internal use only