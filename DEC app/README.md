# DEC Trail Visitation Explorer

This app lets DEC staff select one or more trails and compare:

- cleaned visitation records;
- observed visitation over time;
- held-out observed and predicted visitation; and
- prepared Strava edge maps.

## Run it from VS Code

1. In VS Code, choose **File → Open Folder** and open the `DEC app` folder.
2. Choose **Terminal → New Terminal**.
3. The first time you run the app, install its packages:

   ```bash
   npm install
   ```

4. Start the app:

   ```bash
   npm run dev
   ```

5. Open the local address printed in the terminal, normally:

   ```text
   http://localhost:3000
   ```

6. To stop the app, return to the terminal and press **Control+C**.

No sign-in is required when running the app locally.

## Refresh the app data

The browser-ready data files are already included. If the CSV files in the
workspace's `data` folder change, rebuild the app data from the VS Code terminal:

```bash
python3 scripts/build_data.py
```

Then restart `npm run dev`, or refresh the browser if it is already running.

## Verify a production build

```bash
npm run build
```
