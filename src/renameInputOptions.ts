export interface RenameInputOptions {
  prompt: string;
  placeHolder: string;
  value: string;
  valueSelection: [number, number];
  ignoreFocusOut: boolean;
  validateInput(value: string): string | undefined;
}

export interface RenameInputOptionsRequest {
  currentName: string;
  prompt: string;
  placeHolder: string;
  requiredMessage: string;
  pathSeparatorMessage: string;
}

export function createRenameInputOptions(request: RenameInputOptionsRequest): RenameInputOptions {
  return {
    prompt: request.prompt,
    placeHolder: request.placeHolder,
    value: request.currentName,
    valueSelection: [0, request.currentName.length],
    ignoreFocusOut: true,
    validateInput(value) {
      const trimmed = value.trim();
      if (trimmed.length === 0) {
        return request.requiredMessage;
      }

      if (trimmed.includes("/") || trimmed.includes("\\")) {
        return request.pathSeparatorMessage;
      }

      return undefined;
    },
  };
}
