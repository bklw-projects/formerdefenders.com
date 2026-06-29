# Former Defenders — website

A single-page site for the project: a navy-and-white, professional map of the
continental United States. Visitors click a **state** to see every recommended
attorney there, or click a **star** (an office location) to see that office.

Everything you'll normally edit lives in three files at the repo root — no code
changes required.

---

## What you edit

| File | What it controls |
| --- | --- |
| `site-branding.json` | Firm name, initials, URL, tagline, hero/about copy, the nav menu, and the footer contact + disclaimer. |
| `site-attorneysbystate.txt` | The list of recommended attorneys. Each entry is one block; see the instructions at the top of that file. |
| `site-logo.png` | The logo shown in the top-left. Replace with your own (a transparent PNG looks best; the current one is a placeholder). |

`favicon.png` is the little browser-tab icon — replace it too if you like.

### Adding an attorney
Open `site-attorneysbystate.txt`, copy an existing block, and edit the fields.
Separate every block with a line containing only `---`. To put a **star** on the
map, include `LAT` and `LNG` (look up "<city, state> latitude longitude").
States with at least one entry are automatically highlighted on the map.

### Changing colors
Open `assets/css/styles.css`. The palette is at the very top under `:root`.
The single gold accent is `--gold`; change or remove it there.

---

## Deploy to GitHub Pages

1. Create a repository and push these files to it (keep the folder structure).
2. In the repo: **Settings → Pages → Build and deployment**.
   Set **Source** to "Deploy from a branch", branch `main`, folder `/ (root)`.
3. For the custom domain `formerdefenders.com`, the included **`CNAME`** file is
   already set. In your DNS, point the domain at GitHub Pages
   (`A` records to GitHub's IPs, or a `CNAME` record to `<user>.github.io`),
   then enable **Enforce HTTPS** in Settings → Pages.

The `.nojekyll` file is included so GitHub serves the files as-is.

---

## Preview on your own computer

The page loads its data with `fetch()`, which browsers block when you open the
file directly (`file://`). Run a tiny local server instead:

```bash
cd this-folder
python3 -m http.server 8000
# then open http://localhost:8000
```

(Any static server works — `npx serve`, etc.)

---

## How it's built

- Plain HTML, CSS, and JavaScript — no build step, no framework.
- The map uses **D3** + the **us-atlas** TopoJSON, both vendored in `/vendor`
  so the site makes **no external network calls** (good for privacy and uptime).
- The continental U.S. only; Alaska, Hawaii, and territories are excluded from
  the map. (You can still list attorneys there — they just won't get a star.)

```
.
├── index.html
├── site-branding.json          ← edit me
├── site-attorneysbystate.txt   ← edit me
├── site-logo.png               ← replace me
├── favicon.png
├── CNAME                        (GitHub Pages custom domain)
├── .nojekyll
├── assets/
│   ├── css/styles.css
│   └── js/main.js
└── vendor/                      (d3, topojson, US map data)
```

---

## A note on the placeholder copy

The firm name, the contact details, and the footer disclaimer are placeholders.
Have your firm review the disclaimer and any advertising/referral language for
your jurisdiction's bar rules before going live — that text is a starting point,
not legal advice.
