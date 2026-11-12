# Couple Home — Milestone 1 (18 Nov birthday build) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a playable `/home` page on 2monthbaby.vercel.app by 18 Nov 2026 where both partners log in, see each other live as chibi characters in a realistic-looking apartment, tap to walk, kiss/hug/high-five/comfort/wave, and chat — plus a birthday touch.

**Architecture:** The existing single-page site gains a router; `/` keeps the current love-letter page, `/home` lazy-loads the game so the landing page stays light. The game is TypeScript under `src/game/`: pure logic modules (layout, navgrid, look, protocol, poses, interactions) are unit-tested with Vitest; Babylon.js renders the scene; a `Room` interface carries real-time state, implemented by Supabase Realtime (production) and `BroadcastChannel` (two local tabs, for development and tests). React renders the HUD (action wheel, chat, bubbles) as an HTML overlay above the canvas.

**Tech Stack:** Vite 5, React 18, Tailwind 3, framer-motion (existing); add `typescript`, `vitest`, `react-router-dom@6`, `@babylonjs/core@7`, `@babylonjs/loaders@7`, `@supabase/supabase-js@2`.

**Spec:** `docs/superpowers/specs/2026-11-11-couple-home-game-design.md` (milestone row "18 Nov 2026" in §13 defines this plan's scope; mockup in `docs/superpowers/specs/assets/`).

## Global Constraints

- RM0/month: Vercel Hobby + Supabase free tier only. No paid assets, no one-off purchases. All third-party assets CC0 (Poly Haven, Kenney, Quaternius) and listed in `public/assets/CREDITS.md`.
- Art made by code: characters are procedural chibi "style A" (head ≈ body height, big dark eyes with white highlight, pink blush ovals, small curved mouth, stubby limbs).
- Room looks close to realistic (PBR materials, real textures, image-based lighting, city view). Never flat/plain.
- Primary device: iPhone Safari, portrait. Target ≥30 fps on a recent iPhone. Desktop click = tap.
- Exactly two accounts, one house. No public sign-up.
- Existing `/` page content (`src/App.jsx`, `src/index.css`) must render exactly as today.
- Time zone for all date logic: `Asia/Kuala_Lumpur`.
- Total `public/assets` ≤ 25 MB; textures ≤ 1024 px.
- Units: metres. Apartment coordinates: x ∈ [0, 13] west→east, z ∈ [0, 6.5] south→north; window wall at z = 6.5.
- Out of scope for this plan: coins, chores, shop, build mode, full 10+ creator, cuddle, baked lightmaps (use IBL + one shadow light instead; baking moves to the v1 plan).

## Review Focus

1. **Crossing taps:** both partners tap "Hug" on each other within the same second → exactly one interaction plays, the same one on both phones (tested in Task 4).
2. **Partner drops mid-interaction:** partner closes the tab during a hug → initiator returns to idle within 5 s and the partner is shown asleep in bed (tested in Task 9).
3. **Rotate vs tap on iPhone:** dragging to rotate the camera or pinching must never send a walk (tested in Task 9).
4. **Late joiner:** the second player to open the page sees the first player where they actually stand, not at a spawn point (tested in Task 6).
5. **iOS background/resume:** locking the phone and coming back resubscribes the channel and restores presence without a reload (tested in Task 13).

---

## File Structure

```
vercel.json                         SPA rewrite
tsconfig.json                       TS config (allowJs, strict)
vitest.config.ts                    test config (node env)
src/main.jsx                        MODIFY: render <Root/>
src/Root.jsx                        router: "/" → App, "/home" → lazy GamePage
src/game/types.ts                   shared types
src/game/world/layout.ts            rooms, walls, doors, furniture placements (data)
src/game/world/navgrid.ts           walkable grid + A*
src/game/character/look.ts          CharacterLook, option lists, defaults, validation
src/game/character/poses.ts         procedural pose clips (pure)
src/game/sim/interactions.ts        interaction planning + conflict resolution (pure)
src/game/sim/birthday.ts            KL-date birthday check (pure)
src/game/net/protocol.ts            NetMsg / PresenceState types + parse/validate
src/game/net/room.ts                Room interface
src/game/net/localRoom.ts           BroadcastChannel Room
src/game/net/supabaseRoom.ts        Supabase Realtime Room
src/game/net/supabase.ts            Supabase client
src/game/input/gesture.ts           tap vs drag classifier (pure)
src/game/engine/createScene.ts      engine, scene, camera, lights, IBL
src/game/engine/apartment.ts        builds rooms + loads furniture
src/game/engine/chibi.ts            builds chibi meshes from CharacterLook, applies Pose
src/game/engine/faceTexture.ts      draws face (eyes/blush/mouth) on DynamicTexture
src/game/engine/decor.ts            birthday decor
src/game/GameController.ts          glue: input → movement → net → render
src/game/GamePage.tsx               /home: auth gate, canvas, HUD
src/game/ui/LoginScreen.tsx
src/game/ui/ActionWheel.tsx
src/game/ui/ChatBar.tsx
src/game/ui/Bubbles.tsx
src/game/ui/WardrobePanel.tsx
supabase/migrations/0001_init.sql
supabase/seed.sql
docs/SETUP-couple-home.md           Jeff's one-time Supabase + Vercel steps
scripts/fetch-assets.mjs            downloads CC0 textures/HDRI/models into public/assets
tests/**/*.test.ts
```

---

### Task 1: Tooling, routing, lazy `/home`

**Files:**
- Create: `vercel.json`, `tsconfig.json`, `vitest.config.ts`, `src/Root.jsx`, `src/game/GamePage.tsx` (placeholder), `tests/smoke.test.ts`
- Modify: `src/main.jsx`, `package.json`, `.gitignore` (add `.superpowers/`, `.claude/`, `.env`)

**Interfaces:**
- Produces: `export default function GamePage(): JSX.Element` in `src/game/GamePage.tsx`; npm scripts `test` = `vitest run`, `typecheck` = `tsc --noEmit`.

- [ ] **Step 1:** `npm i react-router-dom@6 @babylonjs/core@7 @babylonjs/loaders@7 @supabase/supabase-js@2` and `npm i -D typescript vitest @types/node`.
- [ ] **Step 2:** `vercel.json` = `{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }`. `tsconfig.json`: `strict`, `allowJs`, `jsx: react-jsx`, `moduleResolution: bundler`, `noEmit`, include `src`, `tests`.
- [ ] **Step 3:** `src/Root.jsx`: `BrowserRouter` with `/` → existing `App`, `/home` → `React.lazy(() => import('./game/GamePage'))` inside `Suspense` (fallback: centered "Loading our home…"). `src/main.jsx` renders `<Root/>` in place of `<App/>`.
- [ ] **Step 4:** `tests/smoke.test.ts`: `expect(1+1).toBe(2)` so the runner is proven.
- [ ] **Step 5:** Run `npm test && npm run typecheck && npm run build`. Expected: all pass; build output shows GamePage in its own chunk, and the main chunk does not include `@babylonjs`.
- [ ] **Step 6:** `npm run dev`, open `/` and `/home`. Expected: `/` identical to production; `/home` shows placeholder.
- [ ] **Step 7:** Commit `chore: add TS, vitest, router and lazy /home route`.

### Task 2: Apartment layout data + navgrid

**Files:**
- Create: `src/game/types.ts`, `src/game/world/layout.ts`, `src/game/world/navgrid.ts`
- Test: `tests/world/navgrid.test.ts`

**Interfaces:**
- Produces (`types.ts`): `type UserId = string`; `type Vec2 = { x: number; z: number }`; `type Role = 'female' | 'male'`; `type InteractionKind = 'kiss' | 'hug' | 'highfive' | 'comfort' | 'wave'`; `type EmoteKind = 'happy' | 'shy' | 'angry' | 'crying' | 'love' | 'sleepy'`; `type Activity = 'idle' | 'walking' | 'interacting' | 'sitting' | 'sleeping'`.
- Produces (`layout.ts`): `type RoomId = 'living' | 'dining' | 'bathroom' | 'bedroom' | 'balcony'`; `ROOMS: Record<RoomId, { min: Vec2; max: Vec2; floor: 'wood' | 'tile' | 'deck' }>`; `WALLS: { a: Vec2; b: Vec2; kind: 'solid' | 'window' | 'railing' }[]`; `DOORS: { a: Vec2; b: Vec2 }[]`; `type FurnitureId = 'sofa' | 'coffeeTable' | 'tv' | 'plant' | 'kitchen' | 'diningTable' | 'diningChairA' | 'diningChairB' | 'bath' | 'toilet' | 'sink' | 'bed' | 'wardrobe' | 'balconyChairA' | 'balconyChairB'`; `FURNITURE: { id: FurnitureId; room: RoomId; pos: Vec2; rotY: number; size: Vec2; actions: ('sit' | 'sleep' | 'wardrobe')[]; usePoint?: Vec2 }[]`; `BED_SLEEP_SPOTS: [Vec2, Vec2]`; `SPAWN: Vec2`.
- Produces (`navgrid.ts`): `CELL = 0.25`; `class NavGrid { static fromLayout(): NavGrid; isWalkable(p: Vec2): boolean; findPath(from: Vec2, to: Vec2): Vec2[] | null; nearestWalkable(p: Vec2): Vec2 }`.

Room rectangles (from the approved mockup): living x0–6.8 z3–6.5 (wood); dining x6.8–13 z3–6.5 (wood, no wall between living and dining); bathroom x0–3 z0–3 (tile); bedroom x3–9.8 z0–3 (wood); balcony x9.8–13 z0–3 (deck, railing on south and east). Doors: bathroom x1.2–2.0 at z=3; bedroom x4.8–5.6 at z=3; bedroom↔balcony z1.0–2.0 at x=9.8. North wall (z=6.5) kind `window`. Furniture positions are the implementer's call within those rooms, matching the mockup arrangement.

- [ ] **Step 1: Write failing tests** in `tests/world/navgrid.test.ts`:
  - `findPath(SPAWN, centre of bedroom)` returns non-null; every point `isWalkable`; consecutive points ≤ `CELL*1.5` apart.
  - Path from living (2,5) to bathroom (1.5,1.5) passes within 0.5 m of the bathroom door centre (1.6, 3).
  - `isWalkable` is false at the centre of `sofa`, of `bed`, and at (6, 3) (a wall point outside any door).
  - `isWalkable({x:-1,z:1})` and `isWalkable({x:6,z:7})` are false (outside unit).
  - `findPath` to a point inside the bed returns a path ending at `nearestWalkable` of that point.
  - Path to balcony (11.5, 1.5) exists (through bedroom→balcony door).
- [ ] **Step 2:** `npx vitest run tests/world` → FAIL (modules missing).
- [ ] **Step 3:** Implement layout data and `NavGrid` (grid 52×26; block wall cells with 0.2 m thickness except door spans; block furniture footprints inflated by 0.15 m; 8-neighbour A* with octile heuristic, no corner-cutting; return cell centres, first point replaced by `from`).
- [ ] **Step 4:** `npx vitest run tests/world` → PASS.
- [ ] **Step 5:** Commit `feat(game): apartment layout and navgrid`.

### Task 3: Character look model

**Files:**
- Create: `src/game/character/look.ts`
- Test: `tests/character/look.test.ts`

**Interfaces:**
- Produces: `type CharacterLook = { hairStyle: HairStyle; hairColor: string; eyeShape: EyeShape; eyeColor: string; skinTone: string; body: BodyShape; top: TopStyle; topColor: string; bottom: BottomStyle; bottomColor: string; shoes: ShoeStyle; accessory: Accessory }`; `HAIR_STYLES = ['short','bob','long','ponytail','bun','pigtails'] as const`; `EYE_SHAPES = ['round','sparkle','sleepy','happy'] as const`; `BODY_SHAPES = ['petite','regular','chubby'] as const`; `TOPS = ['tee','hoodie','dress','shirt'] as const`; `BOTTOMS = ['shorts','jeans','skirt','pajama'] as const`; `SHOES = ['sneakers','slippers','boots'] as const`; `ACCESSORIES = ['none','glasses','bow','cap'] as const`; `HAIR_COLORS`, `EYE_COLORS`, `SKIN_TONES`, `CLOTH_COLORS`: each exactly 12 hex strings; `defaultLook(role: Role): CharacterLook`; `sanitizeLook(x: unknown, role: Role): CharacterLook`.

- [ ] **Step 1: Write failing tests:** each colour list has length ≥ 10 and unique `#rrggbb` entries; `defaultLook('female').hairStyle === 'long'`, `defaultLook('male').hairStyle === 'short'`; `sanitizeLook({hairStyle:'mohawk'}, 'male')` equals `defaultLook('male')` except valid fields kept; `sanitizeLook(null,'female')` equals `defaultLook('female')`; colours not in lists are replaced by defaults.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement. Male default: short black hair, `tee`/`jeans`/`sneakers`. Female default: long dark-brown hair, `dress`/`skirt`… implementer's call, cute and distinct.
- [ ] **Step 4:** Run → PASS. **Step 5:** Commit `feat(game): character look model`.

### Task 4: Protocol and interaction resolution

**Files:**
- Create: `src/game/net/protocol.ts`, `src/game/sim/interactions.ts`
- Test: `tests/net/protocol.test.ts`, `tests/sim/interactions.test.ts`

**Interfaces:**
- Produces (`protocol.ts`):
  ```ts
  type PresenceState = { userId: UserId; name: string; role: Role; look: CharacterLook; pos: Vec2; facing: number; activity: Activity; furniture?: FurnitureId }
  type NetMsg =
    | { t: 'move'; from: UserId; path: Vec2[]; at: number }
    | { t: 'interact'; id: string; from: UserId; to: UserId; kind: InteractionKind; at: number }
    | { t: 'interact-request'; id: string; from: UserId; to: UserId; kind: InteractionKind; at: number }
    | { t: 'interact-accept'; id: string; from: UserId }
    | { t: 'interact-cancel'; id: string; from: UserId }
    | { t: 'chat'; id: string; from: UserId; text: string; at: number }
    | { t: 'emote'; from: UserId; emote: EmoteKind; at: number }
    | { t: 'look'; from: UserId; look: CharacterLook }
  ```
  `parseMsg(x: unknown): NetMsg | null`; `QUICK_MESSAGES = ['Hello 👋','Byebye 👋','Kiss 😘','Miss you 🥺','Good night 🌙','Hungry 🍜','Love you ❤️']`; `MAX_CHAT = 200`; `cleanChat(s: string): string | null`.
- Produces (`interactions.ts`): `INTERACTION_DURATION: Record<InteractionKind, number>` (ms; kiss 2500, hug 3000, highfive 1500, comfort 3500, wave 1500); `type Plan = { initiatorSpot: Vec2; partnerSpot: Vec2; initiatorFacing: number; partnerFacing: number }`; `planInteraction(kind: InteractionKind, initiator: Vec2, partner: Vec2, grid: NavGrid): Plan`; `resolveCrossing(a: InteractMsg, b: InteractMsg): InteractMsg` where `InteractMsg = Extract<NetMsg, {t:'interact'}>`; `needsRequest(partnerActivity: Activity): boolean`.

- [ ] **Step 1: Write failing tests:**
  - `parseMsg` rejects unknown `t`, missing fields, non-finite coordinates, `path` longer than 400 points; accepts each valid variant.
  - `cleanChat('   ')` → null; `cleanChat('a'.repeat(250)).length === 200`; trims whitespace.
  - `planInteraction('hug', {x:2,z:5}, {x:4,z:5}, grid)`: spots are walkable, 0.55 ± 0.1 m apart for kiss/hug/comfort, 0.8 ± 0.1 for highfive, ≥ 1.2 for wave (wave: partnerSpot = partner's current position, initiator doesn't move); facings point at each other (difference ≈ π).
  - Crossing: `resolveCrossing(a,b)` returns the same winner regardless of argument order; earlier `at` wins; equal `at` → lexicographically smaller `from` wins.
  - `needsRequest('sleeping') === true`, `needsRequest('sitting') === true`, `needsRequest('idle') === false`, `needsRequest('walking') === false`.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement (meeting point = midpoint snapped via `nearestWalkable`, spots offset along the initiator→partner axis). **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat(game): net protocol and interaction planning`.

### Task 5: Procedural pose clips

**Files:**
- Create: `src/game/character/poses.ts`
- Test: `tests/character/poses.test.ts`

**Interfaces:**
- Produces: `type Pose = { rootY: number; lean: number; head: Euler; body: Euler; armL: Euler; armR: Euler; legL: Euler; legR: Euler }` with `type Euler = { x: number; y: number; z: number }` (radians, relative to rest); `type ClipName = 'idle' | 'walk' | 'sit' | 'sleep' | InteractionKind | 'receive-kiss' | 'receive-comfort' | EmoteKind`; `sampleClip(name: ClipName, tMs: number): Pose`; `CLIP_LOOPS: Record<ClipName, boolean>`; `REST_POSE: Pose`.

- [ ] **Step 1: Write failing tests:** `sampleClip('idle', t)` stays within ±0.05 of `REST_POSE` for all joints for t ∈ {0, 500, 1000}; `walk` legs swing in opposite phase (`legL.x ≈ -legR.x` at t=250); `wave` at t=750: `armR.z` raised past 2.0 rad; `hug` at t=1500: both arms `x` forward < -1.0; `highfive` at t=750: `armR` raised; `sleep`: `lean` ≈ π/2; looping clips are periodic (`sampleClip('walk',0)` ≈ `sampleClip('walk',period)`); non-looping clips at t > duration equal their final pose; every sampled value is finite.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement with keyframes + smoothstep interpolation; durations match `INTERACTION_DURATION`. **Step 4:** Run → PASS. **Step 5:** Commit `feat(game): procedural pose clips`.

### Task 6: Room transport (local + Supabase)

**Files:**
- Create: `src/game/net/room.ts`, `src/game/net/localRoom.ts`, `src/game/net/supabase.ts`, `src/game/net/supabaseRoom.ts`
- Test: `tests/net/localRoom.test.ts`

**Interfaces:**
- Consumes: `NetMsg`, `PresenceState`, `parseMsg` (Task 4).
- Produces (`room.ts`):
  ```ts
  interface Room {
    join(me: PresenceState): Promise<void>
    updatePresence(patch: Partial<PresenceState>): void   // throttled ≤ 4/s
    send(msg: NetMsg): void
    onMessage(cb: (m: NetMsg) => void): () => void
    onPresence(cb: (others: PresenceState[]) => void): () => void
    leave(): Promise<void>
  }
  ```
  `createLocalRoom(houseId: string): Room` (BroadcastChannel `house:<id>`, presence via heartbeat every 1 s, peer expires after 5 s silence); `createSupabaseRoom(client: SupabaseClient, houseId: string): Room` (channel `house:<id>`, `config.presence.key = userId`, broadcast event `msg`, `self: false`, validate with `parseMsg`); `supabase: SupabaseClient | null` from `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` (null when unset).

- [ ] **Step 1: Write failing tests** (Node's global `BroadcastChannel`): two local rooms A and B on the same house id; B joins 300 ms after A updated position to (5,5) → B's first presence callback contains A with `pos` (5,5) (late joiner); A `send(chat)` → B receives exactly once, A receives none; malformed message posted raw to the channel is ignored; after A `leave()`, B's presence list drops A within 6 s (use fake timers).
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement both rooms. Supabase room: on `SUBSCRIBED` call `track(me)`; `onPresence` flattens `presenceState()` excluding self; `updatePresence` re-`track`s merged state. **Step 4:** Run → PASS. **Step 5:** Commit `feat(game): room transport (local + supabase)`.

### Task 7: Realistic apartment scene

**Files:**
- Create: `scripts/fetch-assets.mjs`, `public/assets/CREDITS.md`, `src/game/engine/createScene.ts`, `src/game/engine/apartment.ts`

**Interfaces:**
- Consumes: `ROOMS`, `WALLS`, `DOORS`, `FURNITURE` (Task 2).
- Produces: `createScene(canvas: HTMLCanvasElement): { engine: Engine; scene: Scene; camera: ArcRotateCamera; shadows: ShadowGenerator }`; `buildApartment(scene: Scene, shadows: ShadowGenerator): Promise<{ floorMeshes: Mesh[]; furnitureMeshes: Map<FurnitureId, AbstractMesh> }>` — every floor mesh has `metadata = { kind: 'floor' }`, every furniture root `metadata = { kind: 'furniture', id }`.

- [ ] **Step 1:** `scripts/fetch-assets.mjs` downloads from Poly Haven (CC0, 1k JPG, via `https://api.polyhaven.com`) into `public/assets/`: wood floor, bathroom tile, balcony deck, plaster wall, fabric, kitchen counter textures (diffuse+normal+rough); one dusk/night city HDRI (1k `.hdr`) for environment + window view; CC0 glTF furniture for as many `FurnitureId`s as Poly Haven/Kenney provide. Write each asset's name, source URL and licence to `CREDITS.md`. Run it; commit the assets (check `du -sh public/assets` ≤ 25 MB).
- [ ] **Step 2:** `createScene`: `Engine(canvas, true, { adaptToDeviceRatio: false, stencil: true })`, `setHardwareScalingLevel(1 / Math.min(devicePixelRatio, 2))`; `ArcRotateCamera` target follows player, beta clamped 0.6–1.2, radius 4–12, pinch + drag enabled, panning disabled; environment from HDRI (`HDRCubeTexture` size 256) with `scene.environmentIntensity ≈ 0.8`; skybox from the same HDRI seen through window glass; one `DirectionalLight` (evening sun through window) with `ShadowGenerator(1024)` + `usePercentageCloserFiltering`; ACES tone mapping via `ImageProcessingConfiguration`.
- [ ] **Step 3:** `buildApartment`: floors per room (PBR, tiled textures, `metadata.kind='floor'`), walls 2.7 m high with door gaps, window wall as glass (`PBRMaterial`, alpha 0.15, reflections), railing on balcony; ceiling hidden from camera (back-face culled from above) so the camera can look down into rooms; load furniture GLBs at `FURNITURE` positions, procedural PBR boxes/rounded shapes for any missing ones. Furniture casts and receives shadows.
- [ ] **Step 4: Visual check:** temporarily mount in `GamePage`, `npm run dev`, open in Chrome at 390×844 (iPhone 14 size) and screenshot each room. Expected: real wood/tile textures, soft light, city visible through the window, no flat untextured surfaces, fps ≥ 50 on desktop (`engine.getFps()` logged).
- [ ] **Step 5:** Commit `feat(game): realistic apartment scene and CC0 assets`.

### Task 8: Chibi characters

**Files:**
- Create: `src/game/engine/chibi.ts`, `src/game/engine/faceTexture.ts`

**Interfaces:**
- Consumes: `CharacterLook` (Task 3), `Pose`, `sampleClip` (Task 5).
- Produces: `class Chibi { constructor(scene: Scene, look: CharacterLook, shadows: ShadowGenerator); root: TransformNode; setLook(look: CharacterLook): void; setPose(p: Pose): void; setExpression(e: EmoteKind | 'neutral' | 'blink'): void; setPosition(p: Vec2, facing: number): void; dispose(): void }` — all meshes have `metadata = { kind: 'character', userId }` set via `chibi.setUserId(id: UserId)`.

- [ ] **Step 1:** Build from primitives: head sphere (r 0.30) at height ≈ 0.62, body (rounded capsule, height ≈ 0.38, shaped by `body`), arms/legs short capsules pivoted at shoulders/hips (pivots are what `Pose` rotates), hair meshes per `HairStyle` (sphere caps, tubes, lathes), clothing as slightly larger shells coloured by `topColor`/`bottomColor`, shoes, accessories. Total height ≈ 1.0 m. Toon-ish soft PBR (roughness 0.6, slight sheen) so they read cute in the realistic room.
- [ ] **Step 2:** `faceTexture`: 512×512 `DynamicTexture` on the head's front: large dark eyes per `EyeShape` with white highlight and `eyeColor` iris, pink blush ovals, small curved mouth; variants per expression (happy ^^, shy blush ×2, angry brows, crying tears, love heart eyes, sleepy lines), blink every 3–5 s.
- [ ] **Step 3: Visual check:** render both default looks side by side in the living room, screenshot at 390×844; compare with card A in the mockup (big head, blush, stubby limbs). Play `walk`, `hug`, `wave`, `sleep` on them via `setPose(sampleClip(...))`; screenshot mid-clip.
- [ ] **Step 4:** Commit `feat(game): procedural chibi characters`.

### Task 9: Game controller — movement, sync, interactions

**Files:**
- Create: `src/game/input/gesture.ts`, `src/game/GameController.ts`
- Test: `tests/input/gesture.test.ts`, `tests/game/controller.test.ts`

**Interfaces:**
- Consumes: `Room` (Task 6), `NavGrid` (Task 2), `planInteraction`, `resolveCrossing`, `needsRequest`, `INTERACTION_DURATION` (Task 4), `sampleClip` (Task 5), `Chibi` (Task 8), `createScene`/`buildApartment` (Task 7).
- Produces (`gesture.ts`): `classifyGesture(down: {x:number;y:number;t:number}, up: {x:number;y:number;t:number}, maxPointers: number): 'tap' | 'drag'` — tap iff `maxPointers === 1`, moved ≤ 8 px, duration ≤ 300 ms.
- Produces (`GameController.ts`):
  ```ts
  type HudEvent =
    | { type: 'wheel-partner'; screen: {x:number;y:number} }
    | { type: 'wheel-furniture'; id: FurnitureId; screen: {x:number;y:number} }
    | { type: 'request'; id: string; from: string; kind: InteractionKind }
    | { type: 'bubble'; userId: UserId; text: string }
    | { type: 'partner-online'; online: boolean; name: string }
  class GameController {
    constructor(canvas: HTMLCanvasElement, room: Room, me: PresenceState, partnerHint: { userId: UserId; name: string; role: Role; look: CharacterLook } | null)
    start(): Promise<void>
    onHud(cb: (e: HudEvent) => void): () => void
    interact(kind: InteractionKind): void
    acceptRequest(id: string): void
    useFurniture(id: FurnitureId, action: 'sit' | 'sleep' | 'wardrobe'): void
    say(text: string): void
    emote(e: EmoteKind): void
    setMyLook(look: CharacterLook): void
    screenPosOf(userId: UserId): { x: number; y: number } | null
    dispose(): void
  }
  ```
  Core state logic is a pure reducer `step(state: SimState, event: SimEvent, now: number): SimState` exported from `GameController.ts` (or `src/game/sim/sim.ts`) so it can be tested without Babylon; the controller feeds it pointer, net and timer events and renders the result.

- [ ] **Step 1: Write failing tests:**
  - `gesture.test.ts`: (0,0,0)→(3,4,120),1 → tap; (0,0,0)→(30,0,120),1 → drag; (0,0,0)→(2,2,600),1 → drag; any with `maxPointers` 2 → drag.
  - `controller.test.ts` (reducer only): tap-floor event → my activity `walking`, a `move` msg emitted with path from `NavGrid`; partner `move` msg → partner walks the received path (position advances at 1.6 m/s); `interact` while partner `sleeping` → emits `interact-request` not `interact`; two crossing `interact` msgs → same winner state on both simulated clients; partner presence disappears during an interaction → within 5 s my activity returns to `idle` and partner rendered state is `{ activity: 'sleeping', pos: BED_SLEEP_SPOTS[i] }`; partner absent at start → partner shown sleeping.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement `gesture.ts`, the reducer, then `GameController` wiring: pointer down/up on canvas → `classifyGesture`; tap → `scene.pick` → floor: path + `move` + walk; own character: emote shortcut ignored; partner: emit `wheel-partner`; furniture: `wheel-furniture`. Walking speed 1.6 m/s, character turns to path direction, camera target lerps to player. `interact(kind)`: if `needsRequest(partner.activity)` send `interact-request`, else send `interact` and run the plan locally: both walk to spots, face, play clip (`kiss`/`receive-kiss`, `comfort`/`receive-comfort`, hug/highfive both play same), then idle. Presence: `updatePresence({pos, facing, activity, furniture})` on every state change. Female index 0 / male index 1 in `BED_SLEEP_SPOTS`.
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5: Two-tab check:** run with `?local=1` (uses `createLocalRoom`, two fake identities `?as=her` / `?as=him`) in two Chrome windows at 390×844; walk in one, see it in the other; hug; close one tab → the other shows them asleep in bed. Screenshot.
- [ ] **Step 6:** Commit `feat(game): movement, sync and couple interactions`.

### Task 10: HUD — action wheel, chat, bubbles, emotes, wardrobe

**Files:**
- Create: `src/game/ui/ActionWheel.tsx`, `src/game/ui/ChatBar.tsx`, `src/game/ui/Bubbles.tsx`, `src/game/ui/WardrobePanel.tsx`
- Modify: `src/game/GamePage.tsx`

**Interfaces:**
- Consumes: `GameController` + `HudEvent` (Task 9), `QUICK_MESSAGES`, `cleanChat` (Task 4), look option lists (Task 3).
- Produces: `ActionWheel({ at, items, onPick, onClose })` with `items: { id: string; label: string; emoji: string }[]`; `ChatBar({ onSend, onEmote })`; `Bubbles({ controller })`; `WardrobePanel({ look, role, onChange, onClose })`.

- [ ] **Step 1:** `ActionWheel`: radial menu (framer-motion spring), items on a circle radius 90 px around `at`, each button ≥ 48 px, closes on outside tap. Partner items: Kiss 😘, Hug 🤗, High five ✋, Comfort 🫂, Wave 👋. Furniture items from `FURNITURE[i].actions` (Sit 🪑, Sleep 😴, Change look 👗).
- [ ] **Step 2:** `ChatBar` pinned bottom with safe-area padding: horizontal-scroll row of `QUICK_MESSAGES` chips, text input (maxLength 200, Enter/Send), emote button opening a small grid of the 6 `EmoteKind`s. Input focus on iOS must not zoom (font-size ≥ 16 px).
- [ ] **Step 3:** `Bubbles`: per character, speech bubble positioned each frame from `controller.screenPosOf(userId)` (rAF), shows text for 5 s, newest replaces oldest; incoming `request` HudEvent shows a card "💌 {name} wants a {kind}" with Accept / Ignore (auto-dismiss 15 s). Text rendered as React text (no `innerHTML`).
- [ ] **Step 4:** `WardrobePanel`: bottom sheet, one row per category, left/right arrows cycle options, colour rows show swatches; changes apply live via `controller.setMyLook` and persist (Task 11 hook `saveLook`).
- [ ] **Step 5: Visual check** at 390×844 with two tabs: open wheel on partner, send each quick message, emote, change hair colour and see it update on the other tab. Screenshots.
- [ ] **Step 6:** Commit `feat(game): action wheel, chat, bubbles, emotes, wardrobe`.

### Task 11: Supabase accounts, profiles, chat history

**Files:**
- Create: `supabase/migrations/0001_init.sql`, `supabase/seed.sql`, `docs/SETUP-couple-home.md`, `src/game/ui/LoginScreen.tsx`, `src/game/net/profile.ts`
- Modify: `src/game/GamePage.tsx`
- Test: `tests/net/profile.test.ts`

**Interfaces:**
- Consumes: `supabase` client (Task 6), `sanitizeLook` (Task 3).
- Produces (`profile.ts`): `type Profile = { id: UserId; name: string; role: Role; houseId: string; look: CharacterLook }`; `loadMyProfile(c: SupabaseClient): Promise<Profile>`; `loadPartner(c: SupabaseClient, me: Profile): Promise<Profile | null>`; `saveLook(c: SupabaseClient, look: CharacterLook): Promise<void>` (debounced 1 s by caller); `loadRecentChat(c, houseId, limit = 50)`; `insertChat(c, houseId, text)`; `rowToProfile(row: unknown): Profile` (pure, uses `sanitizeLook`).

Schema (`0001_init.sql`): `houses(id uuid pk default gen_random_uuid(), name text not null, created_at timestamptz default now())`; `profiles(id uuid pk references auth.users on delete cascade, house_id uuid not null references houses, display_name text not null, role text not null check (role in ('female','male')), look jsonb not null default '{}'::jsonb)`; `chat_messages(id uuid pk default gen_random_uuid(), house_id uuid not null references houses, sender uuid not null references profiles, text varchar(200) not null check (length(trim(text)) > 0), created_at timestamptz default now())`. RLS on all three: select where `house_id` = caller's house (via `profiles` lookup in a `security definer` function `my_house_id()`); `profiles` update only own row and only `look`; `chat_messages` insert only with `sender = auth.uid()` and caller's house. Disable public sign-ups (documented in SETUP).

- [ ] **Step 1: Write failing test:** `rowToProfile({id:'u1', display_name:'Jeff', role:'male', house_id:'h', look:{hairStyle:'bun'}})` returns role `male`, name `Jeff`, look with `hairStyle 'bun'` and all other fields defaulted; invalid role throws.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement `profile.ts`, migration, seed (inserts the house and both profiles by email lookup from `auth.users`, emails as `:'her_email'`/`:'his_email'` placeholders documented in SETUP). **Step 4:** Run → PASS.
- [ ] **Step 5:** `LoginScreen`: email + password, cute pastel card, error message on failure; `GamePage` flow: no supabase config and no `?local=1` → setup notice; not signed in → `LoginScreen`; signed in → load profile + partner + recent chat → `GameController` with `createSupabaseRoom`. Chat messages sent via `say` are also `insertChat`'d; recent chat shown in a collapsible log above `ChatBar`.
- [ ] **Step 6:** `docs/SETUP-couple-home.md` — Jeff's one-time steps, numbered: create free Supabase project (Singapore region); run `0001_init.sql` in SQL editor; Authentication → disable sign-ups; add the two users (email + password); run `seed.sql` with both emails; copy Project URL + anon key into Vercel → Project → Settings → Environment Variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, Production + Preview) and into local `.env`; redeploy.
- [ ] **Step 7:** Commit `feat(game): supabase auth, profiles, chat history`.

### Task 12: Birthday touch

**Files:**
- Create: `src/game/sim/birthday.ts`, `src/game/engine/decor.ts`
- Test: `tests/sim/birthday.test.ts`
- Modify: `src/game/GameController.ts` (call `addBirthdayDecor` when active), `src/game/GamePage.tsx` (banner)

**Interfaces:**
- Produces: `isBirthdayKL(now: Date, month: number, day: number): boolean`; `HER_BIRTHDAY = { month: 11, day: 18 }`; `addBirthdayDecor(scene: Scene): void`.

- [ ] **Step 1: Write failing tests:** `2026-11-17T16:00:00Z` → true (00:00 18 Nov KL); `2026-11-17T15:59:59Z` → false; `2026-11-18T15:59:59Z` → true; `2026-11-18T16:00:00Z` → false.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement with `Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kuala_Lumpur' })`. **Step 4:** Run → PASS.
- [ ] **Step 5:** Decor (shown when `isBirthdayKL(now, 11, 18)` or `?bday=1`): pastel balloons over the sofa, a cake on the coffee table, banner "Happy Birthday {her display_name} 🎂" in the HUD on her first load of the day, confetti burst on first meeting. Visual check with `?bday=1`.
- [ ] **Step 6:** Commit `feat(game): birthday decorations for 18 Nov`.

### Task 13: iPhone hardening, deploy, acceptance

**Files:**
- Modify: `src/game/GameController.ts`, `src/game/net/supabaseRoom.ts`, `index.html` (no change to existing meta unless needed), `src/game/GamePage.tsx`
- Test: `tests/net/resume.test.ts`

**Interfaces:**
- Produces: `Room` implementations handle `document.visibilitychange`: on `visible` after hidden > 10 s, unsubscribe + resubscribe + re-`track`; exported helper `shouldResubscribe(hiddenAt: number, now: number): boolean`.

- [ ] **Step 1: Write failing test:** `shouldResubscribe(0, 9_999) === false`, `shouldResubscribe(0, 10_000) === true`; local room: simulate hidden 15 s then visible → peer sees presence again within 2 s.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement resume; handle WebGL context loss (`engine.onContextRestoredObservable` → rebuild materials, show "Reconnecting…" toast); pause rendering while hidden; full-screen canvas with `touch-action: none`, `100dvh`, safe-area insets; "lite graphics" toggle in a small ⚙️ menu (hardware scaling 1, shadows off) remembered in `localStorage` (try/catch). **Step 4:** Run → PASS.
- [ ] **Step 5:** `npm test && npm run typecheck && npm run build` → all pass. Push the branch; confirm the Vercel preview URL builds.
- [ ] **Step 6: Acceptance on two real iPhones** (Jeff + partner, or Jeff with two devices) on the preview URL, logged in as both accounts: (a) both see each other within 2 s of opening; (b) tap-walk across all five rooms; (c) each of Kiss, Hug, High five, Comfort, Wave plays on both screens < 1 s apart; (d) quick messages + typed chat appear as bubbles and persist after reload; (e) wardrobe change visible on the other phone; (f) lock phone 30 s, unlock → still connected; (g) close one → other sees them asleep in bed; (h) smooth (no visible stutter) in portrait. Record results in the PR.
- [ ] **Step 7:** Open draft PR `Couple Home — birthday build` to `master`; Jeff merges it before 18 Nov to put it live.
