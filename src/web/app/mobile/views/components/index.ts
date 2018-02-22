import Vue from 'vue';

import ui from './ui.vue';
import home from './home.vue';
import timeline from './timeline.vue';
import posts from './posts.vue';
import imagesImage from './images-image.vue';
import drive from './drive.vue';
import postPreview from './post-preview.vue';
import subPostContent from './sub-post-content.vue';
import postCard from './post-card.vue';
import userCard from './user-card.vue';
import postDetail from './post-detail.vue';
import followButton from './follow-button.vue';
import friendsMaker from './friends-maker.vue';

Vue.component('mk-ui', ui);
Vue.component('mk-home', home);
Vue.component('mk-timeline', timeline);
Vue.component('mk-posts', posts);
Vue.component('mk-images-image', imagesImage);
Vue.component('mk-drive', drive);
Vue.component('mk-post-preview', postPreview);
Vue.component('mk-sub-post-content', subPostContent);
Vue.component('mk-post-card', postCard);
Vue.component('mk-user-card', userCard);
Vue.component('mk-post-detail', postDetail);
Vue.component('mk-follow-button', followButton);
Vue.component('mk-friends-maker', friendsMaker);
