/**
 * Module dependencies
 */
import it from '../../it';
import User from '../../models/user';
import Following from '../../models/following';
import event from '../../event';
import serializeUser from '../../serializers/user';

/**
 * Unfollow a user
 *
 * @param {any} params
 * @param {any} user
 * @return {Promise<any>}
 */
module.exports = (params, user) => new Promise(async (res, rej) => {
	const follower = user;

	// Get 'user_id' parameter
	const [userId, userIdErr] = it(params.user_id, 'id', true);
	if (userIdErr) return rej('invalid user_id param');

	// Check if the followee is yourself
	if (user._id.equals(userId)) {
		return rej('followee is yourself');
	}

	// Get followee
	const followee = await User.findOne({
		_id: userId
	}, {
		fields: {
			data: false,
			profile: false
		}
	});

	if (followee === null) {
		return rej('user not found');
	}

	// Check not following
	const exist = await Following.findOne({
		follower_id: follower._id,
		followee_id: followee._id,
		deleted_at: { $exists: false }
	});

	if (exist === null) {
		return rej('already not following');
	}

	// Delete following
	await Following.update({
		_id: exist._id
	}, {
		$set: {
			deleted_at: new Date()
		}
	});

	// Send response
	res();

	// Decrement following count
	User.update({ _id: follower._id }, {
		$inc: {
			following_count: -1
		}
	});

	// Decrement followers count
	User.update({ _id: followee._id }, {
		$inc: {
			followers_count: -1
		}
	});

	// Publish follow event
	event(follower._id, 'unfollow', await serializeUser(followee, follower));
});
