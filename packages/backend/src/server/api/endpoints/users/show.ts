import type { FindOptionsWhere } from "typeorm";
import { In, IsNull } from "typeorm";
import { resolveUser } from "@/remote/resolve-user.js";
import { Users } from "@/models/index.js";
import type { User } from "@/models/entities/user.js";
import define from "../../define.js";
import { apiLogger } from "../../logger.js";
import { ApiError } from "../../error.js";
import { fetchMeta } from "@/misc/fetch-meta.js";

export const meta = {
	tags: ["users"],

	// TODO: determine if should allow this in private mode or to create a new endpoint just for 2fa
	requireCredential: false,
	requireCredentialPrivateMode: false,  // set to false to allow FIDO2 and other 2fa auth

	description: "Show the properties of a user.",

	res: {
		optional: false,
		nullable: false,
		oneOf: [
			{
				type: "object",
				ref: "UserDetailed",
			},
			{
				type: "array",
				items: {
					type: "object",
					ref: "UserDetailed",
				},
			},
		],
	},

	errors: {
		failedToResolveRemoteUser: {
			message: "Failed to resolve remote user.",
			code: "FAILED_TO_RESOLVE_REMOTE_USER",
			id: "ef7b9be4-9cba-4e6f-ab41-90ed171c7d3c",
			kind: "server",
		},

		noSuchUser: {
			message: "No such user.",
			code: "NO_SUCH_USER",
			id: "4362f8dc-731f-4ad8-a694-be5a88922a24",
		},
	},
} as const;

export const paramDef = {
	type: "object",
	anyOf: [
		{
			properties: {
				userId: { type: "string" },
			},
			required: ["userId"],
		},
		{
			properties: {
				userIds: {
					type: "array",
					uniqueItems: true,
					items: {
						type: "string",
					},
				},
			},
			required: ["userIds"],
		},
		{
			properties: {
				username: { type: "string" },
				host: {
					type: "string",
					nullable: true,
					description: "The local host is represented with `null`.",
				},
			},
			required: ["username"],
		},
	],
} as const;

export default define(meta, paramDef, async (ps, me) => {
	let user;

	const isAdminOrModerator = me && (me.isAdmin || me.isModerator);

	if (ps.userIds) {
		if (ps.userIds.length === 0) {
			return [];
		}

		const isUrl = ps.userIds[0].startsWith("http");
		let users: User[];
		if (isUrl) {
			users = await Users.findBy(
				isAdminOrModerator
					? { uri: In(ps.userIds) }
					: { uri: In(ps.userIds), isSuspended: false },
			);
		} else {
			users = await Users.findBy(
				isAdminOrModerator
					? { id: In(ps.userIds) }
					: { id: In(ps.userIds), isSuspended: false },
			);
		}

		// リクエストされた通りに並べ替え
		const _users: User[] = [];
		for (const id of ps.userIds) {
			const res = users.find((x) => (isUrl ? x.uri === id : x.id === id));
			if (res) _users.push(res);
		}

		return await Promise.all(
			_users.map((u) =>
				Users.pack(u, me, {
					detail: true,
				}),
			),
		);
	} else {
		// Lookup user
		if (typeof ps.host === "string" && typeof ps.username === "string") {
			user = await resolveUser(ps.username, ps.host).catch((e) => {
				apiLogger.warn(`failed to resolve remote user: ${e}`);
				throw new ApiError(meta.errors.failedToResolveRemoteUser);
			});
		} else {
			const q: FindOptionsWhere<User> =
				ps.userId != null
					? ps.userId.startsWith("http")
						? { uri: ps.userId }
						: { id: ps.userId }
					: { usernameLower: ps.username!.toLowerCase(), host: IsNull() };

			user = await Users.findOneBy(q);
		}

		if (user == null || (!isAdminOrModerator && user.isSuspended)) {
			throw new ApiError(meta.errors.noSuchUser);
		}

		// apiLogger.debug(`packed (detailed): ${JSON.stringify(await Users.pack(user, me, {detail: true}))}`);
		// apiLogger.debug(`packed (private): ${JSON.stringify(await Users.pack(user, me, {detail: true, isPrivateMode: true}))}`);

		const serverMeta = await fetchMeta();
		return await Users.pack(user, me, {
			detail: true,
			isPrivateMode: me !== null ? false : serverMeta.privateMode
		});
	}
});
