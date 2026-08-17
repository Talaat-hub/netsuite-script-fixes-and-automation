/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 * @NModuleScope SameAccount
 *
 * PURPOSE:
 * Client-side controller for the Update Exchange Rate popup (suitelets/so_sl_exchange_rate.js).
 * Loaded via that Suitelet's `form.clientScriptModulePath` — it is not deployed on its
 * own and has no script/deployment record of its own.
 *
 * PROBLEM SOLVED:
 * Before: The "Fetch from API" and "Cancel" buttons on the exchange rate popup had no
 * client script backing them, so both buttons were dead on click.
 * After: "Fetch from API" clears the manual-rate field and submits so the server picks
 * up a live/cached rate; "Cancel" closes the popup without saving.
 *
 * FEATURES:
 * - fetchFromApi(): clears any manually-typed rate and submits the form, so
 *   suitelets/so_sl_exchange_rate.js's handlePost() falls through to fetchExchangeRate().
 * - closeWindow(): closes the popup without submitting.
 */
define(['N/currentRecord'], () => {

    /**
     * Called by the "Fetch from API" button. The rate lookup itself happens
     * server-side in the Suitelet, so this just clears any manual entry and submits.
     */
    const fetchFromApi = () => {
        try {
            const manualRateField = document.getElementById('custpage_new_rate');
            if (manualRateField) {
                manualRateField.value = '';
            }

            const form = document.forms[0];
            if (form) {
                form.submit();
            }
        } catch (errFetchFromApi) {
            console.error('errFetchFromApi', errFetchFromApi);
            alert('Error requesting rate from API: ' + errFetchFromApi.message);
        }
    };

    /**
     * Called by the "Cancel" button. Closes the popup without updating the record.
     */
    const closeWindow = () => {
        window.close();
    };

    // Expose to window so the Suitelet's addButton functionName calls can reach them
    if (typeof window !== 'undefined') {
        window.fetchFromApi = fetchFromApi;
        window.closeWindow = closeWindow;
    }

    return {
        fetchFromApi,
        closeWindow
    };
});
