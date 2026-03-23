# API Reference

## Utility Library (lib_utils.js)

### Search Utilities

#### getAllResults(searchObj)
Runs a search and returns all results with automatic pagination.

```javascript
const results = utils.getAllResults(mySearch);
```

**Parameters:**
- `searchObj` (search.Search) - NetSuite search object

**Returns:** Array of search result objects

---

#### searchToArray(options)
Executes a search and returns results as an array of objects.

```javascript
const customers = utils.searchToArray({
    type: 'customer',
    filters: [['isinactive', 'is', 'F']],
    columns: ['entityid', 'email', 'balance']
});
```

**Parameters:**
- `options.type` (string) - Record type
- `options.filters` (Array) - Search filters
- `options.columns` (Array) - Column IDs to retrieve

**Returns:** Array of objects with field values

---

#### lookupRecord(options)
Performs a field lookup on a single record.

```javascript
const data = utils.lookupRecord({
    type: 'customer',
    id: 123,
    columns: ['companyname', 'email']
});
```

---

### Date Utilities

#### parseDate(dateValue)
Parses a date from various formats.

```javascript
const date = utils.parseDate('1/15/2026');
const date2 = utils.parseDate(new Date());
```

**Returns:** Date object or null

---

#### formatDate(dateValue, formatType)
Formats a date for display.

```javascript
const str = utils.formatDate(new Date(), 'date');     // "3/23/2026"
const str2 = utils.formatDate(new Date(), 'datetime'); // "3/23/2026 2:30 pm"
```

**Parameters:**
- `formatType` - 'date', 'datetime', or 'time'

---

#### addDays(date, days)
Adds or subtracts days from a date.

```javascript
const nextWeek = utils.addDays(new Date(), 7);
const lastWeek = utils.addDays(new Date(), -7);
```

---

#### getDateRange(period)
Gets start and end dates for common periods.

```javascript
const { startDate, endDate } = utils.getDateRange('thisMonth');
```

**Parameters:**
- `period` - 'today', 'thisWeek', 'thisMonth', 'lastMonth', 'thisYear'

---

### Currency Utilities

#### formatCurrency(amount, currency)
Formats a number as currency.

```javascript
const formatted = utils.formatCurrency(1234.5, 'USD'); // "$1,234.50"
```

---

#### parseCurrency(currencyStr)
Parses a currency string to number.

```javascript
const num = utils.parseCurrency('$1,234.50'); // 1234.5
```

---

#### round(num, decimals)
Rounds a number to specified decimal places.

```javascript
const rounded = utils.round(3.14159, 2); // 3.14
```

---

### String Utilities

#### escapeXml(str)
Escapes XML/HTML special characters for safe inclusion in templates.

```javascript
const safe = utils.escapeXml('<script>alert("xss")</script>');
// "&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;"
```

---

#### truncate(str, maxLength)
Truncates a string with ellipsis.

```javascript
const short = utils.truncate('Very long string here', 10); // "Very lon..."
```

---

#### isEmpty(str)
Checks if string is empty or whitespace only.

```javascript
if (utils.isEmpty(value)) {
    // handle empty
}
```

---

### Governance Utilities

#### checkGovernance(threshold)
Checks remaining script governance units.

```javascript
if (!utils.checkGovernance(100)) {
    log.audit('Stopping', 'Low governance');
    return;
}
```

**Parameters:**
- `threshold` (number) - Minimum required units (default: 100)

**Returns:** boolean - true if sufficient governance remains

---

#### getScriptParams(paramIds)
Gets multiple script parameters at once.

```javascript
const params = utils.getScriptParams([
    'custscript_report_type',
    'custscript_recipient'
]);
```

**Returns:** Object with parameter values keyed by ID

---

### Validation Utilities

#### isValidEmail(email)
Validates email format.

```javascript
if (!utils.isValidEmail(emailInput)) {
    throw new Error('Invalid email');
}
```

---

#### isValidPhone(phone)
Validates phone number (10-15 digits).

```javascript
if (!utils.isValidPhone(phoneInput)) {
    throw new Error('Invalid phone');
}
```

---

### Error Handling

#### safeJsonParse(jsonStr, defaultVal)
Safely parses JSON with fallback.

```javascript
const data = utils.safeJsonParse(responseBody, {});
```

---

#### logError(functionName, error, context)
Logs an error with full context.

```javascript
try {
    // code
} catch (e) {
    utils.logError('myFunction', e, { recordId: id });
    throw e;
}
```
