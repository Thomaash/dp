function pad(number: number): string {
  return ("" + number).padStart(2, "0");
}
export function formatSimulationTime(
  simulationTime: number,
  ms = false
): string {
  const seconds = ms ? simulationTime % 60 : Math.round(simulationTime % 60);
  const secondsRest = Math.floor(simulationTime / 60);

  const minutes = secondsRest % 60;
  const minutesRest = Math.floor(secondsRest / 60);

  const hours = minutesRest % 24;
  const hoursRest = Math.floor(minutesRest / 24);

  const days = hoursRest % 86400;

  return `${days}d ${pad(hours)}:${pad(minutes)}:${pad(seconds)} (${
    ms ? simulationTime : Math.round(simulationTime)
  }s)`;
}
