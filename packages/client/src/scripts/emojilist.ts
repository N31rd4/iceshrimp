import data from "unicode-emoji-json/data-by-group.json";
import emojiComponents from "unicode-emoji-json/data-emoji-components.json";
import keywordSet from "emojilib";
import { defaultStore } from "@/store";

export type UnicodeEmojiDef = {
	emoji: string;
	category: typeof unicodeEmojiCategories[number];
	skin_tone_support: boolean;
	slug: string;
	keywords?: string[];
};

export const unicodeEmojiCategories = [
	"emotion",
	"people",
	"animals_and_nature",
	"food_and_drink",
	"activity",
	"travel_and_places",
	"objects",
	"symbols",
	"flags",
] as const;

export const categoryMapping = {
	"Smileys & Emotion": "emotion",
	"People & Body": "people",
	"Animals & Nature": "animals_and_nature",
	"Food & Drink": "food_and_drink",
	Activities: "activity",
	"Travel & Places": "travel_and_places",
	Objects: "objects",
	Symbols: "symbols",
	Flags: "flags",
} as const;

export const unicodeEmojiSkinTones = [
	"#FFDC5E",
	"#F7DFCF",
	"#F3D3A3",
	"#D6AE89",
	"#B17F56",
	"#7D523C",
];

export function addSkinTone(emoji: string, skinTone?: number) {
	const individualData = import("unicode-emoji-json/data-by-emoji.json");

	const chosenSkinTone = skinTone || defaultStore.state.reactionPickerSkinTone;
	const skinToneModifiers = [
		"",
		emojiComponents.light_skin_tone,
		emojiComponents.medium_light_skin_tone,
		emojiComponents.medium_skin_tone,
		emojiComponents.medium_dark_skin_tone,
		emojiComponents.dark_skin_tone,
	];
	if (individualData[emoji]?.skin_tone_support === false) {
		return emoji;
	}
	return (
		emoji.replace(
			new RegExp(
				`(${skinToneModifiers.slice(1).join("|")})`,
				"gi",
			),
			"",
		) + (skinToneModifiers[chosenSkinTone - 1] || "")
	);
}

const unicodeFifteenEmojis = [
	"🫨",
	"🩷",
	"🩵",
	"🩶",
	"🫷",
	"🫸",
	"🫎",
	"🫏",
	"🪽",
	"🐦‍⬛",
	"🪿",
	"🪼",
	"🪻",
	"🫚",
	"🫛",
	"🪭",
	"🪮",
	"🪇",
	"🪈",
	"🪯",
	"🛜",
];

const newData = {};

Object.keys(data).forEach((originalCategory) => {
	const newCategory = categoryMapping[originalCategory];
	if (newCategory) {
		newData[newCategory] = newData[newCategory] || [];
		Object.keys(data[originalCategory]).forEach((emojiIndex) => {
			const emojiObj = { ...data[originalCategory][emojiIndex] };
			if (unicodeFifteenEmojis.includes(emojiObj.emoji)) {
				return;
			}
			emojiObj.category = newCategory;
			emojiObj.keywords = keywordSet[emojiObj.emoji];
			newData[newCategory].push(emojiObj);
		});
	}
});

export const emojilist: UnicodeEmojiDef[] = Object.keys(newData).reduce(
	(acc, category) => {
		const categoryItems = newData[category].map((item) => {
			return {
				emoji: item.emoji,
				slug: item.slug,
				category: item.category,
				skin_tone_support: item.skin_tone_support || false,
				keywords: item.keywords || [],
			};
		});
		return acc.concat(categoryItems);
	},
	[],
);

export function getNicelyLabeledCategory(internalName) {
	return (
		Object.keys(categoryMapping).find(
			(key) => categoryMapping[key] === internalName,
		) || internalName
	);
}
