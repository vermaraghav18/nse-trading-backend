import axios from 'axios';
import { env } from '../../config/env';
import { SimpleLogger } from '../../utils/simple-logger';

let accessToken: string | null = null;

// Export getter for token (for market-data-provider)
export function getDhanAccessToken(): string | null {
  return accessToken;
}

export async function authenticateDhan(): Promise<void> {
  try {
    const response = await axios.post('https://api.dhan.co/v1/access_token', {
      client_id: env.dhan.apiKey,
      client_secret: env.dhan.apiSecret
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });
    
    accessToken = response.data.access_token;
    SimpleLogger.success('Dhan API authenticated');
  } catch (error: any) {
    SimpleLogger.error('Dhan authentication failed');
    console.error('Dhan Error Details:', error.response?.data || error.message);
    throw error;
  }
}

export async function getDhanHoldings(): Promise<any> {
  if (!accessToken) await authenticateDhan();
  
  const response = await axios.get('https://api.dhan.co/v1/holdings', {
    headers: { 
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  });
  
  return response.data;
}

export async function getDhanPositions(): Promise<any> {
  if (!accessToken) await authenticateDhan();
  
  const response = await axios.get('https://api.dhan.co/v1/positions', {
    headers: { 
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  });
  
  return response.data;
}

export async function getDhanOrders(): Promise<any> {
  if (!accessToken) await authenticateDhan();
  
  const response = await axios.get('https://api.dhan.co/v1/orders', {
    headers: { 
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  });
  
  return response.data;
}

export async function getDhanFunds(): Promise<any> {
  if (!accessToken) await authenticateDhan();
  
  const response = await axios.get('https://api.dhan.co/v1/funds', {
    headers: { 
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  });
  
  return response.data;
}