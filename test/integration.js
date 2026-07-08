'use strict';

const path = require('path');
const { tests } = require('@iobroker/testing');

// Run integration tests: start a temporary js-controller and this adapter,
// verifying the adapter boots without crashing (no credentials configured).
tests.integration(path.join(__dirname, '..'));
