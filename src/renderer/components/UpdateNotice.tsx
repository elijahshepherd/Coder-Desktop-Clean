import { CheckCircle2, Download, Loader2, AlertCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { desktopApi } from "../api/desktopApi";
import type { UpdateInfo, UpdateInstallResult, UpdateProgress } from "../../shared/types";

type UpdateNoticeState = "hidden" | "available" | "downloading" | "installing" | "ready" | "error";

const defaultProgress: UpdateProgress = {
  phase: "checking",
  percent: null,
  transferredBytes: 0,
  totalBytes: null,
  message: ""
};

export function UpdateNotice() {
  const [update, setUpdate] = useState<UpdateInfo | null>(null);
  const [progress, setProgress] = useState<UpdateProgress>(defaultProgress);
  const [result, setResult] = useState<UpdateInstallResult | null>(null);
  const [noticeState, setNoticeState] = useState<UpdateNoticeState>("hidden");

  useEffect(() => {
    let isMounted = true;
    const removeAvailableListener = desktopApi.onUpdateAvailable((nextUpdate) => {
      if (isMounted) {
        setUpdate(nextUpdate);
        setNoticeState("available");
      }
    });
    const removeProgressListener = desktopApi.onUpdateProgress((nextProgress) => {
      if (!isMounted) {
        return;
      }

      setProgress(nextProgress);

      if (nextProgress.phase === "downloading") {
        setNoticeState("downloading");
      } else if (nextProgress.phase === "installing") {
        setNoticeState("installing");
      } else if (nextProgress.phase === "ready") {
        setNoticeState("ready");
      } else if (nextProgress.phase === "error") {
        setNoticeState("error");
      }
    });

    const timer = window.setTimeout(() => {
      desktopApi
        .checkForUpdate()
        .then((nextUpdate) => {
          if (isMounted && nextUpdate) {
            setUpdate(nextUpdate);
            setNoticeState("available");
          }
        })
        .catch(() => {
          // Silent startup checks should not interrupt the workspace.
        });
    }, 900);

    return () => {
      isMounted = false;
      window.clearTimeout(timer);
      removeAvailableListener();
      removeProgressListener();
    };
  }, []);

  if (!update || noticeState === "hidden") {
    return null;
  }

  const isBusy = noticeState === "downloading" || noticeState === "installing";
  const isComplete = noticeState === "ready";
  const isError = noticeState === "error";
  const visiblePercent = progress.percent === null ? 42 : Math.max(0, Math.min(100, progress.percent));

  const install = async (): Promise<void> => {
    if (isBusy) {
      return;
    }

    setResult(null);

    try {
      const nextResult = await desktopApi.installUpdate();
      setResult(nextResult);
      setNoticeState("ready");
    } catch (error) {
      setProgress({
        phase: "error",
        percent: null,
        transferredBytes: 0,
        totalBytes: update.asset.sizeBytes,
        message: error instanceof Error ? error.message : String(error)
      });
      setNoticeState("error");
    }
  };

  const orbClass = isComplete ? "update-notice-orb is-complete" : isError ? "update-notice-orb is-error" : "update-notice-orb";

  return (
    <div className="update-notice" role="dialog" aria-modal="true" aria-label="Update available">
      <section className="update-notice-card">
        <span className={orbClass} aria-hidden="true">
          {isComplete ? <CheckCircle2 size={22} /> : isBusy ? <Loader2 size={22} /> : isError ? <AlertCircle size={22} /> : <Download size={22} />}
        </span>
        {isBusy ? (
          <>
            <h3>{noticeState === "installing" ? "Installing update" : "Downloading update"}</h3>
            <p>{progress.message || `Preparing ${update.latestVersion}.`}</p>
            <div className="update-notice-progress" aria-label="Download progress">
              <span style={{ width: `${visiblePercent}%` }} />
            </div>
          </>
        ) : isComplete ? (
          <>
            <h3>Download opened</h3>
            <p>{result?.message ?? "The GitHub download opened for this computer."}</p>
            <p className="update-notice-result">Coder Desktop will close when the new version starts installing.</p>
            <div className="update-notice-actions">
              <button className="primary-button" type="button" onClick={() => setNoticeState("hidden")}>
                Done
              </button>
            </div>
          </>
        ) : isError ? (
          <>
            <h3>Update paused</h3>
            <p>{progress.message || "The GitHub download could not be opened."}</p>
            <div className="update-notice-actions">
              <button className="secondary-button" type="button" onClick={() => setNoticeState("hidden")}>
                Close
              </button>
              <button className="primary-button" type="button" onClick={install}>
                Try again
              </button>
            </div>
          </>
        ) : (
          <>
            <h3>New version available</h3>
            <p>Version {update.latestVersion} is ready for this computer.</p>
            <div className="update-notice-actions">
              <button className="primary-button" type="button" onClick={install}>
                Download update
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
