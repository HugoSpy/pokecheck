import { useState } from 'react';
import PatchNotesModal from './PatchNotesModal';
import './PatchNotes.css';

export default function PatchNotesButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="patchnotes-button"
        title="Patch notes"
        aria-label="Patch notes"
      >
        ?
      </button>
      {open && <PatchNotesModal onClose={() => setOpen(false)} />}
    </>
  );
}
