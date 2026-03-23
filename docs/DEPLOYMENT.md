# Deployment Guide

## Script Deployment Checklist

### Pre-Deployment

- [ ] Code reviewed and approved
- [ ] Tested in Sandbox environment
- [ ] Script parameters configured
- [ ] Custom records/fields created
- [ ] Role permissions verified

### Deployment Steps

#### 1. Upload Scripts

Upload all script files to File Cabinet:
```
SuiteScripts/
├── SalesOrder/
├── PurchaseOrder/
├── Employee/
├── Customer/
├── BatchProcessing/
├── Scheduled/
└── Libraries/
```

#### 2. Create Script Records

**User Event Scripts**

| Script | Record Type | Deployed To |
|--------|-------------|-------------|
| so_ue_validation_buttons | UserEvent | Sales Order |
| po_ue_approval | UserEvent | Purchase Order |
| emp_ue_hrms | UserEvent | Employee |

**Client Scripts**

| Script | Record Type | Deployed To |
|--------|-------------|-------------|
| so_cs_buttons | ClientScript | Sales Order |
| po_cs_buttons | ClientScript | Purchase Order |
| emp_cs_buttons | ClientScript | Employee |

**Suitelets**

| Script | Script ID | Deployment ID |
|--------|-----------|---------------|
| so_sl_print | customscript_so_sl_print | customdeploy_so_sl_print |
| so_sl_exchange_rate | customscript_so_sl_exchange_rate | customdeploy_so_sl_exchange_rate |
| po_sl_print | customscript_po_sl_print | customdeploy_po_sl_print |
| emp_sl_print | customscript_emp_sl_print | customdeploy_emp_sl_print |
| cust_sl_statement | customscript_cust_sl_statement | customdeploy_cust_sl_statement |

**Map/Reduce Scripts**

| Script | Schedule | Concurrency |
|--------|----------|-------------|
| mr_batch_invoice | On demand / Scheduled | Single |
| mr_inventory_sync | Daily 2:00 AM | Single |

**Scheduled Scripts**

| Script | Schedule | Parameters |
|--------|----------|------------|
| ss_daily_reports | Daily 6:00 AM | custscript_report_type, custscript_report_recipients |
| ss_email_reminders | Daily 8:00 AM | custscript_reminder_type, custscript_days_before, custscript_sender_employee |

#### 3. Configure Parameters

**ss_daily_reports.js**
- `custscript_report_type`: 'all', 'sales', 'inventory', or 'ar'
- `custscript_report_recipients`: Comma-separated employee IDs

**ss_email_reminders.js**
- `custscript_reminder_type`: 'invoice', 'quote', or 'task'
- `custscript_days_before`: Number of days before due date
- `custscript_sender_employee`: Employee ID for email sender

**mr_batch_invoice.js**
- `custscript_batch_notify_email`: Email address for completion notifications

**mr_inventory_sync.js**
- `custscript_last_sync_date`: Date of last successful sync

### Post-Deployment

- [ ] Verify script execution in Execution Log
- [ ] Test all button functions
- [ ] Confirm PDF generation
- [ ] Validate scheduled job execution
- [ ] Monitor for errors in first 24 hours

---

## Custom Record Setup

### Employee Documents (customrecord_employee_documents)

| Field ID | Type | Description |
|----------|------|-------------|
| custrecord_doc_employee | List/Record (Employee) | Related employee |
| custrecord_doc_type | Text | Document type |
| custrecord_doc_date | Date | Issue date |

### Location Sync (customrecord_location_sync)

| Field ID | Type | Description |
|----------|------|-------------|
| custrecord_sync_location | List/Record (Location) | Location reference |
| custrecord_sync_item_count | Integer | Items synced |
| custrecord_sync_total_available | Currency | Total available qty |
| custrecord_sync_date | Date/Time | Last sync timestamp |

---

## Custom Field Setup

### Transaction Body Fields

| Field ID | Type | Applies To | Description |
|----------|------|------------|-------------|
| custbody_batch_process | Checkbox | Sales Order | Enable batch processing |
| custbody_invoice_created | Checkbox | Sales Order | Invoice generated flag |
| custbody_batch_created | Checkbox | Invoice | Created via batch |
| custbody_source_so | List/Record | Invoice | Source Sales Order |
| custbody_reminder_sent | Checkbox | Invoice | Payment reminder sent |
| custbody_last_modified_date | Date/Time | All | Last modification timestamp |

### Entity Fields (Employee)

| Field ID | Type | Description |
|----------|------|-------------|
| custentity_employee_code | Text | Auto-generated employee ID |
| custentity_years_of_service | Decimal | Calculated years of service |
| custentity_last_modified_date | Date/Time | Last modification timestamp |

---

## Rollback Procedure

If issues occur after deployment:

1. Set script deployment status to "Testing" (disables execution)
2. Investigate errors in Execution Log
3. Fix and re-deploy to Sandbox
4. Test thoroughly
5. Re-deploy to Production
6. Set deployment status back to "Released"

---

## Environment Configuration

### Sandbox
- Use for all development and testing
- Script deployments set to "Testing" by default
- Safe to experiment with parameters

### Production
- Deploy only after Sandbox verification
- Script deployments set to "Released"
- Monitor Execution Log for first 24 hours
- Keep rollback plan ready
