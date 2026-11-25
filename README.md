# Site intake forms

Self-contained questionnaires hosted on GitHub Pages and embedded on the company website in an iframe. Each form lives in its own folder.

| Folder | Form | Live URL | Embed code |
|---|---|---|---|
| `ev/` | Homeowner EV charger questionnaire | `https://nherron2323.github.io/ev-questionnaire/ev/` | `embed/ev.html` |
| `generator/` | Generator sizing questionnaire | `https://nherron2323.github.io/ev-questionnaire/generator/` | `embed/generator.html` |
| `site-visit/` | ElectricAce Site Visit worksheet (crew tool: residential, generator, EV, heat pump) | `https://nherron2323.github.io/ev-questionnaire/site-visit/` | `embed/site-visit.html` (link button) |

The `site-visit/` folder is the one exception to "one file per form": it's a multi-page tool (`index.html` plus a page per job type and shared `wiz.css` / `*.js` files). It's meant to open in its own tab on a phone rather than inside an iframe, so its embed code is a link button.

## How it works

- Each folder holds one `index.html` (the whole form in one file).
- GitHub Pages serves each folder at `https://nherron2323.github.io/ev-questionnaire/<folder>/`.
- The website shows a form with the iframe code in that form's `embed/<folder>.html` file. Inside an iframe, the form hides its own logo bar and footer and reports its height and where to scroll, so the frame fits it and each new step starts at the top.
- Every page carries a `noindex` tag so search engines leave these URLs out. The root `index.html` is a blank page.

**Making changes:** edit a form's `index.html` and commit. GitHub Pages republishes in about a minute and the website shows the change. Nothing needs to change on the website.

**Adding a form:** create a new folder with its `index.html` (keep the `noindex` tag) and embed it with a copy of an `embed/` file pointing at the new folder. The form needs the same embedded-mode code (hide logo bar and footer, post `ea-form-height`, `ea-form-top` and `ea-form-scroll` messages).

## Notes

- The Web3Forms access key in the forms is meant to be public: it can only send to the inbox registered with it. It can also be restricted to your domains in the Web3Forms dashboard.
