export const logSchema = {
	/**
	 * アクティブユーザー数
	 */
	count: {
		type: 'number' as const,
		optional: false as const, nullable: false as const,
		description: 'アクティブユーザー数',
	},
};

/**
 * アクティブユーザーに関するチャート
 */
export const schema = {
	type: 'object' as const,
	optional: false as const, nullable: false as const,
	properties: {
		local: {
			type: 'object' as const,
			optional: false as const, nullable: false as const,
			properties: logSchema
		},
		remote: {
			type: 'object' as const,
			optional: false as const, nullable: false as const,
			properties: logSchema
		},
	}
};

export const name = 'activeUsers';
