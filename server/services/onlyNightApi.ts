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

interface InsertOpportunityParams {
  hotelId: number;
  startDateStr: string;
  endDateStr: string;
  boardId: number;
  categoryId: number;
  buyPrice: number;
  pushPrice: number;
  maxRooms: number;
  ratePlanCode?: string;
  invTypeCode?: string;
  reservationFullName?: string;
  stars?: number;
  destinationId?: number;
  locationRange?: number;
  providerId?: number;
  userId: number;
  paxAdults: number;
  paxChildren?: number[];
}

interface RoomsActiveParams {
  startDate?: string;
  endDate?: string;
  hotelName?: string;
  hotelStars?: number;
  city?: string;
  roomBoard?: string;
  roomCategory?: string;
  provider?: string;
}

interface DashboardParams {
  hotelStars?: number;
  city?: string;
  hotelName?: string;
  reservationMonthDate?: string;
  checkInMonthDate?: string;
  provider?: string;
}

interface OpportunitiesByBackOfficeParams {
  id: number;
}

interface OpportunitiesHotelSearchParams {
  opportiunityId: number;
}

interface ManualBookParams {
  opportiunityId: number;
  code: string;
}

interface UpdatePushPriceParams {
  preBookId: number;
  pushPrice: number;
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

  /**
   * Insert a hotel opportunity (booking opportunity)
   * 
   * @param params - Opportunity parameters
   * @returns Created opportunity details
   */
  async insertOpportunity(params: InsertOpportunityParams): Promise<OnlyNightResponse> {
    try {
      console.log('[OnlyNight API] ➕ Inserting opportunity:', params);

      const response = await this.client.post('/api/hotels/InsertOpportunity', params);

      console.log('[OnlyNight API] ✅ Opportunity inserted successfully');

      return {
        success: true,
        data: response.data,
      };
    } catch (error: any) {
      console.error('[OnlyNight API] ❌ Insert opportunity failed:', error.message);
      return {
        success: false,
        error: error.message || 'Failed to insert opportunity',
      };
    }
  }

  /**
   * Get active rooms (current bookings)
   * 
   * @param params - Filter parameters
   * @returns List of active room bookings
   */
  async getRoomsActive(params: RoomsActiveParams = {}): Promise<OnlyNightResponse> {
    try {
      console.log('[OnlyNight API] 🏨 Getting active rooms:', params);

      const response = await this.client.post('/api/hotels/GetRoomsActive', params);

      console.log(`[OnlyNight API] ✅ Found ${response.data?.length || 0} active rooms`);

      return {
        success: true,
        data: response.data,
      };
    } catch (error: any) {
      console.error('[OnlyNight API] ❌ Get active rooms failed:', error.message);
      return {
        success: false,
        error: error.message || 'Failed to get active rooms',
      };
    }
  }

  /**
   * Get sold rooms (sales records)
   * 
   * @param params - Filter parameters
   * @returns List of sold rooms
   */
  async getRoomsSales(params: RoomsActiveParams = {}): Promise<OnlyNightResponse> {
    try {
      console.log('[OnlyNight API] 💰 Getting rooms sales:', params);

      const response = await this.client.post('/api/hotels/GetRoomsSales', params);

      console.log(`[OnlyNight API] ✅ Found ${response.data?.length || 0} sales records`);

      return {
        success: true,
        data: response.data,
      };
    } catch (error: any) {
      console.error('[OnlyNight API] ❌ Get rooms sales failed:', error.message);
      return {
        success: false,
        error: error.message || 'Failed to get rooms sales',
      };
    }
  }

  /**
   * Get cancelled rooms
   * 
   * @param params - Filter parameters
   * @returns List of cancelled bookings
   */
  async getRoomsCancel(params: RoomsActiveParams = {}): Promise<OnlyNightResponse> {
    try {
      console.log('[OnlyNight API] ❌ Getting cancelled rooms:', params);

      const response = await this.client.post('/api/hotels/GetRoomsCancel', params);

      console.log(`[OnlyNight API] ✅ Found ${response.data?.length || 0} cancelled rooms`);

      return {
        success: true,
        data: response.data,
      };
    } catch (error: any) {
      console.error('[OnlyNight API] ❌ Get cancelled rooms failed:', error.message);
      return {
        success: false,
        error: error.message || 'Failed to get cancelled rooms',
      };
    }
  }

  /**
   * Get dashboard info (summary statistics)
   * 
   * @param params - Filter parameters
   * @returns Dashboard data with statistics
   */
  async getDashboardInfo(params: DashboardParams = {}): Promise<OnlyNightResponse> {
    try {
      console.log('[OnlyNight API] 📊 Getting dashboard info:', params);

      const response = await this.client.post('/api/hotels/GetDashboardInfo', params);

      console.log('[OnlyNight API] ✅ Dashboard info retrieved');

      return {
        success: true,
        data: response.data,
      };
    } catch (error: any) {
      console.error('[OnlyNight API] ❌ Get dashboard info failed:', error.message);
      return {
        success: false,
        error: error.message || 'Failed to get dashboard info',
      };
    }
  }

  /**
   * Get opportunities (booking opportunities list)
   * 
   * @param params - Filter parameters
   * @returns List of opportunities
   */
  async getOpportunities(params: DashboardParams = {}): Promise<OnlyNightResponse> {
    try {
      console.log('[OnlyNight API] 🎯 Getting opportunities:', params);

      const response = await this.client.post('/api/hotels/GetOpportunities', params);

      console.log(`[OnlyNight API] ✅ Found ${response.data?.length || 0} opportunities`);

      return {
        success: true,
        data: response.data,
      };
    } catch (error: any) {
      console.error('[OnlyNight API] ❌ Get opportunities failed:', error.message);
      return {
        success: false,
        error: error.message || 'Failed to get opportunities',
      };
    }
  }

  /**
   * Get opportunities by back office ID
   * 
   * @param params - ID parameter
   * @returns Opportunity details
   */
  async getOpportunitiesByBackOfficeId(params: OpportunitiesByBackOfficeParams): Promise<OnlyNightResponse> {
    try {
      console.log('[OnlyNight API] 🔍 Getting opportunities by back office ID:', params);

      const response = await this.client.post('/api/hotels/GetOpportiunitiesByBackOfficeId', params);

      console.log('[OnlyNight API] ✅ Opportunities retrieved');

      return {
        success: true,
        data: response.data,
      };
    } catch (error: any) {
      console.error('[OnlyNight API] ❌ Get opportunities by ID failed:', error.message);
      return {
        success: false,
        error: error.message || 'Failed to get opportunities by ID',
      };
    }
  }

  /**
   * Get opportunities hotel search
   * 
   * @param params - Opportunity ID
   * @returns Search results for opportunity
   */
  async getOpportunitiesHotelSearch(params: OpportunitiesHotelSearchParams): Promise<OnlyNightResponse> {
    try {
      console.log('[OnlyNight API] 🔎 Getting opportunities hotel search:', params);

      const response = await this.client.post('/api/hotels/GetOpportiunitiesHotelSearch', params);

      console.log('[OnlyNight API] ✅ Hotel search completed');

      return {
        success: true,
        data: response.data,
      };
    } catch (error: any) {
      console.error('[OnlyNight API] ❌ Opportunities hotel search failed:', error.message);
      return {
        success: false,
        error: error.message || 'Failed to search hotel opportunities',
      };
    }
  }

  /**
   * Manual book (confirm booking)
   * 
   * @param params - Booking parameters
   * @returns Booking confirmation
   */
  async manualBook(params: ManualBookParams): Promise<OnlyNightResponse> {
    try {
      console.log('[OnlyNight API] ✅ Manual booking:', params);

      const response = await this.client.post('/api/hotels/ManualBook', params);

      console.log('[OnlyNight API] ✅ Booking confirmed');

      return {
        success: true,
        data: response.data,
      };
    } catch (error: any) {
      console.error('[OnlyNight API] ❌ Manual book failed:', error.message);
      return {
        success: false,
        error: error.message || 'Failed to confirm booking',
      };
    }
  }

  /**
   * Update active room push price
   * 
   * @param params - Price update parameters
   * @returns Update confirmation
   */
  async updatePushPrice(params: UpdatePushPriceParams): Promise<OnlyNightResponse> {
    try {
      console.log('[OnlyNight API] 💵 Updating push price:', params);

      const response = await this.client.post('/api/hotels/UpdateRoomsActivePushPrice', params);

      console.log('[OnlyNight API] ✅ Push price updated');

      return {
        success: true,
        data: response.data,
      };
    } catch (error: any) {
      console.error('[OnlyNight API] ❌ Update push price failed:', error.message);
      return {
        success: false,
        error: error.message || 'Failed to update push price',
      };
    }
  }

  /**
   * Cancel active room booking
   * 
   * @param prebookId - Booking ID to cancel
   * @returns Cancellation confirmation
   */
  async cancelRoomActive(prebookId: number): Promise<OnlyNightResponse> {
    try {
      console.log('[OnlyNight API] 🚫 Cancelling room:', prebookId);

      const response = await this.client.delete(`/api/hotels/CancelRoomActive?prebookId=${prebookId}`);

      console.log('[OnlyNight API] ✅ Room cancelled successfully');

      return {
        success: true,
        data: response.data,
      };
    } catch (error: any) {
      console.error('[OnlyNight API] ❌ Cancel room failed:', error.message);
      return {
        success: false,
        error: error.message || 'Failed to cancel room',
      };
    }
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
