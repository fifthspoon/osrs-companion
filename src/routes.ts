
export interface Stop {
  id: string;
  name: string;
  teleport: string;
  alt?: string;
  requires?: string;
  patches: string;
  diseaseFree?: boolean;
  world: { wx: number; wy: number };
}

export interface RouteDef {
  id: string;
  name: string;
  stops: Stop[];
}

export const HERB_RUN: RouteDef = {
  id: "herb",
  name: "Herb run",
  stops: [
    {
      id: "falador",
      world: { wx: 3058, wy: 3311 },
      name: "Falador",
      teleport: "Explorer's ring 2/3/4, run north",
      requires: "Medium Lumbridge Diary",
      patches: "Herb, allotment, flower",
    },
    {
      id: "phasmatys",
      world: { wx: 3605, wy: 3529 },
      name: "Port Phasmatys",
      teleport: "Ectophial",
      alt: "Fairy ring ALQ, run north",
      requires: "Ghosts Ahoy (ectophial), Priest in Peril",
      patches: "Herb, allotment, flower",
    },
    {
      id: "ardougne",
      world: { wx: 2670, wy: 3374 },
      name: "Ardougne",
      teleport: "Ardougne cloak 2/3/4",
      requires: "Medium Ardougne Diary",
      patches: "Herb, allotment, flower",
    },
    {
      id: "catherby",
      world: { wx: 2813, wy: 3463 },
      name: "Catherby",
      teleport: "Catherby teleport tablet",
      alt: "Lunar Catherby Teleport if you have the Magic level",
      patches: "Herb, allotment, fruit tree",
    },
    {
      id: "hosidius",
      world: { wx: 1738, wy: 3550 },
      name: "Hosidius",
      teleport: "Xeric's talisman, Xeric's Glade",
      requires: "Easy Kourend & Kebos Diary makes it disease-free",
      patches: "Herb, allotment, flower",
    },
    {
      id: "farmguild",
      world: { wx: 1238, wy: 3728 },
      name: "Farming Guild",
      teleport: "Skills necklace",
      alt: "Farming cape",
      requires: "Farming 65",
      patches: "Herb, allotment, flower, fruit tree, celastrus",
    },
    {
      id: "ortus",
      world: { wx: 1740, wy: 3120 },
      name: "Ortus Farm",
      teleport: "Quetzal whistle to Hunter Guild, run north",
      requires: "10 Hunters' Rumours for the basic whistle",
      patches: "Herb, allotment, flower, fruit tree",
    },
    {
      id: "troll",
      world: { wx: 2826, wy: 3695 },
      name: "Troll Stronghold",
      teleport: "Stony basalt",
      requires: "My Arm's Big Adventure. Hard Fremennik Diary + Agility 73",
      patches: "Herb",
      diseaseFree: true,
    },
    {
      id: "weiss",
      world: { wx: 2847, wy: 3934 },
      name: "Weiss",
      teleport: "Icy basalt",
      requires: "Making Friends with My Arm",
      patches: "Herb",
      diseaseFree: true,
    },
    {
      id: "harmony",
      world: { wx: 3789, wy: 2837 },
      name: "Harmony Island",
      teleport: "Harmony Island Teleport (Arceuus)",
      requires: "Elite Morytania Diary",
      patches: "Herb, allotment",
      diseaseFree: true,
    },
  ],
};

export const ROUTES: RouteDef[] = [HERB_RUN];
