declare module 'html5-qrcode' {
  export class Html5QrcodeScanner {
    constructor(
      elementId: string,
      config: {
        fps: number;
        qrbox: number;
        aspectRatio?: number;
      },
      verbose: boolean
    );

    render(
      successCallback: (decodedText: string) => void,
      errorCallback: (errorMessage: string) => void
    ): void;

    clear(): Promise<void>;
  }
} 