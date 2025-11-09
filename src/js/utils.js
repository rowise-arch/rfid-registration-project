// Enhanced JavaScript Utilities for RFID System

// Notification System
class NotificationSystem {
    constructor() {
        this.container = document.getElementById('notificationContainer') || this.createContainer();
        this.setupStyles();
    }

    createContainer() {
        const container = document.createElement('div');
        container.id = 'notificationContainer';
        container.className = 'notification-container';
        document.body.appendChild(container);
        return container;
    }

    setupStyles() {
        if (!document.getElementById('notification-styles')) {
            const styles = `
                .notification-container {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    z-index: 10000;
                    max-width: 400px;
                }
                .notification {
                    background: var(--white);
                    border-radius: var(--radius);
                    padding: 15px 20px;
                    margin-bottom: 10px;
                    box-shadow: var(--hover-shadow);
                    border-left: 4px solid var(--success);
                    min-width: 300px;
                    animation: slideInRight 0.3s ease;
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }
                .notification.error { border-left-color: var(--error); }
                .notification.warning { border-left-color: var(--warning); }
                .notification.info { border-left-color: var(--info); }
                @keyframes slideInRight {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
            `;
            const styleSheet = document.createElement('style');
            styleSheet.id = 'notification-styles';
            styleSheet.textContent = styles;
            document.head.appendChild(styleSheet);
        }
    }

    show(message, type = 'info', duration = 5000) {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <div class="notification-icon">
                <i class="fas fa-${this.getIcon(type)}"></i>
            </div>
            <div class="notification-content">${message}</div>
            <button class="notification-close" onclick="this.parentElement.remove()">
                <i class="fas fa-times"></i>
            </button>
        `;
        
        this.container.appendChild(notification);
        
        if (duration > 0) {
            setTimeout(() => {
                if (notification.parentElement) {
                    notification.remove();
                }
            }, duration);
        }
        
        return notification;
    }

    getIcon(type) {
        const icons = {
            success: 'check-circle',
            error: 'exclamation-circle',
            warning: 'exclamation-triangle',
            info: 'info-circle'
        };
        return icons[type] || 'info-circle';
    }

    clear() {
        this.container.innerHTML = '';
    }
}

// Form Validation System
class FormValidator {
    constructor(formId) {
        this.form = document.getElementById(formId);
        this.fields = new Map();
        this.setupValidation();
    }

    addField(fieldName, rules) {
        this.fields.set(fieldName, {
            element: document.getElementById(fieldName),
            rules: rules,
            isValid: false
        });
    }

    setupValidation() {
        this.fields.forEach((field, fieldName) => {
            const element = field.element;
            
            element.addEventListener('blur', () => this.validateField(fieldName));
            element.addEventListener('input', () => this.clearFieldValidation(fieldName));
            
            // Real-time validation for some fields
            if (field.rules.realTime) {
                element.addEventListener('input', () => this.validateField(fieldName));
            }
        });
    }

    validateField(fieldName) {
        const field = this.fields.get(fieldName);
        if (!field) return false;

        const value = field.element.value.trim();
        const parent = field.element.closest('.form-group');
        let isValid = true;
        let errorMessage = '';

        parent.classList.remove('valid', 'error');

        // Required validation
        if (field.rules.required && !value) {
            isValid = false;
            errorMessage = field.rules.requiredMessage || 'This field is required';
        }

        // Email validation
        if (isValid && field.rules.email && value) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(value)) {
                isValid = false;
                errorMessage = 'Please enter a valid email address';
            }
        }

        // Phone validation
        if (isValid && field.rules.phone && value) {
            const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
            if (!phoneRegex.test(value.replace(/[\s\-\(\)]/g, ''))) {
                isValid = false;
                errorMessage = 'Please enter a valid phone number';
            }
        }

        // Min length validation
        if (isValid && field.rules.minLength && value.length < field.rules.minLength) {
            isValid = false;
            errorMessage = `Minimum ${field.rules.minLength} characters required`;
        }

        // Max length validation
        if (isValid && field.rules.maxLength && value.length > field.rules.maxLength) {
            isValid = false;
            errorMessage = `Maximum ${field.rules.maxLength} characters allowed`;
        }

        // Custom validation
        if (isValid && field.rules.custom && value) {
            const customResult = field.rules.custom(value);
            if (!customResult.isValid) {
                isValid = false;
                errorMessage = customResult.message;
            }
        }

        // Update UI
        field.isValid = isValid;
        if (isValid) {
            parent.classList.add('valid');
        } else {
            parent.classList.add('error');
            this.showFieldError(fieldName, errorMessage);
        }

        return isValid;
    }

    showFieldError(fieldName, message) {
        const field = this.fields.get(fieldName);
        const parent = field.element.closest('.form-group');
        
        let errorElement = parent.querySelector('.validation-message.error');
        if (!errorElement) {
            errorElement = document.createElement('div');
            errorElement.className = 'validation-message error';
            parent.appendChild(errorElement);
        }
        
        errorElement.textContent = message;
        errorElement.style.display = 'block';
    }

    clearFieldValidation(fieldName) {
        const field = this.fields.get(fieldName);
        const parent = field.element.closest('.form-group');
        
        parent.classList.remove('error');
        const errorElement = parent.querySelector('.validation-message.error');
        if (errorElement) {
            errorElement.style.display = 'none';
        }
    }

    validateAll() {
        let isValid = true;
        
        this.fields.forEach((field, fieldName) => {
            if (!this.validateField(fieldName)) {
                isValid = false;
            }
        });
        
        return isValid;
    }

    getValidData() {
        const data = {};
        this.fields.forEach((field, fieldName) => {
            if (field.isValid) {
                data[fieldName] = field.element.value.trim();
            }
        });
        return data;
    }
}

// Session Management
class SessionManager {
    constructor() {
        this.timeout = parseInt(localStorage.getItem('sessionTimeout')) || 30 * 60 * 1000; // 30 minutes default
        this.setupActivityTracking();
        this.checkSession();
    }

    setupActivityTracking() {
        // Track user activity
        ['click', 'keypress', 'mousemove', 'scroll'].forEach(event => {
            document.addEventListener(event, () => this.updateActivity(), { passive: true });
        });
    }

    updateActivity() {
        localStorage.setItem('lastActivity', Date.now());
    }

    checkSession() {
        const lastActivity = localStorage.getItem('lastActivity');
        const now = Date.now();
        
        if (lastActivity && (now - lastActivity > this.timeout)) {
            this.logout();
        }
    }

    logout() {
        localStorage.removeItem('adminSession');
        localStorage.removeItem('lastActivity');
        window.location.href = 'index.html';
    }

    setSessionTimeout(minutes) {
        this.timeout = minutes * 60 * 1000;
        localStorage.setItem('sessionTimeout', this.timeout.toString());
    }
}

// Data Export System
class DataExporter {
    static exportToCSV(data, filename) {
        if (!data || data.length === 0) {
            throw new Error('No data to export');
        }

        const headers = Object.keys(data[0]);
        const csvContent = [
            headers.join(','),
            ...data.map(row => 
                headers.map(header => 
                    `"${String(row[header] || '').replace(/"/g, '""')}"`
                ).join(',')
            )
        ].join('\n');

        this.downloadFile(csvContent, filename, 'text/csv');
    }

    static exportToJSON(data, filename) {
        const jsonContent = JSON.stringify(data, null, 2);
        this.downloadFile(jsonContent, filename, 'application/json');
    }

    static exportToPDF(data, filename) {
        // This would typically use a PDF generation library
        console.log('PDF export would be implemented with a library like jsPDF');
        // Placeholder implementation
        this.exportToCSV(data, filename.replace('.pdf', '.csv'));
    }

    static downloadFile(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
    }
}

// Local Storage Manager
class StorageManager {
    static set(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (error) {
            console.error('Storage error:', error);
            return false;
        }
    }

    static get(key, defaultValue = null) {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : defaultValue;
        } catch (error) {
            console.error('Storage error:', error);
            return defaultValue;
        }
    }

    static remove(key) {
        localStorage.removeItem(key);
    }

    static clear() {
        localStorage.clear();
    }

    static getAll() {
        const items = {};
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            try {
                items[key] = JSON.parse(localStorage.getItem(key));
            } catch (error) {
                items[key] = localStorage.getItem(key);
            }
        }
        return items;
    }
}

// API Service
class ApiService {
    constructor(baseURL = '') {
        this.baseURL = baseURL;
    }

    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const config = {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        };

        if (config.body && typeof config.body === 'object') {
            config.body = JSON.stringify(config.body);
        }

        try {
            const response = await fetch(url, config);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('API request failed:', error);
            throw error;
        }
    }

    async get(endpoint) {
        return this.request(endpoint);
    }

    async post(endpoint, data) {
        return this.request(endpoint, {
            method: 'POST',
            body: data
        });
    }

    async put(endpoint, data) {
        return this.request(endpoint, {
            method: 'PUT',
            body: data
        });
    }

    async delete(endpoint) {
        return this.request(endpoint, {
            method: 'DELETE'
        });
    }
}

// Utility Functions
const Utils = {
    // Debounce function for search and resize events
    debounce(func, wait, immediate) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                timeout = null;
                if (!immediate) func(...args);
            };
            const callNow = immediate && !timeout;
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
            if (callNow) func(...args);
        };
    },

    // Format date
    formatDate(date, format = 'medium') {
        const d = new Date(date);
        const options = {
            short: { year: 'numeric', month: 'short', day: 'numeric' },
            medium: { year: 'numeric', month: 'long', day: 'numeric' },
            long: { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }
        };
        return d.toLocaleDateString(undefined, options[format] || options.medium);
    },

    // Format file size
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    },

    // Generate unique ID
    generateId() {
        return 'id_' + Math.random().toString(36).substr(2, 9);
    },

    // Check if device is mobile
    isMobile() {
        return window.innerWidth <= 768;
    },

    // Copy to clipboard
    async copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch (error) {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = text;
            document.body.appendChild(textArea);
            textArea.select();
            try {
                document.execCommand('copy');
                return true;
            } catch (fallbackError) {
                console.error('Copy failed:', fallbackError);
                return false;
            } finally {
                document.body.removeChild(textArea);
            }
        }
    },

    // Download data as file
    downloadData(data, filename, mimeType = 'text/plain') {
        const blob = new Blob([data], { type: mimeType });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
    }
};

// Initialize global utilities
window.NotificationSystem = NotificationSystem;
window.FormValidator = FormValidator;
window.SessionManager = SessionManager;
window.DataExporter = DataExporter;
window.StorageManager = StorageManager;
window.ApiService = ApiService;
window.Utils = Utils;

// Auto-initialize session manager
document.addEventListener('DOMContentLoaded', () => {
    window.sessionManager = new SessionManager();
    window.notificationSystem = new NotificationSystem();
});

// Service Worker Registration for PWA
if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
        navigator.serviceWorker.register('/sw.js')
            .then(function(registration) {
                console.log('ServiceWorker registration successful with scope: ', registration.scope);
            })
            .catch(function(error) {
                console.log('ServiceWorker registration failed: ', error);
            });
    });
}

// Offline detection
window.addEventListener('online', () => {
    Utils.showNotification('Connection restored', 'success');
});

window.addEventListener('offline', () => {
    Utils.showNotification('You are currently offline', 'warning');
});