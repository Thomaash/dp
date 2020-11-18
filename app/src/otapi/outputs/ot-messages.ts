interface RawOTMessage {
  document: string | null;
  level: string | null;
  message: string | null;
  simTime: string | null;
  trainID: string | null;
}
export interface OTMessage {
  document: string | null;
  level: string | null;
  message: string;
  simTime: string | null;
  trainID: string | null;
}

export interface OTMessageQuery {
  document: string;
  level: string;
  message: string;
  simTime: string;
  trainID: string;
}

export class OTMessages {
  private _messages: readonly OTMessage[];

  public constructor(text: string) {
    this._messages = this._parseMessages(text);
  }

  private _parseMessages(text: string): OTMessage[] {
    return text
      .split("\n")
      .filter((line): boolean => !line.startsWith("//") && line !== "")
      .map((line): (string | null)[] =>
        line
          .split("\t")
          .map((cell): string | null =>
            typeof cell === "string" && cell !== "" ? cell.trim() : null
          )
      )
      .map(
        (cells): RawOTMessage => ({
          level: cells[0] ?? null,
          simTime: cells[1] ?? null,
          trainID: cells[2] ?? null,
          message: cells[3] ?? null,
          document: cells[4] ?? null,
        })
      )
      .filter((value): value is OTMessage => {
        if (value.message == null) {
          throw new Error("This should never happen.");
        }
        return true;
      })
      .map(
        (value): OTMessage => {
          if (value.document != null) {
            if (
              !(value.document.startsWith("(") && value.document.endsWith(")"))
            ) {
              throw new Error("This should never happen.");
            }

            return {
              ...value,
              document: value.document.slice(1, -1),
            };
          } else {
            return value;
          }
        }
      )
      .map(
        (value): OTMessage => {
          if (value.trainID != null) {
            if (!value.message.startsWith("Course " + value.trainID + ": ")) {
              throw new Error("This should never happen.");
            }

            return {
              ...value,
              message: value.message.split(": ", 2)[1],
            };
          } else {
            return value;
          }
        }
      )
      .map((value): OTMessage => Object.freeze<OTMessage>(value));
  }

  public query({
    document,
    level,
    message,
    simTime,
    trainID,
  }: Partial<OTMessageQuery> = {}): OTMessage[] {
    return this._messages
      .filter(
        (value): boolean =>
          (document == null || value.document === document) &&
          (level == null || value.level === level) &&
          (message == null || value.message === message) &&
          (simTime == null || value.simTime === simTime) &&
          (trainID == null || value.trainID === trainID)
      )
      .map((value): OTMessage => ({ ...value }));
  }
}
