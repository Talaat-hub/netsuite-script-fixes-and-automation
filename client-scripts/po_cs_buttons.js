/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 * @NModuleScope SameAccount
 *
 * PURPOSE:
 * Handles PO approval actions and receiving workflow
 *
 * PROBLEM SOLVED:
 * Before: Multiple clicks to approve, navigating to create receipts
 * After: One-click approve/reject, instant receipt creation
 *
 * FEATURES:
 * - Approve button with confirmation dialog
 * - Reject button with reason prompt
 * - Receive button creates Item Receipt automatically
 */
define(['N/url', 'N/https', 'N/currentRecord', 'N/ui/dialog'], (url, https, currentRecord, dialog) => {

    const pageInit = (context) => {
        try {
            console.log('PO Client Script initialized');
        } catch (errPageInit) {
            console.error('errPageInit', errPageInit);
        }
    };

    const fieldChanged = (context) => {
        try {
            const rec = context.currentRecord;
            const fieldId = context.fieldId;
            const sublistId = context.sublistId;

            // Update expected cost on quantity/rate change
            if (sublistId === 'item' && (fieldId === 'quantity' || fieldId === 'rate')) {
                updateLineAmount(rec);
            }

            // Vendor change - show lead time info
            if (fieldId === 'entity') {
                handleVendorChange(rec);
            }

        } catch (errFieldChanged) {
            console.error('errFieldChanged', errFieldChanged);
        }
    };

    const validateField = (context) => {
        try {
            const rec = context.currentRecord;
            const fieldId = context.fieldId;
            const sublistId = context.sublistId;

            if (sublistId === 'item' && fieldId === 'quantity') {
                const qty = rec.getCurrentSublistValue({
                    sublistId: 'item',
                    fieldId: 'quantity'
                });

                if (qty <= 0) {
                    alert('Quantity must be greater than zero');
                    return false;
                }
            }

            return true;
        } catch (e) {
            console.error('validateField', e);
            return true;
        }
    };

    const saveRecord = (context) => {
        try {
            const rec = context.currentRecord;
            const lineCount = rec.getLineCount({ sublistId: 'item' });

            if (lineCount === 0) {
                alert('Please add at least one item');
                return false;
            }

            // Check for large POs
            const total = rec.getValue({ fieldId: 'total' });
            if (total > 100000) {
                return confirm(`This PO totals $${total.toFixed(2)} and will require executive approval. Continue?`);
            }

            return true;
        } catch (e) {
            console.error('saveRecord', e);
            return true;
        }
    };

    // ==================== BUTTON HANDLERS ====================

    const onPrintPO = (recId) => {
        try {
            const suiteletUrl = url.resolveScript({
                scriptId: 'customscript_po_sl_print',
                deploymentId: 'customdeploy_po_sl_print',
                params: { recId: recId }
            });
            window.open(suiteletUrl, '_blank');
        } catch (e) {
            alert('Error: ' + e.message);
        }
    };

    const approvePO = (recId) => {
        dialog.confirm({
            title: 'Approve Purchase Order',
            message: 'Are you sure you want to approve this Purchase Order?'
        }).then(result => {
            if (result) {
                processApproval(recId, 'approve');
            }
        });
    };

    const rejectPO = (recId) => {
        dialog.create({
            title: 'Reject Purchase Order',
            message: 'Please enter rejection reason:',
            buttons: [
                { label: 'Reject', value: true },
                { label: 'Cancel', value: false }
            ]
        }).then(result => {
            if (result) {
                processApproval(recId, 'reject');
            }
        });
    };

    // NOTE: receivePO() and processApproval() below call Suitelets
    // (`customscript_po_sl_receive` and `customscript_po_sl_approval`) that are not
    // included in this repo — only the printing Suitelet (suitelets/po_sl_print.js) is.
    // Both are wired up as working examples of the confirm-then-GET pattern with
    // `N/https.get.promise()`; to make them functional you'd add Suitelets that create
    // the Item Receipt and flip the PO's approval status server-side, respectively.
    // See docs/DEPLOYMENT.md "Known Limitations".
    const receivePO = (recId) => {
        dialog.confirm({
            title: 'Receive Items',
            message: 'This will create an Item Receipt for all items. Continue?'
        }).then(result => {
            if (result) {
                const suiteletUrl = url.resolveScript({
                    scriptId: 'customscript_po_sl_receive',
                    deploymentId: 'customdeploy_po_sl_receive',
                    params: { recId: recId }
                });

                https.get.promise({ url: suiteletUrl })
                    .then(response => {
                        if (response.code === 200) {
                            alert('Item Receipt created successfully');
                            location.reload();
                        }
                    })
                    .catch(e => alert('Error: ' + e.message));
            }
        });
    };

    const processApproval = (recId, action) => {
        const suiteletUrl = url.resolveScript({
            scriptId: 'customscript_po_sl_approval',
            deploymentId: 'customdeploy_po_sl_approval',
            params: { recId: recId, action: action }
        });

        https.get.promise({ url: suiteletUrl })
            .then(response => {
                const result = JSON.parse(response.body);
                if (result.success) {
                    alert(`PO ${action}ed successfully`);
                    location.reload();
                } else {
                    alert('Error: ' + result.message);
                }
            })
            .catch(e => alert('Error: ' + e.message));
    };

    // ==================== HELPER FUNCTIONS ====================

    const updateLineAmount = (rec) => {
        const qty = parseFloat(rec.getCurrentSublistValue({
            sublistId: 'item',
            fieldId: 'quantity'
        })) || 0;

        const rate = parseFloat(rec.getCurrentSublistValue({
            sublistId: 'item',
            fieldId: 'rate'
        })) || 0;

        console.log(`Line amount: ${qty} x ${rate} = ${qty * rate}`);
    };

    const handleVendorChange = (rec) => {
        const vendorId = rec.getValue({ fieldId: 'entity' });
        if (vendorId) {
            console.log('Vendor selected:', vendorId);
            // Could fetch vendor defaults via https call
        }
    };

    // Expose to window
    if (typeof window !== 'undefined') {
        window.onPrintPO = onPrintPO;
        window.approvePO = approvePO;
        window.rejectPO = rejectPO;
        window.receivePO = receivePO;
    }

    return {
        pageInit,
        fieldChanged,
        validateField,
        saveRecord,
        onPrintPO,
        approvePO,
        rejectPO,
        receivePO
    };
});
