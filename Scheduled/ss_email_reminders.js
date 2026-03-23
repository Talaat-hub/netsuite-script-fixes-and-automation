/**
 * @NApiVersion 2.1
 * @NScriptType ScheduledScript
 * @NModuleScope SameAccount
 * 
 * @description Email Reminder Scheduler - Sends automated email notifications
 * 
 * @param {string} custscript_reminder_type - 'invoice', 'quote', or 'task'
 * @param {number} custscript_days_before - Days before due date to send reminder
 * @param {number} custscript_sender_employee - Employee ID for email sender
 */
define(['N/search', 'N/email', 'N/record', 'N/runtime', 'N/format', 'N/render'], 
    (search, email, record, runtime, format, render) => {

    const execute = (context) => {
        try {
            log.audit('execute', 'Starting email reminder job');

            const script = runtime.getCurrentScript();
            const reminderType = script.getParameter('custscript_reminder_type');
            const daysBeforeDue = parseInt(script.getParameter('custscript_days_before')) || 7;
            const senderId = parseInt(script.getParameter('custscript_sender_employee'));

            let processed = 0;
            let errors = 0;

            switch (reminderType) {
                case 'invoice':
                    ({ processed, errors } = sendInvoiceReminders(daysBeforeDue, senderId, script));
                    break;
                case 'quote':
                    ({ processed, errors } = sendQuoteExpiryReminders(daysBeforeDue, senderId, script));
                    break;
                case 'task':
                    ({ processed, errors } = sendTaskReminders(daysBeforeDue, senderId, script));
                    break;
                default:
                    log.error('execute', `Unknown reminder type: ${reminderType}`);
            }

            log.audit('execute', `Completed. Processed: ${processed}, Errors: ${errors}`);

        } catch (errExecute) {
            log.error('execute Error', errExecute);
        }
    };

    /**
     * Send invoice payment reminders
     */
    const sendInvoiceReminders = (daysBeforeDue, senderId, script) => {
        let processed = 0;
        let errors = 0;

        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + daysBeforeDue);

        const invoiceSearch = search.create({
            type: search.Type.INVOICE,
            filters: [
                ['mainline', 'is', 'T'],
                'AND',
                ['status', 'anyof', 'CustInvc:A'], // Open invoices
                'AND',
                ['duedate', 'onorbefore', format.format({ value: dueDate, type: format.Type.DATE })],
                'AND',
                ['custbody_reminder_sent', 'is', 'F']
            ],
            columns: [
                'entity',
                'tranid',
                'total',
                'amountremaining',
                'duedate',
                search.createColumn({ name: 'email', join: 'customer' }),
                search.createColumn({ name: 'companyname', join: 'customer' })
            ]
        });

        invoiceSearch.run().each(result => {
            // Check governance
            if (script.getRemainingUsage() < 100) {
                log.audit('sendInvoiceReminders', 'Low governance - stopping');
                return false;
            }

            try {
                const customerEmail = result.getValue({ name: 'email', join: 'customer' });
                const customerName = result.getValue({ name: 'companyname', join: 'customer' });
                const invoiceNum = result.getValue('tranid');
                const amount = result.getValue('amountremaining');
                const dueDateStr = result.getValue('duedate');

                if (customerEmail) {
                    const emailBody = buildInvoiceReminderEmail(customerName, invoiceNum, amount, dueDateStr);

                    email.send({
                        author: senderId,
                        recipients: customerEmail,
                        subject: `Payment Reminder: Invoice ${invoiceNum}`,
                        body: emailBody
                    });

                    // Mark as sent
                    record.submitFields({
                        type: record.Type.INVOICE,
                        id: result.id,
                        values: { 'custbody_reminder_sent': true }
                    });

                    processed++;
                }

            } catch (e) {
                log.error('Invoice Reminder Error', { id: result.id, error: e.message });
                errors++;
            }

            return true;
        });

        return { processed, errors };
    };

    /**
     * Send quote expiration reminders
     */
    const sendQuoteExpiryReminders = (daysBeforeDue, senderId, script) => {
        let processed = 0;
        let errors = 0;

        const expirationDate = new Date();
        expirationDate.setDate(expirationDate.getDate() + daysBeforeDue);

        const quoteSearch = search.create({
            type: search.Type.ESTIMATE,
            filters: [
                ['mainline', 'is', 'T'],
                'AND',
                ['status', 'anyof', 'Estimate:A', 'Estimate:B'], // Open quotes
                'AND',
                ['duedate', 'onorbefore', format.format({ value: expirationDate, type: format.Type.DATE })]
            ],
            columns: [
                'tranid',
                'entity',
                'total',
                'duedate',
                'salesrep',
                search.createColumn({ name: 'email', join: 'salesrep' })
            ]
        });

        quoteSearch.run().each(result => {
            if (script.getRemainingUsage() < 100) return false;

            try {
                const salesRepEmail = result.getValue({ name: 'email', join: 'salesrep' });
                
                if (salesRepEmail) {
                    const quoteNum = result.getValue('tranid');
                    const customerName = result.getText('entity');
                    const amount = result.getValue('total');
                    const expDate = result.getValue('duedate');

                    email.send({
                        author: senderId,
                        recipients: salesRepEmail,
                        subject: `Quote Expiring Soon: ${quoteNum}`,
                        body: `Quote ${quoteNum} for ${customerName} ($${amount}) expires on ${expDate}. Please follow up with the customer.`
                    });

                    processed++;
                }

            } catch (e) {
                errors++;
            }

            return true;
        });

        return { processed, errors };
    };

    /**
     * Send task due date reminders
     */
    const sendTaskReminders = (daysBeforeDue, senderId, script) => {
        let processed = 0;
        let errors = 0;

        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + daysBeforeDue);

        const taskSearch = search.create({
            type: search.Type.TASK,
            filters: [
                ['status', 'anyof', 'NOTSTART', 'PROGRESS'],
                'AND',
                ['duedate', 'onorbefore', format.format({ value: dueDate, type: format.Type.DATE })]
            ],
            columns: [
                'title',
                'duedate',
                'assigned',
                'priority',
                search.createColumn({ name: 'email', join: 'assigned' })
            ]
        });

        taskSearch.run().each(result => {
            if (script.getRemainingUsage() < 100) return false;

            try {
                const assigneeEmail = result.getValue({ name: 'email', join: 'assigned' });

                if (assigneeEmail) {
                    const taskTitle = result.getValue('title');
                    const dueDateStr = result.getValue('duedate');
                    const priority = result.getText('priority');

                    email.send({
                        author: senderId,
                        recipients: assigneeEmail,
                        subject: `Task Due Soon: ${taskTitle}`,
                        body: `The task "${taskTitle}" (Priority: ${priority}) is due on ${dueDateStr}. Please ensure it's completed on time.`
                    });

                    processed++;
                }

            } catch (e) {
                errors++;
            }

            return true;
        });

        return { processed, errors };
    };

    // ==================== HELPERS ====================

    const buildInvoiceReminderEmail = (customerName, invoiceNum, amount, dueDate) => {
        return `
Dear ${customerName},

This is a friendly reminder that Invoice ${invoiceNum} with an outstanding balance of $${amount} is due on ${dueDate}.

Please make your payment at your earliest convenience to avoid any late fees.

If you have already made this payment, please disregard this notice.

Thank you for your business.

Best regards,
Accounts Receivable Team
        `.trim();
    };

    return { execute };
});
