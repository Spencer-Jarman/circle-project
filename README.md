# endmid.gg — Circle customisations

Custom styling, markup and JavaScript for the [endmid.gg](https://www.endmid.gg)
Circle community, served to the live site over the jsDelivr CDN.

## Layout

| File | Contains |
| --- | --- |
| `src/styles.css` | All CSS. Google Fonts `@import` **must** stay on line 1. |
| `src/markup.html` | The Shorts player, Twitch and games containers. Injected into `<body>` by the loader. |
| `src/app.js` | All JavaScript — sections 1–4. |

Each file is now pure to its language. They used to be two mixed files that
crammed HTML, CSS and JS together to fit inside Circle's snippet character
limit; loading from GitHub removes that limit, so the split was undone.

## What goes in Circle

Paste these once and never touch them again. Everything else is edited here.

**Settings → Code snippets → head / HTML box:**

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/Spencer-Jarman/circle-project@main/src/styles.css">
```

**Settings → Code snippets → JS box** (Circle wraps this in `<script>`, so it is
raw JS, not a `<script>` tag):

```js
(function () {
  var BASE = 'https://cdn.jsdelivr.net/gh/Spencer-Jarman/circle-project@main/src/';
  function boot() {
    fetch(BASE + 'markup.html')
      .then(function (r) { return r.text(); })
      .then(function (html) {
        document.body.insertAdjacentHTML('beforeend', html);
        var s = document.createElement('script');
        s.src = BASE + 'app.js';
        document.head.appendChild(s);
      });
  }
  document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', boot) : boot();
})();
```

The markup is injected *before* `app.js` loads, so every section finds the nodes
it queries. Order matters — don't reorder those two steps.

## API keys

There are none in this repo, and none should ever be added. The YouTube and
Twitch credentials live in AWS Lambda environment variables; the browser calls
the Lambda Function URL (`PROXY_BASE` in `src/app.js`) and the Lambda adds the
credentials server side.

## Deploying a change

1. Edit the file here, commit, push to `main`.
2. jsDelivr caches `@main` for up to 24 hours. To publish immediately, visit:
   - https://purge.jsdelivr.net/gh/Spencer-Jarman/circle-project@main/src/styles.css
   - https://purge.jsdelivr.net/gh/Spencer-Jarman/circle-project@main/src/app.js
   - https://purge.jsdelivr.net/gh/Spencer-Jarman/circle-project@main/src/markup.html
3. Hard-refresh the community and check the Network tab for `200`s.

## If a file outgrows itself

Split by feature (`src/css/nav.css`, `src/js/twitch.js`, …) and merge them into
one request with jsDelivr's combine endpoint rather than adding more `<script>`
tags:

```
https://cdn.jsdelivr.net/combine/gh/Spencer-Jarman/circle-project@main/src/css/base.css,gh/Spencer-Jarman/circle-project@main/src/css/nav.css
```
