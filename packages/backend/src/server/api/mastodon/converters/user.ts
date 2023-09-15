import { User } from "@/models/entities/user.js";
import config from "@/config/index.js";
import { DriveFiles, UserProfiles, Users } from "@/models/index.js";
import { EmojiConverter } from "@/server/api/mastodon/converters/emoji.js";
import { populateEmojis } from "@/misc/populate-emojis.js";
import { toHtml } from "@/mfm/to-html.js";
import { escapeMFM } from "@/server/api/mastodon/converters/mfm.js";
import mfm from "mfm-js";
import { awaitAll } from "@/prelude/await-all.js";

type Field = {
	name: string;
	value: string;
	verified?: boolean;
};

export class UserConverter {
	public static async encode(u: User): Promise<MastodonEntity.Account> {
		let acct = u.username;
		let acctUrl = `https://${u.host || config.host}/@${u.username}`;
		if (u.host) {
			acct = `${u.username}@${u.host}`;
			acctUrl = `https://${u.host}/@${u.username}`;
		}
		const profile = UserProfiles.findOneBy({userId: u.id});
		const bio = profile.then(profile => toHtml(mfm.parse(profile?.description ?? "")) ?? escapeMFM(profile?.description ?? ""));
		const avatar = u.avatarId
			? (DriveFiles.findOneBy({ id: u.avatarId }))
				.then(p => p?.url ?? Users.getIdenticonUrl(u.id))
			: Users.getIdenticonUrl(u.id);
		const banner = u.bannerId
			? (DriveFiles.findOneBy({ id: u.bannerId }))
				.then(p => p?.url ?? `${config.url}/static-assets/transparent.png`)
			: `${config.url}/static-assets/transparent.png`;

		return awaitAll({
			id: u.id,
			username: u.username,
			acct: acct,
			display_name: u.name || u.username,
			locked: u.isLocked,
			created_at: new Date().toISOString(),
			followers_count: u.followersCount,
			following_count: u.followingCount,
			statuses_count: u.notesCount,
			note: bio,
			url: u.uri ?? acctUrl,
			avatar: avatar,
			avatar_static: avatar,
			header: banner,
			header_static: banner,
			emojis: populateEmojis(u.emojis, u.host).then(emoji => emoji.map((e) => EmojiConverter.encode(e))),
			moved: null, //FIXME
			fields: profile.then(profile => profile?.fields.map(p => this.encodeField(p)) ?? []),
			bot: u.isBot
		});
	}

	private static encodeField(f: Field): MastodonEntity.Field {
		return {
			name: f.name,
			value: toHtml(mfm.parse(f.value)) ?? escapeMFM(f.value),
			verified_at: f.verified ? (new Date()).toISOString() : null,
		}
	}

}
