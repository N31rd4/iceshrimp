import Router from "@koa/router";
import { getClient } from "../ApiMastodonCompatibleService.js";
import { emojiRegexAtStartToEnd } from "@/misc/emoji-regex.js";
import axios from "axios";
import querystring from "node:querystring";
import qs from "qs";
import { convertTimelinesArgsId, limitToInt } from "./timeline.js";
import { convertId, IdType } from "../../index.js";
import {
	convertAccount,
	convertAttachment,
	convertPoll,
	convertStatus,
} from "../converters.js";

function normalizeQuery(data: any) {
	const str = querystring.stringify(data);
	return qs.parse(str);
}

export function apiStatusMastodon(router: Router): void {
	router.post("/v1/statuses", async (ctx) => {
		const BASE_URL = `${ctx.protocol}://${ctx.hostname}`;
		const accessTokens = ctx.headers.authorization;
		const client = getClient(BASE_URL, accessTokens);
		try {
			let body: any = ctx.request.body;
			if (body.in_reply_to_id)
				body.in_reply_to_id = convertId(body.in_reply_to_id, IdType.CalckeyId);
			if (
				(!body.poll && body["poll[options][]"]) ||
				(!body.media_ids && body["media_ids[]"])
			) {
				body = normalizeQuery(body);
			}
			const text = body.status;
			const removed = text.replace(/@\S+/g, "").replace(/\s|​/g, "");
			const isDefaultEmoji = emojiRegexAtStartToEnd.test(removed);
			const isCustomEmoji = /^:[a-zA-Z0-9@_]+:$/.test(removed);
			if ((body.in_reply_to_id && isDefaultEmoji) || isCustomEmoji) {
				const a = await client.createEmojiReaction(
					body.in_reply_to_id,
					removed,
				);
				ctx.body = a.data;
			}
			if (body.in_reply_to_id && removed === "/unreact") {
				try {
					const id = body.in_reply_to_id;
					const post = await client.getStatus(id);
					const react = post.data.emoji_reactions.filter((e) => e.me)[0].name;
					const data = await client.deleteEmojiReaction(id, react);
					ctx.body = data.data;
				} catch (e: any) {
					console.error(e);
					ctx.status = 401;
					ctx.body = e.response.data;
				}
			}
			if (!body.media_ids) body.media_ids = undefined;
			if (body.media_ids && !body.media_ids.length) body.media_ids = undefined;
			if (body.media_ids) {
				body.media_ids = (body.media_ids as string[]).map(p => convertId(p, IdType.CalckeyId));
			}
			const { sensitive } = body;
			body.sensitive =
				typeof sensitive === "string" ? sensitive === "true" : sensitive;
			const data = await client.postStatus(text, body);
			ctx.body = convertStatus(data.data);
		} catch (e: any) {
			console.error(e);
			ctx.status = 401;
			ctx.body = e.response.data;
		}
	});
	router.get<{ Params: { id: string } }>("/v1/statuses/:id", async (ctx) => {
		const BASE_URL = `${ctx.protocol}://${ctx.hostname}`;
		const accessTokens = ctx.headers.authorization;
		const client = getClient(BASE_URL, accessTokens);
		try {
			const data = await client.getStatus(
				convertId(ctx.params.id, IdType.CalckeyId),
			);
			ctx.body = convertStatus(data.data);
		} catch (e: any) {
			console.error(e);
			ctx.status = 401;
			ctx.body = e.response.data;
		}
	});
	router.delete<{ Params: { id: string } }>("/v1/statuses/:id", async (ctx) => {
		const BASE_URL = `${ctx.protocol}://${ctx.hostname}`;
		const accessTokens = ctx.headers.authorization;
		const client = getClient(BASE_URL, accessTokens);
		try {
			const data = await client.deleteStatus(
				convertId(ctx.params.id, IdType.CalckeyId),
			);
			ctx.body = data.data;
		} catch (e: any) {
			console.error(e.response.data, request.params.id);
			ctx.status = 401;
			ctx.body = e.response.data;
		}
	});
	interface IReaction {
		id: string;
		createdAt: string;
		user: MisskeyEntity.User;
		type: string;
	}
	router.get<{ Params: { id: string } }>(
		"/v1/statuses/:id/context",
		async (ctx) => {
			const BASE_URL = `${ctx.protocol}://${ctx.hostname}`;
			const accessTokens = ctx.headers.authorization;
			const client = getClient(BASE_URL, accessTokens);
			try {
				const id = convertId(ctx.params.id, IdType.CalckeyId);
				const data = await client.getStatusContext(
					id,
					convertTimelinesArgsId(limitToInt(ctx.query as any)),
				);
				const status = await client.getStatus(id);
				let reqInstance = axios.create({
					headers: {
						Authorization: ctx.headers.authorization,
					},
				});
				const reactionsAxios = await reqInstance.get(
					`${BASE_URL}/api/notes/reactions?noteId=${id}`,
				);
				const reactions: IReaction[] = reactionsAxios.data;
				const text = reactions
					.map((r) => `${r.type.replace("@.", "")} ${r.user.username}`)
					.join("<br />");
				data.data.descendants.unshift(
					statusModel(
						status.data.id,
						status.data.account.id,
						status.data.emojis,
						text,
					),
				);
				data.data.ancestors = data.data.ancestors.map((status) =>
					convertStatus(status),
				);
				data.data.descendants = data.data.descendants.map((status) =>
					convertStatus(status),
				);
				ctx.body = data.data;
			} catch (e: any) {
				console.error(e);
				ctx.status = 401;
				ctx.body = e.response.data;
			}
		},
	);
	router.get<{ Params: { id: string } }>(
		"/v1/statuses/:id/history",
		async (ctx) => {
			const BASE_URL = `${ctx.protocol}://${ctx.hostname}`;
			const accessTokens = ctx.headers.authorization;
			const client = getClient(BASE_URL, accessTokens);
			try {
				const data = await client.getStatusHistory(
					convertId(ctx.params.id, IdType.CalckeyId),
				);
				ctx.body = data.data.map((account) => convertAccount(account));
			} catch (e: any) {
				console.error(e);
				ctx.status = 401;
				ctx.body = e.response.data;
			}
		},
	);
	router.get<{ Params: { id: string } }>(
		"/v1/statuses/:id/reblogged_by",
		async (ctx) => {
			const BASE_URL = `${ctx.protocol}://${ctx.hostname}`;
			const accessTokens = ctx.headers.authorization;
			const client = getClient(BASE_URL, accessTokens);
			try {
				const data = await client.getStatusRebloggedBy(
					convertId(ctx.params.id, IdType.CalckeyId),
				);
				ctx.body = data.data.map((account) => convertAccount(account));
			} catch (e: any) {
				console.error(e);
				ctx.status = 401;
				ctx.body = e.response.data;
			}
		},
	);
	router.get<{ Params: { id: string } }>(
		"/v1/statuses/:id/favourited_by",
		async (ctx) => {
			ctx.body = [];
		},
	);
	router.post<{ Params: { id: string } }>(
		"/v1/statuses/:id/favourite",
		async (ctx) => {
			const BASE_URL = `${ctx.protocol}://${ctx.hostname}`;
			const accessTokens = ctx.headers.authorization;
			const client = getClient(BASE_URL, accessTokens);
			const react = await getFirstReaction(BASE_URL, accessTokens);
			try {
				const a = (await client.createEmojiReaction(
					convertId(ctx.params.id, IdType.CalckeyId),
					react,
				)) as any;
				//const data = await client.favouriteStatus(ctx.params.id) as any;
				ctx.body = convertStatus(a.data);
			} catch (e: any) {
				console.error(e);
				console.error(e.response.data);
				ctx.status = 401;
				ctx.body = e.response.data;
			}
		},
	);
	router.post<{ Params: { id: string } }>(
		"/v1/statuses/:id/unfavourite",
		async (ctx) => {
			const BASE_URL = `${ctx.protocol}://${ctx.hostname}`;
			const accessTokens = ctx.headers.authorization;
			const client = getClient(BASE_URL, accessTokens);
			const react = await getFirstReaction(BASE_URL, accessTokens);
			try {
				const data = await client.deleteEmojiReaction(
					convertId(ctx.params.id, IdType.CalckeyId),
					react,
				);
				ctx.body = convertStatus(data.data);
			} catch (e: any) {
				console.error(e);
				ctx.status = 401;
				ctx.body = e.response.data;
			}
		},
	);

	router.post<{ Params: { id: string } }>(
		"/v1/statuses/:id/reblog",
		async (ctx) => {
			const BASE_URL = `${ctx.protocol}://${ctx.hostname}`;
			const accessTokens = ctx.headers.authorization;
			const client = getClient(BASE_URL, accessTokens);
			try {
				const data = await client.reblogStatus(
					convertId(ctx.params.id, IdType.CalckeyId),
				);
				ctx.body = convertStatus(data.data);
			} catch (e: any) {
				console.error(e);
				ctx.status = 401;
				ctx.body = e.response.data;
			}
		},
	);

	router.post<{ Params: { id: string } }>(
		"/v1/statuses/:id/unreblog",
		async (ctx) => {
			const BASE_URL = `${ctx.protocol}://${ctx.hostname}`;
			const accessTokens = ctx.headers.authorization;
			const client = getClient(BASE_URL, accessTokens);
			try {
				const data = await client.unreblogStatus(
					convertId(ctx.params.id, IdType.CalckeyId),
				);
				ctx.body = convertStatus(data.data);
			} catch (e: any) {
				console.error(e);
				ctx.status = 401;
				ctx.body = e.response.data;
			}
		},
	);

	router.post<{ Params: { id: string } }>(
		"/v1/statuses/:id/bookmark",
		async (ctx) => {
			const BASE_URL = `${ctx.protocol}://${ctx.hostname}`;
			const accessTokens = ctx.headers.authorization;
			const client = getClient(BASE_URL, accessTokens);
			try {
				const data = await client.bookmarkStatus(
					convertId(ctx.params.id, IdType.CalckeyId),
				);
				ctx.body = convertStatus(data.data);
			} catch (e: any) {
				console.error(e);
				ctx.status = 401;
				ctx.body = e.response.data;
			}
		},
	);

	router.post<{ Params: { id: string } }>(
		"/v1/statuses/:id/unbookmark",
		async (ctx) => {
			const BASE_URL = `${ctx.protocol}://${ctx.hostname}`;
			const accessTokens = ctx.headers.authorization;
			const client = getClient(BASE_URL, accessTokens);
			try {
				const data = await client.unbookmarkStatus(
					convertId(ctx.params.id, IdType.CalckeyId),
				);
				ctx.body = convertStatus(data.data);
			} catch (e: any) {
				console.error(e);
				ctx.status = 401;
				ctx.body = e.response.data;
			}
		},
	);

	router.post<{ Params: { id: string } }>(
		"/v1/statuses/:id/pin",
		async (ctx) => {
			const BASE_URL = `${ctx.protocol}://${ctx.hostname}`;
			const accessTokens = ctx.headers.authorization;
			const client = getClient(BASE_URL, accessTokens);
			try {
				const data = await client.pinStatus(
					convertId(ctx.params.id, IdType.CalckeyId),
				);
				ctx.body = convertStatus(data.data);
			} catch (e: any) {
				console.error(e);
				ctx.status = 401;
				ctx.body = e.response.data;
			}
		},
	);

	router.post<{ Params: { id: string } }>(
		"/v1/statuses/:id/unpin",
		async (ctx) => {
			const BASE_URL = `${ctx.protocol}://${ctx.hostname}`;
			const accessTokens = ctx.headers.authorization;
			const client = getClient(BASE_URL, accessTokens);
			try {
				const data = await client.unpinStatus(
					convertId(ctx.params.id, IdType.CalckeyId),
				);
				ctx.body = convertStatus(data.data);
			} catch (e: any) {
				console.error(e);
				ctx.status = 401;
				ctx.body = e.response.data;
			}
		},
	);
	router.get<{ Params: { id: string } }>("/v1/media/:id", async (ctx) => {
		const BASE_URL = `${ctx.protocol}://${ctx.hostname}`;
		const accessTokens = ctx.headers.authorization;
		const client = getClient(BASE_URL, accessTokens);
		try {
			const data = await client.getMedia(
				convertId(ctx.params.id, IdType.CalckeyId),
			);
			ctx.body = convertAttachment(data.data);
		} catch (e: any) {
			console.error(e);
			ctx.status = 401;
			ctx.body = e.response.data;
		}
	});
	router.put<{ Params: { id: string } }>("/v1/media/:id", async (ctx) => {
		const BASE_URL = `${ctx.protocol}://${ctx.hostname}`;
		const accessTokens = ctx.headers.authorization;
		const client = getClient(BASE_URL, accessTokens);
		try {
			const data = await client.updateMedia(
				convertId(ctx.params.id, IdType.CalckeyId),
				ctx.request.body as any,
			);
			ctx.body = convertAttachment(data.data);
		} catch (e: any) {
			console.error(e);
			ctx.status = 401;
			ctx.body = e.response.data;
		}
	});
	router.get<{ Params: { id: string } }>("/v1/polls/:id", async (ctx) => {
		const BASE_URL = `${ctx.protocol}://${ctx.hostname}`;
		const accessTokens = ctx.headers.authorization;
		const client = getClient(BASE_URL, accessTokens);
		try {
			const data = await client.getPoll(
				convertId(ctx.params.id, IdType.CalckeyId),
			);
			ctx.body = convertPoll(data.data);
		} catch (e: any) {
			console.error(e);
			ctx.status = 401;
			ctx.body = e.response.data;
		}
	});
	router.post<{ Params: { id: string } }>(
		"/v1/polls/:id/votes",
		async (ctx) => {
			const BASE_URL = `${ctx.protocol}://${ctx.hostname}`;
			const accessTokens = ctx.headers.authorization;
			const client = getClient(BASE_URL, accessTokens);
			try {
				const data = await client.votePoll(
					convertId(ctx.params.id, IdType.CalckeyId),
					(ctx.request.body as any).choices,
				);
				ctx.body = convertPoll(data.data);
			} catch (e: any) {
				console.error(e);
				ctx.status = 401;
				ctx.body = e.response.data;
			}
		},
	);
}

async function getFirstReaction(
	BASE_URL: string,
	accessTokens: string | undefined,
) {
	const accessTokenArr = accessTokens?.split(" ") ?? [null];
	const accessToken = accessTokenArr[accessTokenArr.length - 1];
	let react = "⭐";
	try {
		const api = await axios.post(`${BASE_URL}/api/i/registry/get-unsecure`, {
			scope: ["client", "base"],
			key: "reactions",
			i: accessToken,
		});
		const reactRaw = api.data;
		react = Array.isArray(reactRaw) ? api.data[0] : "⭐";
		console.log(api.data);
		return react;
	} catch (e) {
		return react;
	}
}

export function statusModel(
	id: string | null,
	acctId: string | null,
	emojis: MastodonEntity.Emoji[],
	content: string,
) {
	const now = new Date().toISOString();
	return {
		id: "9atm5frjhb",
		uri: "/static-assets/transparent.png", // ""
		url: "/static-assets/transparent.png", // "",
		account: {
			id: "9arzuvv0sw",
			username: "Reactions",
			acct: "Reactions",
			display_name: "Reactions to this post",
			locked: false,
			created_at: now,
			followers_count: 0,
			following_count: 0,
			statuses_count: 0,
			note: "",
			url: "/static-assets/transparent.png",
			avatar: "/static-assets/badges/info.png",
			avatar_static: "/static-assets/badges/info.png",
			header: "/static-assets/transparent.png", // ""
			header_static: "/static-assets/transparent.png", // ""
			emojis: [],
			fields: [],
			moved: null,
			bot: false,
		},
		in_reply_to_id: id,
		in_reply_to_account_id: acctId,
		reblog: null,
		content: `<p>${content}</p>`,
		plain_content: null,
		created_at: now,
		emojis: emojis,
		replies_count: 0,
		reblogs_count: 0,
		favourites_count: 0,
		favourited: false,
		reblogged: false,
		muted: false,
		sensitive: false,
		spoiler_text: "",
		visibility: "public" as const,
		media_attachments: [],
		mentions: [],
		tags: [],
		card: null,
		poll: null,
		application: null,
		language: null,
		pinned: false,
		emoji_reactions: [],
		bookmarked: false,
		quote: null,
	};
}
