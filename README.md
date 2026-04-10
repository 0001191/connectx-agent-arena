# ConnectX GitHub Pages Frontend

This folder is a static frontend intended for GitHub Pages. It talks to the Hugging Face Space backend in `hf_space_connectx`.

## Before publishing

1. Deploy the backend folder `hf_space_connectx` to a Docker Space.
2. Copy your final Space URL into `config.js`.
3. Set `ALLOWED_ORIGINS` on the Space to your GitHub Pages origin.

Example:

```js
window.CONNECTX_API_BASE = "https://your-space-name.hf.space";
```

## Local preview

You can serve this folder with any static server, for example:

```bash
python -m http.server 8080
```

Then open:

`http://127.0.0.1:8080/gh_pages_connectx/`

## GitHub Pages

Publish the contents of this folder to a GitHub repository and enable GitHub Pages from the root branch or `docs/` folder.
