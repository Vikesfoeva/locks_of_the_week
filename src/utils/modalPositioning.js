import React from 'react';

/**
 * Utility functions for smart modal positioning that handles viewport boundaries,
 * scrolling, and responsive behavior
 */

/**
 * Calculate optimal position for a modal relative to a trigger element
 * @param {DOMRect} triggerRect - Bounding rectangle of trigger element
 * @param {Object} modalDimensions - {width, height} of the modal
 * @param {Object} options - Configuration options
 * @returns {Object} Position object with top, left, and placement info
 */
export function calculateModalPosition(triggerRect, modalDimensions = { width: 256, height: 400 }, options = {}) {
  const {
    preferredPlacement = 'bottom-start', // bottom-start, bottom-end, top-start, top-end, etc.
    offset = 4,
    boundary = { top: 8, right: 8, bottom: 8, left: 8 }, // Minimum distance from viewport edges
    allowFlip = true, // Allow flipping to opposite side if no space
    allowShift = true, // Allow shifting horizontally/vertically to stay in bounds
  } = options;

  const viewport = {
    width: window.innerWidth,
    height: window.innerHeight,
    scrollX: window.scrollX,
    scrollY: window.scrollY,
  };

  // Convert trigger rect to fixed positioning coordinates
  const trigger = {
    top: triggerRect.top,
    left: triggerRect.left,
    right: triggerRect.right,
    bottom: triggerRect.bottom,
    width: triggerRect.width,
    height: triggerRect.height,
  };

  let position = { top: 0, left: 0, placement: preferredPlacement };

  // Calculate initial position based on preferred placement
  switch (preferredPlacement) {
    case 'bottom-start':
      position.top = trigger.bottom + offset;
      position.left = trigger.left;
      break;
    case 'bottom-end':
      position.top = trigger.bottom + offset;
      position.left = trigger.right - modalDimensions.width;
      break;
    case 'top-start':
      position.top = trigger.top - modalDimensions.height - offset;
      position.left = trigger.left;
      break;
    case 'top-end':
      position.top = trigger.top - modalDimensions.height - offset;
      position.left = trigger.right - modalDimensions.width;
      break;
    case 'right-start':
      position.top = trigger.top;
      position.left = trigger.right + offset;
      break;
    case 'left-start':
      position.top = trigger.top;
      position.left = trigger.left - modalDimensions.width - offset;
      break;
    default:
      // Default to bottom-start
      position.top = trigger.bottom + offset;
      position.left = trigger.left;
      break;
  }

  // Check if modal would go outside viewport boundaries
  const modalBounds = {
    top: position.top,
    left: position.left,
    right: position.left + modalDimensions.width,
    bottom: position.top + modalDimensions.height,
  };

  // Flip vertically if no space and flipping is allowed
  if (allowFlip) {
    if (modalBounds.bottom > viewport.height - boundary.bottom && 
        trigger.top - modalDimensions.height - offset > boundary.top) {
      // Flip to top
      if (preferredPlacement.startsWith('bottom')) {
        position.top = trigger.top - modalDimensions.height - offset;
        position.placement = preferredPlacement.replace('bottom', 'top');
      }
    } else if (modalBounds.top < boundary.top && 
               trigger.bottom + modalDimensions.height + offset < viewport.height - boundary.bottom) {
      // Flip to bottom
      if (preferredPlacement.startsWith('top')) {
        position.top = trigger.bottom + offset;
        position.placement = preferredPlacement.replace('top', 'bottom');
      }
    }

    // Flip horizontally if no space
    if (modalBounds.right > viewport.width - boundary.right && 
        trigger.left - modalDimensions.width - offset > boundary.left) {
      // Flip to left
      if (preferredPlacement.includes('right')) {
        position.left = trigger.left - modalDimensions.width - offset;
        position.placement = position.placement.replace('right', 'left');
      }
    } else if (modalBounds.left < boundary.left && 
               trigger.right + modalDimensions.width + offset < viewport.width - boundary.right) {
      // Flip to right
      if (preferredPlacement.includes('left')) {
        position.left = trigger.right + offset;
        position.placement = position.placement.replace('left', 'right');
      }
    }
  }

  // Shift to stay within bounds if shifting is allowed
  if (allowShift) {
    // Recalculate bounds after potential flipping
    const newModalBounds = {
      top: position.top,
      left: position.left,
      right: position.left + modalDimensions.width,
      bottom: position.top + modalDimensions.height,
    };

    // Shift horizontally
    if (newModalBounds.right > viewport.width - boundary.right) {
      position.left = viewport.width - modalDimensions.width - boundary.right;
    }
    if (newModalBounds.left < boundary.left) {
      position.left = boundary.left;
    }

    // Shift vertically
    if (newModalBounds.bottom > viewport.height - boundary.bottom) {
      position.top = viewport.height - modalDimensions.height - boundary.bottom;
    }
    if (newModalBounds.top < boundary.top) {
      position.top = boundary.top;
    }
  }

  return position;
}

/**
 * Hook for managing modal position with automatic updates
 * @param {React.RefObject} triggerRef - Reference to trigger element
 * @param {boolean} isOpen - Whether modal is open
 * @param {Object} options - Configuration options
 * @returns {Object} Position object and update function
 */
export function useModalPosition(triggerRef, isOpen, options = {}) {
  const [position, setPosition] = React.useState({ top: 0, left: 0, placement: 'bottom-start' });

  const updatePosition = React.useCallback(() => {
    if (!triggerRef.current || !isOpen) return;

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const newPosition = calculateModalPosition(triggerRect, options.modalDimensions, options);
    setPosition(newPosition);
  }, [triggerRef, isOpen, options]);

  // Update position when modal opens or trigger changes
  React.useEffect(() => {
    if (isOpen) {
      updatePosition();
    }
  }, [isOpen, updatePosition]);

  // Add scroll and resize listeners
  React.useEffect(() => {
    if (!isOpen) return;

    const handlePositionUpdate = () => {
      updatePosition();
    };

    // Throttle the position updates for performance
    let timeoutId;
    const throttledUpdate = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(handlePositionUpdate, 16); // ~60fps
    };

    window.addEventListener('scroll', throttledUpdate, { passive: true });
    window.addEventListener('resize', throttledUpdate);

    return () => {
      window.removeEventListener('scroll', throttledUpdate);
      window.removeEventListener('resize', throttledUpdate);
      clearTimeout(timeoutId);
    };
  }, [isOpen, updatePosition]);

  return { position, updatePosition };
}

/**
 * Create a portal container for modals with proper positioning
 * @returns {HTMLElement} Portal container element
 */
export function createModalPortalContainer() {
  let container = document.getElementById('modal-portal-container');
  
  if (!container) {
    container = document.createElement('div');
    container.id = 'modal-portal-container';
    container.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      pointer-events: none;
      z-index: 1000;
    `;
    document.body.appendChild(container);
  }
  
  return container;
}
