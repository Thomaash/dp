export function logFailure(msg: string, logData?: any): (error: Error) => void {
  return (error): void => {
    console.error(msg, logData);
    console.error(error);
  };
}
