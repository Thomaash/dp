import { promisify } from "util";
import {
  copyFile as copyFileCallback,
  readFile as readFileCallback,
  writeFile as writeFileCallback,
} from "fs";

import { OTDate } from "../infrastructure/common";

const copyFile = promisify(copyFileCallback);
const readFile = promisify(readFileCallback);
const writeFile = promisify(writeFileCallback);

export type RunfileKey =
  | "Adhesion Outside"
  | "Adhesion Tunnel"
  | "Break Day Offset"
  | "Break Time"
  | "Communication Mode"
  | "Communication Period"
  | "CourseFile"
  | "Delay Format"
  | "Delay Scenario"
  | "DepotFile"
  | "DestInfoFile"
  | "InfraPart Messages"
  | "Infrastructure Document"
  | "Keep Connection"
  | "Keep Occupations"
  | "Label Size"
  | "Mean Delay"
  | "OTD Server Port"
  | "OTD Server"
  | "OpenTrack Server Port"
  | "Optimization Period"
  | "Optimize Dispatching"
  | "Optimize Train Sequence"
  | "Output Acc./Distance"
  | "Output Acc./Time"
  | "Output Altitude, Gradient & Radius"
  | "Output Braking Actions"
  | "Output Course & Station Statistics"
  | "Output Distance/Time Rev. Dir."
  | "Output Distance/Time"
  | "Output Instruments"
  | "Output Messages (Text)"
  | "Output Power/Dist. & Energy/Dist."
  | "Output Resistance/Dist."
  | "Output Route Occ."
  | "Output Simulation Protocol"
  | "Output Speed/Distance Rev. Dir."
  | "Output Speed/Distance"
  | "Output Speed/Time"
  | "Output Station- & Signalpositions"
  | "Output Time/Dist./Speed/Power"
  | "Output Timetable & Delay Statistics"
  | "Output Timetable (Text)"
  | "Output Tract.Effort/Dist."
  | "Output Train Diagram"
  | "OutputPath"
  | "Performance"
  | "Ping Inverval"
  | "Route Messages"
  | "Route Setting and Reservation Mode"
  | "Safety Margin"
  | "Server Messages"
  | "Show Current Time"
  | "Show Instruments"
  | "Show Messages"
  | "Show Train Delay"
  | "Show Train Descr."
  | "Show Train ID"
  | "Show Train"
  | "Signal Messages"
  | "Simulation Messages"
  | "Start Day Offset"
  | "Start Time"
  | "StationFile"
  | "Step"
  | "Stop Day Offset"
  | "Stop Time"
  | "Time Ratio"
  | "Timeout"
  | "Timetable Messages"
  | "TimetableFile"
  | "Train Diagram Document"
  | "Train Messages"
  | "Train Position Report Messages"
  | "TrainFile"
  | "TrainType"
  | "Use Console"
  | "Use Curve Resistance"
  | "Use OTD-Communication"
  | "Use Ping"
  | "Use Switch Time and Route Res. Time";

export type RunfileDayTimeKey = "break" | "start" | "stop";
const timeKeys: Record<
  RunfileDayTimeKey,
  { day: RunfileKey; time: RunfileKey }
> = {
  break: { day: "Break Day Offset", time: "Break Time" },
  start: { day: "Start Day Offset", time: "Start Time" },
  stop: { day: "Stop Day Offset", time: "Stop Time" },
};

const newline = /\r?\n/g;

export class ReadonlyRunfile {
  public constructor(protected readonly _path: string) {}

  private async _readLines(): Promise<string[]> {
    return (await readFile(this._path, "utf8")).split(newline);
  }

  public get path(): string {
    return this._path;
  }

  public async readTimeValue(key: RunfileKey, nth = 1): Promise<number> {
    const [hh, mm, ss] = (await this.readValue(key, nth))
      .split(":")
      .map((digits): number => Number.parseInt(digits, 10));

    return hh * 60 * 60 + mm * 60 + ss;
  }

  public async readValues(key: RunfileKey): Promise<string[]> {
    const lines = (await this._readLines()).filter((line): boolean =>
      line.startsWith(key + "#")
    );

    const values = lines.map((line): string => line.split("#", 2)[1]);

    if (values.some((value): boolean => value == null || value == "")) {
      throw new TypeError(`Key ${key} is malformed in runfile ${this._path}.`);
    }

    return values;
  }

  public async readValue(key: RunfileKey, nth = 1): Promise<string> {
    let found = 0;
    const line = (await this._readLines()).find((line): boolean => {
      if (line.startsWith(key + "#")) {
        ++found;
        if (found === nth) {
          return true;
        }
      }

      return false;
    });

    if (line == null) {
      throw new TypeError(`Key ${key} doesn't exist in runfile ${this._path}.`);
    }

    const value = line.split("#")[1];

    if (value == null) {
      throw new TypeError(`Key ${key} is malformed in runfile ${this._path}.`);
    }

    return value;
  }

  public async readDayTimeValue(key: RunfileDayTimeKey): Promise<number> {
    const [day, time] = await Promise.all([
      this.readValue(timeKeys[key].day),
      this.readValue(timeKeys[key].time),
    ]);

    const otDate = new OTDate(day, time);

    return otDate.time;
  }
}

export class Runfile extends ReadonlyRunfile {
  public async writeValue(
    key: RunfileKey,
    value: string,
    nth = 1
  ): Promise<void> {
    let found = 0;

    const lines = (await readFile(this._path, "utf8"))
      .split(newline)
      .map((line): string => {
        if (line.startsWith(key + "#")) {
          ++found;
          if (found === nth) {
            return `${key}#${value}#`;
          }
        }

        return line;
      });

    if (found < nth) {
      lines.push(`${key}#${value}#`);
    }

    await writeFile(this._path, lines.join("\n"));
  }

  public async randomizePortsInRunfile(): Promise<void> {
    const port1 = Math.floor(1024 + Math.random() * (65535 - 1024 - 1));
    const port2 = port1 + 1;

    await this.writeValue("OTD Server Port", "" + port1);
    await this.writeValue("OpenTrack Server Port", "" + port2);
  }
}

export interface TmpRunfilePair {
  orig: ReadonlyRunfile;
  tmp: Runfile;
}
export async function createTmpRunfilePair(
  orig: string,
  tmp: string
): Promise<TmpRunfilePair> {
  await copyFile(orig, tmp);
  return {
    orig: new ReadonlyRunfile(orig),
    tmp: new Runfile(tmp),
  };
}
