/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * @NModuleScope SameAccount
 * 
 * @description Sales Order User Event - Handles buttons, validation, and backend processing
 * 
 * Pattern: Add custom buttons on view, validate on submit, process after submit
 */
define(['N/record', 'N/search', 'N/url', 'N/runtime'], (record, search, url, runtime) => {

    /**
     * beforeLoad - Add custom buttons and modify form
     */
    const beforeLoad = (context) => {
        try {
            const { newRecord, form, type } = context;
            const recId = newRecord.id;

            if (type === context.UserEventType.VIEW) {

                // Add Print Button
                form.addButton({
                    id: 'custpage_print_btn',
                    label: 'Print Order',
                    functionName: `onPrintClick("${recId}")`
                });

                // Add Exchange Rate Button (only for foreign currency)
                const currency = newRecord.getValue('currency');
                const baseCurrency = runtime.getCurrentScript().getParameter({ name: 'custscript_base_currency' }) || 1;
                
                if (currency && currency != baseCurrency) {
                    form.addButton({
                        id: 'custpage_exchange_rate_btn',
                        label: 'Update Exchange Rate',
                        functionName: `openExchangeRateSuitelet("${recId}")`
                    });
                }

                // Add Approval Button (if pending approval)
                const status = newRecord.getValue('orderstatus');
                if (status === 'A') { // Pending Approval
                    form.addButton({
                        id: 'custpage_approve_btn',
                        label: 'Quick Approve',
                        functionName: `approveOrder("${recId}")`
                    });
                }

                // Set client script
                form.clientScriptModulePath = './so_cs_buttons.js';
            }

            if (type === context.UserEventType.CREATE) {
                // Set default values on create
                setDefaultValues(newRecord, form);
            }

        } catch (errBeforeLoad) {
            log.error('errBeforeLoad', errBeforeLoad);
        }
    };

    /**
     * beforeSubmit - Validation and data preparation
     */
    const beforeSubmit = (context) => {
        try {
            const { newRecord, oldRecord, type } = context;

            if (type === context.UserEventType.DELETE) return;

            // Validate minimum order amount
            const total = parseFloat(newRecord.getValue('total')) || 0;
            const minOrderAmount = 100;

            if (total < minOrderAmount && total > 0) {
                throw new Error(`Minimum order amount is $${minOrderAmount}. Current total: $${total.toFixed(2)}`);
            }

            // Validate all items have quantity
            validateItemLines(newRecord);

            // Calculate custom fields
            calculateMarginAndCost(newRecord);

            // Set exchange rate date
            if (type === context.UserEventType.CREATE) {
                newRecord.setValue({
                    fieldId: 'custbody_exchange_rate_date',
                    value: new Date()
                });
            }

        } catch (errBeforeSubmit) {
            log.error('errBeforeSubmit', errBeforeSubmit);
            throw errBeforeSubmit;
        }
    };

    /**
     * afterSubmit - Post-processing and integrations
     */
    const afterSubmit = (context) => {
        try {
            const { newRecord, oldRecord, type } = context;
            const recId = newRecord.id;

            if (type === context.UserEventType.DELETE) return;

            if (type === context.UserEventType.CREATE) {
                // Log audit trail
                log.audit('Sales Order Created', `ID: ${recId}, Customer: ${newRecord.getValue('entity')}`);

                // Create related records if needed
                createRelatedRecords(recId);
            }

            if (type === context.UserEventType.EDIT) {
                // Check for significant changes
                const oldTotal = oldRecord ? oldRecord.getValue('total') : 0;
                const newTotal = newRecord.getValue('total');

                if (Math.abs(newTotal - oldTotal) > 1000) {
                    log.audit('Significant Change', `Order ${recId}: Total changed from ${oldTotal} to ${newTotal}`);
                    // Could trigger notification here
                }
            }

        } catch (errAfterSubmit) {
            log.error('errAfterSubmit', errAfterSubmit);
        }
    };

    // ==================== HELPER FUNCTIONS ====================

    /**
     * Set default values for new Sales Orders
     */
    const setDefaultValues = (rec, form) => {
        try {
            const currentUser = runtime.getCurrentUser();

            // Set sales rep to current user
            if (!rec.getValue('salesrep')) {
                rec.setValue({ fieldId: 'salesrep', value: currentUser.id });
            }

            // Set default order source
            rec.setValue({ fieldId: 'custbody_order_source', value: 'MANUAL' });

        } catch (errSetDefaults) {
            log.debug('errSetDefaults', errSetDefaults);
        }
    };

    /**
     * Validate all item lines have proper data
     */
    const validateItemLines = (rec) => {
        const lineCount = rec.getLineCount({ sublistId: 'item' });

        if (lineCount === 0) {
            throw new Error('Sales Order must have at least one item');
        }

        for (let i = 0; i < lineCount; i++) {
            const quantity = rec.getSublistValue({
                sublistId: 'item',
                fieldId: 'quantity',
                line: i
            });

            if (!quantity || quantity <= 0) {
                const itemName = rec.getSublistText({
                    sublistId: 'item',
                    fieldId: 'item',
                    line: i
                });
                throw new Error(`Item "${itemName}" has invalid quantity on line ${i + 1}`);
            }
        }
    };

    /**
     * Calculate margin and cost fields
     */
    const calculateMarginAndCost = (rec) => {
        try {
            const lineCount = rec.getLineCount({ sublistId: 'item' });
            let totalCost = 0;
            let totalRevenue = 0;

            for (let i = 0; i < lineCount; i++) {
                const amount = parseFloat(rec.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'amount',
                    line: i
                })) || 0;

                const costEstimate = parseFloat(rec.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'costestimate',
                    line: i
                })) || 0;

                totalRevenue += amount;
                totalCost += costEstimate;
            }

            const margin = totalRevenue > 0 ? ((totalRevenue - totalCost) / totalRevenue * 100) : 0;

            rec.setValue({ fieldId: 'custbody_total_cost', value: totalCost });
            rec.setValue({ fieldId: 'custbody_gross_margin_pct', value: margin.toFixed(2) });

        } catch (errCalcMargin) {
            log.debug('errCalcMargin', errCalcMargin);
        }
    };

    /**
     * Create related records after SO creation
     */
    const createRelatedRecords = (soId) => {
        try {
            // Look up SO details
            const soLookup = search.lookupFields({
                type: search.Type.SALES_ORDER,
                id: soId,
                columns: ['entity', 'total', 'subsidiary']
            });

            // Example: Create activity note
            log.debug('Related Records', `Would create activities for customer ${soLookup.entity}`);

        } catch (errCreateRelated) {
            log.debug('errCreateRelated', errCreateRelated);
        }
    };

    return {
        beforeLoad,
        beforeSubmit,
        afterSubmit
    };
});
