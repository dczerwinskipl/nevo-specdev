/** A single line of progress from an orchestration use case. */
export interface ActionEvent {
  readonly level: 'info' | 'warn';
  readonly message: string;
}

export const info = (message: string): ActionEvent => ({ level: 'info', message });
export const warn = (message: string): ActionEvent => ({ level: 'warn', message });
