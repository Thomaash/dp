import { CurryLog } from "./curry-log";
import { MapCounter, Progress } from "./util";
import { OTAPI } from "./otapi";

export async function testConnection(
  log: CurryLog,
  otapi: OTAPI,
  amountSerial: number,
  amountParallel: number
): Promise<void> {
  await testConnectionPartial(log, otapi, amountSerial, "serial", testSerial);

  await testConnectionPartial(
    log,
    otapi,
    amountParallel,
    "parallel",
    testParallel
  );
}

async function testConnectionPartial(
  log: CurryLog,
  otapi: OTAPI,
  amount: number,
  testType: string,
  testFunction: (
    otapi: OTAPI,
    amount: number,
    oneDone: (kind: string) => void
  ) => Promise<MapCounter<string>>
): Promise<void> {
  if (amount > 0) {
    log.info(`Running ${testType} connection test...`);

    await prepareTimes(otapi, amount);

    const progress = new Progress(
      log,
      `${
        testType.slice(0, 1).toUpperCase() + testType.slice(1)
      } connection test: `
    )
      .setTotal(amount)
      .start();

    const results = await testFunction(
      otapi,
      amount,
      progress.finish.bind(progress)
    );

    progress.stop();

    logResults(log, results, amount);
  }
}

async function prepareTimes(otapi: OTAPI, amount: number): Promise<void> {
  await otapi.send("setSimulationStartTime", { time: 0 });
  await otapi.send("setSimulationPauseTime", { time: 0 });
  await otapi.send("setSimulationEndTime", { time: amount + 1 });
}

async function testSerial(
  otapi: OTAPI,
  amount: number,
  oneDone: (kind: string) => void
): Promise<MapCounter<string>> {
  const results = new MapCounter<string>();

  for (let i = 0; i < amount; ++i) {
    try {
      await otapi.send("setSimulationPauseTime", { time: i + 1 }, false);
      oneDone("okay");
    } catch (error) {
      results.get(error.code).inc();
      oneDone(error.code);
    }
  }

  return results;
}

async function testParallel(
  otapi: OTAPI,
  amount: number,
  oneDone: (kind: string) => void
): Promise<MapCounter<string>> {
  const results = new MapCounter<string>();

  await Promise.all(
    new Array(amount).fill(null).map(
      async (_value, i): Promise<void> => {
        try {
          await otapi.send("setSimulationPauseTime", { time: i + 1 }, false);
          oneDone("okay");
        } catch (error) {
          results.get(error.code).inc();
          oneDone(error.code);
        }
      }
    )
  );

  return results;
}

function logResults(
  log: CurryLog,
  results: MapCounter<string>,
  amount: number
): void {
  let failed = 0;
  for (const [code, counter] of results) {
    failed += counter.get();
    log.warn(`${code}: ${counter.get()} (${(counter.get() / amount) * 100}%)`);
  }

  if (failed > 0) {
    log.warn(`Failed: ${failed} (${(failed / amount) * 100}%)`);
    throw new Error("Connection test failed.");
  } else {
    log.info("Connection test finished without a single failure.");
  }
}
