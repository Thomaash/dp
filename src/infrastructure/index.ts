import xml2js from "xml2js";
import { expect } from "chai";

function ck(...rest: (boolean | number | string)[]): string {
  return JSON.stringify(rest);
}
function xmlVertexCK(vertex: any): string {
  return ck(vertex.$.documentname, vertex.$.id);
}

function filterChildren(xmlElement: any, ...names: string[]): any[] {
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

function idFromXML(xmlElement: any): string {
  return id(xmlElement.$.documentname, xmlElement.$.id, xmlElement.$.name);
}

export interface Route {
  readonly routeID: string;
  readonly length: number;
}

export interface Path {
  readonly pathID: string;
  readonly routes: readonly Route[];
  readonly length: number;
}

export interface Itinerary {
  readonly itineraryID: string;
  readonly paths: readonly Path[];
  readonly routes: readonly Route[];
  readonly length: number;
}

export interface Infrastructure {
  readonly itineraries: ReadonlyMap<string, Itinerary>;
  readonly itinerariesLength: number;
  readonly paths: ReadonlyMap<string, Path>;
  readonly pathsLength: number;
  readonly routes: ReadonlyMap<string, Route>;
  readonly routesLength: number;
}

export async function parseInfrastructure(
  xmlString: string
): Promise<Infrastructure> {
  const xml = await new xml2js.Parser({
    explicitChildren: true,
    preserveChildrenOrder: true
  }).parseStringPromise(xmlString);

  const xmlVertexes: any[] = filterChildren(
    xml["trafIT"]["vertices"][0],
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

  const xmlEdges: any[] = xml["trafIT"]["edges"][0]["edge"];
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
  const xmlRoutes: any[] = xml["trafIT"]["routes"][0]["route"];
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

    acc.set(routeID, {
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
    });

    return acc;
  }, new Map());

  const routesLength = [...routes.values()].reduce<number>(
    (acc, route): number => acc + route.length,
    0
  );

  /*
   * Paths.
   */
  const xmlPaths: any[] = xml["trafIT"]["paths"][0]["path"];
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

    const pathRoutes = (xmlPath["route"] as any[]).map(
      (xmlRoute): Route => {
        const routeID = idFromXML(xmlRoute);
        const route = routes.get(routeID);

        if (route != null) {
          return route;
        } else {
          throw new Error(`There is no route called ${routeID}.`);
        }
      }
    );

    acc.set(pathID, {
      length: pathRoutes.reduce<number>((acc, route): number => {
        return acc + route.length;
      }, 0),
      pathID,
      routes: pathRoutes
    });

    return acc;
  }, new Map());

  const pathsLength = [...paths.values()].reduce<number>(
    (acc, path): number => acc + path.length,
    0
  );

  /*
   * Itineraries.
   */
  const xmlItineraries: any[] = xml["trafIT"]["itineraries"][0]["itinerary"];
  const itineraries = xmlItineraries.reduce<Map<string, Itinerary>>(
    (acc, xmlItinerary): Map<string, Itinerary> => {
      const itineraryID = xmlItinerary.$.name;

      const itineraryPaths = filterChildren(xmlItinerary, "path").map(
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
      );
      const itineraryRoutes = itineraryPaths.flatMap(
        (path): readonly Route[] => path.routes
      );
      const length = itineraryPaths.reduce((acc, path): number => {
        return acc + path.length;
      }, 0);

      acc.set(itineraryID, {
        itineraryID,
        length,
        paths: itineraryPaths,
        routes: itineraryRoutes
      });

      return acc;
    },
    new Map()
  );

  const itinerariesLength = [...itineraries.values()].reduce<number>(
    (acc, itinerary): number => acc + itinerary.length,
    0
  );

  return {
    itineraries,
    itinerariesLength,
    paths,
    pathsLength,
    routes,
    routesLength
  };
}
