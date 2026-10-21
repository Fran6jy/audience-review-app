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
- A local visible-browser companion can collect public profile counts into the optional observation format and prepare a 1–3 account removal test. It never handles your password or uploads observations to Vercel.

## Local Instagram companion

The hosted app remains a private browser workspace. For a test on an account you own, the separate local companion uses an installed Chrome browser; it does not use hidden Instagram endpoints. Use `npm run companion -- enrich --owner YOUR_USERNAME --limit 3` to try public-profile observation on three followers. The source defaults to `private-instagram-import/followers_1.json`; output is `private-instagram-import/profile-observations.json`. Import that output under **Data sources** in the web app. Missing or private fields stay missing.

For a removal test, explicitly mark the intended followers as **Removal candidate** in the app. In **Action plans**, enter the account owner, check only 1–3 candidates, and download the approval packet. Run `npm run companion -- remove --owner YOUR_USERNAME --approval PATH_TO_PACKET` for a dry run. Only `--execute --session FRESH_BACKUP.json` allows clicking Instagram's Remove control: save a fresh session backup from **Data sources** immediately before execution, so protected or cancelled accounts remain blocked. Each account also requires typing `REMOVE @username` in the local terminal. The companion stops on ambiguous UI, login challenges, or uncertainty. It writes an action journal in `private-instagram-import/`; import that journal back into **Action plans**. A later complete follower export can be compared with `npm run companion -- reconcile --journal PATH_TO_JOURNAL --followers NEW_FOLLOWERS_JSON`.

The first use opens a separate visible Chrome profile in `.local-instagram-browser/`. If Instagram asks for login, the account owner must log in there and rerun the command. Never send the approval packet, browser profile, or action journal to a public repo. Automation against a changing third-party UI is inherently brittle; a successful click is logged as a UI action, not verified follower removal.

## Optional profile evidence format

Use **Data sources** to import a JSON array of observations from a source you are authorised to use. Each object must have `username`; optional fields are `user_id`, `display_name`, `followers_count`, `following_count`, `posts_count`, `bio`, `is_private`, `is_verified`, `last_post_date` (`YYYY-MM-DD`), `average_likes`, `average_comments`, `sample_size`, and `observed_at` (ISO timestamp). Invalid values are treated as missing. Records not in the current follower export are reported but not added. Re-importing follower data preserves matched profile evidence and your review decisions. Pending actions for accounts absent from a new export are marked unconfirmed, not successful.

The app does not collect this information itself and does not independently verify supplied observations. An empty bio, zero visible posts, private status, or a non-mutual follow does not prove an account is fake or inactive.

## Boundaries

The hosted app does not log into Instagram, sync followers in the background, verify actions, or remove followers. Its separate local companion can gather visible public counts and attempt an explicitly approved removal test in the owner's own browser session, but it is not an official Instagram API integration and has not been proven against a live removal yet. `user_reported_done` is not proof of removal. You still need a fresh export to compare follower membership later. The export alone does not provide enough evidence for bot claims. A non-mutual follow is not a suspicious signal by itself. The Korean translation currently covers the new analysis and action-plan screens, not the entire application.

Account data and notes remain in the browser profile's local storage unless you export them. This is convenient on a personal device but not appropriate on a shared computer. **Clear local workspace** removes the saved data. The app includes no analytics scripts or automatic third-party requests. Opening a profile link will navigate to Instagram.

Use only exports from accounts you own or are authorised to manage. Never commit real exports or session backups to a public repository.
