export type TravelTicketKind = 'air' | 'rail' | 'sea';

export type TravelTileKind =
  | 'terminal'
  | 'station'
  | 'checkpoint'
  | 'event'
  | 'hub';

export interface TravelTileConfig {
  index: number;
  name: string;
  region: string;
  kind: TravelTileKind;
  checkpointId?: string;
  hubMode?: TravelTicketKind;
  shortcutTo?: number;
  /** SVG layout coordinates inside viewBox 0..560 x 0..380 */
  x: number;
  y: number;
}

export interface TravelEventCard {
  id: string;
  title: string;
  description: string;
  effect:
    | 'advance_3'
    | 'gain_air'
    | 'gain_rail'
    | 'customs_delay'
    | 'weather_delay'
    | 'vip_roll'
    | 'lost_luggage';
}

export interface TravelBoardConfig {
  id: string;
  name: string;
  requiredStamps: readonly string[];
  stampLabels: Record<string, string>;
  startingTickets: Record<TravelTicketKind, number>;
  tiles: readonly TravelTileConfig[];
  eventDeck: readonly TravelEventCard[];
}

export const STANDARD_TRAVEL_BOARD_CONFIG: TravelBoardConfig = {
  id: 'world-tour-28',
  name: 'Grand Continental Tour',
  requiredStamps: ['americas', 'europe', 'apac'],
  stampLabels: {
    americas: 'Americas Stamp',
    europe: 'Europe Stamp',
    apac: 'Asia-Pacific Stamp',
  },
  startingTickets: {
    air: 2,
    rail: 2,
    sea: 1,
  },
  tiles: [
    { index: 0, name: 'Grand Terminal', region: 'Global Hub', kind: 'terminal', x: 70, y: 315 },
    { index: 1, name: 'Atlantic Wharf', region: 'Coast', kind: 'station', x: 120, y: 315 },
    { index: 2, name: 'Harbor Fog Post', region: 'Event', kind: 'event', x: 170, y: 315 },
    { index: 3, name: 'Newark Skyport', region: 'Americas', kind: 'hub', hubMode: 'air', shortcutTo: 11, x: 220, y: 315 },
    { index: 4, name: 'Montreal Rail', region: 'Americas', kind: 'station', x: 270, y: 315 },
    { index: 5, name: 'Chicago Union', region: 'Americas', kind: 'hub', hubMode: 'rail', shortcutTo: 9, x: 325, y: 315 },
    { index: 6, name: 'Customs Gate W', region: 'Event', kind: 'event', x: 380, y: 315 },
    { index: 7, name: 'Rio Pavilion', region: 'Americas', kind: 'checkpoint', checkpointId: 'americas', x: 440, y: 315 },
    { index: 8, name: 'Pacific Ferry', region: 'Ocean', kind: 'hub', hubMode: 'sea', shortcutTo: 16, x: 490, y: 275 },
    { index: 9, name: 'Lisbon Pier', region: 'Europe', kind: 'station', x: 490, y: 220 },
    { index: 10, name: 'Paris Nord', region: 'Europe', kind: 'hub', hubMode: 'rail', shortcutTo: 15, x: 490, y: 165 },
    { index: 11, name: 'London Terminal', region: 'Europe', kind: 'station', x: 490, y: 110 },
    { index: 12, name: 'Alpine Pass', region: 'Event', kind: 'event', x: 445, y: 65 },
    { index: 13, name: 'Zurich Junction', region: 'Europe', kind: 'station', x: 390, y: 65 },
    { index: 14, name: 'Vienna Opera Hub', region: 'Europe', kind: 'checkpoint', checkpointId: 'europe', x: 335, y: 65 },
    { index: 15, name: 'Istanbul Bridge', region: 'Eurasia', kind: 'station', x: 280, y: 65 },
    { index: 16, name: 'Mediterranean Bay', region: 'Sea', kind: 'station', x: 225, y: 65 },
    { index: 17, name: 'Dubai Concourse', region: 'Transit', kind: 'hub', hubMode: 'air', shortcutTo: 24, x: 170, y: 65 },
    { index: 18, name: 'Silk Road Post', region: 'Event', kind: 'event', x: 115, y: 65 },
    { index: 19, name: 'Mumbai Central', region: 'Asia', kind: 'station', x: 65, y: 105 },
    { index: 20, name: 'Singapore Strait', region: 'Asia-Pacific', kind: 'hub', hubMode: 'sea', shortcutTo: 26, x: 65, y: 155 },
    { index: 21, name: 'Tokyo Central', region: 'Asia-Pacific', kind: 'checkpoint', checkpointId: 'apac', x: 65, y: 205 },
    { index: 22, name: 'Kyoto Garden', region: 'Asia-Pacific', kind: 'station', x: 120, y: 185 },
    { index: 23, name: 'Pacific Jetstream', region: 'Event', kind: 'event', x: 185, y: 185 },
    { index: 24, name: 'Sydney Harbor', region: 'Oceania', kind: 'station', x: 255, y: 185 },
    { index: 25, name: 'Honolulu Buoy', region: 'Pacific', kind: 'station', x: 330, y: 185 },
    { index: 26, name: 'Vancouver Port', region: 'Americas', kind: 'station', x: 255, y: 245 },
    { index: 27, name: 'Homeward Express', region: 'Final Approach', kind: 'station', x: 150, y: 255 },
  ],
  eventDeck: [
    {
      id: 'tailwind',
      title: 'Tailwind Express',
      description: 'Favorable jetstream carries you +3 stations ahead.',
      effect: 'advance_3',
    },
    {
      id: 'air-upgrade',
      title: 'Complimentary Air Voucher',
      description: 'Receive +1 Air Ticket for future express flights.',
      effect: 'gain_air',
    },
    {
      id: 'rail-upgrade',
      title: 'Scenic Rail Pass',
      description: 'Receive +1 Rail Ticket for continental corridors.',
      effect: 'gain_rail',
    },
    {
      id: 'customs',
      title: 'Customs Inspection',
      description: 'Hold for inspection—skip your next roll unless bypassed.',
      effect: 'customs_delay',
    },
    {
      id: 'weather',
      title: 'Harbor Weather Delay',
      description: 'Headwinds halve your next dice roll (rounded up).',
      effect: 'weather_delay',
    },
    {
      id: 'vip',
      title: 'VIP Lounge Fast-Track',
      description: 'Board immediately—roll again right now!',
      effect: 'vip_roll',
    },
    {
      id: 'luggage',
      title: 'Misrouted Luggage',
      description: 'Backtrack 2 stations (earned passport stamps remain yours).',
      effect: 'lost_luggage',
    },
  ],
};
