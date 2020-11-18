export class Bug extends Error {
  public constructor(message: string) {
    super(
      message +
        "\n\nIf you see this you've found a bug. " +
        "Report it and include as much information as possible (stacktrace, configuration, model etc.), thanks."
    );
  }
}
