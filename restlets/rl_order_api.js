/**
 * @NApiVersion 2.1
 * @NScriptType Restlet
 * @NModuleScope SameAccount
 *
 * PURPOSE:
 * RESTlet API for external systems to create and manage orders in NetSuite
 *
 * PROBLEM SOLVED:
 * Before: Orders from e-commerce/EDI entered manually, delays, errors, missed orders
 * After: Automated order creation, real-time status updates, zero manual entry
 *
 * ENDPOINTS:
 * - GET: Retrieve order details and status
 * - POST: Create new Sales Order from external order data
 * - PUT: Update order status
 *
 * USE CASE:
 * Shopify/WooCommerce webhook sends order data → This API creates Sales Order in NetSuite
 */
define(['N/record', 'N/search', 'N/log', 'N/format'], (record, search, log, format) => {

    /**
     * GET - Retrieve order details
     * @param {Object} params - { orderId } or { externalId }
     */
    const get = (params) => {
        try {
            log.audit('Order GET', JSON.stringify(params));

            let orderId = params.orderId;

            // If external ID provided, look up internal ID
            if (params.externalId && !orderId) {
                orderId = findOrderByExternalId(params.externalId);
                if (!orderId) {
                    return createError(404, 'Order not found with external ID: ' + params.externalId);
                }
            }

            if (!orderId) {
                return createError(400, 'Missing required parameter: orderId or externalId');
            }

            return getOrderDetails(orderId);

        } catch (e) {
            log.error('Order GET Error', e.message);
            return createError(500, e.message);
        }
    };

    /**
     * POST - Create new Sales Order
     * @param {Object} body - Order data from external system
     */
    const post = (body) => {
        try {
            log.audit('Order POST', JSON.stringify(body));

            // Validate required fields
            const validation = validateOrderData(body);
            if (!validation.valid) {
                return createError(400, validation.message);
            }

            // Check for duplicate order
            if (body.externalId) {
                const existingOrder = findOrderByExternalId(body.externalId);
                if (existingOrder) {
                    return createError(409, 'Order already exists', { existingOrderId: existingOrder });
                }
            }

            // Find or create customer
            let customerId = body.customerId;
            if (!customerId && body.customer) {
                customerId = findOrCreateCustomer(body.customer);
            }

            if (!customerId) {
                return createError(400, 'Could not determine customer. Provide customerId or customer object.');
            }

            // Create Sales Order
            const salesOrder = record.create({
                type: record.Type.SALES_ORDER,
                isDynamic: true
            });

            // Set header fields
            salesOrder.setValue({ fieldId: 'entity', value: customerId });

            if (body.externalId) {
                salesOrder.setValue({ fieldId: 'otherrefnum', value: body.externalId });
                salesOrder.setValue({ fieldId: 'custbody_external_order_id', value: body.externalId });
            }

            if (body.orderDate) {
                const orderDate = format.parse({ value: body.orderDate, type: format.Type.DATE });
                salesOrder.setValue({ fieldId: 'trandate', value: orderDate });
            }

            if (body.memo) {
                salesOrder.setValue({ fieldId: 'memo', value: body.memo });
            }

            if (body.shipMethod) {
                salesOrder.setValue({ fieldId: 'shipmethod', value: body.shipMethod });
            }

            // Add line items
            body.items.forEach(item => {
                salesOrder.selectNewLine({ sublistId: 'item' });

                // Find item by SKU or use item ID
                const itemId = item.itemId || findItemBySku(item.sku);
                if (!itemId) {
                    throw new Error('Item not found: ' + (item.sku || item.itemId));
                }

                salesOrder.setCurrentSublistValue({
                    sublistId: 'item',
                    fieldId: 'item',
                    value: itemId
                });

                salesOrder.setCurrentSublistValue({
                    sublistId: 'item',
                    fieldId: 'quantity',
                    value: item.quantity
                });

                if (item.rate) {
                    salesOrder.setCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'rate',
                        value: item.rate
                    });
                }

                if (item.description) {
                    salesOrder.setCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'description',
                        value: item.description
                    });
                }

                salesOrder.commitLine({ sublistId: 'item' });
            });

            // Set shipping address if provided
            if (body.shippingAddress) {
                setShippingAddress(salesOrder, body.shippingAddress);
            }

            const orderId = salesOrder.save({
                enableSourcing: true,
                ignoreMandatoryFields: false
            });

            log.audit('Order Created', orderId);

            // Return created order details
            return {
                success: true,
                message: 'Sales Order created successfully',
                data: {
                    orderId: orderId,
                    externalId: body.externalId,
                    total: salesOrder.getValue('total')
                }
            };

        } catch (e) {
            log.error('Order POST Error', e.message);
            return createError(500, e.message);
        }
    };

    /**
     * PUT - Update order status
     * @param {Object} body - { orderId, status, tracking }
     */
    const put = (body) => {
        try {
            log.audit('Order PUT', JSON.stringify(body));

            if (!body.orderId) {
                return createError(400, 'Missing required field: orderId');
            }

            const updates = {};

            if (body.status) {
                updates['orderstatus'] = body.status;
            }

            if (body.tracking) {
                updates['custbody_tracking_number'] = body.tracking;
            }

            if (body.memo) {
                updates['memo'] = body.memo;
            }

            if (Object.keys(updates).length === 0) {
                return createError(400, 'No fields to update');
            }

            record.submitFields({
                type: record.Type.SALES_ORDER,
                id: body.orderId,
                values: updates
            });

            log.audit('Order Updated', body.orderId);

            return {
                success: true,
                message: 'Order updated successfully',
                data: { orderId: body.orderId }
            };

        } catch (e) {
            log.error('Order PUT Error', e.message);
            return createError(500, e.message);
        }
    };

    // ==================== HELPER FUNCTIONS ====================

    const validateOrderData = (data) => {
        if (!data.items || !Array.isArray(data.items) || data.items.length === 0) {
            return { valid: false, message: 'Missing required field: items (non-empty array)' };
        }

        for (let i = 0; i < data.items.length; i++) {
            const item = data.items[i];
            if (!item.itemId && !item.sku) {
                return { valid: false, message: `Item ${i + 1}: Missing itemId or sku` };
            }
            if (!item.quantity || item.quantity <= 0) {
                return { valid: false, message: `Item ${i + 1}: Invalid quantity` };
            }
        }

        return { valid: true };
    };

    const findOrderByExternalId = (externalId) => {
        const orderSearch = search.create({
            type: search.Type.SALES_ORDER,
            filters: [['otherrefnum', 'is', externalId]],
            columns: ['internalid']
        });

        let orderId = null;
        orderSearch.run().each(result => {
            orderId = result.id;
            return false;
        });

        return orderId;
    };

    const getOrderDetails = (orderId) => {
        try {
            const order = record.load({
                type: record.Type.SALES_ORDER,
                id: orderId
            });

            const items = [];
            const lineCount = order.getLineCount({ sublistId: 'item' });

            for (let i = 0; i < lineCount; i++) {
                items.push({
                    item: order.getSublistText({ sublistId: 'item', fieldId: 'item', line: i }),
                    quantity: order.getSublistValue({ sublistId: 'item', fieldId: 'quantity', line: i }),
                    rate: order.getSublistValue({ sublistId: 'item', fieldId: 'rate', line: i }),
                    amount: order.getSublistValue({ sublistId: 'item', fieldId: 'amount', line: i })
                });
            }

            return {
                success: true,
                data: {
                    orderId: order.id,
                    tranId: order.getValue('tranid'),
                    externalId: order.getValue('otherrefnum'),
                    customer: order.getText('entity'),
                    status: order.getText('orderstatus'),
                    orderDate: order.getValue('trandate'),
                    subtotal: order.getValue('subtotal'),
                    total: order.getValue('total'),
                    items: items
                }
            };

        } catch (e) {
            return createError(404, 'Order not found');
        }
    };

    const findOrCreateCustomer = (customerData) => {
        // Try to find by email first
        if (customerData.email) {
            const customerSearch = search.create({
                type: search.Type.CUSTOMER,
                filters: [['email', 'is', customerData.email]],
                columns: ['internalid']
            });

            let customerId = null;
            customerSearch.run().each(result => {
                customerId = result.id;
                return false;
            });

            if (customerId) return customerId;
        }

        // Create new customer
        const customer = record.create({
            type: record.Type.CUSTOMER,
            isDynamic: true
        });

        if (customerData.companyname) {
            customer.setValue({ fieldId: 'companyname', value: customerData.companyname });
            customer.setValue({ fieldId: 'isperson', value: 'F' });
        } else {
            customer.setValue({ fieldId: 'isperson', value: 'T' });
            customer.setValue({ fieldId: 'firstname', value: customerData.firstname || 'Guest' });
            customer.setValue({ fieldId: 'lastname', value: customerData.lastname || 'Customer' });
        }

        if (customerData.email) {
            customer.setValue({ fieldId: 'email', value: customerData.email });
        }

        return customer.save();
    };

    const findItemBySku = (sku) => {
        const itemSearch = search.create({
            type: search.Type.ITEM,
            filters: [['itemid', 'is', sku]],
            columns: ['internalid']
        });

        let itemId = null;
        itemSearch.run().each(result => {
            itemId = result.id;
            return false;
        });

        return itemId;
    };

    const setShippingAddress = (order, address) => {
        // Simplified - would set shipping address in real implementation
        log.debug('Shipping Address', JSON.stringify(address));
    };

    const createError = (code, message, data = {}) => {
        return {
            success: false,
            error: { code, message, ...data }
        };
    };

    return { get, post, put };
});
