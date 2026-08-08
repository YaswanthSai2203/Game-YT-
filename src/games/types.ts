/** Contract every mini-game module must implement for the arcade portal. */
export interface GameLaunchOptions {
  onExitToHub?: () => void;
}

export interface GameHandle {
  destroy(): void;
  handlePlayablesPause(): void;
  handlePlayablesResume(): void;
  handlePlayablesAudio(enabled: boolean): void;
}

export interface GameModule {
  launch(container: HTMLElement, options?: GameLaunchOptions): Promise<GameHandle>;
}
