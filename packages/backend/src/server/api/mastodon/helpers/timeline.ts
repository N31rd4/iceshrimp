import { Note } from "@/models/entities/note.js";
import { ILocalUser } from "@/models/entities/user.js";
import { Followings, Notes } from "@/models/index.js";
import { makePaginationQuery } from "@/server/api/common/make-pagination-query.js";
import { Brackets, SelectQueryBuilder } from "typeorm";
import { generateChannelQuery } from "@/server/api/common/generate-channel-query.js";
import { generateRepliesQuery } from "@/server/api/common/generate-replies-query.js";
import { generateVisibilityQuery } from "@/server/api/common/generate-visibility-query.js";
import { generateMutedUserQuery } from "@/server/api/common/generate-muted-user-query.js";
import { generateMutedNoteQuery } from "@/server/api/common/generate-muted-note-query.js";
import { generateBlockedUserQuery } from "@/server/api/common/generate-block-query.js";
import { generateMutedUserRenotesQueryForNotes } from "@/server/api/common/generated-muted-renote-query.js";
import { fetchMeta } from "@/misc/fetch-meta.js";
import { ApiError } from "@/server/api/error.js";
import { meta } from "@/server/api/endpoints/notes/global-timeline.js";

export class TimelineHelpers {
	private static async execQuery(query: SelectQueryBuilder<Note>, limit: number): Promise<Note[]> {
		// We fetch more than requested because some may be filtered out, and if there's less than
		// requested, the pagination stops.
		const found = [];
		const take = Math.floor(limit * 1.5);
		let skip = 0;
		try {
			while (found.length < limit) {
				const notes = await query.take(take).skip(skip).getMany();
				found.push(...notes);
				skip += take;
				if (notes.length < take) break;
			}
		} catch (error) {
			return [];
		}

		if (found.length > limit) {
			found.length = limit;
		}

		return found;
	}

	public static async getHomeTimeline(user: ILocalUser, maxId?: string, sinceId?: string, minId?: string, limit: number = 20): Promise<Note[]> {
		if (limit > 40) limit = 40;

		const hasFollowing =
			(await Followings.count({
				where: {
					followerId: user.id,
				},
				take: 1,
			})) !== 0;

		const followingQuery = Followings.createQueryBuilder("following")
			.select("following.followeeId")
			.where("following.followerId = :followerId", {followerId: user.id});

		//FIXME respect minId
		const query = makePaginationQuery(
			Notes.createQueryBuilder("note"),
			sinceId ?? minId,
			maxId,
		)
			.andWhere(
				new Brackets((qb) => {
					qb.where("note.userId = :meId", {meId: user.id});
					if (hasFollowing)
						qb.orWhere(`note.userId IN (${followingQuery.getQuery()})`);
				}),
			)
			.innerJoinAndSelect("note.user", "user")
			.leftJoinAndSelect("user.avatar", "avatar")
			.leftJoinAndSelect("user.banner", "banner")
			.leftJoinAndSelect("note.reply", "reply")
			.leftJoinAndSelect("note.renote", "renote")
			.leftJoinAndSelect("reply.user", "replyUser")
			.leftJoinAndSelect("replyUser.avatar", "replyUserAvatar")
			.leftJoinAndSelect("replyUser.banner", "replyUserBanner")
			.leftJoinAndSelect("renote.user", "renoteUser")
			.leftJoinAndSelect("renoteUser.avatar", "renoteUserAvatar")
			.leftJoinAndSelect("renoteUser.banner", "renoteUserBanner")
			.setParameters(followingQuery.getParameters());

		generateChannelQuery(query, user);
		generateRepliesQuery(query, true, user);
		generateVisibilityQuery(query, user);
		generateMutedUserQuery(query, user);
		generateMutedNoteQuery(query, user);
		generateBlockedUserQuery(query, user);
		generateMutedUserRenotesQueryForNotes(query, user);

		query.andWhere("note.visibility != 'hidden'");

		return this.execQuery(query, limit);
	}

	public static async getPublicTimeline(user: ILocalUser, maxId?: string, sinceId?: string, minId?: string, limit: number = 20, onlyMedia: boolean = false, local: boolean = false, remote: boolean = false): Promise<Note[]> {
		if (limit > 40) limit = 40;

		const m = await fetchMeta();
		if (m.disableGlobalTimeline) {
			if (user == null || !(user.isAdmin || user.isModerator)) {
				throw new ApiError(meta.errors.gtlDisabled);
			}
		}

		if (local && remote) {
			throw new Error("local and remote are mutually exclusive options");
		}

		//FIXME respect minId
		const query = makePaginationQuery(
			Notes.createQueryBuilder("note"),
			sinceId ?? minId,
			maxId,
		)
			.andWhere("note.visibility = 'public'");

		if (remote) query.andWhere("note.userHost IS NOT NULL");
		if (local) query.andWhere("note.userHost IS NULL");
		if (!local) query.andWhere("note.channelId IS NULL");

		query
			.innerJoinAndSelect("note.user", "user")
			.leftJoinAndSelect("user.avatar", "avatar")
			.leftJoinAndSelect("user.banner", "banner")
			.leftJoinAndSelect("note.reply", "reply")
			.leftJoinAndSelect("note.renote", "renote")
			.leftJoinAndSelect("reply.user", "replyUser")
			.leftJoinAndSelect("replyUser.avatar", "replyUserAvatar")
			.leftJoinAndSelect("replyUser.banner", "replyUserBanner")
			.leftJoinAndSelect("renote.user", "renoteUser")
			.leftJoinAndSelect("renoteUser.avatar", "renoteUserAvatar")
			.leftJoinAndSelect("renoteUser.banner", "renoteUserBanner");

		generateRepliesQuery(query, true, user);
		if (user) {
			generateMutedUserQuery(query, user);
			generateMutedNoteQuery(query, user);
			generateBlockedUserQuery(query, user);
			generateMutedUserRenotesQueryForNotes(query, user);
		}

		if (onlyMedia) query.andWhere("note.fileIds != '{}'");

		query.andWhere("note.visibility != 'hidden'");

		return this.execQuery(query, limit);
	}
}
