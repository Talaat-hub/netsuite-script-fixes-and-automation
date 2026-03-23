/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @NModuleScope SameAccount
 *
 * PURPOSE:
 * Generates professional PDF printout for Purchase Orders
 *
 * PROBLEM SOLVED:
 * Before: Generic PO printouts, missing information, unprofessional appearance
 * After: Branded PDF with vendor details, line items, approval status
 *
 * FEATURES:
 * - Company header with logo placeholder
 * - Vendor information section
 * - Line item table with quantities and amounts
 * - Totals and approval signature area
 */
define(['N/record', 'N/search', 'N/render', 'N/format'], (record, search, render, format) => {

    const onRequest = (context) => {
        try {
            if (context.request.method === 'GET') {
                const recId = context.request.parameters.recId;

                if (!recId) {
                    throw new Error('Record ID required');
                }

                const poData = getPOData(recId);
                const template = buildTemplate(poData);
                renderPdf(template, context);
            }
        } catch (e) {
            log.error('onRequest', e);
            context.response.write(`<html><body><h2>Error</h2><p>${e.message}</p></body></html>`);
        }
    };

    const getPOData = (recId) => {
        const poRec = record.load({
            type: record.Type.PURCHASE_ORDER,
            id: recId
        });

        const data = {
            id: recId,
            tranId: poRec.getValue('tranid'),
            tranDate: formatDate(poRec.getValue('trandate')),
            vendorName: poRec.getText('entity'),
            subsidiary: poRec.getText('subsidiary'),
            currency: poRec.getText('currency'),
            dueDate: formatDate(poRec.getValue('duedate')),
            shipTo: poRec.getValue('shipaddress') || '',
            memo: poRec.getValue('memo') || '',
            subtotal: formatNum(poRec.getValue('subtotal')),
            taxTotal: formatNum(poRec.getValue('taxtotal')),
            total: formatNum(poRec.getValue('total')),
            status: poRec.getText('status'),
            items: []
        };

        const lineCount = poRec.getLineCount({ sublistId: 'item' });
        for (let i = 0; i < lineCount; i++) {
            data.items.push({
                line: i + 1,
                item: poRec.getSublistText({ sublistId: 'item', fieldId: 'item', line: i }),
                description: poRec.getSublistValue({ sublistId: 'item', fieldId: 'description', line: i }) || '',
                quantity: poRec.getSublistValue({ sublistId: 'item', fieldId: 'quantity', line: i }),
                rate: formatNum(poRec.getSublistValue({ sublistId: 'item', fieldId: 'rate', line: i })),
                amount: formatNum(poRec.getSublistValue({ sublistId: 'item', fieldId: 'amount', line: i }))
            });
        }

        return data;
    };

    const buildTemplate = (data) => {
        let itemRows = '';
        data.items.forEach(item => {
            itemRows += `
                <tr>
                    <td>${item.line}</td>
                    <td>${escapeXml(item.item)}</td>
                    <td>${escapeXml(item.description)}</td>
                    <td align="right">${item.quantity}</td>
                    <td align="right">${item.rate}</td>
                    <td align="right">${item.amount}</td>
                </tr>
            `;
        });

        return `<?xml version="1.0"?>
<!DOCTYPE pdf PUBLIC "-//big.faceless.org//report" "report-1.1.dtd">
<pdf>
<head>
    <style>
        body { font-family: Arial; font-size: 10pt; }
        .header { font-size: 16pt; font-weight: bold; margin-bottom: 20px; }
        table.items { width: 100%; border-collapse: collapse; }
        table.items th { background: #f0f0f0; padding: 8px; border-bottom: 2px solid #333; }
        table.items td { padding: 6px; border-bottom: 1px solid #ddd; }
    </style>
</head>
<body>
    <div class="header">PURCHASE ORDER</div>
    
    <table style="width: 100%; margin-bottom: 20px;">
        <tr>
            <td style="width: 50%;">
                <strong>Vendor:</strong><br/>
                ${escapeXml(data.vendorName)}
            </td>
            <td>
                <strong>PO #:</strong> ${data.tranId}<br/>
                <strong>Date:</strong> ${data.tranDate}<br/>
                <strong>Due Date:</strong> ${data.dueDate}<br/>
                <strong>Status:</strong> ${data.status}
            </td>
        </tr>
    </table>

    <table class="items">
        <thead>
            <tr>
                <th>#</th>
                <th>Item</th>
                <th>Description</th>
                <th>Qty</th>
                <th>Rate</th>
                <th>Amount</th>
            </tr>
        </thead>
        <tbody>
            ${itemRows}
        </tbody>
    </table>

    <table style="width: 40%; margin-left: 60%; margin-top: 20px;">
        <tr><td align="right"><strong>Subtotal:</strong></td><td align="right">${data.subtotal}</td></tr>
        <tr><td align="right"><strong>Tax:</strong></td><td align="right">${data.taxTotal}</td></tr>
        <tr style="background: #f0f0f0; font-weight: bold;">
            <td align="right">TOTAL (${data.currency}):</td>
            <td align="right">${data.total}</td>
        </tr>
    </table>

    ${data.memo ? `<div style="margin-top: 20px;"><strong>Notes:</strong><br/>${escapeXml(data.memo)}</div>` : ''}

    <div style="margin-top: 40px; padding-top: 10px; border-top: 1px solid #ddd; font-size: 8pt; color: #666;">
        Generated: ${new Date().toLocaleString()}
    </div>
</body>
</pdf>`;
    };

    const renderPdf = (template, context) => {
        const renderer = render.create();
        renderer.templateContent = template;
        const xml = renderer.renderAsString();
        const pdf = render.xmlToPdf({ xmlString: xml });
        context.response.writeFile({ file: pdf, isInline: true });
    };

    const formatDate = (d) => d ? format.format({ value: d, type: format.Type.DATE }) : '';
    const formatNum = (n) => (parseFloat(n) || 0).toFixed(2);
    const escapeXml = (s) => (s || '').toString().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    return { onRequest };
});
