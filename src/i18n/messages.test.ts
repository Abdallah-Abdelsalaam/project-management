import { describe, expect, it } from "vitest";
import ar from "../../messages/ar.json";
import en from "../../messages/en.json";

/**
 * The two message files must stay the same shape.
 *
 * "No hard-coded UI text" only holds if every string exists in both locales.
 * A missing Arabic key renders the key name to the product's primary audience,
 * and next-intl does not fail the build over it — so this test does.
 *
 * It also checks the placeholders, because `{minutes}` translated as `{minute}`
 * is a runtime error in the one locale nobody on the team reads first.
 */

type Messages = Record<string, unknown>;

function flatten(messages: Messages, prefix = ""): Map<string, string> {
  const flat = new Map<string, string>();
  for (const [key, value] of Object.entries(messages)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object") {
      for (const [nested, nestedValue] of flatten(value as Messages, path)) {
        flat.set(nested, nestedValue);
      }
    } else {
      flat.set(path, String(value));
    }
  }
  return flat;
}

/**
 * The ICU **arguments** of a message — `{count}`, `{count, plural, …}` — and
 * not the category labels inside a plural body.
 *
 * Scanned with a depth counter rather than matched with a regex, because the
 * two locales legitimately use different categories: Arabic needs `zero`,
 * `two`, `few` and `many`, English needs none of them. Counting those as
 * placeholders would make correct Arabic pluralisation fail this test, which
 * is the opposite of what it is for.
 */
function placeholders(message: string): string[] {
  const names: string[] = [];
  let depth = 0;

  for (let index = 0; index < message.length; index += 1) {
    const char = message[index];

    if (char === "}") {
      depth = Math.max(0, depth - 1);
      continue;
    }
    if (char !== "{") continue;

    depth += 1;
    // Only a top-level brace opens an argument; a nested one opens the body
    // of a plural category.
    if (depth !== 1) continue;

    const name = /^\s*(\w+)\s*[},]/.exec(message.slice(index + 1))?.[1];
    if (name) names.push(name);
  }

  return names.sort();
}

const arabic = flatten(ar);
const english = flatten(en);

describe("message files", () => {
  it("has at least the auth namespace this session added", () => {
    expect(arabic.has("auth.login.title")).toBe(true);
    expect(arabic.has("auth.code.title")).toBe(true);
    expect(arabic.has("auth.forgot.title")).toBe(true);
    expect(arabic.has("auth.reset.title")).toBe(true);
  });

  it("defines every Arabic key in English", () => {
    const missing = [...arabic.keys()].filter((key) => !english.has(key));
    expect(missing).toEqual([]);
  });

  it("defines every English key in Arabic", () => {
    const missing = [...english.keys()].filter((key) => !arabic.has(key));
    expect(missing).toEqual([]);
  });

  it("uses the same placeholders in both locales", () => {
    const mismatched = [...arabic.entries()]
      .filter(([key, value]) => {
        const other = english.get(key);
        if (other === undefined) return false;
        return placeholders(value).join(",") !== placeholders(other).join(",");
      })
      .map(([key]) => key);

    expect(mismatched).toEqual([]);
  });

  it("has no empty strings", () => {
    const empty = [...arabic.entries(), ...english.entries()]
      .filter(([, value]) => value.trim().length === 0)
      .map(([key]) => key);

    expect(empty).toEqual([]);
  });
});
