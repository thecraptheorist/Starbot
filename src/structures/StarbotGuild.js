'use strict';

const Discord = require('discord.js');
const Starboard = require('./Starboard.js');

module.exports = Discord.Structures.extend('Guild', Guild => class StarbotGuild extends Guild {
	constructor(...args) {
		super(...args);

		this.starboard = new Starboard(this);
	}

	get stars() {
		return this.client.db.models.Star.cache.filter(star => star.guild_id === this.id);
	}

	get tags() {
		return this.client.db.models.Tag.cache.filter(tag => tag.guild_id === this.id);
	}

	get model() {
		return this.client.db.models.Guild.cache.get(this.id);
	}

	async findCreateFind() {
		const cached = this.client.db.models.Guild.cache.get(this.id);
		if (cached) return cached;

		const [_guild] = await this.client.db.models.Guild.q.add(this.id, () =>
			this.client.db.models.Guild.findCreateFind({ where: { id: this.id } }),
		);
		return _guild;
	}

	delete() {
		return this.client.db.transaction(async t => {
			await this.client.db.models.Star.destroy({
				where: { guild_id: this.id },
			}, { transaction: t });

			await this.client.db.models.Tag.destroy({
				where: { guild_id: this.id },
			}, { transaction: t });

			this.client.db.models.Guild.q.add(this.id, () => this.model.destroy({ transaction: t }));
		});
	}

	cacheClient() {
		return this.members.fetch(this.client.user.id);
	}

	checkClientPermissions(perms = []) {
		if (!perms.length) perms = this.client.basePermissions;

		return this.guild.members.cache.get(this.client.user.id).permissions.has(perms);
	}
});
