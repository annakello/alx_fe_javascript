// Default quotes array - used if no saved quotes exist
const defaultQuotes = [
    { text: "The only way to do great work is to love what you do.", category: "motivation" },
    { text: "Life is what happens to you while you're busy making other plans.", category: "life" },
    { text: "The future belongs to those who believe in the beauty of their dreams.", category: "dreams" },
    { text: "Innovation distinguishes between a leader and a follower.", category: "innovation" },
    { text: "The only impossible journey is the one you never begin.", category: "motivation" },
    { text: "Happiness is not something ready made. It comes from your own actions.", category: "happiness" },
    { text: "Success is not final, failure is not fatal: it is the courage to continue that counts.", category: "success" },
    { text: "The best time to plant a tree was 20 years ago. The second best time is now.", category: "wisdom" }
];

// Array of quote objects with text and category
let quotes = [];

// Server sync configuration
const SERVER_CONFIG = {
    baseUrl: 'https://jsonplaceholder.typicode.com/posts',
    syncInterval: 30000, // 30 seconds
    lastSyncTimestamp: null,
    syncEnabled: true,
    conflictResolutionStrategy: 'server-wins' // 'server-wins', 'local-wins', 'manual'
};

// Sync status tracking
let syncStatus = {
    isOnline: navigator.onLine,
    lastSync: null,
    pendingChanges: [],
    conflicts: []
};

// Web Storage Functions
function saveQuotes() {
    try {
        localStorage.setItem('dynamicQuotes', JSON.stringify(quotes));
        console.log('Quotes saved to localStorage');
    } catch (error) {
        console.error('Error saving quotes to localStorage:', error);
        alert('Error saving quotes. Storage might be full.');
    }
}

function loadQuotes() {
    try {
        const savedQuotes = localStorage.getItem('dynamicQuotes');
        if (savedQuotes) {
            quotes = JSON.parse(savedQuotes);
            console.log('Quotes loaded from localStorage');
        } else {
            // Use default quotes if no saved quotes exist
            quotes = [...defaultQuotes];
            saveQuotes(); // Save default quotes to localStorage
        }
    } catch (error) {
        console.error('Error loading quotes from localStorage:', error);
        quotes = [...defaultQuotes]; // Fallback to default quotes
    }
}

// Session Storage Functions for user preferences
function saveToSessionStorage(key, value) {
    try {
        sessionStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
        console.error('Error saving to sessionStorage:', error);
    }
}

function loadFromSessionStorage(key) {
    try {
        const value = sessionStorage.getItem(key);
        return value ? JSON.parse(value) : null;
    } catch (error) {
        console.error('Error loading from sessionStorage:', error);
        return null;
    }
}

// Enhanced Local Storage Functions for Category Filter Persistence
function saveSelectedCategory(category) {
    try {
        localStorage.setItem('selectedCategory', category);
        console.log('Selected category saved to localStorage:', category);
    } catch (error) {
        console.error('Error saving selected category:', error);
    }
}

function loadSelectedCategory() {
    try {
        return localStorage.getItem('selectedCategory') || 'all';
    } catch (error) {
        console.error('Error loading selected category:', error);
        return 'all';
    }
}

// Server Synchronization Functions
async function fetchQuotesFromServer() {
    try {
        showSyncStatus('Fetching quotes from server...', 'info');

        // Simulate fetching quotes from JSONPlaceholder
        const response = await fetch(`${SERVER_CONFIG.baseUrl}/posts?_limit=10`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const serverPosts = await response.json();

        // Transform server data to quote format
        const serverQuotes = serverPosts.map(post => ({
            id: post.id,
            text: post.title,
            category: 'inspiration', // Default category for server quotes
            dateAdded: new Date().toISOString(),
            source: 'server',
            lastModified: new Date().toISOString()
        }));

        return serverQuotes;
    } catch (error) {
        console.error('Error fetching quotes from server:', error);
        showSyncStatus('Failed to fetch quotes from server', 'error');
        return [];
    }
}

async function syncWithServer() {
    if (!syncStatus.isOnline || !SERVER_CONFIG.syncEnabled) {
        console.log('Sync skipped: offline or disabled');
        return;
    }

    try {
        showSyncStatus('Syncing with server...', 'info');

        const serverQuotes = await fetchQuotesFromServer();
        if (serverQuotes.length === 0) {
            showSyncStatus('No new quotes from server', 'info');
            return;
        }

        // Detect conflicts and merge data
        const result = await mergeServerData(serverQuotes);

        // Update local storage
        saveQuotes();

        // Update UI
        populateCategories();
        updateQuoteCounter();

        // Update sync status
        syncStatus.lastSync = new Date().toISOString();
        SERVER_CONFIG.lastSyncTimestamp = syncStatus.lastSync;
        localStorage.setItem('lastSyncTimestamp', syncStatus.lastSync);

        showSyncStatus(`Sync completed: ${result.added} added, ${result.conflicts} conflicts resolved`, 'success');

        // Show user notification for successful sync
        showNotification('Quotes synced with server!', 'success');

    } catch (error) {
        console.error('Sync error:', error);
        showSyncStatus('Sync failed: ' + error.message, 'error');
    }
}

async function mergeServerData(serverQuotes) {
    let added = 0;
    let conflicts = 0;

    for (const serverQuote of serverQuotes) {
        const existingQuote = quotes.find(q => q.id === serverQuote.id);

        if (!existingQuote) {
            // New quote from server
            quotes.push(serverQuote);
            added++;
        } else {
            // Potential conflict
            const conflict = detectConflict(existingQuote, serverQuote);
            if (conflict) {
                const resolution = await resolveConflict(existingQuote, serverQuote, conflict);
                if (resolution.resolved) {
                    conflicts++;
                    // Apply resolution
                    const index = quotes.findIndex(q => q.id === serverQuote.id);
                    if (index !== -1) {
                        quotes[index] = resolution.resolvedQuote;
                    }
                }
            }
        }
    }

    return { added, conflicts };
}

function detectConflict(localQuote, serverQuote) {
    const conflicts = [];

    if (localQuote.text !== serverQuote.text) {
        conflicts.push({
            field: 'text',
            local: localQuote.text,
            server: serverQuote.text
        });
    }

    if (localQuote.category !== serverQuote.category) {
        conflicts.push({
            field: 'category',
            local: localQuote.category,
            server: serverQuote.category
        });
    }

    return conflicts.length > 0 ? conflicts : null;
}

async function resolveConflict(localQuote, serverQuote, conflicts) {
    console.log('Resolving conflict for quote:', localQuote.id, conflicts);

    switch (SERVER_CONFIG.conflictResolutionStrategy) {
        case 'server-wins':
            return {
                resolved: true,
                resolvedQuote: { ...serverQuote, lastModified: new Date().toISOString() },
                resolution: 'Server version accepted'
            };

        case 'local-wins':
            return {
                resolved: true,
                resolvedQuote: { ...localQuote, lastModified: new Date().toISOString() },
                resolution: 'Local version kept'
            };

        case 'manual':
            // Store conflict for manual resolution
            syncStatus.conflicts.push({
                id: localQuote.id,
                local: localQuote,
                server: serverQuote,
                conflicts: conflicts,
                timestamp: new Date().toISOString()
            });

            showConflictDialog(localQuote, serverQuote, conflicts);

            return {
                resolved: false,
                resolvedQuote: localQuote, // Keep local until resolved
                resolution: 'Manual resolution required'
            };

        default:
            return {
                resolved: true,
                resolvedQuote: serverQuote,
                resolution: 'Default: Server version accepted'
            };
    }
}

function showConflictDialog(localQuote, serverQuote, conflicts) {
    const dialog = document.createElement('div');
    dialog.id = 'conflictDialog';
    dialog.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.8);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 2000;
    `;

    dialog.innerHTML = `
        <div style="background: white; padding: 30px; border-radius: 10px; max-width: 600px; max-height: 80vh; overflow-y: auto;">
            <h3 style="color: #dc3545; margin-top: 0;">⚠️ Data Conflict Detected</h3>
            <p>A conflict was detected for quote ID: <strong>${localQuote.id}</strong></p>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 20px 0;">
                <div>
                    <h4 style="color: #007bff;">Local Version</h4>
                    <div style="background: #f8f9fa; padding: 15px; border-radius: 6px;">
                        <p><strong>Text:</strong> "${localQuote.text}"</p>
                        <p><strong>Category:</strong> ${localQuote.category}</p>
                        <p><strong>Modified:</strong> ${new Date(localQuote.lastModified || localQuote.dateAdded).toLocaleString()}</p>
                    </div>
                </div>
                
                <div>
                    <h4 style="color: #28a745;">Server Version</h4>
                    <div style="background: #f8f9fa; padding: 15px; border-radius: 6px;">
                        <p><strong>Text:</strong> "${serverQuote.text}"</p>
                        <p><strong>Category:</strong> ${serverQuote.category}</p>
                        <p><strong>Modified:</strong> ${new Date(serverQuote.lastModified).toLocaleString()}</p>
                    </div>
                </div>
            </div>
            
            <div style="text-align: center; margin-top: 20px;">
                <button onclick="resolveConflictManually('${localQuote.id}', 'local')" 
                        style="background: #007bff; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; margin: 0 10px;">
                    Keep Local
                </button>
                <button onclick="resolveConflictManually('${localQuote.id}', 'server')" 
                        style="background: #28a745; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; margin: 0 10px;">
                    Use Server
                </button>
                <button onclick="closeConflictDialog()" 
                        style="background: #6c757d; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; margin: 0 10px;">
                    Decide Later
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(dialog);
}

function resolveConflictManually(quoteId, choice) {
    const conflictIndex = syncStatus.conflicts.findIndex(c => c.id === quoteId);
    if (conflictIndex === -1) return;

    const conflict = syncStatus.conflicts[conflictIndex];
    const quoteIndex = quotes.findIndex(q => q.id === quoteId);

    if (quoteIndex !== -1) {
        if (choice === 'server') {
            quotes[quoteIndex] = { ...conflict.server, lastModified: new Date().toISOString() };
        } else {
            quotes[quoteIndex] = { ...conflict.local, lastModified: new Date().toISOString() };
        }

        // Save changes
        saveQuotes();

        // Update UI
        populateCategories();
        filterQuotes();

        showNotification(`Conflict resolved: ${choice} version kept`, 'success');
    }

    // Remove conflict from pending list
    syncStatus.conflicts.splice(conflictIndex, 1);

    closeConflictDialog();
}

function closeConflictDialog() {
    const dialog = document.getElementById('conflictDialog');
    if (dialog) {
        dialog.remove();
    }
}

function showSyncStatus(message, type = 'info') {
    const statusElement = document.getElementById('syncStatus');
    if (statusElement) {
        statusElement.textContent = `🔄 ${message}`;
        statusElement.className = `sync-status ${type}`;

        // Auto-hide after 3 seconds for non-error messages
        if (type !== 'error') {
            setTimeout(() => {
                if (statusElement) {
                    statusElement.textContent = syncStatus.lastSync
                        ? `Last sync: ${new Date(syncStatus.lastSync).toLocaleTimeString()}`
                        : 'Not synced yet';
                    statusElement.className = 'sync-status';
                }
            }, 3000);
        }
    }
}

// Simulate server posting (for demonstration)
async function pushQuoteToServer(quote) {
    try {
        const response = await fetch(`${SERVER_CONFIG.baseUrl}/posts`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                title: quote.text,
                body: `Category: ${quote.category}`,
                userId: 1
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        console.log('Quote pushed to server:', result);
        return result;
    } catch (error) {
        console.error('Error pushing quote to server:', error);
        // Add to pending changes for retry
        syncStatus.pendingChanges.push({
            action: 'create',
            quote: quote,
            timestamp: new Date().toISOString()
        });
        return null;
    }
}

// Network status monitoring
function initializeNetworkMonitoring() {
    window.addEventListener('online', () => {
        syncStatus.isOnline = true;
        showSyncStatus('Back online - resuming sync', 'success');
        updateSyncStatusDisplay();

        // Attempt to sync when back online
        setTimeout(() => {
            syncWithServer();
        }, 1000);
    });

    window.addEventListener('offline', () => {
        syncStatus.isOnline = false;
        showSyncStatus('Offline - sync paused', 'error');
        updateSyncStatusDisplay();
    });
}

// Function to display a random quote
function showRandomQuote() {
    const quoteDisplay = document.getElementById('quoteDisplay');

    if (quotes.length === 0) {
        quoteDisplay.innerHTML = '<p>No quotes available. Add some quotes to get started!</p>';
        return;
    }

    // Get random quote
    const randomIndex = Math.floor(Math.random() * quotes.length);
    const randomQuote = quotes[randomIndex];

    // Save last viewed quote to session storage
    saveToSessionStorage('lastViewedQuote', randomQuote);

    // Create quote display with styling
    quoteDisplay.innerHTML = `
        <div class="quote-container">
            <blockquote class="quote-text">"${randomQuote.text}"</blockquote>
            <p class="quote-category">Category: <span class="category-tag">${randomQuote.category}</span></p>
        </div>
    `;

    // Add some dynamic styling
    const quoteContainer = quoteDisplay.querySelector('.quote-container');
    quoteContainer.style.cssText = `
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 20px;
        border-radius: 10px;
        margin: 20px 0;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        transition: transform 0.3s ease;
    `;

    // Add hover effect
    quoteContainer.addEventListener('mouseenter', function () {
        this.style.transform = 'translateY(-5px)';
    });

    quoteContainer.addEventListener('mouseleave', function () {
        this.style.transform = 'translateY(0)';
    });
}

// Function to create the add quote form dynamically
function createAddQuoteForm() {
    const existingForm = document.getElementById('addQuoteForm');
    if (existingForm) {
        existingForm.remove();
    }

    // Create form container
    const formContainer = document.createElement('div');
    formContainer.id = 'addQuoteForm';
    formContainer.style.cssText = `
        background: #f8f9fa;
        padding: 20px;
        border-radius: 8px;
        margin: 20px 0;
        border: 2px solid #e9ecef;
    `;

    // Create form HTML
    formContainer.innerHTML = `
        <h3 style="margin-top: 0; color: #495057;">Add Your Own Quote</h3>
        <div style="margin-bottom: 15px;">
            <input id="newQuoteText" type="text" placeholder="Enter a new quote" 
                   style="width: 100%; padding: 10px; border: 1px solid #ced4da; border-radius: 4px; font-size: 14px;" />
        </div>
        <div style="margin-bottom: 15px;">
            <input id="newQuoteCategory" type="text" placeholder="Enter quote category" 
                   style="width: 100%; padding: 10px; border: 1px solid #ced4da; border-radius: 4px; font-size: 14px;" />
        </div>
        <div>
            <button onclick="addQuote()" 
                    style="background: #28a745; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; margin-right: 10px;">
                Add Quote
            </button>
            <button onclick="toggleAddQuoteForm()" 
                    style="background: #6c757d; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer;">
                Cancel
            </button>
        </div>
    `;

    // Insert form after the new quote button
    const newQuoteButton = document.getElementById('newQuote');
    newQuoteButton.parentNode.insertBefore(formContainer, newQuoteButton.nextSibling);

    // Focus on the first input
    document.getElementById('newQuoteText').focus();
}

// Function to add a new quote
function addQuote() {
    const quoteText = document.getElementById('newQuoteText').value.trim();
    const quoteCategory = document.getElementById('newQuoteCategory').value.trim();

    // Validate input
    if (!quoteText || !quoteCategory) {
        alert('Please fill in both the quote text and category.');
        return;
    }

    // Add new quote to array
    const newQuote = {
        id: 'local_' + Date.now(), // Local ID for conflict resolution
        text: quoteText,
        category: quoteCategory.toLowerCase(),
        dateAdded: new Date().toISOString(),
        lastModified: new Date().toISOString(),
        source: 'local'
    };

    quotes.push(newQuote);

    // Save to localStorage
    saveQuotes();

    // Try to push to server if online
    if (syncStatus.isOnline && SERVER_CONFIG.syncEnabled) {
        pushQuoteToServer(newQuote).then(result => {
            if (result) {
                showNotification('Quote added and synced to server!', 'success');
            } else {
                showNotification('Quote added locally (will sync when online)', 'info');
            }
        });
    } else {
        showNotification('Quote added locally (offline mode)', 'info');
    }

    // Clear form
    document.getElementById('newQuoteText').value = '';
    document.getElementById('newQuoteCategory').value = '';

    // Show success message
    showSuccessMessage('Quote added successfully!');

    // Update categories in dropdown (real-time update)
    populateCategories();

    // Check if the new category should be shown
    const currentFilter = document.getElementById('categoryFilter').value;
    if (currentFilter === 'all' || currentFilter === quoteCategory.toLowerCase()) {
        // Display the new quote if it matches current filter
        filterQuotes();
    }

    // Update quote counter
    updateQuoteCounter();

    // Show notification about new category if it's new
    const categories = [...new Set(quotes.map(quote => quote.category))];
    const isNewCategory = categories.filter(cat => cat === quoteCategory.toLowerCase()).length === 1;

    if (isNewCategory) {
        setTimeout(() => {
            showNotification(`New category "${quoteCategory.toLowerCase()}" added!`, 'info');
        }, 1500);
    }
}

// Function to show success message
function showSuccessMessage(message) {
    const successDiv = document.createElement('div');
    successDiv.textContent = message;
    successDiv.style.cssText = `
        background: #d4edda;
        color: #155724;
        padding: 10px;
        border: 1px solid #c3e6cb;
        border-radius: 4px;
        margin: 10px 0;
        text-align: center;
    `;

    const formContainer = document.getElementById('addQuoteForm');
    formContainer.insertBefore(successDiv, formContainer.firstChild);

    // Remove success message after 3 seconds
    setTimeout(() => {
        successDiv.remove();
    }, 3000);
}

// Function to toggle the add quote form
function toggleAddQuoteForm() {
    const existingForm = document.getElementById('addQuoteForm');
    if (existingForm) {
        existingForm.remove();
    } else {
        createAddQuoteForm();
    }
}

// Function to update quote counter
function updateQuoteCounter() {
    let counterElement = document.getElementById('quoteCounter');
    if (!counterElement) {
        counterElement = document.createElement('p');
        counterElement.id = 'quoteCounter';
        counterElement.style.cssText = `
            text-align: center;
            color: #6c757d;
            font-size: 14px;
            margin: 10px 0;
        `;
        document.body.appendChild(counterElement);
    }
    counterElement.textContent = `Total quotes: ${quotes.length}`;
}

// Function to populate categories dynamically
function populateCategories() {
    const categories = [...new Set(quotes.map(quote => quote.category))].sort();
    const categoryFilter = document.getElementById('categoryFilter');

    if (!categoryFilter) return;

    // Store current selection
    const currentSelection = categoryFilter.value || loadSelectedCategory();

    // Clear existing options
    categoryFilter.innerHTML = '<option value="all">All Categories</option>';

    // Add category options
    categories.forEach(category => {
        const option = document.createElement('option');
        option.value = category;
        option.textContent = category.charAt(0).toUpperCase() + category.slice(1);
        categoryFilter.appendChild(option);
    });

    // Restore selection
    categoryFilter.value = currentSelection;

    // Update quote count for each category
    updateCategoryCount();
}

// Function to update category count display
function updateCategoryCount() {
    const categoryFilter = document.getElementById('categoryFilter');
    if (!categoryFilter) return;

    const options = categoryFilter.querySelectorAll('option');
    options.forEach(option => {
        const category = option.value;
        let count;

        if (category === 'all') {
            count = quotes.length;
            option.textContent = `All Categories (${count})`;
        } else {
            count = quotes.filter(quote => quote.category === category).length;
            const categoryName = category.charAt(0).toUpperCase() + category.slice(1);
            option.textContent = `${categoryName} (${count})`;
        }
    });
}

// Enhanced filter quotes function
function filterQuotes() {
    const categoryFilter = document.getElementById('categoryFilter');
    const selectedCategory = categoryFilter.value;
    const quoteDisplay = document.getElementById('quoteDisplay');

    // Save selected category to localStorage
    saveSelectedCategory(selectedCategory);

    // Filter and display quotes
    let filteredQuotes;
    if (selectedCategory === 'all') {
        filteredQuotes = quotes;
    } else {
        filteredQuotes = quotes.filter(quote => quote.category === selectedCategory);
    }

    if (filteredQuotes.length === 0) {
        quoteDisplay.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #6c757d;">
                <h3>No quotes found</h3>
                <p>No quotes available in the "${selectedCategory}" category.</p>
                <button onclick="toggleAddQuoteForm()" style="background: #28a745; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; margin-top: 10px;">
                    Add a Quote
                </button>
            </div>
        `;
        return;
    }

    // Display a random quote from filtered results
    const randomIndex = Math.floor(Math.random() * filteredQuotes.length);
    const randomQuote = filteredQuotes[randomIndex];

    // Save last viewed quote to session storage
    saveToSessionStorage('lastViewedQuote', randomQuote);
    saveToSessionStorage('lastFilteredCategory', selectedCategory);

    quoteDisplay.innerHTML = `
        <div class="quote-container">
            <blockquote class="quote-text">"${randomQuote.text}"</blockquote>
            <p class="quote-category">Category: <span class="category-tag">${randomQuote.category}</span></p>
            <div class="quote-meta">
                <small style="opacity: 0.8;">
                    🎯 Filtered by: ${selectedCategory === 'all' ? 'All Categories' : selectedCategory.charAt(0).toUpperCase() + selectedCategory.slice(1)} 
                    | 📊 ${filteredQuotes.length} quote${filteredQuotes.length !== 1 ? 's' : ''} available
                </small>
            </div>
        </div>
    `;

    // Apply styling
    const quoteContainer = quoteDisplay.querySelector('.quote-container');
    quoteContainer.style.cssText = `
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 20px;
        border-radius: 10px;
        margin: 20px 0;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        transition: transform 0.3s ease;
        position: relative;
    `;

    // Add hover effect
    quoteContainer.addEventListener('mouseenter', function () {
        this.style.transform = 'translateY(-5px)';
    });

    quoteContainer.addEventListener('mouseleave', function () {
        this.style.transform = 'translateY(0)';
    });

    // Update filter statistics
    updateFilterStatistics(selectedCategory, filteredQuotes.length);
}

// Function to update filter statistics
function updateFilterStatistics(category, count) {
    let statsElement = document.getElementById('filterStats');
    if (!statsElement) {
        statsElement = document.createElement('div');
        statsElement.id = 'filterStats';
        statsElement.style.cssText = `
            text-align: center;
            margin: 10px 0;
            padding: 10px;
            background: #f8f9fa;
            border-radius: 6px;
            font-size: 14px;
            color: #495057;
        `;

        const categoryFilter = document.getElementById('categoryFilter');
        categoryFilter.parentNode.insertBefore(statsElement, categoryFilter.nextSibling);
    }

    const categoryName = category === 'all' ? 'All Categories' : category.charAt(0).toUpperCase() + category.slice(1);
    statsElement.innerHTML = `
        📊 Showing <strong>${count}</strong> quote${count !== 1 ? 's' : ''} from <strong>${categoryName}</strong>
        ${category !== 'all' ? `| <a href="#" onclick="resetFilter()" style="color: #007bff; text-decoration: none;">Show All</a>` : ''}
    `;
}

// Function to reset filter to show all quotes
function resetFilter() {
    const categoryFilter = document.getElementById('categoryFilter');
    categoryFilter.value = 'all';
    filterQuotes();
}

// Function to show quote by selected category (legacy function - now uses filterQuotes)
function showQuoteByCategory() {
    filterQuotes(); // Redirect to the enhanced filterQuotes function
}

// JSON Import/Export Functions
function exportToJsonFile() {
    try {
        const dataStr = JSON.stringify(quotes, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        // Create download link
        const downloadLink = document.createElement('a');
        downloadLink.href = url;
        downloadLink.download = `quotes-export-${new Date().toISOString().split('T')[0]}.json`;

        // Trigger download
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);

        // Clean up
        URL.revokeObjectURL(url);

        showNotification('Quotes exported successfully!', 'success');
    } catch (error) {
        console.error('Error exporting quotes:', error);
        showNotification('Error exporting quotes. Please try again.', 'error');
    }
}

function importFromJsonFile(event) {
    const file = event.target.files[0];
    if (!file) return;

    const fileReader = new FileReader();
    fileReader.onload = function (event) {
        try {
            const importedQuotes = JSON.parse(event.target.result);

            // Validate imported data
            if (!Array.isArray(importedQuotes)) {
                throw new Error('Invalid file format. Expected an array of quotes.');
            }

            // Validate each quote object
            const validQuotes = importedQuotes.filter(quote => {
                return quote &&
                    typeof quote.text === 'string' &&
                    typeof quote.category === 'string' &&
                    quote.text.trim() !== '' &&
                    quote.category.trim() !== '';
            });

            if (validQuotes.length === 0) {
                throw new Error('No valid quotes found in the file.');
            }

            // Add timestamps to imported quotes if they don't have them
            validQuotes.forEach(quote => {
                if (!quote.dateAdded) {
                    quote.dateAdded = new Date().toISOString();
                }
                if (!quote.id) {
                    quote.id = 'imported_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
                }
                if (!quote.lastModified) {
                    quote.lastModified = new Date().toISOString();
                }
                if (!quote.source) {
                    quote.source = 'imported';
                }
            });

            // Add to existing quotes
            quotes.push(...validQuotes);

            // Save to localStorage
            saveQuotes();

            // Update UI with new filtering system
            updateQuoteCounter();
            populateCategories(); // Update categories dropdown
            filterQuotes(); // Apply current filter to show updated results

            showNotification(`${validQuotes.length} quotes imported successfully!`, 'success');

            // Clear file input
            event.target.value = '';

        } catch (error) {
            console.error('Error importing quotes:', error);
            showNotification(`Error importing quotes: ${error.message}`, 'error');
        }
    };

    fileReader.onerror = function () {
        showNotification('Error reading file. Please try again.', 'error');
    };

    fileReader.readAsText(file);
}

function clearAllQuotes() {
    if (confirm('Are you sure you want to clear all quotes? This action cannot be undone.')) {
        quotes = [];
        saveQuotes();
        updateQuoteCounter();
        populateCategories(); // Update categories dropdown
        document.getElementById('quoteDisplay').innerHTML = '<p style="text-align: center; color: #6c757d;">No quotes available. Add some quotes to get started!</p>';

        // Clear filter statistics
        const statsElement = document.getElementById('filterStats');
        if (statsElement) {
            statsElement.remove();
        }

        showNotification('All quotes cleared successfully!', 'success');
    }
}

function resetToDefaults() {
    if (confirm('Are you sure you want to reset to default quotes? This will remove all your custom quotes.')) {
        quotes = [...defaultQuotes];
        saveQuotes();
        updateQuoteCounter();
        populateCategories(); // Update categories dropdown
        filterQuotes(); // Apply current filter
        showNotification('Reset to default quotes successfully!', 'success');
    }
}

// Enhanced notification system
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        border-radius: 6px;
        color: white;
        font-weight: bold;
        z-index: 1000;
        max-width: 300px;
        word-wrap: break-word;
        animation: slideInRight 0.3s ease;
        ${type === 'success' ? 'background: #28a745;' :
            type === 'error' ? 'background: #dc3545;' :
                'background: #007bff;'}
    `;

    // Add CSS animation
    if (!document.getElementById('notificationStyles')) {
        const style = document.createElement('style');
        style.id = 'notificationStyles';
        style.textContent = `
            @keyframes slideInRight {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            @keyframes slideOutRight {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(100%); opacity: 0; }
            }
        `;
        document.head.appendChild(style);
    }

    document.body.appendChild(notification);

    // Remove notification after 4 seconds
    setTimeout(() => {
        notification.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 4000);
}

// Function to show storage statistics
function showStorageStats() {
    try {
        const quotesData = localStorage.getItem('dynamicQuotes');
        const dataSize = quotesData ? new Blob([quotesData]).size : 0;
        const sizeKB = (dataSize / 1024).toFixed(2);

        const stats = `
            📊 Storage Statistics:
            • Total Quotes: ${quotes.length}
            • Storage Used: ${sizeKB} KB
            • Categories: ${[...new Set(quotes.map(q => q.category))].length}
            • Custom Quotes: ${quotes.filter(q => q.dateAdded).length}
        `;

        alert(stats);
    } catch (error) {
        console.error('Error getting storage stats:', error);
        alert('Error retrieving storage statistics.');
    }
}

// Initialize the application when the page loads
document.addEventListener('DOMContentLoaded', function () {
    // Load quotes from localStorage
    loadQuotes();

    // Initialize network monitoring
    initializeNetworkMonitoring();

    // Load sync status from storage
    const lastSync = localStorage.getItem('lastSyncTimestamp');
    if (lastSync) {
        syncStatus.lastSync = lastSync;
        SERVER_CONFIG.lastSyncTimestamp = lastSync;
    }

    // Create sync status display
    createSyncStatusDisplay();

    // Create the category filter dropdown first
    createCategoryFilterDropdown();

    // Populate categories in the dropdown
    populateCategories();

    // Restore last selected filter
    const lastSelectedCategory = loadSelectedCategory();
    const categoryFilter = document.getElementById('categoryFilter');
    if (categoryFilter) {
        categoryFilter.value = lastSelectedCategory;
    }

    // Show quotes based on restored filter or show last viewed quote
    const lastViewedQuote = loadFromSessionStorage('lastViewedQuote');
    const lastFilteredCategory = loadFromSessionStorage('lastFilteredCategory');

    if (lastViewedQuote && lastFilteredCategory && quotes.some(q => q.text === lastViewedQuote.text)) {
        // Display last viewed quote if it still exists and matches the filter
        const quoteDisplay = document.getElementById('quoteDisplay');
        quoteDisplay.innerHTML = `
            <div class="quote-container">
                <blockquote class="quote-text">"${lastViewedQuote.text}"</blockquote>
                <p class="quote-category">Category: <span class="category-tag">${lastViewedQuote.category}</span></p>
                <div class="quote-meta">
                    <small style="opacity: 0.8;">📅 Last viewed in this session</small>
                </div>
            </div>
        `;

        const quoteContainer = quoteDisplay.querySelector('.quote-container');
        quoteContainer.style.cssText = `
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 20px;
            border-radius: 10px;
            margin: 20px 0;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            transition: transform 0.3s ease;
        `;

        // Update filter statistics
        updateFilterStatistics(lastSelectedCategory, quotes.filter(q =>
            lastSelectedCategory === 'all' || q.category === lastSelectedCategory
        ).length);
    } else {
        // Apply the restored filter
        filterQuotes();
    }

    // Update quote counter
    updateQuoteCounter();

    // Create import/export controls
    createImportExportControls();

    // Create sync controls
    syncQuotes();

    // Add event listener to new quote button
    document.getElementById('newQuote').addEventListener('click', function () {
        const selectedCategory = document.getElementById('categoryFilter').value;
        if (selectedCategory === 'all') {
            showRandomQuote();
        } else {
            filterQuotes();
        }
    });

    // Add keyboard support
    document.addEventListener('keydown', function (event) {
        if (event.ctrlKey && event.key === 'q') {
            event.preventDefault();
            toggleAddQuoteForm();
        } else if (event.ctrlKey && event.key === 'e') {
            event.preventDefault();
            exportToJsonFile();
        } else if (event.ctrlKey && event.key === 's') {
            event.preventDefault();
            showStorageStats();
        } else if (event.ctrlKey && event.key === 'f') {
            event.preventDefault();
            document.getElementById('categoryFilter').focus();
        } else if (event.ctrlKey && event.key === 'r') {
            event.preventDefault();
            syncWithServer();
        }
    });

    // Start periodic sync
    if (SERVER_CONFIG.syncEnabled && syncStatus.isOnline) {
        // Initial sync after a short delay
        setTimeout(() => {
            syncWithServer();
        }, 2000);

        // Set up periodic sync
        setInterval(() => {
            if (SERVER_CONFIG.syncEnabled && syncStatus.isOnline) {
                syncWithServer();
            }
        }, SERVER_CONFIG.syncInterval);
    }

    // Show welcome message with storage info
    setTimeout(() => {
        const savedQuotesCount = quotes.length;
        const customQuotesCount = quotes.filter(q => q.dateAdded && q.source !== 'server').length;
        const selectedCategory = loadSelectedCategory();

        if (customQuotesCount > 0) {
            const filterInfo = selectedCategory !== 'all' ? ` | Filter: ${selectedCategory}` : '';
            const syncInfo = syncStatus.isOnline ? ' | Sync enabled' : ' | Offline mode';
            showNotification(`Welcome back! ${savedQuotesCount} quotes loaded (${customQuotesCount} custom)${filterInfo}${syncInfo}`, 'success');
        }
    }, 1000);
});

// Function to create the category filter dropdown
function createCategoryFilterDropdown() {
    let filterContainer = document.getElementById('categoryFilterContainer');
    if (!filterContainer) {
        filterContainer = document.createElement('div');
        filterContainer.id = 'categoryFilterContainer';
        filterContainer.style.cssText = `
            margin: 20px 0;
            text-align: center;
            padding: 15px;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        `;

        filterContainer.innerHTML = `
            <label for="categoryFilter" style="display: block; margin-bottom: 10px; font-weight: bold; color: #495057;">
                🎯 Filter Quotes by Category:
            </label>
            <select id="categoryFilter" onchange="filterQuotes()" 
                    style="padding: 8px 12px; border: 2px solid #ced4da; border-radius: 6px; font-size: 16px; min-width: 200px; background: white;">
                <option value="all">All Categories</option>
            </select>
        `;

        // Insert before the quote display
        const quoteDisplay = document.getElementById('quoteDisplay');
        quoteDisplay.parentNode.insertBefore(filterContainer, quoteDisplay);
    }
}

// Function to create import/export controls
function createImportExportControls() {
    let controlsContainer = document.getElementById('importExportControls');
    if (!controlsContainer) {
        controlsContainer = document.createElement('div');
        controlsContainer.id = 'importExportControls';
        controlsContainer.style.cssText = `
            background: white;
            padding: 20px;
            border-radius: 10px;
            margin: 20px 0;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            text-align: center;
        `;

        controlsContainer.innerHTML = `
            <h3 style="margin-top: 0; color: #495057;">📁 Data Management</h3>
            <div style="display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; align-items: center;">
                <button onclick="exportToJsonFile()" 
                        style="background: #17a2b8; color: white; padding: 8px 16px; border: none; border-radius: 4px; cursor: pointer; font-size: 14px;">
                    📤 Export Quotes
                </button>
                
                <button onclick="showStorageStats()" 
                        style="background: #6c757d; color: white; padding: 8px 16px; border: none; border-radius: 4px; cursor: pointer; font-size: 14px;">
                    📊 Storage Stats
                </button>
                
                <button onclick="resetToDefaults()" 
                        style="background: #ffc107; color: #212529; padding: 8px 16px; border: none; border-radius: 4px; cursor: pointer; font-size: 14px;">
                    🔄 Reset Defaults
                </button>
                
                <button onclick="clearAllQuotes()" 
                        style="background: #dc3545; color: white; padding: 8px 16px; border: none; border-radius: 4px; cursor: pointer; font-size: 14px;">
                    🗑️ Clear All
                </button>
            </div>
            <p style="font-size: 12px; color: #6c757d; margin: 10px 0 0 0;">
                💡 Shortcuts: Ctrl+E (Export), Ctrl+S (Stats), Ctrl+Q (Add Quote), Ctrl+F (Focus Filter), Ctrl+R (Sync)
            </p>
        `;

        // Insert before the feature list
        const featureList = document.querySelector('.feature-list');
        if (featureList) {
            featureList.parentNode.insertBefore(controlsContainer, featureList);
        } else {
            document.body.appendChild(controlsContainer);
        }
    }
}

// Function to create sync status display
function createSyncStatusDisplay() {
    let statusContainer = document.getElementById('syncStatusContainer');
    if (!statusContainer) {
        statusContainer = document.createElement('div');
        statusContainer.id = 'syncStatusContainer';
        statusContainer.style.cssText = `
            background: #f8f9fa;
            padding: 10px;
            border-radius: 6px;
            margin: 10px 0;
            text-align: center;
            border-left: 4px solid #007bff;
        `;

        statusContainer.innerHTML = `
            <div id="syncStatus" class="sync-status">
                ${syncStatus.lastSync
                ? `Last sync: ${new Date(syncStatus.lastSync).toLocaleTimeString()}`
                : 'Not synced yet'}
            </div>
        `;

        // Insert after the title
        const title = document.querySelector('h1');
        title.parentNode.insertBefore(statusContainer, title.nextSibling);
    }

    updateSyncStatusDisplay();
}

// Function to update sync status display
function updateSyncStatusDisplay() {
    const statusContainer = document.getElementById('syncStatusContainer');
    if (statusContainer) {
        const isOnline = syncStatus.isOnline;
        const syncEnabled = SERVER_CONFIG.syncEnabled;

        let borderColor = '#007bff';
        let statusText = 'Ready to sync';

        if (!isOnline) {
            borderColor = '#dc3545';
            statusText = '🔴 Offline';
        } else if (!syncEnabled) {
            borderColor = '#ffc107';
            statusText = '⏸️ Sync disabled';
        } else if (syncStatus.conflicts.length > 0) {
            borderColor = '#fd7e14';
            statusText = `⚠️ ${syncStatus.conflicts.length} conflict(s) pending`;
        } else if (syncStatus.lastSync) {
            borderColor = '#28a745';
            statusText = `✅ Last sync: ${new Date(syncStatus.lastSync).toLocaleTimeString()}`;
        }

        statusContainer.style.borderLeftColor = borderColor;
        const statusElement = document.getElementById('syncStatus');
        if (statusElement) {
            statusElement.textContent = statusText;
        }
    }
}

// Function to create sync controls
function syncQuotes() {
    let controlsContainer = document.getElementById('syncControls');
    if (!controlsContainer) {
        controlsContainer = document.createElement('div');
        controlsContainer.id = 'syncControls';
        controlsContainer.style.cssText = `
            background: white;
            padding: 20px;
            border-radius: 10px;
            margin: 20px 0;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            text-align: center;
        `;

        controlsContainer.innerHTML = `
            <h3 style="margin-top: 0; color: #495057;">🔄 Server Synchronization</h3>
            <div style="display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; align-items: center; margin-bottom: 15px;">
                <button onclick="syncWithServer()" id="syncNowBtn"
                        style="background: #007bff; color: white; padding: 8px 16px; border: none; border-radius: 4px; cursor: pointer; font-size: 14px;">
                    🔄 Sync Now
                </button>
                
                <button onclick="toggleSync()" id="toggleSyncBtn"
                        style="background: ${SERVER_CONFIG.syncEnabled ? '#dc3545' : '#28a745'}; color: white; padding: 8px 16px; border: none; border-radius: 4px; cursor: pointer; font-size: 14px;">
                    ${SERVER_CONFIG.syncEnabled ? '⏸️ Disable Sync' : '▶️ Enable Sync'}
                </button>
                
                <button onclick="showConflicts()" id="conflictsBtn"
                        style="background: #fd7e14; color: white; padding: 8px 16px; border: none; border-radius: 4px; cursor: pointer; font-size: 14px;">
                    ⚠️ Conflicts (${syncStatus.conflicts.length})
                </button>
                
                <button onclick="configureSyncSettings()" 
                        style="background: #6c757d; color: white; padding: 8px 16px; border: none; border-radius: 4px; cursor: pointer; font-size: 14px;">
                    ⚙️ Settings
                </button>
            </div>
            
            <div style="font-size: 12px; color: #6c757d;">
                <p>Sync strategy: <strong>${SERVER_CONFIG.conflictResolutionStrategy.replace('-', ' ')}</strong> | 
                Interval: <strong>${SERVER_CONFIG.syncInterval / 1000}s</strong> | 
                Status: <strong>${syncStatus.isOnline ? 'Online' : 'Offline'}</strong></p>
            </div>
        `;

        // Insert after import/export controls
        const importExportControls = document.getElementById('importExportControls');
        if (importExportControls) {
            importExportControls.parentNode.insertBefore(controlsContainer, importExportControls.nextSibling);
        } else {
            document.body.appendChild(controlsContainer);
        }
    }
}

// Sync control functions
function toggleSync() {
    SERVER_CONFIG.syncEnabled = !SERVER_CONFIG.syncEnabled;
    localStorage.setItem('syncEnabled', SERVER_CONFIG.syncEnabled.toString());

    const toggleBtn = document.getElementById('toggleSyncBtn');
    if (toggleBtn) {
        toggleBtn.style.background = SERVER_CONFIG.syncEnabled ? '#dc3545' : '#28a745';
        toggleBtn.innerHTML = SERVER_CONFIG.syncEnabled ? '⏸️ Disable Sync' : '▶️ Enable Sync';
    }

    updateSyncStatusDisplay();

    const message = SERVER_CONFIG.syncEnabled ? 'Sync enabled' : 'Sync disabled';
    showNotification(message, SERVER_CONFIG.syncEnabled ? 'success' : 'info');

    // Re-create sync controls to update the display
    document.getElementById('syncControls').remove();
    syncQuotes();
}

function showConflicts() {
    if (syncStatus.conflicts.length === 0) {
        showNotification('No conflicts to resolve', 'info');
        return;
    }

    // Show the first unresolved conflict
    const conflict = syncStatus.conflicts[0];
    showConflictDialog(conflict.local, conflict.server, conflict.conflicts);
}

function configureSyncSettings() {
    const dialog = document.createElement('div');
    dialog.id = 'syncSettingsDialog';
    dialog.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.8);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 2000;
    `;

    dialog.innerHTML = `
        <div style="background: white; padding: 30px; border-radius: 10px; max-width: 500px;">
            <h3 style="margin-top: 0; color: #495057;">⚙️ Sync Settings</h3>
            
            <div style="margin-bottom: 20px;">
                <label style="display: block; margin-bottom: 10px; font-weight: bold;">Conflict Resolution Strategy:</label>
                <select id="conflictStrategy" style="width: 100%; padding: 8px; border: 1px solid #ced4da; border-radius: 4px;">
                    <option value="server-wins" ${SERVER_CONFIG.conflictResolutionStrategy === 'server-wins' ? 'selected' : ''}>Server Always Wins</option>
                    <option value="local-wins" ${SERVER_CONFIG.conflictResolutionStrategy === 'local-wins' ? 'selected' : ''}>Local Always Wins</option>
                    <option value="manual" ${SERVER_CONFIG.conflictResolutionStrategy === 'manual' ? 'selected' : ''}>Manual Resolution</option>
                </select>
            </div>
            
            <div style="margin-bottom: 20px;">
                <label style="display: block; margin-bottom: 10px; font-weight: bold;">Sync Interval (seconds):</label>
                <input type="number" id="syncInterval" value="${SERVER_CONFIG.syncInterval / 1000}" min="10" max="300" 
                       style="width: 100%; padding: 8px; border: 1px solid #ced4da; border-radius: 4px;">
            </div>
            
            <div style="text-align: center; margin-top: 20px;">
                <button onclick="saveSyncSettings()" 
                        style="background: #28a745; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; margin: 0 10px;">
                    Save Settings
                </button>
                <button onclick="closeSyncSettingsDialog()" 
                        style="background: #6c757d; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; margin: 0 10px;">
                    Cancel
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(dialog);
}

function saveSyncSettings() {
    const strategy = document.getElementById('conflictStrategy').value;
    const interval = parseInt(document.getElementById('syncInterval').value) * 1000;

    SERVER_CONFIG.conflictResolutionStrategy = strategy;
    SERVER_CONFIG.syncInterval = interval;

    // Save to localStorage
    localStorage.setItem('conflictResolutionStrategy', strategy);
    localStorage.setItem('syncInterval', interval.toString());

    closeSyncSettingsDialog();

    // Re-create sync controls to update the display
    document.getElementById('syncControls').remove();
    syncQuotes();

    showNotification('Sync settings saved successfully!', 'success');
}

function closeSyncSettingsDialog() {
    const dialog = document.getElementById('syncSettingsDialog');
    if (dialog) {
        dialog.remove();
    }
}