import xml2js from "xml2js";
import { expect } from "chai";

import { ck, filterChildren, idFromXML, xmlVertexCK } from "./common";
import { Course, InfrastructureData, Itinerary, Path, Route } from "./types";

export async function parseInfrastructure(trafIT: {
  infrastructure: string;
  courses: string;
}): Promise<InfrastructureData> {
  const xmlInfrastructureDocument = await new xml2js.Parser({
    explicitChildren: true,
    preserveChildrenOrder: true
  }).parseStringPromise(trafIT.infrastructure);
  const xmlCoursesDocument = await new xml2js.Parser({
    explicitChildren: true,
    preserveChildrenOrder: true
  }).parseStringPromise(trafIT.courses);

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
    "There should be a neighbor for each vertex."
  ).to.have.lengthOf(xmlVertexes.length);

  const xmlEdges: any[] =
    xmlInfrastructureDocument["trafIT"]["edges"][0]["edge"];
  const vertexToVertexDistance = xmlEdges.reduce<Map<string, number>>(
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
    vertexToVertexDistance,
    "Each edge has to have and entry in both directions."
  ).to.have.lengthOf(xmlEdges.length * 2);

  /*
   * Routes.
   */
  const xmlRoutes: any[] =
    xmlInfrastructureDocument["trafIT"]["routes"][0]["route"];
  const routeNames = new Set(
    xmlRoutes.map((xmlRoute): string => idFromXML(xmlRoute))
  );
  expect(routeNames, "All route names have to be unique.").have.lengthOf(
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

          const distance = vertexToVertexDistance.get(ck(id1, id2));
          if (distance == null) {
            throw new Error(
              `Can't find distance between vertexes ${id1} and ${id2}.`
            );
          }

          return acc + distance;
        }, 0),
        routeID
      })
    );

    return acc;
  }, new Map());

  const routesLength = [...routes.values()].reduce<number>(
    (acc, route): number => acc + route.length,
    0
  );

  /*
   * Paths.
   */
  const xmlPaths: any[] =
    xmlInfrastructureDocument["trafIT"]["paths"][0]["path"];
  const pathNames = new Set(
    xmlPaths.map((xmlPath): string => idFromXML(xmlPath))
  );
  expect(pathNames, "All path names have to be unique.").have.lengthOf(
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
        length: pathRoutes.reduce<number>((acc, route): number => {
          return acc + route.length;
        }, 0),
        pathID,
        routes: pathRoutes
      })
    );

    return acc;
  }, new Map());

  const pathsLength = [...paths.values()].reduce<number>(
    (acc, path): number => acc + path.length,
    0
  );

  /*
   * Itineraries.
   */
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

      acc.set(
        itineraryID,
        Object.freeze({
          itineraryID,
          length,
          paths: itineraryPaths,
          routes: itineraryRoutes
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

  /*
   * Courses.
   */
  const xmlCourses: any[] =
    xmlCoursesDocument["trafIT"]["courses"][0]["course"];
  const courses = xmlCourses.reduce<Map<string, Course>>((acc, xmlCourse): Map<
    string,
    Course
  > => {
    const courseID = xmlCourse.$.courseID;

    const courseItineraries = Object.freeze(
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
                `Can't find itinerary named ${itineraryID} from the course ${courseID}.`
              );
            }

            return itinerary;
          }
        )
    );

    acc.set(
      courseID,
      Object.freeze({
        courseID,
        itineraries: courseItineraries,
        mainItinerary: courseItineraries[0]
      })
    );

    return acc;
  }, new Map());

  /*
   * Main itineraries.
   */
  const mainItineraries = new Set<Itinerary>(
    [...courses.values()].map((course): Itinerary => course.mainItinerary)
  );

  return Object.freeze({
    courses,
    itineraries,
    itinerariesLength,
    mainItineraries,
    paths,
    pathsLength,
    routes,
    routesLength
  });
}
