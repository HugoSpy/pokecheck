import { patchNotes, isDevEnv } from '../data/patchnotes';
import './PatchNotes.css';

interface Props {
  onClose: () => void;
}

const DEV_ENTRY = {
  version: 'DEV',
  date: 'branche dev',
  items: ["Ceci est l'environnement de développement, pas la production."],
};

export default function PatchNotesModal({ onClose }: Props) {
  const entries = isDevEnv ? [DEV_ENTRY, ...patchNotes] : patchNotes;

  return (
    <div className="patchnotes-overlay" onClick={onClose}>
      <div className="patchnotes-modal" onClick={e => e.stopPropagation()}>
        <div className="patchnotes-header">
          <h2>Patch Notes</h2>
          <button onClick={onClose} className="patchnotes-close" aria-label="Fermer">×</button>
        </div>

        <div className="patchnotes-list">
          {entries.map(patch => {
            const isDev = patch.version === 'DEV';
            return (
              <div key={patch.version} className={`patchnotes-entry${isDev ? ' patchnotes-entry--dev' : ''}`}>
                <div className="patchnotes-entry-head">
                  <span className={`patchnotes-version${isDev ? ' patchnotes-version--dev' : ''}`}>{patch.version}</span>
                  <span className="patchnotes-date">{patch.date}</span>
                </div>
                <ul className="patchnotes-items">
                  {patch.items.map((item, i) => (
                    <li key={i}>
                      <span className={`patchnotes-bullet${isDev ? ' patchnotes-bullet--dev' : ''}`}>•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
