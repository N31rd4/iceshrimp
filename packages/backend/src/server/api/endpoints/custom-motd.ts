// import { IsNull } from 'typeorm';
import { fetchMeta } from '@/misc/fetch-meta.js';
import define from '../define.js';

export const meta = {
	tags: ['meta'],

	requireCredential: false,
	requireCredentialPrivateMode: true,

	res: {
		type: 'array',
		optional: false, nullable: false,
		items: {
			type: 'string',
			optional: false, nullable: false,
		},
	},
} as const;

export const paramDef = {
	type: 'array',
	properties: {},
	required: [],
} as const;

// eslint-disable-next-line import/no-default-export
export default define(meta, paramDef, async () => {
	const meta = await fetchMeta();
	const motd = await Promise.all(meta.customMOTD.map(x => x));
	return motd;
});
