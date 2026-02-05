export function to_lower_snake_case(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .toLowerCase();
}

export function to_title_case(input: string): string {
  return input
    .toLowerCase()
    .split(/\s+/)
    .map((word) => word.length > 0 ? word[0].toUpperCase() + word.slice(1) : word)
    .join(" ");
}
