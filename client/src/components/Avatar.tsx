import { clsx, initials } from '../lib/format';

type Props = {
  name: string;
  hue: number;
  size?: 'sm' | 'md' | 'lg';
  host?: boolean;
  offline?: boolean;
  title?: string;
};

export function Avatar({ name, hue, size = 'md', host = false, offline = false, title }: Props) {
  return (
    <span
      className={clsx(
        'avatar',
        size === 'sm' && 'avatar--sm',
        size === 'lg' && 'avatar--lg',
        offline && 'avatar--off',
      )}
      style={{ '--hue': String(hue) } as React.CSSProperties}
      title={title ?? name}
      aria-hidden="true"
    >
      {initials(name)}
      {host && <span className="avatar__crown">👑</span>}
    </span>
  );
}
