# Couple Home — design

A small, private, real-time 3D home for Jeff and his girlfriend, living inside the existing `2monthbaby` site (https://2monthbaby.vercel.app, repo `jeffthecool9/2monthbaby`). **(Jeff)** Sims-like daily life, cuter.

Labels: **(Jeff)** = decided by Jeff in conversation. **(call)** = designer's call, open to change. Everything unlabelled follows directly from the above.

## 1. Intent

- They log in, meet in their apartment, hug and make small talk, then drift off to their own "me time". The game is a reason to show up every day and a warm place to say hi, not a deep game. **(Jeff)**
- It must be **online and real-time**: when one taps "hug", the other sees it on their own phone, in a different place, within about a second. **(Jeff)**
- Long-term they want to build something together: home first, later a shared business (café, restaurant). **The business is not in v1**, but the data model must not block it. **(Jeff)**

**Success looks like:** both of them open it most days without being reminded; the hug/kiss moment feels instant and cute on a phone; coins feel worth earning because there are nice things to buy.

## 2. Goals / non-goals / anti-goals

**Goals (v1)**
- Shared 3D high-rise apartment with real-time presence of both characters.
- Chibi character creator, 10+ options per category.
- Tap-to-walk movement + action wheels (on partner, on furniture).
- Couple interactions with paired animations: kiss, hug, high five, comfort, cuddle, wave, etc.
- Chat: free text + quick messages + emotes.
- Per-person coin wallet, daily cap RM1000, reset 00:00 Malaysia time.
- Chore missions with real-time cooldowns.
- Furniture shop + place/move/rotate furniture.
- Mobile-first, works in a phone browser.
- **RM0/month to run.** **(Jeff)**

**Non-goals (v1)**
- Café/restaurant business mode (later). **(Jeff)**
- Other couples, sign-up, visiting, friends. Exactly two accounts. **(Jeff)**
- Real money of any kind. Coins are in-game only; "RM" is just the label. **(Jeff)**
- Characters made from real photos. **(Jeff)**
- Native app / app store.

**Anti-goals (failure even if it "works")**
- Laggy or delayed interactions, so the hug arrives seconds later.
- Plain/flat/wireframe-looking rooms. The apartment must look close to real; Jeff explicitly rejected the flat-plan look. **(Jeff)**
- Characters that are not cute. **(Jeff: style A)**
- Anything that needs a paid plan to keep running. **(Jeff)**
- Stuttering or unplayable on a normal phone.

## 3. Look and feel

- **Environment: close to realistic.** Real-looking 3D materials (wood, fabric, tile, glass), good lighting, a city skyline visible through the floor-to-ceiling windows. Think a Sims home, not a toy diorama. **(Jeff)**
- **Characters: cartoon, chibi "style A".** Big head, small body, big glossy eyes, blush cheeks, expressive. **(Jeff)** Reference: card A in `assets/2026-11-11-layout-and-style-mockup.html`. Head roughly as wide as the body is tall (about 1:1 head-to-body height), round face, large dark eyes with a white highlight, pink blush ovals, small curved mouth, stubby limbs. Rejected: B (normal-proportion vinyl toy), C (limbless mochi blob).
- The mix (realistic room + chibi people) is intentional.
- UI: soft, rounded, cute (pinks/pastels to match the existing site). **(call)**

## 4. The home

High-rise condo unit; layout approved as mocked up in `assets/2026-11-11-layout-and-style-mockup.html` (top section; open it in a browser). The mockup is a flat floor plan for arrangement only; the in-game look is realistic (§3). **(Jeff)** Arrangement: living room (top-left) and dining/kitchen (top-right) form one open space along the window wall; bathroom (bottom-left), bedroom (bottom-middle) and balcony (bottom-right, opening off the bedroom) sit below. Rough proportions: unit about 2:1 wide to deep, ~85 m² is a sensible scale. **(call)**
- **Living room**: sofa (cuddle spot), coffee table, TV, plant, window wall with city view.
- **Dining + kitchen**: counter, stove, fridge, sink, table for two.
- **Bathroom**: bath/shower, toilet, sink.
- **Bedroom**: double bed, wardrobe (character customisation happens here).
- **Balcony** off the bedroom: two chairs, night view.

Single floor, one bedroom. **(call, per approved mockup)**

## 5. Characters

- Two players, each with one character. Built in a character creator; editable any time at the wardrobe. **(Jeff: creator; call: wardrobe)**
- Categories, each **≥10 options**: hairstyle, hair colour, eye shape, eye colour, eyebrows, mouth/expression, skin tone, body shape, top, bottom, shoes, accessories. **(Jeff: ≥10 per category, list is call)**
- A base set is free; extra clothing/accessories cost coins. **(call)**
- **Who makes the art: Claude Code, no purchases.** No paid models, packs or artists, even one-off. **(Jeff)**
- **Build approach (call):** characters are **generated in code**. Chibi proportions suit this: a parametric body made of smooth primitives (capsules, spheres, lathe and extruded shapes) in Babylon.js, and/or Blender run headless with Python scripts that export GLB parts. One shared skeleton; swappable part meshes for hair, clothing, shoes and accessories; colours (hair, eyes, skin, clothes) as material tints. Each shape option is a parameter set or script, so 10+ per category is reachable without hand-modelling. Faces (eyes, brows, mouth, blush) are drawn textures or decals, so expressions can swap. Animations: free Mixamo-style clips retargeted to the shared skeleton, or keyframed in code. If quality lags, ship fewer shape options first; colour categories get 10+ from day one.
- When a player is offline their character is shown asleep in bed. **(call)**

## 6. Controls (mobile-first)

- **Tap the floor** → character walks there (pathfinding around furniture). **(Jeff)**
- **Action wheel**: a radial pop-up menu is the main way to choose actions. **(Jeff)**
  - Tap **partner** → wheel of interactions (§7).
  - Tap **furniture** → wheel of what that object does (Sit, Nap, Cook, Sleep, Change outfit, Move…).
- Camera: drag to rotate, pinch (or mouse wheel on desktop) to zoom. Third-person, follows own character. **(call)**
- Portrait orientation primary; landscape should still work. Big touch targets. **(call)**
- Desktop works too (click = tap). **(call)**

## 7. Interactions between the two

- Interaction list (wheel on partner): **Kiss, Hug, High five, Comfort, Cuddle, Wave**, plus more over time (e.g. pat head, hold hands, dance). **(Jeff: kiss/hug/high five "and so on"; extras are call)**
- Both characters walk together and play a **paired animation**; both screens see it in real time.
- If the partner is mid-action, they get a small pop-up "💌 wants a hug" to accept or ignore; accepting plays it. If partner is offline, interactions are disabled. **(call)**
- **Emotes** (single character, no partner needed): happy, shy, angry, crying, love, sleepy… from a separate small emote button. **(call)**

## 8. Chat

- Free-text chat box. **(Jeff)**
- Quick messages: **Hello, Byebye, Kiss 😘**, plus Miss you, Good night, Hungry, Love you. **(Jeff: first three; rest call)**
- Messages show as a speech bubble above the sender's head (a few seconds) and in a small scrollable chat log. Chat history is saved. **(call)**

## 9. Economy

- Currency displayed as **RM**, in-game only. **(Jeff)**
- **Separate wallets.** No work, no money. **(Jeff)**
- **Daily earning cap RM1000 per person**, resets **00:00 Asia/Kuala_Lumpur**. **(Jeff)** The cap applies to earnings only; spending is unlimited. **(call)** Day boundary computed **server-side**, not from the phone clock. **(call)**
- **Affection earnings (Jeff):**
  - Female character: **+RM1** per kiss or hug she gives.
  - Male character: **+RM1** per comfort he gives.
  - **No cooldown** on interactions. **(Jeff: "except for interaction")** The daily cap is the only limit.
  - An earning interaction only pays when the partner is online and the paired animation **completes** (~3 s); a new one can't start until the current one finishes. This naturally limits the pace without a cooldown, and the server RPC checks partner presence. **(call)**
  - Earning rule is tied to the character's role (female/male) as set on the account. **(call)** Other interactions (high five, cuddle, wave) earn nothing. **(call)**
- **Chores** (solo, no partner needed), each with its **own real-time cooldown per player** **(Jeff)**; the object shows a countdown. Starting values **(call)**:

  | Chore | Where | Reward | Cooldown |
  |---|---|---|---|
  | Cook a meal | Stove | RM30 | 5 min **(Jeff example)** |
  | Wash the dishes | Sink | RM15 | 5 min |
  | Clean the toilet | Bathroom | RM25 | 10 min |
  | Do laundry | Bathroom/balcony | RM20 | 10 min |
  | Water the plants | Balcony / plant | RM10 | 5 min |
  | Make the bed | Bed | RM10 | 10 min |
  | Daily login bonus | auto | RM50 | once per day |

  A chore plays a 10 s – 2 min animation, then pays. Leaving mid-chore cancels it without payment. **(call)** Values live in one config so they can be tuned.
- **Spending:** furniture and extra clothing/accessories.

## 10. Furniture / build mode

- Shop with realistic furniture across the rooms. **(Jeff: can put furniture)**
- Buy from your own wallet; bought furniture belongs to the **shared house**, so either partner can move, rotate or store it. **(call)**
- Build mode: pick item → place on floor grid → rotate → confirm. Changes sync live to the partner. **(call)**
- The house starts furnished with the basic layout above so it's cosy from day one. **(call)**

## 11. Tech (all free tier)

| Concern | Choice |
|---|---|
| Site/hosting | Existing `2monthbaby` repo (Vite + React 18 + Tailwind + framer-motion, currently a single page in `src/App.jsx` with no router), deployed on **Vercel Hobby**. Add `react-router-dom` and a `vercel.json` SPA rewrite; existing page stays at `/`, game at a new route, e.g. `/home`. Existing page content untouched. **(call: route)** |
| 3D engine | **Babylon.js** (from Jeff's chosen stack). |
| Language | Game code in **TypeScript** under `src/game/`, per chosen stack; existing pages stay JS. **(call)** |
| Accounts | **Supabase Auth**, two accounts only (email/password or magic link). No public sign-up. |
| Real-time | **Supabase Realtime**: Presence (who's online), Broadcast (positions, actions, chat bubbles). **Colyseus dropped** since it needs a paid server. **(Jeff: free; call: Supabase-only)** |
| Saved data | **Supabase Postgres**: characters, wallets, daily earnings, chore cooldowns, owned items, furniture placement, chat log. |
| Anti-cheat-lite | Coin awards and cooldown checks go through Postgres functions (RPC) that apply the cap and the KL-time day boundary server-side. Not hardened security, just enough that the phone clock can't be gamed. |
| Assets | Free/CC0 or free-licence: Poly Haven (realistic furniture, HDRI/skyline), Kenney, Quaternius, Sketchfab free-licence. Characters built in **Blender** (free). Credit CC-BY assets on an About screen. |
| Keep-alive | Supabase free projects pause after ~7 days idle; add a free scheduled ping (GitHub Actions cron or Vercel cron) as backup. |

**Target devices: both players use iPhones** **(Jeff)**, so iOS Safari/WebKit WebGL is the primary platform and its memory limits are the main constraint. Test on iPhone Safari every phase; also support "Add to Home Screen" full-screen. Android and desktop are secondary. **(call)**

**Mobile performance (call):** bake lighting into textures/lightmaps, compress textures (KTX2), GLB models with Draco/meshopt, cap pixel ratio, single room loaded as one scene, and a "lite graphics" toggle for older phones. Target 30+ fps on a mid-range phone.

**Data model must allow later:** more than one house; more than two members per house; a "business" entity owned by a house. **(Jeff: later; call: how)**

## 12. Left to the builder

- Exact schema, RPC design, sync rate/interpolation for movement.
- Exact animation set and sourcing (Mixamo-style free animations retargeted onto the chibi rig, or hand-made).
- Which free furniture models, final prices, shop categories.
- Login screen design and how the two accounts are created (manually in Supabase dashboard is fine).
- Detailed phasing within the milestones below.

## 13. Milestones

Dates from Jeff: her birthday 18 Nov, Jeff's birthday 15 Feb, first date 11 Apr 2026. Mapping releases to them is a **(call)**. Each milestone ships as a working, deployed release on Vercel with the two real accounts.

| Date | Release | Contents |
|---|---|---|
| **18 Nov 2026** (her birthday, 7 days out) | **Early playable gift** | Login for both; realistic-looking apartment (baked lighting, furnished); both characters in chibi style A with a starter look (limited options OK); tap-to-walk; real-time presence; action wheel on partner with Kiss, Hug, High five, Comfort, Wave; chat with quick messages and bubbles; a small birthday touch in the room. No economy, shop or full creator yet. |
| **14–15 Feb 2027** (Valentine's + Jeff's birthday) | **v1 complete** | Everything in §2 Goals: full character creator (10+ per category), economy and cap, chores with cooldowns, furniture shop and build mode, emotes, chat log, iPhone performance polish. |
| **11 Apr 2027** (first anniversary) | **Later, optional** | First step of the shared business (café). Separate design. |

For 18 Nov the room realism and the hug moment are the priority; options and breadth can be thin.
