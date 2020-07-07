#!/usr/bin/env node

const { processOutputs } = require("../dist/otapi");

process.stdout.write(processOutputs());
