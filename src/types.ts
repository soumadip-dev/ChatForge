export type Puzzle = {
  id: number;
  title: string;
  story: string;
  question: string;
  expectedCode: string;
  expectedOutput: string;
  hints: string[];
  simplifiedVersion: string;
  simplifiedExpected: string;
  simplifiedExpectedOutput: string;
  simplifiedValidationCode?: string;
  setupCode?: string;
  validationCode?: string;
  returnsExpression?: boolean;
  starterCode: string;
  explanation: string;
  practiceProblem: string;
};
