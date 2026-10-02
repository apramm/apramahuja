# Vendored scripts

| file | package | version | source | license |
|---|---|---|---|---|
| `static/js/vendor/model-viewer.min.js` | `@google/model-viewer` | 4.3.1 | https://cdn.jsdelivr.net/npm/@google/model-viewer@4.3.1/dist/model-viewer.min.js | Apache-2.0 (bundles three.js, MIT) |

Self-contained ES module (no external imports). Loaded on demand by `static/js/mark.js`.
To upgrade: re-download the pinned URL with the new version and update this table.

## logos

Small org logos in `assets/images/logos/`, resized by Hugo to 40px WebP (`partials/logo.html`). Downloaded from each org's own site (favicon / apple-touch-icon); no hotlinking.

| file | source | size |
|---|---|---|
| `sahova.png` | https://sahova.com/apple-touch-icon.png | 192×192 |
| `mastercard.png` | https://developer.mastercard.com/mastercard_icon_114x114.png (mastercard.com returns 403 to non-browsers) | 114×114 |
| `aquatic.png` | https://aquaticinformatics.com/apple-icon-120x120.png | 120×120 |
| `optum.png` | https://www.optum.com/content/dam/optum5/skins/icons/favicon.ico (48px frame, converted to PNG) | 48×48 |
| `ubc.png` | https://cdn.ubc.ca/clf/7.0.5/img/touch-icon-iphone-retina.png (eml.ubc.ca uses the same UBC CLF icon) | 180×180 |
| `greattrek.png` | https://www.greattrek.ca/wp-content/uploads/2020.GT_.M.GreatTrek-Logo-120x120-1.png | 120×120 |
