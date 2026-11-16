import Image from "next/image";

/**
 * Team logo on a plate that's transparent in light mode and a soft light
 * circle in dark mode, so dark logos don't disappear into dark cards.
 */
export default function TeamLogo({ team, size }) {
  const plate = Math.round(size * 1.3);

  return (
    <span
      className="inline-grid place-items-center shrink-0 rounded-full bg-logo-plate"
      style={{ width: plate, height: plate }}
    >
      <Image
        src={team.logo}
        alt={team.mascot || team.name}
        width={size}
        height={size}
        style={{ width: size, height: size }}
        className="object-contain"
      />
    </span>
  );
}
