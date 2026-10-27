/**
 * All game content is data: the hotel layout, its furniture and task stations,
 * the task catalogue, roles, sabotages, incidents and round modifiers.
 * The server reads this to build the world; the client reads it to draw it.
 * Editing this file is the intended way to add content.
 */

export type ZoneId =
  | "reception"
  | "bedroomA"
  | "bedroomB"
  | "corridor"
  | "lobby"
  | "laundry"
  | "dining"
  | "supply";

export type TaskKindId =
  | "makeBed"
  | "cleanSpill"
  | "sortLaundry"
  | "deliverLuggage"
  | "restockSupplies"
  | "serveMeals"
  | "fixCircuit"
  | "checkInGuests";

export type RoleId =
  | "ordinary"
  | "sheriff"
  | "detective"
  | "mechanic"
  | "whisperer"
  | "janitor"
  | "manager"
  | "imposter";

export type SabotageId =
  | "looseWheel"
  | "elephantBait"
  | "wrongRoom"
  | "powerOutage"
  | "supplySwap"
  | "fakeSpill"
  | "openDoor";

export type AvatarId = number; // index into AVATARS

export interface AvatarDef {
  id: number;
  name: string;
  body: string;
  trim: string;
  skin: string;
}

export const AVATARS: AvatarDef[] = [
  { id: 0, name: "Coral", body: "#ff6b6b", trim: "#c92a2a", skin: "#ffd9c0" },
  { id: 1, name: "Mustard", body: "#ffd166", trim: "#b8860b", skin: "#f7d3ae" },
  { id: 2, name: "Mint", body: "#63e6be", trim: "#0ca678", skin: "#ffe0c2" },
  { id: 3, name: "Sky", body: "#4dabf7", trim: "#1971c2", skin: "#f2c9a0" },
  { id: 4, name: "Grape", body: "#b197fc", trim: "#6741d9", skin: "#ffd9c0" },
  { id: 5, name: "Bubblegum", body: "#ff8ad8", trim: "#c2255c", skin: "#f7d3ae" },
  { id: 6, name: "Pumpkin", body: "#ffa94d", trim: "#d9480f", skin: "#e8b382" },
  { id: 7, name: "Slate", body: "#adb5bd", trim: "#495057", skin: "#c68863" },
];

export const EMOTES = ["🐘", "🤫", "😱", "👀", "🧹", "❗"];

export interface RoomDef {
  id: ZoneId;
  name: string;
  /** interior rect in tiles (walls are drawn around it) */
  x: number;
  y: number;
  w: number;
  h: number;
  floor: string;
  floorAlt: string;
  wall: string;
  wallTop: string;
  /** the main corridor is the elephant's home turf */
  elephantTerritory?: boolean;
  /**
   * Open zones are part of the hall: they get a floor and a nameplate but no wall
   * ring. Without this the corridor and the lobby wall themselves off from each
   * other and the hotel stops being traversable.
   */
  open?: boolean;
}

export const ROOMS: RoomDef[] = [
  {
    id: "reception",
    name: "Reception",
    x: 2,
    y: 2,
    w: 11,
    h: 9,
    floor: "#f6e7d3",
    floorAlt: "#efdcc4",
    wall: "#c98f5a",
    wallTop: "#e0aa74",
  },
  {
    id: "bedroomA",
    name: "Room 101",
    x: 17,
    y: 2,
    w: 9,
    h: 9,
    floor: "#e8dff5",
    floorAlt: "#ded2f0",
    wall: "#8b7cff",
    wallTop: "#a99cff",
  },
  {
    id: "bedroomB",
    name: "Room 102",
    x: 29,
    y: 2,
    w: 8,
    h: 9,
    floor: "#e8dff5",
    floorAlt: "#ded2f0",
    wall: "#8b7cff",
    wallTop: "#a99cff",
  },
  {
    id: "corridor",
    name: "Main Corridor",
    x: 1,
    y: 12,
    w: 30,
    h: 4,
    floor: "#ffe8c2",
    floorAlt: "#f7ddb2",
    wall: "#b08048",
    wallTop: "#cf9c5f",
    elephantTerritory: true,
    open: true,
  },
  {
    id: "lobby",
    name: "Lobby Entrance",
    x: 31,
    y: 12,
    w: 8,
    h: 5,
    floor: "#d7f0e4",
    floorAlt: "#c7e8d9",
    wall: "#3aa07d",
    wallTop: "#5cc2a0",
    open: true,
  },
  {
    id: "laundry",
    name: "Laundry",
    x: 2,
    y: 17,
    w: 10,
    h: 9,
    floor: "#d8ecff",
    floorAlt: "#c8e2fb",
    wall: "#4dabf7",
    wallTop: "#78c1fb",
  },
  {
    id: "dining",
    name: "Dining Area",
    x: 16,
    y: 17,
    w: 11,
    h: 9,
    floor: "#ffe0e0",
    floorAlt: "#fbd0d0",
    wall: "#ff8787",
    wallTop: "#ffa8a8",
  },
  {
    id: "supply",
    name: "Supply Cupboard",
    x: 30,
    y: 17,
    w: 6,
    h: 6,
    floor: "#f0e6d2",
    floorAlt: "#e6dbc2",
    wall: "#a68a64",
    wallTop: "#c2a67c",
  },
];

export function roomById(id: ZoneId): RoomDef {
  return ROOMS.find((r) => r.id === id) ?? ROOMS[3];
}

/** walkable gaps carved into a room's wall ring */
export interface ArchwayDef {
  room: ZoneId;
  tiles: [number, number][];
}

export const ARCHWAYS: ArchwayDef[] = [
  { room: "reception", tiles: [[7, 11], [8, 11]] },
  { room: "laundry", tiles: [[6, 16], [7, 16]] },
  { room: "dining", tiles: [[20, 16], [21, 16]] },
  { room: "supply", tiles: [[32, 16], [33, 16]] },
];

/** closable doors block movement *and* line of sight - the core hiding tool */
export interface DoorDef {
  id: string;
  name: string;
  room: ZoneId;
  tiles: [number, number][];
  startsOpen: boolean;
  lockable: boolean;
}

export const DOORS: DoorDef[] = [
  {
    id: "door101",
    name: "Room 101 Door",
    room: "bedroomA",
    tiles: [[20, 11], [21, 11]],
    startsOpen: true,
    lockable: false,
  },
  {
    id: "door102",
    name: "Room 102 Door",
    room: "bedroomB",
    tiles: [[31, 11], [32, 11]],
    startsOpen: true,
    lockable: false,
  },
  {
    id: "frontDoors",
    name: "Front Doors",
    room: "lobby",
    tiles: [[39, 13], [39, 14]],
    startsOpen: true,
    lockable: true,
  },
];

export type StationKind =
  | "desk"
  | "rack"
  | "bed"
  | "shelf"
  | "washer"
  | "table"
  | "cake"
  | "vending"
  | "powerbox"
  | "trolley"
  | "cart"
  | "seat"
  | "plant"
  | "bin"
  | "lamp"
  | "bucket"
  | "plate";

export interface StationDef {
  id: string;
  name: string;
  room: ZoneId;
  /** tile coords of the footprint's top-left corner */
  x: number;
  y: number;
  w: number;
  h: number;
  solid: boolean;
  kind: StationKind;
  /** task kinds that the scheduler may assign to this station */
  tasks: TaskKindId[];
  /** decorative props are drawn but never highlighted as interactable */
  interactive: boolean;
  /** sabotages can target this station (trolley wheel, supply swap, ...) */
  sabotageTarget?: boolean;
}

export const STATIONS: StationDef[] = [
  // Reception
  { id: "frontDesk", name: "Front Desk", room: "reception", x: 3, y: 3, w: 5, h: 1, solid: true, kind: "desk", tasks: ["checkInGuests"], interactive: true },
  { id: "luggageRack", name: "Luggage Rack", room: "reception", x: 10, y: 3, w: 1, h: 2, solid: true, kind: "rack", tasks: ["deliverLuggage"], interactive: true, sabotageTarget: true },
  { id: "phone", name: "Telephone", room: "reception", x: 3, y: 9, w: 1, h: 1, solid: false, kind: "lamp", tasks: [], interactive: false },
  { id: "plantReception", name: "Potted Palm", room: "reception", x: 12, y: 9, w: 1, h: 1, solid: false, kind: "plant", tasks: [], interactive: false },

  // Guest Bedroom 101
  { id: "bed101", name: "Bed (Room 101)", room: "bedroomA", x: 18, y: 3, w: 2, h: 3, solid: true, kind: "bed", tasks: ["makeBed"], interactive: true },
  { id: "shelf101", name: "Room Supplies", room: "bedroomA", x: 24, y: 3, w: 1, h: 2, solid: true, kind: "shelf", tasks: ["restockSupplies"], interactive: true, sabotageTarget: true },
  { id: "bin101", name: "Bin", room: "bedroomA", x: 24, y: 9, w: 1, h: 1, solid: false, kind: "bin", tasks: [], interactive: false },

  // Guest Bedroom 102
  { id: "bed102", name: "Bed (Room 102)", room: "bedroomB", x: 30, y: 3, w: 2, h: 3, solid: true, kind: "bed", tasks: ["makeBed"], interactive: true },
  { id: "shelf102", name: "Room Supplies", room: "bedroomB", x: 34, y: 3, w: 1, h: 2, solid: true, kind: "shelf", tasks: ["restockSupplies"], interactive: true, sabotageTarget: true },
  { id: "bin102", name: "Bin", room: "bedroomB", x: 35, y: 9, w: 1, h: 1, solid: false, kind: "bin", tasks: [], interactive: false },

  // Main corridor
  { id: "vending", name: "Vending Machine", room: "corridor", x: 6, y: 12, w: 1, h: 1, solid: true, kind: "vending", tasks: ["fixCircuit"], interactive: true, sabotageTarget: true },
  { id: "cartCorridor", name: "Housekeeping Trolley", room: "corridor", x: 26, y: 14, w: 1, h: 1, solid: true, kind: "trolley", tasks: [], interactive: true, sabotageTarget: true },

  // Lobby
  { id: "seatLobby", name: "Lobby Sofa", room: "lobby", x: 33, y: 12, w: 3, h: 1, solid: true, kind: "seat", tasks: [], interactive: false },
  { id: "luggageCart", name: "Luggage Cart", room: "lobby", x: 33, y: 15, w: 2, h: 1, solid: true, kind: "cart", tasks: [], interactive: true, sabotageTarget: true },

  // Laundry
  { id: "washerA", name: "Washing Machine", room: "laundry", x: 3, y: 18, w: 1, h: 1, solid: true, kind: "washer", tasks: ["sortLaundry", "fixCircuit"], interactive: true, sabotageTarget: true },
  { id: "washerB", name: "Washing Machine", room: "laundry", x: 5, y: 18, w: 1, h: 1, solid: true, kind: "washer", tasks: ["sortLaundry", "fixCircuit"], interactive: true, sabotageTarget: true },
  { id: "sortTable", name: "Sorting Table", room: "laundry", x: 8, y: 18, w: 3, h: 1, solid: true, kind: "table", tasks: ["sortLaundry"], interactive: true },
  { id: "trolleyLaundry", name: "Laundry Trolley", room: "laundry", x: 10, y: 24, w: 1, h: 1, solid: true, kind: "trolley", tasks: [], interactive: true, sabotageTarget: true },
  { id: "bucketLaundry", name: "Bucket", room: "laundry", x: 2, y: 24, w: 1, h: 1, solid: false, kind: "bucket", tasks: [], interactive: false },

  // Dining
  { id: "table1", name: "Table 1", room: "dining", x: 17, y: 19, w: 2, h: 2, solid: true, kind: "table", tasks: ["serveMeals"], interactive: true },
  { id: "table2", name: "Table 2", room: "dining", x: 21, y: 19, w: 2, h: 2, solid: true, kind: "table", tasks: ["serveMeals"], interactive: true },
  { id: "table3", name: "Table 3", room: "dining", x: 17, y: 23, w: 2, h: 2, solid: true, kind: "table", tasks: ["serveMeals"], interactive: true },
  { id: "table4", name: "Table 4", room: "dining", x: 21, y: 23, w: 2, h: 2, solid: true, kind: "table", tasks: ["serveMeals"], interactive: true },
  { id: "cakeStand", name: "Cake Stand", room: "dining", x: 25, y: 17, w: 1, h: 1, solid: true, kind: "cake", tasks: [], interactive: true },
  { id: "plateStack", name: "Plate Stack", room: "dining", x: 25, y: 24, w: 1, h: 1, solid: false, kind: "plate", tasks: [], interactive: false },

  // Supply cupboard
  { id: "shelfA", name: "Supply Shelf", room: "supply", x: 31, y: 18, w: 1, h: 2, solid: true, kind: "shelf", tasks: ["restockSupplies"], interactive: true, sabotageTarget: true },
  { id: "shelfB", name: "Supply Shelf", room: "supply", x: 33, y: 18, w: 1, h: 2, solid: true, kind: "shelf", tasks: ["restockSupplies"], interactive: true, sabotageTarget: true },
  { id: "powerBox", name: "Power Box", room: "supply", x: 35, y: 21, w: 1, h: 1, solid: true, kind: "powerbox", tasks: ["fixCircuit"], interactive: true, sabotageTarget: true },
  { id: "cleaningRack", name: "Cleaning Rack", room: "supply", x: 30, y: 21, w: 1, h: 1, solid: true, kind: "rack", tasks: ["cleanSpill"], interactive: true },
  { id: "bucketSupply", name: "Mop Bucket", room: "supply", x: 35, y: 17, w: 1, h: 1, solid: false, kind: "bucket", tasks: [], interactive: false },
];

export function station(id: string): StationDef | undefined {
  return STATIONS.find((s) => s.id === id);
}

export interface TaskDef {
  id: TaskKindId;
  name: string;
  verb: string;
  blurb: string;
  /** seconds the server expects it to take - used for timing validation */
  seconds: number;
  /** work units granted on success */
  reward: number;
  /** how many players must be in range for the task to count */
  requiresPlayers: number;
  icon: string;
}

export const TASKS: TaskDef[] = [
  { id: "makeBed", name: "Make the Bed", verb: "Making a bed", blurb: "Sheets, pillow, duvet, teddy. In that order, ideally.", seconds: 10, reward: 1, requiresPlayers: 1, icon: "🛏" },
  { id: "cleanSpill", name: "Clean the Spill", verb: "Mopping", blurb: "Mop every dirty patch before somebody slips dramatically.", seconds: 9, reward: 1, requiresPlayers: 1, icon: "🧽" },
  { id: "sortLaundry", name: "Sort Laundry", verb: "Sorting laundry", blurb: "Every garment in the basket of its own colour.", seconds: 10, reward: 1, requiresPlayers: 1, icon: "🧺" },
  { id: "deliverLuggage", name: "Deliver Luggage", verb: "Delivering luggage", blurb: "Match every suitcase to the room it belongs in.", seconds: 11, reward: 1, requiresPlayers: 1, icon: "🧳" },
  { id: "restockSupplies", name: "Restock Supplies", verb: "Restocking", blurb: "Fill the shelf in the order the checklist demands.", seconds: 10, reward: 1, requiresPlayers: 1, icon: "🧴" },
  { id: "serveMeals", name: "Serve Meals", verb: "Serving meals", blurb: "Give each guest the plate they actually ordered.", seconds: 10, reward: 1, requiresPlayers: 1, icon: "🍽" },
  { id: "fixCircuit", name: "Fix the Circuit", verb: "Fixing the circuit", blurb: "Rotate the pipes until power flows end to end.", seconds: 12, reward: 1, requiresPlayers: 1, icon: "🔌" },
  { id: "checkInGuests", name: "Check In Guests", verb: "Checking guests in", blurb: "Bookings, names and room numbers. All three matter.", seconds: 11, reward: 1, requiresPlayers: 1, icon: "📋" },
];

export function taskDef(kind: TaskKindId): TaskDef {
  return TASKS.find((t) => t.id === kind) ?? TASKS[0];
}

/** cooperative variants: the same station, but it needs two pairs of hands */
export const COOP_TASK_KINDS: TaskKindId[] = ["deliverLuggage"];

export interface RoleDef {
  id: RoleId;
  name: string;
  team: "employees" | "imposters";
  icon: string;
  blurb: string;
  abilityName: string | null;
  abilityBlurb: string | null;
  cooldown: number;
  uses: number;
}

export const ROLES: RoleDef[] = [
  {
    id: "ordinary",
    name: "Ordinary Employee",
    team: "employees",
    icon: "🧑‍💼",
    blurb: "No powers, no excuses. Do the work and watch everyone else very carefully.",
    abilityName: null,
    abilityBlurb: null,
    cooldown: 0,
    uses: 0,
  },
  {
    id: "sheriff",
    name: "Sheriff",
    team: "employees",
    icon: "👮",
    blurb: "One arrest per match. Getting it right cripples an imposter. Getting it wrong is a scandal.",
    abilityName: "Arrest",
    abilityBlurb:
      "Walk up to a player and arrest them. A guilty suspect loses their sabotage abilities for 30s; an innocent one makes a scene and spikes exposure.",
    cooldown: 0,
    uses: 1,
  },
  {
    id: "detective",
    name: "Detective",
    team: "employees",
    icon: "🔎",
    blurb: "Inspect damaged objects for partial clues. Never a guaranteed answer.",
    abilityName: "Inspect",
    abilityBlurb:
      "Stand next to a sabotaged or suspicious object to read a clue about who interacted with it last.",
    cooldown: 18,
    uses: 0,
  },
  {
    id: "mechanic",
    name: "Mechanic",
    team: "employees",
    icon: "🔧",
    blurb: "Repairs sabotaged equipment almost instantly and can sniff out a tampered machine.",
    abilityName: "Diagnose",
    abilityBlurb: "Reveals whether the object in front of you has been tampered with, and repairs on the spot.",
    cooldown: 14,
    uses: 0,
  },
  {
    id: "whisperer",
    name: "Animal Whisperer",
    team: "employees",
    icon: "🧘",
    blurb: "The only person the elephant actually likes.",
    abilityName: "Calm the Elephant",
    abilityBlurb:
      "Get close and calm the elephant: it stops misbehaving for a while and exposure starts falling fast.",
    cooldown: 25,
    uses: 0,
  },
  {
    id: "janitor",
    name: "Janitor",
    team: "employees",
    icon: "🧹",
    blurb: "Cleans spills twice as fast and can erase evidence - which makes you look incredibly suspicious.",
    abilityName: "Deep Clean",
    abilityBlurb: "Instantly clears every spill within a few tiles. Witnesses will remember that you did it.",
    cooldown: 30,
    uses: 0,
  },
  {
    id: "manager",
    name: "Manager",
    team: "employees",
    icon: "📣",
    blurb: "Can redirect the inspection route and call one emergency inspection.",
    abilityName: "Emergency Inspection",
    abilityBlurb: "Sends every guest sweeping toward your location - great for proof, terrible if the elephant is there.",
    cooldown: 40,
    uses: 1,
  },
  {
    id: "imposter",
    name: "Saboteur",
    team: "imposters",
    icon: "😈",
    blurb:
      "You have fake jobs, real sabotage tools and no interest in the work quota. Keep the elephant in everyone's way.",
    abilityName: null,
    abilityBlurb: null,
    cooldown: 0,
    uses: 0,
  },
];

export function roleDef(id: RoleId): RoleDef {
  return ROLES.find((r) => r.id === id) ?? ROLES[0];
}

export interface SabotageDef {
  id: SabotageId;
  name: string;
  icon: string;
  blurb: string;
  cooldown: number;
  uses: number;
  /** what the client should let the player pick, if anything */
  target: "none" | "station" | "player" | "door";
}

export const SABOTAGES: SabotageDef[] = [
  {
    id: "looseWheel",
    name: "Loose Wheel",
    icon: "🛒",
    blurb:
      "Wreck a trolley's wheel. Whoever uses it next takes the blame for the crash - perfect cover for you.",
    cooldown: 35,
    uses: 3,
    target: "station",
  },
  {
    id: "elephantBait",
    name: "Elephant Bait",
    icon: "🍰",
    blurb: "Leave a tempting snack somewhere. The elephant will wander over and investigate it for a while.",
    cooldown: 30,
    uses: 3,
    target: "none",
  },
  {
    id: "wrongRoom",
    name: "Wrong Room",
    icon: "🔀",
    blurb: "Swap a guest's assigned room in the system. They wander somewhere they have no business being.",
    cooldown: 40,
    uses: 2,
    target: "none",
  },
  {
    id: "powerOutage",
    name: "Power Outage",
    icon: "💡",
    blurb: "Kill the lights in a section of the hotel. Guests see less, but so do the employees.",
    cooldown: 45,
    uses: 2,
    target: "none",
  },
  {
    id: "supplySwap",
    name: "Supply Swap",
    icon: "📦",
    blurb: "Move a room's supplies somewhere else. Now someone has to walk. Long. Way.",
    cooldown: 35,
    uses: 3,
    target: "station",
  },
  {
    id: "fakeSpill",
    name: "Fake Spill",
    icon: "💧",
    blurb: "Tip over a bucket. It's not a task, it's a trap - and it wastes everyone's time.",
    cooldown: 25,
    uses: 4,
    target: "none",
  },
  {
    id: "openDoor",
    name: "Open Doors",
    icon: "🚪",
    blurb: "Force the front doors wide open so guests can see straight into the lobby.",
    cooldown: 50,
    uses: 2,
    target: "door",
  },
];

export function sabotageDef(id: SabotageId): SabotageDef {
  return SABOTAGES.find((s) => s.id === id) ?? SABOTAGES[0];
}

export interface IncidentDef {
  id: string;
  name: string;
  icon: string;
  blurb: string;
  weight: number;
  /** earliest match time (seconds elapsed) this incident can fire */
  minTime: number;
  cooldown: number;
}

export const INCIDENTS: IncidentDef[] = [
  { id: "vipArrives", name: "VIP Arrives Early", icon: "🕴", blurb: "An important guest is already in the building.", weight: 8, minTime: 20, cooldown: 90 },
  { id: "stealsCake", name: "Elephant Steals The Cake", icon: "🎂", blurb: "The centrepiece is gone. There is a trail of frosting.", weight: 10, minTime: 25, cooldown: 70 },
  { id: "managerReroute", name: "Manager Changes The Route", icon: "🗺", blurb: "Inspections now sweep different rooms. Good luck.", weight: 7, minTime: 40, cooldown: 80 },
  { id: "cartRolls", name: "Luggage Cart Rolls", icon: "🧳", blurb: "A cart is loose in the corridor, loudly.", weight: 10, minTime: 20, cooldown: 55 },
  { id: "powerFlicker", name: "The Lights Go", icon: "🔌", blurb: "A section of the hotel goes dark.", weight: 8, minTime: 35, cooldown: 70 },
  { id: "elephantNaps", name: "Elephant Falls Asleep", icon: "😴", blurb: "It has chosen a doorway as a bed.", weight: 9, minTime: 30, cooldown: 75 },
  { id: "noisyGuest", name: "A Guest Complains", icon: "😤", blurb: "Loudly. In the corridor. Someone should apologise nearby.", weight: 10, minTime: 15, cooldown: 50 },
  { id: "pipeLeak", name: "Water Pipe Leaks", icon: "🚿", blurb: "There is water on the floor and it is not a puddle, it is a problem.", weight: 9, minTime: 25, cooldown: 60 },
  { id: "doubleBooked", name: "Room Double-Booked", icon: "📑", blurb: "Two bookings, one room. Check-in just got spicy.", weight: 7, minTime: 30, cooldown: 65 },
  { id: "doorAjar", name: "A Guest Leaves The Door Open", icon: "🚪", blurb: "And that room now has an excellent view of the corridor.", weight: 8, minTime: 35, cooldown: 60 },
  { id: "hungryElephant", name: "The Elephant Gets Hungry", icon: "🍽", blurb: "It has opinions about food and none about subtlety.", weight: 9, minTime: 45, cooldown: 70 },
  { id: "machineBreak", name: "A Machine Fails", icon: "⚙️", blurb: "Something in the hotel just went bang and stopped.", weight: 9, minTime: 30, cooldown: 65 },
];

export function incidentDef(id: string): IncidentDef | undefined {
  return INCIDENTS.find((i) => i.id === id);
}

export interface ModifierDef {
  id:
    | "doubleTrouble"
    | "nightShift"
    | "rushHour"
    | "quietHours"
    | "vipVisit"
    | "tinyHotel";
  name: string;
  icon: string;
  blurb: string;
}

export const MODIFIERS: ModifierDef[] = [
  { id: "doubleTrouble", name: "Double Trouble", icon: "⚡", blurb: "Incidents arrive far more often." },
  { id: "nightShift", name: "Night Shift", icon: "🌙", blurb: "The hotel is dark from the start." },
  { id: "rushHour", name: "Rush Hour", icon: "🚶", blurb: "Twice as many guests wandering around." },
  { id: "quietHours", name: "Quiet Hours", icon: "🤫", blurb: "Noise attracts guests and spikes exposure." },
  { id: "vipVisit", name: "VIP Visit", icon: "👑", blurb: "A very observant guest patrols from the start." },
  { id: "tinyHotel", name: "Tiny Hotel", icon: "🚧", blurb: "Two routes are coned off and unusable." },
];

/** guest inspection waypoints, in tiles - the manager may shuffle these */
export const GUEST_ROUTE: { x: number; y: number; dwell: number; label: string }[] = [
  { x: 36, y: 13, dwell: 3, label: "lobby" },
  { x: 24, y: 13, dwell: 2, label: "corridor" },
  { x: 7, y: 6, dwell: 4, label: "reception" },
  { x: 19, y: 8, dwell: 4, label: "room101" },
  { x: 22, y: 13, dwell: 2, label: "corridor" },
  { x: 31, y: 8, dwell: 4, label: "room102" },
  { x: 24, y: 21, dwell: 4, label: "dining" },
  { x: 6, y: 21, dwell: 4, label: "laundry" },
  { x: 33, y: 20, dwell: 3, label: "supply" },
  { x: 28, y: 13, dwell: 2, label: "corridor" },
  { x: 36, y: 14, dwell: 2, label: "lobby" },
];

/** player spawn tiles, spread across the lobby */
export const PLAYER_SPAWNS: [number, number][] = [
  [35, 13],
  [37, 15],
  [34, 14],
  [36, 16],
  [33, 13],
  [35, 16],
  [37, 12],
  [34, 16],
];

/** where guests appear (world tile coords, just outside the front doors) */
export const GUEST_SPAWN: [number, number] = [39, 13.5];

/** rooms that count as "food areas" the elephant likes to raid */
export const FOOD_ROOMS: ZoneId[] = ["dining"];

export const GUEST_NAMES = [
  "Mrs. Pemberton",
  "Mr. Ashcroft",
  "The Hendersons",
  "Chef Laurent",
  "Lady Fitzgerald",
  "Coach Barlow",
  "Dr. Nkemdirim",
  "Auntie Rose",
  "The Bicycle Group",
  "Mr. Vasquez",
  "Ms. Kowalski",
  "The Twins",
];

export const GUEST_COMPLAINTS = [
  "There is a very large animal in the hallway.",
  "Something is standing on my suitcase.",
  "I booked a quiet room, not a safari.",
  "Is that trunk... attached to anything?",
  "The floor is vibrating and the ceiling is unhappy.",
  "I would like to speak to the manager about the noise.",
  "My pillow is damp and enormous.",
  "A very heavy grey guest just ordered dessert.",
];
