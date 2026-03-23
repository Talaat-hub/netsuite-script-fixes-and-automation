/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 * @NModuleScope SameAccount
 *
 * PURPOSE:
 * Handles user interactions on Sales Order form
 *
 * PROBLEM SOLVED:
 * Before: Users navigating away to print, manual field updates, no validation feedback
 * After: Quick popup actions, real-time validation, instant user feedback
 *
 * FEATURES:
 * - Print button opens PDF in popup window
 * - Exchange rate button fetches live rates
 * - Field validation prevents bad data entry
 */
define(['N/url', 'N/https', 'N/currentRecord', 'N/ui/dialog'], (url, https, currentRecord, dialog) => {

    /**
     * pageInit - Initialize form
     */
    const pageInit = (context) => {
        try {
            const rec = context.currentRecord;
            const mode = context.mode;

            console.log(`Sales Order Client Script initialized - Mode: ${mode}`);

            if (mode === 'create') {
                // Focus on customer field for new orders
                // Could also show welcome message
            }

        } catch (errPageInit) {
            console.error('errPageInit', errPageInit);
        }
    };

    /**
     * fieldChanged - React to field value changes
     */
    const fieldChanged = (context) => {
        try {
            const rec = context.currentRecord;
            const fieldId = context.fieldId;
            const sublistId = context.sublistId;

            // Handle header field changes
            if (!sublistId) {
                if (fieldId === 'entity') {
                    handleCustomerChange(rec);
                }

                if (fieldId === 'currency') {
                    handleCurrencyChange(rec);
                }
            }

            // Handle item line changes
            if (sublistId === 'item') {
                if (fieldId === 'quantity' || fieldId === 'rate') {
                    recalculateLineAmount(rec);
                }
            }

        } catch (errFieldChanged) {
            console.error('errFieldChanged', errFieldChanged);
        }
    };

    /**
     * validateField - Validate field value before accepting
     */
    const validateField = (context) => {
        try {
            const rec = context.currentRecord;
            const fieldId = context.fieldId;
            const sublistId = context.sublistId;

            // Validate quantity
            if (sublistId === 'item' && fieldId === 'quantity') {
                const quantity = rec.getCurrentSublistValue({
                    sublistId: 'item',
                    fieldId: 'quantity'
                });

                if (quantity <= 0) {
                    alert('Quantity must be greater than zero');
                    return false;
                }

                if (quantity > 99999) {
                    alert('Quantity cannot exceed 99,999');
                    return false;
                }
            }

            return true;

        } catch (errValidateField) {
            console.error('errValidateField', errValidateField);
            return true;
        }
    };

    /**
     * saveRecord - Final validation before save
     */
    const saveRecord = (context) => {
        try {
            const rec = context.currentRecord;

            // Check for items
            const lineCount = rec.getLineCount({ sublistId: 'item' });
            if (lineCount === 0) {
                alert('Please add at least one item to the order');
                return false;
            }

            // Confirm large orders
            const total = rec.getValue({ fieldId: 'total' });
            if (total > 50000) {
                return confirm(`This order totals $${total.toFixed(2)}. Confirm to proceed.`);
            }

            return true;

        } catch (errSaveRecord) {
            console.error('errSaveRecord', errSaveRecord);
            return true;
        }
    };

    // ==================== BUTTON HANDLERS ====================

    /**
     * Open Print Suitelet in new window
     * Called from UE button
     */
    const onPrintClick = (recId) => {
        try {
            const suiteletUrl = url.resolveScript({
                scriptId: 'customscript_so_sl_print',
                deploymentId: 'customdeploy_so_sl_print',
                params: { recId: recId }
            });

            window.open(suiteletUrl, '_blank', 'width=800,height=600');

        } catch (errPrintClick) {
            console.error('errPrintClick', errPrintClick);
            alert('Error opening print window: ' + errPrintClick.message);
        }
    };

    /**
     * Open Exchange Rate Suitelet in popup
     * Called from UE button
     */
    const openExchangeRateSuitelet = (recId) => {
        try {
            const suiteletUrl = url.resolveScript({
                scriptId: 'customscript_so_sl_exchange_rate',
                deploymentId: 'customdeploy_so_sl_exchange_rate',
                params: { recId: recId }
            });

            // Open as popup using NetSuite function
            nlExtOpenWindow(suiteletUrl, 'exchangeRate', 600, 400, 0, 0, 'Update Exchange Rate', null);

        } catch (errExchangeRate) {
            console.error('errExchangeRate', errExchangeRate);
            alert('Error opening exchange rate window: ' + errExchangeRate.message);
        }
    };

    /**
     * Quick approve order via Suitelet call
     * Called from UE button
     */
    const approveOrder = (recId) => {
        try {
            dialog.confirm({
                title: 'Approve Order',
                message: 'Are you sure you want to approve this order?'
            }).then((result) => {
                if (result) {
                    // Call suitelet to process approval
                    const suiteletUrl = url.resolveScript({
                        scriptId: 'customscript_so_sl_approve',
                        deploymentId: 'customdeploy_so_sl_approve',
                        params: { recId: recId, action: 'approve' }
                    });

                    https.get.promise({
                        url: suiteletUrl
                    }).then((response) => {
                        if (response.code === 200) {
                            alert('Order approved successfully!');
                            location.reload();
                        } else {
                            alert('Approval failed: ' + response.body);
                        }
                    }).catch((e) => {
                        alert('Error: ' + e.message);
                    });
                }
            });

        } catch (errApprove) {
            console.error('errApprove', errApprove);
            alert('Error processing approval: ' + errApprove.message);
        }
    };

    // ==================== HELPER FUNCTIONS ====================

    /**
     * Handle customer change - lookup defaults
     */
    const handleCustomerChange = (rec) => {
        const customerId = rec.getValue({ fieldId: 'entity' });
        
        if (customerId) {
            console.log('Customer selected: ' + customerId);
            // Could fetch customer defaults here via https call to restlet
        }
    };

    /**
     * Handle currency change
     */
    const handleCurrencyChange = (rec) => {
        const currency = rec.getValue({ fieldId: 'currency' });
        const baseCurrency = 1; // USD typically

        if (currency && currency != baseCurrency) {
            console.log('Foreign currency selected, may need exchange rate update');
        }
    };

    /**
     * Recalculate line amount based on qty * rate
     */
    const recalculateLineAmount = (rec) => {
        const quantity = parseFloat(rec.getCurrentSublistValue({
            sublistId: 'item',
            fieldId: 'quantity'
        })) || 0;

        const rate = parseFloat(rec.getCurrentSublistValue({
            sublistId: 'item',
            fieldId: 'rate'
        })) || 0;

        // NetSuite usually calculates this automatically, but we can add custom logic
        const amount = quantity * rate;
        console.log(`Line amount calculated: ${amount}`);
    };

    // Expose button functions to window for UE button calls
    if (typeof window !== 'undefined') {
        window.onPrintClick = onPrintClick;
        window.openExchangeRateSuitelet = openExchangeRateSuitelet;
        window.approveOrder = approveOrder;
    }

    return {
        pageInit,
        fieldChanged,
        validateField,
        saveRecord,
        // Export for button calls
        onPrintClick,
        openExchangeRateSuitelet,
        approveOrder
    };
});
