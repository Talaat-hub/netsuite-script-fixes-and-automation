# NetSuite RESTlet API - Postman Collection

This folder contains Postman collections and environments for testing NetSuite RESTlet APIs.

## Files

| File | Description |
|------|-------------|
| `NetSuite_RESTlet_Collection.postman_collection.json` | Complete API collection with all endpoints |
| `NetSuite_RESTlet_Environment.postman_environment.json` | Environment variables template |

## Quick Start

### 1. Import into Postman

1. Open Postman
2. Click **Import** button
3. Drag both JSON files or select them
4. Collection and Environment will be imported

### 2. Configure Environment

1. Go to **Environments** in Postman
2. Select **NetSuite RESTlet Environment**
3. Fill in your credentials:

| Variable | Where to Find |
|----------|---------------|
| `ns_account_id` | Setup > Company > Company Information |
| `ns_consumer_key` | Setup > Integration > Manage Integrations > Your Integration |
| `ns_consumer_secret` | Shown once when creating integration |
| `ns_token_id` | Setup > Users/Roles > Access Tokens |
| `ns_token_secret` | Shown once when creating token |
| `ns_restlet_url` | Format: `https://ACCOUNTID.restlets.api.netsuite.com/app/site/hosting/restlet.nl` |

### 3. Deploy RESTlets in NetSuite

Before testing, deploy the RESTlet scripts from `/restlets/` folder:

1. Upload scripts to File Cabinet (SuiteScripts folder)
2. Create Script Records (Customization > Scripting > Scripts)
3. Create Script Deployments with appropriate roles

**Script IDs to use:**
- `customscript_rl_customer_api` / `customdeploy_rl_customer_api`
- `customscript_rl_inventory_api` / `customdeploy_rl_inventory_api`
- `customscript_rl_order_api` / `customdeploy_rl_order_api`

### 4. Test the APIs

1. Select the environment in top-right dropdown
2. Open any request in the collection
3. Click **Send**

## API Endpoints

### Customer API (`rl_customer_api.js`)

| Method | Action | Parameters |
|--------|--------|------------|
| GET | Retrieve customer | `id` or `email` |
| POST | Create customer | JSON body with customer data |
| PUT | Update customer | JSON body with `id` and fields to update |
| DELETE | Deactivate customer | `id` |

### Inventory API (`rl_inventory_api.js`)

| Method | Action | Parameters |
|--------|--------|------------|
| GET | Single item lookup | `itemId` or `sku`, optional `location` |
| POST | Bulk inventory check | JSON body with `items` array |

### Order API (`rl_order_api.js`)

| Method | Action | Parameters |
|--------|--------|------------|
| GET | Retrieve order | `orderId` or `externalId` |
| POST | Create Sales Order | JSON body with order data |
| PUT | Update order status | JSON body with `orderId` and updates |

## Authentication

The collection uses **OAuth 1.0 (Token-Based Authentication)** which is automatically configured. Just fill in the environment variables and authentication headers will be generated for each request.

### Required NetSuite Setup

1. **Enable Token-Based Authentication**
   - Setup > Company > Enable Features > SuiteCloud > Manage Authentication
   - Check "Token-Based Authentication"

2. **Create Integration Record**
   - Setup > Integration > Manage Integrations > New
   - Enable Token-Based Authentication
   - Copy Consumer Key and Secret

3. **Create Access Token**
   - Setup > Users/Roles > Access Tokens > New
   - Select Application (Integration)
   - Select User
   - Select Role (must have RESTlet permissions)
   - Copy Token ID and Secret

## Common Response Format

All endpoints return consistent JSON:

```json
// Success
{
    "success": true,
    "message": "Operation completed",
    "data": { ... }
}

// Error
{
    "success": false,
    "error": {
        "code": 400,
        "message": "Error description"
    }
}
```

## Troubleshooting

| Error | Solution |
|-------|----------|
| 401 Unauthorized | Check TBA credentials and role permissions |
| 403 Forbidden | RESTlet deployment may be restricted by role/audience |
| 404 Not Found | Check script/deploy IDs in URL parameters |
| SSS_INVALID_SCRIPTLET_ID | Script ID doesn't exist or isn't deployed |
| INVALID_LOGIN_CREDENTIALS | Token or consumer credentials are wrong |

## Integration Examples

### E-commerce Webhook Integration

```javascript
// Shopify webhook handler
app.post('/webhooks/orders/create', async (req, res) => {
    const shopifyOrder = req.body;
    
    // Call NetSuite Order API
    const response = await fetch(NETSUITE_RESTLET_URL, {
        method: 'POST',
        headers: getOAuthHeaders(),
        body: JSON.stringify({
            externalId: shopifyOrder.order_number,
            customer: {
                email: shopifyOrder.email,
                firstname: shopifyOrder.customer.first_name,
                lastname: shopifyOrder.customer.last_name
            },
            items: shopifyOrder.line_items.map(item => ({
                sku: item.sku,
                quantity: item.quantity,
                rate: item.price
            }))
        })
    });
    
    res.json(await response.json());
});
```

### Real-time Inventory Check

```javascript
// Before showing "Add to Cart"
async function checkAvailability(sku) {
    const response = await fetch(
        `${NETSUITE_RESTLET_URL}?script=customscript_rl_inventory_api&deploy=customdeploy_rl_inventory_api&sku=${sku}`,
        { headers: getOAuthHeaders() }
    );
    
    const data = await response.json();
    return data.success && data.data.inventory.inStock;
}
```
