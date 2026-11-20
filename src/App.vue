<script setup>
import { computed } from 'vue'
import FilterPanel from './components/FilterPanel.vue'
import ListingCard from './components/ListingCard.vue'
import ListingModal from './components/ListingModal.vue'
import { useListings } from './composables/useListings'
import dataset from './data/listings.json'

const {
  visibleListings,
  matchedCount,
  totalCount,
  favoriteCount,
  favoriteIds,
  cities,
  cityKey,
  activeCityLabel,
  districts,
  filters,
  view,
  sort,
  hasActiveFilters,
  selectedListing,
  toggleFavorite,
  resetFilters,
  openDetails,
  closeDetails,
} = useListings()

const meta = computed(() => dataset?.meta ?? null)
const usingDemo = computed(() => !(dataset?.listings?.length ?? (Array.isArray(dataset) ? dataset.length : 0)))

const parsedAtLabel = computed(() => {
  if (!meta.value?.parsedAt) return ''
  return new Date(meta.value.parsedAt).toLocaleString('ru-RU', {
    day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
  })
})

function showAll() {
  view.value = 'all'
  resetFilters()
}
</script>

<template>
  <div class="app">
    <header class="site-header">
      <div class="container site-header__inner">
        <div class="brand">
          <span class="brand__mark">⌂</span>
          <div>
            <p class="brand__name">Аренда.Просто</p>
            <p class="brand__subtitle">доска объявлений о жилье</p>
          </div>
        </div>

        <div class="header-controls">
          <label class="city-select">
            <span aria-hidden="true">📍</span>
            <select v-model="cityKey" aria-label="Выберите город">
              <option v-for="city in cities" :key="city.key" :value="city.key">
                {{ city.label }}
              </option>
            </select>
          </label>

          <nav class="view-switch" aria-label="Разделы">
            <button
              class="view-switch__button"
              :class="{ 'view-switch__button--active': view === 'all' }"
              type="button"
              @click="view = 'all'"
            >
              Все объявления <span class="view-switch__count">{{ totalCount }}</span>
            </button>
            <button
              class="view-switch__button"
              :class="{ 'view-switch__button--active': view === 'favorites' }"
              type="button"
              @click="view = 'favorites'"
            >
              Избранное <span class="view-switch__count">♥ {{ favoriteCount }}</span>
            </button>
          </nav>
        </div>
      </div>
    </header>

    <main class="container main">
      <section class="hero">
        <div>
          <h1 class="hero__title">Найдите квартиру, которая подходит именно вам</h1>
          <p class="hero__text">
            Актуальные объявления об аренде жилья в городе {{ activeCityLabel }}.
            Ищите по названию, фильтруйте по цене, комнатам и району, сохраняйте
            понравившееся в избранное.
          </p>
        </div>
        <div class="hero__stat">
          <strong>{{ totalCount }}</strong>
          <span>объявлений в базе</span>
        </div>
      </section>

      <FilterPanel
        v-model:search="filters.search"
        v-model:price-min="filters.priceMin"
        v-model:price-max="filters.priceMax"
        v-model:rooms="filters.rooms"
        v-model:district="filters.district"
        :districts="districts"
        :has-active-filters="hasActiveFilters"
        @reset="resetFilters"
      />

      <section class="results">
        <div class="results__head">
          <div>
            <h2 class="results__title">
              {{ view === 'favorites' ? 'Избранные объявления' : 'Объявления' }}
            </h2>
            <p class="results__count">
              Найдено <strong>{{ matchedCount }}</strong>
              из {{ totalCount }}
            </p>
          </div>

          <label class="sort">
            <span>Сортировка:</span>
            <select v-model="sort">
              <option value="default">По порядку</option>
              <option value="price-asc">Сначала дешевле</option>
              <option value="price-desc">Сначала дороже</option>
              <option value="area-desc">Больше площадь</option>
            </select>
          </label>
        </div>

        <div v-if="visibleListings.length" class="cards">
          <ListingCard
            v-for="item in visibleListings"
            :key="item.id"
            :listing="item"
            :favorite="favoriteIds.has(item.id)"
            @toggle-favorite="toggleFavorite"
            @open="openDetails"
          />
        </div>

        <div v-else class="empty">
          <div class="empty__icon">🔍</div>
          <h3>{{ view === 'favorites' && !favoriteCount ? 'В избранном пока пусто' : 'Объявления не найдены' }}</h3>
          <p>
            {{
              view === 'favorites' && !favoriteCount
                ? 'Нажмите на сердечко у понравившегося объявления, чтобы сохранить его здесь.'
                : 'Попробуйте изменить условия поиска — возможно, фильтры слишком строгие.'
            }}
          </p>
          <button class="button button--primary" type="button" @click="showAll">
            {{ view === 'favorites' && !favoriteCount ? 'Показать все объявления' : 'Сбросить фильтры' }}
          </button>
        </div>
      </section>
    </main>

    <footer class="site-footer">
      <div class="container site-footer__inner">
        <span>Данные: kvartirant.ru</span>
        <span>Город: {{ activeCityLabel }}</span>
        <span v-if="parsedAtLabel">Обновлено: {{ parsedAtLabel }}</span>
        <span v-if="usingDemo">Демо-данные (запустите <code>npm run parse</code>)</span>
      </div>
    </footer>

    <ListingModal
      v-if="selectedListing"
      :listing="selectedListing"
      :favorite="favoriteIds.has(selectedListing.id)"
      @close="closeDetails"
      @toggle-favorite="toggleFavorite"
    />
  </div>
</template>
