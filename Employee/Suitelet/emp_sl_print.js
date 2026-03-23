/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @NModuleScope SameAccount
 * 
 * @description Employee Print Suitelet - ID Card and Profile printing
 */
define(['N/record', 'N/render', 'N/search', 'N/file', 'N/format', 'N/encode'], 
    (record, render, search, file, format, encode) => {

    const onRequest = (context) => {
        try {
            const { request, response } = context;
            const employeeId = request.parameters.empid;
            const printType = request.parameters.type || 'profile';

            if (!employeeId) {
                response.write('Employee ID is required');
                return;
            }

            // Load employee record
            const empRec = record.load({
                type: record.Type.EMPLOYEE,
                id: employeeId
            });

            let pdfFile;

            if (printType === 'idcard') {
                pdfFile = generateIdCard(empRec);
            } else {
                pdfFile = generateProfile(empRec);
            }

            response.writeFile({
                file: pdfFile,
                isInline: true
            });

        } catch (errOnRequest) {
            log.error('onRequest Error', errOnRequest);
            context.response.write(`Error: ${errOnRequest.message}`);
        }
    };

    /**
     * Generate ID Card PDF
     */
    const generateIdCard = (empRec) => {
        const employeeData = extractEmployeeData(empRec);

        const idCardXml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE pdf PUBLIC "-//big.faceless.org//report" "report-1.1.dtd">
<pdf>
    <head>
        <style type="text/css">
            body { font-family: Arial, sans-serif; font-size: 9pt; }
            .card { border: 2px solid #003366; border-radius: 10px; padding: 15px; width: 3.375in; height: 2.125in; }
            .header { background-color: #003366; color: white; padding: 8px; text-align: center; margin-bottom: 10px; }
            .photo-box { float: left; width: 1in; height: 1.2in; border: 1px solid #ccc; margin-right: 10px; text-align: center; }
            .info { font-size: 8pt; }
            .info td { padding: 2px 0; }
            .emp-name { font-size: 11pt; font-weight: bold; color: #003366; }
            .emp-title { font-size: 9pt; color: #666; }
            .emp-code { font-size: 8pt; font-family: monospace; }
            .footer { position: absolute; bottom: 10px; font-size: 7pt; color: #999; }
        </style>
    </head>
    <body size="3.375in 2.125in">
        <div class="card">
            <div class="header">
                <strong>EMPLOYEE ID CARD</strong>
            </div>
            
            <div class="photo-box">
                ${employeeData.photoUrl ? `<img src="${employeeData.photoUrl}" width="1in"/>` : '[PHOTO]'}
            </div>
            
            <div class="info">
                <div class="emp-name">${escapeXml(employeeData.fullName)}</div>
                <div class="emp-title">${escapeXml(employeeData.title)}</div>
                <br/>
                <table>
                    <tr><td><strong>ID:</strong></td><td class="emp-code">${escapeXml(employeeData.employeeCode)}</td></tr>
                    <tr><td><strong>Dept:</strong></td><td>${escapeXml(employeeData.department)}</td></tr>
                    <tr><td><strong>Hired:</strong></td><td>${employeeData.hireDate}</td></tr>
                </table>
            </div>
            
            <div class="footer">
                Subsidiary: ${escapeXml(employeeData.subsidiary)} | Valid Until: ${employeeData.validUntil}
            </div>
        </div>
    </body>
</pdf>`;

        return render.xmlToPdf({ xmlString: idCardXml });
    };

    /**
     * Generate Full Profile PDF
     */
    const generateProfile = (empRec) => {
        const employeeData = extractEmployeeData(empRec);
        const today = format.format({ value: new Date(), type: format.Type.DATE });

        const profileXml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE pdf PUBLIC "-//big.faceless.org//report" "report-1.1.dtd">
<pdf>
    <head>
        <style type="text/css">
            body { font-family: Arial, sans-serif; font-size: 10pt; }
            .header { background-color: #003366; color: white; padding: 15px; margin-bottom: 20px; }
            .company-name { font-size: 16pt; font-weight: bold; }
            .doc-title { font-size: 14pt; margin-top: 5px; }
            .section { margin-bottom: 15px; }
            .section-title { font-size: 12pt; font-weight: bold; color: #003366; border-bottom: 1px solid #003366; padding-bottom: 3px; margin-bottom: 8px; }
            table { width: 100%; border-collapse: collapse; }
            table.info td { padding: 5px 10px; vertical-align: top; }
            table.info td:first-child { font-weight: bold; width: 30%; color: #666; }
            .emp-name { font-size: 18pt; font-weight: bold; color: #003366; }
            .emp-title { font-size: 12pt; color: #666; }
            .footer { position: absolute; bottom: 20px; font-size: 8pt; color: #999; text-align: center; width: 100%; }
        </style>
    </head>
    <body>
        <div class="header">
            <div class="company-name">Company Name</div>
            <div class="doc-title">Employee Profile</div>
        </div>

        <div class="emp-name">${escapeXml(employeeData.fullName)}</div>
        <div class="emp-title">${escapeXml(employeeData.title)}</div>
        <br/><br/>

        <div class="section">
            <div class="section-title">Personal Information</div>
            <table class="info">
                <tr><td>Employee Code:</td><td>${escapeXml(employeeData.employeeCode)}</td></tr>
                <tr><td>Email:</td><td>${escapeXml(employeeData.email)}</td></tr>
                <tr><td>Phone:</td><td>${escapeXml(employeeData.phone)}</td></tr>
                <tr><td>Mobile:</td><td>${escapeXml(employeeData.mobile)}</td></tr>
            </table>
        </div>

        <div class="section">
            <div class="section-title">Employment Details</div>
            <table class="info">
                <tr><td>Department:</td><td>${escapeXml(employeeData.department)}</td></tr>
                <tr><td>Subsidiary:</td><td>${escapeXml(employeeData.subsidiary)}</td></tr>
                <tr><td>Supervisor:</td><td>${escapeXml(employeeData.supervisor)}</td></tr>
                <tr><td>Hire Date:</td><td>${employeeData.hireDate}</td></tr>
                <tr><td>Years of Service:</td><td>${employeeData.yearsOfService}</td></tr>
                <tr><td>Status:</td><td>${employeeData.isActive ? 'Active' : 'Inactive'}</td></tr>
            </table>
        </div>

        <div class="section">
            <div class="section-title">Compensation</div>
            <table class="info">
                <tr><td>Pay Frequency:</td><td>${escapeXml(employeeData.payFrequency)}</td></tr>
            </table>
        </div>

        <div class="footer">
            Generated on: ${today} | CONFIDENTIAL - HR Use Only
        </div>
    </body>
</pdf>`;

        return render.xmlToPdf({ xmlString: profileXml });
    };

    /**
     * Extract employee data for templates
     */
    const extractEmployeeData = (empRec) => {
        const hireDate = empRec.getValue('hiredate');
        const validUntil = new Date();
        validUntil.setFullYear(validUntil.getFullYear() + 1);

        return {
            id: empRec.id,
            employeeCode: empRec.getValue('custentity_employee_code') || `EMP-${empRec.id}`,
            firstName: empRec.getValue('firstname') || '',
            lastName: empRec.getValue('lastname') || '',
            fullName: `${empRec.getValue('firstname') || ''} ${empRec.getValue('lastname') || ''}`.trim(),
            title: empRec.getText('title') || 'N/A',
            email: empRec.getValue('email') || 'N/A',
            phone: empRec.getValue('phone') || 'N/A',
            mobile: empRec.getValue('mobilephone') || 'N/A',
            department: empRec.getText('department') || 'N/A',
            subsidiary: empRec.getText('subsidiary') || 'N/A',
            supervisor: empRec.getText('supervisor') || 'N/A',
            hireDate: hireDate ? format.format({ value: hireDate, type: format.Type.DATE }) : 'N/A',
            validUntil: format.format({ value: validUntil, type: format.Type.DATE }),
            yearsOfService: empRec.getValue('custentity_years_of_service') || '0',
            isActive: empRec.getValue('isinactive') !== true,
            payFrequency: empRec.getText('payfrequency') || 'N/A',
            photoUrl: empRec.getValue('image') || null
        };
    };

    const escapeXml = (str) => {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    };

    return { onRequest };
});
