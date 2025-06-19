import axios, { AxiosInstance, AxiosResponse } from 'axios';

export class ApiClient {
  private client: AxiosInstance;
  private authToken?: string;

  constructor(baseUrl: string) {
    this.client = axios.create({
      baseURL: baseUrl,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // リクエストインターセプター（認証トークンを自動追加）
    this.client.interceptors.request.use(
      (config) => {
        if (this.authToken) {
          config.headers.Authorization = `Bearer ${this.authToken}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // レスポンスインターセプター
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response) {
          // サーバーが応答したがエラーステータス
          throw new Error(`HTTP ${error.response.status}: ${error.response.data?.message || error.message}`);
        } else if (error.request) {
          // リクエストが送信されたが応答がない
          throw new Error('APIサーバーに接続できません');
        } else {
          // その他のエラー
          throw new Error(`リクエストエラー: ${error.message}`);
        }
      }
    );
  }

  setAuthToken(token: string): void {
    this.authToken = token;
  }

  clearAuthToken(): void {
    this.authToken = undefined;
  }

  async get(endpoint: string): Promise<any> {
    const response: AxiosResponse = await this.client.get(endpoint);
    return response.data;
  }

  async post(endpoint: string, data: any): Promise<any> {
    const response: AxiosResponse = await this.client.post(endpoint, data);
    return response.data;
  }

  async put(endpoint: string, data: any): Promise<any> {
    const response: AxiosResponse = await this.client.put(endpoint, data);
    return response.data;
  }

  async patch(endpoint: string, data: any): Promise<any> {
    const response: AxiosResponse = await this.client.patch(endpoint, data);
    return response.data;
  }

  async delete(endpoint: string): Promise<any> {
    const response: AxiosResponse = await this.client.delete(endpoint);
    return response.data;
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.get('/');
      return true;
    } catch {
      return false;
    }
  }
} 