export interface EventPayloads {
  test: {}; // TODO: Delete this!

  simReadyForSimulation: {};
  simServerStarted: {};
}

export type EventNames = keyof EventPayloads;
