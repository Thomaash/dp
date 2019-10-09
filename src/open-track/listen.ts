import bodyParser from "body-parser";
import express from "express";

export type SOAPListener = (msg: string) => void;

const staticApp = express();
const staticListeners: SOAPListener[] = [];
let staticServer: import("http").Server | null = null;

staticApp.use(
  bodyParser.text({
    type: (): boolean => true,
    limit: "5mb"
  })
);

staticApp.post("/otd", (req, _res): void => {
  staticListeners.forEach((callback): void => {
    callback(req.body);
  });
});

export function addOTListener(callback: (msg: string) => void): void {
  if (staticServer == null) {
    staticServer = staticApp.listen(9004, function() {
      console.log(arguments);
    });
    console.info("Server started.");
  }

  staticListeners.push(callback);
}

export function removeOTListener(callback: (msg: string) => void): void {
  staticListeners.splice(staticListeners.indexOf(callback), 1);

  if (staticServer && staticListeners.length === 0) {
    staticServer.close();
    staticServer = null;
    console.info("Server stopped.");
  }
}
