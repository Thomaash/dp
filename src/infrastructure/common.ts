import { expect } from "chai";

export function ck(...rest: (boolean | number | string)[]): string {
  return JSON.stringify(rest);
}
export function xmlVertexCK(vertex: any): string {
  return ck(vertex.$.documentname, vertex.$.id);
}

export function filterChildren(xmlElement: any, ...names: string[]): any[] {
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

export function idFromXML(xmlElement: any): string {
  return id(xmlElement.$.documentname, xmlElement.$.id, xmlElement.$.name);
}

export class OTDate {
  public readonly day: number;
  public readonly hours: number;
  public readonly minutes: number;
  public readonly seconds: number;

  public readonly time: number;

  public readonly stringDay: string;
  public readonly stringTime: string;

  public constructor(stringDay: string | null | undefined, stringTime: string) {
    this.stringDay = stringDay ?? "0";
    this.stringTime = stringTime;

    expect(this.stringDay, "Invalid day format").to.match(/^\d+/);
    expect(this.stringTime, "Invalid time format").to.match(
      /^\d{2}:\d{2}:\d{2}(\.\d+)?$/
    );

    this.day = +this.stringDay;

    const [hours, minutes, seconds] = this.stringTime.split(":");
    this.hours = +hours;
    this.minutes = +minutes;
    this.seconds = +seconds;

    this.time =
      this.day * 86400 +
      this.hours * 3600 +
      this.minutes * 60 +
      this.seconds * 1;

    Object.freeze(this);
  }
}
