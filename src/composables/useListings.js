import { computed, reactive, ref, shallowRef, watch } from 'vue'
import dataset from '../data/listings.json'
import { demoListings } from '../data/demoListings'
import { toNumberOrNull } from '../utils/format'

const FAVORITES_KEY = 'housing-board:favorites'

// Парсер может ещё не запускаться — тогда listings.json будет пустым.
const parserListings = Array.isArray(dataset) ? dataset : dataset?.listings ?? []

function buildCitiesFromListings(items) {
  const map = new Map()
  for (const item of items) {
    const key = String(item?.cityKey ?? 'msk')
    if (!map.has(key)) {
      map.set(key, { key, label: String(item?.city ?? (key === 'msk' ? 'Москва' : key)) })
    }
  }
  return [...map.values()]
}

// Новый формат файла содержит список городов. Старый выводим из самих объявлений.
const parsedCities = Array.isArray(dataset?.cities) && dataset.cities.length
  ? dataset.cities.map((city) => ({
      key: String(city.key),
      label: String(city.label ?? city.key),
    }))
  : buildCitiesFromListings(parserListings)

const cityList = parsedCities.length ? parsedCities : [{ key: 'msk', label: 'Москва' }]
const defaultCityKey = cityList[0].key
const source = parserListings.length ? parserListings : demoListings

/**
 * Приводим объявление к единому виду и подставляем безопасные значения.
 * id делаем составным (город:номер), чтобы объявления разных городов с
 * одинаковыми номерами не конфликтовали в избранном.
 */
function normalize(raw, index) {
  const cityKey = String(raw?.cityKey ?? defaultCityKey)
  const sourceId = String(raw?.id ?? raw?.sourceUrl ?? `item-${index}`)
  const photos = Array.isArray(raw?.photos) ? raw.photos.filter(Boolean) : []

  return {
    id: `${cityKey}:${sourceId}`,
    sourceId,
    cityKey,
    city: String(raw?.city ?? cityList.find((item) => item.key === cityKey)?.label ?? cityKey),
    title: String(raw?.title ?? '').trim() || 'Без названия',
    price: toNumberOrNull(raw?.price),
    district: String(raw?.district ?? '').trim() || null,
    rooms: toNumberOrNull(raw?.rooms),
    area: toNumberOrNull(raw?.area),
    description: String(raw?.description ?? '').trim() || null,
    photos,
    photosCount: photos.length ? raw?.photosCount ?? null : null,
    address: String(raw?.address ?? '').trim() || null,
    metro: String(raw?.metro ?? '').trim() || null,
    addedAt: String(raw?.addedAt ?? '').trim() || null,
    params: Array.isArray(raw?.params) ? raw.params.filter(Boolean) : [],
    sourceUrl: String(raw?.sourceUrl ?? '').trim() || null,
  }
}

function loadFavorites(defaultKey) {
  try {
    const stored = JSON.parse(localStorage.getItem(FAVORITES_KEY) ?? '[]')
    if (!Array.isArray(stored)) return []
    return stored
      .filter((id) => typeof id === 'string')
      // Старые записи хранили просто номер объявления — относим их к городу по умолчанию.
      .map((id) => (id.includes(':') ? id : `${defaultKey}:${id}`))
  } catch {
    return []
  }
}

export function useListings() {
  const allListings = shallowRef(source.map(normalize))
  const cityKey = ref(defaultCityKey)
  const favorites = ref(loadFavorites(defaultCityKey))
  const selectedId = ref(null)
  const view = ref('all') // 'all' | 'favorites'
  const sort = ref('default')

  const filters = reactive({
    search: '',
    priceMin: null,
    priceMax: null,
    rooms: 'all',
    district: 'all',
  })

  const cityListings = computed(() =>
    allListings.value.filter((item) => item.cityKey === cityKey.value),
  )
  const activeCityLabel = computed(
    () => cityList.find((city) => city.key === cityKey.value)?.label ?? cityKey.value,
  )
  const favoriteIds = computed(() => new Set(favorites.value))
  const favoriteCount = computed(() =>
    cityListings.value.filter((item) => favoriteIds.value.has(item.id)).length,
  )

  const districts = computed(() =>
    [...new Set(cityListings.value.map((item) => item.district).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, 'ru')),
  )

  const matchedListings = computed(() => {
    const query = filters.search.trim().toLocaleLowerCase('ru-RU')
    // Пустое поле ввода приходит как '' — считаем его «не задано».
    const minPrice = toNumberOrNull(filters.priceMin)
    const maxPrice = toNumberOrNull(filters.priceMax)

    return cityListings.value.filter((item) => {
      if (view.value === 'favorites' && !favoriteIds.value.has(item.id)) return false

      if (query && !item.title.toLocaleLowerCase('ru-RU').includes(query)) return false

      if (minPrice !== null && (item.price === null || item.price < minPrice)) return false
      if (maxPrice !== null && (item.price === null || item.price > maxPrice)) return false

      if (filters.rooms === '4plus') {
        if (item.rooms === null || item.rooms < 4) return false
      } else if (filters.rooms !== 'all' && item.rooms !== Number(filters.rooms)) {
        return false
      }

      if (filters.district !== 'all' && item.district !== filters.district) return false

      return true
    })
  })

  const visibleListings = computed(() => {
    const items = [...matchedListings.value]
    switch (sort.value) {
      case 'price-asc':
        return items.sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity))
      case 'price-desc':
        return items.sort((a, b) => (b.price ?? -Infinity) - (a.price ?? -Infinity))
      case 'area-desc':
        return items.sort((a, b) => (b.area ?? -Infinity) - (a.area ?? -Infinity))
      default:
        return items
    }
  })

  const selectedListing = computed(
    () => allListings.value.find((item) => item.id === selectedId.value) ?? null,
  )

  const hasActiveFilters = computed(
    () =>
      Boolean(filters.search) ||
      toNumberOrNull(filters.priceMin) !== null ||
      toNumberOrNull(filters.priceMax) !== null ||
      filters.rooms !== 'all' ||
      filters.district !== 'all',
  )

  function toggleFavorite(id) {
    favorites.value = favoriteIds.value.has(id)
      ? favorites.value.filter((favorite) => favorite !== id)
      : [...favorites.value, id]
  }

  function resetFilters() {
    filters.search = ''
    filters.priceMin = null
    filters.priceMax = null
    filters.rooms = 'all'
    filters.district = 'all'
    sort.value = 'default'
  }

  function openDetails(id) {
    selectedId.value = id
  }

  function closeDetails() {
    selectedId.value = null
  }

  // У каждого города свой список районов, поэтому фильтры при переключении сбрасываем.
  watch(cityKey, () => {
    resetFilters()
    selectedId.value = null
  })

  watch(
    favorites,
    (value) => {
      try {
        localStorage.setItem(FAVORITES_KEY, JSON.stringify(value))
      } catch {
        // Приватный режим браузера — просто не сохраняем избранное.
      }
    },
    { deep: true },
  )

  return {
    cities: cityList,
    cityKey,
    activeCityLabel,
    listings: cityListings,
    visibleListings,
    matchedCount: computed(() => matchedListings.value.length),
    totalCount: computed(() => cityListings.value.length),
    allCount: computed(() => allListings.value.length),
    favoriteCount,
    favoriteIds,
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
  }
}
