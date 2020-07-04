import { expect } from "chai";
import { CurryLog } from "../curry-log";
import { Route, Itinerary, Train } from "./types";
import { MapCounter } from "../util";

export function ck(...rest: (boolean | number | string)[]): string {
  return JSON.stringify(rest);
}
export function xmlVertexCK(vertex: any): string {
  return ck(vertex.$.documentname, vertex.$.id);
}

export function filterChildren(xmlElement: any, ...names: string[]): any[] {
  return ((xmlElement.$$ as any[]) || []).filter((child): boolean =>
    names.includes(child["#name"])
  );
}

function id(
  documentname: string,
  numbericId: number | string,
  name: string
): string;
function id(...rest: (number | string)[]): string {
  return rest.join("-");
}

export function idFromXML(xmlElement: any): string {
  return id(xmlElement.$.documentname, xmlElement.$.id, xmlElement.$.name);
}

export class OTDate {
  public readonly day: number;
  public readonly hours: number;
  public readonly minutes: number;
  public readonly seconds: number;

  public readonly time: number;

  public readonly stringDay: string;
  public readonly stringTime: string;

  public constructor(stringDay: string | null | undefined, stringTime: string) {
    this.stringDay = stringDay ?? "0";
    this.stringTime = stringTime;

    expect(this.stringDay, "Invalid day format").to.match(/^\d+/);
    expect(this.stringTime, "Invalid time format").to.match(
      /^\d{2}:\d{2}:\d{2}(\.\d+)?$/
    );

    this.day = +this.stringDay;

    const [hours, minutes, seconds] = this.stringTime.split(":");
    this.hours = +hours;
    this.minutes = +minutes;
    this.seconds = +seconds;

    this.time =
      this.day * 86400 +
      this.hours * 3600 +
      this.minutes * 60 +
      this.seconds * 1;

    Object.freeze(this);
  }
}

const units = {
  second: 1,
  minute: 60,
  hour: 60 * 60,
  day: 60 * 60 * 24,
  month: 60 * 60 * 24 * (365.2425 / 12),
  year: 60 * 60 * 24 * 365.2425,
};
export function parseDuration(log: CurryLog, dwellTime: string): number {
  const [
    ,
    ,
    years = 0,
    ,
    months = 0,
    ,
    days = 0,
    ,
    hours = 0,
    ,
    minutes = 0,
    ,
    seconds = 0,
  ] =
    /^P((\d+)Y)?((\d+)M)?((\d+)D)?T((\d+)H)?((\d+)M)?((\d+|\d*\.\d+)S)?$/i.exec(
      dwellTime
    ) ?? [];

  if (years !== 0 || months !== 0) {
    log.warn(
      "The implementation of years and months for time durations is most likely wrong."
    );
  }

  return (
    +seconds +
    +minutes * units.minute +
    +hours * units.hour +
    +days * units.day +
    +months * units.month +
    +years * units.year
  );
}

export function throwIfNotUniqe(
  values: Iterable<unknown>,
  msg = "Expected all values to be unique"
): void {
  const dupes = new MapCounter(values);

  dupes.dropEmpty();
  for (const counter of dupes.values()) {
    counter.dec();
  }
  dupes.dropEmpty();

  if (dupes.size) {
    throw new Error(msg + ": " + JSON.stringify([...dupes.keys()]));
  }
}

export function getOutflowRoutes(startRoute: Route, minLength = 0): Set<Route> {
  const outflowRoutes = new Set<Route>();

  const directOutflowRoutes =
    startRoute.vertexes[startRoute.vertexes.length - 1].outflowRoutes;
  for (const outflowRoute of directOutflowRoutes) {
    outflowRoutes.add(outflowRoute);
    const remainingLength = minLength - outflowRoute.length;
    if (remainingLength > 0) {
      for (const or of getOutflowRoutes(outflowRoute, remainingLength)) {
        outflowRoutes.add(or);
      }
    }
  }

  return outflowRoutes;
}

/**
 * Verify that given secondary itinerary can be used in conjuction with the
 * primary one.
 *
 * @remarks
 * At the moment it checks only if the train can leave the primary itinerary and
 * return to it from the secondary one.
 *
 * @param primary - The primary (1st) itinerary of a train.
 * @param secondary - The secondary (2nd or more-th) itinerary of a train.
 *
 * @returns False if problems were found, true if it seems okay.
 */
export function checkSecondaryItinerary(
  primary: Itinerary,
  secondary: Itinerary
): { canEnter: boolean; canExit: boolean } {
  const entryVertex = secondary.vertexes[0];
  const canEnter = primary.vertexes.includes(entryVertex);

  const exitVertex = secondary.vertexes[secondary.vertexes.length - 1];
  const canExit = primary.vertexes.includes(exitVertex);

  return {
    canEnter,
    canExit,
  };
}

/**
 * Verify that given train has itineraries that can be used in conjuction with
 * one another.
 *
 * @remarks
 * At the moment it checks only if the train can leave the primary itinerary and
 * return to it from all the secondary ones.
 *
 * @param train - The train to be checked.
 *
 * @returns False if problems were found, true if it seems okay.
 */
export function checkTrainItineraries(
  train: Train
): Map<Itinerary, { canEnter: boolean; canExit: boolean }> {
  const results = new Map<Itinerary, { canEnter: boolean; canExit: boolean }>();

  const primary = train.mainItinerary;
  for (const itinerary of train.itineraries) {
    const result = checkSecondaryItinerary(primary, itinerary);
    if (Object.values(result).some((value): boolean => !value)) {
      results.set(itinerary, result);
    }
  }

  return results;
}
