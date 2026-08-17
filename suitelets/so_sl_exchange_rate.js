/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @NModuleScope SameAccount
 *
 * PURPOSE:
 * Fetches live exchange rates from external API and updates transaction
 *
 * PROBLEM SOLVED:
 * Before: Manual rate lookup, copy-paste errors, outdated rates
 * After: One-click rate fetch, auto-updates transaction, audit trail
 *
 * FEATURES:
 * - Popup form shows current vs new rate
 * - Fetches rate from external API
 * - Updates Sales Order with new rate on confirm
 */
define(['N/ui/serverWidget', 'N/record', 'N/https', 'N/redirect', 'N/search', 'N/format', 'N/log'],
    (serverWidget, record, https, redirect, search, format, log) => {

    const onRequest = (context) => {
        try {
            if (context.request.method === 'GET') {
                handleGet(context);
            } else {
                handlePost(context);
            }
        } catch (errOnRequest) {
            log.error('errOnRequest', errOnRequest);
            context.response.write(`<html><body><h2>Error</h2><p>${errOnRequest.message}</p></body></html>`);
        }
    };

    /**
     * Handle GET - Display form with current rate and date selector
     */
    const handleGet = (context) => {
        const recId = context.request.parameters.recId;

        if (!recId) {
            throw new Error('Record ID is required');
        }

        // Load current record data
        const soLookup = search.lookupFields({
            type: search.Type.SALES_ORDER,
            id: recId,
            columns: ['tranid', 'currency', 'exchangerate', 'trandate']
        });

        const currencyText = soLookup.currency[0] ? soLookup.currency[0].text : 'Unknown';
        const currentRate = soLookup.exchangerate || 1;

        // Create form
        const form = serverWidget.createForm({
            title: 'Update Exchange Rate'
        });

        // Add field group
        form.addFieldGroup({
            id: 'custpage_rate_group',
            label: 'Exchange Rate Information'
        });

        // Hidden record ID
        const recIdField = form.addField({
            id: 'custpage_rec_id',
            type: serverWidget.FieldType.TEXT,
            label: 'Record ID',
            container: 'custpage_rate_group'
        });
        recIdField.defaultValue = recId;
        recIdField.updateDisplayType({ displayType: serverWidget.FieldDisplayType.HIDDEN });

        // Order info (readonly)
        const orderField = form.addField({
            id: 'custpage_order_info',
            type: serverWidget.FieldType.TEXT,
            label: 'Order',
            container: 'custpage_rate_group'
        });
        orderField.defaultValue = `${soLookup.tranid} - ${currencyText}`;
        orderField.updateDisplayType({ displayType: serverWidget.FieldDisplayType.INLINE });

        // Current rate (readonly)
        const currentRateField = form.addField({
            id: 'custpage_current_rate',
            type: serverWidget.FieldType.FLOAT,
            label: 'Current Exchange Rate',
            container: 'custpage_rate_group'
        });
        currentRateField.defaultValue = currentRate;
        currentRateField.updateDisplayType({ displayType: serverWidget.FieldDisplayType.INLINE });

        // Rate date selector
        const rateDateField = form.addField({
            id: 'custpage_rate_date',
            type: serverWidget.FieldType.DATE,
            label: 'Rate Date',
            container: 'custpage_rate_group'
        });
        rateDateField.defaultValue = new Date();
        rateDateField.isMandatory = true;

        // New rate (manual entry option)
        const newRateField = form.addField({
            id: 'custpage_new_rate',
            type: serverWidget.FieldType.FLOAT,
            label: 'New Exchange Rate (Manual)',
            container: 'custpage_rate_group'
        });
        newRateField.setHelpText({ help: 'Leave blank to fetch from external API' });

        // Hidden currency code
        const currencyCode = form.addField({
            id: 'custpage_currency_code',
            type: serverWidget.FieldType.TEXT,
            label: 'Currency Code',
            container: 'custpage_rate_group'
        });
        currencyCode.defaultValue = currencyText;
        currencyCode.updateDisplayType({ displayType: serverWidget.FieldDisplayType.HIDDEN });

        // Buttons
        form.addSubmitButton({ label: 'Update Rate' });

        form.addButton({
            id: 'custpage_fetch_btn',
            label: 'Fetch from API',
            functionName: 'fetchFromApi'
        });

        form.addButton({
            id: 'custpage_cancel_btn',
            label: 'Cancel',
            functionName: 'closeWindow'
        });

        // Add client script
        form.clientScriptModulePath = '../client-scripts/so_cs_exchange_rate.js';

        context.response.writePage(form);
    };

    /**
     * Handle POST - Update the record with new exchange rate
     */
    const handlePost = (context) => {
        const params = context.request.parameters;
        const recId = params.custpage_rec_id;
        const rateDate = params.custpage_rate_date;
        let newRate = parseFloat(params.custpage_new_rate);
        const currencyCode = params.custpage_currency_code;

        // If no manual rate provided, fetch from API
        if (!newRate || isNaN(newRate)) {
            newRate = fetchExchangeRate(currencyCode, rateDate);
        }

        if (!newRate || newRate <= 0) {
            throw new Error('Invalid exchange rate');
        }

        // Update the Sales Order
        record.submitFields({
            type: record.Type.SALES_ORDER,
            id: recId,
            values: {
                exchangerate: newRate,
                custbody_exchange_rate_date: rateDate ? new Date(rateDate) : new Date(),
                custbody_exchange_rate_source: 'Manual/API Update'
            }
        });

        log.audit('Exchange Rate Updated', `SO ${recId}: Rate set to ${newRate}`);

        // Close popup and refresh parent
        context.response.write(`
            <html>
            <body>
                <script>
                    alert('Exchange rate updated to ${newRate}');
                    if (window.opener) {
                        window.opener.location.reload();
                    }
                    window.close();
                </script>
            </body>
            </html>
        `);
    };

    /**
     * Fetch exchange rate from external API, with a fallback to a small cached table
     * if the API call fails (network outage, rate limit, unsupported currency, etc.).
     * NOTE: exchangerate-api.com's free tier only returns *current* rates, not
     * historical ones for `rateDate` — for genuine historical rates you'd need a paid
     * tier or a different provider; this endpoint is used purely as a working example.
     */
    const fetchExchangeRate = (currencyCode, rateDate) => {
        const baseCurrency = 'USD';
        const targetCurrency = currencyCode.replace(/[^A-Z]/g, '').substring(0, 3);

        try {
            const response = https.get({
                url: `https://api.exchangerate-api.com/v4/latest/${baseCurrency}`
            });

            if (response.code === 200) {
                const data = JSON.parse(response.body);
                if (data.rates && data.rates[targetCurrency]) {
                    log.debug('fetchExchangeRate', `Live rate for ${targetCurrency}: ${data.rates[targetCurrency]}`);
                    return data.rates[targetCurrency];
                }
                log.debug('fetchExchangeRate', `${targetCurrency} not in API response, falling back to cache`);
            } else {
                log.debug('fetchExchangeRate', `API returned status ${response.code}, falling back to cache`);
            }
        } catch (errFetch) {
            log.error('fetchExchangeRate API call failed', errFetch);
        }

        // Fallback cached rates — used if the live API is unreachable or doesn't cover
        // the requested currency. Keep this list small; it's a safety net, not a source
        // of truth.
        const cachedRates = {
            'EUR': 0.92,
            'GBP': 0.79,
            'AED': 3.67,
            'SAR': 3.75,
            'EGP': 30.90
        };

        return cachedRates[targetCurrency] || 1;
    };

    return { onRequest };
});
