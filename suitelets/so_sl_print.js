/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @NModuleScope SameAccount
 *
 * PURPOSE:
 * Generates professional PDF printout for Sales Orders
 *
 * PROBLEM SOLVED:
 * Before: Generic NetSuite printouts, no company branding, unprofessional appearance
 * After: Custom branded PDF with logo, styled tables, proper formatting
 *
 * FEATURES:
 * - Full HTML/CSS template with header, body, footer
 * - Line item table with pricing and totals
 * - Opens inline for immediate viewing
 */
define(['N/record', 'N/search', 'N/render', 'N/file', 'N/format'], (record, search, render, file, format) => {

    const onRequest = (context) => {
        try {
            if (context.request.method === 'GET') {
                handleGet(context);
            }
        } catch (errOnRequest) {
            log.error('errOnRequest', errOnRequest);
            context.response.write(`<html><body><h2>Error</h2><p>${errOnRequest.message}</p></body></html>`);
        }
    };

    /**
     * Handle GET request - generate and return PDF
     */
    const handleGet = (context) => {
        try {
            const recId = context.request.parameters.recId;

            if (!recId) {
                throw new Error('Record ID is required');
            }

            // Load Sales Order data
            const soData = getSalesOrderData(recId);

            // Get company/subsidiary logo
            const logoUrl = getSubsidiaryLogo(soData.subsidiary);

            // Build HTML template
            let template = getHeader(soData, logoUrl);
            template = getBody(template, soData);
            template = getFooter(template, soData);

            // Render to PDF
            finalPrint(template, context);

        } catch (errHandleGet) {
            log.error('errHandleGet', errHandleGet);
            throw errHandleGet;
        }
    };

    // ==================== DATA FUNCTIONS ====================

    /**
     * Get Sales Order header and line data
     */
    const getSalesOrderData = (recId) => {
        const soRec = record.load({
            type: record.Type.SALES_ORDER,
            id: recId
        });

        // Header data
        const data = {
            id: recId,
            tranId: soRec.getValue('tranid'),
            tranDate: formatDate(soRec.getValue('trandate')),
            customerName: soRec.getText('entity'),
            customerId: soRec.getValue('entity'),
            subsidiary: soRec.getValue('subsidiary'),
            subsidiaryName: soRec.getText('subsidiary'),
            currency: soRec.getText('currency'),
            exchangeRate: soRec.getValue('exchangerate'),
            subtotal: formatCurrency(soRec.getValue('subtotal')),
            discountTotal: formatCurrency(soRec.getValue('discounttotal')),
            taxTotal: formatCurrency(soRec.getValue('taxtotal')),
            shippingCost: formatCurrency(soRec.getValue('shippingcost')),
            total: formatCurrency(soRec.getValue('total')),
            memo: soRec.getValue('memo') || '',
            shipDate: formatDate(soRec.getValue('shipdate')),
            shipMethod: soRec.getText('shipmethod'),
            shipAddress: soRec.getValue('shipaddress'),
            billAddress: soRec.getValue('billaddress'),
            salesRep: soRec.getText('salesrep'),
            poNumber: soRec.getValue('otherrefnum') || '',
            items: []
        };

        // Line items
        const lineCount = soRec.getLineCount({ sublistId: 'item' });

        for (let i = 0; i < lineCount; i++) {
            data.items.push({
                line: i + 1,
                item: soRec.getSublistText({ sublistId: 'item', fieldId: 'item', line: i }),
                description: soRec.getSublistValue({ sublistId: 'item', fieldId: 'description', line: i }) || '',
                quantity: soRec.getSublistValue({ sublistId: 'item', fieldId: 'quantity', line: i }),
                rate: formatCurrency(soRec.getSublistValue({ sublistId: 'item', fieldId: 'rate', line: i })),
                amount: formatCurrency(soRec.getSublistValue({ sublistId: 'item', fieldId: 'amount', line: i }))
            });
        }

        return data;
    };

    /**
     * Get subsidiary logo URL
     */
    const getSubsidiaryLogo = (subsidiaryId) => {
        try {
            const subRec = record.load({
                type: record.Type.SUBSIDIARY,
                id: subsidiaryId
            });

            const logoId = subRec.getValue('logo');
            if (logoId) {
                const logoFile = file.load({ id: logoId });
                return logoFile.url;
            }

            return '';
        } catch (e) {
            log.debug('getSubsidiaryLogo', e.message);
            return '';
        }
    };

    // ==================== TEMPLATE FUNCTIONS ====================

    /**
     * Get PDF header template
     */
    const getHeader = (data, logoUrl) => {
        return `<?xml version="1.0"?>
<!DOCTYPE pdf PUBLIC "-//big.faceless.org//report" "report-1.1.dtd">
<pdf>
<head>
    <style type="text/css">
        body { font-family: Arial, sans-serif; font-size: 10pt; }
        .header { width: 100%; margin-bottom: 20px; }
        .logo { height: 60px; }
        .company-info { text-align: right; }
        .title { font-size: 18pt; font-weight: bold; color: #333; margin: 20px 0; }
        table.items { width: 100%; border-collapse: collapse; margin: 20px 0; }
        table.items th { background-color: #f0f0f0; padding: 8px; text-align: left; border-bottom: 2px solid #333; }
        table.items td { padding: 6px; border-bottom: 1px solid #ddd; }
        .total-row { font-weight: bold; background-color: #f9f9f9; }
        .address-block { width: 45%; vertical-align: top; }
        .footer { margin-top: 30px; font-size: 8pt; color: #666; text-align: center; }
    </style>
</head>
<body>
    <table class="header">
        <tr>
            <td style="width: 50%;">
                ${logoUrl ? `<img src="${logoUrl}" class="logo" />` : ''}
                <div><strong>${data.subsidiaryName}</strong></div>
            </td>
            <td class="company-info">
                <div class="title">SALES ORDER</div>
                <div><strong>Order #:</strong> ${data.tranId}</div>
                <div><strong>Date:</strong> ${data.tranDate}</div>
                ${data.poNumber ? `<div><strong>PO #:</strong> ${data.poNumber}</div>` : ''}
            </td>
        </tr>
    </table>

    <table style="width: 100%; margin: 15px 0;">
        <tr>
            <td class="address-block">
                <strong>Bill To:</strong><br/>
                <span>${escapeXml(data.billAddress || data.customerName)}</span>
            </td>
            <td class="address-block">
                <strong>Ship To:</strong><br/>
                <span>${escapeXml(data.shipAddress || 'Same as billing')}</span>
            </td>
        </tr>
    </table>

    <table style="width: 100%; margin-bottom: 15px;">
        <tr>
            <td><strong>Sales Rep:</strong> ${data.salesRep || 'N/A'}</td>
            <td><strong>Ship Date:</strong> ${data.shipDate || 'TBD'}</td>
            <td><strong>Ship Method:</strong> ${data.shipMethod || 'N/A'}</td>
        </tr>
    </table>
`;
    };

    /**
     * Get PDF body template with items
     */
    const getBody = (template, data) => {
        template += `
    <table class="items">
        <thead>
            <tr>
                <th style="width: 5%;">#</th>
                <th style="width: 30%;">Item</th>
                <th style="width: 30%;">Description</th>
                <th style="width: 10%; text-align: right;">Qty</th>
                <th style="width: 12%; text-align: right;">Rate</th>
                <th style="width: 13%; text-align: right;">Amount</th>
            </tr>
        </thead>
        <tbody>
`;

        data.items.forEach(item => {
            template += `
            <tr>
                <td>${item.line}</td>
                <td>${escapeXml(item.item)}</td>
                <td>${escapeXml(item.description)}</td>
                <td style="text-align: right;">${item.quantity}</td>
                <td style="text-align: right;">${item.rate}</td>
                <td style="text-align: right;">${item.amount}</td>
            </tr>
`;
        });

        template += `
        </tbody>
    </table>

    <table style="width: 40%; margin-left: 60%;">
        <tr>
            <td style="text-align: right;"><strong>Subtotal:</strong></td>
            <td style="text-align: right; width: 100px;">${data.subtotal}</td>
        </tr>
        ${parseFloat(data.discountTotal) !== 0 ? `
        <tr>
            <td style="text-align: right;"><strong>Discount:</strong></td>
            <td style="text-align: right;">${data.discountTotal}</td>
        </tr>
        ` : ''}
        <tr>
            <td style="text-align: right;"><strong>Tax:</strong></td>
            <td style="text-align: right;">${data.taxTotal}</td>
        </tr>
        ${parseFloat(data.shippingCost) !== 0 ? `
        <tr>
            <td style="text-align: right;"><strong>Shipping:</strong></td>
            <td style="text-align: right;">${data.shippingCost}</td>
        </tr>
        ` : ''}
        <tr class="total-row">
            <td style="text-align: right; font-size: 12pt;"><strong>TOTAL (${data.currency}):</strong></td>
            <td style="text-align: right; font-size: 12pt;"><strong>${data.total}</strong></td>
        </tr>
    </table>
`;

        if (data.memo) {
            template += `
    <div style="margin-top: 20px;">
        <strong>Notes:</strong><br/>
        <span>${escapeXml(data.memo)}</span>
    </div>
`;
        }

        return template;
    };

    /**
     * Get PDF footer template
     */
    const getFooter = (template, data) => {
        template += `
    <div class="footer">
        <p>Thank you for your business!</p>
        <p>Order #${data.tranId} | Generated: ${new Date().toLocaleString()}</p>
    </div>
</body>
</pdf>
`;
        return template;
    };

    /**
     * Render HTML to PDF and write to response
     */
    const finalPrint = (template, context) => {
        try {
            const renderer = render.create();
            renderer.templateContent = template;

            const xml = renderer.renderAsString();

            const pdfFile = render.xmlToPdf({
                xmlString: xml
            });

            context.response.writeFile({
                file: pdfFile,
                isInline: true
            });

        } catch (errFinalPrint) {
            log.error('errFinalPrint', errFinalPrint);
            throw errFinalPrint;
        }
    };

    // ==================== UTILITY FUNCTIONS ====================

    const formatDate = (date) => {
        if (!date) return '';
        return format.format({ value: date, type: format.Type.DATE });
    };

    const formatCurrency = (value) => {
        const num = parseFloat(value) || 0;
        return num.toFixed(2);
    };

    const escapeXml = (str) => {
        if (!str) return '';
        return str.toString()
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    };

    return { onRequest };
});
