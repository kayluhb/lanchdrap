// Health API routes
// System health and status endpoints

import { createApiResponse } from '../utils/response.js';

// Health check endpoint
export async function health(request, env) {
  try {
    const startTime = Date.now();

    // Test KV store connectivity
    let kvStatus = 'healthy';
    try {
      await env.LANCHDRAP_RATINGS.get('health_check');
      await env.LANCHDRAP_RATINGS.put(
        'health_check',
        JSON.stringify({ timestamp: new Date().toISOString() })
      );
    } catch (error) {
      kvStatus = 'unhealthy';
      console.error('KV store health check failed:', error);
    }

    const responseTime = Date.now() - startTime;

    return createApiResponse(
      {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '2.0.0',
        environment: env.ENVIRONMENT || 'development',
        services: {
          kv: kvStatus,
          api: 'healthy',
        },
        performance: {
          responseTime: `${responseTime}ms`,
          uptime: process.uptime ? `${Math.floor(process.uptime())}s` : 'unknown',
        },
        metadata: {
          userAgent: request.headers.get('User-Agent'),
          ip: request.headers.get('CF-Connecting-IP'),
          region: request.cf?.colo || 'unknown',
        },
      },
      200
    );
  } catch (error) {
    console.error('Health check error:', error);
    return createApiResponse(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        version: '2.0.0',
        error: error.message,
      },
      503
    );
  }
}
