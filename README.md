# NetSuite Script Fixes & Automation

Real-world SuiteScript 2.1 solutions for common NetSuite problems.

## 🔧 What I Do

- **Fix broken scripts** - Debug and repair existing SuiteScript that isn't working
- **Automate manual work** - Turn repetitive tasks into automated workflows
- **Build integrations** - Connect NetSuite to external systems via REST APIs
- **Custom printouts** - Professional PDF documents (invoices, statements, ID cards)
- **Batch processing** - Handle large data volumes efficiently

## 📁 Solutions

### Sales Order Automation
| Problem | Solution |
|---------|----------|
| Manual margin calculations causing pricing errors | Auto-calculate margins on line item entry |
| No way to get live exchange rates | Popup fetches rates from external API |
| Generic printouts don't match branding | Custom PDF with company template |

**Files:** `SalesOrder/`

### Purchase Order Approval Workflow
| Problem | Solution |
|---------|----------|
| POs going through without proper approval | Multi-level approval with budget validation |
| No visibility into approval status | Status tracking with email notifications |
| Manual receiving process | One-click item receipt creation |

**Files:** `PurchaseOrder/`

### Employee Management (HRMS)
| Problem | Solution |
|---------|----------|
| Manual employee ID assignment | Auto-generated employee codes |
| No standard ID cards | PDF ID card with photo and QR code |
| Document tracking gaps | Serial number system for all documents |

**Files:** `Employee/`

### Customer Statements
| Problem | Solution |
|---------|----------|
| Can't generate statements for custom date ranges | Date picker with running balance calculation |
| Basic statement format | Professional PDF with company branding |

**Files:** `Customer/`

### Batch Invoice Generation
| Problem | Solution |
|---------|----------|
| Creating invoices one-by-one takes hours | Bulk transform all pending SOs to invoices |
| No visibility into batch job status | Email summary with success/error counts |

**Files:** `BatchProcessing/`

### Automated Reminders
| Problem | Solution |
|---------|----------|
| Overdue invoices not followed up | Auto-send payment reminders before due date |
| Quotes expiring without notice | Sales rep notifications for expiring quotes |

**Files:** `Scheduled/`

## 🛠️ Tech Stack

- **SuiteScript 2.1** - Modern ES6+ syntax
- **Script Types** - User Event, Client Script, Suitelet, Map/Reduce, Scheduled
- **Modules** - N/record, N/search, N/render, N/https, N/email

## 📋 How I Work

1. **Understand the problem** - What's broken or missing?
2. **Propose solution** - Clear explanation before coding
3. **Deliver working code** - Tested, documented, ready to deploy
4. **Support** - Help with deployment and any issues

## ⏱️ Availability

- Bug fixes and small tasks
- Part-time ongoing support
- Quick turnaround on urgent issues

## 📂 Documentation

- [Deployment Guide](docs/DEPLOYMENT.md) - How to install scripts
- [API Reference](docs/API.md) - Utility library documentation