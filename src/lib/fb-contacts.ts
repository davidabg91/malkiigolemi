/** "  Fani   Chaikova " and "fani chaikova" are the same Facebook person. */
export const fbContactKey = (name: string) => name.trim().toLowerCase().replace(/\s+/g, " ");
