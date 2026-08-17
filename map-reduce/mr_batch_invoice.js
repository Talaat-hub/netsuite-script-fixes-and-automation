/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 * @NModuleScope SameAccount
 *
 * PURPOSE:
 * Bulk converts pending Sales Orders to Invoices
 *
 * PROBLEM SOLVED:
 * Before: Creating invoices one-by-one, hours of manual work, missed orders
 * After: One-click batch conversion, email summary, error tracking
 *
 * FEATURES:
 * - Finds all SOs marked for batch processing
 * - Transforms each SO to Invoice
 * - Groups results by customer for reporting
 * - Sends email summary with success/error counts
 *
 * @param {string} custscript_batch_notify_email - Email for completion notification
 * @param {number} [custscript_batch_notify_sender] - Employee ID to send the summary
 *        email from. Falls back to the script's executing user if left blank.
 */
define(['N/record', 'N/search', 'N/email', 'N/runtime', 'N/format', 'N/log', '../libraries/lib_utils'],
    (record, search, email, runtime, format, log, libUtils) => {

    /**
     * Defines the data source - finds Sales Orders ready to be invoiced
     * @returns {Object|search.Search|Array} Input data for map phase
     */
    const getInputData = () => {
        log.audit('getInputData', 'Starting batch invoice generation');

        // Find all Sales Orders that are Pending Billing
        return search.create({
            type: search.Type.SALES_ORDER,
            filters: [
                ['status', 'anyof', 'SalesOrd:B'], // Pending Billing
                'AND',
                ['mainline', 'is', 'T'],
                'AND',
                ['custbody_batch_process', 'is', 'T'],
                'AND',
                ['custbody_invoice_created', 'is', 'F']
            ],
            columns: [
                'internalid',
                'tranid',
                'entity',
                'total',
                'subsidiary',
                'trandate'
            ]
        });
    };

    /**
     * Map function - processes each sales order individually
     * Groups by customer for potential reduce consolidation
     */
    const map = (context) => {
        try {
            const searchResult = JSON.parse(context.value);
            const soId = searchResult.id;
            const soData = searchResult.values;

            log.debug('map', `Processing SO: ${soId} - ${soData.tranid}`);

            // Create invoice from sales order
            const invoiceResult = createInvoice(soId);

            if (invoiceResult.success) {
                // Mark SO as processed
                record.submitFields({
                    type: record.Type.SALES_ORDER,
                    id: soId,
                    values: { 'custbody_invoice_created': true }
                });

                // Group output by customer for summarization
                context.write({
                    key: soData.entity.value,
                    value: {
                        soId: soId,
                        soTranId: soData.tranid,
                        invoiceId: invoiceResult.invoiceId,
                        amount: soData.total
                    }
                });
            } else {
                // Write error to separate key for tracking
                context.write({
                    key: `ERROR_${soId}`,
                    value: {
                        soId: soId,
                        error: invoiceResult.error
                    }
                });
            }

        } catch (errMap) {
            log.error('map Error', errMap);
        }
    };

    /**
     * Reduce function - consolidates results by customer
     * Could be used for customer-level notifications
     */
    const reduce = (context) => {
        try {
            const customerId = context.key;
            const invoices = context.values.map(v => JSON.parse(v));

            // Skip error keys
            if (customerId.startsWith('ERROR_')) {
                context.write({
                    key: 'errors',
                    value: JSON.stringify(invoices[0])
                });
                return;
            }

            // Calculate total invoiced for this customer
            const totalAmount = invoices.reduce((sum, inv) => {
                return sum + parseFloat(inv.amount || 0);
            }, 0);

            const invoiceCount = invoices.length;

            log.debug('reduce', `Customer ${customerId}: ${invoiceCount} invoices, total: ${totalAmount}`);

            // Write customer summary
            context.write({
                key: 'success',
                value: JSON.stringify({
                    customerId: customerId,
                    invoiceCount: invoiceCount,
                    totalAmount: totalAmount,
                    invoices: invoices.map(i => i.invoiceId)
                })
            });

        } catch (errReduce) {
            log.error('reduce Error', errReduce);
        }
    };

    /**
     * Summarize function - called once after reduce, for reporting
     */
    const summarize = (context) => {
        try {
            log.audit('summarize', 'Processing complete - generating summary');

            // Check for input errors
            if (context.inputSummary.error) {
                log.error('Input Error', context.inputSummary.error);
            }

            // Track successes and failures
            let successCount = 0;
            let errorCount = 0;
            let totalAmount = 0;
            const errors = [];

            context.output.iterator().each((key, value) => {
                const data = JSON.parse(value);

                if (key === 'success') {
                    successCount += data.invoiceCount;
                    totalAmount += data.totalAmount;
                } else if (key === 'errors') {
                    errorCount++;
                    errors.push(data);
                }

                return true;
            });

            // Log map phase errors
            context.mapSummary.errors.iterator().each((key, error) => {
                log.error('Map Error', `Key: ${key}, Error: ${error}`);
                errorCount++;
                return true;
            });

            // Log reduce phase errors  
            context.reduceSummary.errors.iterator().each((key, error) => {
                log.error('Reduce Error', `Key: ${key}, Error: ${error}`);
                return true;
            });

            // Final summary
            const summary = {
                invoicesCreated: successCount,
                errors: errorCount,
                totalAmountInvoiced: totalAmount,
                dateRange: format.format({ value: new Date(), type: format.Type.DATETIME })
            };

            log.audit('Batch Invoice Summary', JSON.stringify(summary));

            // Send summary email to administrator
            if (successCount > 0 || errorCount > 0) {
                sendSummaryEmail(summary, errors);
            }

            // Log usage stats
            log.audit('Usage Statistics', {
                mapTime: context.mapSummary.seconds,
                reduceTime: context.reduceSummary.seconds,
                inputStage: context.inputSummary.usage,
                mapStage: context.mapSummary.usage,
                reduceStage: context.reduceSummary.usage
            });

        } catch (errSummarize) {
            log.error('summarize Error', errSummarize);
        }
    };

    // ==================== HELPER FUNCTIONS ====================

    /**
     * Create invoice from sales order
     */
    const createInvoice = (soId) => {
        try {
            // Transform SO to Invoice
            const invoice = record.transform({
                fromType: record.Type.SALES_ORDER,
                fromId: soId,
                toType: record.Type.INVOICE,
                isDynamic: true
            });

            // Set any additional fields
            invoice.setValue({
                fieldId: 'custbody_batch_created',
                value: true
            });

            invoice.setValue({
                fieldId: 'custbody_source_so',
                value: soId
            });

            const invoiceId = invoice.save({
                enableSourcing: true,
                ignoreMandatoryFields: false
            });

            log.debug('createInvoice', `Created Invoice ${invoiceId} from SO ${soId}`);

            return {
                success: true,
                invoiceId: invoiceId
            };

        } catch (e) {
            log.error('createInvoice Error', { soId: soId, error: e.message });
            return {
                success: false,
                error: e.message
            };
        }
    };

    /**
     * Send summary email
     */
    const sendSummaryEmail = (summary, errors) => {
        try {
            const script = runtime.getCurrentScript();
            const recipientEmail = script.getParameter('custscript_batch_notify_email');

            if (!recipientEmail) {
                log.debug('sendSummaryEmail', 'No recipient configured');
                return;
            }

            let body = `
Batch Invoice Generation Complete
=================================

Invoices Created: ${summary.invoicesCreated}
Total Amount: ${libUtils.formatCurrency(summary.totalAmountInvoiced)}
Errors: ${summary.errors}
Completed: ${summary.dateRange}
            `;

            if (errors.length > 0) {
                body += '\n\nErrors:\n';
                errors.forEach(err => {
                    body += `- SO ${err.soId}: ${err.error}\n`;
                });
            }

            const senderId = script.getParameter('custscript_batch_notify_sender') || runtime.getCurrentUser().id;

            email.send({
                author: senderId,
                recipients: recipientEmail,
                subject: `Batch Invoice Run: ${summary.invoicesCreated} created, ${summary.errors} errors`,
                body: body
            });

            log.audit('sendSummaryEmail', `Summary email sent to ${recipientEmail}`);

        } catch (e) {
            log.error('sendSummaryEmail Error', e.message);
        }
    };

    return {
        getInputData,
        map,
        reduce,
        summarize
    };
});
