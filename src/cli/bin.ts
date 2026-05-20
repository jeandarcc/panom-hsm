#!/usr/bin/env node
import { HsmCli } from "./HsmCli.js";

const cli = new HsmCli({ argv: process.argv.slice(2) });
cli.run().then((code) => {
  process.exit(code);
}).catch((error) => {
  console.error(error);
  process.exit(1);
});
