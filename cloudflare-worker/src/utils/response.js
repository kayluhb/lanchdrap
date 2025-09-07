// Response utility functions for API routes
// Standardized response formatting across all endpoints

// CORS headers
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

// Create standardized API response
export function createApiResponse(data, status = 200, headers = corsHeaders) {
  return new Response(JSON.stringify({
    success: status >= 200 && status < 300,
    data,
    timestamp: new Date().toISOString(),
    status
  }), {
    status,
    headers: {
      ...headers,
      'Content-Type': 'application/json',
    },
  });
}

// Create standardized error response
export function createErrorResponse(message, status = 400, headers = corsHeaders, details = null) {
  const errorResponse = {
    success: false,
    error: {
      message,
      status,
      timestamp: new Date().toISOString()
    }
  };

  if (details) {
    errorResponse.error.details = details;
  }

  return new Response(JSON.stringify(errorResponse), {
    status,
    headers: {
      ...headers,
      'Content-Type': 'application/json',
    },
  });
}

// Create CORS preflight response
export function createCorsResponse() {
  return new Response(null, {
    status: 200,
    headers: corsHeaders,
  });
}
