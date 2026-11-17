import { Link } from 'react-router-dom';

export default function AnnouncementBar({ announcement }) {
  if (!announcement || announcement.active === false || !announcement.text) return null;

  const now = Date.now();
  const starts = announcement.startDate ? new Date(announcement.startDate).getTime() : null;
  const ends = announcement.endDate ? new Date(announcement.endDate).getTime() : null;
  if (starts && now < starts) return null;
  if (ends && now > ends) return null;

  return (
    <div
      className="w-full text-center"
      style={{
        backgroundColor: announcement.bgColor || '#171717',
        color: announcement.textColor || '#F5F0E7',
      }}
    >
      <div className="mx-auto flex max-w-[1600px] items-center justify-center gap-4 px-5 py-2.5">
        <p className="text-[10px] uppercase tracking-[0.28em] sm:text-[11px]">{announcement.text}</p>
        {announcement.ctaLabel && announcement.ctaLink ? (
          <Link
            to={announcement.ctaLink}
            className="hidden border-b border-current pb-0.5 text-[10px] uppercase tracking-[0.28em] opacity-80 transition-opacity hover:opacity-100 sm:inline"
          >
            {announcement.ctaLabel}
          </Link>
        ) : null}
      </div>
    </div>
  );
}