import { useState } from 'react';
import { useTranslation } from 'react-i18next';

type CompareMode = 'side-by-side' | 'overlay';

interface Props {
  actualUrl: string;
  baselineUrl: string;
  overlayUrl?: string | null;
  alt?: string;
  initialMode?: CompareMode;
}

export function ScreenshotCompare({
  actualUrl,
  baselineUrl,
  overlayUrl,
  alt,
  initialMode = 'side-by-side',
}: Props) {
  const { t } = useTranslation();
  const hasOverlay = Boolean(overlayUrl);
  const [mode, setMode] = useState<CompareMode>(
    !hasOverlay && initialMode === 'overlay' ? 'side-by-side' : initialMode,
  );

  return (
    <div className="screenshot-compare">
      <div className="screenshot-compare-toolbar">
        <button
          type="button"
          className={`btn btn-sm ${mode === 'side-by-side' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setMode('side-by-side')}
        >
          {t('compare.sideBySide')}
        </button>
        <button
          type="button"
          className={`btn btn-sm ${mode === 'overlay' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setMode('overlay')}
          disabled={!hasOverlay}
          title={!hasOverlay ? t('compare.overlayUnavailable') : undefined}
        >
          {t('compare.overlay')}
        </button>
      </div>

      {mode === 'side-by-side' ? (
        <div className="screenshot-compare-grid">
          <figure className="screenshot-compare-pane">
            <figcaption>{t('compare.baseline')}</figcaption>
            <img
              src={baselineUrl}
              alt={alt ? `${alt} — baseline` : t('compare.baseline')}
              className="screenshot-img"
            />
          </figure>
          <figure className="screenshot-compare-pane">
            <figcaption>{t('compare.actual')}</figcaption>
            <img
              src={actualUrl}
              alt={alt ? `${alt} — actual` : t('compare.actual')}
              className="screenshot-img"
            />
          </figure>
        </div>
      ) : (
        <img
          src={overlayUrl ?? actualUrl}
          alt={alt ?? t('compare.overlay')}
          className="screenshot-img"
        />
      )}
    </div>
  );
}
