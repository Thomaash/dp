import xml2js from "xml2js";
import { expect } from "chai";

import { ck, filterChildren, idFromXML, xmlVertexCK, OTDate } from "./common";
import {
  InfrastructureData,
  Itinerary,
  Path,
  Route,
  Train,
  Station,
  Timetable,
  TimetableEntry
} from "./types";
import { parseItineraryArgs } from "./args";

export interface ParseInfrastructureXML {
  courses: string;
  infrastructure: string;
  rollingStock: string;
  timetables: string;
}

interface StationsReduceAcc {
  stations: Map<string, Station>;
  stationsByOCPID: Map<string, Station>;
}

export async function parseInfrastructure(
  xml: ParseInfrastructureXML
): Promise<InfrastructureData> {
  const xmlParser = new xml2js.Parser({
    explicitChildren: true,
    preserveChildrenOrder: true
  });

  // XML Documents {{{

  const xmlCoursesDocument = await xmlParser.parseStringPromise(xml.courses);
  const xmlInfrastructureDocument = await xmlParser.parseStringPromise(
    xml.infrastructure
  );
  const xmlRollingStockDocument = await xmlParser.parseStringPromise(
    xml.rollingStock
  );
  const xmlTimetablesDocument = await xmlParser.parseStringPromise(
    xml.timetables
  );

  // }}}
  // Vehicle max speeds {{{

  const xmlVehicles: any[] =
    xmlRollingStockDocument["railml"]["rollingstock"][0]["vehicles"][0][
      "vehicle"
    ];
  const vehicleMaxSpeeds = xmlVehicles.reduce<Map<string, number>>(
    (acc, xmlVehicle): Map<string, number> => {
      acc.set(xmlVehicle.$.id, +xmlVehicle.$.speed);
      return acc;
    },
    new Map()
  );

  // }}}
  // Formation max speeds {{{

  const xmlFormations: any[] =
    xmlRollingStockDocument["railml"]["rollingstock"][0]["formations"][0][
      "formation"
    ];
  const formationMaxSpeeds = xmlFormations.reduce<Map<string, number>>(
    (acc, xmlFormation): Map<string, number> => {
      const refs: any[] = xmlFormation["trainOrder"][0]["vehicleRef"];
      const maxSpeeds = refs.map((ref): any => {
        const vehicleID = ref.$.vehicleRef;
        const vehicleMaxSpeed = vehicleMaxSpeeds.get(vehicleID);

        if (vehicleMaxSpeed == null) {
          throw new Error(`Can't find max speed for vehicle ${vehicleID}.`);
        }

        return vehicleMaxSpeed;
      });
      const maxSpeed = Math.min(...maxSpeeds);

      acc.set(xmlFormation.$.name, maxSpeed);
      return acc;
    },
    new Map()
  );

  // }}}
  // Neighbor compound keys {{{

  const xmlVertexes: any[] = filterChildren(
    xmlInfrastructureDocument["trafIT"]["vertices"][0],
    "vertex",
    "stationvertex"
  );
  const vertexNeighborCK = xmlVertexes.reduce<Map<string, string>>(
    (acc, xmlVertex): Map<string, string> => {
      acc.set(
        ck(xmlVertex.$.documentname, xmlVertex.$.id),
        ck(
          xmlVertex.$.neighbourdocumentname || xmlVertex.$.documentname,
          xmlVertex.$.neighbourid
        )
      );
      return acc;
    },
    new Map()
  );
  expect(
    vertexNeighborCK,
    "There should be a neighbor for each vertex"
  ).to.have.lengthOf(xmlVertexes.length);

  // }}}
  // Vertex to vertex distances {{{

  const xmlEdges: any[] =
    xmlInfrastructureDocument["trafIT"]["edges"][0]["edge"];
  const vertexToVertexDistances = xmlEdges.reduce<Map<string, number>>(
    (acc, xmlEdge): Map<string, number> => {
      const id1 = ck(xmlEdge.$.documentname, xmlEdge.$.vertex1);
      const id2 = ck(xmlEdge.$.documentname, xmlEdge.$.vertex2);
      const length = +xmlEdge.$.length;

      acc.set(ck(id1, id2), length);
      acc.set(ck(id2, id1), length);

      return acc;
    },
    new Map<string, number>()
  );
  expect(
    vertexToVertexDistances,
    "Each edge has to have and entry in both directions"
  ).to.have.lengthOf(xmlEdges.length * 2);

  // }}}
  // Stations {{{

  const xmlOperationControlPoints: any[] = filterChildren(
    xmlTimetablesDocument["railml"]["infrastructure"][0][
      "operationControlPoints"
    ][0],
    "ocp"
  );
  const { stations, stationsByOCPID } = xmlOperationControlPoints.reduce<
    StationsReduceAcc
  >(
    (acc, xmlOCP): StationsReduceAcc => {
      const stationID = xmlOCP.$.code;
      const ocpID = xmlOCP.$.id;
      const name = xmlOCP.$.name;

      const station = Object.freeze({ name, stationID });

      acc.stations.set(stationID, station);
      acc.stationsByOCPID.set(ocpID, station);

      return acc;
    },
    { stations: new Map(), stationsByOCPID: new Map() }
  );

  // }}}
  // Timetables {{{

  const xmlTrainParts: any[] = filterChildren(
    xmlTimetablesDocument["railml"]["timetable"][0]["trainParts"][0],
    "trainPart"
  );
  const timetables = xmlTrainParts.reduce<Map<string, Timetable>>(
    (acc, xmlTrainPart): Map<string, Timetable> => {
      const trainID = xmlTrainPart.$.trainNumber;

      const entries = (xmlTrainPart["ocpsTT"][0]["ocpTT"] as any[]).map(
        (xmlOCPTT): TimetableEntry => {
          const ocpRef = xmlOCPTT.$.ocpRef;

          const type: "pass" | "stop" = xmlOCPTT.$.ocpType;
          expect(type, "Unknown timetable entry type").to.match(
            /^(pass|stop)$/
          );

          const scheduled = (xmlOCPTT["times"] as any[]).filter(
            ({ $ }): boolean => $.scope === "scheduled"
          )[0];
          const calculated = (xmlOCPTT["times"] as any[]).filter(
            ({ $ }): boolean => $.scope === "calculated"
          )[0];

          const xmlTimes = scheduled ?? calculated ?? { $: {} };

          const arrival = xmlTimes.$.arrival
            ? new OTDate(xmlTimes.$.arrivalDay, xmlTimes.$.arrival).time
            : undefined;
          const departure = xmlTimes.$.departure
            ? new OTDate(xmlTimes.$.departureDay, xmlTimes.$.departure).time
            : undefined;

          const station = stationsByOCPID.get(ocpRef);
          if (station == null) {
            throw new Error(
              `Can't find any station by ${ocpRef} id referenced by the timetable for ${trainID}.`
            );
          }

          return Object.freeze({ arrival, departure, station, type });
        }
      );

      return acc.set(trainID, Object.freeze({ entries, trainID }));
    },
    new Map()
  );

  // }}}
  // Routes {{{

  const xmlRoutes: any[] =
    xmlInfrastructureDocument["trafIT"]["routes"][0]["route"];
  const routeNames = new Set(
    xmlRoutes.map((xmlRoute): string => idFromXML(xmlRoute))
  );
  expect(routeNames, "All route names have to be unique").have.lengthOf(
    xmlRoutes.length
  );
  const routes = xmlRoutes.reduce<Map<string, Route>>((acc, xmlRoute): Map<
    string,
    Route
  > => {
    const routeID = idFromXML(xmlRoute);

    acc.set(
      routeID,
      Object.freeze({
        length: filterChildren(xmlRoute, "vertex", "stationvertex").reduce<
          number
        >((acc, vertex2, i, arr): number => {
          if (i === 0) {
            return acc;
          }

          const id1 = xmlVertexCK(vertex2);
          const id2 = vertexNeighborCK.get(xmlVertexCK(arr[i - 1]));
          if (id2 == null) {
            throw new Error(`Can't find neighbor vertex of ${id1}.`);
          }

          const distance = vertexToVertexDistances.get(ck(id1, id2));
          if (distance == null) {
            throw new Error(
              `Can't find distance between vertexes ${id1} and ${id2}.`
            );
          }

          return acc + distance;
        }, 0),
        stations: filterChildren(xmlRoute, "stationvertex").map(
          (stationVertex): Station => {
            const stationID = stationVertex.$.station;

            const station = stations.get(stationID);
            if (station == null) {
              throw new Error(`Can't find any station called ${stationID}.`);
            }

            return station;
          }
        ),
        routeID
      })
    );

    return acc;
  }, new Map());

  const routesLength = [...routes.values()].reduce<number>(
    (acc, route): number => acc + route.length,
    0
  );

  // }}}
  // Paths {{{

  const xmlPaths: any[] =
    xmlInfrastructureDocument["trafIT"]["paths"][0]["path"];
  const pathNames = new Set(
    xmlPaths.map((xmlPath): string => idFromXML(xmlPath))
  );
  expect(pathNames, "All path names have to be unique").have.lengthOf(
    xmlPaths.length
  );
  const paths = xmlPaths.reduce<Map<string, Path>>((acc, xmlPath): Map<
    string,
    Path
  > => {
    const pathID = idFromXML(xmlPath);

    const pathRoutes = Object.freeze(
      (xmlPath["route"] as any[]).map(
        (xmlRoute): Route => {
          const routeID = idFromXML(xmlRoute);
          const route = routes.get(routeID);

          if (route != null) {
            return route;
          } else {
            throw new Error(`There is no route called ${routeID}.`);
          }
        }
      )
    );

    acc.set(
      pathID,
      Object.freeze({
        length: pathRoutes.reduce<number>(
          (acc, route): number => acc + route.length,
          0
        ),
        pathID,
        routes: pathRoutes,
        stations: pathRoutes.flatMap(
          (route): readonly Station[] => route.stations
        )
      })
    );

    return acc;
  }, new Map());

  const pathsLength = [...paths.values()].reduce<number>(
    (acc, path): number => acc + path.length,
    0
  );

  // }}}
  // Itineraries {{{

  const xmlItineraries: any[] =
    xmlInfrastructureDocument["trafIT"]["itineraries"][0]["itinerary"];
  const itineraries = xmlItineraries.reduce<Map<string, Itinerary>>(
    (acc, xmlItinerary): Map<string, Itinerary> => {
      const itineraryID = xmlItinerary.$.name;

      const itineraryPaths = Object.freeze(
        filterChildren(xmlItinerary, "path").map(
          (xmlPath): Path => {
            const pathID = idFromXML(xmlPath);

            const path = paths.get(pathID);
            if (path == null) {
              throw new Error(
                `Can't find path named ${pathID} that is a part of the itinerary ${itineraryID}.`
              );
            }

            return path;
          }
        )
      );
      const itineraryRoutes = Object.freeze(
        itineraryPaths.flatMap((path): readonly Route[] => path.routes)
      );
      const length = itineraryPaths.reduce((acc, path): number => {
        return acc + path.length;
      }, 0);

      const args = Object.freeze(parseItineraryArgs(itineraryID));

      acc.set(
        itineraryID,
        Object.freeze({
          args,
          itineraryID,
          length,
          paths: itineraryPaths,
          routes: itineraryRoutes,
          stations: itineraryPaths.flatMap(
            (path): readonly Station[] => path.stations
          )
        })
      );

      return acc;
    },
    new Map()
  );

  const itinerariesLength = [...itineraries.values()].reduce<number>(
    (acc, itinerary): number => acc + itinerary.length,
    0
  );

  // }}}
  // Trains {{{

  const xmlCourses: any[] =
    xmlCoursesDocument["trafIT"]["courses"][0]["course"];
  const trains = xmlCourses.reduce<Map<string, Train>>((acc, xmlCourse): Map<
    string,
    Train
  > => {
    const trainID = xmlCourse.$.courseID;

    const trainItineraries = Object.freeze(
      filterChildren(xmlCourse, "itinerary")
        .sort(
          (xmlItineraryA, xmlItineraryB): number =>
            xmlItineraryA.$.priority - xmlItineraryB.$.priority
        )
        .map(
          (xmlItinerary): Itinerary => {
            const itineraryID = xmlItinerary.$.name;

            const itinerary = itineraries.get(itineraryID);
            if (itinerary == null) {
              throw new Error(
                `Can't find itinerary named ${itineraryID} from the train ${trainID}.`
              );
            }

            return itinerary;
          }
        )
    );

    const trainPaths = trainItineraries
      .flatMap((itinerary): readonly Path[] => itinerary.paths)
      .reduce<Set<Path>>((acc, path): Set<Path> => acc.add(path), new Set());

    const trainRoutes = trainItineraries
      .flatMap((itinerary): readonly Route[] => itinerary.routes)
      .reduce<Set<Route>>(
        (acc, route): Set<Route> => acc.add(route),
        new Set()
      );

    const maxSpeed = formationMaxSpeeds.get(xmlCourse.$.train);
    if (maxSpeed == null) {
      throw new Error(`Can't find max speed for train ${trainID}.`);
    }

    if (!timetables.has(trainID)) {
      console.warn(
        `Can't find any timetable for train ${trainID}. Empty one was created.`
      );
      timetables.set(trainID, Object.freeze({ entries: [], trainID }));
    }
    const timetable = timetables.get(trainID)!;

    acc.set(
      trainID,
      Object.freeze({
        itineraries: trainItineraries,
        mainItinerary: trainItineraries[0],
        maxSpeed,
        paths: trainPaths,
        routes: trainRoutes,
        timetable,
        trainID
      })
    );

    return acc;
  }, new Map());

  const mainItineraries = new Set<Itinerary>(
    [...trains.values()].map((train): Itinerary => train.mainItinerary)
  );

  // }}}

  return Object.freeze({
    itineraries,
    itinerariesLength,
    mainItineraries,
    paths,
    pathsLength,
    routes,
    routesLength,
    stations,
    timetables,
    trains
  });
}

// vim:fdm=marker
