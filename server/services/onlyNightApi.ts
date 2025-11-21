import axios, { AxiosInstance } from 'axios';

/**
 * OnlyNight API Service
 * 
 * This service handles communication with the OnlyNight hotel booking API
 * for instant price search and room archive data retrieval.
 */

interface OnlyNightConfig {
  baseUrl: string;
  clientSecret: string;
}

interface InstantSearchParams {
  dateFrom: string;  // YYYY-MM-DD format
  dateTo: string;    // YYYY-MM-DD format
  hotelName?: string;
  city?: string;
  adults: number;
  paxChildren?: number[];
  stars?: number;
  limit?: number;
}

interface RoomArchiveParams {
  stayFrom?: string;     // ISO datetime
  stayTo?: string;       // ISO datetime
  hotelName?: string;
  minPrice?: number;
  maxPrice?: number;
  city?: string;
  roomBoard?: string;
  roomCategory?: string;
  minUpdatedAt?: string;
  maxUpdatedAt?: string;
  pageNumber?: number;
  pageSize?: number;
}

interface OnlyNightResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

class OnlyNightApiService {
  private client: AxiosInstance;
  private token: string | null = null;
  private config: OnlyNightConfig;

  constructor(config: OnlyNightConfig) {
    this.config = config;
    this.client = axios.create({
      baseURL: config.baseUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add request interceptor to include auth token
    this.client.interceptors.request.use(
      async (config) => {
        // Ensure we have a valid token
        if (!this.token) {
          await this.authenticate();
        }
        if (this.token) {
          config.headers.Authorization = `Bearer ${this.token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Add response interceptor to handle token expiration
    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 401) {
          // Token expired, retry authentication
          this.token = null;
          await this.authenticate();
          // Retry the original request
          return this.client.request(error.config);
        }
        return Promise.reject(error);
      }
    );
  }

  /**
   * Authenticate with OnlyNight API
   */
  private async authenticate(): Promise<void> {
    try {
      console.log('[OnlyNight API] 🔐 Authenticating...');
      const formData = new FormData();
      formData.append('client_secret', this.config.clientSecret);

      const response = await axios.post(
        `${this.config.baseUrl}/api/auth/OnlyNightUsersTokenAPI`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      if (response.data?.token) {
        this.token = response.data.token;
        console.log('[OnlyNight API] ✅ Authentication successful');
      } else {
        throw new Error('No token received from authentication endpoint');
      }
    } catch (error) {
      console.error('[OnlyNight API] ❌ Authentication failed:', error);
      throw new Error('Failed to authenticate with OnlyNight API');
    }
  }

  /**
   * Search for instant hotel prices
   * 
   * @param params - Search parameters including dates, location, guests
   * @returns Search results with hotel offers and prices
   */
  async searchInstantPrices(params: InstantSearchParams): Promise<OnlyNightResponse> {
    try {
      console.log('[OnlyNight API] 🔍 Searching instant prices:', params);

      const response = await this.client.post('/api/hotels/GetInnstantSearchPrice', {
        dateFrom: params.dateFrom,
        dateTo: params.dateTo,
        hotelName: params.hotelName || null,
        city: params.city || null,
        adults: params.adults,
        paxChildren: params.paxChildren || null,
        stars: params.stars || null,
        limit: params.limit || 50,
      });

      console.log(`[OnlyNight API] ✅ Found ${response.data?.results?.length || 0} results`);

      return {
        success: true,
        data: response.data,
      };
    } catch (error: any) {
      console.error('[OnlyNight API] ❌ Search failed:', error.message);
      return {
        success: false,
        error: error.message || 'Failed to search instant prices',
      };
    }
  }

  /**
   * Get archived room data with filtering
   * 
   * @param params - Filter parameters for historical room data
   * @returns Paginated list of archived room bookings
   */
  async getRoomArchiveData(params: RoomArchiveParams = {}): Promise<OnlyNightResponse> {
    try {
      console.log('[OnlyNight API] 📦 Fetching room archive data:', params);

      const requestBody = {
        stayFrom: params.stayFrom || null,
        stayTo: params.stayTo || null,
        hotelName: params.hotelName || null,
        minPrice: params.minPrice || null,
        maxPrice: params.maxPrice || null,
        city: params.city || null,
        roomBoard: params.roomBoard || null,
        roomCategory: params.roomCategory || null,
        minUpdatedAt: params.minUpdatedAt || null,
        maxUpdatedAt: params.maxUpdatedAt || null,
        pageNumber: params.pageNumber || 1,
        pageSize: params.pageSize || 50,
      };

      const response = await this.client.post('/api/hotels/GetRoomArchiveData', requestBody);

      console.log(`[OnlyNight API] ✅ Retrieved ${response.data?.items?.length || 0} archive records`);

      return {
        success: true,
        data: response.data,
      };
    } catch (error: any) {
      console.error('[OnlyNight API] ❌ Archive fetch failed:', error.message);
      return {
        success: false,
        error: error.message || 'Failed to fetch room archive data',
      };
    }
  }

  /**
   * Format search results for display
   */
  formatSearchResults(data: any): string {
    if (!data || !data.results || data.results.length === 0) {
      return 'לא נמצאו תוצאות';
    }

    const results = data.results.slice(0, 10); // Limit to 10 results
    let formatted = `נמצאו ${data.results.length} מלונות:\n\n`;

    results.forEach((result: any, index: number) => {
      const hotel = result.hotelName || 'לא ידוע';
      const price = result.price?.amount || 'N/A';
      const currency = result.price?.currency || 'ILS';
      const board = result.roomBasis || 'לא צוין';
      const category = result.category || 'לא צוין';

      formatted += `${index + 1}. ${hotel}\n`;
      formatted += `   מחיר: ${currency} ${price}\n`;
      formatted += `   סוג חדר: ${category}\n`;
      formatted += `   ארוחות: ${board}\n\n`;
    });

    return formatted;
  }

  /**
   * Format archive data for display
   */
  formatArchiveData(data: any): string {
    if (!data || !data.items || data.items.length === 0) {
      return 'לא נמצאו רשומות בארכיון';
    }

    const items = data.items.slice(0, 10); // Limit to 10 items
    let formatted = `נמצאו ${data.totalItems || data.items.length} רשומות בארכיון:\n\n`;

    items.forEach((item: any, index: number) => {
      const hotel = item.hotelName || 'לא ידוע';
      const price = item.price || 'N/A';
      const checkIn = item.checkInDate || 'לא צוין';
      const checkOut = item.checkOutDate || 'לא צוין';
      const board = item.roomBoard || 'לא צוין';

      formatted += `${index + 1}. ${hotel}\n`;
      formatted += `   תאריכים: ${checkIn} - ${checkOut}\n`;
      formatted += `   מחיר: ₪${price}\n`;
      formatted += `   ארוחות: ${board}\n\n`;
    });

    return formatted;
  }
}

// Singleton instance
let onlyNightApiInstance: OnlyNightApiService | null = null;

/**
 * Get or create OnlyNight API service instance
 */
export function getOnlyNightApi(): OnlyNightApiService {
  if (!onlyNightApiInstance) {
    const baseUrl = process.env.ONLYNIGHT_API_URL || 'https://api.onlynight.com';
    const clientSecret = process.env.ONLYNIGHT_CLIENT_SECRET || '';

    if (!clientSecret) {
      console.warn('[OnlyNight API] ⚠️  No client secret configured. API calls may fail.');
    }

    onlyNightApiInstance = new OnlyNightApiService({
      baseUrl,
      clientSecret,
    });
  }

  return onlyNightApiInstance;
}

export default OnlyNightApiService;
