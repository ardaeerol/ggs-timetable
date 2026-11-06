# GGS Timetable

Timetable app for TU Berlin MSc Geodesy & Geoinformation Science, Winter Term 2026/27.

## Put it online (needed for notifications, location and install)

**GitHub Pages (works from the phone):**
1. github.com → New repository (e.g. `ggs-timetable`, public).
2. "Add file" → "Upload files" → select all files from this folder (not the folder itself) → Commit.
3. Settings → Pages → Branch: `main`, folder `/ (root)` → Save.
4. After about a minute, open `https://<username>.github.io/ggs-timetable/` in Chrome on the phone.

**Netlify Drop (from a computer):** open app.netlify.com/drop and drag this folder in.

## Install on the Samsung
Chrome → ⋮ → "Add to Home screen" → Install. Then in the app: Settings → Allow notifications, set your two addresses, pick the default.
Android: Settings → Apps → GGS → Battery → "Unrestricted" so background checks are not stopped.

## Updating
- Day-to-day changes (room, time, cancelled class, new course, exams): do them in the app.
- Code changes: replace the files in the repository; the app picks up the new version on its next start.
- Back up from Settings → Save backup before switching phones.

## Releasing a code change
Bump the version in three places together: `engine.js?v=N` in `index.html`, and `CACHE` plus both `engine.js?v=N` in `sw.js`.

## Files
`index.html` app · `engine.js` timetable, travel and reminder logic · `sw.js` offline and background reminders · `manifest.webmanifest` + icons.
