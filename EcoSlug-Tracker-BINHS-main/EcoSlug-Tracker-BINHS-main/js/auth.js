// EcoSlug Tracker - Google Authentication Service

class GoogleAuthService {
    constructor() {
        this.isInitialized = false;
        this.currentUser = null;
        this.authInstance = null;
        
        // Google OAuth configuration
        this.config = {
            client_id: '973644214985-cgb7ehk0d902nhbmja3vkn6ialt8uio9.apps.googleusercontent.com',
            scope: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email',
            discovery_docs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
            immediate: false,
            cookie_policy: 'single_host_origin'
        };

        this.init();
    }

    // Initialize Google API
    async init() {
        // Skip if running from file:// protocol
        if (window.location.protocol === 'file:') {
            console.warn('Google Auth disabled: Please serve via HTTP for full functionality');
            this.showMessage('Google Sign-in requires HTTP server. Running in local-only mode.', 'info');
            return;
        }
        
        try {
            console.log('🚀 Starting Google Auth initialization...');
            console.log('📍 Current URL:', window.location.href);
            console.log('🔧 Protocol:', window.location.protocol);
            console.log('🏠 Origin:', window.location.origin);
            
            // Load Google API script with timeout
            if (!window.gapi) {
                console.log('📥 Loading Google API script...');
                await Promise.race([
                    this.loadGoogleAPI(),
                    new Promise((_, reject) => {
                        setTimeout(() => reject(new Error('⏰ Timeout loading Google API script (10s)')), 10000);
                    })
                ]);
                console.log('✅ Google API script loaded');
            } else {
                console.log('✅ Google API already available');
            }

            // Initialize Google API client with timeout
            console.log('🔧 Initializing Google API client...');
            await Promise.race([
                new Promise((resolve, reject) => {
                    gapi.load('auth2:client', {
                        callback: () => {
                            console.log('✅ Google API client loaded');
                            resolve();
                        },
                        onerror: (error) => {
                            console.error('❌ Failed to load Google API client:', error);
                            reject(error);
                        }
                    });
                }),
                new Promise((_, reject) => {
                    setTimeout(() => reject(new Error('⏰ Timeout loading Google API client (10s)')), 10000);
                })
            ]);

            console.log('🔐 Initializing Google Auth client...');
            console.log('🔑 Client ID:', this.config.client_id.substring(0, 20) + '...');
            console.log('🎯 Scopes:', this.config.scope);
            
            await Promise.race([
                gapi.client.init(this.config),
                new Promise((_, reject) => {
                    setTimeout(() => reject(new Error('⏰ Timeout initializing Google Auth (15s)')), 15000);
                })
            ]);
            console.log('✅ Google Auth client initialized');
            
            // Try to get auth instance, with fallback to explicit init
            console.log('🔍 Getting auth instance...');
            this.authInstance = gapi.auth2.getAuthInstance();
            
            if (!this.authInstance) {
                console.log('⚠️ Auth instance not found, trying explicit auth2 init...');
                try {
                    this.authInstance = await Promise.race([
                        gapi.auth2.init({
                            client_id: this.config.client_id,
                            scope: this.config.scope,
                            cookie_policy: 'none'
                        }),
                        new Promise((_, reject) => {
                            setTimeout(() => reject(new Error('⏰ Timeout on explicit auth2 init (10s)')), 10000);
                        })
                    ]);
                    console.log('✅ Auth instance created via explicit init');
                } catch (initError) {
                    console.error('❌ Explicit auth2 init failed:', initError);
                    throw new Error(`Failed to initialize Google Auth: ${initError.message}`);
                }
            } else {
                console.log('✅ Auth instance found');
            }
            
            if (!this.authInstance) {
                throw new Error('Failed to get Google Auth instance - check Client ID configuration');
            }
            
            // Check if user is already signed in
            if (this.authInstance.isSignedIn.get()) {
                console.log('User already signed in');
                this.currentUser = this.authInstance.currentUser.get();
                this.updateUserInterface();
            }

            // Listen for sign-in state changes
            this.authInstance.isSignedIn.listen((isSignedIn) => {
                console.log(`Sign-in state changed: ${isSignedIn}`);
                if (isSignedIn) {
                    this.currentUser = this.authInstance.currentUser.get();
                    this.onSignIn();
                } else {
                    this.currentUser = null;
                    this.onSignOut();
                }
                this.updateUserInterface();
            });

            this.isInitialized = true;
            console.log('🎉 Google Auth initialized successfully!');
            
            // Show final status
            const signedIn = this.authInstance.isSignedIn.get();
            console.log('👤 Currently signed in:', signedIn);
            if (signedIn) {
                const user = this.authInstance.currentUser.get();
                const profile = user.getBasicProfile();
                console.log('👋 Welcome back:', profile.getName());
            }
            
        } catch (error) {
            console.error('Failed to initialize Google Auth:', error);
            this.isInitialized = false;
            
            // Show specific error messages
            let errorMessage = 'Failed to initialize Google authentication.';
            if (error.message.includes('Timeout')) {
                errorMessage += ' Connection timed out. Please check your internet connection.';
            } else if (error.message.includes('invalid_client')) {
                errorMessage += ' Invalid client configuration. Please check your Google OAuth setup.';
            } else {
                errorMessage += ` Error: ${error.message}`;
            }
            
            this.showMessage(errorMessage, 'error');
        }
    }

    // Load Google API script dynamically
    loadGoogleAPI() {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://apis.google.com/js/api.js';
            script.onload = () => {
                console.log('Google API script loaded successfully');
                resolve();
            };
            script.onerror = (error) => {
                console.error('Failed to load Google API script:', error);
                reject(new Error('Failed to load Google API script'));
            };
            document.head.appendChild(script);
            
            // Add timeout for script loading
            setTimeout(() => {
                if (!window.gapi) {
                    reject(new Error('Timeout loading Google API script'));
                }
            }, 10000);
        });
    }

    // Sign in user
    async signIn() {
        try {
            if (!this.isInitialized) {
                throw new Error('Google Auth not initialized');
            }

            const user = await this.authInstance.signIn();
            this.currentUser = user;
            return user;
            
        } catch (error) {
            console.error('Sign in failed:', error);
            this.showMessage('Failed to sign in with Google. Please try again.', 'error');
            throw error;
        }
    }

    // Sign out user
    async signOut() {
        try {
            if (!this.isInitialized) {
                return;
            }

            await this.authInstance.signOut();
            this.currentUser = null;
            
        } catch (error) {
            console.error('Sign out failed:', error);
            this.showMessage('Failed to sign out. Please try again.', 'error');
        }
    }

    // Check if user is signed in
    isSignedIn() {
        return this.authInstance && this.authInstance.isSignedIn.get();
    }

    // Get current user info
    getUserInfo() {
        if (!this.currentUser) return null;

        const profile = this.currentUser.getBasicProfile();
        return {
            id: profile.getId(),
            name: profile.getName(),
            email: profile.getEmail(),
            picture: profile.getImageUrl()
        };
    }

    // Get access token
    getAccessToken() {
        if (!this.currentUser) return null;
        return this.currentUser.getAuthResponse().access_token;
    }

    // Handle successful sign in
    onSignIn() {
        console.log('User signed in successfully');
        this.showMessage('Successfully signed in with Google!', 'success');
        
        // Attempt to sync data from cloud
        this.syncFromCloud().catch(error => {
            console.error('Failed to sync data from cloud:', error);
        });
    }

    // Handle sign out
    onSignOut() {
        console.log('User signed out');
        this.showMessage('Successfully signed out from Google.', 'success');
    }

    // Update user interface elements
    updateUserInterface() {
        const signInBtn = document.getElementById('googleSignInBtn');
        const signOutBtn = document.getElementById('googleSignOutBtn');
        const userProfile = document.getElementById('userProfile');
        const syncStatus = document.getElementById('syncStatus');
        const syncToCloudBtn = document.getElementById('syncToCloudBtn');
        const syncFromCloudBtn = document.getElementById('syncFromCloudBtn');

        if (!signInBtn || !signOutBtn || !userProfile) return;

        if (this.isSignedIn()) {
            const userInfo = this.getUserInfo();
            
            // Show user profile
            signInBtn.style.display = 'none';
            signOutBtn.style.display = 'inline-flex';
            userProfile.style.display = 'block';
            
            // Update profile information
            const userAvatar = document.getElementById('userAvatar');
            const userName = document.getElementById('userName');
            const userEmail = document.getElementById('userEmail');
            
            if (userAvatar) userAvatar.src = userInfo.picture;
            if (userName) userName.textContent = userInfo.name;
            if (userEmail) userEmail.textContent = userInfo.email;
            
            // Enable cloud sync controls
            if (syncToCloudBtn) {
                syncToCloudBtn.disabled = false;
                syncToCloudBtn.title = 'Upload your data to Google Drive';
            }
            if (syncFromCloudBtn) {
                syncFromCloudBtn.disabled = false;
                syncFromCloudBtn.title = 'Download your data from Google Drive';
            }
            
            // Update sync status
            if (syncStatus) {
                syncStatus.innerHTML = `
                    <p><strong>Cloud Sync:</strong> Enabled</p>
                    <p><strong>Last Sync:</strong> <span id="lastSyncTime">Checking...</span></p>
                `;
                this.updateLastSyncTime();
            }
            
        } else {
            // Show sign in button
            signInBtn.style.display = 'inline-flex';
            signOutBtn.style.display = 'none';
            userProfile.style.display = 'none';
            
            // Disable cloud sync controls
            if (syncToCloudBtn) {
                syncToCloudBtn.disabled = true;
                syncToCloudBtn.title = 'Sign in with Google to enable cloud sync';
            }
            if (syncFromCloudBtn) {
                syncFromCloudBtn.disabled = true;
                syncFromCloudBtn.title = 'Sign in with Google to enable cloud sync';
            }
            
            // Update sync status
            if (syncStatus) {
                syncStatus.innerHTML = `
                    <p><strong>Cloud Sync:</strong> Sign in to enable cloud backup</p>
                    <p><strong>Data Storage:</strong> Local device only</p>
                `;
            }
        }
    }

    // Sync data to cloud (Google Drive)
    async syncToCloud() {
        if (!this.isSignedIn()) {
            throw new Error('User not signed in');
        }

        try {
            // Prepare data to sync
            const data = {
                settings: JSON.parse(localStorage.getItem('ecoSlugSettings') || '{}'),
                logData: JSON.parse(localStorage.getItem('pesticideLog') || '[]'),
                pestCountData: JSON.parse(localStorage.getItem('pestCountData') || '{}'),
                lastApplication: localStorage.getItem('lastPesticideApplication'),
                lastSync: new Date().toISOString(),
                version: '1.0'
            };

            // Create or update file in Google Drive
            const fileContent = JSON.stringify(data, null, 2);
            const metadata = {
                name: 'ecoslug-tracker-data.json',
                parents: ['appDataFolder'] // Stores in app-specific folder
            };

            // Check if file already exists
            const existingFile = await this.findDataFile();
            
            let response;
            if (existingFile) {
                // Update existing file
                response = await gapi.client.request({
                    path: `https://www.googleapis.com/upload/drive/v3/files/${existingFile.id}`,
                    method: 'PATCH',
                    params: {
                        uploadType: 'media'
                    },
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: fileContent
                });
            } else {
                // Create new file
                response = await gapi.client.request({
                    path: 'https://www.googleapis.com/upload/drive/v3/files',
                    method: 'POST',
                    params: {
                        uploadType: 'multipart'
                    },
                    headers: {
                        'Content-Type': 'multipart/related; boundary="foo_bar_baz"'
                    },
                    body: this.createMultipartBody(metadata, fileContent)
                });
            }

            // Update last sync time
            localStorage.setItem('lastCloudSync', new Date().toISOString());
            this.updateLastSyncTime();
            
            console.log('Data synced to cloud successfully');
            return response.result;
            
        } catch (error) {
            console.error('Failed to sync data to cloud:', error);
            throw error;
        }
    }

    // Sync data from cloud
    async syncFromCloud(forcePrompt = false) {
        if (!this.isSignedIn()) {
            throw new Error('User not signed in');
        }

        try {
            const dataFile = await this.findDataFile();
            if (!dataFile) {
                console.log('No cloud data found');
                if (forcePrompt) {
                    this.showMessage('No cloud backup found. Your data will be backed up when you sync to cloud.', 'info');
                }
                return null;
            }

            // Download file content
            const response = await gapi.client.drive.files.get({
                fileId: dataFile.id,
                alt: 'media'
            });

            const cloudData = JSON.parse(response.body);
            
            // Check if cloud data is newer than local data or if force prompted
            const lastCloudSync = localStorage.getItem('lastCloudSync');
            const cloudSyncTime = new Date(cloudData.lastSync || 0);
            const localSyncTime = new Date(lastCloudSync || 0);
            
            if (forcePrompt || cloudSyncTime > localSyncTime) {
                let confirmMessage;
                if (forcePrompt) {
                    const syncDate = cloudData.lastSync ? new Date(cloudData.lastSync).toLocaleString() : 'Unknown';
                    confirmMessage = `Found cloud backup from ${syncDate}. Do you want to restore your data from the cloud? This will replace all current local data.`;
                } else {
                    confirmMessage = 'Cloud data is more recent than local data. Do you want to replace your local data with cloud data?';
                }
                
                const userConfirmed = confirm(confirmMessage);
                
                if (userConfirmed) {
                    // Replace local data with cloud data
                    if (cloudData.settings) {
                        localStorage.setItem('ecoSlugSettings', JSON.stringify(cloudData.settings));
                    }
                    if (cloudData.logData) {
                        localStorage.setItem('pesticideLog', JSON.stringify(cloudData.logData));
                    }
                    if (cloudData.pestCountData) {
                        localStorage.setItem('pestCountData', JSON.stringify(cloudData.pestCountData));
                    }
                    if (cloudData.lastApplication) {
                        localStorage.setItem('lastPesticideApplication', cloudData.lastApplication);
                    }
                    
                    localStorage.setItem('lastCloudSync', cloudData.lastSync);
                    this.updateLastSyncTime();
                    
                    this.showMessage('Data restored from cloud successfully!', 'success');
                    
                    // Reload settings if on settings page
                    if (typeof loadSettings === 'function') {
                        loadSettings();
                    }
                    
                    return true; // Indicate data was restored
                } else if (forcePrompt) {
                    this.showMessage('Cloud restore cancelled.', 'info');
                }
            } else if (forcePrompt) {
                this.showMessage('Local data is up to date with cloud backup.', 'success');
            }
            
            return cloudData;
            
        } catch (error) {
            console.error('Failed to sync data from cloud:', error);
            throw error;
        }
    }

    // Find existing data file in Google Drive
    async findDataFile() {
        try {
            const response = await gapi.client.drive.files.list({
                q: "name='ecoslug-tracker-data.json' and parents in 'appDataFolder'",
                spaces: 'appDataFolder'
            });

            const files = response.result.files;
            return files && files.length > 0 ? files[0] : null;
            
        } catch (error) {
            console.error('Failed to find data file:', error);
            return null;
        }
    }

    // Create multipart body for file upload
    createMultipartBody(metadata, data) {
        const delimiter = 'foo_bar_baz';
        let body = '';
        
        body += `--${delimiter}\r\n`;
        body += 'Content-Type: application/json\r\n\r\n';
        body += JSON.stringify(metadata) + '\r\n';
        body += `--${delimiter}\r\n`;
        body += 'Content-Type: application/json\r\n\r\n';
        body += data + '\r\n';
        body += `--${delimiter}--`;
        
        return body;
    }

    // Update last sync time display
    updateLastSyncTime() {
        const lastSyncElement = document.getElementById('lastSyncTime');
        if (lastSyncElement) {
            const lastSync = localStorage.getItem('lastCloudSync');
            if (lastSync) {
                const syncDate = new Date(lastSync);
                lastSyncElement.textContent = syncDate.toLocaleString();
            } else {
                lastSyncElement.textContent = 'Never';
            }
        }
    }

    // Show message to user
    showMessage(text, type) {
        // Try to use existing showMessage function if available
        if (typeof showMessage === 'function') {
            showMessage(text, type);
            return;
        }

        // Fallback message display
        const messageDiv = document.createElement('div');
        messageDiv.className = type === 'success' ? 'success-message' : 'error-message';
        messageDiv.textContent = text;
        messageDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 16px;
            border-radius: 4px;
            color: white;
            font-weight: 500;
            z-index: 1000;
            background-color: ${type === 'success' ? '#4CAF50' : '#f44336'};
        `;
        
        document.body.appendChild(messageDiv);
        
        setTimeout(() => {
            if (messageDiv.parentNode) {
                messageDiv.remove();
            }
        }, 3000);
    }
}

// Global instance
const googleAuthService = new GoogleAuthService();

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GoogleAuthService;
}
