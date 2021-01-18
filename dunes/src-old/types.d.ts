declare module "ccwt.js" {
  interface CCWT {
    /**
     * Compute forward 1d fft.
     *
     * @param input - Source signal data.
     * @param padding - Amount of padding to add to the signal (get rid of oddities due to signal ends).
     * @param inputGain - Signal gain amount to apply before transform.
     *
     * @return Resulting fourier transformed signal eg. [real, imag...].
     */
    fft1d(
      input: Float32Array,
      padding: number,
      inputGain: number
    ): Float32Array;

    /**
     * Generate custom frequency band; first column are the frequencies and the second their derivatives.
     *
     * @param bandLength - Length of frequency band.
     * @param frequencyRange - Frequencies range.
     * @param frequencyOffset - Base frequency.
     * @param frequencyBasis - > 0.0 to generate exponential frequency band.
     * @param deviation - Frequency / time resolution (values near zero have better frequency resolution, values towards infinity have better time resolution, 1 is a good tradeoff).
     *
     * @return Generated frequency band.
     */
    frequencyBand(
      bandLength: number,
      frequencyRange: number,
      frequencyOffset: number,
      frequencyBasis: number,
      deviation: number
    ): Float32Array;

    /**
     * @param inputTransformedSignal - Fourier transformed signal from fft1d result eg. [real, imag...].
     * @param padding - Amount of padding in the signal.
     * @param frequencyBand - Frequency band from frequencyBand function.
     * @param startY - When to start (typically used to split workload otherwise can be 0).
     * @param endY - When to end (typically used with start_y to split workload).
     * @param outputWidth - Row width.
     * @param rowCallback - Function to be called when a row is done, it contain vertical position, output data (Float32Array of complex) and computed output padding as argument.
     */
    numericOutput(
      inputTransformedSignal,
      padding: number,
      frequencyBand: Float32Array,
      startY: number,
      endY: number,
      outputWidth: number,
      rowCallback: (
        y: number,
        rowData: Float32Array,
        outputPadding: number
      ) => void
    ): void;
  }

  declare const CCWTPromise: Promise<CCWT>;

  export = CCWTPromise;
}
