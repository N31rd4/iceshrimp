import Router from "@koa/router";
import { getClient } from "../ApiMastodonCompatibleService.js";
import { argsToBools, convertTimelinesArgsId, limitToInt, normalizeUrlQuery } from "./timeline.js";
import { convertId, IdType } from "../../index.js";
import { convertAccount, convertFeaturedTag, convertList, convertRelationship, convertStatus, } from "../converters.js";
import { getUser } from "@/server/api/common/getters.js";
import { UserConverter } from "@/server/api/mastodon/converters/user.js";
import authenticate from "@/server/api/authenticate.js";
import { NoteConverter } from "@/server/api/mastodon/converters/note.js";
import { UserHelpers } from "@/server/api/mastodon/helpers/user.js";
import config from "@/config/index.js";

const relationshipModel = {
	id: "",
	following: false,
	followed_by: false,
	delivery_following: false,
	blocking: false,
	blocked_by: false,
	muting: false,
	muting_notifications: false,
	requested: false,
	domain_blocking: false,
	showing_reblogs: false,
	endorsed: false,
	notifying: false,
	note: "",
};

export function apiAccountMastodon(router: Router): void {
	router.get("/v1/accounts/verify_credentials", async (ctx) => {
		const BASE_URL = `${ctx.protocol}://${ctx.hostname}`;
		const accessTokens = ctx.headers.authorization;
		const client = getClient(BASE_URL, accessTokens);
		try {
			const data = await client.verifyAccountCredentials();
			let acct = data.data;
			acct.id = convertId(acct.id, IdType.MastodonId);
			acct.display_name = acct.display_name || acct.username;
			acct.url = `${BASE_URL}/@${acct.url}`;
			acct.note = acct.note || "";
			acct.avatar_static = acct.avatar;
			acct.header = acct.header || "/static-assets/transparent.png";
			acct.header_static = acct.header || "/static-assets/transparent.png";
			acct.source = {
				note: acct.note,
				fields: acct.fields,
				privacy: await client.getDefaultPostPrivacy(),
				sensitive: false,
				language: "",
			};
			console.log(acct);
			ctx.body = acct;
		} catch (e: any) {
			console.error(e);
			console.error(e.response.data);
			ctx.status = 401;
			ctx.body = e.response.data;
		}
	});
	router.patch("/v1/accounts/update_credentials", async (ctx) => {
		const BASE_URL = `${ctx.protocol}://${ctx.hostname}`;
		const accessTokens = ctx.headers.authorization;
		const client = getClient(BASE_URL, accessTokens);
		try {
			const data = await client.updateCredentials(
				(ctx.request as any).body as any,
			);
			ctx.body = convertAccount(data.data);
		} catch (e: any) {
			console.error(e);
			console.error(e.response.data);
			ctx.status = 401;
			ctx.body = e.response.data;
		}
	});
	router.get("/v1/accounts/lookup", async (ctx) => {
		const BASE_URL = `${ctx.protocol}://${ctx.hostname}`;
		const accessTokens = ctx.headers.authorization;
		const client = getClient(BASE_URL, accessTokens);
		try {
			const data = await client.search(
				(ctx.request.query as any).acct,
				"accounts",
			);
			ctx.body = convertAccount(data.data.accounts[0]);
		} catch (e: any) {
			console.error(e);
			console.error(e.response.data);
			ctx.status = 401;
			ctx.body = e.response.data;
		}
	});
	router.get("/v1/accounts/relationships", async (ctx) => {
		const BASE_URL = `${ctx.protocol}://${ctx.hostname}`;
		const accessTokens = ctx.headers.authorization;
		const client = getClient(BASE_URL, accessTokens);
		let users;
		try {
			// TODO: this should be body
			let ids = ctx.request.query ? ctx.request.query["id[]"] : null;
			if (typeof ids === "string") {
				ids = [ids];
			}
			users = ids;
			relationshipModel.id = ids?.toString() || "1";
			if (!ids) {
				ctx.body = [relationshipModel];
				return;
			}

			let reqIds = [];
			for (let i = 0; i < ids.length; i++) {
				reqIds.push(convertId(ids[i], IdType.IceshrimpId));
			}

			const data = await client.getRelationships(reqIds);
			ctx.body = data.data.map((relationship) =>
				convertRelationship(relationship),
			);
		} catch (e: any) {
			console.error(e);
			let data = e.response.data;
			data.users = users;
			console.error(data);
			ctx.status = 401;
			ctx.body = data;
		}
	});
	router.get<{ Params: { id: string } }>("/v1/accounts/:id", async (ctx) => {
		try {
			const userId = convertId(ctx.params.id, IdType.IceshrimpId);
			const account = await UserConverter.encode(await getUser(userId));
			ctx.body = convertAccount(account);
		} catch (e: any) {
			console.error(e);
			console.error(e.response.data);
			ctx.status = 401;
			ctx.body = e.response.data;
		}
	});
	router.get<{ Params: { id: string } }>(
		"/v1/accounts/:id/statuses",
		async (ctx) => {
			try {
				const auth = await authenticate(ctx.headers.authorization, null);
				const user = auth[0] ?? undefined;

				if (!user) {
					ctx.status = 401;
					return;
				}

				const userId = convertId(ctx.params.id, IdType.IceshrimpId);
				const cache = UserHelpers.getFreshAccountCache();
				const query = await UserHelpers.getUserCached(userId, cache);
				const args = normalizeUrlQuery(convertTimelinesArgsId(argsToBools(limitToInt(ctx.query))));
				const tl = await UserHelpers.getUserStatuses(query, user, args.max_id, args.since_id, args.min_id, args.limit, args.only_media, args.exclude_replies, args.exclude_reblogs, args.pinned, args.tagged)
					.then(n => NoteConverter.encodeMany(n, user, cache));

				ctx.body = tl.map(s => convertStatus(s));
			} catch (e: any) {
				console.error(e);
				console.error(e.response.data);
				ctx.status = 401;
				ctx.body = e.response.data;
			}
		},
	);
	router.get<{ Params: { id: string } }>(
		"/v1/accounts/:id/featured_tags",
		async (ctx) => {
			const BASE_URL = `${ctx.protocol}://${ctx.hostname}`;
			const accessTokens = ctx.headers.authorization;
			const client = getClient(BASE_URL, accessTokens);
			try {
				const data = await client.getAccountFeaturedTags(
					convertId(ctx.params.id, IdType.IceshrimpId),
				);
				ctx.body = data.data.map((tag) => convertFeaturedTag(tag));
			} catch (e: any) {
				console.error(e);
				console.error(e.response.data);
				ctx.status = 401;
				ctx.body = e.response.data;
			}
		},
	);
	router.get<{ Params: { id: string } }>(
		"/v1/accounts/:id/followers",
		async (ctx) => {
			try {
				const auth = await authenticate(ctx.headers.authorization, null);
				const user = auth[0] ?? null;

				const userId = convertId(ctx.params.id, IdType.IceshrimpId);
				const cache = UserHelpers.getFreshAccountCache();
				const query = await UserHelpers.getUserCached(userId, cache);
				const args = normalizeUrlQuery(convertTimelinesArgsId(limitToInt(ctx.query as any)));

				const res = await UserHelpers.getUserFollowers(query, user, args.max_id, args.since_id, args.min_id, args.limit);
				const followers = await UserConverter.encodeMany(res.data, cache);

				ctx.body = followers.map((account) => convertAccount(account));

				const link: string[] = [];
				const limit = args.limit ?? 40;
				if (res.maxId) {
					const l = `<${config.url}/api/v1/accounts/${ctx.params.id}/followers?limit=${limit}&max_id=${convertId(res.maxId, IdType.MastodonId)}>; rel="next"`;
					link.push(l);
				}
				if (res.minId) {
					const l = `<${config.url}/api/v1/accounts/${ctx.params.id}/followers?limit=${limit}&min_id=${convertId(res.minId, IdType.MastodonId)}>; rel="prev"`;
					link.push(l);
				}
				if (link.length > 0){
					ctx.response.append('Link', link.join(', '));
				}
			} catch (e: any) {
				console.error(e);
				console.error(e.response.data);
				ctx.status = 401;
				ctx.body = e.response.data;
			}
		},
	);
	router.get<{ Params: { id: string } }>(
		"/v1/accounts/:id/following",
		async (ctx) => {
			const BASE_URL = `${ctx.protocol}://${ctx.hostname}`;
			const accessTokens = ctx.headers.authorization;
			const client = getClient(BASE_URL, accessTokens);
			try {
				const data = await client.getAccountFollowing(
					convertId(ctx.params.id, IdType.IceshrimpId),
					convertTimelinesArgsId(limitToInt(ctx.query as any)),
				);
				ctx.body = data.data.map((account) => convertAccount(account));
			} catch (e: any) {
				console.error(e);
				console.error(e.response.data);
				ctx.status = 401;
				ctx.body = e.response.data;
			}
		},
	);
	router.get<{ Params: { id: string } }>(
		"/v1/accounts/:id/lists",
		async (ctx) => {
			const BASE_URL = `${ctx.protocol}://${ctx.hostname}`;
			const accessTokens = ctx.headers.authorization;
			const client = getClient(BASE_URL, accessTokens);
			try {
				const data = await client.getAccountLists(
					convertId(ctx.params.id, IdType.IceshrimpId),
				);
				ctx.body = data.data.map((list) => convertList(list));
			} catch (e: any) {
				console.error(e);
				console.error(e.response.data);
				ctx.status = 401;
				ctx.body = e.response.data;
			}
		},
	);
	router.post<{ Params: { id: string } }>(
		"/v1/accounts/:id/follow",
		async (ctx) => {
			const BASE_URL = `${ctx.protocol}://${ctx.hostname}`;
			const accessTokens = ctx.headers.authorization;
			const client = getClient(BASE_URL, accessTokens);
			try {
				const data = await client.followAccount(
					convertId(ctx.params.id, IdType.IceshrimpId),
				);
				let acct = convertRelationship(data.data);
				acct.following = true;
				ctx.body = acct;
			} catch (e: any) {
				console.error(e);
				console.error(e.response.data);
				ctx.status = 401;
				ctx.body = e.response.data;
			}
		},
	);
	router.post<{ Params: { id: string } }>(
		"/v1/accounts/:id/unfollow",
		async (ctx) => {
			const BASE_URL = `${ctx.protocol}://${ctx.hostname}`;
			const accessTokens = ctx.headers.authorization;
			const client = getClient(BASE_URL, accessTokens);
			try {
				const data = await client.unfollowAccount(
					convertId(ctx.params.id, IdType.IceshrimpId),
				);
				let acct = convertRelationship(data.data);
				acct.following = false;
				ctx.body = acct;
			} catch (e: any) {
				console.error(e);
				console.error(e.response.data);
				ctx.status = 401;
				ctx.body = e.response.data;
			}
		},
	);
	router.post<{ Params: { id: string } }>(
		"/v1/accounts/:id/block",
		async (ctx) => {
			const BASE_URL = `${ctx.protocol}://${ctx.hostname}`;
			const accessTokens = ctx.headers.authorization;
			const client = getClient(BASE_URL, accessTokens);
			try {
				const data = await client.blockAccount(
					convertId(ctx.params.id, IdType.IceshrimpId),
				);
				ctx.body = convertRelationship(data.data);
			} catch (e: any) {
				console.error(e);
				console.error(e.response.data);
				ctx.status = 401;
				ctx.body = e.response.data;
			}
		},
	);
	router.post<{ Params: { id: string } }>(
		"/v1/accounts/:id/unblock",
		async (ctx) => {
			const BASE_URL = `${ctx.protocol}://${ctx.hostname}`;
			const accessTokens = ctx.headers.authorization;
			const client = getClient(BASE_URL, accessTokens);
			try {
				const data = await client.unblockAccount(
					convertId(ctx.params.id, IdType.MastodonId),
				);
				ctx.body = convertRelationship(data.data);
			} catch (e: any) {
				console.error(e);
				console.error(e.response.data);
				ctx.status = 401;
				ctx.body = e.response.data;
			}
		},
	);
	router.post<{ Params: { id: string } }>(
		"/v1/accounts/:id/mute",
		async (ctx) => {
			const BASE_URL = `${ctx.protocol}://${ctx.hostname}`;
			const accessTokens = ctx.headers.authorization;
			const client = getClient(BASE_URL, accessTokens);
			try {
				const data = await client.muteAccount(
					convertId(ctx.params.id, IdType.IceshrimpId),
					(ctx.request as any).body as any,
				);
				ctx.body = convertRelationship(data.data);
			} catch (e: any) {
				console.error(e);
				console.error(e.response.data);
				ctx.status = 401;
				ctx.body = e.response.data;
			}
		},
	);
	router.post<{ Params: { id: string } }>(
		"/v1/accounts/:id/unmute",
		async (ctx) => {
			const BASE_URL = `${ctx.protocol}://${ctx.hostname}`;
			const accessTokens = ctx.headers.authorization;
			const client = getClient(BASE_URL, accessTokens);
			try {
				const data = await client.unmuteAccount(
					convertId(ctx.params.id, IdType.IceshrimpId),
				);
				ctx.body = convertRelationship(data.data);
			} catch (e: any) {
				console.error(e);
				console.error(e.response.data);
				ctx.status = 401;
				ctx.body = e.response.data;
			}
		},
	);
	router.get("/v1/featured_tags", async (ctx) => {
		const BASE_URL = `${ctx.protocol}://${ctx.hostname}`;
		const accessTokens = ctx.headers.authorization;
		const client = getClient(BASE_URL, accessTokens);
		try {
			const data = await client.getFeaturedTags();
			ctx.body = data.data.map((tag) => convertFeaturedTag(tag));
		} catch (e: any) {
			console.error(e);
			console.error(e.response.data);
			ctx.status = 401;
			ctx.body = e.response.data;
		}
	});
	router.get("/v1/followed_tags", async (ctx) => {
		const BASE_URL = `${ctx.protocol}://${ctx.hostname}`;
		const accessTokens = ctx.headers.authorization;
		const client = getClient(BASE_URL, accessTokens);
		try {
			const data = await client.getFollowedTags();
			ctx.body = data.data;
		} catch (e: any) {
			console.error(e);
			console.error(e.response.data);
			ctx.status = 401;
			ctx.body = e.response.data;
		}
	});
	router.get("/v1/bookmarks", async (ctx) => {
		const BASE_URL = `${ctx.protocol}://${ctx.hostname}`;
		const accessTokens = ctx.headers.authorization;
		const client = getClient(BASE_URL, accessTokens);
		try {
			const data = await client.getBookmarks(
				convertTimelinesArgsId(limitToInt(ctx.query as any)),
			);
			ctx.body = data.data.map((status) => convertStatus(status));
		} catch (e: any) {
			console.error(e);
			console.error(e.response.data);
			ctx.status = 401;
			ctx.body = e.response.data;
		}
	});
	router.get("/v1/favourites", async (ctx) => {
		const BASE_URL = `${ctx.protocol}://${ctx.hostname}`;
		const accessTokens = ctx.headers.authorization;
		const client = getClient(BASE_URL, accessTokens);
		try {
			const data = await client.getFavourites(
				convertTimelinesArgsId(limitToInt(ctx.query as any)),
			);
			ctx.body = data.data.map((status) => convertStatus(status));
		} catch (e: any) {
			console.error(e);
			console.error(e.response.data);
			ctx.status = 401;
			ctx.body = e.response.data;
		}
	});
	router.get("/v1/mutes", async (ctx) => {
		const BASE_URL = `${ctx.protocol}://${ctx.hostname}`;
		const accessTokens = ctx.headers.authorization;
		const client = getClient(BASE_URL, accessTokens);
		try {
			const data = await client.getMutes(
				convertTimelinesArgsId(limitToInt(ctx.query as any)),
			);
			ctx.body = data.data.map((account) => convertAccount(account));
		} catch (e: any) {
			console.error(e);
			console.error(e.response.data);
			ctx.status = 401;
			ctx.body = e.response.data;
		}
	});
	router.get("/v1/blocks", async (ctx) => {
		const BASE_URL = `${ctx.protocol}://${ctx.hostname}`;
		const accessTokens = ctx.headers.authorization;
		const client = getClient(BASE_URL, accessTokens);
		try {
			const data = await client.getBlocks(
				convertTimelinesArgsId(limitToInt(ctx.query as any)),
			);
			ctx.body = data.data.map((account) => convertAccount(account));
		} catch (e: any) {
			console.error(e);
			console.error(e.response.data);
			ctx.status = 401;
			ctx.body = e.response.data;
		}
	});
	router.get("/v1/follow_requests", async (ctx) => {
		const BASE_URL = `${ctx.protocol}://${ctx.hostname}`;
		const accessTokens = ctx.headers.authorization;
		const client = getClient(BASE_URL, accessTokens);
		try {
			const data = await client.getFollowRequests(
				((ctx.query as any) || { limit: 20 }).limit,
			);
			ctx.body = data.data.map((account) => convertAccount(account));
		} catch (e: any) {
			console.error(e);
			console.error(e.response.data);
			ctx.status = 401;
			ctx.body = e.response.data;
		}
	});
	router.post<{ Params: { id: string } }>(
		"/v1/follow_requests/:id/authorize",
		async (ctx) => {
			const BASE_URL = `${ctx.protocol}://${ctx.hostname}`;
			const accessTokens = ctx.headers.authorization;
			const client = getClient(BASE_URL, accessTokens);
			try {
				const data = await client.acceptFollowRequest(
					convertId(ctx.params.id, IdType.IceshrimpId),
				);
				ctx.body = convertRelationship(data.data);
			} catch (e: any) {
				console.error(e);
				console.error(e.response.data);
				ctx.status = 401;
				ctx.body = e.response.data;
			}
		},
	);
	router.post<{ Params: { id: string } }>(
		"/v1/follow_requests/:id/reject",
		async (ctx) => {
			const BASE_URL = `${ctx.protocol}://${ctx.hostname}`;
			const accessTokens = ctx.headers.authorization;
			const client = getClient(BASE_URL, accessTokens);
			try {
				const data = await client.rejectFollowRequest(
					convertId(ctx.params.id, IdType.IceshrimpId),
				);
				ctx.body = convertRelationship(data.data);
			} catch (e: any) {
				console.error(e);
				console.error(e.response.data);
				ctx.status = 401;
				ctx.body = e.response.data;
			}
		},
	);
}
