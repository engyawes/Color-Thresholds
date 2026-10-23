# Do Vision Encoders Exhibit Human-like Color Thresholds?

Project page for the CIC 2026 paper by Engy Ehab, Pablo Hernández-Cámara, Nahla Belal, Jesús Malo, Javier Vazquez-Corral and Alexandra Gomez-Villa.

## Contents

```
index.html                          the project page (self-contained, no build step)
static/paper.pdf                    the paper
static/images/fig1_similarity_fields.png
static/images/fig2_miou_ranking.png
static/js/data.js                   similarity-field grid, colormap and Figure 3 IoU values
static/js/explainer.js              interactive "how one similarity field is built" walkthrough
static/js/fig2.js                   interactive Figure 2 (hover for model and mIoU)
static/js/fig3.js                   interactive Figure 3 (hover for values, toggle models)
.nojekyll                           tells GitHub Pages to serve files as-is
```

## Before publishing

Edit `index.html` and replace:

1. `https://github.com/USERNAME/REPO` with the code repository URL.
2. Each author's `href="#"` with their homepage (or remove the link).
3. The arXiv button: add the link and remove `class="... disabled"` once the preprint is out.
4. The BibTeX entry once the proceedings details (pages, DOI) are known.

## Interactive parts

- **Explainer** uses the DINOv2 similarity field for reference (a*, b*) = (30, 52) at chroma 60, reconstructed from the contour plot, and samples 500 points in the browser. To use another model or reference, regenerate the `field` entry in `static/js/data.js` and update `REF` and `R_AB` at the top of `explainer.js`.
- **Figures 2 and 3** values in `data.js` were read from the vector paths of the paper's figures. If you have the original CSV, replace the `fig2` / `fig3.chroma` entries with the exact numbers.

## Deploying on GitHub Pages

**Option A: a dedicated page repo**

1. Create a public repository, e.g. `color-thresholds`.
2. Upload all files in this folder to the root of the `main` branch.
3. Settings → Pages → Source: *Deploy from a branch* → Branch: `main`, folder `/ (root)` → Save.
4. The page appears at `https://<username>.github.io/color-thresholds/` after a minute or two.

**Option B: inside the code repository**

1. Put these files in a `docs/` folder of the code repo.
2. Settings → Pages → Branch: `main`, folder `/docs` → Save.

## Page template

The page template is released under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).
