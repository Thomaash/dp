import { promisify } from "util";
import {
  readFile as readFileCallback,
  writeFile as writeFileCallback,
} from "fs";

const readFile = promisify(readFileCallback);
const writeFile = promisify(writeFileCallback);

export type Runfile = Record<
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
  | "Train Messages"
  | "Train Position Report Messages"
  | "TrainFile"
  | "TrainType"
  | "Use Console"
  | "Use Curve Resistance"
  | "Use OTD-Communication"
  | "Use Ping"
  | "Use Switch Time and Route Res. Time",
  string[]
>;

const newline = /\r?\n/g;
const comment = /^\/\//;

function generatePort(): number {
  return Math.floor(1024 + Math.random() * (65535 - 1024));
}

export async function randomizePortsInRunfile(
  runfilePath: string
): Promise<void> {
  const port1 = generatePort();
  const port2 = port1 === 1024 ? 65535 : port1 - 1;

  await writeFile(
    runfilePath,
    (await readFile(runfilePath, "utf8"))
      .split(newline)
      .map((line): string => {
        if (line.startsWith("OTD Server Port#")) {
          return `OTD Server Port#${port1}#`;
        } else if (line.startsWith("OpenTrack Server Port#")) {
          return `OpenTrack Server Port#${port2}#`;
        } else {
          return line;
        }
      })
      .join("\n")
  );
}

export function parseRunfile(text: string): Runfile {
  return text
    .split(newline)
    .filter((line): boolean => !comment.test(line))
    .map((line): string[] => line.split("#"))
    .reduce(
      (acc: any, [key, val]): Runfile => (
        (acc[key] = acc[key] || []).push(val), acc
      ),
      {}
    );
}
