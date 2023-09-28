import Router from "@koa/router";
import { convertId, IdType } from "../../index.js";
import { getClient } from "../ApiMastodonCompatibleService.js";
import { convertTimelinesArgsId, limitToInt, normalizeUrlQuery } from "./timeline.js";
import { convertNotification } from "../converters.js";
import authenticate from "@/server/api/authenticate.js";
import { UserHelpers } from "@/server/api/mastodon/helpers/user.js";
import { NotificationHelpers } from "@/server/api/mastodon/helpers/notification.js";
import { NotificationConverter } from "@/server/api/mastodon/converters/notification.js";

function toLimitToInt(q: any) {
	if (q.limit) if (typeof q.limit === "string") q.limit = parseInt(q.limit, 10);
	return q;
}

export function apiNotificationsMastodon(router: Router): void {
	router.get("/v1/notifications", async (ctx) => {
		try {
			const auth = await authenticate(ctx.headers.authorization, null);
			const user = auth[0] ?? null;

			if (!user) {
				ctx.status = 401;
				return;
			}

			const cache = UserHelpers.getFreshAccountCache();
			const args = normalizeUrlQuery(convertTimelinesArgsId(limitToInt(ctx.query)), ['types[]', 'exclude_types[]']);
			const data = NotificationHelpers.getNotifications(user, args.max_id, args.since_id, args.min_id, args.limit, args['types[]'], args['exclude_types[]'], args.account_id)
				.then(p => NotificationConverter.encodeMany(p, user, cache))
				.then(p => p.map(n => convertNotification(n)));

			ctx.body = await data;
		} catch (e: any) {
			console.error(e);
			ctx.status = 401;
			ctx.body = e.response.data;
		}
	});

	router.get("/v1/notifications/:id", async (ctx) => {
		try {
			const auth = await authenticate(ctx.headers.authorization, null);
			const user = auth[0] ?? null;

			if (!user) {
				ctx.status = 401;
				return;
			}

			const notification = await NotificationHelpers.getNotification(convertId(ctx.params.id, IdType.IceshrimpId), user);
			if (notification === null) {
				ctx.status = 404;
				return;
			}

			ctx.body = convertNotification(await NotificationConverter.encode(notification, user));
		} catch (e: any) {
			console.error(e);
			ctx.status = 401;
			ctx.body = e.response.data;
		}
	});

	router.post("/v1/notifications/clear", async (ctx) => {
		const BASE_URL = `${ctx.request.protocol}://${ctx.request.hostname}`;
		const accessTokens = ctx.request.headers.authorization;
		const client = getClient(BASE_URL, accessTokens);
		const body: any = ctx.request.body;
		try {
			const data = await client.dismissNotifications();
			ctx.body = data.data;
		} catch (e: any) {
			console.error(e);
			ctx.status = 401;
			ctx.body = e.response.data;
		}
	});

	router.post("/v1/notification/:id/dismiss", async (ctx) => {
		const BASE_URL = `${ctx.request.protocol}://${ctx.request.hostname}`;
		const accessTokens = ctx.request.headers.authorization;
		const client = getClient(BASE_URL, accessTokens);
		const body: any = ctx.request.body;
		try {
			const data = await client.dismissNotification(
				convertId(ctx.params.id, IdType.IceshrimpId),
			);
			ctx.body = data.data;
		} catch (e: any) {
			console.error(e);
			ctx.status = 401;
			ctx.body = e.response.data;
		}
	});
}
