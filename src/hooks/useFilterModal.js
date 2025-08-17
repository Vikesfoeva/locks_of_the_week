import React, { useState, useRef, useCallback } from 'react';

/**
 * Custom hook for managing filter modal state and behavior
 * Provides a consistent API for all filter modals in the application
 */
export function useFilterModal(initialItems = [], initialSelected = []) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedItems, setSelectedItems] = useState(initialSelected);
  const [searchValue, setSearchValue] = useState('');
  const [currentItems, setCurrentItems] = useState(initialItems);
  const triggerRef = useRef(null);

  // Open modal and initialize state
  const openModal = useCallback((items = initialItems, selected = initialSelected) => {
    // If no items are selected, show all items as selected (no filtering)
    setSelectedItems(selected.length > 0 ? selected : [...items]);
    setSearchValue('');
    setIsOpen(true);
    setCurrentItems(items);
  }, [initialItems, initialSelected]);

  // Close modal
  const closeModal = useCallback(() => {
    setIsOpen(false);
    setSearchValue('');
  }, []);

  // Handle selection changes
  const handleSelectionChange = useCallback((newSelection) => {
    setSelectedItems(newSelection);
  }, []);

  // Handle search changes
  const handleSearchChange = useCallback((value) => {
    setSearchValue(value);
  }, []);

  // Apply filters and close modal
  const applyFilters = useCallback((onApply) => {
    if (onApply) {
      onApply(selectedItems);
    }
    closeModal();
  }, [selectedItems, closeModal]);

  return {
    // State
    isOpen,
    selectedItems,
    searchValue,
    triggerRef,
    
    // Actions
    openModal,
    closeModal,
    handleSelectionChange,
    handleSearchChange,
    applyFilters,
    
    // Computed
    isFiltered: selectedItems.length > 0 && selectedItems.length < currentItems.length,
  };
}

/**
 * Hook for managing multiple filter modals in a single component
 * Useful for pages with many filter columns
 */
export function useMultipleFilterModals(filterConfigs) {
  const modals = {};
  
  filterConfigs.forEach(config => {
    modals[config.key] = useFilterModal(config.items, config.initialSelected);
  });
  
  return modals;
}

/**
 * Helper function to create filter button props
 * Standardizes the appearance and behavior of filter trigger buttons
 */
export function createFilterButtonProps(modal, items, onApply, options = {}) {
  const {
    IconComponent,
    IconComponentSolid,
    className = "ml-1 p-1 rounded hover:bg-gray-200 transition-colors",
    iconClassName = "h-4 w-4",
  } = options;

  // Determine if filter is active based on whether some items are excluded
  const isFilterActive = modal.selectedItems.length > 0 && modal.selectedItems.length < items.length;

  return {
    ref: modal.triggerRef,
    className,
    onClick: (e) => {
      e.stopPropagation(); // Prevent event bubbling
      modal.openModal(items, modal.selectedItems);
    },
    children: isFilterActive && IconComponentSolid ? 
      React.createElement(IconComponentSolid, { className: `${iconClassName} text-blue-600` }) :
      IconComponent ? 
        React.createElement(IconComponent, { className: `${iconClassName} text-gray-500` }) :
        React.createElement('svg', {
          className: `${iconClassName} ${isFilterActive ? 'text-blue-600' : 'text-gray-500'}`,
          fill: 'none',
          stroke: 'currentColor',
          viewBox: '0 0 24 24'
        }, React.createElement('path', {
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          strokeWidth: 2,
          d: 'M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.207A1 1 0 013 6.5V4z'
        })),
  };
}

/**
 * Helper function to create modal props
 * Standardizes modal configuration and behavior
 */
export function createFilterModalProps(modal, items, onApply, options = {}) {
  const {
    title = 'Filter',
    modalDimensions = { width: 256, height: 400 },
    placement = 'bottom-start',
    className = '',
  } = options;

  return {
    isOpen: modal.isOpen,
    onClose: () => modal.applyFilters(onApply),
    triggerRef: modal.triggerRef,
    title,
    items,
    selectedItems: modal.selectedItems,
    onSelectionChange: modal.handleSelectionChange,
    searchValue: modal.searchValue,
    onSearchChange: modal.handleSearchChange,
    modalDimensions,
    placement,
    className,
  };
}
