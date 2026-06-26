# Vendored runtime libraries

These minified UMD builds are bundled so the prototype runs with **no build step and no network**
(just a static file server). They are third-party libraries, not part of Rhyza, and keep their
own licenses:

| File | Package | Version | License |
|------|---------|---------|---------|
| `react.production.min.js` | [react](https://www.npmjs.com/package/react) | 18.3.1 | MIT |
| `react-dom.production.min.js` | [react-dom](https://www.npmjs.com/package/react-dom) | 18.3.1 | MIT |
| `babel.min.js` | [@babel/standalone](https://www.npmjs.com/package/@babel/standalone) | 7.25.6 | MIT |

To refresh them:

```bash
npm install react@18.3.1 react-dom@18.3.1 @babel/standalone@7.25.6
cp node_modules/react/umd/react.production.min.js prototype/vendor/
cp node_modules/react-dom/umd/react-dom.production.min.js prototype/vendor/
cp node_modules/@babel/standalone/babel.min.js prototype/vendor/
```
