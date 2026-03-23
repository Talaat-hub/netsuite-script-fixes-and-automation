/**
 * @NApiVersion 2.1
 * @NModuleScope SameAccount
 * 
 * @description Shared Utility Library - Common functions used across scripts
 * 
 * Pattern: AMD module pattern for SuiteScript 2.x shared libraries
 */
define(['N/search', 'N/format', 'N/runtime', 'N/log'], 
    (search, format, runtime, log) => {

    // ==================== SEARCH UTILITIES ====================

    /**
     * Run a search and return all results (handles pagination)
     * @param {search.Search} searchObj - NetSuite search object
     * @returns {Array} All search results
     */
    const getAllResults = (searchObj) => {
        const results = [];
        let start = 0;
        const pageSize = 1000;

        do {
            const pagedResults = searchObj.run().getRange({
                start: start,
                end: start + pageSize
            });

            results.push(...pagedResults);
            start += pageSize;

        } while (results.length === start);

        return results;
    };

    /**
     * Run search and return specific columns as object array
     * @param {Object} options - Search options
     * @param {string} options.type - Record type
     * @param {Array} options.filters - Search filters
     * @param {Array} options.columns - Column IDs to retrieve
     * @returns {Array} Array of result objects with column values
     */
    const searchToArray = (options) => {
        const results = [];

        const searchObj = search.create({
            type: options.type,
            filters: options.filters || [],
            columns: options.columns.map(col => {
                if (typeof col === 'string') {
                    return search.createColumn({ name: col });
                }
                return col;
            })
        });

        searchObj.run().each(result => {
            const obj = { id: result.id };
            
            options.columns.forEach(col => {
                const colName = typeof col === 'string' ? col : col.name;
                obj[colName] = result.getValue(colName);
                obj[`${colName}_text`] = result.getText(colName);
            });

            results.push(obj);
            return true;
        });

        return results;
    };

    /**
     * Lookup single record field values
     * @param {Object} options - Lookup options
     * @returns {Object} Field values
     */
    const lookupRecord = (options) => {
        return search.lookupFields({
            type: options.type,
            id: options.id,
            columns: options.columns
        });
    };

    // ==================== DATE UTILITIES ====================

    /**
     * Parse date from various formats
     * @param {string|Date} dateValue - Date to parse
     * @returns {Date|null} Parsed date or null
     */
    const parseDate = (dateValue) => {
        if (!dateValue) return null;
        
        if (dateValue instanceof Date) return dateValue;

        try {
            // Try NetSuite format first
            return format.parse({
                value: dateValue,
                type: format.Type.DATE
            });
        } catch (e) {
            // Fallback to JS parsing
            const parsed = new Date(dateValue);
            return isNaN(parsed.getTime()) ? null : parsed;
        }
    };

    /**
     * Format date for display
     * @param {Date} dateValue - Date to format
     * @param {string} formatType - 'date', 'datetime', or 'time'
     * @returns {string} Formatted date string
     */
    const formatDate = (dateValue, formatType = 'date') => {
        if (!dateValue) return '';

        const types = {
            'date': format.Type.DATE,
            'datetime': format.Type.DATETIME,
            'time': format.Type.TIMEOFDAY
        };

        return format.format({
            value: dateValue,
            type: types[formatType] || format.Type.DATE
        });
    };

    /**
     * Add days to a date
     * @param {Date} date - Base date
     * @param {number} days - Days to add (can be negative)
     * @returns {Date} New date
     */
    const addDays = (date, days) => {
        const result = new Date(date);
        result.setDate(result.getDate() + days);
        return result;
    };

    /**
     * Get date range for period
     * @param {string} period - 'today', 'thisWeek', 'thisMonth', 'thisYear', 'lastMonth', etc.
     * @returns {Object} { startDate, endDate }
     */
    const getDateRange = (period) => {
        const today = new Date();
        let startDate, endDate;

        switch (period) {
            case 'today':
                startDate = endDate = today;
                break;
            case 'thisWeek':
                startDate = new Date(today);
                startDate.setDate(today.getDate() - today.getDay());
                endDate = new Date(startDate);
                endDate.setDate(startDate.getDate() + 6);
                break;
            case 'thisMonth':
                startDate = new Date(today.getFullYear(), today.getMonth(), 1);
                endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
                break;
            case 'lastMonth':
                startDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
                endDate = new Date(today.getFullYear(), today.getMonth(), 0);
                break;
            case 'thisYear':
                startDate = new Date(today.getFullYear(), 0, 1);
                endDate = new Date(today.getFullYear(), 11, 31);
                break;
            default:
                startDate = endDate = today;
        }

        return { startDate, endDate };
    };

    // ==================== NUMBER/CURRENCY UTILITIES ====================

    /**
     * Format number as currency
     * @param {number} amount - Amount to format
     * @param {string} currency - Currency code (default: USD)
     * @returns {string} Formatted currency string
     */
    const formatCurrency = (amount, currency = 'USD') => {
        const num = parseFloat(amount) || 0;
        return num.toLocaleString('en-US', {
            style: 'currency',
            currency: currency,
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    };

    /**
     * Parse currency string to number
     * @param {string} currencyStr - Currency string
     * @returns {number} Parsed number
     */
    const parseCurrency = (currencyStr) => {
        if (typeof currencyStr === 'number') return currencyStr;
        if (!currencyStr) return 0;
        return parseFloat(String(currencyStr).replace(/[^0-9.-]/g, '')) || 0;
    };

    /**
     * Round to specified decimal places
     * @param {number} num - Number to round
     * @param {number} decimals - Decimal places
     * @returns {number} Rounded number
     */
    const round = (num, decimals = 2) => {
        const factor = Math.pow(10, decimals);
        return Math.round(num * factor) / factor;
    };

    // ==================== STRING UTILITIES ====================

    /**
     * Escape XML/HTML special characters
     * @param {string} str - String to escape
     * @returns {string} Escaped string
     */
    const escapeXml = (str) => {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    };

    /**
     * Truncate string with ellipsis
     * @param {string} str - String to truncate
     * @param {number} maxLength - Maximum length
     * @returns {string} Truncated string
     */
    const truncate = (str, maxLength = 50) => {
        if (!str || str.length <= maxLength) return str || '';
        return str.substring(0, maxLength - 3) + '...';
    };

    /**
     * Check if string is empty or whitespace
     * @param {string} str - String to check
     * @returns {boolean} True if empty or whitespace only
     */
    const isEmpty = (str) => {
        return !str || String(str).trim().length === 0;
    };

    // ==================== GOVERNANCE UTILITIES ====================

    /**
     * Check remaining governance and return true if safe to continue
     * @param {number} threshold - Minimum units required
     * @returns {boolean} True if governance is sufficient
     */
    const checkGovernance = (threshold = 100) => {
        const script = runtime.getCurrentScript();
        const remaining = script.getRemainingUsage();
        
        if (remaining < threshold) {
            log.audit('checkGovernance', `Low governance: ${remaining} units remaining`);
            return false;
        }
        
        return true;
    };

    /**
     * Get current script parameters
     * @param {Array} paramIds - Array of parameter IDs
     * @returns {Object} Parameter values by ID
     */
    const getScriptParams = (paramIds) => {
        const script = runtime.getCurrentScript();
        const params = {};
        
        paramIds.forEach(id => {
            params[id] = script.getParameter({ name: id });
        });
        
        return params;
    };

    // ==================== VALIDATION UTILITIES ====================

    /**
     * Validate email format
     * @param {string} email - Email to validate
     * @returns {boolean} True if valid
     */
    const isValidEmail = (email) => {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    };

    /**
     * Validate phone format (digits only, 10-15 length)
     * @param {string} phone - Phone to validate
     * @returns {boolean} True if valid
     */
    const isValidPhone = (phone) => {
        const digits = String(phone).replace(/\D/g, '');
        return digits.length >= 10 && digits.length <= 15;
    };

    // ==================== ERROR HANDLING ====================

    /**
     * Safe JSON parse with default
     * @param {string} jsonStr - JSON string
     * @param {*} defaultVal - Default value if parse fails
     * @returns {*} Parsed object or default
     */
    const safeJsonParse = (jsonStr, defaultVal = {}) => {
        try {
            return JSON.parse(jsonStr);
        } catch (e) {
            return defaultVal;
        }
    };

    /**
     * Log error with context
     * @param {string} functionName - Function where error occurred
     * @param {Error|string} error - Error object or message
     * @param {Object} context - Additional context
     */
    const logError = (functionName, error, context = {}) => {
        log.error(functionName, {
            message: error.message || error,
            stack: error.stack || '',
            ...context
        });
    };

    // Export all utilities
    return {
        // Search
        getAllResults,
        searchToArray,
        lookupRecord,
        
        // Date
        parseDate,
        formatDate,
        addDays,
        getDateRange,
        
        // Number/Currency
        formatCurrency,
        parseCurrency,
        round,
        
        // String
        escapeXml,
        truncate,
        isEmpty,
        
        // Governance
        checkGovernance,
        getScriptParams,
        
        // Validation
        isValidEmail,
        isValidPhone,
        
        // Error handling
        safeJsonParse,
        logError
    };
});
