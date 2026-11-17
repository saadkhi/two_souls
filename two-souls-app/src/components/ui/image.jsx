import { forwardRef } from 'react';
export const Image = forwardRef(function Image({ fittingType, focalPoint, quality, aspectRatio, onSourceChange, style, ...props }, ref) {
  return <img ref={ref} style={{ aspectRatio, ...style }} {...props} />;
});
export default Image;
