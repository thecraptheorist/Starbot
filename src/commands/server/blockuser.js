'use strict';

const { oneLine } = require('common-tags');
const StarbotCommand = require('../../structures/StarbotCommand.js');

class BlockUser extends StarbotCommand {
	constructor(client) {
		super(client, {
			name: 'blockuser',
			description: 'prevent someone from using the bot',
			group: 'server',
			usage: '',
			args: [],
			aliases: ['blacklist', 'denylist'],
			userPermissions: ['MANAGE_GUILD'],
			clientPermissions: [],
			guildOnly: true,
			ownerOnly: false,
			throttle: 5000,
		});
	}

	run(message) {
		const { client, author, channel, guild } = message;
		const { cache, models } = message.client.db;
		let user = null;

		const filter = msg => msg.author.id === author.id;
		const options = { time: 15000 };
		const re = /^cancel$/i;

		channel.awaiting.add(author.id);

		return askUser();

		function cancel() {
			channel.embed(client.embed(oneLine`
				The ignore process has been successfully cancelled.
				All changes have been discarded.
				`, true)
				.setTitle(`Block a user on ${guild.name}`));

			return channel.awaiting.delete(author.id);
		}

		function timeUp() {
			channel.embed(client.embed(oneLine`
				Sorry but the message collector timed out.
				Please run the command again.
				`, true)
				.setTitle(`Block a user on ${guild.name}`));

			return channel.awaiting.delete(author.id);
		}

		async function askUser() {
			const question = await channel.embed(client.embed(`
				Please mention the user that you wish to block.
				Alternatively, you can enter their id.
				Type \`cancel\` at any time to stop the process.
			`, true)
				.setTitle(`Block a user on ${guild.name}`));

			const collector = channel.createMessageCollector(filter, options);

			collector.on('collect', msg => {
				if (re.test(msg.content)) {
					return collector.stop('cancel');
				}

				const id = (msg.content.match(/^(<@!?\d+>|\d+)$/) || [])[1];

				if (guild.ignores.has(id + guild.id) && !client.isOwner(author.id)) {
					return channel.embed(`<@!${id}> is already blocked!`);
				}

				user = client.users.cache.get(id);
				if (!user) {
					return channel.embed('Sorry but the bot couldn\'t find that user.');
				}

				if (author.id === id) {
					return channel.embed(`<@!${id}>, why are you trying to block yourself?`);
				}

				if (client.users.cache.get(id).bot) {
					return channel.embed('Please pick a **user**!');
				}

				return collector.stop({ user_id: id });
			});

			collector.on('end', async (collected, reason) => {
				await question.delete();

				if (reason === 'cancel') return cancel();
				if (reason === 'time') return timeUp();

				return askReason(reason);
			});
		}

		async function askReason(obj) {
			const question = await channel.embed(client.embed(`
				Please enter the reason you wish to block <@!${obj.user_id}>.
				Type \`skip\` to skip this step.
				Type \`cancel\` at any time to stop the process.
			`, true)
				.setTitle(`Block a user on ${guild.name}`));

			const collector = channel.createMessageCollector(filter, options);

			collector.on('collect', msg => {
				if (re.test(msg.content)) {
					return collector.stop('cancel');
				}

				if (/^skip$/i.test(msg.content)) {
					return collector.stop({
						user_id: obj.user_id,
						reason: 'None',
					});
				}

				if (msg.content.length > 250) {
					return channel.embed('The reason must be below 250 characters long!');
				}

				return collector.stop({
					user_id: obj.user_id,
					reason: msg.content,
				});
			});

			collector.on('end', async (collected, reason) => {
				await question.delete();

				if (reason === 'cancel') return cancel();
				if (reason === 'time') return timeUp();

				if (client.isOwner(author.id)) {
					return askGlobal(reason);
				} else {
					return finalise(reason);
				}
			});
		}

		async function askGlobal(obj) {
			const question = await channel.embed(client.embed(`
				Would you like to block <@!${obj.user_id}> globally?
				Type \`(y)es\` or \`(n)o\` to confirm.
				Type \`cancel\` at any time to stop the process.
			`, true)
				.setTitle(`Block a user on ${guild.name}`));

			const collector = channel.createMessageCollector(filter, options);

			collector.on('collect', msg => {
				if (re.test(msg.content)) {
					return collector.stop('cancel');
				}

				const response = (msg.content.match(/^(y(?:es)?|no?)$/i) || [])[1];
				const yes = /^y(?:es)?$/i.test(response);
				const no = /^no?$/i.test(response);

				if (!response) {
					return channel.embed(`Please provide a valid response!`);
				}

				if (no && guild.ignores().has(obj.user_id + guild.id)) {
					return channel.embed(`<@!${obj.user_id}> is already blocked!`);
				}

				if (yes && cache.GlobalIgnore.has(obj.user_id)) {
					return channel.embed(`<@!${obj.user_id}> is already globally blocked!`);
				}

				return collector.stop({
					user_id: obj.user_id,
					reason: obj.reason,
					global_: yes,
				});
			});

			collector.on('end', async (collected, reason) => {
				await question.delete();

				if (reason === 'cancel') return cancel();
				if (reason === 'time') return timeUp();

				return finalise(reason);
			});
		}

		async function finalise({ user_id, reason, global_ }) {
			if (global_) {
				const [record] = await user.queue(() => models.GlobalIgnore.upsert({
					user_id: user_id,
					executor_id: author.id,
					reason: reason,
				}));

				cache.GlobalIgnore.set(user_id, record);

				await channel.embed(`<@!${user_id}> has been globally blocked. Reason: ${reason}`);
			} else {
				const [record] = await user.queue(() => models.Ignore.upsert({
					user_id: user_id,
					guild_id: guild.id,
					executor_id: author.id,
					reason: reason,
				}));

				cache.Ignore.set(user_id + guild.id, record);

				await channel.embed(`<@!${user_id}> has been blocked. Reason: ${reason}`);
			}

			return channel.awaiting.delete(author.id);
		}
	}
}

module.exports = BlockUser;