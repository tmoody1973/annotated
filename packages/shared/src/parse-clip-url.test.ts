import { describe, expect, test } from "vitest";
import { parseAnnotatedClipUrl } from "./parse-clip-url";

const ID = "j57akk9v0mrjhtaeqb2vhcm83n87v06v";

describe("parseAnnotatedClipUrl", () => {
  test("reads the id out of a canonical clip link", () => {
    expect(
      parseAnnotatedClipUrl(`https://annotated.sh/a/all-in-e58-${ID}`),
    ).toBe(ID);
  });

  test("reads a bare id link", () => {
    expect(parseAnnotatedClipUrl(`https://annotated.sh/a/${ID}`)).toBe(ID);
  });

  // Host is deliberately not checked: the same paste has to work from a preview
  // deploy or localhost, and the server validates the id it is handed anyway.
  test("works from any host", () => {
    expect(parseAnnotatedClipUrl(`http://localhost:3000/a/x-${ID}`)).toBe(ID);
  });

  test("ignores query strings and fragments", () => {
    expect(parseAnnotatedClipUrl(`https://annotated.sh/a/x-${ID}?utm=1#t=30`)).toBe(ID);
  });

  test("returns null for a link that is not a clip page", () => {
    expect(parseAnnotatedClipUrl("https://annotated.sh/u/tarik-moody")).toBeNull();
    expect(parseAnnotatedClipUrl("https://annotated.sh/")).toBeNull();
    expect(parseAnnotatedClipUrl("https://npr.org/story")).toBeNull();
  });

  test("returns null for anything unparseable", () => {
    expect(parseAnnotatedClipUrl("")).toBeNull();
    expect(parseAnnotatedClipUrl("not a url")).toBeNull();
  });

  // A thread page is a different surface and its id is a thread, not a clip.
  test("returns null for a thread link", () => {
    expect(parseAnnotatedClipUrl(`https://annotated.sh/t/x-${ID}`)).toBeNull();
  });
});
