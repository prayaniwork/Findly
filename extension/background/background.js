/**
 * @fileoverview Findly Background Service Worker (Manifest V3)
 * Orchestrates Side Panel API, tab messaging, and state relays
 */

// On extension install, setup defaults and context menus
chrome.runtime.onInstalled.addListener(async () => {
  console.log('[Findly] Installed successfully.');

  // Create context menu for right-clicking images
  chrome.contextMenus.create({
    id: 'findly-find-similar',
    title: 'Find similar with Findly 🔍',
    contexts: ['image']
  });

  // Default settings
  const existing = await chrome.storage.local.get(['findly_settings']);
  if (!existing.findly_settings) {
    await chrome.storage.local.set({
      findly_settings: {
        showFindlyButtonOnImages: true,
        autoOpenSidePanel: true,
        enableOnShoppingWebsites: true,
        defaultSort: 'best-match',
        currency: 'INR',
        dataSource: 'local',
        backendUrl: 'http://localhost:3000'
      }
    });
  }

  // Set side panel behavior
  if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
    try {
      await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false });
    } catch (e) {
      console.warn('[Findly] setPanelBehavior error:', e);
    }
  }
});

// Context menu click listener (Guaranteed native user gesture)
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'findly-find-similar' && info.srcUrl) {
    // 1. Synchronously open side panel
    if (tab?.id && chrome.sidePanel && chrome.sidePanel.open) {
      chrome.sidePanel.open({ tabId: tab.id }).catch(() => {
        if (tab?.windowId) chrome.sidePanel.open({ windowId: tab.windowId }).catch(() => {});
      });
    }

    // 2. Relay selected image
    handleImageSelected({
      src: info.srcUrl,
      alt: 'Selected image',
      mode: 'context-menu',
      pageTitle: tab?.title || '',
      pageUrl: tab?.url || '',
      timestamp: Date.now()
    }, { tab });
  }
});

// Message listener
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'FINDLY_IMAGE_SELECTED') {
    // CRITICAL: Call sidePanel.open SYNCHRONOUSLY before any async operations to preserve user gesture!
    const tabId = sender?.tab?.id;
    const windowId = sender?.tab?.windowId;
    if (chrome.sidePanel && chrome.sidePanel.open) {
      if (tabId) {
        chrome.sidePanel.open({ tabId }).catch((err) => {
          console.warn('[Findly] tabId sidePanel.open notice:', err.message);
          if (windowId) {
            chrome.sidePanel.open({ windowId }).catch(() => {});
          }
        });
      } else if (windowId) {
        chrome.sidePanel.open({ windowId }).catch(() => {});
      }
    }

    handleImageSelected(message.data, sender);
    sendResponse({ success: true });
    return true;
  }

  if (message.action === 'FINDLY_TRIGGER_SELECTION_MODE') {
    // Also open side panel so it's ready when user clicks
    const tabId = sender?.tab?.id;
    if (tabId && chrome.sidePanel && chrome.sidePanel.open) {
      chrome.sidePanel.open({ tabId }).catch(() => {});
    }
    handleTriggerSelectionMode(sendResponse);
    return true; // Keep channel open for async response
  }

  if (message.action === 'FINDLY_OPEN_SIDE_PANEL') {
    handleOpenSidePanel(sender);
    sendResponse({ success: true });
    return true;
  }
});

/**
 * Handle image selection from hover pill or selection mode
 */
async function handleImageSelected(imageData, sender) {
  try {
    // 1. Store active search in storage for sidepanel pickup
    await chrome.storage.local.set({
      findly_active_search: {
        ...imageData,
        state: 'analyzing',
        timestamp: Date.now()
      }
    });

    // 2. Broadcast to all extension views (active side panel, etc.)
    chrome.runtime.sendMessage({
      action: 'FINDLY_IMAGE_PAYLOAD_RECEIVED',
      data: imageData
    }).catch(() => {
      // Side panel might not be open yet; storage will handle initial load
    });

  } catch (error) {
    console.error('[Findly] Error handling image selected:', error);
  }
}

/**
 * Trigger in-page selection mode from popup or sidepanel
 */
async function handleTriggerSelectionMode(sendResponse) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) {
      sendResponse({ success: false, error: 'No active tab found' });
      return;
    }

    // Ensure content script is ready or inject if needed
    try {
      await chrome.tabs.sendMessage(tab.id, { action: 'FINDLY_START_SELECTION_MODE' });
      sendResponse({ success: true, tabId: tab.id });
    } catch (msgErr) {
      // In case content script wasn't loaded (e.g. page was opened before extension was loaded)
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content/content.js']
        });
        await chrome.scripting.insertCSS({
          target: { tabId: tab.id },
          files: ['content/content.css']
        });
        await chrome.tabs.sendMessage(tab.id, { action: 'FINDLY_START_SELECTION_MODE' });
        sendResponse({ success: true, tabId: tab.id });
      } catch (injectErr) {
        console.error('[Findly] Injection error:', injectErr);
        sendResponse({ success: false, error: injectErr.message });
      }
    }
  } catch (err) {
    sendResponse({ success: false, error: err.message });
  }
}

/**
 * Open side panel manually
 */
async function handleOpenSidePanel(sender) {
  try {
    let tabId = sender?.tab?.id;
    if (!tabId) {
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      tabId = activeTab?.id;
    }
    if (tabId && chrome.sidePanel && chrome.sidePanel.open) {
      await chrome.sidePanel.open({ tabId });
    }
  } catch (e) {
    console.debug('[Findly] openSidePanel note:', e.message);
  }
}
