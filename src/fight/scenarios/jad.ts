import type { GameState } from "../engine/types";
import {
  JAD_HP,
  JAD_SIZE,
  JAD_ATTACK_SPEED,
  JAD_FIRST_ATTACK_DELAY,
  JAD_DEFENCE_LEVEL,
  JAD_RANGED_DEF_BONUS,
  PLAYER_MAX_PRAYER,
  GRID_W,
  GRID_H,
} from "../engine/constants";
import { DEFAULT_LOADOUT, maxHit, hitChance } from "../engine/loadout";
import type { Loadout } from "../engine/loadout";

// TzTok-Jad on a tile grid. The full fight: read the telegraph and flip the
// overhead before the hit lands, then at half HP kite the healers off Jad while
// staying OUT of his melee range (get adjacent and he adds an instant melee).
export function createJadScenario(
  loadout: Loadout = DEFAULT_LOADOUT,
  reactionTicks = 2,
  seed = 12345,
): GameState {
  // Jad centred near the top; player starts near the bottom, at safe distance.
  const jadPos = { x: Math.floor((GRID_W - JAD_SIZE) / 2), y: 1 };
  const playerPos = { x: Math.floor(GRID_W / 2), y: GRID_H - 2 };

  const playerMaxHit = maxHit(loadout);
  const playerHitChance = hitChance(loadout, {
    defenceLevel: JAD_DEFENCE_LEVEL,
    rangedDefenceBonus: JAD_RANGED_DEF_BONUS,
  });
  const playerMaxHp = loadout.hpLevel;

  return {
    tick: 0,
    seed,
    over: false,
    result: null,
    healersSpawned: false,
    log: ["Fight! Pray on Jad's wind-up. Click Jad to attack."],
    stats: { blocked: 0, mispray: 0, attacks: 0 },
    config: { magicDelay: reactionTicks, rangeDelay: reactionTicks },
    player: {
      hp: playerMaxHp,
      maxHp: playerMaxHp,
      prayer: PLAYER_MAX_PRAYER,
      maxPrayer: PLAYER_MAX_PRAYER,
      overhead: "none",
      pos: { ...playerPos },
      prevPos: { ...playerPos },
      attackSpeed: loadout.attackSpeedTicks,
      attackCd: loadout.attackSpeedTicks,
      maxHit: playerMaxHit,
      hitChance: playerHitChance,
      targetId: 1, // auto-attacking Jad from the start
      moveTarget: null,
      running: true,
      alive: true,
    },
    npcs: [
      {
        id: 1,
        kind: "jad",
        hp: JAD_HP,
        maxHp: JAD_HP,
        pos: { ...jadPos },
        prevPos: { ...jadPos },
        size: JAD_SIZE,
        attackSpeed: JAD_ATTACK_SPEED,
        attackCd: JAD_FIRST_ATTACK_DELAY,
        windup: null,
        target: null,
        aggro: false,
      },
    ],
    projectiles: [],
  };
}
