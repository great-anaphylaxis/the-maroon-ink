export function cleanText(input) {
  if (!input) return "";
  
  // Normalize styled characters and remove emojis/non-ASCII
  return input
    .normalize("NFKD")
    .replace(/[^\x00-\x7F]/g, "");
}