// Vercel function: vercel.json rewrites every request here. dist/ is produced by `npm run build`.
module.exports = require('../dist/vercel.js').app;
