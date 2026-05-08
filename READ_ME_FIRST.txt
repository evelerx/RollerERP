=============================================
  ROLLER ERP — Setup & Usage Instructions
=============================================

FIRST TIME SETUP (do this once):
----------------------------------
1. Install Node.js from https://nodejs.org
   - Click the "LTS" button to download
   - Run the installer, click Next all the way through

2. Double-click CREATE_DESKTOP_SHORTCUT.bat
   - This puts a launch button on your Desktop

3. Double-click START_ERP.bat (or the Desktop shortcut)
   - First time takes 1-2 minutes to set up
   - Your browser opens automatically at http://localhost:3000


DAILY USE (after first setup):
--------------------------------
- Double-click "Roller ERP" on your Desktop
- Browser opens with your app in a few seconds
- To close: just close the black command window


LOGIN DETAILS:
---------------
Admin Password : 123321*
Employee PIN   : 1234
Client Portal  : No password (just click Client)


IMPORTANT NOTES:
-----------------
- The app runs LOCALLY on your computer
- Your data is saved through the backend into Supabase if configured, otherwise in your browser (Chrome/Edge)
- If you clear browser data, ERP data is also cleared
- Always use the SAME browser for your data to persist
- The black command window must stay open while using the app


SUPABASE SETUP:
----------------
1. Create a Supabase project at https://supabase.com
2. Copy .env.example to .env
3. Fill in:
   - DATABASE_URL
   - PORT (optional, default 4000)
   - VITE_API_BASE_URL (optional for deployed frontend)
4. Start both frontend and backend with: npm run dev:full
5. The backend auto-creates the ERP table on first start

If .env is not configured, the ERP still works using local browser storage.


FILES IN THIS FOLDER:
----------------------
START_ERP.bat              -- Launch the app (double-click this)
CREATE_DESKTOP_SHORTCUT.bat -- Creates shortcut on Desktop (run once)
package.json               -- App configuration (don't edit)
vite.config.js             -- Server settings (don't edit)
index.html                 -- App entry point (don't edit)
src/App.jsx                -- Main app code
src/main.jsx               -- React entry point
public/favicon.svg         -- App icon


NEED HELP?
-----------
If the app doesn't start:
1. Make sure Node.js is installed (nodejs.org)
2. Make sure the black window is open
3. Go to http://localhost:3000 in your browser manually

=============================================
