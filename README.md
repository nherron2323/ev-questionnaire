# ElectricAce EV Charger Questionnaire

Homeowner EV charger questionnaire for electricace.com: property lookup, NEC 220.82 load calc, charger recommendation, charging-cost estimate, photo upload and consultation scheduling. Submissions go to ElectricAce through Web3Forms.

## How it works

- `index.html` is the whole questionnaire (one self-contained file).
- GitHub Pages hosts it at `https://<username>.github.io/ev-questionnaire/`.
- The Marblism site shows it in an iframe (`embed-snippet.html`). When the page is inside an iframe, it hides its own logo bar and footer and reports its height so the frame resizes to fit.

**Making changes:** edit `index.html` on GitHub (or have Claude push a change) and commit. GitHub Pages republishes in about a minute, and the Marblism page picks it up automatically. No change is needed in Marblism.

## One-time setup

1. Create a public repo named `ev-questionnaire` and upload these files.
2. Repo **Settings → Pages → Source: Deploy from a branch → `main` / root → Save**.
3. Wait about a minute, then open `https://<username>.github.io/ev-questionnaire/` to confirm it loads.
4. In `embed-snippet.html`, replace `YOUR-GITHUB-USERNAME`, then paste the snippet into a custom-code / HTML block on the Marblism EV charging page.
5. Submit one test request and confirm it arrives at the ElectricAce inbox.

## Notes

- The Web3Forms access key in `index.html` is designed to be public (it only allows sending to the inbox registered with it). You can also restrict it to your domains in the Web3Forms dashboard.
- Optional: point a subdomain such as `ev.electricace.com` at GitHub Pages (Settings → Pages → Custom domain) and use that URL in the iframe instead.
