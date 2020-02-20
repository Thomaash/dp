import { OvertakingArea } from "../api-public";
import { Infrastructure, Route } from "../../infrastructure";

function getOvertakingAreas(infrastructure: Infrastructure): OvertakingArea[] {
  const overtakingAreas = [...infrastructure.itineraries.values()]
    .filter(({ args }): boolean => args.overtaking)
    .filter(({ itineraryID, stations }): boolean => {
      if (stations.length) {
        return true;
      } else {
        throw new Error(
          `No station to faciliate overtaking was found in ${itineraryID}.`
        );
      }
    })
    .map(
      (itinerary): OvertakingArea =>
        Object.freeze({
          entryRoute: itinerary.routes[0],
          exitRoute: itinerary.routes[itinerary.routes.length - 1],
          itinerary,
          next: [],
          previous: [],
          station: itinerary.stations[itinerary.stations.length - 1]
        })
    );

  for (const oa1 of overtakingAreas) {
    const firstVertex = oa1.itinerary.vertexes[0];
    const lastVertex =
      oa1.itinerary.vertexes[oa1.itinerary.vertexes.length - 1];

    for (const oa2 of overtakingAreas) {
      if (oa2.itinerary.vertexes[0] === lastVertex) {
        oa1.next.push(oa2);
      }
      if (
        oa2.itinerary.vertexes[oa2.itinerary.vertexes.length - 1] ===
        firstVertex
      ) {
        oa1.previous.push(oa2);
      }
    }

    Object.freeze(oa1.next);
    Object.freeze(oa1.previous);
  }

  return overtakingAreas;
}

function getOvertakingRouteIDs(
  overtakingAreas: OvertakingArea[]
): ReadonlySet<string> {
  return overtakingAreas
    .flatMap(
      (overtakingArea): readonly Route[] => overtakingArea.itinerary.routes
    )
    .reduce<Set<string>>(
      (acc, route): Set<string> => acc.add(route.routeID),
      new Set()
    );
}

function getOvertakingEntryRouteIDs(
  overtakingAreas: OvertakingArea[]
): ReadonlySet<string> {
  return overtakingAreas.reduce<Set<string>>(
    (acc, overtakingArea): Set<string> =>
      acc.add(overtakingArea.entryRoute.routeID),
    new Set()
  );
}

function getOvertakingExitRouteIDs(
  overtakingAreas: OvertakingArea[]
): ReadonlySet<string> {
  return overtakingAreas.reduce<Set<string>>(
    (acc, overtakingArea): Set<string> =>
      acc.add(overtakingArea.exitRoute.routeID),
    new Set()
  );
}

export interface OvertakingData {
  overtakingAreas: OvertakingArea[];
  overtakingEntryRouteIDs: ReadonlySet<string>;
  overtakingExitRouteIDs: ReadonlySet<string>;
  overtakingRouteIDs: ReadonlySet<string>;
}

export function getOvertakingData(
  infrastructure: Infrastructure
): OvertakingData {
  const overtakingAreas = getOvertakingAreas(infrastructure);

  const overtakingEntryRouteIDs = getOvertakingEntryRouteIDs(overtakingAreas);
  const overtakingExitRouteIDs = getOvertakingExitRouteIDs(overtakingAreas);
  const overtakingRouteIDs = getOvertakingRouteIDs(overtakingAreas);

  return Object.freeze<OvertakingData>({
    overtakingAreas,
    overtakingEntryRouteIDs,
    overtakingExitRouteIDs,
    overtakingRouteIDs
  });
}
