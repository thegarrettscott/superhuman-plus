import { useGesture } from 'react-use-gesture';
import { useIsMobile } from './use-mobile';

interface SwipeHandlers {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
}

export function useSwipeGestures(handlers: SwipeHandlers) {
  const isMobile = useIsMobile();

  const bind = useGesture({
    onDrag: ({ direction: [dx, dy], distance, cancel }) => {
      if (!isMobile) return;
      
      // Minimum distance for swipe detection
      const threshold = 50;
      
      if (distance > threshold) {
        // Horizontal swipes
        if (Math.abs(dx) > Math.abs(dy)) {
          if (dx > 0 && handlers.onSwipeRight) {
            handlers.onSwipeRight();
            cancel();
          } else if (dx < 0 && handlers.onSwipeLeft) {
            handlers.onSwipeLeft();
            cancel();
          }
        }
        // Vertical swipes
        else {
          if (dy > 0 && handlers.onSwipeDown) {
            handlers.onSwipeDown();
            cancel();
          } else if (dy < 0 && handlers.onSwipeUp) {
            handlers.onSwipeUp();
            cancel();
          }
        }
      }
    }
  }, {
    drag: {
      filterTaps: true,
      axis: undefined
    }
  });

  return bind;
}