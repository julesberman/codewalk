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

export interface WalkthroughSummary {
  fileName: string;
  relativePath: string;
  title: string;
  description?: string;
  error?: WalkthroughErrorState;
}

export interface Walkthrough extends WalkthroughSummary {
  steps: WalkthroughStep[];
}

export interface WalkthroughErrorState {
  title: string;
  detail: string;
  fileName?: string;
}

export interface PlaybackState {
  walkthrough: Walkthrough;
  currentStepIndex: number;
  explanationPanelVisible: boolean;
}
