/**
 * Studio Gallery - Centralized Configuration File
 * Edit these settings to link your own Google Sheet and WhatsApp number.
 */

const CONFIG = {
    // 1. Google Sheets published CSV URL
    // Format: "https://docs.google.com/spreadsheets/d/e/[ID]/pub?output=csv"
    // Leave empty to use local fallback JSON database (artworks.json)
    spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/1Hma2bgn84ACT1VMPhYHe3UI_u5XCebcUMk7fItsnysg/export?format=csv&gid=0',
    
    // 2. Google Apps Script Web App URL (for admin write operations)
    // Format: "https://script.google.com/macros/s/[ID]/exec"
    // Leave empty if only viewing and not updating from the dashboard
    appsScriptUrl: '',
    
    // 3. Security PIN for accessing the admin panel (default: '1234')
    adminPin: '1511',
    
    // 4. WhatsApp Phone Number (with country code, no + or spaces, e.g., "919876543210")
    whatsappNumber: '91959923810',
    
    // 5. Fallback local database path
    fallbackDatabasePath: 'artworks.json',
    
    // 6. Currency Symbol
    currencySymbol: '$'
};
