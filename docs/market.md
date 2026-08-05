# The Market tab

The source files under `src/market/` carry no comments. Everything that explains them is here.

## What it is for

Two views over the same data, switched by a toggle at the top of the tab and remembered between
sessions.

**Basic** is the highlight. It fills your Grand Exchange offer slots with a spend plan for the gp
you actually have, and it is the only thing on screen. It answers "what do I buy right now" without
you reading a table.

**Advanced** is the full instrument panel: every item, every column, every filter. It exists so
that nobody has to leave for a competitor site, not because anyone needs it to make a decision.

## Why it is shaped this way

The competitor is GE Scout. It is a good tool and it is much bigger than this tab. It cannot,
however, do two things, and both of them are structural rather than a matter of effort.

It applies `min(floor(sell * 0.02), 5m)` to every item with no exemption list, so it understates
profit by 2% on every tax exempt item. Teleport tablets are exempt, and it has a whole tab
dedicated to them.

It also has no concept of how much gp you have or how many offer slots you own. Every figure it
prints is per item or profit times buy limit, which is the right answer for a player with an
infinite bank and infinite slots and the wrong answer for everybody else.

So this tab is capital aware and slot aware from the ground up, and it is arithmetically correct on
tax. Those are the two places where being small is an advantage rather than a compromise.

## Prices and what the two sides mean

Data comes from the wiki real time prices API at `prices.runescape.wiki/api/v2/osrs`. It is free,
needs no key, and sends `Access-Control-Allow-Origin: *`, so the browser calls it directly and this
stays a static local page with no server and no proxy.

The naming in that API trips people up, so it is written down once here and the code follows it
everywhere.

- `high` is the most recent price somebody paid to buy an item **immediately**. It is the ask.
- `low` is the most recent price somebody accepted to sell an item **immediately**. It is the bid.

To flip you do the opposite of both. You place a buy offer at `low` and wait for somebody who wants
out to sell into it. You place a sell offer at `high` and wait for somebody impatient to buy it.

That is why `buy` in this code is `latest.low` and `sell` is `latest.high`, which reads backwards
until you know the convention.

The same inversion applies to volume. `lowPriceVolume` counts units that were sold immediately, so
it is the flow that fills **your buy offer**. `highPriceVolume` counts units bought immediately, so
it is the flow that fills **your sell offer**.

## Endpoints

| Endpoint | What it gives | Cached for |
| --- | --- | --- |
| `/mapping` | Names, buy limits, members flag, alch values | 24 hours |
| `/latest` | Current bid and ask with timestamps | Not cached, refetched every 60s |
| `/1h` | Units traded on each side in the last hour | Not cached, refetched every 60s |
| `/24h` | Average bid and ask over a day, used for the fake spread gate | 30 minutes |
| `/volumes` | True daily volume per item | 2 hours |
| `/timeseries` | Price history for charts and the 7 day average | 5 minutes, per item |

Caches live in localStorage under `osrs-companion:market:cache:*`. The TTLs match how fast each
thing actually moves. Item names and buy limits change a few times a year, so refetching them every
minute is pure waste.

### The v2 timeseries parameters are not the v1 ones

v1 took `?timestep=5m&id=X`. **v2 takes `?id=X&timestep=5m&lookback=Y`**, and `lookback` accepts
only these six values:

```
6h   24h   7d   30d   6m   1y
```

Everything else returns HTTP 400, including the obvious guesses `1d`, `1w`, `1m`, `3m`, `90d`,
`5y`, `all` and `max`. All six were probed against the live API on 2026-08-04. There is no longer
range available, so charts stop at one year.

v2 `/timeseries` also rejects requests that do not send a descriptive User-Agent. A real browser
passes this and a bare `curl` does not, which means charts work in the app but any command line
check of that endpoint needs a browser User-Agent set explicitly. The other five endpoints do not
enforce it.

## Tax

**The tax is 2%, not 1%.** It changed on 29 May 2025 in the Yama CAs update. Plenty of third party
flip sites still use 1%, which overstates every margin and overstates it worst on expensive items.

- 2% of the sale price, **rounded down**. Anything under 50 gp is therefore untaxed by arithmetic
  rather than by rule.
- Capped at 5,000,000 gp, which is reached exactly at a 250m sale price.
- 48 items are exempt, listed in `EXEMPT_IDS` in `src/lib/market/tax.ts`.

The exempt list is mostly cheap early game things where the tax would round away to nothing anyway,
which makes it easy to dismiss as decoration. It is not. **Old school bond (13190) is on it and is
worth millions.** So are all the teleport tablets, which is the single most common item to flip in
that list. Dropping the exemption check would make this tab wrong in exactly the way its competitor
is wrong.

## The rate model

Ranking by margin is the naive move and it is wrong, because a margin is a quantity of gp and what
you actually want is gp per hour.

### How fast an item can be round tripped

A flip needs both legs to fill. From `/1h`, `lowPriceVolume` fills your buy and `highPriceVolume`
fills your sell, and you can only be doing one at a time:

```
effectiveFlow = 1 / (1 / buyFlow + 1 / sellFlow)
```

That is the harmonic combination, in units per hour. Two sides at 100 an hour each gives 50 an
hour round tripped, not 100, because half your time goes on each leg.

**This is optimistic and is presented as such.** It assumes you capture the entire flow, and in
reality you compete with everyone else running the same numbers. Treat it as an order of magnitude,
which is why the UI says "about 40 min" rather than a precise figure.

### How much to buy

Here is the thing that is easy to get wrong, and the first version of this code did get it wrong.

For an item bound by flow, buying **more** units does not raise your hourly rate. Doubling the
quantity doubles the profit per round and doubles the time the round takes, so the rate is
unchanged. All the extra quantity does is tie up gp that another slot could have used.

So quantity is not "as much as you can afford". It is "as much as will actually finish before you
next look at the Grand Exchange". That interval is a setting, `checkInHours`, defaulting to one
hour:

```
qty = min(limit, floor(effectiveFlow * checkInHours), floor(capital / buy))
```

A shorter interval ties up less gp for the same rate, at the cost of coming back more often. That
trade is the user's to make, so it is exposed in the top bar rather than baked in.

### The rate

Two ceilings, and the lower one wins.

```
rateFromWindow = net * qty / checkInHours
rateFromLimit  = net * limit / 4
profitPerHour  = min(rateFromWindow, rateFromLimit)
```

The second is the one competitors miss. Every item has a buy limit that refreshes on a rolling four
hour window, so no matter how liquid it is you cannot buy more than `limit` of it per four hours.
GE Scout prints a `Profit x Limit` column but never divides it by the four hours it takes to earn,
so it ranks a slow item with 2m of limit profit above a fast one with 800k you can run twice as
often.

Each sized position records which of the three constraints actually bound it, `limit`, `flow` or
`capital`, and both views say so in plain words. Knowing that a pick is held back by your bank
rather than by the market is actionable in a way that a number is not.

## Gates

Candidates pass or fail **named gates**. There is deliberately no combined confidence score.

A score built by weighting five heuristics and summing them to 100 looks authoritative and cannot
be checked by anybody, including the person who wrote the weights. A named gate can be checked, and
when an item is missing from your results you get told which gate removed it.

| Gate | Rule | Why |
| --- | --- | --- |
| `no-price` | Either side missing from `/latest` | Nothing to compute |
| `no-limit` | Buy limit is zero or absent | Cannot size a position |
| `no-margin` | `net <= 0` after tax | Not a flip |
| `stale` | Older of the two timestamps exceeds the age limit | A fresh bid against a six hour old ask describes a spread that no longer exists |
| `illiquid` | Either side traded under the per side minimum in the last hour | A margin on an item that trades twice a day is fiction, it will never fill |
| `one-sided` | The two sides differ by more than the skew limit | Both legs have to fill. Heavy flow one way and none the other means you get stuck holding it |
| `fake-spread` | Current spread exceeds the multiple of the 24h average spread | A spread several times wider than normal is usually one stale print, not an opportunity |
| `outlier` | Latest bid sits below, or latest ask above, the last hour's average by more than the band | The price you are counting on has not actually traded recently |

Defaults, all adjustable in the filter panel:

```
maxAgeSec         1800     30 minutes
minFlowPerSide      25     units per hour
maxFlowSkew         10     ratio between the two sides
maxSpreadRatio       2     multiple of the 24h average spread
maxOutlierBand    0.05     5% either side of the last hour's average
```

`fake-spread` is skipped when `/24h` has no entry for the item, because the alternative is
rejecting everything the moment that endpoint is slow.

### Why `outlier` exists

It was added after the allocator recommended putting 1.1b into Old school bond on a phantom 9.8%
margin. Live bond prices at the time were a bid of 11.2m against an ask of 12.3m, which reads as a
1.1m margin per bond and is not one.

The cause is that `high` and `low` are **two separate trades at two separate moments**. On a
volatile item the price simply drifts between them, and drift in the convenient direction
manufactures a margin that never existed. The `stale` gate does not catch it, because both prints
were seconds old. The `fake-spread` gate does not catch it either, because the item's 24 hour
average spread is itself inflated by the same drift. In the bond timeseries you can watch
`avgLowPrice` exceed `avgHighPrice` in individual buckets, which is arithmetically impossible for a
real spread and is proof the two sides are not simultaneous.

The fix is to check both prints against what actually traded in the last hour. A bid far below the
hourly average is an outlier you will not get filled at, and an ask far above it is a price nobody
is paying. On the current dataset this removes about 560 items, and the bond is one of them.

This is the single most important gate in the file. Every naive flip tool has this bug.

## The allocator

The Basic view. Members have eight offer slots, free players have three.

Filling slots from a fixed bank is a knapsack problem, so no single greedy rule is optimal. Rather
than pretend otherwise, the allocator **runs three strategies and keeps whichever produced the
highest total gp per hour**:

| Strategy | Each slot picks | Good at |
| --- | --- | --- |
| `rate` | The highest rate item affordable from all remaining gp | Large banks, where the best items are affordable anyway |
| `shared` | The highest rate item affordable from `remaining / slotsLeft` | Mid banks, where one expensive item would otherwise eat everything |
| `per-gp` | The highest rate per gp committed | Small banks, where capital efficiency dominates |

Each is a straightforward greedy pass, so all three together are still trivial to compute. The
winner is reported on the `Allocation` so it is never a mystery which one produced the plan.

This is not decoration. On a 50m bank the plain `rate` strategy commits 49m to a single item and
leaves six slots idle at about 390k an hour, while `shared` fills all eight for about 1.01m an
hour. Picking the best of the three is worth roughly 2.5x on that bank.

Recomputing `qty` inside the loop matters. An item's size depends on how much capital is left when
its slot comes up, so a candidate that was fourth best with a full bank can be second best with a
depleted one.

### The slot floor

A slot costs clicks and attention, so there is a `minProfit` floor, defaulting to 50,000. Below it
the allocator leaves the slot empty rather than filling it. Without this the tail of the plan fills
with things like four Gryphon feathers for 44 gp of profit, which is arithmetically the best
remaining option and obviously not worth doing.

**Unused slots must state a reason.** If the allocator fills five of eight, the view says why the
other three are empty: capital exhausted, everything already placed, nothing clearing the gates, or
nothing clearing the profit floor. An empty slot with a stated reason is an answer. An empty slot
with no explanation reads as a bug.

Leftover gp is also reported. A 2b bank routinely commits only a few hundred million, because there
genuinely is not more worth buying, and saying so is more useful than inventing filler.

## Files

| File | Role |
| --- | --- |
| `src/lib/market/tax.ts` | Rate, cap, exempt list, `geTax`. Pure |
| `src/lib/market/api.ts` | All six endpoints, TTL caching, the `Market` snapshot type |
| `src/lib/market/flip.ts` | Candidates, gates, sizing, the rate model. Pure |
| `src/lib/market/allocate.ts` | The slot allocator and its three strategies. Pure |
| `src/lib/market/fmt.ts` | gp, count, age and duration formatting. Pure |
| `src/lib/market/settings.ts` | The settings object, its defaults, persistence and the migration |
| `src/components/market/market.ts` | Tab shell, mode toggle, gates panel, the 60 second refresh |
| `src/components/market/basic.ts` | The allocator view |
| `src/components/market/advanced.ts` | Table, column picker, filters, row expand |

Everything except the last three is pure and has no DOM access, which is what makes it checkable
from the console.

`view.ts` owns a timer, so `main.ts` calls its `stop()` before wiping the DOM. Any new tab that
starts a loop needs the same treatment.

`view.ts` also puts a `wide` class on `#app` while Advanced is showing, because the app column is
520px and a twenty column table does not live there. `stop()` removes it, which is why `stop()` has
to run on every tab change and not only when a timer exists.

Settings live in their own module rather than in `view.ts` on purpose. Both `basic.ts` and
`advanced.ts` need the settings object and the save function, and `view.ts` imports both of them, so
keeping settings there made the three files import each other in a cycle. It happened to work,
because nothing was called at module evaluation time, but it is the kind of thing that breaks later
for reasons that take an afternoon to find.

## Settings and storage

| Key | Holds |
| --- | --- |
| `osrs-companion:market:v1` | Capital, slot count, check in interval, mode, gate thresholds, profit floor, column config |
| `osrs-companion:market:cache:*` | Endpoint response caches, safe to delete at any time |
| `osrs-companion:ge:v1` | The old key. Read once for capital and filters, then ignored |

Deleting the cache keys costs one extra round of fetches and nothing else.

## How to check it

There is no test suite. The pure modules import cleanly in the browser console.

```js
const t = await import('/src/lib/market/tax.ts?t=' + Date.now());
t.geTax(49, 99999);          // 0, rounds down
t.geTax(50, 99999);          // 1
t.geTax(250e6, 99999);       // 5000000, the cap, reached exactly here
t.geTax(1e9, 99999);         // 5000000, capped
t.geTax(8e6, 13190);         // 0, bond is exempt
t.geTax(3e6, 8007);          // 0, Varrock teleport tab is exempt
```

Invariants worth asserting on `allocate()` against live data:

- Committed gp never exceeds the capital passed in.
- No item ever appears in two slots.
- Every filled slot clears the profit floor.
- A capital of zero fills no slots and returns a reason.
- Slots are in descending `profitPerHour` order.
- More capital never earns less.

On `sizeFor()`:

- No rate ever exceeds `net * limit / 4`.
- No quantity ever exceeds the buy limit.
- No quantity ever exceeds what `effectiveFlow` moves in the check in window.
- A shorter check in window always ties up less gp.

And on `buildCandidates()`, that each gate moves the result set the direction you expect when its
threshold is tightened. Measured on 2026-08-04 against live data, 4,490 priced items with the
default gates: 240 pass, and turning off flow, spread and outlier individually raises that to 442,
281 and 318.

The quickest way to run all of this is to bundle a throwaway script with the esbuild already in
`node_modules` and run it under node, since the pure modules have no DOM dependency:

```bash
npx esbuild check.ts --bundle --format=esm --platform=node --outfile=check.mjs && node check.mjs
```

`localStorage` is absent under node. `api.ts` wraps every cache access in try/catch for exactly
this reason, so caching silently no-ops and the fetches all still work.
