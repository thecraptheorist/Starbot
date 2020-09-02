'use strict';

const Discord = require('discord.js');
const { formatErrorDiscord } = require('../util/Util.js');

module.exports = Discord.Structures.extend('DMChannel', DMChannel => {
	class StarbotDMChannel extends DMChannel {
		constructor(...args) {
			super(...args);

			this.awaiting = new Set();
		}

		async ignored() {
			const OptOut = await this.client.db.models.OptOut.findByPk(this.recipient.id);

			return Boolean(OptOut);
		}

		embed(text, fancy = false) {
			const toBeSent = this.client.embed(text, fancy);

			return this.send(toBeSent);
		}

		error(err, code) {
			return this.send(formatErrorDiscord(err, code));
		}
	}

	return StarbotDMChannel;
});
