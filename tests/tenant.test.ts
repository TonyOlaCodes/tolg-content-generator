import { describe, expect, it } from "vitest";
import { slugify } from "@/lib/utils";

describe("slugify", () => {
  it("lowercases and hyphenates", () => {
    expect(slugify("CleanCar Mobile Detailing")).toBe("cleancar-mobile-detailing");
  });

  it("strips leading and trailing hyphens", () => {
    expect(slugify("  --Hello World--  ")).toBe("hello-world");
  });

  it("truncates to 48 characters", () => {
    const long = "a".repeat(60);
    expect(slugify(long).length).toBe(48);
  });

  it("collapses non-alphanumeric runs", () => {
    expect(slugify("Foo!!!Bar@@@Baz")).toBe("foo-bar-baz");
  });
});
