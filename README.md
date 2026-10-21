# Audience Review

A private, browser-based prototype for reviewing an Instagram account owner's exported follower data. This is a portfolio/demo project, not an Instagram integration.

## Run

Open `index.html` in a modern browser. No install, server, account, or API key is required. Choose **Load example** to explore the interface with synthetic data.

To use your own data, request your Instagram information export in JSON format, then select `followers_1.json` (or `followers.json`) and `following.json` from the export. The files are read locally in your browser tab and are not uploaded by this app. Use **Export review CSV** to keep a copy of your decisions before closing the tab.

## Current scope

- Import follower and following JSON files.
- Show mutual-follow status when a following file is provided.
- Search and filter accounts.
- Mark accounts as protected or for manual review.
- Export a CSV of accounts and decisions.
- Run entirely client-side with no credentials or backend.

## Limitations

This prototype does not connect to Instagram, fetch live profile data, identify bots, measure engagement, or remove followers. A non-mutual follow is not evidence of spam or inactivity. Review decisions are kept only in memory and disappear when the tab closes unless exported.

The app renders the first 500 rows matching a filter to keep large exports responsive; its counts and CSV export cover all imported rows. The importer recognises Instagram-style `followers_*.json` and `following.json` files; export formats may change.

Only use data from accounts you own or are authorised to manage. Do not publish real follower exports as demo data.
