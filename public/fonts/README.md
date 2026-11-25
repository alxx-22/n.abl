# Fonts

Self-hosted, so no visitor's IP address is sent to a font host. The reasoning is
in `business/02-brand/brand-guidelines.md`, section 5.6. The `@font-face` rules
are in `fonts.css`.

Every family here is under the SIL Open Font License 1.1. The licence has to
travel with the files, which is why each family's `*-OFL.txt` sits beside its
fonts and is served with them.

| Family | Files | Weights | Version | Source | Licence |
|---|---|---|---|---|---|
| Manjari | `Manjari-Thin-*`, `Manjari-Regular-*`, `Manjari-Bold-*` (`latin` and `latin-ext` of each) | 100, 400, 700, static | 2.000 (Google Fonts v14) | Google Fonts static files, links below | `Manjari-OFL.txt` |
| JetBrains Mono | `JetBrainsMono-latin.woff2`, `JetBrainsMono-latin-ext.woff2` | 400 to 500, variable | not recorded | Google Fonts | `JetBrainsMono-OFL.txt` |
| Space Grotesk | `SpaceGrotesk-latin.woff2`, `SpaceGrotesk-latin-ext.woff2` | 400 to 700, variable | not recorded | Google Fonts | `SpaceGrotesk-OFL.txt` |
| Inter Tight | `InterTight-latin.woff2`, `InterTight-latin-ext.woff2` | 400 to 600, variable | not recorded | Google Fonts | `InterTight-OFL.txt` |

Manjari is the brand typeface from the 2026-11 revision. Space Grotesk and Inter
Tight retire when the website moves to Manjari. JetBrains Mono stays, for keys and
codes in the product only.

## Manjari, file by file

These are Google's own subsets, downloaded unchanged. The `latin` file holds 213
characters and the `latin-ext` file 281.

| File | Bytes | From |
|---|---|---|
| `Manjari-Thin-latin.woff2` | 12,208 | `https://fonts.gstatic.com/s/manjari/v14/k3kSo8UPMOBO2w1UdbrYLGHE.woff2` |
| `Manjari-Thin-latin-ext.woff2` | 13,520 | `https://fonts.gstatic.com/s/manjari/v14/k3kSo8UPMOBO2w1UdbrYImHE.woff2` |
| `Manjari-Regular-latin.woff2` | 12,400 | `https://fonts.gstatic.com/s/manjari/v14/k3kQo8UPMOBO2w1UfdnoLg.woff2` |
| `Manjari-Regular-latin-ext.woff2` | 13,608 | `https://fonts.gstatic.com/s/manjari/v14/k3kQo8UPMOBO2w1UfdfoLg.woff2` |
| `Manjari-Bold-latin.woff2` | 12,732 | `https://fonts.gstatic.com/s/manjari/v14/k3kVo8UPMOBO2w1UdWLNO0bhLA.woff2` |
| `Manjari-Bold-latin-ext.woff2` | 14,136 | `https://fonts.gstatic.com/s/manjari/v14/k3kVo8UPMOBO2w1UdWLNO0jhLA.woff2` |

Manjari has no arrows (`→ ← ↗`) and no ticks (`✓ ✔`). Draw those as SVG icons
rather than typing them, or a system font fills the gap in a different style.

The licence text came from `google/fonts` on GitHub (`ofl/<family>/OFL.txt`),
the same source Google Fonts publishes from.
