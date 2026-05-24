/** Message contract between the sidepanel and the YouTube content script. */

export const GET_PLAYER_TIME = "GET_PLAYER_TIME" as const;

export interface GetPlayerTimeRequest {
  type: typeof GET_PLAYER_TIME;
}

export interface GetPlayerTimeResponse {
  /** Current playback position in ms, or null if no player was found. */
  currentTimeMs: number | null;
}
