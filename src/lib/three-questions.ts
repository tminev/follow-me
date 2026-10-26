export const THREE_QUESTIONS = [
  "Кое малко нещо винаги подобрява деня ти?",
  "Кое място в града би показал/а на нов приятел?",
  "Коя тема можеш да обсъждаш с часове?",
];

export function answersFrom(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}
