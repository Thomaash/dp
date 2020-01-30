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
