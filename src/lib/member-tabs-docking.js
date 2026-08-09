export function getMemberTabsDockPosition({
  anchorTop,
  scrollTop,
  scrollLeft,
  scrollWidth,
  height,
}) {
  const values = [anchorTop, scrollTop, scrollLeft, scrollWidth, height];

  if (!values.every(Number.isFinite) || anchorTop > scrollTop + 0.5) {
    return null;
  }

  return {
    top: scrollTop,
    left: scrollLeft,
    width: scrollWidth,
    height,
  };
}
