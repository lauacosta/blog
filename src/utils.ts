export function to_title_case(input: string): string {
  return input
    .toLowerCase()
    .split(/\s+/)
    .map((word) =>
      word.length > 0 ? word[0].toUpperCase() + word.slice(1) : word
    )
    .join(" ");
}
