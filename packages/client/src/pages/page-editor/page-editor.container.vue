<template>
	<div class="cpjygsrt" :class="{ error: error != null, warn: warn != null }">
		<header>
			<div class="title"><slot name="header"></slot></div>
			<div class="buttons">
				<slot name="func"></slot>
				<button v-if="removable" class="_button" @click="remove()">
					<i class="ph-trash ph-bold ph-lg"></i>
				</button>
				<button v-if="draggable" class="drag-handle _button">
					<i class="ph-list ph-bold ph-lg"></i>
				</button>
				<button class="_button" @click="toggleContent(!showBody)">
					<template v-if="showBody"
						><i class="ph-caret-up ph-bold ph-lg"></i
					></template>
					<template v-else
						><i class="ph-caret-down ph-bold ph-lg"></i
					></template>
				</button>
			</div>
		</header>
		<p v-show="showBody" v-if="error != null" class="error">
			{{
				i18n.t("_pages.script.typeError", {
					slot: error.arg + 1,
					expect: i18n.t(`script.types.${error.expect}`),
					actual: i18n.t(`script.types.${error.actual}`),
				})
			}}
		</p>
		<p v-show="showBody" v-if="warn != null" class="warn">
			{{
				i18n.t("_pages.script.thereIsEmptySlot", {
					slot: warn.slot + 1,
				})
			}}
		</p>
		<div v-show="showBody" class="body">
			<slot></slot>
		</div>
	</div>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import { i18n } from "@/i18n";

export default defineComponent({
	props: {
		expanded: {
			type: Boolean,
			default: true,
		},
		removable: {
			type: Boolean,
			default: true,
		},
		draggable: {
			type: Boolean,
			default: false,
		},
		error: {
			required: false,
			default: null,
		},
		warn: {
			required: false,
			default: null,
		},
	},
	emits: ["toggle", "remove"],
	data() {
		return {
			showBody: this.expanded,
			i18n,
		};
	},
	methods: {
		toggleContent(show: boolean) {
			this.showBody = show;
			this.$emit("toggle", show);
		},
		remove() {
			this.$emit("remove");
		},
	},
});
</script>

<style lang="scss" scoped>
.cpjygsrt {
	position: relative;
	overflow: hidden;
	background: var(--panel);
	border: solid 2px var(--divider);
	border-radius: 6px;

	&:hover {
		border: solid 2px var(--dividerHovered);
	}

	&.warn {
		border: solid 2px #f6c177;
	}

	&.error {
		border: solid 2px #eb6f92;
	}

	& + .cpjygsrt {
		margin-top: 16px;
	}

	> header {
		> .title {
			z-index: 1;
			margin: 0;
			padding: 0 16px;
			line-height: 42px;
			font-size: 0.9em;
			font-weight: bold;
			box-shadow: 0 1px rgba(#000, 0.07);

			> i {
				margin-right: 6px;
			}

			&:empty {
				display: none;
			}
		}

		> .buttons {
			position: absolute;
			z-index: 2;
			top: 0;
			right: 0;

			> button {
				padding: 0;
				width: 42px;
				font-size: 0.9em;
				line-height: 42px;
			}

			.drag-handle {
				cursor: move;
			}
		}
	}

	> .warn {
		color: #ea9d34;
		margin: 0;
		padding: 16px 16px 0 16px;
		font-size: 14px;
	}

	> .error {
		color: #b4637a;
		margin: 0;
		padding: 16px 16px 0 16px;
		font-size: 14px;
	}

	> .body {
		::v-deep(.juejbjww),
		::v-deep(.eiipwacr) {
			&:not(.inline):first-child {
				margin-top: 28px;
			}

			&:not(.inline):last-child {
				margin-bottom: 20px;
			}
		}
	}
}
</style>
