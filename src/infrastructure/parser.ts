import xml2js from "xml2js";
import { expect } from "chai";

import { CurryLog } from "../curry-log";
import {
  OTDate,
  checkTrainItineraries,
  ck,
  filterChildren,
  getOutflowRoutes,
  idFromXML,
  parseDuration,
  throwIfNotUniqe,
  xmlVertexCK,
} from "./common";
import {
  Formation,
  InfrastructureData,
  Itinerary,
  ItineraryArgs,
  Path,
  Route,
  Station,
  Timetable,
  TimetableEntry,
  Train,
  Vehicle,
  Vertex,
} from "./types";
import { parseItineraryArgs } from "./args";

export interface ParseInfrastructureXML {
  courses: string;
  infrastructure: string;
  rollingStock: string;
  timetables: string;
}

interface StationsReduceAcc {
  stationInflowRoutes: Map<Station, Set<Route>>;
  stationOutflowRoutes: Map<Station, Set<Route>>;
  stations: Map<string, Station>;
  stationsByOCPID: Map<string, Station>;
}

export interface TempVertex {
  readonly inflowRoutes: Set<Route>;
  readonly name: string;
  readonly neighborVertexID: string;
  readonly outflowRoutes: Set<Route>;
  readonly vertexID: string;
}

export async function parseInfrastructure(
  log: CurryLog,
  xml: ParseInfrastructureXML
): Promise<InfrastructureData> {
  const xmlParser = new xml2js.Parser({
    explicitChildren: true,
    preserveChildrenOrder: true,
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
  const vehicles = xmlVehicles.reduce<Map<string, Vehicle>>(
    (acc, xmlVehicle): Map<string, Vehicle> => {
      const vehicleID = xmlVehicle.$.id;
      const maxSpeed = +xmlVehicle.$.speed;
      const length = +xmlVehicle.$.length;

      return acc.set(
        vehicleID,
        Object.freeze<Vehicle>({ length, maxSpeed, vehicleID })
      );
    },
    new Map()
  );

  // }}}
  // Formations {{{

  const xmlFormations: any[] =
    xmlRollingStockDocument["railml"]["rollingstock"][0]["formations"][0][
      "formation"
    ];
  const formations = xmlFormations.reduce<Map<string, Formation>>(
    (acc, xmlFormation): Map<string, Formation> => {
      const formationID = xmlFormation.$.name;

      const xmlRefs: any[] = xmlFormation["trainOrder"][0]["vehicleRef"];
      const vehicleIDs = xmlRefs.map((xmlRef): string => xmlRef.$.vehicleRef);

      const length = vehicleIDs.reduce<number>((acc, vehicleID): number => {
        const vehicleLength = vehicles.get(vehicleID)?.length;

        if (vehicleLength == null) {
          throw new Error(`Can't find the length of vehicle ${vehicleID}.`);
        }

        return acc + vehicleLength;
      }, 0);

      const maxSpeed = vehicleIDs.reduce<number>((acc, vehicleID): number => {
        const vehicleMaxSpeed = vehicles.get(vehicleID)?.maxSpeed;

        if (vehicleMaxSpeed == null) {
          throw new Error(`Can't find max speed for vehicle ${vehicleID}.`);
        }

        return Math.min(acc, vehicleMaxSpeed);
      }, Number.POSITIVE_INFINITY);

      return acc.set(
        formationID,
        Object.freeze<Formation>({
          formationID,
          length,
          maxSpeed,
        })
      );
    },
    new Map()
  );

  // }}}
  // Vertexes {{{

  const xmlVertexes: any[] = filterChildren(
    xmlInfrastructureDocument["trafIT"]["vertices"][0],
    "vertex",
    "stationvertex"
  );
  const tempVertexes = xmlVertexes.reduce<Map<string, TempVertex>>(
    (acc, xmlVertex): Map<string, TempVertex> => {
      const vertexID = ck(xmlVertex.$.documentname, xmlVertex.$.id);
      const neighborVertexID = ck(
        xmlVertex.$.neighbourdocumentname ?? xmlVertex.$.documentname,
        xmlVertex.$.neighbourid
      );
      const name = xmlVertex.$.name;

      const inflowRoutes = new Set<Route>();
      const outflowRoutes = new Set<Route>();

      return acc.set(vertexID, {
        inflowRoutes,
        name,
        neighborVertexID,
        outflowRoutes,
        vertexID,
      });
    },
    new Map()
  );

  const vertexes = new Map<
    string,
    { -readonly [Key in keyof Vertex]: Vertex[Key] }
  >();
  for (const {
    inflowRoutes,
    name,
    outflowRoutes,
    vertexID,
  } of tempVertexes.values()) {
    vertexes.set(vertexID, {
      inflowRoutes,
      name,
      neighborVertex: null as any,
      outflowRoutes,
      vertexID,
    });
  }
  for (const tempVertex of tempVertexes.values()) {
    const vertex = vertexes.get(tempVertex.vertexID);
    const neighborVertex = vertexes.get(tempVertex.neighborVertexID);

    if (vertex == null || neighborVertex == null) {
      throw new Error(
        `Cannot create a vertex pair for ${tempVertex.vertexID} and ${tempVertex.neighborVertexID}.`
      );
    }

    vertex.neighborVertex = neighborVertex;
    Object.freeze(vertex);
  }

  // }}}
  // Neighbor compound keys {{{

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
  const {
    stationInflowRoutes,
    stationOutflowRoutes,
    stations,
    stationsByOCPID,
  } = xmlOperationControlPoints.reduce<StationsReduceAcc>(
    (acc, xmlOCP): StationsReduceAcc => {
      const stationID: string = xmlOCP.$.code;
      const ocpID: string = xmlOCP.$.id;
      const name: string = xmlOCP.$.name;

      const inflowRoutes = new Set<Route>();
      const outflowRoutes = new Set<Route>();

      const station = Object.freeze<Station>({
        inflowRoutes,
        name,
        outflowRoutes,
        stationID,
      });

      acc.stationInflowRoutes.set(station, inflowRoutes);
      acc.stationOutflowRoutes.set(station, outflowRoutes);
      acc.stations.set(stationID, station);
      acc.stationsByOCPID.set(ocpID, station);

      return acc;
    },
    {
      stationInflowRoutes: new Map(),
      stationOutflowRoutes: new Map(),
      stations: new Map(),
      stationsByOCPID: new Map(),
    }
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

          const minimalDwellTime = parseDuration(
            log,
            xmlOCPTT?.["stopDescription"]?.[0]?.["stopTimes"]?.[0]?.$
              ?.minimalTime ?? "PT0S"
          );

          const plannedDwellTime = Math.max(
            minimalDwellTime,
            typeof arrival !== "undefined" && typeof departure !== "undefined"
              ? departure - arrival
              : 0
          );

          const station = stationsByOCPID.get(ocpRef);
          if (station == null) {
            throw new Error(
              `Can't find any station by ${ocpRef} id referenced by the timetable for ${trainID}.`
            );
          }

          return Object.freeze<TimetableEntry>({
            arrival,
            departure,
            minimalDwellTime,
            plannedDwellTime,
            station,
            type,
          });
        }
      );

      return acc.set(
        trainID,
        Object.freeze<Timetable>({ entries, trainID })
      );
    },
    new Map()
  );

  // }}}
  // Routes {{{

  const xmlRoutes: any[] =
    xmlInfrastructureDocument["trafIT"]["routes"][0]["route"];
  throwIfNotUniqe(
    xmlRoutes.map((xmlRoute): string => idFromXML(xmlRoute)),
    "All route names have to be unique"
  );
  const routes = xmlRoutes.reduce<Map<string, Route>>((acc, xmlRoute): Map<
    string,
    Route
  > => {
    const routeID = idFromXML(xmlRoute);

    const routeVertexes = filterChildren(
      xmlRoute,
      "vertex",
      "stationvertex"
    ).map(
      (xmlVertex): Vertex => {
        const vertexID = xmlVertexCK(xmlVertex);
        const vertex = vertexes.get(vertexID);
        if (vertex == null) {
          throw new Error(`Can't find a vertex called ${vertexID}.`);
        }

        return vertex;
      }
    );

    const route = Object.freeze<Route>({
      vertexes: routeVertexes,
      length: routeVertexes.reduce<number>((acc, vertex2, i, arr): number => {
        if (i === 0) {
          return acc;
        }

        const vertex1 = arr[i - 1];

        const distance = vertexToVertexDistances.get(
          ck(vertex2.vertexID, vertex1.neighborVertex.vertexID)
        );
        if (distance == null) {
          throw new Error(
            `Can't find distance between vertexes ${vertex2.vertexID} and ${vertex1.neighborVertex.vertexID}.`
          );
        }

        return acc + distance;
      }, 0),
      stationAreas: filterChildren(xmlRoute, "vertex", "stationvertex")
        .filter((xmlVertex): boolean => xmlVertex.$.station !== "")
        .map(
          (xmlVertex): Station => {
            const stationID = xmlVertex.$.station;

            const station = stations.get(stationID);
            if (station == null) {
              throw new Error(`Can't find any station called ${stationID}.`);
            }

            return station;
          }
        ),
      stations: filterChildren(xmlRoute, "stationvertex").map(
        (xmlStationVertex): Station => {
          const stationID = xmlStationVertex.$.station;

          const station = stations.get(stationID);
          if (station == null) {
            throw new Error(`Can't find any station called ${stationID}.`);
          }

          return station;
        }
      ),
      routeID,
    });

    const entryTempVertex = tempVertexes.get(route.vertexes[0].vertexID);
    if (entryTempVertex == null) {
      throw new Error(`Can't find the entry vertex of ${route.routeID}.`);
    }
    entryTempVertex.outflowRoutes.add(route);

    const exitTempVertex = tempVertexes.get(
      route.vertexes[route.vertexes.length - 1].vertexID
    );
    if (exitTempVertex == null) {
      throw new Error(`Can't find the exit vertex of ${route.routeID}.`);
    }
    exitTempVertex.inflowRoutes.add(route);

    return acc.set(routeID, route);
  }, new Map());

  const routesLength = [...routes.values()].reduce<number>(
    (acc, route): number => acc + route.length,
    0
  );

  // }}}
  // Station inflow and outflow routes {{{

  for (const route of routes.values()) {
    const station = route.stations[0];
    if (station == null) {
      // No station on this route.
      continue;
    }

    const inflowRoutes = stationInflowRoutes.get(station);
    if (inflowRoutes == null) {
      throw new Error(
        `Can't find inflow routes for station ${station.stationID}.`
      );
    }
    for (const inflowRoute of route.vertexes[0].inflowRoutes) {
      inflowRoutes.add(inflowRoute);
    }
  }

  for (const route of routes.values()) {
    const station = route.stations[route.stations.length - 1];
    if (station == null) {
      // No station on this route.
      continue;
    }

    const outflowRoutes = stationOutflowRoutes.get(station);
    if (outflowRoutes == null) {
      throw new Error(
        `Can't find outflow routes for station ${station.stationID}.`
      );
    }
    for (const outflowRoute of getOutflowRoutes(route, 1000)) {
      outflowRoutes.add(outflowRoute);
    }
  }

  // }}}
  // Paths {{{

  const xmlPaths: any[] =
    xmlInfrastructureDocument["trafIT"]["paths"][0]["path"];
  throwIfNotUniqe(
    xmlPaths.map((xmlPath): string => idFromXML(xmlPath)),
    "All path names have to be unique"
  );
  const paths = xmlPaths.reduce<Map<string, Path>>((acc, xmlPath): Map<
    string,
    Path
  > => {
    const pathID = idFromXML(xmlPath);

    const pathRoutes = Object.freeze<Route[]>(
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
      Object.freeze<Path>({
        length: pathRoutes.reduce<number>(
          (acc, route): number => acc + route.length,
          0
        ),
        pathID,
        routes: pathRoutes,
        stations: pathRoutes.flatMap(
          (route): readonly Station[] => route.stations
        ),
        vertexes: pathRoutes.flatMap(
          (route): readonly Vertex[] => route.vertexes
        ),
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
      const itineraryID: string = xmlItinerary.$.name;

      const itineraryPaths = Object.freeze<Path[]>(
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
      const itineraryRoutes = Object.freeze<Route[]>(
        itineraryPaths.flatMap((path): readonly Route[] => path.routes)
      );
      const length = itineraryPaths.reduce((acc, path): number => {
        return acc + path.length;
      }, 0);

      const args = Object.freeze<ItineraryArgs>(
        parseItineraryArgs(itineraryID)
      );

      acc.set(
        itineraryID,
        Object.freeze<Itinerary>({
          args,
          itineraryID,
          length,
          paths: itineraryPaths,
          routes: itineraryRoutes,
          stations: itineraryPaths.flatMap(
            (path): readonly Station[] => path.stations
          ),
          vertexes: itineraryPaths.flatMap(
            (route): readonly Vertex[] => route.vertexes
          ),
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

    const trainItineraries = Object.freeze<Itinerary[]>(
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

    const trainVertexes = trainItineraries
      .flatMap((itinerary): readonly Vertex[] => itinerary.vertexes)
      .reduce<Set<Vertex>>(
        (acc, vertex): Set<Vertex> => acc.add(vertex),
        new Set()
      );

    const length = formations.get(xmlCourse.$.train)?.length;
    if (length == null) {
      throw new Error(`Can't find the length of train ${trainID}.`);
    }

    const maxSpeed = formations.get(xmlCourse.$.train)?.maxSpeed;
    if (maxSpeed == null) {
      throw new Error(`Can't find max speed for train ${trainID}.`);
    }

    if (!timetables.has(trainID)) {
      log.warn(
        `Can't find any timetable for train ${trainID}. Empty one was created.`
      );
      timetables.set(
        trainID,
        Object.freeze<Timetable>({ entries: [], trainID })
      );
    }
    const timetable = timetables.get(trainID)!;

    return acc.set(
      trainID,
      Object.freeze<Train>({
        itineraries: trainItineraries,
        length,
        mainItinerary: trainItineraries[0],
        maxSpeed,
        paths: trainPaths,
        routes: trainRoutes,
        timetable,
        trainID,
        vertexes: trainVertexes,
      })
    );
  }, new Map());

  const mainItineraries = new Set<Itinerary>(
    [...trains.values()].map((train): Itinerary => train.mainItinerary)
  );

  // }}}
  // Train warnings {{{

  for (const train of trains.values()) {
    for (const [itinerary, { canEnter, canExit }] of checkTrainItineraries(
      train
    )) {
      if (!canEnter) {
        log.warn(
          `Train ${train.trainID} has an itinerary ${itinerary.itineraryID} that can't be entered from it's main itinerary ${train.mainItinerary.itineraryID}.`
        );
      }
      if (!canExit) {
        log.warn(
          `Train ${train.trainID} has an itinerary ${itinerary.itineraryID} from which it's impossible to return to the main itinerary ${train.mainItinerary.itineraryID}.`
        );
      }
    }
  }

  // }}}

  return Object.freeze<InfrastructureData>({
    formations,
    itineraries,
    itinerariesLength,
    mainItineraries,
    paths,
    pathsLength,
    routes,
    routesLength,
    stations,
    timetables,
    trains,
    vehicles,
    vertexes,
  });
}

// vim:fdm=marker
