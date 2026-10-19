/** Display curves used by the installed native graph (Obsidian 1.14). */
export const MIN_ZOOM = 1 / 128;
export const MAX_ZOOM = 8;
export const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
export const nodeScale = (zoom: number) => 1 / Math.sqrt(zoom);
export const labelOpacity = (zoom: number, threshold: number) => clamp(Math.log2(zoom) + 1 - threshold, 0, 1);
export const nodeRadius = (degree: number, multiplier: number) => multiplier * clamp(3 * Math.sqrt(degree + 1), 8, 30);
export const forceFromSlider = (value: number) => (Math.pow(0.01, 1 - value) - 0.01) / 0.99;
export const forceToSlider = (value: number) => 1 - Math.log(clamp(value, 0, 1) * 0.99 + 0.01) / Math.log(0.01);
export const wheelZoom = (scale: number, delta: number, mode: number) =>
    clamp(scale * Math.pow(1.5, -delta * (mode === 1 ? 40 : mode === 2 ? 800 : 1) / 120), MIN_ZOOM, MAX_ZOOM);
