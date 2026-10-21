# Audience Review

A browser-based workspace for reviewing an Instagram account owner's exported followers. The visual design takes inspiration from the editorial contrast and clarity of [Lefty](https://lefty.io/) without using its branding, assets, or proprietary interface.

## Run

Run `npm install`, then `npm run dev` and open the Vite URL. Use `npm test` for data tests and `npm run build` for a production build. No account or API key is required; the initial workspace contains synthetic accounts.

To use your own data, export your Instagram information in JSON format. In **Data sources**, select the downloaded ZIP directly, or select `followers_1.json` (or `followers.json`) and optionally `following.json`. The importer also accepts numbered follower files, such as `followers_2.json`. ZIP extraction and parsing happen locally in your browser. Re-importing a newer export preserves decisions for usernames still present and reports how many are new or no longer in the export.

## Features

- Overview with audience counts, review progress, and explicit data coverage.
- Searchable, paginated account review with relationship and decision filters.
- Individual decisions: unreviewed, needs review, removal candidate, protected, or cleared.
- Private notes and bulk decisions for selected accounts.
- Local browser storage to restore your workspace on the same device.
- CSV export and JSON session backup/restore.
- Optional profile-observation JSON import, matched to known followers by username.
- Account details show each supplied field and explicitly mark missing fields unavailable.
- Manual review cues display the observed basis (such as zero supplied posts or an old supplied post date) without assigning a bot/fake label.
- Analysis shows per-field coverage, a conservative explainable triage score, confidence, and insufficient-data states. A score is not a fraud probability.
- English and Korean labels on the Analysis and Action plans screens.
- Manual action plans include only explicitly marked removal candidates, skip already-pending accounts, preserve protected accounts, and record user-reported results or cancellation. Plans are saved in the JSON session backup.
- Responsive desktop and mobile layouts.

## Optional profile evidence format

Use **Data sources** to import a JSON array of observations from a source you are authorised to use. Each object must have `username`; optional fields are `user_id`, `display_name`, `followers_count`, `following_count`, `posts_count`, `bio`, `is_private`, `is_verified`, `last_post_date` (`YYYY-MM-DD`), `average_likes`, `average_comments`, `sample_size`, and `observed_at` (ISO timestamp). Invalid values are treated as missing. Records not in the current follower export are reported but not added. Re-importing follower data preserves matched profile evidence and your review decisions. Pending actions for accounts absent from a new export are marked unconfirmed, not successful.

The app does not collect this information itself and does not independently verify supplied observations. An empty bio, zero visible posts, private status, or a non-mutual follow does not prove an account is fake or inactive.

## Boundaries

The app does not log into Instagram, sync followers in the background, fetch live profile data, verify actions, or remove followers. Action plans are instructions for a human owner; `user_reported_done` is not proof of removal. You still need to request a fresh export from Instagram when you want new data. The export does not provide enough evidence for bot claims. A non-mutual follow is not a suspicious signal by itself. The Korean translation currently covers the new analysis and action-plan screens, not the entire application.

Account data and notes remain in the browser profile's local storage unless you export them. This is convenient on a personal device but not appropriate on a shared computer. **Clear local workspace** removes the saved data. The app includes no analytics scripts or automatic third-party requests. Opening a profile link will navigate to Instagram.

Use only exports from accounts you own or are authorised to manage. Never commit real exports or session backups to a public repository.
