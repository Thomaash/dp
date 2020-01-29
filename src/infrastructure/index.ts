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

export interface Route {
  readonly name: string;
  readonly length: number;
}

export interface Path {
  readonly name: string;
  readonly routes: readonly Route[];
  readonly length: number;
}

export interface Itinerary {
  readonly name: string;
  readonly paths: readonly Path[];
  readonly routes: readonly Route[];
  readonly length: number;
}

export interface Infrastructure {
  readonly itineraries: ReadonlyMap<string, Itinerary>;
  readonly itinerariesLength: number;
  readonly paths: ReadonlyMap<string, Path>;
  readonly pathsLength: number;
  readonly routes: ReadonlyMap<string, Path>;
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
  const vertexNeighborCK = xmlVertexes.reduce((acc, xmlVertex): Map<
    string,
    string
  > => {
    acc.set(
      ck(xmlVertex.$.documentname, xmlVertex.$.id),
      ck(
        xmlVertex.$.neighbourdocumentname || xmlVertex.$.documentname,
        xmlVertex.$.neighbourid
      )
    );
    return acc;
  }, new Map());
  expect(
    vertexNeighborCK,
    "There should be a neighbor for each vertex."
  ).to.have.lengthOf(xmlVertexes.length);

  const xmlEdges: any[] = xml["trafIT"]["edges"][0]["edge"];
  const vertexToVertexDistance = xmlEdges.reduce((acc, xmlEdge): Map<
    string,
    number
  > => {
    const id1 = ck(xmlEdge.$.documentname, xmlEdge.$.vertex1);
    const id2 = ck(xmlEdge.$.documentname, xmlEdge.$.vertex2);
    const length = +xmlEdge.$.length;

    acc.set(ck(id1, id2), length);
    acc.set(ck(id2, id1), length);

    return acc;
  }, new Map<string, number>());
  expect(
    vertexToVertexDistance,
    "Each edge has to have and entry in both directions."
  ).to.have.lengthOf(xmlEdges.length * 2);

  /*
   * Routes.
   */
  const xmlRoutes: any[] = xml["trafIT"]["routes"][0]["route"];
  const routeNames = new Set(
    xmlRoutes.map((xmlRoute): string => xmlRoute.$.name)
  );
  expect(routeNames, "All route names have to be unique.").have.lengthOf(
    xmlRoutes.length
  );
  const routes = xmlRoutes.reduce((acc, xmlRoute): Map<string, Route> => {
    acc.set(xmlRoute.$.name, {
      name: xmlRoute.$.name,
      length: filterChildren(xmlRoute, "vertex", "stationvertex").reduce(
        (acc, vertex2, i, arr): number => {
          if (i === 0) {
            return acc;
          }

          const id1 = xmlVertexCK(vertex2);
          const id2 = vertexNeighborCK.get(xmlVertexCK(arr[i - 1]));

          return acc + vertexToVertexDistance.get(ck(id1, id2));
        },
        0
      )
    });

    return acc;
  }, new Map());

  const routesLength = [...routes.values()].reduce(
    (acc, route): number => acc + route.length,
    0
  );

  /*
   * Paths.
   */
  const xmlPaths: any[] = xml["trafIT"]["paths"][0]["path"];
  const pathNames = new Set(xmlPaths.map((xmlPath): string => xmlPath.$.name));
  expect(pathNames, "All path names have to be unique.").have.lengthOf(
    xmlPaths.length
  );
  const paths = xmlPaths.reduce((acc, xmlPath): Map<string, Path> => {
    const pathRoutes = (xmlPath["route"] as any[]).map(
      (xmlRoute): Route => {
        const routeName = xmlRoute.$.name;
        const route = routes.get(routeName);

        if (route != null) {
          return route;
        } else {
          throw new Error(`There is no route called ${routeName}.`);
        }
      }
    );

    acc.set(xmlPath.$.name, {
      name: xmlPath.$.name,
      routes: pathRoutes,
      length: pathRoutes.reduce((acc, route): number => {
        return acc + route.length;
      }, 0)
    });

    return acc;
  }, new Map());

  const pathsLength = [...paths.values()].reduce(
    (acc, path): number => acc + path.length,
    0
  );

  /*
   * Itineraries.
   */
  const xmlItineraries: any[] = xml["trafIT"]["itineraries"][0]["itinerary"];
  const itineraries = xmlItineraries.reduce((acc, xmlItinerary): Map<
    string,
    Itinerary
  > => {
    const itineraryPaths = filterChildren(xmlItinerary, "path").map(
      (xmlPath): Path => paths.get(xmlPath.$.name)
    );
    const itineraryRoutes = itineraryPaths.flatMap(
      (path): readonly Route[] => path.routes
    );
    const length = itineraryPaths.reduce((acc, path): number => {
      return acc + path.length;
    }, 0);

    acc.set(xmlItinerary.$.name, {
      length,
      name: xmlItinerary.$.name,
      paths: itineraryPaths,
      routes: itineraryRoutes
    });

    return acc;
  }, new Map());

  const itinerariesLength = [...itineraries.values()].reduce(
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
