import { render, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const useQueryMock = vi.fn();
vi.mock("convex/react", () => ({
  useQuery: (...args: unknown[]) => useQueryMock(...args),
}));
vi.mock("@annotated/backend/convex/_generated/api", () => ({
  api: { annotations: { getById: "annotations:getById" } },
}));

import { ClipMediaLive } from "./clip-media-live";

describe("ClipMediaLive", () => {
  it("skips the live subscription when the initial fetch already came back ready", () => {
    useQueryMock.mockReturnValue(undefined);
    render(
      <ClipMediaLive
        annotationId="ann1"
        mediaState="ready"
        clipUrl="https://example.com/c.mp4"
        sourceType="youtube"
      />
    );
    expect(useQueryMock).toHaveBeenCalledWith(expect.anything(), "skip");
  });

  it("shows the processing notice while a processing clip's live query hasn't resolved yet", () => {
    useQueryMock.mockReturnValue(undefined);
    const { container } = render(
      <ClipMediaLive
        annotationId="ann1"
        mediaState="processing"
        clipUrl={null}
        sourceType="youtube"
      />
    );
    expect(within(container).getByText(/clip processing/i)).toBeTruthy();
    expect(container.querySelector("video")).toBeNull();
  });

  it("renders the player once the live subscription reports the clip is ready", () => {
    useQueryMock.mockReturnValue({
      mediaState: "ready",
      clipUrl: "https://example.com/c.mp4",
    });
    const { container } = render(
      <ClipMediaLive
        annotationId="ann1"
        mediaState="processing"
        clipUrl={null}
        sourceType="youtube"
      />
    );
    expect(container.querySelector("video")).not.toBeNull();
    expect(within(container).queryByText(/clip processing/i)).toBeNull();
  });
});
