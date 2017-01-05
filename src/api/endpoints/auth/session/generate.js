'use strict';

/**
 * Module dependencies
 */
import * as uuid from 'uuid';
import App from '../../../models/app';
import AuthSess from '../../../models/auth-session';

/**
 * @swagger
 * /auth/session/generate:
 *   post:
 *     summary: Generate a session
 *     parameters:
 *       -
 *         name: app_secret
 *         description: App Secret
 *         in: formData
 *         required: true
 *         type: string
 *         
 *     responses:
 *       200:
 *         description: OK
 *         schema:
 *           type: object
 *           properties:
 *             token:
 *               type: string
 *               description: Session Token
 *             url:
 *               type: string
 *               description: Authentication form's URL
 *       400:
 *         description: Failed
 *         schema:
 *           $ref: "#/definitions/Error"
 */

/**
 * Generate a session
 *
 * @param {Object} params
 * @return {Promise<object>}
 */
module.exports = (params) =>
	new Promise(async (res, rej) =>
{
	// Get 'app_secret' parameter
	const appSecret = params.app_secret;
	if (appSecret == null) {
		return rej('app_secret is required');
	}

	// Lookup app
	const app = await App.findOne({
		secret: appSecret
	});

	if (app == null) {
		return rej('app not found');
	}

	// Generate token
	const token = uuid.v4();

	// Create session token document
	const inserted = await AuthSess.insert({
		created_at: new Date(),
		app_id: app._id,
		token: token
	});

	const doc = inserted.ops[0];

	// Response
	res({
		token: doc.token,
		url: `${config.auth_url}/${doc.token}`
	});
});
