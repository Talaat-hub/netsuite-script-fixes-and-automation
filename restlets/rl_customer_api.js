/**
 * @NApiVersion 2.1
 * @NScriptType Restlet
 * @NModuleScope SameAccount
 *
 * PURPOSE:
 * RESTlet API for external systems to manage customer data in NetSuite
 *
 * PROBLEM SOLVED:
 * Before: External systems couldn't access NetSuite customer data, manual data entry required
 * After: Real-time customer sync, automated data flow, single source of truth
 *
 * ENDPOINTS:
 * - GET: Retrieve customer by ID or search by email
 * - POST: Create new customer
 * - PUT: Update existing customer
 * - DELETE: Deactivate customer (soft delete)
 *
 * AUTHENTICATION:
 * Uses NetSuite Token-Based Authentication (TBA)
 */
define(['N/record', 'N/search', 'N/log'], (record, search, log) => {

    /**
     * GET - Retrieve customer data
     * @param {Object} requestParams - { id: number } or { email: string }
     */
    const get = (requestParams) => {
        try {
            log.audit('GET Request', JSON.stringify(requestParams));

            if (requestParams.id) {
                return getCustomerById(requestParams.id);
            } else if (requestParams.email) {
                return getCustomerByEmail(requestParams.email);
            } else {
                return createErrorResponse(400, 'Missing required parameter: id or email');
            }

        } catch (e) {
            log.error('GET Error', e.message);
            return createErrorResponse(500, e.message);
        }
    };

    /**
     * POST - Create new customer
     * @param {Object} requestBody - Customer data
     */
    const post = (requestBody) => {
        try {
            log.audit('POST Request', JSON.stringify(requestBody));

            // Validate required fields
            if (!requestBody.companyname && !requestBody.firstname) {
                return createErrorResponse(400, 'Missing required field: companyname or firstname');
            }

            if (!requestBody.email) {
                return createErrorResponse(400, 'Missing required field: email');
            }

            // Check if customer already exists
            const existing = getCustomerByEmail(requestBody.email);
            if (existing.success && existing.data) {
                return createErrorResponse(409, 'Customer with this email already exists', {
                    existingId: existing.data.id
                });
            }

            // Create customer record
            const customer = record.create({
                type: record.Type.CUSTOMER,
                isDynamic: true
            });

            // Set fields
            if (requestBody.companyname) {
                customer.setValue({ fieldId: 'companyname', value: requestBody.companyname });
                customer.setValue({ fieldId: 'isperson', value: 'F' });
            } else {
                customer.setValue({ fieldId: 'isperson', value: 'T' });
                customer.setValue({ fieldId: 'firstname', value: requestBody.firstname });
                customer.setValue({ fieldId: 'lastname', value: requestBody.lastname || '' });
            }

            customer.setValue({ fieldId: 'email', value: requestBody.email });

            if (requestBody.phone) {
                customer.setValue({ fieldId: 'phone', value: requestBody.phone });
            }

            if (requestBody.subsidiary) {
                customer.setValue({ fieldId: 'subsidiary', value: requestBody.subsidiary });
            }

            // Set address if provided
            if (requestBody.address) {
                customer.selectNewLine({ sublistId: 'addressbook' });
                customer.setCurrentSublistValue({
                    sublistId: 'addressbook',
                    fieldId: 'defaultbilling',
                    value: true
                });

                const addressSubrecord = customer.getCurrentSublistSubrecord({
                    sublistId: 'addressbook',
                    fieldId: 'addressbookaddress'
                });

                if (requestBody.address.addr1) {
                    addressSubrecord.setValue({ fieldId: 'addr1', value: requestBody.address.addr1 });
                }
                if (requestBody.address.city) {
                    addressSubrecord.setValue({ fieldId: 'city', value: requestBody.address.city });
                }
                if (requestBody.address.state) {
                    addressSubrecord.setValue({ fieldId: 'state', value: requestBody.address.state });
                }
                if (requestBody.address.zip) {
                    addressSubrecord.setValue({ fieldId: 'zip', value: requestBody.address.zip });
                }
                if (requestBody.address.country) {
                    addressSubrecord.setValue({ fieldId: 'country', value: requestBody.address.country });
                }

                customer.commitLine({ sublistId: 'addressbook' });
            }

            const customerId = customer.save({
                enableSourcing: true,
                ignoreMandatoryFields: false
            });

            log.audit('Customer Created', customerId);

            return {
                success: true,
                message: 'Customer created successfully',
                data: { id: customerId }
            };

        } catch (e) {
            log.error('POST Error', e.message);
            return createErrorResponse(500, e.message);
        }
    };

    /**
     * PUT - Update existing customer
     * @param {Object} requestBody - { id: number, ...fieldsToUpdate }
     */
    const put = (requestBody) => {
        try {
            log.audit('PUT Request', JSON.stringify(requestBody));

            if (!requestBody.id) {
                return createErrorResponse(400, 'Missing required field: id');
            }

            const customer = record.load({
                type: record.Type.CUSTOMER,
                id: requestBody.id,
                isDynamic: true
            });

            // Update fields if provided
            const editableFields = ['companyname', 'firstname', 'lastname', 'email', 'phone', 'comments'];
            
            editableFields.forEach(field => {
                if (requestBody[field] !== undefined) {
                    customer.setValue({ fieldId: field, value: requestBody[field] });
                }
            });

            customer.save({
                enableSourcing: true,
                ignoreMandatoryFields: false
            });

            log.audit('Customer Updated', requestBody.id);

            return {
                success: true,
                message: 'Customer updated successfully',
                data: { id: requestBody.id }
            };

        } catch (e) {
            log.error('PUT Error', e.message);
            return createErrorResponse(500, e.message);
        }
    };

    /**
     * DELETE - Deactivate customer (soft delete)
     * @param {Object} requestParams - { id: number }
     */
    const doDelete = (requestParams) => {
        try {
            log.audit('DELETE Request', JSON.stringify(requestParams));

            if (!requestParams.id) {
                return createErrorResponse(400, 'Missing required parameter: id');
            }

            record.submitFields({
                type: record.Type.CUSTOMER,
                id: requestParams.id,
                values: { isinactive: true }
            });

            log.audit('Customer Deactivated', requestParams.id);

            return {
                success: true,
                message: 'Customer deactivated successfully',
                data: { id: requestParams.id }
            };

        } catch (e) {
            log.error('DELETE Error', e.message);
            return createErrorResponse(500, e.message);
        }
    };

    // ==================== HELPER FUNCTIONS ====================

    const getCustomerById = (customerId) => {
        try {
            const customer = record.load({
                type: record.Type.CUSTOMER,
                id: customerId
            });

            return {
                success: true,
                data: {
                    id: customer.id,
                    entityid: customer.getValue('entityid'),
                    companyname: customer.getValue('companyname'),
                    firstname: customer.getValue('firstname'),
                    lastname: customer.getValue('lastname'),
                    email: customer.getValue('email'),
                    phone: customer.getValue('phone'),
                    balance: customer.getValue('balance'),
                    creditlimit: customer.getValue('creditlimit'),
                    isinactive: customer.getValue('isinactive')
                }
            };

        } catch (e) {
            return createErrorResponse(404, 'Customer not found');
        }
    };

    const getCustomerByEmail = (email) => {
        const customerSearch = search.create({
            type: search.Type.CUSTOMER,
            filters: [['email', 'is', email]],
            columns: ['internalid', 'entityid', 'companyname', 'firstname', 'lastname', 'email', 'phone', 'balance']
        });

        let customerData = null;

        customerSearch.run().each(result => {
            customerData = {
                id: result.id,
                entityid: result.getValue('entityid'),
                companyname: result.getValue('companyname'),
                firstname: result.getValue('firstname'),
                lastname: result.getValue('lastname'),
                email: result.getValue('email'),
                phone: result.getValue('phone'),
                balance: result.getValue('balance')
            };
            return false;
        });

        if (customerData) {
            return { success: true, data: customerData };
        } else {
            return createErrorResponse(404, 'Customer not found');
        }
    };

    const createErrorResponse = (code, message, additionalData = {}) => {
        return {
            success: false,
            error: {
                code: code,
                message: message,
                ...additionalData
            }
        };
    };

    return {
        get: get,
        post: post,
        put: put,
        delete: doDelete
    };
});
