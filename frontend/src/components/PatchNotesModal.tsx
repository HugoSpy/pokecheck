import { patchNotes } from '../data/patchnotes';
import './PatchNotes.css';

interface Props {
  onClose: () => void;
}

export default function PatchNotesModal({ onClose }: Props) {
  return (
    <div className="patchnotes-overlay" onClick={onClose}>
      <div className="patchnotes-modal" onClick={e => e.stopPropagation()}>
        <div className="patchnotes-header">
          <h2>Patch Notes</h2>
          <button onClick={onClose} className="patchnotes-close" aria-label="Fermer">×</button>
        </div>

        <div className="patchnotes-list">
          {patchNotes.map(patch => (
            <div key={patch.version} className="patchnotes-entry">
              <div className="patchnotes-entry-head">
                <span className="patchnotes-version">{patch.version}</span>
                <span className="patchnotes-date">{patch.date}</span>
              </div>
              <ul className="patchnotes-items">
                {patch.items.map((item, i) => (
                  <li key={i}>
                    <span className="patchnotes-bullet">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
