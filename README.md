# Vishal Trivedi Studio — Online Gallery & Shop

A museum-style gallery for showcasing and selling original sketches and paintings. Visitors pass through an opening curtain, scroll through **the collection**, where each work hangs in its own spotlit bay with a gallery plaque beside it, browse a **catalogue**, and step into a **viewing room** with a magnifying loupe. Purchases happen over **WhatsApp**, and the collection is managed from a **Google Sheet** (plus the optional admin console).

## File Structure
- `index.html` — the public gallery (entrance, corridor, catalogue, artist, acquire, viewing room).
- `gallery.css` — styles for the public gallery.
- `app.js` — gallery logic: loads the collection, hangs the corridor, catalogue, viewing room.
- `config.js` — **all settings**: sheet URL, WhatsApp number, currency, your name and links.
- `artworks.json` — sample collection shown until your Google Sheet has rows (a "Preview" ribbon appears while samples are on display).
- `assets/` — the sample artworks (SVG). Replace with your own images.
- `admin.html`, `admin.js`, `styles.css` — the admin console (unchanged).

## Adding your real artworks
1. Upload photos of your work somewhere public (e.g. this repo's `assets/` folder, or Google Drive/Cloudinary with a direct image link).
2. Add one row per work to your Google Sheet: `id, title, category (Paintings or Sketches), status (Available or Sold), price (a number, e.g. 18000), dimensions, medium, imageUrl, description`.
3. That's it — once the sheet has rows, the gallery shows them and the sample works and preview ribbon disappear.

Tip: photograph works in soft daylight, straight on, and crop to the paper edge — the site adds the frame and mat for you.

---

## File Structure
- `index.html` — The public-facing art portfolio gallery.
- `admin.html` — The private administration panel for managing inventory.
- `config.js` — The **central configuration file** (edit this file to customize your setup!).
- `app.js` — Core logic running the public gallery.
- `admin.js` — Core logic running the admin console.
- `styles.css` — Centralized premium stylesheet with animations and grids.
- `artworks.json` — Out-of-the-box sample database loaded if no spreadsheet is connected.

---

## Quick Setup Guide

All configuration settings are managed in a single file: [config.js](file:///C:/Users/trive/.gemini/antigravity/scratch/art-portfolio-website/config.js).

### Step 1: Set Your WhatsApp Number & Security PIN
Open [config.js](file:///C:/Users/trive/.gemini/antigravity/scratch/art-portfolio-website/config.js) and locate the settings:
1. **WhatsApp Number**: Change `whatsappNumber` to your phone number including your country code (no `+` or spaces, e.g., `'919876543210'`).
2. **Admin PIN**: Change `adminPin` to a secret code of your choice (default is `'1234'`). This PIN prevents random visitors from opening your admin page.

---

### Step 2: Set Up Your Google Sheet (Database)
Using a Google Sheet allows you to manage details instantly.

#### 1. Create the Spreadsheet
Create a new spreadsheet in [Google Sheets](https://sheets.google.com) and name the first tab `Sheet1`. Set the first row columns exactly as follows:

| A | B | C | D | E | F | G | H | I |
|---|---|---|---|---|---|---|---|---|
| **id** | **title** | **category** | **status** | **price** | **dimensions** | **medium** | **imageUrl** | **description** |

*Note: You can add sample rows matching the column structure. Ensure your category column contains either `Paintings` or `Sketches`, and status is `Available` or `Sold`.*

#### 2. Publish as CSV
To let the public gallery read your sheet:
1. Inside the spreadsheet, click **File** -> **Share** -> **Publish to web**.
2. Change "Entire Document" to `Sheet1` (or your tab name), and change "Web page" to **Comma-separated values (.csv)**.
3. Click **Publish** and copy the generated link.
4. Paste this link into `config.js` under `spreadsheetUrl`:
   ```javascript
   spreadsheetUrl: 'YOUR_PUBLISHED_CSV_LINK_HERE',
   ```

---

### Step 3: Deploy Google Apps Script (For Web Editing)
To allow the Admin Dashboard (`admin.html`) to write edits and add new items back to your spreadsheet:

1. Inside your Google Sheet, click **Extensions** -> **Apps Script**.
2. Delete any default code inside the editor and paste the following script:

```javascript
// Simple Auth PIN matching the one in config.js
const ADMIN_PIN = "1234"; 

function doPost(e) {
  try {
    var params = JSON.parse(e.postData.contents);
    var action = params.action;
    var pin = params.pin;
    
    // Check Authorization
    if (pin !== ADMIN_PIN) {
      return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "Unauthorized PIN" }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Sheet1");
    var dataRange = sheet.getDataRange();
    var values = dataRange.getValues();
    var headers = values[0];
    
    if (action === "update") {
      var artwork = params.artwork;
      var idColIdx = headers.indexOf("id");
      if (idColIdx === -1) idColIdx = 0;
      
      // Find row by ID
      var rowNumber = -1;
      for (var i = 1; i < values.length; i++) {
        if (values[i][idColIdx].toString() === artwork.id.toString()) {
          rowNumber = i + 1; // 1-based index
          break;
        }
      }
      
      // If row not found, append a new row
      if (rowNumber === -1) {
        var newRow = [];
        headers.forEach(function(header) {
          var key = header.toLowerCase();
          // Map to correct keys, adjusting for imageUrl casing
          if (key === "imageurl") {
            newRow.push(artwork.imageUrl || "");
          } else {
            newRow.push(artwork[key] || "");
          }
        });
        sheet.appendRow(newRow);
        return ContentService.createTextOutput(JSON.stringify({ status: "success", message: "Added new artwork" }))
          .setMimeType(ContentService.MimeType.JSON);
      } else {
        // Update existing row
        headers.forEach(function(header, colIdx) {
          var key = header.toLowerCase();
          
          if (key === "imageurl" && artwork.hasOwnProperty("imageUrl")) {
            sheet.getRange(rowNumber, colIdx + 1).setValue(artwork.imageUrl);
          } else if (artwork.hasOwnProperty(key)) {
            sheet.getRange(rowNumber, colIdx + 1).setValue(artwork[key]);
          }
        });
        
        return ContentService.createTextOutput(JSON.stringify({ status: "success", message: "Artwork updated successfully" }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }
    
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "Action invalid" }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch(error) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// Enable CORS Preflight requests
function doOptions(e) {
  return ContentService.createTextOutput("")
    .setMimeType(ContentService.MimeType.TEXT);
}
```

3. Change `ADMIN_PIN` at the top of the script to match the `adminPin` in your `config.js`.
4. Click **Deploy** (top right) -> **New Deployment**.
5. Click the gear icon next to "Select type" and choose **Web App**.
6. Set the options:
   - **Description**: `Studio Inventory Controller`
   - **Execute as**: *Me (your email address)*
   - **Who has access**: *Anyone* (This is necessary to allow the dashboard to save edits).
7. Click **Deploy** (Authorize access if Google prompts you).
8. Copy the generated **Web App URL** (which ends in `/exec`).
9. Open [config.js](file:///C:/Users/trive/.gemini/antigravity/scratch/art-portfolio-website/config.js) and paste this URL under `appsScriptUrl`:
   ```javascript
   appsScriptUrl: 'YOUR_APPS_SCRIPT_WEB_APP_URL_HERE',
   ```

Now your dashboard is fully integrated with Google Sheets!

---

## Accessing and Using the Console

1. To enter your control center, open the `admin.html` file in your browser.
2. Enter your **Security PIN** (default: `1234`).
3. You will see a list of your artwork catalog.
4. **Edit Artwork**: Click the edit pencil icon next to any piece. A slide-out panel will open, letting you alter price, status, dimensions, title, medium, image, or description. Click **Save Changes**.
5. **Add Artwork**: Click **Add New Artwork** at the top. Fill in the details (ensure you use a valid direct image URL) and click **Save Changes**.

*Note: If you have not connected Google Sheets yet, the dashboard runs in "Simulated Mode". You can add or edit elements locally in your browser to preview how it works, but changes will reset on page reload.*
