import { OvertakingArea } from "../api-public";
import { Infrastructure, Route, Vertex, Itinerary } from "../../infrastructure";
import { MapSets, RW } from "../../util";
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
    ([exitVertex, itineraries]): RW<OvertakingArea> => {
      const someItinerary = [...itineraries.values()][0];
      expect(
        someItinerary,
        "This is a bug in the app. If you see this report it and include the stack trace, please."
      ).to.exist;

      const station = someItinerary.stations[someItinerary.stations.length - 1];
      for (const itinerary of itineraries) {
        expect(
          itinerary.stations[itinerary.stations.length - 1],
          "All overtaking itineraries in the same overtaking area have to go through the same final station."
        ).to.equal(station);
      }

      const routes = new Set<Route>(
        [...itineraries.values()].flatMap(
          (itinerary): readonly Route[] => itinerary.routes
        )
      );

      const overtakingArea: RW<OvertakingArea> = {
        overtakingAreaID: [...itineraries.values()]
          .map((itinerary): string => itinerary.itineraryID.split(" --", 1)[0])
          .join(" + "),
        entryVertexes: new Set<Vertex>(
          [...itineraries.values()].map(
            (itinerary): Vertex => itinerary.vertexes[0]
          )
        ),
        exitVertex,
        exitRoutes: new Set<Route>(
          [...itineraries.values()].map(
            (itinerary): Route => itinerary.routes[itinerary.routes.length - 1]
          )
        ),
        routes: new Set<Route>(
          [...itineraries.values()].flatMap(
            (itinerary): readonly Route[] => itinerary.routes
          )
        ),
        inflowStations: new Set<Station>(
          [...routes.values()]
            .flatMap((route): readonly Station[] => route.stations)
            .filter((inflowStation): boolean => inflowStation !== station)
        ),
        itineraries,
        next: new Set(),
        previous: new Set(),
        station
      };
      Object.freeze(overtakingArea);
      return overtakingArea;
    }
  );

  for (const oa1 of overtakingAreas) {
    for (const oa2 of overtakingAreas) {
      if (oa1.entryVertexes.has(oa2.exitVertex)) {
        oa1.previous.add(oa2);
      }
      if (oa2.entryVertexes.has(oa1.exitVertex)) {
        oa1.next.add(oa2);
      }
    }
  }

  return overtakingAreas;
}

export interface OvertakingData {
  overtakingAreas: OvertakingArea[];
}

export function getOvertakingData(
  infrastructure: Infrastructure
): OvertakingData {
  const overtakingAreas = getOvertakingAreas(infrastructure);

  return Object.freeze<OvertakingData>({ overtakingAreas });
}
