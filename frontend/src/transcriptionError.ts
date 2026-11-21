import { t } from "./i18n";
import { BackendError } from "./api/training";

const reasons: Record<string, string> = {
  transcription_not_configured: "practice.transcriptionNotConfiguredServer",
  transcription_timeout: "practice.transcriptionServiceDidNot",
  transcription_connection: "practice.serverLostConnectionTranscription",
  transcription_empty: "practice.modelReturnedEmptyTranscript",
  transcription_invalid_response: "practice.modelReturnedInvalidResponse",
  transcription_unexpected_script: "practice.modelReturnedTextContaining",
  transcription_audio_rejected: "practice.transcriptionServiceRejectedRecording",
  transcription_provider_auth: "practice.transcriptionServiceDeniedServer",
  transcription_rate_limit: "practice.transcriptionServiceReportedRate",
  transcription_provider_error: "practice.transcriptionServiceReturnedError",
};

export function transcriptionErrorMessage(error: unknown): string {
  let reason = "practice.causeCouldNotDetermined";
  if (error instanceof BackendError) {
    reason =
      (error.code && reasons[error.code]) ||
      (
        {
          401: "practice.sessionExpiredSignAgain",
          403: "practice.noAccessTranscription",
          404: "practice.exerciseNoLongerAvailable",
          413: "practice.recordingTooLargeRecord",
          415: "practice.recordingEmptyItsFormat",
          422: "practice.serverRejectedRequestData",
          429: "practice.tooManyRequestsWait",
        } as Record<number, string>
      )[error.status] ||
      t("practice.transcription.httpError", { status: error.status });
  } else if ((error instanceof Error || error instanceof DOMException) && error.name === "TimeoutError") {
    reason = "practice.serverDidNotRespond";
  } else if (error instanceof TypeError) {
    reason = "practice.couldNotReachServer";
  } else if ((error instanceof Error || error instanceof DOMException) && error.name === "AbortError") {
    reason = "practice.transcriptionRequestWasInterrupted";
  }
  // Resolved now, in the current language: the message is shown as is (t() leaves translated text alone).
  return t("practice.transcription.failed", { reason: t(reason) });
}
