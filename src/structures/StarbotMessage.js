'use strict';

const Discord = require('discord.js');
const { sanitise } = require('../util/Util.js');

module.exports = Discord.Structures.extend('Message', Message => {
	class StarbotMessage extends Message {
		constructor(...args) {
			super(...args);

			this.prefix = undefined;
			this.raw = { command: undefined, args: undefined };
			this.command = undefined;
			this.args = [];
			this.tag = undefined;
		}

		get ignored() {
			return this.channel.awaiting.has(this.author.id) || this.author.ignored ||
				(this.guild && this.channel.ignored) ||
				(this.guild && this.guild.ignores.has(this.author.id + this.guild.id));
		}

		get DM() {
			return this.channel.type === 'dm';
		}

		get missingAuthorPermissions() {
			const missingPerms = [];

			for (const permission of this.command.userPermissions) {
				if (!this.member.permissions.has(permission)) missingPerms.push(permission);
			}

			return missingPerms;
		}

		async sendTag() {
			if (!this.guild.settings.tagsEnabled) return;

			const response = this.tag.response.replace(/<guild_name>/ig, this.guild.name)
				.replace(/<channel>/ig, this.channel.toString())
				.replace(/<author>/ig, this.author.toString());

			await this.channel.send(response);

			const upsertObj = this.tag.toJSON();
			upsertObj.uses++;

			const [updatedTag] = await this.guild.queue(() => this.client.db.models.Tag.upsert(upsertObj));

			this.client.db.cache.Tag.set(this.guild.id + this.tag.name, updatedTag);
		}

		parse() {
			const prefix = this.guild && this.guild.settings.prefix ?
				sanitise(this.guild.settings.prefix, true) :
				this.client.prefix;
			const prefixPattern = new RegExp(`^(<@!?${this.client.user.id}>\\s+|${prefix})(\\S+)`);

			const matched = this.content.match(prefixPattern);
			if (matched) {
				this.prefix = matched[1];
				this.raw.command = matched[2];
			}

			if (this.guild) {
				this.tag = this.guild.tags.get(this.guild.id + this.raw.command.toLowerCase());
			}

			let cleanedCmdName = this.raw.command.toLowerCase().trim();
			if (this.client.aliases.has(cleanedCmdName)) {
				cleanedCmdName = this.client.aliases.get(cleanedCmdName);
			}

			this.command = this.client.commands.find(cmd => cleanedCmdName === cmd.name);
			if (this.command) {
				this.raw.args = this.content.slice(this.prefix.length + this.raw.command.length).trim();

				const re = /(?:(?=["'])(?:"[^"\\]*(?:\\[^][^"\\]*)*"|'[^'\\]*(?:\\[^][^'\\]*)*')|\S+)(?=\s+|$)/g;
				const matches = this.raw.args.matchAll(re);

				this.args = Array.from(matches).map(arg => arg[0].replace(/^("|')([^]*)\1$/g, '$2')
					.replace(/<single_quote>/gi, '\'')
					.replace(/<double_quote>/gi, '"'));
			}
		}
	}

	return StarbotMessage;
});
