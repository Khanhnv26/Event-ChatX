# EventChat frontend

React + TypeScript + Vite. Requires Node.js 24.

Run from this directory:

```sh
npm ci
npm run dev
npm test
npm run lint
npm run build
```

The development server runs on port 5173 and proxies `/api` and `/ws` to the backend on port 8080. Application code is in `src/`; tests are in `tests/`.

See the [project README](../README.md), [testing guide](../docs/testing.md) and [deployment guide](../docs/deployment.md) for backend dependencies, production images and environment settings.
