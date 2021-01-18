import globby from "globby";
import { join } from "path";
import { shuffle, split } from "./utils";

export async function loadSamplePaths(
  variant: string
): Promise<{
  training: string[];
  validation: string[];
}> {
  const path = join(__dirname, "..", "data", "preprocessed", variant);

  const artifactAllPaths = await globby(
    join(path, "artifact.*.normalized.json").replace(/\\/g, "/")
  );
  if (artifactAllPaths.length === 0) {
    throw new RangeError("Nothing globbed for: “artifact.*.normalized.json”.");
  }
  const extraHLSAllPaths = await globby(
    join(path, "extrahls.*.normalized.json").replace(/\\/g, "/")
  );
  if (extraHLSAllPaths.length === 0) {
    throw new RangeError("Nothing globbed for: “extrahls.*.normalized.json”.");
  }
  const extraStoleAllPaths = await globby(
    join(path, "extrastole.*.normalized.json").replace(/\\/g, "/")
  );
  if (extraStoleAllPaths.length === 0) {
    throw new RangeError(
      "Nothing globbed for: “extrastole.*.normalized.json”."
    );
  }
  const murmurAllPaths = await globby(
    join(path, "murmur.*.normalized.json").replace(/\\/g, "/")
  );
  if (murmurAllPaths.length === 0) {
    throw new RangeError("Nothing globbed for: “murmur.*.normalized.json”.");
  }
  const normalAllPaths = await globby(
    join(path, "normal.*.normalized.json").replace(/\\/g, "/")
  );
  if (normalAllPaths.length === 0) {
    throw new RangeError("Nothing globbed for: “normal.*.normalized.json”.");
  }

  const [artifact0, artifact1] = split(shuffle(artifactAllPaths), 3, 1);
  const [extraHLS0, extraHLS1] = split(shuffle(extraHLSAllPaths), 3, 1);
  const [extraStole0, extraStole1] = split(shuffle(extraStoleAllPaths), 3, 1);
  const [murmur0, murmur1] = split(shuffle(murmurAllPaths), 3, 1);
  const [normal0, normal1] = split(shuffle(normalAllPaths), 3, 1);

  return {
    training: shuffle([
      ...artifact0,
      ...extraHLS0,
      ...extraStole0,
      ...murmur0,
      ...normal0,
    ]),
    validation: shuffle([
      ...artifact1,
      ...extraHLS1,
      ...extraStole1,
      ...murmur1,
      ...normal1,
    ]),
  };
}
