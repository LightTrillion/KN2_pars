export function formatPrice(value) {
  if (value === null || value === undefined) return 'Цена не указана'
  return `${new Intl.NumberFormat('ru-RU').format(value)} ₽`
}

export function formatArea(value) {
  if (value === null || value === undefined) return 'Площадь не указана'
  return `${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 }).format(value)} м²`
}

export function formatRooms(value) {
  if (value === null || value === undefined) return 'Комнатность не указана'
  if (value === 0) return 'Студия'
  return `${value} комн.`
}

export function shortText(value, length = 150) {
  if (!value) return 'Описание отсутствует'
  return value.length > length ? `${value.slice(0, length).trim()}…` : value
}

export function toNumberOrNull(value) {
  if (value === null || value === undefined || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}
