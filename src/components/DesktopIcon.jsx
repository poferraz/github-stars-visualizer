import { audio } from '../utils/audio';

export default function DesktopIcon({ title, icon, isSelected, onClick, onDoubleClick }) {
  const handleSingleClick = (e) => {
    e.stopPropagation();
    audio.playClick();
    onClick();
  };

  const handleDoubleClick = (e) => {
    e.stopPropagation();
    onDoubleClick();
  };

  return (
    <div
      className={`desktop-icon ${isSelected ? 'selected' : ''}`}
      role="button"
      tabIndex={0}
      aria-label={title}
      onClick={handleSingleClick}
      onDoubleClick={handleDoubleClick}
      onKeyDown={(e) => {
        // Keyboard activation = double-click (open), matching desktop idiom
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          e.stopPropagation();
          audio.playClick();
          onDoubleClick();
        }
      }}
    >
      <div className="desktop-icon-img" style={{ fontSize: '26px' }}>
        {icon}
      </div>
      <div className="desktop-icon-text" style={{ fontFamily: 'var(--font-os)' }}>
        {title}
      </div>
    </div>
  );
}
