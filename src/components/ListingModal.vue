<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { formatArea, formatPrice, formatRooms } from '../utils/format'

const props = defineProps({
  listing: { type: Object, required: true },
  favorite: { type: Boolean, default: false },
})

const emit = defineEmits(['close', 'toggle-favorite'])

const activePhoto = ref(0)
const imageFailed = ref(false)
let previousOverflow = ''

watch(() => props.listing.id, () => {
  activePhoto.value = 0
  imageFailed.value = false
})

const photos = computed(() => props.listing.photos)
const currentPhoto = computed(() =>
  !imageFailed.value && photos.value.length ? photos.value[activePhoto.value] : null,
)

function shiftPhoto(step) {
  if (!photos.value.length) return
  imageFailed.value = false
  activePhoto.value = (activePhoto.value + step + photos.value.length) % photos.value.length
}

function onKeydown(event) {
  if (event.key === 'Escape') emit('close')
  if (event.key === 'ArrowRight') shiftPhoto(1)
  if (event.key === 'ArrowLeft') shiftPhoto(-1)
}

onMounted(() => {
  previousOverflow = document.body.style.overflow
  document.body.style.overflow = 'hidden'
  document.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  document.body.style.overflow = previousOverflow
  document.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <Teleport to="body">
    <div class="modal" role="dialog" aria-modal="true" :aria-label="listing.title" @click.self="emit('close')">
      <div class="modal__panel">
        <button class="modal__close" type="button" aria-label="Закрыть" @click="emit('close')">✕</button>

        <div class="modal__gallery">
          <div class="modal__photo">
            <img
              v-if="currentPhoto"
              :src="currentPhoto"
              :alt="listing.title"
              @error="imageFailed = true"
            />
            <div v-else class="modal__no-photo">
              <span>📷</span>
              <p>Фотографии не предоставлены</p>
            </div>

            <template v-if="photos.length > 1">
              <button class="gallery-arrow gallery-arrow--prev" type="button" aria-label="Предыдущее фото" @click="shiftPhoto(-1)">‹</button>
              <button class="gallery-arrow gallery-arrow--next" type="button" aria-label="Следующее фото" @click="shiftPhoto(1)">›</button>
              <span class="gallery-counter">{{ activePhoto + 1 }} / {{ photos.length }}</span>
            </template>
          </div>

          <div v-if="photos.length > 1" class="modal__thumbnails">
            <button
              v-for="(photo, index) in photos"
              :key="photo + index"
              type="button"
              class="thumbnail"
              :class="{ 'thumbnail--active': index === activePhoto }"
              @click="activePhoto = index; imageFailed = false"
            >
              <img :src="photo" :alt="`Фото ${index + 1}`" loading="lazy" />
            </button>
          </div>
        </div>

        <div class="modal__content">
          <div class="modal__badges">
            <span v-if="listing.district" class="badge">📍 {{ listing.district }}</span>
            <span v-if="listing.addedAt" class="badge badge--muted">{{ listing.addedAt }}</span>
          </div>

          <h2 class="modal__title">{{ listing.title }}</h2>
          <p class="modal__price" :class="{ 'card__price--empty': listing.price === null }">
            {{ formatPrice(listing.price) }}
          </p>

          <div class="modal__facts">
            <div><span>Количество комнат</span><strong>{{ formatRooms(listing.rooms) }}</strong></div>
            <div><span>Площадь</span><strong>{{ formatArea(listing.area) }}</strong></div>
            <div v-if="listing.metro"><span>Метро</span><strong>{{ listing.metro }}</strong></div>
            <div v-if="listing.address"><span>Адрес</span><strong>{{ listing.address }}</strong></div>
          </div>

          <section class="modal__section">
            <h3>Описание</h3>
            <p>{{ listing.description || 'Описание отсутствует' }}</p>
          </section>

          <section v-if="listing.params.length" class="modal__section">
            <h3>Характеристики</h3>
            <div class="chips">
              <span v-for="param in listing.params" :key="param" class="chip">{{ param }}</span>
            </div>
          </section>

          <div class="modal__actions">
            <button
              class="button button--outline"
              type="button"
              @click="emit('toggle-favorite', listing.id)"
            >
              {{ favorite ? '♥ В избранном' : '♡ В избранное' }}
            </button>
            <a
              v-if="listing.sourceUrl"
              class="button button--primary"
              :href="listing.sourceUrl"
              target="_blank"
              rel="noopener noreferrer"
            >
              Оригинальное объявление ↗
            </a>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>
