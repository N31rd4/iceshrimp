/**
 * Module dependencies
 */
import it from 'cafy';
import Post from '../../models/post';
import serialize from '../../serializers/post';

/**
 * Show a context of a post
 *
 * @param {any} params
 * @param {any} user
 * @return {Promise<any>}
 */
module.exports = (params, user) => new Promise(async (res, rej) => {
	// Get 'post_id' parameter
	const [postId, postIdErr] = it(params.post_id, 'id', true);
	if (postIdErr) return rej('invalid post_id param');

	// Get 'limit' parameter
	const [limit = 10, limitErr] = it(params.limit).expect.number().range(1, 100).get();
	if (limitErr) return rej('invalid limit param');

	// Get 'offset' parameter
	const [offset = 0, offsetErr] = it(params.offset).expect.number().min(0).get();
	if (offsetErr) return rej('invalid offset param');

	// Lookup post
	const post = await Post.findOne({
		_id: postId
	});

	if (post === null) {
		return rej('post not found');
	}

	const context = [];
	let i = 0;

	async function get(id) {
		i++;
		const p = await Post.findOne({ _id: id });

		if (i > offset) {
			context.push(p);
		}

		if (context.length == limit) {
			return;
		}

		if (p.reply_to_id) {
			await get(p.reply_to_id);
		}
	}

	if (post.reply_to_id) {
		await get(post.reply_to_id);
	}

	// Serialize
	res(await Promise.all(context.map(async post =>
		await serialize(post, user))));
});
