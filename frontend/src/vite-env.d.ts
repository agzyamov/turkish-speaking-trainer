/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Release version of a production build, set by the deploy job (ADR-0011). */
  readonly VITE_APP_VERSION?: string;
  /**
   * "true" only in the simulator test build (`scripts/build-ios.sh sim`, ADR-0014): the recorder plays a
   * bundled phrase instead of the microphone and the transcription request is answered on the device.
   */
  readonly VITE_TEST_AUDIO?: string;
}
