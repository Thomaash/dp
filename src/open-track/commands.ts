import fetch, { Response } from "node-fetch";

const host = "localhost";

export function sendOTStartSimulation(): Promise<Response> {
  return fetch(`http://${host}:9002/otd`, {
    method: "POST",
    body: `<?xml version="1.0" encoding="UTF-8"?> <SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/"> <SOAP-ENV:Body>     <startSimulation/> </SOAP-ENV:Body> </SOAP-ENV:Envelope>`,
    headers: {
      "Content-Type": "application/xml; charset=utf-8"
    } as any
  });
}

export function sendOTEndSimulation(): Promise<Response> {
  return fetch(`http://${host}:9002/otd`, {
    method: "POST",
    body: `<?xml version="1.0" encoding="UTF-8"?> <SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/"> <SOAP-ENV:Body>     <endSimulation/> </SOAP-ENV:Body> </SOAP-ENV:Envelope>`,
    headers: {
      "Content-Type": "application/xml; charset=utf-8"
    } as any
  });
}
