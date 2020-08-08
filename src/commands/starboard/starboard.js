'use strict';

const { oneLine } = require('common-tags');
const StarbotCommand = require('../../structures/StarbotCommand.js');

class Starboard extends StarbotCommand {
	constructor(client) {
		super(client, {
			name: 'starboard',
			description: 'enable or disable the starboard',
			group: 'starboard',
			usage: '<boolean>',
			args: [{
				name: '<boolean>',
				optional: false,
				description: 'a literal boolean, `enable` or `disable`',
				example: 'enable',
			}],
			aliases: ['sb'],
			userPermissions: ['MANAGE_GUILD'],
			clientPermissions: [],
			guildOnly: true,
			ownerOnly: false,
			throttle: 5000,
		});
	}

	async run(message) {
		const { args, channel, guild } = message;
		const { cache, models } = message.client.db;

		if (!args[0]) {
			return channel.embed('Please provide a boolean resolvable!');
		}

		let boolean = (args[0].match(/^(e(?:nabled?)?|d(?:isabled?)|true|false|1|0)$/i) || [])[1];

		if (!boolean) {
			return channel.embed('Please provide a valid boolean resolvable!');
		}

		boolean = Boolean(/^e(?:nabled?)?$/i.test(boolean) ? true : /^d(?:isabled?)?$/i.test(boolean) ? false : boolean);

		const [updatedGuild] = await guild.queue(() => models.Guild.upsert({
			id: guild.id,
			starboardEnabled: boolean,
		}));

		cache.Guild.set(guild.id, updatedGuild);

		return channel.embed(oneLine`
			The starboard for this server has been ${boolean ? 'enabled' : 'disabled'}.
			Make sure to also set the starboard channel so the bot posts starred messages.
		`);
	}
}

module.exports = Starboard;