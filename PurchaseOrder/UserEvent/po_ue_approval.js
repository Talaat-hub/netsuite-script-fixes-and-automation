/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * @NModuleScope SameAccount
 * 
 * @description Purchase Order User Event - Approval workflow, vendor validation, budget check
 */
define(['N/record', 'N/search', 'N/email', 'N/runtime', 'N/url'], (record, search, email, runtime, url) => {

    const beforeLoad = (context) => {
        try {
            const { newRecord, form, type } = context;
            const recId = newRecord.id;

            if (type === context.UserEventType.VIEW) {

                const status = newRecord.getValue('status');
                const approvalStatus = newRecord.getValue('approvalstatus');

                // Add Print Button
                form.addButton({
                    id: 'custpage_print_btn',
                    label: 'Print PO',
                    functionName: `onPrintPO("${recId}")`
                });

                // Add Approval buttons based on status
                if (approvalStatus == 1) { // Pending Approval
                    const currentUser = runtime.getCurrentUser();
                    const approverRole = runtime.getCurrentScript().getParameter({ name: 'custscript_po_approver_role' });

                    if (currentUser.role == approverRole) {
                        form.addButton({
                            id: 'custpage_approve_btn',
                            label: 'Approve',
                            functionName: `approvePO("${recId}")`
                        });

                        form.addButton({
                            id: 'custpage_reject_btn',
                            label: 'Reject',
                            functionName: `rejectPO("${recId}")`
                        });
                    }
                }

                // Add Receive button for approved POs
                if (approvalStatus == 2 && status == 'B') { // Approved, Pending Receipt
                    form.addButton({
                        id: 'custpage_receive_btn',
                        label: 'Quick Receive',
                        functionName: `receivePO("${recId}")`
                    });
                }

                form.clientScriptModulePath = './po_cs_buttons.js';
            }

        } catch (errBeforeLoad) {
            log.error('errBeforeLoad', errBeforeLoad);
        }
    };

    const beforeSubmit = (context) => {
        try {
            const { newRecord, oldRecord, type } = context;

            if (type === context.UserEventType.DELETE) return;

            // Validate vendor is active
            validateVendor(newRecord);

            // Check budget availability
            checkBudget(newRecord);

            // Validate item lines
            validateLines(newRecord);

            // Set expected delivery date if not set
            if (!newRecord.getValue('duedate')) {
                const leadTime = getVendorLeadTime(newRecord.getValue('entity'));
                const expectedDate = addDays(new Date(), leadTime);
                newRecord.setValue({ fieldId: 'duedate', value: expectedDate });
            }

        } catch (errBeforeSubmit) {
            log.error('errBeforeSubmit', errBeforeSubmit);
            throw errBeforeSubmit;
        }
    };

    const afterSubmit = (context) => {
        try {
            const { newRecord, oldRecord, type } = context;
            const recId = newRecord.id;

            if (type === context.UserEventType.DELETE) return;

            // On create, send for approval if over threshold
            if (type === context.UserEventType.CREATE) {
                const total = parseFloat(newRecord.getValue('total')) || 0;
                const threshold = parseFloat(runtime.getCurrentScript().getParameter({ name: 'custscript_po_approval_threshold' })) || 5000;

                if (total >= threshold) {
                    sendForApproval(recId, total);
                }
            }

            // On status change to approved, notify requester
            if (type === context.UserEventType.EDIT && oldRecord) {
                const oldApproval = oldRecord.getValue('approvalstatus');
                const newApproval = newRecord.getValue('approvalstatus');

                if (oldApproval != newApproval && newApproval == 2) {
                    notifyApproval(recId, 'approved');
                }
            }

        } catch (errAfterSubmit) {
            log.error('errAfterSubmit', errAfterSubmit);
        }
    };

    // ==================== HELPER FUNCTIONS ====================

    const validateVendor = (rec) => {
        const vendorId = rec.getValue('entity');
        if (!vendorId) {
            throw new Error('Vendor is required');
        }

        const vendorLookup = search.lookupFields({
            type: search.Type.VENDOR,
            id: vendorId,
            columns: ['isinactive', 'entitystatus']
        });

        if (vendorLookup.isinactive) {
            throw new Error('Cannot create PO for inactive vendor');
        }
    };

    const checkBudget = (rec) => {
        // Example budget check logic
        const department = rec.getValue('department');
        const total = parseFloat(rec.getValue('total')) || 0;

        if (department && total > 0) {
            // In real implementation, check against budget custom record
            log.debug('Budget Check', `Department ${department}, Total: ${total}`);
        }
    };

    const validateLines = (rec) => {
        const lineCount = rec.getLineCount({ sublistId: 'item' });

        if (lineCount === 0) {
            throw new Error('Purchase Order must have at least one item');
        }

        for (let i = 0; i < lineCount; i++) {
            const quantity = rec.getSublistValue({
                sublistId: 'item',
                fieldId: 'quantity',
                line: i
            });

            if (!quantity || quantity <= 0) {
                throw new Error(`Line ${i + 1} has invalid quantity`);
            }
        }
    };

    const getVendorLeadTime = (vendorId) => {
        try {
            const vendorLookup = search.lookupFields({
                type: search.Type.VENDOR,
                id: vendorId,
                columns: ['custentity_lead_time_days']
            });
            return parseInt(vendorLookup.custentity_lead_time_days) || 7;
        } catch (e) {
            return 7; // Default 7 days
        }
    };

    const addDays = (date, days) => {
        const result = new Date(date);
        result.setDate(result.getDate() + days);
        return result;
    };

    const sendForApproval = (recId, total) => {
        try {
            const approverEmail = runtime.getCurrentScript().getParameter({ name: 'custscript_po_approver_email' });
            
            if (approverEmail) {
                const poLookup = search.lookupFields({
                    type: search.Type.PURCHASE_ORDER,
                    id: recId,
                    columns: ['tranid', 'entity']
                });

                email.send({
                    author: runtime.getCurrentUser().id,
                    recipients: approverEmail,
                    subject: `PO ${poLookup.tranid} Requires Approval ($${total.toFixed(2)})`,
                    body: `Purchase Order ${poLookup.tranid} for ${poLookup.entity[0].text} requires your approval.\n\nTotal: $${total.toFixed(2)}`
                });

                log.audit('Approval Request Sent', `PO ${recId} sent for approval`);
            }
        } catch (e) {
            log.error('sendForApproval', e.message);
        }
    };

    const notifyApproval = (recId, status) => {
        log.audit('PO Approved', `PO ${recId} has been ${status}`);
    };

    return { beforeLoad, beforeSubmit, afterSubmit };
});
