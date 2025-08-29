import { Injectable } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
interface Location {
  display_name: string;
  addresstype: string;
  name: string;
  address: {
    road: string;
    city: string;
    state: string;
    country: string;
    postcode: string;
    country_code: string;
  };
  boundingbox: string[];
}
@Injectable()
export class LocationService {
  api: AxiosInstance;
  constructor() {
    this.api = axios.create({
      baseURL: 'https://nominatim.openstreetmap.org',
      headers: {
        'User-Agent': 'mi-love/1.0',
      },
    });
  }

  async getLocationWithCoords(
    latitude: number,
    longitude: number,
  ): Promise<Location | null> {
    try {
      const response = await this.api.get(
        `/reverse?lat=${latitude}&lon=${longitude}&format=json`,
      );

      return response.data as Location;
    } catch {
      console.error('Error fetching location:');
      return null;
    }
  }
}
