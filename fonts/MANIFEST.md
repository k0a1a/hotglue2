# Font bundle manifest

Every family below was downloaded from **Google Fonts** (self-hosted WOFF2, latin
subset), and Google Fonts only carries fonts whose licenses permit redistribution,
webfont serving and commercial use. Each family's authoritative **OFL.txt** ships
in its directory (the OFL requires the license to travel with the font). This
record is the one SOW-font-bundle.md asks for: font → license → source → files.

| family | license | source | files |
|---|---|---|---|
| Inter | OFL 1.1 | fonts.googleapis.com (ofl/inter) | 400, 400i, 700, 700i |
| Lora | OFL 1.1 | fonts.googleapis.com (ofl/lora) | 400, 400i, 700, 700i |
| Space Mono | OFL 1.1 | fonts.googleapis.com (ofl/spacemono) | 400, 400i, 700, 700i |
| Press Start 2P | OFL 1.1 | fonts.googleapis.com (ofl/pressstart2p) | 400 |
| VT323 | OFL 1.1 | fonts.googleapis.com (ofl/vt323) | 400 |
| Silkscreen | OFL 1.1 | fonts.googleapis.com (ofl/silkscreen) | 400, 700 |
| UnifrakturMaguntia | OFL 1.1 | fonts.googleapis.com (ofl/unifrakturmaguntia) | 400 |
| Anton | OFL 1.1 | fonts.googleapis.com (ofl/anton) | 400 |
| Archivo Black | OFL 1.1 | fonts.googleapis.com (ofl/archivoblack) | 400 |
| Caveat | OFL 1.1 | fonts.googleapis.com (ofl/caveat) | 400, 700 |
| Shadows Into Light | OFL 1.1 | fonts.googleapis.com (ofl/shadowsintolight) | 400 |
| Rubik Glitch | OFL 1.1 | fonts.googleapis.com (ofl/rubikglitch) | 400 |
| Rubik Wet Paint | OFL 1.1 | fonts.googleapis.com (ofl/rubikwetpaint) | 400 |
| Rubik Puddles | OFL 1.1 | fonts.googleapis.com (ofl/rubikpuddles) | 400 |

Notes:

- **Reserved Font Names**: several of these declare RFNs in their OFL.txt (e.g.
  UnifrakturMaguntia). The files ship UNMODIFIED and under their own names, so
  the RFN clause is satisfied; do not rename files or family names.
- **Subsetting**: every file is the latin subset Google serves (unicode-range
  starts at U+0000-00FF); OFL permits subsetting. The @font-face rules that
  declare the set are in `fonts/fonts.css`.
- **Category spread** (per the SOW): sans Inter, serif Lora, mono Space Mono;
  pixel Press Start 2P / VT323 / Silkscreen; blackletter UnifrakturMaguntia;
  display Anton / Archivo Black; handwritten Caveat / Shadows Into Light;
  weird Rubik Glitch / Rubik Wet Paint / Rubik Puddles. 14 families, inside the
  SOW's 12–18.
- No dafont-sourced fonts are in this bundle, so no per-font license archaeology
  beyond the OFL.txt checks was needed.
