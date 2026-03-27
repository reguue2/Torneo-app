export const SPAIN_COMMUNITIES = [
  "Andalucía",
  "Aragón",
  "Asturias",
  "Cantabria",
  "Castilla-La Mancha",
  "Castilla y León",
  "Cataluña",
  "Madrid",
  "Navarra",
  "Valencia",
  "Extremadura",
  "Galicia",
  "Islas Baleares",
  "Islas Canarias",
  "La Rioja",
  "País Vasco",
  "Murcia",
] as const

export function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
}