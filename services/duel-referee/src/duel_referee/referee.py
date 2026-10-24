"""Katana Master referee, server side.

Replays both players' input logs tick by tick and returns the result that counts. It is an independent port of
apps/katana-master/src/duel.js: integer arithmetic only (HP in hundredths, Ki in tenths, positions in thousandths
of an art pixel, 10 ms ticks), so for the same log both reach the same state and the same FNV-1a hash. The shared
fixtures in apps/katana-master/test/fixtures/duels.json pin that down in CI.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from types import MappingProxyType

TICK_MS = 10
MILLI = 1000
HP = 50 * 100
HIT = (100, 125, 156, 195, 244)
COMBO_GAP_MS = 1100
WINDUP_MS, ACTIVE_MS, RECOVER_MS, REACH_PX, MIN_GAP_MS = 120, 80, 100, 46, 185
BLOCK_STUN_MS, HIT_STUN_MS, PERFECT_MS = 100, 300, 150
KI_MAX, KI_GAIN_PCT, KI_PER_DAMAGE, KI_PER_BLOCKS, KI_COMBO_AT = 100, 130, 400, 3, 2
TELE_KI, TELE_CHAIN, TELE_WINDOW_MS, TELE_REST_MS = 10, 4, 3000, 10000
ROUND_MS, TO_WIN, MAX_ROUNDS = 210000, 2, 3
ARENA_MIN, ARENA_MAX, START_GAP = 24, 680, 72
LAST_BREATH_BELOW, LAST_BREATH_MS = 200, 5000
BODY_GAP = 34 * MILLI

LEFT, RIGHT, BLOCK, ATTACK, DASH, TELEPORT = 1, 2, 4, 8, 16, 32
CARD_SHIFT = 6
EDGE_MASK = ATTACK | DASH | TELEPORT | (7 << CARD_SHIFT)
IDLE, WALK, ATTACKING, BLOCKING, HIT_ST, DASHING, KO = 0, 1, 2, 3, 4, 5, 7


def _ticks(ms: int) -> int:
    return max(1, (ms + TICK_MS // 2) // TICK_MS)


DASH_N = _ticks(150)
DASH_STEP = 57 * MILLI // DASH_N
FLIP_N = _ticks(292)
FLIP_STEP = 60 * MILLI // FLIP_N
WALK_STEP = 74 * MILLI * TICK_MS // 1000


def cut_damage(combo_hits: int) -> int:
    return HIT[max(0, min(len(HIT) - 1, combo_hits))]


def gain_ki(ki: int, bank: int, n: int = 1) -> tuple[int, int]:
    bank += n * 10 * KI_GAIN_PCT
    whole = bank // 100
    if ki + whole >= KI_MAX:
        return KI_MAX, 0
    return ki + whole, bank - whole * 100


def fnv1a(words) -> int:
    h = 0x811C9DC5
    for w in words:
        w &= 0xFFFFFFFF
        for s in (0, 8, 16, 24):
            h ^= (w >> s) & 0xFF
            h = (h * 0x01000193) & 0xFFFFFFFF
    return h


@dataclass
class Fighter:
    x: int
    face: int = 1
    hp: int = HP
    ki: int = 0
    bank: int = 0
    ki_carry: int = 0
    blocks: int = 0
    combo: int = 0
    last_hit_at: int = -10**9
    st: int = IDLE
    st_t: int = 0
    stun: int = 0
    dash_dir: int = 0
    dash_left: int = 0
    dash_step: int = 0
    atk_hit: bool = False
    last_atk_at: int = -10**9
    guard_at: int = -10**9
    tele_count: int = 0
    tele_last: int = -10**9
    tele_rest: int = 0
    undying_until: int = 0

    def gain(self, n: int = 1) -> None:
        self.ki, self.bank = gain_ki(self.ki, self.bank, n)


@dataclass
class Ledger:
    """Played cards for one player, kept for the whole match (not per round)."""
    cards: tuple[str, ...]
    used: set[int] = field(default_factory=set)

    def cast(self, slot: int, ki: int, catalog) -> int | None:
        """Ki left after casting the card in `slot`, or None when it can't be cast."""
        if slot >= len(self.cards) or self.cards[slot] == 'last-breath' or slot in self.used:
            return None
        card = catalog.get(self.cards[slot])
        cost = (card['ki'] if card else 99) * 10
        if ki < cost:
            return None
        self.used.add(slot)
        return ki - cost

    def auto_cast(self, hp: int) -> bool:
        if hp >= LAST_BREATH_BELOW:
            return False
        for k, cid in enumerate(self.cards):
            if cid == 'last-breath' and k not in self.used:
                self.used.add(k)
                return True
        return False


def replay(log, cards=((), ()), catalog=None) -> dict:
    """Replay a duel. `log` is [[tick, mask0, mask1], ...]; `catalog` maps card id -> {ki, atk, df} (whole units)."""
    catalog = MappingProxyType(dict(catalog or {}))
    ledgers = (Ledger(tuple(cards[0])), Ledger(tuple(cards[1])))
    mid = (ARENA_MIN + ARENA_MAX) // 2 * MILLI
    gap = START_GAP * MILLI // 2
    keep = [(0, 0), (0, 0)]
    wins, rounds, trail = [0, 0], [], []
    held, li, tick, round_no = [0, 0], 0, 0, 1
    max_ticks = ROUND_MS // TICK_MS * MAX_ROUNDS + 10

    def new_round():
        fs = [Fighter(mid - gap), Fighter(mid + gap)]
        for f, (ki, bank) in zip(fs, keep):
            f.ki, f.bank = ki, bank
        return fs

    def hurt(d: Fighter, i: int, dmg: int, t: int) -> None:
        hp = d.hp - dmg
        if t < d.undying_until:
            hp = max(100, hp)
        if hp < LAST_BREATH_BELOW and ledgers[i].auto_cast(hp):
            hp = max(100, hp)
            d.undying_until = t + LAST_BREATH_MS
        d.hp = max(0, hp)
        total = d.ki_carry + dmg
        d.ki_carry = total % KI_PER_DAMAGE
        for _ in range(total // KI_PER_DAMAGE):
            d.gain()

    F, round_t = new_round(), 0
    while tick < max_ticks:
        edges = [0, 0]
        while li < len(log) and log[li][0] <= tick:
            _, m0, m1 = log[li]
            li += 1
            edges = [edges[0] | (m0 & EDGE_MASK), edges[1] | (m1 & EDGE_MASK)]
            held = [m0 & ~EDGE_MASK, m1 & ~EDGE_MASK]
        t = round_t
        for i in (0, 1):
            f, o, inp = F[i], F[1 - i], held[i] | edges[i]
            f.face = 1 if o.x >= f.x else -1
            f.st_t += TICK_MS
            if f.st == KO:
                continue
            if f.st == HIT_ST:
                if f.st_t >= f.stun:
                    f.st, f.st_t = IDLE, 0
                else:
                    continue
            if f.st == DASHING:
                f.x += f.dash_dir * f.dash_step
                f.dash_left -= 1
                if f.dash_left <= 0:
                    f.st, f.st_t = IDLE, 0
                continue
            if f.st == ATTACKING:
                if not f.atk_hit and WINDUP_MS <= f.st_t < WINDUP_MS + ACTIVE_MS:
                    if abs(o.x - f.x) <= REACH_PX * MILLI and o.st != KO:
                        f.atk_hit = True
                        if o.st == BLOCKING and o.face == -f.face:
                            o.blocks += 1
                            o.st, o.st_t, o.stun = HIT_ST, 0, BLOCK_STUN_MS
                            if o.blocks % KI_PER_BLOCKS == 0:
                                o.gain()
                            if 0 <= t - o.guard_at <= PERFECT_MS:
                                o.gain()
                        else:
                            f.combo = 1 if t - f.last_hit_at > COMBO_GAP_MS else f.combo + 1
                            f.last_hit_at = t
                            if f.combo == KI_COMBO_AT:
                                f.gain()
                            hurt(o, 1 - i, cut_damage(f.combo - 1), t)
                            o.combo = 0
                            o.st, o.st_t, o.stun = (HIT_ST if o.hp > 0 else KO), 0, HIT_STUN_MS
                if f.st_t >= WINDUP_MS + ACTIVE_MS + RECOVER_MS:
                    f.st, f.st_t = IDLE, 0
                continue
            slot = (inp >> CARD_SHIFT) & 7
            if slot:
                left = ledgers[i].cast(slot - 1, f.ki, catalog)
                if left is not None:
                    c = catalog[ledgers[i].cards[slot - 1]]
                    f.ki = left
                    if c['atk']:
                        hurt(o, 1 - i, c['atk'] * 100, t)
                    if c['df']:
                        f.hp = min(HP, f.hp + c['df'] * 100)
                    if o.hp <= 0:
                        o.st = KO
                    continue
            if inp & TELEPORT and t >= f.tele_rest and f.ki >= TELE_KI:
                count = f.tele_count + 1 if t - f.tele_last <= TELE_WINDOW_MS else 1
                rest = t + TELE_REST_MS if count >= TELE_CHAIN else 0
                f.ki -= TELE_KI
                f.tele_count, f.tele_last, f.tele_rest = (0 if rest else count), t, rest
                f.x = o.x - f.face * BODY_GAP
                f.st, f.st_t = IDLE, 0
                continue
            direction = (1 if inp & RIGHT else 0) - (1 if inp & LEFT else 0)
            if inp & DASH and direction:
                back = direction != f.face
                f.st, f.st_t, f.dash_dir = DASHING, 0, direction
                f.dash_left, f.dash_step = (FLIP_N, FLIP_STEP) if back else (DASH_N, DASH_STEP)
                continue
            if inp & ATTACK and t - f.last_atk_at >= MIN_GAP_MS:
                f.st, f.st_t, f.atk_hit, f.last_atk_at = ATTACKING, 0, False, t
                continue
            if inp & BLOCK:
                if f.st != BLOCKING:
                    f.st, f.st_t, f.guard_at = BLOCKING, 0, t
                continue
            if direction:
                f.st = WALK
                f.x += direction * WALK_STEP
            elif f.st != IDLE:
                f.st, f.st_t = IDLE, 0
        for f in F:
            f.x = max(ARENA_MIN * MILLI, min(ARENA_MAX * MILLI, f.x))
        if abs(F[1].x - F[0].x) < BODY_GAP // 2:
            c = (F[0].x + F[1].x) // 2
            s = 1 if F[0].x <= F[1].x else -1
            F[0].x, F[1].x = c - s * BODY_GAP // 4, c + s * BODY_GAP // 4
        tick += 1
        round_t += TICK_MS
        ko, out = F[0].hp <= 0 or F[1].hp <= 0, round_t >= ROUND_MS
        if ko or out:
            if ko:
                winner = (None if F[1].hp <= 0 else 1) if F[0].hp <= 0 else 0
            else:
                winner = None if F[0].hp == F[1].hp else (0 if F[0].hp > F[1].hp else 1)
            if winner is not None:
                wins[winner] += 1
            rounds.append({'winner': winner, 'how': 'ko' if ko else 'time', 'ms': round_t})
            for f in F:
                trail += [round_no, round_t, f.x, f.hp, f.ki, f.combo, f.blocks]
            keep = [(F[0].ki, F[0].bank), (F[1].ki, F[1].bank)]
            if wins[0] >= TO_WIN or wins[1] >= TO_WIN or round_no >= MAX_ROUNDS:
                break
            round_no += 1
            F, round_t = new_round(), 0
    winner = 0 if wins[0] > wins[1] else 1 if wins[1] > wins[0] else None
    trail += [tick, wins[0], wins[1], *sorted(ledgers[0].used), 255, *sorted(ledgers[1].used)]
    return {'winner': winner, 'wins': wins, 'rounds': rounds, 'hash': f'{fnv1a(trail):08x}', 'ticks': tick}
