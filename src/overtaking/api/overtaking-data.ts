import { OvertakingArea } from "../api-public";
import {
  Infrastructure,
  Route,
  Vertex,
  Itinerary,
  Station
} from "../../infrastructure";
import { MapSet, MapMapSet, Bug } from "../../util";
import { expect } from "chai";

function getOvertakingAreas(infrastructure: Infrastructure): OvertakingArea[] {
  const overtakingItiniraries = [...infrastructure.itineraries.values()]
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
    .filter(({ itineraryID, vertexes }): boolean => {
      if (vertexes.length) {
        return true;
      } else {
        throw new Error(`No vertexes were found in ${itineraryID}.`);
      }
    })
    .reduce<MapSet<Vertex, Itinerary>>((acc, itinerary): MapSet<
      Vertex,
      Itinerary
    > => {
      acc.get(itinerary.vertexes[itinerary.vertexes.length - 1]).add(itinerary);

      return acc;
    }, new MapSet());

  const overtakingAreas = [...overtakingItiniraries.entries()].map(
    ([exitVertex, itineraries]): OvertakingArea => {
      const someItinerary = [...itineraries.values()][0];
      if (someItinerary == null) {
        throw new Bug(
          "Impossible happend: " +
            "An overtaking area without itineraries was found."
        );
      }

      const outflowStation =
        someItinerary.stations[someItinerary.stations.length - 1];
      for (const itinerary of itineraries) {
        expect(
          itinerary.stations[itinerary.stations.length - 1],
          "All overtaking itineraries in the same overtaking area have to go through the same final station."
        ).to.equal(outflowStation);
      }

      const entryRoutes = new Set<Route>(
        [...itineraries.values()].flatMap(
          (itinerary): readonly Route[] => itinerary.routes
        )
      );

      const overtakingAreaID = [...itineraries.values()]
        .map((itinerary): string => itinerary.itineraryID.split(" --", 1)[0])
        .join(" + ");
      const areaID = overtakingAreaID;

      const entryVertexes = new Set<Vertex>(
        [...itineraries.values()].map(
          (itinerary): Vertex => itinerary.vertexes[0]
        )
      );

      const exitRoutes = new Set<Route>(
        [...itineraries.values()].map(
          (itinerary): Route => itinerary.routes[itinerary.routes.length - 1]
        )
      );

      const stations = new Set<Station>(
        [...entryRoutes.values()].flatMap(
          (route): readonly Station[] => route.stations
        )
      );

      const stationAreas = new Set<Station>(
        [...entryRoutes.values()].flatMap(
          (route): readonly Station[] => route.stationAreas
        )
      );

      const inflowStations = new Set<Station>(
        [...stations.values()].filter(
          (inflowStation): boolean => inflowStation !== outflowStation
        )
      );

      const routes = new Set<Route>([
        ...entryRoutes.values(),
        ...[...stations.values()].flatMap((station): readonly Route[] =>
          [...infrastructure.routes.values()].filter((route): boolean =>
            route.stations.includes(station)
          )
        )
      ]);

      return Object.freeze<OvertakingArea>({
        areaID,
        entryRoutes,
        entryVertexes,
        exitRoutes,
        exitVertex,
        inflowStations,
        itineraries,
        leaveOnlyAfterDepartureFromStation: true,
        outflowStation,
        overtakingAreaID,
        routes,
        stationAreas,
        stations
      });
    }
  );

  return overtakingAreas;
}

/**
 * Mapped as inflow station -> overtaking station -> overtaking areas.
 */
export type OvertakingAreasByStation = MapSet<Station, OvertakingArea>;

/**
 * Mapped as inflow station -> overtaking station -> overtaking areas.
 */
export type OvertakingAreasByStations = MapMapSet<
  Station | null,
  Station,
  OvertakingArea
>;

function getOvertakingAreasByStation(
  overtakingAreas: readonly OvertakingArea[]
): OvertakingAreasByStation {
  const overtakingAreasByStation: OvertakingAreasByStation = new MapSet();

  for (const oa of overtakingAreas) {
    overtakingAreasByStation.get(oa.outflowStation).add(oa);
  }

  return overtakingAreasByStation;
}

function getOvertakingAreasByStations(
  overtakingAreas: readonly OvertakingArea[]
): OvertakingAreasByStations {
  const overtakingAreasByStations: OvertakingAreasByStations = new MapMapSet();

  for (const oa of overtakingAreas) {
    const finalStation = oa.outflowStation;

    for (const inflowStation of oa.inflowStations) {
      overtakingAreasByStations
        .get(inflowStation)
        .get(finalStation)
        .add(oa);
    }
  }

  return overtakingAreasByStations;
}

export interface OvertakingData {
  overtakingAreas: OvertakingArea[];
  overtakingAreasByStation: OvertakingAreasByStation;
  overtakingAreasByStations: OvertakingAreasByStations;
}

export function getOvertakingData(
  infrastructure: Infrastructure
): OvertakingData {
  const overtakingAreas = getOvertakingAreas(infrastructure);
  const overtakingAreasByStations = getOvertakingAreasByStations(
    overtakingAreas
  );
  const overtakingAreasByStation = getOvertakingAreasByStation(overtakingAreas);

  return Object.freeze<OvertakingData>({
    overtakingAreas,
    overtakingAreasByStation,
    overtakingAreasByStations
  });
}
