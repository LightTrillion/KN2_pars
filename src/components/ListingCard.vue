<script setup>
import { computed, ref, watch } from 'vue'
import { formatArea, formatPrice, formatRooms, shortText } from '../utils/format'

const props = defineProps({
  listing: { type: Object, required: true },
  favorite: { type: Boolean, default: false },
})

const emit = defineEmits(['toggle-favorite', 'open'])

const imageFailed = ref(false)
watch(() => props.listing.photos, () => { imageFailed.value = false })

const cover = computed(() =>
  !imageFailed.value && props.listing.photos.length ? props.listing.photos[0] : null,
)

const photoLabel = computed(() => {
  const count = props.listing.photosCount
  return count ? `📷 ${count}` : props.listing.photos.length ? `📷 ${props.listing.photos.length}` : ''
})
</script>

<template>
  <article class="card">
    <button class="card__media" type="button" @click="emit('open', listing.id)">
      <img
        v-if="cover"
        :src="cover"
        :alt="listing.title"
        loading="lazy"
        @error="imageFailed = true"
      />
      <span v-else class="card__no-photo">Нет фотографий</span>
      <span v-if="photoLabel" class="card__photo-count">{{ photoLabel }}</span>
    </button>

    <button
      class="favorite-button"
      :class="{ 'favorite-button--active': favorite }"
      type="button"
      :aria-label="favorite ? 'Убрать из избранного' : 'Добавить в избранное'"
      :title="favorite ? 'Убрать из избранного' : 'В избранное'"
      @click="emit('toggle-favorite', listing.id)"
    >
      {{ favorite ? '♥' : '♡' }}
    </button>

    <div class="card__body">
      <h3 class="card__title">
        <button type="button" @click="emit('open', listing.id)">{{ listing.title }}</button>
      </h3>

      <p class="card__price" :class="{ 'card__price--empty': listing.price === null }">
        {{ formatPrice(listing.price) }}
      </p>

      <ul class="card__facts">
        <li><span>🛏</span> {{ formatRooms(listing.rooms) }}</li>
        <li><span>📐</span> {{ formatArea(listing.area) }}</li>
        <li v-if="listing.district"><span>📍</span> {{ listing.district }}</li>
      </ul>

      <p class="card__description">{{ shortText(listing.description) }}</p>

      <div class="card__footer">
        <span class="card__date">{{ listing.addedAt || 'Дата не указана' }}</span>
        <button class="card__more" type="button" @click="emit('open', listing.id)">
          Подробнее →
        </button>
      </div>
    </div>
  </article>
</template>
