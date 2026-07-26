# Implementation Plan: Streamlining Flow, Fixing Images & Match Ending

## Goal
Improve the game flow by allowing users to skip the auction and play with official squads, fix player image mappings and rendering (cropping, jerseys), and add a proper match-ending screen.

## Proposed Changes

### 1. Fix Player Images & Mappings (`src/data/crexImages.ts`)
*   Extract the exact names and IDs from your provided list (Rohit Sharma: 2X, etc.) to completely rebuild `PLAYER_CREX_IDS`.
*   Ensure that names in `src/data/players.ts` exactly match the keys in `PLAYER_CREX_IDS` so no players are left with fallback images.
*   Update all `<img>` tags in components to use the `object-cover object-top` CSS classes so that the full-body CREX images are perfectly cropped to show the player's head and jersey in circular avatars.

### 2. Skip Auction / Remove Pre-Auction (`src/components/LandingPage.tsx` & `src/stores/useGameStore.ts`)
*   **Remove the existing `TeamSelection` step** (the retention page).
*   Add a direct team selection modal on the **Landing Page**.
*   Provide two options when starting:
    1.  **Play with Official Squads:** Instantly assigns the real 2026 IPL squads (using the `OFFICIAL_2026_SQUADS` data) and jumps directly to the League phase.
    2.  **Mega Auction:** Goes straight to the Auction Room, skipping the old retention screen entirely.
*   *Note on Jerseys:* For players without a CREX image, I will update the fallback avatar generator from geometric shapes (Dicebear Identicon) to realistic placeholder jerseys (Dicebear Initials with team background colors), which matches the "same jersey type" aesthetic.

### 3. Improve Auction Player Card (`src/components/AuctionRoom.tsx`)
*   Even though you can skip the auction, the Auction Room player card will be visually upgraded (better typography, larger image, sleeker layout) for when you do choose to play the auction mode.

### 4. Proper Match Ending Screen (`src/components/LiveMatchCenter.tsx`)
*   When a match finishes, a new "Match Summary" modal will appear.
*   It will display the match result (e.g., "MI won by 15 runs"), top performers, and provide a clear "Return to League" button to continue the season.

## Open Questions
*   **Fallback Jerseys:** For players without a CREX image, would you like me to use an avatar with their initials and their team's primary color as the background?
*   Does this flow (Landing Page -> Choose Team -> "Play Official Squads" OR "Play Auction") accurately reflect how you want to skip the pre-auction page?
