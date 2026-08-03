export const quotes = [
  "Careful — that beat drops hard.",
  "Skins are coming to nyan.city.",
  "Some say cats are related to aliens.",
  "The rainbow is load-bearing.",
  "More bangers incoming.",
  "One wallet, one row on the board.",
];

export function pickQuote() {
  return quotes[Math.floor(Math.random() * quotes.length)];
}
