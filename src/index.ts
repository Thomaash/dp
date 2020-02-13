import waitPort from "wait-port";
import { promisify } from "util";
import {
  readFile as readFileCallback,
  writeFile as writeFileCallback
} from "fs";
import { ChildProcessWithoutNullStreams, spawn } from "child_process";

import {
  AnyEventCallback,
  OTAPI,
  parseRunfile,
  randomizePortsInRunfile
} from "./otapi";
import { Deferred } from "./util";
import { TrainTracker } from "./train-tracker";
import { args } from "./cli";
import { buildChunkLogger } from "./util";
import {
  infrastructureFactory,
  Infrastructure,
  Route,
  Itinerary,
  Train,
  Station
} from "./infrastructure";

const readFile = promisify(readFileCallback);
const writeFile = promisify(writeFileCallback);

function ck(...rest: string[]): string {
  return JSON.stringify(rest);
}

class MWD<K, V> extends Map<K, V> {
  public gwd(key: K, defaultValue: V): V {
    if (this.has(key)) {
      return this.get(key)!;
    } else {
      this.set(key, defaultValue);
      return defaultValue;
    }
  }
}

class Blocking<V> {
  private _data = new MWD<string, Set<V>>();

  public block(stationID: string, blockerID: string, blocked: V): this {
    const key = ck(stationID, blockerID);
    this._data.gwd(key, new Set()).add(blocked);

    return this;
  }

  public unblock(stationID: string, blockerID: string, blocked: V): this {
    const key = ck(stationID, blockerID);
    this._data.gwd(key, new Set()).delete(blocked);

    return this;
  }

  public unblockAll(stationID: string, blockerID: string): this {
    const key = ck(stationID, blockerID);
    this._data.delete(key);

    return this;
  }

  public isBlocked(tested: V): boolean {
    for (const set of this._data.values()) {
      if (set.has(tested)) {
        return true;
      }
    }

    return false;
  }

  public getBlocked(stationID: string, blockerID: string): V[] {
    const key = ck(stationID, blockerID);
    return [...this._data.gwd(key, new Set()).values()];
  }
}

interface OvertakingItinerary {
  exitRoute: Route;
  itinerary: Itinerary;
  station: Station;
}

// TODO: Move this into separate file.
function main({
  infrastructure,
  otapi
}: {
  infrastructure: Infrastructure;
  otapi: OTAPI;
}): {
  setup: () => Promise<void>;
  cleanup: () => Promise<void>;
} {
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
    .map(
      (itinerary): OvertakingItinerary => ({
        exitRoute: itinerary.routes[itinerary.routes.length - 1],
        itinerary,
        station: itinerary.stations[itinerary.stations.length - 1]
      })
    );

  const overtakingRouteIDs = overtakingItiniraries
    .flatMap(({ itinerary: { routes } }): readonly Route[] => routes)
    .reduce<Set<string>>(
      (acc, route): Set<string> => acc.add(route.routeID),
      new Set()
    );

  const blocking = new Blocking<Train>();
  const cleanupCallbacks: (() => void)[] = [];

  async function overtakeTrain(
    { exitRoute, station }: OvertakingItinerary,
    overtaking: Train,
    waiting: Train
  ): Promise<void> {
    blocking.block(station.stationID, overtaking.trainID, waiting);

    await otapi.setRouteDisallowed({
      trainID: waiting.trainID,
      routeID: exitRoute.routeID
    });
    await otapi.setStop({
      stationID: station.stationID,
      stopFlag: true,
      trainID: waiting.trainID
    });
    await otapi.setDepartureTime({
      stationID: station.stationID,
      time: Number.MAX_SAFE_INTEGER,
      trainID: waiting.trainID
    });
  }

  async function releaseTrains(
    { exitRoute, station }: OvertakingItinerary,
    overtaking: Train
  ): Promise<void> {
    const blockedByMe = blocking.getBlocked(
      station.stationID,
      overtaking.trainID
    );
    blocking.unblockAll(station.stationID, overtaking.trainID);

    await Promise.all(
      blockedByMe
        .filter((train): boolean => !blocking.isBlocked(train))
        .flatMap((waiting): Promise<void>[] => [
          // Unblock exit route.
          otapi.setRouteAllowed({
            routeID: exitRoute.routeID,
            trainID: waiting.trainID
          }),
          // Restore departure time.
          otapi.setDepartureTime({
            stationID: station.stationID,
            time: 0, // TODO: The original time from the timetable should be used.
            trainID: waiting.trainID
          })
        ])
    );
  }

  async function setup(): Promise<void> {
    const tracker = new TrainTracker(otapi, infrastructure).startTracking(1);
    cleanupCallbacks.push(tracker.stopTraking.bind(tracker));

    const removeListeners = await Promise.all([
      otapi.on(
        "routeEntry",
        async (_, { routeID, trainID }): Promise<void> => {
          const train = infrastructure.trains.get(trainID);
          if (train == null) {
            throw new Error(`No train called ${trainID}.`);
          }

          if (overtakingRouteIDs.has(routeID)) {
            for (const oi of overtakingItiniraries) {
              const trainsOnItinerary = tracker.getTrainsOnItineraryInOrder(
                oi.itinerary.itineraryID
              );

              if (trainsOnItinerary.length < 2) {
                continue;
              }

              if (
                trainsOnItinerary[0].train.maxSpeed <
                trainsOnItinerary[1].train.maxSpeed
              ) {
                await overtakeTrain(
                  oi,
                  trainsOnItinerary[1].train,
                  trainsOnItinerary[0].train
                );
              }
            }
          }
        }
      ),
      otapi.on(
        "routeExit",
        async (_, { routeID, trainID }): Promise<void> => {
          const train = infrastructure.trains.get(trainID);
          if (train == null) {
            throw new Error(`No train called ${trainID}.`);
          }

          await Promise.all(
            overtakingItiniraries
              .filter((oi): boolean => oi.exitRoute.routeID === routeID)
              .map((oi): Promise<void> => releaseTrains(oi, train))
          );
        }
      ),
      otapi.on(
        "trainCreated",
        async (_, { trainID }): Promise<void> => {
          const train = infrastructure.trains.get(trainID);
          if (train == null) {
            throw new Error(`No train called ${trainID}.`);
          }

          await Promise.all(
            [...train.routes.values()].map(
              ({ routeID }): Promise<void> =>
                otapi.setRouteAllowed({ routeID, trainID })
            )
          );
        }
      )
    ]);
    cleanupCallbacks.push(...removeListeners);
  }

  async function cleanup(): Promise<void> {
    cleanupCallbacks.splice(0).forEach((callback): void => void callback());
  }

  return { setup, cleanup };
}

function spawnAndLog(
  binaryPath: string,
  args: readonly string[],
  logPath: string,
  onLogLine: (logLine: string) => void = (): void => {}
): { child: ChildProcessWithoutNullStreams; returnCode: Promise<number> } {
  const child = spawn(binaryPath, args);

  const returnCode = new Promise<number>((resolve, reject): void => {
    let stdout = "";
    let stderr = "";

    const logStdout = buildChunkLogger("OT", "info", onLogLine);
    const logStderr = buildChunkLogger("OT", "error", onLogLine);

    child.stdout.on("data", (chunk): void => {
      const string: string = chunk.toString();

      stdout += string;
      logStdout(string);
    });
    child.stderr.on("data", (chunk): void => {
      const string: string = chunk.toString();

      stderr += string;
      logStderr(string);
    });

    child.on("close", (code): void => {
      writeFile(
        logPath,
        [
          `OpenTrack exited with exit code ${code}.`,
          `STDOUT:\n${stdout}`,
          `STDERR:\n${stderr}`
        ].join("\n\n")
      )
        .then(resolve.bind(null, code))
        .catch(reject);
    });
  });

  return { child, returnCode };
}

async function startOpenTrack(otapi: OTAPI): Promise<{ command: any }> {
  const otArgs = Object.freeze(["-otd", `-runfile=${args["ot-runfile"]}`]);
  console.info("OpenTrack commandline:", [args["ot-binary"], ...otArgs]);

  for (let attempt = 1; ; ++attempt) {
    const readyForSimulation = otapi.once("simReadyForSimulation");
    const simulationServerStarted = otapi.once("simServerStarted");

    const failed = new Deferred();

    console.info(
      attempt === 1
        ? "Starting OpenTrack..."
        : `Starting OpenTrack (attempt ${attempt})...`
    );
    const command = spawnAndLog(
      args["ot-binary"],
      otArgs,
      args["ot-log"],
      (line): void => {
        if (
          line.endsWith("OTServerGenerator startPSMServer Socket NO success")
        ) {
          failed.reject(new Error(line));
        }
      }
    );

    try {
      await Promise.race([
        Promise.all([
          readyForSimulation,
          simulationServerStarted,
          waitPort({ port: otapi.config.portOT, output: "silent" })
        ]),
        failed.promise
      ]);
      await otapi.openSimulationPanel();
      console.info("OpenTrack is ready for simulation.");

      return { command };
    } catch (error) {
      console.error("Startup failed.");

      console.info("Waiting for OpenTrack process to terminate...");
      command.child.kill("SIGTERM");
      await command.returnCode;
      console.info("OpenTrack terminated.");

      console.info("Trying again...");
      console.info();
      continue;
    }
  }
}

(async (): Promise<void> => {
  if (args["randomize-ports"]) {
    await randomizePortsInRunfile(args["ot-runfile"]);
  }
  const runfile = parseRunfile((await readFile(args["ot-runfile"])).toString());
  const portOT = +runfile["OpenTrack Server Port"][0];
  const portApp = +runfile["OTD Server Port"][0];

  const infrastructure = await infrastructureFactory.buildFromFiles({
    courses: args["ot-export-courses"],
    infrastructure: args["ot-export-infrastructure"],
    rollingStock: args["ot-export-rolling-stock"],
    timetables: args["ot-export-timetables"]
  });

  console.info(
    [
      "Infrastructure:",

      `  ${infrastructure.trains.size} trains,`,

      `  ${infrastructure.itineraries.size} itineraries ` +
        `(${infrastructure.itinerariesLength / 1000} km, ` +
        `${infrastructure.mainItineraries.size} used as main itineraries),`,

      `  ${infrastructure.paths.size} paths ` +
        `(${infrastructure.pathsLength / 1000} km),`,

      `  ${infrastructure.routes.size} routes ` +
        `(${infrastructure.routesLength / 1000} km).`,

      `  ${infrastructure.stations.size} stations,`,

      `  ${infrastructure.timetables.size} timetables.`,

      "",
      ""
    ].join("\n")
  );

  console.info(`Ports: OT ${portOT} <-> App ${portApp}`);
  const otapi = new OTAPI({ portApp, portOT });
  const trainTracker = new TrainTracker(otapi, infrastructure);

  try {
    trainTracker.startTracking(1);
    await otapi.start();

    if (args["log-ot-responses"]) {
      const debugCallback: AnyEventCallback = async function(
        name,
        payload
      ): Promise<void> {
        process.stdout.write(
          `\n\n===> OT: ${name}\n${JSON.stringify(payload, null, 4)}\n\n`
        );
      };

      otapi.on(debugCallback);
    }

    if (args["manage-ot"]) {
      const { command } = await startOpenTrack(otapi);
      command.returnCode.catch().then(
        async (): Promise<void> => {
          console.info(
            `OpenTrack exited with exit code ${await command.returnCode}.`
          );
          console.info("Stopping the app...");
          otapi.kill();
        }
      );

      const { cleanup, setup } = main({ otapi, infrastructure });
      await setup();

      const simulationEnd = otapi.once("simStopped");
      console.info("Starting simulation...");
      const simulationStart = otapi.once("simStarted");
      await otapi.startSimulation();
      await simulationStart;
      console.info("Simulating...");

      await simulationEnd;
      console.info("Simulation ended.");
      await cleanup();

      console.info("Closing OpenTrack...");
      await otapi.terminateApplication();

      // Wait for the process to finish. OpenTrack doesn't handle well when the
      // app stops responding when it's running.
      await command.returnCode;
      console.info("OpenTrack closed.");
    } else {
      console.info("Waiting for OpenTrack...");
      await waitPort({ port: portOT, output: "silent" });

      for (;;) {
        const { setup, cleanup } = main({ otapi, infrastructure });
        await setup();

        const simulationStart = otapi.once("simStarted");

        console.info("Simulation can be started now.");
        await simulationStart;
        const simulationEnd = otapi.once("simStopped");
        console.info("Simulating...");

        await simulationEnd;
        console.info("Simulation ended.");
        await cleanup();
        console.info();
      }
    }
  } finally {
    await otapi.kill();
    console.info("Finished.");
    console.info();
  }
})()
  .then((): void => {
    process.exit(0);
  })
  .catch((error): void => {
    console.error(error);
    process.exit(1);
  });
