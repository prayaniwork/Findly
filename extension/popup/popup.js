/**
 * @fileoverview Findly Toolbar Popup Controller
 */

import { getRecentSearches } from '../lib/storage.js';

async function initPopup() {
  // Render Recent Searches (last 2-3)
  const recentList = await getRecentSearches();
  const container = document.getElementById('recent-list');

  if (container) {
    if (recentList && recentList.length > 0) {
      const topSearches = recentList.slice(0, 3);
      container.innerHTML = topSearches.map(item => `
        <div class="recent-item" data-src="${item.imageSrc}" data-label="${item.queryLabel}">
          <img src="${item.imageSrc}" alt="Recent search" class="recent-thumb">
          <div class="recent-info">
            <div class="recent-label">${item.queryLabel || 'Visual Search'}</div>
            <div class="recent-meta">${item.matchesCount || 'Multiple'} matches</div>
          </div>
        </div>
      `).join('');

      // Add click handler to recent items
      container.querySelectorAll('.recent-item').forEach(el => {
        el.addEventListener('click', async () => {
          const src = el.getAttribute('data-src');
          const label = el.getAttribute('data-label');

          try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tab?.id && chrome.sidePanel?.open) {
              chrome.sidePanel.open({ tabId: tab.id }).catch(() => {});
            }
          } catch (e) {}

          if (chrome.runtime && chrome.runtime.sendMessage) {
            chrome.runtime.sendMessage({
              action: 'FINDLY_IMAGE_SELECTED',
              data: {
                src,
                alt: label,
                mode: 'recent'
              }
            });
          }
          window.close();
        });
      });
    } else {
      container.innerHTML = `<div class="empty-recent">No recent searches yet</div>`;
    }
  }

  // Primary Action: "Select an item"
  document.getElementById('btn-popup-select')?.addEventListener('click', async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) {
        // Open side panel in response to user gesture
        if (chrome.sidePanel && chrome.sidePanel.open) {
          chrome.sidePanel.open({ tabId: tab.id }).catch(() => {});
        }
        // Start selection mode on active tab
        chrome.tabs.sendMessage(tab.id, { action: 'FINDLY_START_SELECTION_MODE' }).catch(() => {});
      }
    } catch (err) {
      console.warn('[Findly] Error triggering selection from popup:', err);
    }
    window.close();
  });

  // Footer: My Finds
  document.getElementById('btn-popup-finds')?.addEventListener('click', async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id && chrome.sidePanel?.open) {
        chrome.sidePanel.open({ tabId: tab.id }).catch(() => {});
      }
    } catch (e) {}
    window.close();
  });

  // Footer: Side Panel
  document.getElementById('btn-popup-sidepanel')?.addEventListener('click', async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id && chrome.sidePanel?.open) {
        chrome.sidePanel.open({ tabId: tab.id }).catch(() => {});
      }
    } catch (e) {}
    window.close();
  });
}

document.addEventListener('DOMContentLoaded', initPopup);
