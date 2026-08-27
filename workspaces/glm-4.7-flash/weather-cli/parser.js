const { parseArgs: parseArgsNode } = require('node:util');

function parseLocation(locationArg) {
  if (!locationArg) return null;
  if (!locationArg.trim()) return null;
  return locationArg;
}

function parseArgs(args) {
  const { values } = parseArgsNode({
    args,
    options: {},
    strict: true
  });

  const location = parseLocation(values._[0]);
  return { location };
}

module.exports = { parseArgs, parseLocation };