'use strict';

const { DataTypes, Model } = require('sequelize');
const { db } = require('../structures/StarbotDatabase.js');
const queue = new (require('../structures/StarbotQueueManager.js'))();
const cache = new (require('discord.js').Collection)();
const User = require('./User.js');

class OptOut extends Model {
	static get q() {
		return queue;
	}

	static get cache() {
		return cache;
	}
}

OptOut.init({
	user_id: {
		type: DataTypes.STRING,
		primaryKey: true,
		allowNull: false,
	},
	executor_id: {
		type: DataTypes.STRING,
		allowNull: false,
	},
	reason: {
		type: DataTypes.STRING,
		defaultValue: 'None',
	},
}, {
	hooks: {
		// Emitted on model class methods with find keyword
		afterFind: val => {
			if (!val) return;

			if (Array.isArray(val) && val.length) {
				val.map(instance =>
					!OptOut.cache.has(instance.user_id) ? OptOut.cache.set(instance.user_id, instance) : undefined,
				);
			} else if (!OptOut.cache.has(val.user_id)) {
				OptOut.cache.set(val.user_id, val);
			}
		},

		// Emitted on model instances that are destroyed
		// Model classes require custom handling for destructive actions such as destroy() and bulkDelete()
		afterDestroy: instance => OptOut.cache.delete(instance.user_id),

		// Emitted on model instances that have save() or update() called on them
		afterSave: instance => OptOut.cache.set(instance.user_id, instance),

		// Emitted on model class method upsert()
		afterUpsert: ([instance]) => OptOut.cache.set(instance.user_id, instance),
	},
	sequelize: db,
});

User.hasMany(OptOut, { foreignKey: 'user_id' });
User.hasMany(OptOut, { foreignKey: 'executor_id' });
OptOut.belongsTo(User, { as: 'user', foreignKey: 'user_id' });
OptOut.belongsTo(User, { as: 'executor', foreignKey: 'executor_id' });

module.exports = OptOut;
