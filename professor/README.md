# eduardojreyes · Unreal Engine Professor site

Static site, no build step. Open `index.html` or serve the folder.

```
index.html      all the copy lives here (chapters, panels, FAQ)
css/style.css   palette, layout, animations
js/main.js      scroll steps, chapter bar, booking overlay, carousels, intro
assets/         photos, badge, placeholder renders
```

## Where to change things
- **Steps**: each `.snaps i` inside a chapter is one scroll step and gets a link (`#formats-studio`, `#faq-pc`...). Add a step = add an `<i id>`, a `[data-item]` and a `[data-panel]`, and bump `--steps`.
- **Booking**: `BOOK` in `js/main.js` (three audiences). Put your Google Calendar appointment-schedule link in `CAL_URL`.
- **Renders**: replace `assets/render-0X.jpg` (booking backgrounds).
- **Module images**: set `style="--img:url(assets/your.jpg)"` on a `.tile-img`.
- **Student work**: replace the `.work-slide` placeholders with `<img>` or video.
- **Reviews**: `REVIEWS` in `js/main.js`.
- **Intro** plays once per browser session (`sessionStorage` key `ejr-intro`).
