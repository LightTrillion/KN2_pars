/**
 * Парсер объявлений об аренде жилья с сайта kvartirant.ru.
 *
 * Запуск:
 *   npm run parse                         — все города сразу
 *   npm run parse -- --city=spb           — только Петербург (остальные сохраняются)
 *   npm run parse -- --city=all --pages=2 --details=20 --delay=250
 *
 * Доступные города (--city): all, msk, mo, spb, lo, nsk.
 * Москва и область — разные пути на одном домене; Петербург, Ленинградская
 * область и Новосибирск — отдельные поддомены kvartirant.ru.
 *
 * Как работает:
 *  1. Для каждого города загружаем несколько страниц каталога.
 *  2. cheerio (jQuery-подобный API) разбирает HTML и достаёт из карточек
 *     название, цену, комнаты, площадь, адрес, метро, описание и фото.
 *  3. Для части объявлений загружаем страницу целиком: там есть галерея
 *     со всеми фото и полный текст описания.
 *  4. Результат сохраняется в src/data/listings.json, откуда его читает Vue.
 *     При --city=<конкретный город> предыдущие города не теряются: новые данные
 *     заменяют только этот город в общем файле.
 *
 * Важно: все поля необязательные. Если на сайте чего-то нет, мы пишем null
 * или пустой массив — приложение обязано пережить это и показать остальное.
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import axios from 'axios'
import * as cheerio from 'cheerio'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/**
 * Города, с которых умеет работать парсер. Ключ передаётся в --city.
 * base — корень сайта (там же лежат страницы объявлений /<id>/),
 * catalog — путь к каталогу аренды внутри этого корня.
 */
const CITIES = {
  msk: {
    label: 'Москва',
    base: 'https://www.kvartirant.ru',
    catalog: '/Moskva/sniat-kvartiru/',
  },
  mo: {
    label: 'Московская область',
    base: 'https://www.kvartirant.ru',
    catalog: '/Moskovskaya_obl/sniat-kvartiru/',
  },
  spb: {
    label: 'Санкт-Петербург',
    base: 'https://spb.kvartirant.ru',
    catalog: '/sniat-kvartiru/',
  },
  lo: {
    label: 'Ленинградская область',
    base: 'https://leningradskaya.kvartirant.ru',
    catalog: '/sniat-kvartiru/',
  },
  nsk: {
    label: 'Новосибирск',
    base: 'https://novosibirsk.kvartirant.ru',
    catalog: '/sniat-kvartiru/',
  },
}

const CITY_KEYS = Object.keys(CITIES)

const args = parseArgs(process.argv.slice(2))
const OUTPUT_FILE = args.out
  ? path.resolve(process.cwd(), args.out)
  : path.resolve(__dirname, '../src/data/listings.json')

// Текущий город меняется перед обработкой каждой порции каталога.
let activeCity = CITIES.msk
let activeCityKey = 'msk'
let BASE = activeCity.base
let CATALOG = `${BASE}${activeCity.catalog}`

function setCity(key) {
  activeCity = CITIES[key]
  activeCityKey = key
  BASE = activeCity.base
  CATALOG = `${BASE}${activeCity.catalog}`
}

setCity(args.city === 'all' ? CITY_KEYS[0] : args.city)

// Названия районов, которые встречаются в адресах/описаниях объявлений.
// Используются как запасной способ определить район, если сайт не даёт такое поле.
const MOSCOW_DISTRICTS = [
  'Арбат', 'Басманный', 'Беговой', 'Богородское', 'Бутырский', 'Вознесенский',
  'Дорогомилово', 'Замоскворечье', 'Красносельский', 'Мещанский', 'Останкинский',
  'Пресненский', 'Сокольники', 'Таганский', 'Тверской', 'Хамовники', 'Хорошёвский',
  'Якиманка', 'Аэропорт', 'Алексеевский', 'Бабушкинский', 'Бирюлёво', 'Выхино',
  'Даниловский', 'Кунцево', 'Люблино', 'Марьино', 'Отрадное', 'Перово', 'Раменки',
  'Сокол', 'Тропарёво', 'Черёмушки', 'Щукино', 'Ясенево', 'Строгино', 'Митино',
  'Крылатское', 'Кизел', 'Куркино', 'Лефортово', 'Новокосино', 'Северное Бутово',
  'Южное Бутово', 'Комсомольский', 'Гагаринский', 'Нагатинский', 'Царицыно',
]

const SPB_DISTRICTS = [
  'Адмиралтейский', 'Василеостровский', 'Выборгский', 'Калининский', 'Кировский',
  'Красногвардейский', 'Красносельский', 'Московский', 'Невский', 'Петроградский',
  'Приморский', 'Фрунзенский', 'Центральный',
]

const NSK_DISTRICTS = [
  'Дзержинский', 'Заельцовский', 'Железнодорожный', 'Ленинский',
  'Октябрьский', 'Первомайский', 'Советский',
]

const KNOWN_DISTRICTS = [...MOSCOW_DISTRICTS, ...SPB_DISTRICTS, ...NSK_DISTRICTS]

const client = axios.create({
  timeout: 20000,
  headers: {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/124.0 Safari/537.36',
    'Accept-Language': 'ru-RU,ru;q=0.9,en;q=0.6',
    Accept: 'text/html,application/xhtml+xml',
  },
})

function parseArgs(argv) {
  const result = { city: 'all', pages: 2, details: 20, delay: 250, out: null }
  for (const arg of argv) {
    const [key, raw] = arg.replace(/^--/, '').split('=')
    if (!(key in result) || raw === undefined) continue
    result[key] = key === 'city' || key === 'out' ? raw : Number(raw)
  }

  if (result.city !== 'all' && !CITIES[result.city]) {
    console.warn(
      `Неизвестный город «${result.city}». Доступно: all, ${CITY_KEYS.join(', ')}. ` +
      'Используем all.',
    )
    result.city = 'all'
  }

  result.pages = Math.max(1, Math.min(10, result.pages || 1))
  result.details = Math.max(0, result.details || 0)
  result.delay = Math.max(0, result.delay || 0)
  return result
}

/** Приводит «75\u00a0000 ₽» или «40,5» к числу. Возвращает null, если не вышло. */
function toNumber(value) {
  if (value === null || value === undefined) return null
  const normalized = String(value).replace(/[\s\u00a0]/g, '').replace(',', '.')
  const match = normalized.match(/-?\d+(?:\.\d+)?/)
  if (!match) return null
  const number = Number(match[0])
  return Number.isFinite(number) ? number : null
}

/** Чистит пробелы/переносы, которые щедро расставляет вёрстка сайта. */
function clean(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
}

function absoluteUrl(value) {
  if (!value) return null
  try {
    return new URL(value, BASE).toString()
  } catch {
    return null
  }
}

/**
 * Сайт не отдаёт отдельное поле «район», поэтому пробуем:
 *  1) явное упоминание «р-н. Х» / «район Х»;
 *  2) известное название района в адресе или описании;
 *  3) метро как очень грубый, но понятный пользователю ориентир.
 * Ничего не нашли → null (приложение должно это пережить).
 */
function guessDistrict(address, description, metro) {
  const haystack = `${address || ''} ${description || ''}`
  const explicit = haystack.match(
    /(?:р-н\.?|район)\s+(?:города\s*)?[-–—]?\s*([А-Яа-яЁё][А-Яа-яЁё\- ]{2,29}?)(?=[,.;]|\s*$)/i,
  )
  if (explicit) return clean(explicit[1]).replace(/\s*[-–—]\s*$/, '')

  const found = KNOWN_DISTRICTS.find((name) =>
    new RegExp(`(^|[^А-Яа-яЁё])${name}([^А-Яа-яЁё]|$)`, 'i').test(haystack),
  )
  if (found) return found

  return metro ? `м. ${metro}` : null
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function fetchHtml(url) {
  const response = await client.get(url)
  return response.data
}

/** Достаёт данные из одной карточки каталога. */
function parseCard($, card) {
  const link = card.find('.obj-info h3 a').first()
  const href = link.attr('href') || ''
  const id = href.match(/\/(\d+)\//)?.[1] ?? null

  // В h3 находится и заголовок, и цена: «Сдам квартиру 2-комнатную за 75 000 ₽».
  const heading = clean(link.text())
  const priceMatch = heading.match(/за\s+([\d\s\u00a0]+)/i)
  const price = priceMatch ? toNumber(priceMatch[1]) : null
  const title = clean(heading.replace(/\s*за\s+[\d\s\u00a0]+.*$/i, '')) || null

  // .obj-info — прямой ребёнок группы, поэтому нужен filter(), а не find().
  const textBlock = card.filter('.obj-info').last()
  const infoText = clean(textBlock.text())
  const roomsMatch = title?.match(/(\d+)\s*-?\s*комнат/i)
  const areaMatch = infoText.match(/Площадь:\s*([\d.,]+)\s*м/i)

  let address = null
  textBlock.find('span').each((_, span) => {
    const value = clean($(span).text())
    if (value.startsWith('Адрес:')) address = clean(value.replace(/^Адрес:\s*/, ''))
  })

  const descriptionNode = textBlock.find('p').first().clone()
  descriptionNode.find('a, i').remove()
  const description = clean(descriptionNode.text()) || null

  const metro = clean(textBlock.find('a[href*="metro-"]').first().text()) || null

  let photo = absoluteUrl(card.find('a.fancybox img').first().attr('src'))
  if (photo && /no_photo/i.test(photo)) photo = null

  const photosCount = clean(card.find('.foto-count').first().text()) || null
  const addedAt = clean(
    card.filter('.obj-data').first().text().replace(/^Добавлено:\s*/i, ''),
  ) || null

  return {
    id,
    cityKey: activeCityKey,
    city: activeCity.label,
    title,
    price,
    district: guessDistrict(address, description, metro),
    rooms: roomsMatch ? Number(roomsMatch[1]) : null,
    area: areaMatch ? toNumber(areaMatch[1]) : null,
    description,
    photos: photo ? [photo] : [],
    photosCount,
    address,
    metro,
    addedAt,
    params: [],
    sourceUrl: id ? `${BASE}/${id}/` : href ? absoluteUrl(href) : null,
  }
}

/**
 * В вёрстке сайта несколько объявлений лежат в одном .row подряд.
 * Границей служит блок .obj-data («Добавлено: …») — с него начинается
 * каждое следующее объявление. Разбиваем row на такие группы.
 */
function splitRowIntoCards($, row) {
  const groups = []
  let current = null

  $(row).children().each((_, element) => {
    if ($(element).hasClass('obj-data')) {
      current = []
      groups.push(current)
    }
    if (current) current.push(element)
  })

  return groups
    .map((group) => $(group))
    .filter((card) => card.find('.obj-info h3 a').length > 0)
}

/** Собирает карточки со всех страниц каталога текущего города, убирает дубликаты по id. */
async function parseCatalog(pages) {
  const items = []
  for (let page = 1; page <= pages; page += 1) {
    const url = page === 1 ? CATALOG : `${CATALOG}?page=${page}`
    try {
      const html = await fetchHtml(url)
      const $ = cheerio.load(html)
      let count = 0

      $('.col-obj > .row').each((_, row) => {
        for (const card of splitRowIntoCards($, $(row))) {
          const item = parseCard($, card)
          if (item.id) {
            items.push(item)
            count += 1
          }
        }
      })
      console.log(`  Каталог, стр. ${page}: найдено карточек — ${count}`)
    } catch (error) {
      console.warn(`  Не удалось загрузить страницу ${page}: ${error.message}`)
    }
    if (page < pages) await sleep(args.delay)
  }

  const unique = new Map()
  for (const item of items) if (!unique.has(item.id)) unique.set(item.id, item)
  return [...unique.values()]
}

/** Достаёт максимум деталей с отдельной страницы объявления. */
function parseDetail($) {
  const photos = $('.bxSlider li a.modalImg img')
    .map((_, img) => absoluteUrl($(img).attr('src')))
    .get()
    .filter((url) => url && !/no_photo/i.test(url))

  const descriptionNode = $('.obj-info p').filter(
    (_, p) => $(p).find('i.fa-newspaper-o').length > 0,
  ).first()
  const description = clean(descriptionNode.text()) || null

  const params = $('.params')
    .map((_, el) => clean($(el).text()))
    .get()
    .filter(Boolean)

  // На странице объявления два блока .obj-info: галерея и текст с h3.
  const infoBlock = $('.obj-info').filter((_, el) => $(el).find('h3').length > 0).first()
  const areaMatch = clean(infoBlock.text()).match(/Площадь:\s*([\d.,]+)\s*м/i)

  return {
    photos,
    description,
    params,
    area: areaMatch ? toNumber(areaMatch[1]) : null,
  }
}

/** Детальная информация заменяет базовую только если она действительно есть. */
function mergeDetail(base, detail) {
  const merged = {
    ...base,
    description: detail.description || base.description,
    area: detail.area ?? base.area,
    photos: detail.photos.length ? detail.photos : base.photos,
    params: detail.params.length ? detail.params : base.params,
  }

  // В каталоге описание короткое; полный текст с деталей может подсказать район.
  if (!merged.district) {
    merged.district = guessDistrict(merged.address, merged.description, merged.metro)
  }
  return merged
}

function cityKeyByLabel(label) {
  return label ? CITY_KEYS.find((key) => CITIES[key].label === label) ?? null : null
}

/** Читаем предыдущий результат, чтобы частичный запуск не стирал другие города. */
async function loadExisting() {
  try {
    const parsed = JSON.parse(await fs.readFile(OUTPUT_FILE, 'utf8'))
    if (!parsed || !Array.isArray(parsed.listings)) return null

    const fallbackKey = parsed.meta?.cityKey || cityKeyByLabel(parsed.meta?.city) || 'msk'
    return {
      listings: parsed.listings.map((item) => {
        const cityKey = item.cityKey || fallbackKey
        return {
          ...item,
          cityKey,
          city: item.city || CITIES[cityKey]?.label || cityKey,
        }
      }),
      cities: Array.isArray(parsed.cities) ? parsed.cities : [],
    }
  } catch {
    return null
  }
}

async function parseCity(key) {
  setCity(key)
  console.log(`\n→ ${activeCity.label}: ${CATALOG}`)
  const listings = await parseCatalog(args.pages)

  const detailedCount = Math.min(args.details, listings.length)
  for (let i = 0; i < detailedCount; i += 1) {
    const item = listings[i]
    try {
      const html = await fetchHtml(item.sourceUrl)
      const $ = cheerio.load(html)
      listings[i] = mergeDetail(item, parseDetail($))
    } catch (error) {
      // Страница недоступна — оставляем то, что уже нашли в каталоге.
      console.warn(`  Детали ${item.id} недоступны: ${error.message}`)
    }
    if (args.delay) await sleep(args.delay)
  }

  if (!listings.length) console.warn(`  Для города «${activeCity.label}» ничего не найдено.`)

  return {
    listings,
    meta: {
      key,
      label: activeCity.label,
      base: BASE,
      catalogUrl: CATALOG,
      count: listings.length,
      detailed: detailedCount,
      parsedAt: new Date().toISOString(),
    },
  }
}

async function main() {
  console.log('Запуск парсера kvartirant.ru …')
  const existing = await loadExisting()
  const keys = args.city === 'all' ? CITY_KEYS : [args.city]
  const freshListings = []
  const freshCityMeta = []

  for (let i = 0; i < keys.length; i += 1) {
    const result = await parseCity(keys[i])
    freshListings.push(...result.listings)
    freshCityMeta.push(result.meta)
    if (i < keys.length - 1 && args.delay) await sleep(args.delay)
  }

  const previousListings = existing?.listings ?? []
  const previousCities = existing?.cities ?? []

  const finalListings = args.city === 'all'
    ? freshListings
    : [...previousListings.filter((item) => item.cityKey !== args.city), ...freshListings]

  const finalCities = args.city === 'all'
    ? freshCityMeta
    : [...previousCities.filter((city) => city.key !== args.city), ...freshCityMeta]

  // Подстраховка: если в старом файле не было секции cities — восстановим её.
  for (const item of finalListings) {
    if (finalCities.some((city) => city.key === item.cityKey)) continue
    finalCities.push({
      key: item.cityKey,
      label: item.city || CITIES[item.cityKey]?.label || item.cityKey,
      count: 0,
      legacy: true,
    })
  }
  for (const city of finalCities) {
    city.count = finalListings.filter((item) => item.cityKey === city.key).length
  }
  finalCities.sort((a, b) => {
    const ai = CITY_KEYS.indexOf(a.key)
    const bi = CITY_KEYS.indexOf(b.key)
    return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi)
  })

  const payload = {
    meta: {
      source: 'kvartirant.ru',
      parsedAt: new Date().toISOString(),
      cities: finalCities.map(({ key, label }) => ({ key, label })),
      pages: args.city === 'all'
        ? args.pages
        : Math.max(existing?.meta?.pages ?? 0, args.pages),
      detailed: finalCities.reduce((sum, city) => sum + (city.detailed || 0), 0),
      total: finalListings.length,
      lastRun: { city: args.city, keys },
    },
    cities: finalCities,
    listings: finalListings,
  }

  await fs.mkdir(path.dirname(OUTPUT_FILE), { recursive: true })
  await fs.writeFile(OUTPUT_FILE, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
  console.log(
    `\nГотово: ${finalListings.length} объявлений в ${finalCities.length} городах → ${OUTPUT_FILE}`,
  )
}

main().catch((error) => {
  console.error('Парсер завершился с ошибкой:', error)
  process.exitCode = 1
})
