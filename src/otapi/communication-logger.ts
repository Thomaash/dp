import { WriteStream, createWriteStream } from "fs";
import { CurryLog } from "../curry-log";

export interface CommunicationLogger {
  logRequest(body: string): this;
  logResponse(body: string): this;
}

export class CommunicationDumpsterLogger implements CommunicationLogger {
  public logRequest(): this {
    return this;
  }

  public logResponse(): this {
    return this;
  }
}

const LOG_WORDS = Object.freeze({
  REQ: "request",
  RES: "response",
});

export class CommunicationFileLogger implements CommunicationLogger {
  private _reqs = 0;
  private _reses = 0;
  private readonly _file: WriteStream;

  public constructor(
    private readonly _log: CurryLog,
    private readonly _filePath: string
  ) {
    this._file = createWriteStream(this._filePath, {
      encoding: "UTF-8",
      flags: "w",
    });

    const date = new Date();
    this._file.write(
      [
        "Network communication log (OTAPI <-> OpenTrack)",
        date.toString(),
        "",
        "",
      ].join("\n"),
      "UTF-8",
      (error): void => {
        if (error != null) {
          this._log.error(error, `Failed to write a header into the log.`, {
            logFile: this._filePath,
            date,
          });
        }
      }
    );

    return this;
  }

  private _write(type: "REQ" | "RES", number: number, body: string): this {
    const date = new Date();
    this._file.write(
      [type + " " + number, date.toString(), body, "", ""].join("\n"),
      "UTF-8",
      (error): void => {
        if (error != null) {
          this._log.error(
            error,
            `Failed to write a ${LOG_WORDS[type]} ${number} into the log.`,
            {
              logFile: this._filePath,
              date,
              body,
            }
          );
        }
      }
    );

    return this;
  }

  public logRequest(body: string): this {
    ++this._reqs;
    return this._write("REQ", this._reqs, body);
  }

  public logResponse(body: string): this {
    ++this._reses;
    return this._write("RES", this._reses, body);
  }
}
