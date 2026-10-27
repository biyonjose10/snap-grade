// A sample internal test the mock scripts are written against. Teachers can edit it in the app.
import type { TestPaper } from "./types";

export const SAMPLE_TEST: TestPaper = {
  title: "Basic Electrical Engineering — Internal Test 1",
  questions: [
    {
      no: "1",
      maxMarks: 2,
      prompt: "State Ohm's law.",
      rubric: "At constant temperature, current through a conductor is directly proportional to the voltage across it (1). V = IR, with units or symbols named (1).",
    },
    {
      no: "2",
      maxMarks: 2,
      prompt: "Define the RMS value of an alternating current.",
      rubric:
        "The steady (DC) current that produces the same heat in a resistor in the same time as the AC (1). For a sine wave, I_rms = I_max / √2 ≈ 0.707 I_max (1).",
    },
    {
      no: "3",
      maxMarks: 4,
      prompt: "Differentiate between series and parallel circuits, with one example of each.",
      rubric:
        "Series: same current, voltages add, one path, one break stops all (1). Parallel: same voltage, currents add, independent branches (1). Equivalent resistance: series R = R1 + R2, parallel 1/R = 1/R1 + 1/R2 (1). One valid example each, e.g. decorative lights in series, household wiring in parallel (1).",
    },
    {
      no: "4",
      maxMarks: 2,
      prompt: "Find the equivalent resistance of 4 Ω and 6 Ω connected in parallel.",
      rubric: "Correct method 1/R = 1/4 + 1/6 or R = (4×6)/(4+6) (1). Answer 2.4 Ω with unit (1). Correct answer without working: 1.",
    },
  ],
};
