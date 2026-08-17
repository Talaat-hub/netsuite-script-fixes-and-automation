/**
 * @NApiVersion 2.1
 * @NScriptType Restlet
 * @NModuleScope SameAccount
 *
 * PURPOSE:
 * RESTlet API for external systems to query inventory levels in real-time
 *
 * PROBLEM SOLVED:
 * Before: E-commerce site showing wrong stock levels, overselling, customer complaints
 * After: Real-time inventory sync, accurate availability, no overselling
 *
 * ENDPOINTS:
 * - GET: Query inventory by item ID, SKU, or location
 * - POST: Bulk inventory query (multiple items at once)
 *
 * USE CASE:
 * E-commerce platform calls this API before showing "Add to Cart" button
 * to ensure item is actually in stock
 */
define(['N/search', 'N/log'], (search, log) => {

    /**
     * GET - Single item inventory lookup
     * @param {Object} params - { itemId, sku, location }
     */
    const get = (params) => {
        try {
            log.audit('Inventory GET', JSON.stringify(params));

            if (params.itemId) {
                return getInventoryByItemId(params.itemId, params.location);
            } else if (params.sku) {
                return getInventoryBySku(params.sku, params.location);
            } else {
                return {
                    success: false,
                    error: { code: 400, message: 'Missing required parameter: itemId or sku' }
                };
            }

        } catch (e) {
            log.error('Inventory GET Error', e.message);
            return { success: false, error: { code: 500, message: e.message } };
        }
    };

    /**
     * POST - Bulk inventory lookup
     * @param {Object} body - { items: [{ itemId or sku }], location }
     */
    const post = (body) => {
        try {
            log.audit('Inventory POST', JSON.stringify(body));

            if (!body.items || !Array.isArray(body.items)) {
                return {
                    success: false,
                    error: { code: 400, message: 'Missing required field: items (array)' }
                };
            }

            const results = [];

            body.items.forEach(item => {
                let inventoryData;
                
                if (item.itemId) {
                    inventoryData = getInventoryByItemId(item.itemId, body.location);
                } else if (item.sku) {
                    inventoryData = getInventoryBySku(item.sku, body.location);
                } else {
                    inventoryData = {
                        success: false,
                        error: { message: 'Missing itemId or sku' }
                    };
                }

                results.push({
                    request: item,
                    response: inventoryData
                });
            });

            return {
                success: true,
                data: {
                    itemCount: results.length,
                    items: results
                }
            };

        } catch (e) {
            log.error('Inventory POST Error', e.message);
            return { success: false, error: { code: 500, message: e.message } };
        }
    };

    // ==================== HELPER FUNCTIONS ====================

    const getInventoryByItemId = (itemId, locationId) => {
        const filters = [['internalid', 'is', itemId]];
        return queryInventory(filters, locationId);
    };

    const getInventoryBySku = (sku, locationId) => {
        const filters = [['itemid', 'is', sku]];
        return queryInventory(filters, locationId);
    };

    const queryInventory = (itemFilters, locationId) => {
        // First get item details
        const itemSearch = search.create({
            type: search.Type.ITEM,
            filters: itemFilters,
            columns: [
                'internalid',
                'itemid',
                'displayname',
                'type',
                'isinactive'
            ]
        });

        let itemData = null;
        itemSearch.run().each(result => {
            itemData = {
                id: result.getValue('internalid'),
                sku: result.getValue('itemid'),
                name: result.getValue('displayname'),
                type: result.getText('type'),
                isActive: result.getValue('isinactive') !== 'T'
            };
            return false;
        });

        if (!itemData) {
            return {
                success: false,
                error: { code: 404, message: 'Item not found' }
            };
        }

        // Now get inventory levels
        const invFilters = [['item', 'is', itemData.id]];
        if (locationId) {
            invFilters.push('AND', ['location', 'is', locationId]);
        }

        const inventorySearch = search.create({
            type: 'inventorybalance',
            filters: invFilters,
            columns: [
                'location',
                'quantityonhand',
                'quantityavailable',
                'quantityonorder',
                'quantitycommitted'
            ]
        });

        const locations = [];
        let totalOnHand = 0;
        let totalAvailable = 0;

        inventorySearch.run().each(result => {
            const onHand = parseFloat(result.getValue('quantityonhand')) || 0;
            const available = parseFloat(result.getValue('quantityavailable')) || 0;
            const onOrder = parseFloat(result.getValue('quantityonorder')) || 0;
            const committed = parseFloat(result.getValue('quantitycommitted')) || 0;

            locations.push({
                locationId: result.getValue('location'),
                locationName: result.getText('location'),
                onHand: onHand,
                available: available,
                onOrder: onOrder,
                committed: committed
            });

            totalOnHand += onHand;
            totalAvailable += available;

            return true;
        });

        return {
            success: true,
            data: {
                item: itemData,
                inventory: {
                    totalOnHand: totalOnHand,
                    totalAvailable: totalAvailable,
                    inStock: totalAvailable > 0,
                    locations: locations
                },
                timestamp: new Date().toISOString()
            }
        };
    };

    return { get, post };
});
