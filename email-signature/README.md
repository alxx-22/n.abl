# Email signature

The n.abl icon is the main brand. HPE appears on the job-title line. The HTML is built for email: tables, inline styles, Arial and fixed image sizes.

| File | What it is |
|---|---|
| `signature.html` | The email-ready signature |
| `preview.html` | Light and dark previews, plus a select-and-copy area |
| `svg/` | Master artwork (see below) |
| `png/` | 2x PNG exports with transparent backgrounds, except `hpe-logo-email.png` |
| `build.cjs` | Regenerates everything above. **`IMAGE_BASE_URL` is at the top.** |
| `screenshots.cjs` | Renders `preview.html` headlessly into `screenshots/` |

## 1. Upload the PNGs

The signature loads its images from:

```
https://nabl.agency/email-signature/
```

The simplest way to host them is to copy `png/` into the site's `public/` folder and deploy:

```bash
mkdir -p public/email-signature && cp email-signature/png/*.png public/email-signature/
```

The signature only uses two images: `nabl-icon.png` and `hpe-logo-email.png`.

To host them somewhere else, change `IMAGE_BASE_URL` in `build.cjs` (keep the trailing `/`) and rebuild:

```bash
NODE_PATH=$(npm root -g) node email-signature/build.cjs
```

Then open `https://nabl.agency/email-signature/nabl-icon.png` in a browser to check it loads.

## 2. Install in Outlook.com (Hotmail)

1. Open `preview.html` in Chrome or Edge. Once the images are hosted, the yellow notice at the top disappears.
2. Click **Select & copy signature**.
3. In Outlook.com, go to **Settings (gear) → Account → Signatures**.
4. Create a new signature named "n.abl", click in the editor and paste (Ctrl/Cmd + V).
5. Under **Select default signatures**, choose it for new messages and for replies/forwards. Click **Save**.
6. Send yourself a test email and open it in light mode and dark mode.

Phone apps keep their own signature. In Outlook for iOS/Android it's under Settings → Signature, and it's plain text only.

## 3. If you switch to Gmail

1. Open `preview.html`, then click **Select & copy signature**.
2. In Gmail, go to **Settings (gear) → See all settings → General → Signature → Create new**.
3. Paste into the box, set it as the default for new emails and replies, then click **Save Changes** at the bottom of the page.

Gmail stores pasted images by their URL, so they must already be uploaded.

## Adding a phone number

Set `PHONE` near the top of `build.cjs` (e.g. `'+44 7700 900000'`), rebuild, and copy and paste again. It appears in the contact row as a tap-to-call link.

## Brand notes

**n.abl.** Generated from `public/brand/wordmark.svg` and `public/favicon.svg`. The geometry is unchanged. The build only removes comments and sets the colours from the brand guide as fixed values.

- `nabl-icon.svg` is the brand's own rounded tile, the one enclosure the guide allows. It has an espresso ground, a cream n and an amber dot, so it looks the same on light and dark email.
- `nabl-lockup.svg` is espresso with a deep-amber `#B87718` dot, for light grounds.
- `nabl-lockup-reverse.svg` is cream with an amber `#E9AC57` dot, for dark grounds.
- Both lockups include one dot of clear space on every side.
- The lockups are not used in the signature itself. Email can't swap images for dark mode, and an espresso wordmark disappears on a dark inbox.

**HPE.** The four `hpe-logo-*.svg` files are the official 2025 files you supplied, copied without changes.

- The signature uses `hpe-logo-email.png`: the full-colour positive logo, unaltered, on white, with clear space of half the logo height.
- Email clients don't recolour images. In dark mode it therefore shows as a small white plate, so the black "HPE" letters don't disappear.
- It is shown 14px tall (49px wide).
- **To check:** the half-height clear space comes from HPE's older public standards, and 14px is a judgement call. Check both against the current rules on HPE BrandCentral, and HPE's own email-signature policy, before using this for HPE mail.
