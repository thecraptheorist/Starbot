'use strict';

const moment = require('moment');
const Logger = require('../util/Logger.js');
const { fancyJoin, prettifyPermissions } = require('../util/Util.js');

module.exports = async (client, message) => {
	const { author, channel, guild, member } = message;
	if (!client._ready || message.system || (guild && !guild.available)) return undefined;


	await author.findCreateFind();
	let _guild;
	if (guild) {
		await guild.cacheClient();
		_guild = await guild.findCreateFind();

		if (!channel.clientHasPermissions()) return undefined;
	}

	if (author.bot) return undefined;
	if (await channel.ignored() && !client.isOwner(author.id)) return undefined;
	if (author.ignored && !client.isOwner(author.id)) return undefined;
	if (channel.awaiting.has(author.id)) return undefined;
	if (guild) {
		if (_guild.ignoredUsers.includes(author.id) && !client.isOwner(author.id)) return undefined;
		if (_guild.ignoredRoles.some(id => member.roles.cache.has(id)) && !client.isOwner(author.id)) return undefined;
	}

	await message.parse();
	if (!message.command || message._isTag) return undefined;

	if (message.DM && message.command.guildOnly) {
		return channel.embed('This command can only be used in a server!');
	}

	let permissions = message.missingAuthorPermissions;
	if (permissions.length && !client.isOwner(author.id)) {
		permissions = fancyJoin(prettifyPermissions(permissions));

		return channel.embed(`You need the following permissions to run this command: ${permissions}`);
	}

	if (message.command.ownerOnly && !client.isOwner(author.id)) {
		return channel.embed('This is an owner-only command!');
	}

	let timeLeft = await message.command.checkThrottle(message);
	if (timeLeft) {
		timeLeft = moment(timeLeft).fromNow(true);

		return channel.embed(`You are sending commands too fast! Please wait ${timeLeft} to use this command again.`);
	}

	if (message.command.clientPermissions.length && !message.DM) {
		const canRun = channel.clientHasPermissions(message.command.clientPermissions);
		if (canRun) {
			const _permissions = channel.permissionsFor(guild.me);
			const missingPermissions = message.command.clientPermissions.filter(perm => !_permissions.has(perm));
			const formatted = fancyJoin(prettifyPermissions(missingPermissions));

			return channel.embed(`The bot needs the following permissions to run this command: ${formatted}`);
		}
	}

	message.command.throttle(message);

	try {
		await message.command.run(message);
	} catch (err) {
		if (channel.awaiting.has(author.id)) channel.awaiting.delete(author.id);
		channel.error(err, 'runCommand');

		Logger.err('Failed to run command');
		Logger.stack(err);
	}

	return undefined;
};
