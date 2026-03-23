/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 * @NModuleScope SameAccount
 * 
 * @description Employee Client Script - Button handlers, field validations
 */
define(['N/url', 'N/https', 'N/currentRecord', 'N/ui/dialog', 'N/format'], 
    (url, https, currentRecord, dialog, format) => {

    const pageInit = (context) => {
        try {
            const rec = context.currentRecord;

            // Set default hire date to today for new records
            if (context.mode === 'create') {
                rec.setValue({
                    fieldId: 'hiredate',
                    value: new Date()
                });
            }

            console.log('Employee form initialized');

        } catch (errPageInit) {
            console.error('pageInit Error', errPageInit);
        }
    };

    const fieldChanged = (context) => {
        try {
            const rec = context.currentRecord;
            const fieldId = context.fieldId;

            // Auto-calculate work duration
            if (fieldId === 'hiredate') {
                const hireDate = rec.getValue('hiredate');
                if (hireDate) {
                    const years = calculateYearsOfService(hireDate);
                    rec.setValue({
                        fieldId: 'custentity_years_of_service',
                        value: years
                    });
                }
            }

            // Auto-populate email from name
            if (fieldId === 'firstname' || fieldId === 'lastname') {
                autoGenerateEmail(rec);
            }

        } catch (errFieldChanged) {
            console.error('fieldChanged Error', errFieldChanged);
        }
    };

    const validateField = (context) => {
        try {
            const rec = context.currentRecord;
            const fieldId = context.fieldId;

            // Validate email format
            if (fieldId === 'email') {
                const email = rec.getValue('email');
                if (email && !isValidEmail(email)) {
                    dialog.alert({
                        title: 'Invalid Email',
                        message: 'Please enter a valid email address.'
                    });
                    return false;
                }
            }

            // Validate phone format
            if (fieldId === 'phone') {
                const phone = rec.getValue('phone');
                if (phone && !isValidPhone(phone)) {
                    dialog.alert({
                        title: 'Invalid Phone',
                        message: 'Please enter a valid phone number (10-15 digits).'
                    });
                    return false;
                }
            }

            return true;

        } catch (errValidateField) {
            console.error('validateField Error', errValidateField);
            return true;
        }
    };

    const saveRecord = (context) => {
        try {
            const rec = context.currentRecord;

            // Require supervisor for non-executive roles
            const supervisor = rec.getValue('supervisor');
            const title = rec.getText('title') || '';

            if (!supervisor && !title.toLowerCase().includes('executive') && !title.toLowerCase().includes('ceo')) {
                dialog.alert({
                    title: 'Missing Supervisor',
                    message: 'Please select a supervisor for this employee.'
                });
                return false;
            }

            return true;

        } catch (errSaveRecord) {
            console.error('saveRecord Error', errSaveRecord);
            return true;
        }
    };

    // ==================== BUTTON HANDLERS ====================

    /**
     * Print ID Card - Opens Suitelet popup
     */
    const printIdCard = (employeeId) => {
        try {
            const suiteletUrl = url.resolveScript({
                scriptId: 'customscript_emp_sl_print',
                deploymentId: 'customdeploy_emp_sl_print',
                params: {
                    empid: employeeId,
                    type: 'idcard'
                }
            });

            // Open as popup using nlExtOpenWindow
            window.nlExtOpenWindow(suiteletUrl, 'idcardprint', 400, 600, null, false, 'ID Card Print');

        } catch (e) {
            console.error('printIdCard Error', e);
            dialog.alert({
                title: 'Error',
                message: 'Failed to open ID Card print. Please try again.'
            });
        }
    };

    /**
     * Print Full Profile
     */
    const printProfile = (employeeId) => {
        try {
            const suiteletUrl = url.resolveScript({
                scriptId: 'customscript_emp_sl_print',
                deploymentId: 'customdeploy_emp_sl_print',
                params: {
                    empid: employeeId,
                    type: 'profile'
                }
            });

            window.nlExtOpenWindow(suiteletUrl, 'profileprint', 800, 1000, null, false, 'Employee Profile');

        } catch (e) {
            console.error('printProfile Error', e);
            dialog.alert({
                title: 'Error',
                message: 'Failed to open profile print.'
            });
        }
    };

    /**
     * Generate QR Code for employee
     */
    const generateQRCode = (employeeId) => {
        try {
            dialog.confirm({
                title: 'Generate QR Code',
                message: 'This will generate a new QR code for the employee ID card. Continue?'
            }).then(result => {
                if (result) {
                    const suiteletUrl = url.resolveScript({
                        scriptId: 'customscript_emp_sl_qr',
                        deploymentId: 'customdeploy_emp_sl_qr',
                        params: { empid: employeeId }
                    });

                    window.nlExtOpenWindow(suiteletUrl, 'qrgen', 350, 400, null, false, 'QR Code');
                }
            });

        } catch (e) {
            console.error('generateQRCode Error', e);
        }
    };

    // ==================== HELPER FUNCTIONS ====================

    const calculateYearsOfService = (hireDate) => {
        const now = new Date();
        const diff = now - hireDate;
        const years = diff / (1000 * 60 * 60 * 24 * 365.25);
        return Math.floor(years * 10) / 10; // One decimal place
    };

    const autoGenerateEmail = (rec) => {
        const firstName = rec.getValue('firstname') || '';
        const lastName = rec.getValue('lastname') || '';
        const currentEmail = rec.getValue('email');

        // Only auto-generate if email is empty
        if (!currentEmail && firstName && lastName) {
            const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}@company.com`;
            rec.setValue({ fieldId: 'email', value: email });
        }
    };

    const isValidEmail = (email) => {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    };

    const isValidPhone = (phone) => {
        const digits = phone.replace(/\D/g, '');
        return digits.length >= 10 && digits.length <= 15;
    };

    return {
        pageInit,
        fieldChanged,
        validateField,
        saveRecord,
        printIdCard,
        printProfile,
        generateQRCode
    };
});
