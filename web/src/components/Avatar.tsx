// A small circular avatar: the user's image if present, else a colored initial.
const COLORS = ["#00897B", "#E65100", "#5E35B1", "#00838F", "#AD1457", "#2E7D32", "#4527A0"];

function colorFor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return COLORS[Math.abs(h) % COLORS.length];
}

export function Avatar({
  name,
  image,
  size = 32,
}: {
  name: string | null | undefined;
  image?: string | null;
  size?: number;
}) {
  const label = (name || "?").trim();
  const initial = label.charAt(0).toUpperCase() || "?";
  if (image) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={image}
        alt={label}
        width={size}
        height={size}
        className="rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full font-medium text-white"
      style={{ width: size, height: size, background: colorFor(label), fontSize: size * 0.42 }}
    >
      {initial}
    </div>
  );
}
