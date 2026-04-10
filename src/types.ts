export interface WalkthroughRange {
  start: number;
  end: number;
}

export interface WalkthroughStep {
  title: string;
  file: string;
  range: WalkthroughRange;
  explanation: string;
}

export interface WalkthroughDocument {
  title: string;
  description?: string;
  steps: WalkthroughStep[];
}

export interface WalkthroughSummary {
  id: string;
  fileName: string;
  relativePath: string;
  title: string;
  description?: string;
}

export interface WalkthroughFile extends WalkthroughSummary {
  absolutePath: string;
}

export interface ValidatedWalkthrough extends WalkthroughFile, WalkthroughDocument {}

export interface WalkthroughErrorState {
  title: string;
  detail: string;
  fileName?: string;
}

export interface PlaybackState {
  walkthrough: ValidatedWalkthrough;
  currentStepIndex: number;
}

export interface RangeLineInfo {
  lineCount: number;
}
