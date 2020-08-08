'use strict';

const logger = require('../util/logger.js');

class StarbotQueue {
	constructor() {
		this.list = [];
		this.isProcessing = false;
	}

	get length() {
		return this.list.length;
	}

	add(promiseFunction) {
		this.list.push(promiseFunction);

		if (!this.isProcessing) this.process();

		return null;
	}

	process() {
		this.isProcessing = true;

		const promiseFunction = this.list.shift();

		if (!promiseFunction) {
			this.isProcessing = false;
		} else {
			promiseFunction().catch(err => {
				logger.err(err, 'Failed to execute queue promise function');
			}).finally(() => this.process());
		}
	}
}

module.exports = StarbotQueue;