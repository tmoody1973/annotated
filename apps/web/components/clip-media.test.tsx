import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ClipMedia } from "./clip-media";

describe("ClipMedia", () => {
  it("renders a video player when ready", () => {
    const { container } = render(
      <ClipMedia mediaState="ready" clipUrl="https://example.com/c.mp4" sourceType="youtube" />
    );
    expect(container.querySelector("video")).not.toBeNull();
  });

  it("renders an audio player for podcasts", () => {
    const { container } = render(
      <ClipMedia mediaState="ready" clipUrl="https://example.com/c.mp3" sourceType="podcast" />
    );
    expect(container.querySelector("audio")).not.toBeNull();
  });

  it("shows a processing notice and no player while slicing", () => {
    const { container } = render(
      <ClipMedia mediaState="processing" clipUrl={null} sourceType="youtube" />
    );
    expect(screen.getByText(/clip processing/i)).toBeTruthy();
    expect(container.querySelector("video")).toBeNull();
  });

  it("shows a failure notice and no player when the slice failed", () => {
    const { container } = render(
      <ClipMedia mediaState="failed" clipUrl={null} sourceType="youtube" />
    );
    expect(screen.getByText(/couldn't be made/i)).toBeTruthy();
    expect(container.querySelector("video")).toBeNull();
  });

  it("treats an absent mediaState with a clipUrl as ready (pre-migration rows)", () => {
    const { container } = render(
      <ClipMedia mediaState={undefined} clipUrl="https://example.com/c.mp4" sourceType="youtube" />
    );
    expect(container.querySelector("video")).not.toBeNull();
  });

  it("renders nothing for an article, which has no clip", () => {
    const { container } = render(
      <ClipMedia mediaState={undefined} clipUrl={null} sourceType="article" />
    );
    expect(container.firstChild).toBeNull();
  });
});
