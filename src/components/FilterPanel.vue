<script setup>
// Каждое поле фильтра — отдельная v-model через defineModel (Vue 3.4+).
const search = defineModel('search', { default: '' })
const priceMin = defineModel('priceMin', { default: null })
const priceMax = defineModel('priceMax', { default: null })
const rooms = defineModel('rooms', { default: 'all' })
const district = defineModel('district', { default: 'all' })

defineProps({
  districts: { type: Array, default: () => [] },
  hasActiveFilters: { type: Boolean, default: false },
})

const emit = defineEmits(['reset'])
</script>

<template>
  <section class="filters" aria-label="Фильтры объявлений">
    <div class="filters__head">
      <h2 class="filters__title">Подобрать жильё</h2>
      <button
        v-if="hasActiveFilters"
        class="link-button"
        type="button"
        @click="emit('reset')"
      >
        Сбросить фильтры
      </button>
    </div>

    <div class="filters__grid">
      <label class="field field--search">
        <span class="field__label">Поиск по названию</span>
        <input
          v-model="search"
          class="field__input"
          type="search"
          placeholder="Например, 2-комнатную"
          autocomplete="off"
        />
      </label>

      <label class="field">
        <span class="field__label">Цена от, ₽</span>
        <input
          v-model="priceMin"
          class="field__input"
          type="number"
          min="0"
          step="1000"
          placeholder="0"
        />
      </label>

      <label class="field">
        <span class="field__label">Цена до, ₽</span>
        <input
          v-model="priceMax"
          class="field__input"
          type="number"
          min="0"
          step="1000"
          placeholder="Любая"
        />
      </label>

      <label class="field">
        <span class="field__label">Комнаты</span>
        <select v-model="rooms" class="field__input">
          <option value="all">Любое количество</option>
          <option value="1">1 комната</option>
          <option value="2">2 комнаты</option>
          <option value="3">3 комнаты</option>
          <option value="4plus">4 и более</option>
        </select>
      </label>

      <label class="field">
        <span class="field__label">Район</span>
        <select v-model="district" class="field__input">
          <option value="all">Все районы</option>
          <option v-for="item in districts" :key="item" :value="item">{{ item }}</option>
        </select>
      </label>
    </div>
  </section>
</template>
