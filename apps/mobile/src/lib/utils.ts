type ClassValue = string | undefined | null | false | ClassValue[];

/**
 * Minimal className joiner for NativeWind. Unlike the web version we avoid
 * pulling in `tailwind-merge`/`clsx` into the mobile bundle; Tailwind classes
 * on React Native are small enough that simple string joining is sufficient.
 */
export function cn(...inputs: ClassValue[]): string {
  const result: string[] = [];

  for (const input of inputs) {
    if (!input) continue;

    if (typeof input === "string") {
      result.push(input);
    } else if (Array.isArray(input)) {
      result.push(cn(...input));
    }
  }

  return result.join(" ");
}
