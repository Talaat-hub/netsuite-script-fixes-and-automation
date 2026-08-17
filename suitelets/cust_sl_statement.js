/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @NModuleScope SameAccount
 *
 * PURPOSE:
 * Generates customer account statements for any date range
 *
 * PROBLEM SOLVED:
 * Before: Standard statements fixed to month-end, no running balance, basic format
 * After: Custom date range picker, running balance calculation, professional PDF
 *
 * FEATURES:
 * - Popup date picker for start/end dates
 * - Searches all transactions in date range
 * - Calculates running balance for each transaction
 * - Generates PDF with debit/credit columns and totals
 */
define(['N/ui/serverWidget', 'N/record', 'N/search', 'N/render', 'N/format', 'N/log', '../libraries/lib_utils'],
    (serverWidget, record, search, render, format, log, libUtils) => {

    const onRequest = (context) => {
        try {
            const { request, response } = context;
            const customerId = request.parameters.custid;

            if (request.method === 'GET') {
                // Show date selection form
                const form = buildDateSelectForm(customerId);
                response.writePage(form);

            } else {
                // Generate statement PDF
                const fromDate = request.parameters.custpage_from_date;
                const toDate = request.parameters.custpage_to_date;
                const includeZero = request.parameters.custpage_include_zero === 'T';

                const pdfFile = generateStatement(customerId, fromDate, toDate, includeZero);
                response.writeFile({
                    file: pdfFile,
                    isInline: true
                });
            }

        } catch (errOnRequest) {
            log.error('onRequest Error', errOnRequest);
            context.response.write(`Error: ${errOnRequest.message}`);
        }
    };

    /**
     * Build date selection form
     */
    const buildDateSelectForm = (customerId) => {
        const form = serverWidget.createForm({
            title: 'Customer Statement',
            hideNavBar: true
        });

        // Customer info display
        if (customerId) {
            const custRec = record.load({ type: record.Type.CUSTOMER, id: customerId, isDynamic: true });
            const custName = custRec.getValue('companyname') || custRec.getValue('entityid');

            const infoField = form.addField({
                id: 'custpage_customer_info',
                type: serverWidget.FieldType.INLINEHTML,
                label: ' '
            });
            infoField.defaultValue = `
                <div style="margin-bottom: 15px; padding: 10px; background-color: #f0f0f0; border-radius: 5px;">
                    <strong>Customer:</strong> ${escapeHtml(custName)}<br/>
                    <strong>ID:</strong> ${customerId}
                </div>
            `;
        }

        // Hidden customer ID
        const custIdField = form.addField({
            id: 'custpage_customer_id',
            type: serverWidget.FieldType.TEXT,
            label: 'Customer ID'
        });
        custIdField.updateDisplayType({ displayType: serverWidget.FieldDisplayType.HIDDEN });
        custIdField.defaultValue = customerId;

        // Date range fields
        const fromDateField = form.addField({
            id: 'custpage_from_date',
            type: serverWidget.FieldType.DATE,
            label: 'From Date'
        });
        fromDateField.isMandatory = true;

        // Default to start of current year
        const startOfYear = new Date();
        startOfYear.setMonth(0, 1);
        fromDateField.defaultValue = startOfYear;

        const toDateField = form.addField({
            id: 'custpage_to_date',
            type: serverWidget.FieldType.DATE,
            label: 'To Date'
        });
        toDateField.isMandatory = true;
        toDateField.defaultValue = new Date();

        // Include zero balance option
        const includeZeroField = form.addField({
            id: 'custpage_include_zero',
            type: serverWidget.FieldType.CHECKBOX,
            label: 'Include Zero Balance Transactions'
        });

        // Submit button
        form.addSubmitButton({ label: 'Generate Statement' });

        return form;
    };

    /**
     * Generate statement PDF
     */
    const generateStatement = (customerId, fromDate, toDate, includeZero) => {
        // Load customer
        const custRec = record.load({ type: record.Type.CUSTOMER, id: customerId });
        const customerData = {
            id: customerId,
            name: custRec.getValue('companyname') || custRec.getValue('entityid'),
            email: custRec.getValue('email') || 'N/A',
            phone: custRec.getValue('phone') || 'N/A',
            balance: custRec.getValue('balance') || 0,
            creditLimit: custRec.getValue('creditlimit') || 0,
            currency: custRec.getText('currency') || 'USD'
        };

        // Search transactions
        const transactions = searchTransactions(customerId, fromDate, toDate, includeZero);

        // Calculate totals
        const totals = calculateTotals(transactions);

        // Build PDF
        const statementXml = buildStatementXml(customerData, transactions, totals, fromDate, toDate);

        return render.xmlToPdf({ xmlString: statementXml });
    };

    /**
     * Search transactions for statement
     */
    const searchTransactions = (customerId, fromDate, toDate, includeZero) => {
        const filters = [
            ['entity', 'is', customerId],
            'AND',
            ['mainline', 'is', 'T'],
            'AND',
            ['trandate', 'onorafter', fromDate],
            'AND',
            ['trandate', 'onorbefore', toDate]
        ];

        if (!includeZero) {
            filters.push('AND', ['amount', 'notequalto', 0]);
        }

        const txnSearch = search.create({
            type: search.Type.TRANSACTION,
            filters: filters,
            columns: [
                search.createColumn({ name: 'trandate', sort: search.Sort.ASC }),
                search.createColumn({ name: 'type' }),
                search.createColumn({ name: 'tranid' }),
                search.createColumn({ name: 'memo' }),
                search.createColumn({ name: 'amount' }),
                search.createColumn({ name: 'fxamount' }),
                search.createColumn({ name: 'status' })
            ]
        });

        const transactions = [];
        let runningBalance = 0;

        txnSearch.run().each(result => {
            const amount = parseFloat(result.getValue('amount')) || 0;
            runningBalance += amount;

            transactions.push({
                date: result.getValue('trandate'),
                type: result.getText('type'),
                number: result.getValue('tranid'),
                memo: result.getValue('memo') || '',
                amount: amount,
                balance: runningBalance,
                status: result.getText('status')
            });

            return true;
        });

        return transactions;
    };

    /**
     * Calculate totals
     */
    const calculateTotals = (transactions) => {
        let totalDebits = 0;
        let totalCredits = 0;

        transactions.forEach(txn => {
            if (txn.amount > 0) {
                totalDebits += txn.amount;
            } else {
                totalCredits += Math.abs(txn.amount);
            }
        });

        return {
            debits: totalDebits,
            credits: totalCredits,
            balance: totalDebits - totalCredits
        };
    };

    /**
     * Build statement XML
     */
    const buildStatementXml = (customer, transactions, totals, fromDate, toDate) => {
        const today = format.format({ value: new Date(), type: format.Type.DATE });

        let transactionRows = '';
        transactions.forEach(txn => {
            transactionRows += `
                <tr>
                    <td>${txn.date}</td>
                    <td>${libUtils.escapeXml(txn.type)}</td>
                    <td>${libUtils.escapeXml(txn.number)}</td>
                    <td>${libUtils.escapeXml(txn.memo)}</td>
                    <td align="right">${txn.amount >= 0 ? formatCurrency(txn.amount) : ''}</td>
                    <td align="right">${txn.amount < 0 ? formatCurrency(Math.abs(txn.amount)) : ''}</td>
                    <td align="right">${formatCurrency(txn.balance)}</td>
                </tr>
            `;
        });

        if (transactions.length === 0) {
            transactionRows = '<tr><td colspan="7" align="center">No transactions found for the selected period</td></tr>';
        }

        return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE pdf PUBLIC "-//big.faceless.org//report" "report-1.1.dtd">
<pdf>
    <head>
        <style type="text/css">
            body { font-family: Arial, sans-serif; font-size: 9pt; }
            .header { background-color: #003366; color: white; padding: 15px; margin-bottom: 15px; }
            .company-name { font-size: 16pt; font-weight: bold; }
            .doc-title { font-size: 12pt; }
            .customer-info { margin-bottom: 15px; padding: 10px; background-color: #f5f5f5; }
            .customer-name { font-size: 14pt; font-weight: bold; color: #003366; }
            .period { font-size: 10pt; color: #666; margin-bottom: 10px; }
            table.txn { width: 100%; border-collapse: collapse; margin-top: 10px; }
            table.txn th { background-color: #003366; color: white; padding: 6px; text-align: left; font-size: 8pt; }
            table.txn td { padding: 5px; border-bottom: 1px solid #ddd; font-size: 8pt; }
            table.txn tr:nth-child(even) td { background-color: #fafafa; }
            .totals { margin-top: 15px; text-align: right; }
            .totals table { float: right; width: 250px; }
            .totals td { padding: 4px 8px; }
            .totals .label { font-weight: bold; }
            .totals .balance { font-size: 11pt; font-weight: bold; color: #003366; border-top: 2px solid #003366; }
            .footer { margin-top: 30px; font-size: 8pt; color: #999; text-align: center; }
        </style>
    </head>
    <body>
        <div class="header">
            <div class="company-name">Company Name</div>
            <div class="doc-title">Customer Statement</div>
        </div>

        <div class="customer-info">
            <div class="customer-name">${libUtils.escapeXml(customer.name)}</div>
            <table>
                <tr>
                    <td><strong>Email:</strong> ${libUtils.escapeXml(customer.email)}</td>
                    <td><strong>Phone:</strong> ${libUtils.escapeXml(customer.phone)}</td>
                </tr>
                <tr>
                    <td><strong>Credit Limit:</strong> ${formatCurrency(customer.creditLimit)} ${customer.currency}</td>
                    <td><strong>Current Balance:</strong> ${formatCurrency(customer.balance)} ${customer.currency}</td>
                </tr>
            </table>
        </div>

        <div class="period">
            Statement Period: ${fromDate} to ${toDate}
        </div>

        <table class="txn">
            <thead>
                <tr>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Number</th>
                    <th>Memo</th>
                    <th>Debit</th>
                    <th>Credit</th>
                    <th>Balance</th>
                </tr>
            </thead>
            <tbody>
                ${transactionRows}
            </tbody>
        </table>

        <div class="totals">
            <table>
                <tr><td class="label">Total Debits:</td><td>${formatCurrency(totals.debits)}</td></tr>
                <tr><td class="label">Total Credits:</td><td>${formatCurrency(totals.credits)}</td></tr>
                <tr class="balance"><td class="label">Balance Due:</td><td>${formatCurrency(totals.balance)}</td></tr>
            </table>
        </div>

        <div class="footer">
            Generated on: ${today} | Page 1 of 1
        </div>
    </body>
</pdf>`;
    };

    const escapeHtml = (str) => libUtils.escapeXml(str);

    // Deliberately NOT libUtils.formatCurrency: this statement always prints the
    // customer's currency code as a separate label next to the amount (see
    // buildStatementXml), so this local helper returns a plain "1,234.56" without a
    // currency symbol baked in — using libUtils' formatCurrency here would produce a
    // redundant "$1,234.56 EUR".
    const formatCurrency = (amount) => {
        return parseFloat(amount || 0).toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    };

    return { onRequest };
});
