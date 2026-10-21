# Audience Review

A browser-based workspace for reviewing an Instagram account owner's exported followers. The visual design takes inspiration from the editorial contrast and clarity of [Lefty](https://lefty.io/) without using its branding, assets, or proprietary interface.

## Run

Open `index.html` in a modern browser. No build step, account, API key, or server is required. The initial workspace uses clearly synthetic example accounts.

To use your own data, export your Instagram information in JSON format. In **Data & exports**, select `followers_1.json` (or `followers.json`) and `following.json`. The importer also accepts numbered follower files, such as `followers_2.json`. The files are parsed locally in your browser.

## Features

- Overview with audience counts, review progress, and explicit data coverage.
- Searchable, paginated account review with relationship and decision filters.
- Individual decisions: unreviewed, needs review, protected, or cleared.
- Private notes and bulk decisions for selected accounts.
- Local browser storage to restore your workspace on the same device.
- CSV export and JSON session backup/restore.
- Responsive desktop and mobile layouts.

## Boundaries

The app does not log into Instagram, fetch live profile data, classify bots, or remove followers. The export does not provide enough evidence for those claims. A non-mutual follow is not a suspicious signal by itself.

Account data and notes remain in the browser profile's local storage unless you export them. This is convenient on a personal device but not appropriate on a shared computer. **Clear local workspace** removes the saved data. The app includes no analytics scripts or automatic third-party requests. Opening a profile link will navigate to Instagram.

Use only exports from accounts you own or are authorised to manage. Never commit real exports or session backups to a public repository.
