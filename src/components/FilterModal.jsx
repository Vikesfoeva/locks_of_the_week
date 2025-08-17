import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { calculateModalPosition, createModalPortalContainer } from '../utils/modalPositioning';

/**
 * Improved FilterModal component with smart positioning and responsive behavior
 */
const FilterModal = ({
  isOpen,
  onClose,
  triggerRef,
  title,
  items = [],
  selectedItems = [],
  onSelectionChange,
  searchValue = '',
  onSearchChange,
  className = '',
  modalDimensions = { width: 256, height: 400 },
  placement = 'bottom-start',
  ...props
}) => {
  const modalRef = useRef(null);
  const [position, setPosition] = useState({ top: 0, left: 0, placement });
  const [portalContainer, setPortalContainer] = useState(null);

  // Initialize portal container
  useEffect(() => {
    const container = createModalPortalContainer();
    setPortalContainer(container);
  }, []);

  // Update position when modal opens or dependencies change
  const updatePosition = React.useCallback(() => {
    if (!triggerRef?.current || !isOpen) return;

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const newPosition = calculateModalPosition(triggerRect, modalDimensions, {
      preferredPlacement: placement,
      offset: 4,
      boundary: { top: 8, right: 8, bottom: 8, left: 8 },
      allowFlip: true,
      allowShift: true,
    });
    setPosition(newPosition);
  }, [triggerRef, isOpen, modalDimensions, placement]);

  // Update position on open
  useEffect(() => {
    if (isOpen) {
      // Use requestAnimationFrame to ensure DOM is ready
      requestAnimationFrame(() => {
        updatePosition();
      });
    }
  }, [isOpen, updatePosition]);

  // Add scroll and resize listeners with throttling
  useEffect(() => {
    if (!isOpen) return;

    let timeoutId;
    const throttledUpdate = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(updatePosition, 16); // ~60fps
    };

    window.addEventListener('scroll', throttledUpdate, { passive: true });
    window.addEventListener('resize', throttledUpdate);

    return () => {
      window.removeEventListener('scroll', throttledUpdate);
      window.removeEventListener('resize', throttledUpdate);
      clearTimeout(timeoutId);
    };
  }, [isOpen, updatePosition]);

  // Close on escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e) => {
      if (modalRef.current && !modalRef.current.contains(e.target) && 
          triggerRef?.current && !triggerRef.current.contains(e.target)) {
        onClose();
      }
    };

    // Use capture phase to handle clicks before they bubble
    document.addEventListener('mousedown', handleClickOutside, true);
    return () => document.removeEventListener('mousedown', handleClickOutside, true);
  }, [isOpen, onClose, triggerRef]);

  // Handle selection changes
  const handleToggleItem = (item) => {
    const newSelection = selectedItems.includes(item)
      ? selectedItems.filter(i => i !== item)
      : [...selectedItems, item];
    onSelectionChange(newSelection);
  };

  const handleSelectAll = () => {
    onSelectionChange([...items]);
  };

  const handleClear = () => {
    onSelectionChange([]);
  };

  // Filter items based on search
  const filteredItems = items.filter(item => 
    item.toLowerCase().includes(searchValue.toLowerCase())
  );

  if (!isOpen || !portalContainer) return null;

  return createPortal(
    <div
      ref={modalRef}
      className={`
        absolute bg-white border border-gray-300 rounded shadow-lg p-3 z-50
        transition-opacity duration-150 ease-in-out
        ${className}
      `}
      style={{
        top: position.top,
        left: position.left,
        width: modalDimensions.width,
        maxHeight: modalDimensions.height,
        pointerEvents: 'auto',
      }}
      {...props}
    >
      {/* Header */}
      <div className="font-semibold mb-2 flex items-center justify-between">
        <span>{title}</span>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 transition-colors"
          aria-label="Close filter"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Controls */}
      <div className="flex items-center mb-2 gap-2 text-xs">
        <button 
          className="underline hover:text-blue-600 transition-colors" 
          onClick={handleSelectAll}
          type="button"
        >
          Select all
        </button>
        <span>-</span>
        <button 
          className="underline hover:text-blue-600 transition-colors" 
          onClick={handleClear}
          type="button"
        >
          Clear
        </button>
      </div>

      {/* Search */}
      <input
        className="w-full mb-2 px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        placeholder="Search..."
        value={searchValue}
        onChange={(e) => onSearchChange?.(e.target.value)}
        autoFocus
      />

      {/* Items List */}
      <div className="max-h-40 overflow-y-auto mb-2">
        {filteredItems.length === 0 ? (
          <div className="text-gray-500 text-sm py-2 text-center">
            {searchValue ? 'No items match your search' : 'No items available'}
          </div>
        ) : (
          filteredItems.map(item => (
            <label key={item} className="flex items-center gap-2 px-1 py-0.5 cursor-pointer hover:bg-gray-50 rounded">
              <input
                type="checkbox"
                checked={selectedItems.includes(item)}
                onChange={() => handleToggleItem(item)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm">{item}</span>
            </label>
          ))
        )}
      </div>

      {/* Footer with selection count */}
      <div className="text-xs text-gray-500 mb-2">
        {selectedItems.length} of {items.length} selected
      </div>

      {/* Action Buttons */}
      <div className="flex justify-end gap-2">
        <button
          className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 transition-colors"
          onClick={onClose}
        >
          Cancel
        </button>
        <button
          className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          onClick={onClose}
        >
          Apply
        </button>
      </div>
    </div>,
    portalContainer
  );
};

export default FilterModal;
