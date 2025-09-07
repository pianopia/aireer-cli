// Dashboard JavaScript
class AireerDashboard {
    constructor() {
        this.socket = null;
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 2000;
        
        this.initializeSocket();
        this.bindEvents();
        this.updateLastUpdateTime();
        
        // 定期的に最終更新時間を更新
        setInterval(() => this.updateLastUpdateTime(), 1000);
    }

    initializeSocket() {
        try {
            this.socket = io();
            
            this.socket.on('connect', () => {
                console.log('Connected to dashboard server');
                this.isConnected = true;
                this.reconnectAttempts = 0;
                this.updateConnectionStatus(true);
                this.hideErrorToast();
                this.showSuccessToast('ダッシュボードに接続しました');
            });

            this.socket.on('disconnect', () => {
                console.log('Disconnected from dashboard server');
                this.isConnected = false;
                this.updateConnectionStatus(false);
                this.showErrorToast('サーバーとの接続が切断されました');
                this.attemptReconnect();
            });

            this.socket.on('dashboard-data', (data) => {
                console.log('Received dashboard data:', data);
                this.updateDashboard(data);
            });

            this.socket.on('dashboard-error', (error) => {
                console.error('Dashboard error:', error);
                this.showErrorToast(`エラー: ${error.message}`);
            });

            this.socket.on('connect_error', (error) => {
                console.error('Connection error:', error);
                this.isConnected = false;
                this.updateConnectionStatus(false);
                this.showErrorToast('サーバーに接続できません');
                this.attemptReconnect();
            });

        } catch (error) {
            console.error('Socket initialization error:', error);
            this.showErrorToast('ダッシュボードの初期化に失敗しました');
        }
    }

    attemptReconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            console.log(`Reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
            
            setTimeout(() => {
                if (this.socket) {
                    this.socket.connect();
                }
            }, this.reconnectDelay * this.reconnectAttempts);
        } else {
            this.showErrorToast('サーバーに接続できません。ページを再読み込みしてください。');
        }
    }

    bindEvents() {
        // リフレッシュボタン
        window.refreshData = () => {
            if (this.socket && this.isConnected) {
                this.socket.emit('request-refresh');
                this.showSuccessToast('データを更新中...');
            } else {
                this.showErrorToast('サーバーに接続されていません');
            }
        };

        // トースト非表示
        window.hideErrorToast = () => this.hideErrorToast();
        window.hideSuccessToast = () => this.hideSuccessToast();
    }

    updateConnectionStatus(connected) {
        const statusElement = document.getElementById('connection-status');
        const dotElement = statusElement.querySelector('.status-dot');
        const textElement = statusElement.querySelector('span');
        
        if (connected) {
            dotElement.classList.remove('disconnected');
            textElement.textContent = '接続済み';
        } else {
            dotElement.classList.add('disconnected');
            textElement.textContent = '切断';
        }
    }

    updateDashboard(data) {
        if (data.error) {
            this.showErrorToast(`データ取得エラー: ${data.message}`);
            return;
        }

        this.updateSystemStatus(data.systemStatus);
        this.updateExecutionStats(data.executionStats);
        this.updateRoutines(data.routines);
        this.updateRecentExecutions(data.recentExecutions);
        this.updateLastUpdateTime();
    }

    updateSystemStatus(systemStatus) {
        if (!systemStatus) return;

        // API URL
        const apiUrlElement = document.getElementById('api-url');
        if (apiUrlElement) {
            apiUrlElement.textContent = systemStatus.apiUrl || '--';
        }

        // LLM Mode
        const llmModeElement = document.getElementById('llm-mode');
        if (llmModeElement) {
            llmModeElement.textContent = systemStatus.llmMode || '--';
        }

        // Auth Status
        const authStatusElement = document.getElementById('auth-status-detail');
        if (authStatusElement) {
            authStatusElement.textContent = systemStatus.isAuthenticated ? '認証済み' : '未認証';
            authStatusElement.className = 'status-badge ' + 
                (systemStatus.isAuthenticated ? 'authenticated' : 'unauthenticated');
        }

        // Header auth status
        const headerAuthElement = document.getElementById('auth-status');
        if (headerAuthElement) {
            const icon = headerAuthElement.querySelector('i');
            const text = headerAuthElement.querySelector('span');
            if (systemStatus.isAuthenticated) {
                icon.className = 'fas fa-user-check';
                text.textContent = '認証済み';
            } else {
                icon.className = 'fas fa-user-times';
                text.textContent = '未認証';
            }
        }

        // Gemini Status
        const geminiStatusElement = document.getElementById('gemini-status');
        if (geminiStatusElement) {
            geminiStatusElement.textContent = systemStatus.geminiConfigured ? '設定済み' : '未設定';
            geminiStatusElement.className = 'status-badge ' + 
                (systemStatus.geminiConfigured ? 'configured' : 'not-configured');
        }
    }

    updateExecutionStats(stats) {
        if (!stats) return;

        // 基本統計
        this.updateElement('total-executions', stats.totalExecutions || 0);
        this.updateElement('successful-executions', stats.successfulExecutions || 0);
        this.updateElement('failed-executions', stats.failedExecutions || 0);
        this.updateElement('success-rate', `${stats.successRate || 0}%`);

        // 追加統計
        this.updateElement('avg-duration', 
            stats.averageDuration > 0 ? `${stats.averageDuration}ms` : '--');
        
        this.updateElement('last-execution', 
            stats.lastExecution ? this.formatDateTime(stats.lastExecution) : '--');
    }

    updateRoutines(routines) {
        const loadingElement = document.getElementById('routines-loading');
        const listElement = document.getElementById('routines-list');
        const emptyElement = document.getElementById('routines-empty');

        // ローディング状態を非表示
        if (loadingElement) {
            loadingElement.style.display = 'none';
        }

        if (!routines || routines.length === 0) {
            // 空の状態を表示
            if (listElement) listElement.style.display = 'none';
            if (emptyElement) emptyElement.style.display = 'flex';
            return;
        }

        // リストを表示
        if (emptyElement) emptyElement.style.display = 'none';
        if (listElement) {
            listElement.style.display = 'block';
            listElement.innerHTML = routines.map(routine => this.createRoutineItem(routine)).join('');
        }
    }

    createRoutineItem(routine) {
        const successRate = routine.executions > 0 ? 
            Math.round((routine.successes / routine.executions) * 100) : 0;

        return `
            <div class="routine-item">
                <div class="routine-header">
                    <div class="routine-info">
                        <h4>${this.escapeHtml(routine.name)}</h4>
                        <p>${this.escapeHtml(routine.description)}</p>
                    </div>
                    <div class="routine-meta">
                        <span class="routine-status ${routine.isActive ? 'active' : 'inactive'}">
                            ${routine.isActive ? 'アクティブ' : '非アクティブ'}
                        </span>
                    </div>
                </div>
                <div class="routine-stats">
                    <div class="routine-stat priority">
                        <i class="fas fa-star"></i>
                        <span>優先度: ${routine.priority}</span>
                    </div>
                    <div class="routine-stat">
                        <i class="fas fa-weight"></i>
                        <span>重み: ${routine.weight}</span>
                    </div>
                    <div class="routine-stat executions">
                        <i class="fas fa-play"></i>
                        <span>実行: ${routine.executions}回</span>
                    </div>
                    <div class="routine-stat">
                        <i class="fas fa-percentage"></i>
                        <span>成功率: ${successRate}%</span>
                    </div>
                    ${routine.failures > 0 ? `
                        <div class="routine-stat failures">
                            <i class="fas fa-exclamation-triangle"></i>
                            <span>失敗: ${routine.failures}回</span>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }

    updateRecentExecutions(executions) {
        const loadingElement = document.getElementById('executions-loading');
        const listElement = document.getElementById('executions-list');
        const emptyElement = document.getElementById('executions-empty');

        // ローディング状態を非表示
        if (loadingElement) {
            loadingElement.style.display = 'none';
        }

        if (!executions || executions.length === 0) {
            // 空の状態を表示
            if (listElement) listElement.style.display = 'none';
            if (emptyElement) emptyElement.style.display = 'flex';
            return;
        }

        // リストを表示
        if (emptyElement) emptyElement.style.display = 'none';
        if (listElement) {
            listElement.style.display = 'block';
            listElement.innerHTML = executions.map(execution => this.createExecutionItem(execution)).join('');
        }
    }

    createExecutionItem(execution) {
        return `
            <div class="execution-item">
                <div class="execution-status ${execution.success ? 'success' : 'error'}">
                    <i class="fas ${execution.success ? 'fa-check-circle' : 'fa-times-circle'}"></i>
                </div>
                <div class="execution-details">
                    <div class="execution-routine">${this.escapeHtml(execution.routineName)}</div>
                    <div class="execution-message">${this.escapeHtml(execution.message)}</div>
                    ${execution.error ? `
                        <div class="execution-error">${this.escapeHtml(execution.error)}</div>
                    ` : ''}
                </div>
                <div class="execution-meta">
                    <div class="execution-time">${this.formatDateTime(execution.executedAt)}</div>
                    <div class="execution-duration">${execution.duration}ms</div>
                </div>
            </div>
        `;
    }

    updateElement(id, value) {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value;
        }
    }

    updateLastUpdateTime() {
        const element = document.getElementById('last-update');
        if (element) {
            element.textContent = `最終更新: ${this.formatTime(new Date())}`;
        }
    }

    formatDateTime(dateString) {
        if (!dateString) return '--';
        try {
            const date = new Date(dateString);
            return date.toLocaleString('ja-JP', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });
        } catch (error) {
            return dateString;
        }
    }

    formatTime(date) {
        try {
            return date.toLocaleTimeString('ja-JP', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });
        } catch (error) {
            return date.toString();
        }
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showErrorToast(message) {
        const toast = document.getElementById('error-toast');
        const messageElement = document.getElementById('error-message');
        
        if (toast && messageElement) {
            messageElement.textContent = message;
            toast.classList.add('show');
            
            // 自動的に非表示にする
            setTimeout(() => {
                this.hideErrorToast();
            }, 5000);
        }
    }

    showSuccessToast(message) {
        const toast = document.getElementById('success-toast');
        const messageElement = document.getElementById('success-message');
        
        if (toast && messageElement) {
            messageElement.textContent = message;
            toast.classList.add('show');
            
            // 自動的に非表示にする
            setTimeout(() => {
                this.hideSuccessToast();
            }, 3000);
        }
    }

    hideErrorToast() {
        const toast = document.getElementById('error-toast');
        if (toast) {
            toast.classList.remove('show');
        }
    }

    hideSuccessToast() {
        const toast = document.getElementById('success-toast');
        if (toast) {
            toast.classList.remove('show');
        }
    }
}

// ダッシュボード初期化
document.addEventListener('DOMContentLoaded', () => {
    console.log('Initializing Aireer Dashboard...');
    window.dashboard = new AireerDashboard();
});
