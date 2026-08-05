
export type TaskKind = "cooldown" | "daily";

export interface TaskDef {
  id: string;
  name: string;
  kind: TaskKind;
  minutes?: number; // cooldown tasks only
  note?: string;
  defaultOn: boolean;
}

export const TASKS: TaskDef[] = [
  {
    id: "birdhouse",
    name: "Birdhouse run",
    kind: "cooldown",
    minutes: 50,
    note: "Wiki recommended cooldown",
    defaultOn: true,
  },
  {
    id: "herb",
    name: "Herb run",
    kind: "cooldown",
    minutes: 80,
    note: "APPROX. herbs run about 80 min start to finish",
    defaultOn: true,
  },
  {
    id: "seaweed",
    name: "Giant seaweed",
    kind: "cooldown",
    minutes: 40,
    note: "Fully grows in about 40 min",
    defaultOn: false,
  },

  {
    id: "tree",
    name: "Tree run",
    kind: "cooldown",
    minutes: 640,
    note: "APPROX, varies by tree type",
    defaultOn: false,
  },
  {
    id: "fruittree",
    name: "Fruit tree run",
    kind: "cooldown",
    minutes: 900,
    note: "About 15 hours",
    defaultOn: false,
  },
  {
    id: "hespori",
    name: "Hespori",
    kind: "cooldown",
    minutes: 1560,
    note: "APPROX, 22 to 32 hours depending on plant time",
    defaultOn: false,
  },
  {
    id: "hardwood",
    name: "Hardwood trees",
    kind: "cooldown",
    minutes: 4320,
    note: "Over three real days",
    defaultOn: false,
  },

  {
    id: "zaff",
    name: "Zaff battlestaves",
    kind: "daily",
    note: "Varrock",
    defaultOn: true,
  },
  {
    id: "naff",
    name: "Naff battlestaves",
    kind: "daily",
    note: "Zanaris",
    defaultOn: false,
  },
  {
    id: "bert",
    name: "Bert's sand",
    kind: "daily",
    note: "84 buckets",
    defaultOn: true,
  },
  {
    id: "miscellania",
    name: "Kingdom of Miscellania",
    kind: "daily",
    note: "Collect resources, top up favour",
    defaultOn: false,
  },
  {
    id: "herbboxes",
    name: "NMZ herb boxes",
    kind: "daily",
    note: "15 per day",
    defaultOn: false,
  },
  {
    id: "contract",
    name: "Farming contract",
    kind: "daily",
    note: "Guildmaster Jane",
    defaultOn: false,
  },
];
