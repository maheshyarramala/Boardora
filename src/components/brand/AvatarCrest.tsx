import type { AvatarId } from '../../core/types';

export const AVATAR_OPTIONS: readonly { id: AvatarId; label: string }[] = [
  { id: 'royal-knight', label: 'Royal Knight' },
  { id: 'golden-crown', label: 'Sovereign Crown' },
  { id: 'compass-rose', label: 'Grand Navigator' },
  { id: 'emerald-dice', label: 'Emerald Die' },
  { id: 'ruby-rook', label: 'Crimson Rook' },
  { id: 'sapphire-wheel', label: 'Sapphire Compass' },
];

export function AvatarCrest({
  avatarId,
  size = 44,
}: {
  avatarId: AvatarId;
  size?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      className="shrink-0 rounded-xl"
      aria-hidden="true"
    >
      <rect
        x="1.5"
        y="1.5"
        width="45"
        height="45"
        rx="11"
        fill="#08172F"
        stroke="#D6AD55"
        strokeOpacity="0.72"
        strokeWidth="2"
      />
      {avatarId === 'royal-knight' && (
        <g>
          <path d="M18 14L17 10L21 12L24 9L27 12L31 10L30 14H18Z" fill="#D6AD55" />
          <path
            d="M16 36H32V39H16V36ZM17 34C17 29.8 19.2 27 21.8 25L18.5 25L15.2 23.8L14.8 21.6L19.5 18L20.5 15.2L22.5 17.2L24.5 15.2L25.6 16.8C29.5 17.4 32.5 20.8 33.2 26C33.6 29.5 32.2 32.2 31.6 34H17Z"
            fill="#F4EBDD"
          />
          <path d="M19.8 19.6L21.2 19L21.6 20L20.1 20.3Z" fill="#08172F" />
        </g>
      )}
      {avatarId === 'golden-crown' && (
        <path
          d="M11 34H37V37H11V34ZM12 31L10 17L19 23L24 12L29 23L38 17L36 31H12Z"
          fill="#D6AD55"
        />
      )}
      {avatarId === 'compass-rose' && (
        <g stroke="#D6AD55" strokeWidth="1.8" strokeLinejoin="round">
          <circle cx="24" cy="24" r="13" strokeOpacity="0.45" />
          <path d="M24 9L28 20L39 24L28 28L24 39L20 28L9 24L20 20L24 9Z" fill="#D6AD55" fillOpacity="0.38" />
          <circle cx="24" cy="24" r="2.5" fill="#F4EBDD" />
        </g>
      )}
      {avatarId === 'emerald-dice' && (
        <g>
          <rect x="13" y="13" width="22" height="22" rx="5" fill="#269C68" stroke="#D6AD55" strokeWidth="1.8" />
          <circle cx="19" cy="19" r="2.1" fill="#F4EBDD" />
          <circle cx="24" cy="24" r="2.1" fill="#F4EBDD" />
          <circle cx="29" cy="29" r="2.1" fill="#F4EBDD" />
        </g>
      )}
      {avatarId === 'ruby-rook' && (
        <path
          d="M15 36H33V39H15V36ZM17 34L19 20H29L31 34H17ZM16 18V11H20V14H22.5V11H25.5V14H28V11H32V18H16Z"
          fill="#D94343"
          stroke="#D6AD55"
          strokeWidth="1.2"
        />
      )}
      {avatarId === 'sapphire-wheel' && (
        <g stroke="#2865C7" strokeWidth="2.4">
          <circle cx="24" cy="24" r="12" />
          <circle cx="24" cy="24" r="4" fill="#D6AD55" stroke="none" />
          <path d="M24 12V20M24 28V36M12 24H20M28 24H36" stroke="#F4EBDD" strokeWidth="1.8" />
        </g>
      )}
    </svg>
  );
}
