/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 * @NModuleScope SameAccount
 *
 * PURPOSE:
 * Synchronizes inventory levels across all locations
 *
 * PROBLEM SOLVED:
 * Before: Inventory discrepancies between locations, manual reconciliation
 * After: Automated nightly sync, location-level totals, sync status tracking
 *
 * FEATURES:
 * - Processes all inventory items modified since last sync
 * - Aggregates quantities by location
 * - Updates sync tracking records
 * - Handles large data volumes with governance checks
 */
define(['N/record', 'N/search', 'N/runtime', 'N/format', 'N/log'],
    (record, search, runtime, format, log) => {

    const getInputData = () => {
        const script = runtime.getCurrentScript();
        const lastRunDate = script.getParameter('custscript_last_sync_date');

        log.audit('getInputData', `Starting inventory sync. Last run: ${lastRunDate || 'First run'}`);

        // Build filters
        const filters = [
            ['isinactive', 'is', 'F'],
            'AND',
            ['type', 'anyof', 'InvtPart', 'Kit']
        ];

        // Only sync items modified since last run
        if (lastRunDate) {
            filters.push('AND', ['lastmodifieddate', 'onorafter', lastRunDate]);
        }

        return search.create({
            type: search.Type.ITEM,
            filters: filters,
            columns: [
                'internalid',
                'itemid',
                'displayname',
                'quantityavailable',
                'quantityonhand',
                'quantityonorder',
                search.createColumn({ name: 'location', join: 'inventoryLocation' })
            ]
        });
    };

    const map = (context) => {
        try {
            const searchResult = JSON.parse(context.value);
            const itemId = searchResult.id;
            const itemData = searchResult.values;

            // Get inventory details per location
            const inventoryDetails = getInventoryByLocation(itemId);

            // Group by location for reduce
            inventoryDetails.forEach(invDetail => {
                context.write({
                    key: invDetail.location,
                    value: {
                        itemId: itemId,
                        itemName: itemData.itemid,
                        available: invDetail.available,
                        onHand: invDetail.onHand,
                        onOrder: invDetail.onOrder
                    }
                });
            });

        } catch (errMap) {
            log.error('map Error', errMap);
        }
    };

    const reduce = (context) => {
        try {
            const locationId = context.key;
            const items = context.values.map(v => JSON.parse(v));

            // Calculate location totals
            const locationTotals = {
                locationId: locationId,
                itemCount: items.length,
                totalAvailable: items.reduce((sum, i) => sum + (parseFloat(i.available) || 0), 0),
                totalOnHand: items.reduce((sum, i) => sum + (parseFloat(i.onHand) || 0), 0),
                syncDate: new Date().toISOString()
            };

            // Update location sync record (custom record)
            updateLocationSyncRecord(locationTotals);

            context.write({
                key: 'locations',
                value: JSON.stringify(locationTotals)
            });

        } catch (errReduce) {
            log.error('reduce Error', errReduce);
        }
    };

    const summarize = (context) => {
        log.audit('summarize', 'Inventory sync complete');

        let locationsProcessed = 0;
        let totalItems = 0;

        context.output.iterator().each((key, value) => {
            if (key === 'locations') {
                const data = JSON.parse(value);
                locationsProcessed++;
                totalItems += data.itemCount;
            }
            return true;
        });

        // Log errors
        context.mapSummary.errors.iterator().each((key, error) => {
            log.error('Map Error', `${key}: ${error}`);
            return true;
        });

        log.audit('Sync Summary', {
            locationsProcessed: locationsProcessed,
            itemsProcessed: totalItems,
            duration: context.mapSummary.seconds + context.reduceSummary.seconds
        });

        // Advance the incremental-sync watermark so the next run only picks up items
        // modified since this run. Without this, custscript_last_sync_date never moves
        // and every run either reprocesses the whole catalog or requires a manual reset.
        advanceLastSyncDate();
    };

    const advanceLastSyncDate = () => {
        try {
            const script = runtime.getCurrentScript();
            record.submitFields({
                type: 'scriptdeployment',
                id: script.deploymentId,
                values: { 'custscript_last_sync_date': new Date() }
            });
        } catch (e) {
            // Non-fatal: worst case the next run re-scans a wider date range.
            log.error('advanceLastSyncDate', e.message);
        }
    };

    // ==================== HELPERS ====================

    const getInventoryByLocation = (itemId) => {
        const results = [];
        
        const invSearch = search.create({
            type: 'inventorybalance',
            filters: [['item', 'is', itemId]],
            columns: ['location', 'available', 'onhand', 'quantityonorder']
        });

        invSearch.run().each(result => {
            results.push({
                location: result.getValue('location'),
                available: result.getValue('available'),
                onHand: result.getValue('onhand'),
                onOrder: result.getValue('quantityonorder')
            });
            return true;
        });

        return results;
    };

    const updateLocationSyncRecord = (totals) => {
        try {
            // Update or create sync tracking record
            const existingSearch = search.create({
                type: 'customrecord_location_sync',
                filters: [['custrecord_sync_location', 'is', totals.locationId]],
                columns: ['internalid']
            });

            let recordId = null;
            existingSearch.run().each(result => {
                recordId = result.id;
                return false;
            });

            const fieldValues = {
                'custrecord_sync_location': totals.locationId,
                'custrecord_sync_item_count': totals.itemCount,
                'custrecord_sync_total_available': totals.totalAvailable,
                'custrecord_sync_date': new Date()
            };

            if (recordId) {
                record.submitFields({
                    type: 'customrecord_location_sync',
                    id: recordId,
                    values: fieldValues
                });
            } else {
                // No sync record exists yet for this location — create one instead of
                // silently doing nothing (this used to only handle the update case).
                const syncRecord = record.create({ type: 'customrecord_location_sync' });
                Object.keys(fieldValues).forEach(fieldId => {
                    syncRecord.setValue({ fieldId, value: fieldValues[fieldId] });
                });
                syncRecord.save();
            }

        } catch (e) {
            log.error('updateLocationSyncRecord', e.message);
        }
    };

    return { getInputData, map, reduce, summarize };
});
