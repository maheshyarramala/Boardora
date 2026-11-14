export type VehicleId = 'sedan' | 'rally' | 'roadster' | 'electric';

export interface VehicleSpec {
  id: VehicleId;
  name: string;
  maxFuel: number;
  maxNitro: number;
  trait: string;
  colorHex: string;
}

export const VEHICLE_ROSTER: Record<VehicleId, VehicleSpec> = {
  sedan: {
    id: 'sedan',
    name: 'Grand Sedan',
    maxFuel: 10,
    maxNitro: 2,
    trait: 'Balanced tourer with reliable fuel economy.',
    colorHex: '#ef4444',
  },
  rally: {
    id: 'rally',
    name: 'Rally Coupe',
    maxFuel: 9,
    maxNitro: 2,
    trait: 'All-wheel grip ignores oil slick speed penalties.',
    colorHex: '#38bdf8',
  },
  roadster: {
    id: 'roadster',
    name: 'Apex Roadster',
    maxFuel: 8,
    maxNitro: 2,
    trait: 'Turbo Boost pads grant +1 extra segment.',
    colorHex: '#f59e0b',
  },
  electric: {
    id: 'electric',
    name: 'Volt GT',
    maxFuel: 12,
    maxNitro: 2,
    trait: 'Regenerates +1 Fuel on every Checkpoint.',
    colorHex: '#10b981',
  },
};

export type DriveFeatureKind = 'pit' | 'oil' | 'boost' | 'roadblock' | 'event';

export interface DriveTileFeature {
  segment: number;
  lane: 0 | 1 | 2;
  kind: DriveFeatureKind;
}

export interface DriveEventCard {
  id: string;
  title: string;
  description: string;
  effect: 'clear_road_2' | 'headwind_fuel' | 'slipstream_1' | 'pit_nitro';
}

export interface DriveTrackConfig {
  id: string;
  name: string;
  totalSegments: number;
  checkpoints: readonly number[];
  features: readonly DriveTileFeature[];
  eventDeck: readonly DriveEventCard[];
}

export const STANDARD_DRIVE_TRACK_CONFIG: DriveTrackConfig = {
  id: 'silver-coast-32',
  name: 'Silver Coast Circuit',
  totalSegments: 32,
  checkpoints: [8, 16, 24],
  features: [
    // Sector 1 (1..8)
    { segment: 3, lane: 1, kind: 'boost' },
    { segment: 5, lane: 0, kind: 'roadblock' },
    { segment: 6, lane: 2, kind: 'oil' },
    { segment: 7, lane: 0, kind: 'pit' },
    { segment: 8, lane: 1, kind: 'event' },
    // Sector 2 (9..16)
    { segment: 10, lane: 2, kind: 'boost' },
    { segment: 11, lane: 1, kind: 'roadblock' },
    { segment: 13, lane: 0, kind: 'oil' },
    { segment: 14, lane: 2, kind: 'event' },
    { segment: 15, lane: 0, kind: 'pit' },
    // Sector 3 (17..24)
    { segment: 18, lane: 0, kind: 'boost' },
    { segment: 19, lane: 2, kind: 'roadblock' },
    { segment: 20, lane: 1, kind: 'oil' },
    { segment: 22, lane: 1, kind: 'event' },
    { segment: 23, lane: 2, kind: 'pit' },
    // Sector 4 (25..31)
    { segment: 26, lane: 1, kind: 'roadblock' },
    { segment: 27, lane: 0, kind: 'boost' },
    { segment: 28, lane: 2, kind: 'oil' },
    { segment: 29, lane: 0, kind: 'event' },
    { segment: 30, lane: 1, kind: 'boost' },
  ],
  eventDeck: [
    {
      id: 'clear-lane',
      title: 'Clear Straightaway',
      description: 'Open highway ahead—surge +2 segments forward.',
      effect: 'clear_road_2',
    },
    {
      id: 'headwind',
      title: 'Coastal Crosswind',
      description: 'Heavy drag consumes 1 extra fuel.',
      effect: 'headwind_fuel',
    },
    {
      id: 'slipstream',
      title: 'Drafting Slipstream',
      description: 'Tuck into draft—advance +1 bonus segment.',
      effect: 'slipstream_1',
    },
    {
      id: 'crew-nitro',
      title: 'Pit Crew Telemetry',
      description: 'Regain +1 Nitro charge (up to vehicle max).',
      effect: 'pit_nitro',
    },
  ],
};
