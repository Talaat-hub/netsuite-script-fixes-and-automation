/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 * @NModuleScope SameAccount
 * 
 * @description Data Sync Map/Reduce - Syncs inventory levels across locations
 * 
 * Example of Map/Reduce with chunked processing for large data sets
 */
define(['N/record', 'N/search', 'N/runtime', 'N/format', 'N/https', 'N/log'], 
    (record, search, runtime, format, https, log) => {

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

            if (recordId) {
                record.submitFields({
                    type: 'customrecord_location_sync',
                    id: recordId,
                    values: {
                        'custrecord_sync_item_count': totals.itemCount,
                        'custrecord_sync_total_available': totals.totalAvailable,
                        'custrecord_sync_date': new Date()
                    }
                });
            }

        } catch (e) {
            log.debug('updateLocationSyncRecord', e.message);
        }
    };

    return { getInputData, map, reduce, summarize };
});
