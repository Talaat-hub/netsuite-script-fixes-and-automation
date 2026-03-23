/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * @NModuleScope SameAccount
 * 
 * @description Employee User Event - HRMS serial number generation, document management
 */
define(['N/record', 'N/search', 'N/runtime', 'N/format'], (record, search, runtime, format) => {

    const beforeLoad = (context) => {
        try {
            const { newRecord, form, type } = context;
            const recId = newRecord.id;

            if (type === context.UserEventType.VIEW) {

                // Add ID Card Print button
                form.addButton({
                    id: 'custpage_print_id_btn',
                    label: 'Print ID Card',
                    functionName: `printIdCard("${recId}")`
                });

                // Add Generate QR Code button for sales reps
                const isSalesRep = newRecord.getValue('issalesrep');
                if (isSalesRep === true || isSalesRep === 'T') {
                    form.addButton({
                        id: 'custpage_generate_qr_btn',
                        label: 'Generate QR Code',
                        functionName: `generateQRCode("${recId}")`
                    });
                }

                // Add Documents Print for PRINT context
                form.clientScriptModulePath = './emp_cs_buttons.js';
            }

            // On Print, get serial number
            if (type === context.UserEventType.PRINT) {
                const serialData = getSerialNumber(newRecord);
                setSerialNumberField(context, serialData);
            }

        } catch (errBeforeLoad) {
            log.error('errBeforeLoad', errBeforeLoad);
        }
    };

    const beforeSubmit = (context) => {
        try {
            const { newRecord, type } = context;

            if (type === context.UserEventType.DELETE) return;

            // Validate required fields
            validateEmployeeData(newRecord);

            // Generate employee code if new
            if (type === context.UserEventType.CREATE) {
                generateEmployeeCode(newRecord);
            }

            // Update modified date
            newRecord.setValue({
                fieldId: 'custentity_last_modified_date',
                value: new Date()
            });

        } catch (errBeforeSubmit) {
            log.error('errBeforeSubmit', errBeforeSubmit);
            throw errBeforeSubmit;
        }
    };

    const afterSubmit = (context) => {
        try {
            const { newRecord, oldRecord, type } = context;

            if (type === context.UserEventType.DELETE) return;

            // On hire, create initial records
            if (type === context.UserEventType.CREATE) {
                createInitialLeaveBalance(newRecord);
            }

            // On status change, update related records
            if (type === context.UserEventType.EDIT && oldRecord) {
                const oldStatus = oldRecord.getValue('isinactive');
                const newStatus = newRecord.getValue('isinactive');

                if (oldStatus !== newStatus && newStatus === true) {
                    handleTermination(newRecord);
                }
            }

        } catch (errAfterSubmit) {
            log.error('errAfterSubmit', errAfterSubmit);
        }
    };

    // ==================== HELPER FUNCTIONS ====================

    /**
     * Generate serial number for printing
     */
    const getSerialNumber = (rec) => {
        try {
            const employeeId = rec.id;
            const subsidiary = rec.getValue('subsidiary');

            // Search for document count
            const docSearch = search.create({
                type: 'customrecord_employee_documents',
                filters: [
                    ['custrecord_doc_employee', 'is', employeeId],
                    'AND',
                    ['isinactive', 'is', 'F']
                ],
                columns: [
                    search.createColumn({ name: 'internalid', summary: search.Summary.COUNT })
                ]
            });

            let count = 0;
            docSearch.run().each(result => {
                count = parseInt(result.getValue({ name: 'internalid', summary: search.Summary.COUNT })) || 0;
                return false;
            });

            return {
                count: count,
                serial: `${subsidiary}-${employeeId}-${count + 1}`
            };

        } catch (e) {
            log.debug('getSerialNumber', e.message);
            return { count: 0, serial: 'N/A' };
        }
    };

    const setSerialNumberField = (context, serialData) => {
        try {
            const form = context.form;

            // Add inline HTML field for serial number on print
            const serialField = form.addField({
                id: 'custpage_serial_number',
                type: 'inlinehtml',
                label: ' '
            });

            serialField.defaultValue = `
                <div style="position: absolute; top: 10px; right: 10px; font-size: 8pt;">
                    Serial: ${serialData.serial}
                </div>
            `;

        } catch (e) {
            log.debug('setSerialNumberField', e.message);
        }
    };

    const validateEmployeeData = (rec) => {
        const firstName = rec.getValue('firstname');
        const lastName = rec.getValue('lastname');

        if (!firstName || !lastName) {
            throw new Error('First Name and Last Name are required');
        }

        const email = rec.getValue('email');
        if (email && !isValidEmail(email)) {
            throw new Error('Invalid email format');
        }
    };

    const generateEmployeeCode = (rec) => {
        try {
            const subsidiary = rec.getValue('subsidiary');
            const department = rec.getValue('department');

            // Get next sequence
            const empSearch = search.create({
                type: search.Type.EMPLOYEE,
                filters: [['subsidiary', 'is', subsidiary]],
                columns: [search.createColumn({ name: 'internalid', sort: search.Sort.DESC })]
            });

            let lastId = 0;
            empSearch.run().each(result => {
                lastId = parseInt(result.id) || 0;
                return false;
            });

            const code = `EMP-${subsidiary}-${String(lastId + 1).padStart(5, '0')}`;
            rec.setValue({ fieldId: 'custentity_employee_code', value: code });

        } catch (e) {
            log.debug('generateEmployeeCode', e.message);
        }
    };

    const createInitialLeaveBalance = (rec) => {
        log.audit('New Employee', `Creating initial leave balance for ${rec.id}`);
        // Would create leave balance records here
    };

    const handleTermination = (rec) => {
        log.audit('Employee Terminated', `Processing termination for ${rec.id}`);
        // Would close related records, revoke access, etc.
    };

    const isValidEmail = (email) => {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    };

    return { beforeLoad, beforeSubmit, afterSubmit };
});
