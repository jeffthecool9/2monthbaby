export type UserId = string
export type Vec2 = { x: number; z: number }
export type Role = 'female' | 'male'
export type InteractionKind = 'kiss' | 'hug' | 'highfive' | 'comfort' | 'wave'
/** Everything on the action wheel: couple interactions plus solo moves. */
export type ActionKind = InteractionKind | 'dance'
/** Clips one character can play alone (seen by the partner too). */
export type SoloClip = 'blow-kiss' | 'hug' | 'highfive' | 'comfort' | 'wave' | 'dance'
export type EmoteKind = 'happy' | 'shy' | 'angry' | 'crying' | 'love' | 'sleepy'
export type Activity = 'idle' | 'walking' | 'interacting' | 'sitting' | 'sleeping'
