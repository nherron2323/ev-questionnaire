# Site intake forms

Self-contained questionnaires hosted on GitHub Pages and embedded on the company website in an iframe. Each form lives in its own folder.

| Folder | Form | Live URL |
|---|---|---|
| `ev/` | Homeowner EV charger questionnaire | `https://nherron2323.github.io/hankisadog/ev/` |

## How it works

- Each folder holds one `index.html` (the whole form in one file).
- GitHub Pages serves each folder at `https://nherron2323.github.io/hankisadog/<folder>/`.
- The website shows a form with the iframe code in `embed-snippet.html`. Inside an iframe, the form hides its own logo bar and footer and reports its height so the frame fits it.
- Every page carries a `noindex` tag so search engines leave these URLs out. The root `index.html` is a blank page.

**Making changes:** edit a form's `index.html` and commit. GitHub Pages republishes in about a minute and the website shows the change. Nothing needs to change on the website.

**Adding a form:** create a new folder with its `index.html` (keep the `noindex` tag) and embed it with a copy of `embed-snippet.html` pointing at the new folder.

## Notes

- The Web3Forms access key in `ev/index.html` is meant to be public: it can only send to the inbox registered with it. It can also be restricted to your domains in the Web3Forms dashboard.
