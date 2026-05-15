Place licensed Gilroy webfont files in this folder to fully lock typography across machines.

Expected files:
- `Gilroy-Semibold.woff2`
- `Gilroy-Bold.woff2`
- `Gilroy-ExtraBold.woff2`

After these files are added, update `src/index.css` to point `@font-face` at `/fonts/...` sources instead of relying on `local(...)` only.
