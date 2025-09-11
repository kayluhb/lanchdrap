# LunchDrop Ratings Cloudflare Worker

This Cloudflare Worker provides the backend API for the LunchDrop rating system, handling rating submissions, storage, and analytics.

## Features

- **Rating Submission**: POST `/api/ratings` - Submit new ratings
- **Rating Retrieval**: GET `/api/ratings` - Get ratings with optional filtering
- **Statistics**: GET `/api/ratings/stats` - Get rating statistics with time-based filtering
- **Restaurant List**: GET `/api/restaurants` - Get list of all restaurants with sorting options
- **Sellout Status**: POST `/api/restaurants/sellout` - Update restaurant sellout/availability status
- **Availability Stats**: GET `/api/restaurants/availability` - Get sellout and availability statistics
- **Availability Summary**: POST `/api/restaurants/availability-summary` - Record availability summaries from page scraping
- **Daily Availability**: GET `/api/restaurants/daily-availability` - Get availability data for specific dates
- **Office Availability**: GET `/api/restaurants/office-availability` - Get office-wide availability trends
- **Rating Sync**: POST `/api/sync` - Sync ratings from Chrome extension
- **Health Check**: GET `/api/health` - Worker health status

## Setup Instructions

### 1. Install Wrangler CLI

```bash
pnpm add -g wrangler
```

### 2. Login to Cloudflare

```bash
wrangler login
```

### 3. Create KV Namespace

```bash
wrangler kv:namespace create "RATINGS_KV"
wrangler kv:namespace create "RATINGS_KV" --preview
```

### 4. Update Configuration

Edit `wrangler.toml` and replace the KV namespace IDs with the ones from step 3:

```toml
[[kv_namespaces]]
binding = "RATINGS_KV"
id = "your-actual-kv-namespace-id"
preview_id = "your-actual-preview-kv-namespace-id"
```

### 5. Deploy

```bash
# Development
wrangler dev

# Staging
wrangler deploy --env staging

# Production
wrangler deploy --env production
```

## API Endpoints

### Submit Rating

```http
POST /api/ratings
Content-Type: application/json

{
  "orderId": "order_123",
  "restaurant": "Pizza Place",
  "items": ["Margherita Pizza", "Coke"],
  "rating": 5,
  "comment": "Great pizza!",
  "orderTotal": "$25.99"
}
```

### Get Ratings

```http
GET /api/ratings?restaurant=Pizza%20Place&limit=10&offset=0
```

### Get Statistics

```http
GET /api/ratings/stats?restaurant=Pizza%20Place&timeRange=month
```

**Query Parameters:**
- `restaurant` (optional): Restaurant name to get stats for
- `timeRange` (optional): Time range for stats - `all`, `week`, `month`, `year` (default: `all`)

**Response includes:**
- Total ratings count
- Average rating
- Rating distribution (1-5 stars with percentages)
- Rating counts for each star level
- Time-based metadata

### Get Restaurant List

```http
GET /api/restaurants?sortBy=rating&order=desc&limit=20&offset=0
```

**Query Parameters:**
- `sortBy` (optional): Sort criteria - `rating`, `totalRatings`, `name` (default: `rating`)
- `order` (optional): Sort order - `asc`, `desc` (default: `desc`)
- `limit` (optional): Number of restaurants to return (default: 50)
- `offset` (optional): Number of restaurants to skip (default: 0)

**Response includes:**
- List of restaurants with basic stats
- Total count and pagination info
- Sort criteria used

### Update Sellout Status

```http
POST /api/restaurants/sellout
Content-Type: application/json

{
  "restaurant": "Pizza Place",
  "status": "soldout",
  "reason": "Kitchen closed early",
  "timestamp": "2024-01-15T18:30:00Z"
}
```

**Request Body:**
- `restaurant` (required): Restaurant name
- `status` (required): Availability status - `available`, `soldout`, or `limited`
- `reason` (optional): Reason for status change
- `timestamp` (optional): When the status occurred (defaults to current time)

**Response includes:**
- Success confirmation
- Updated status record

### Get Availability Statistics

```http
GET /api/restaurants/availability?restaurant=Pizza%20Place&timeRange=week&includeDetails=true
```

**Query Parameters:**
- `restaurant` (optional): Restaurant name for specific stats
- `timeRange` (optional): Time range - `week`, `month`, `year` (default: `week`)
- `includeDetails` (optional): Include detailed history (default: `false`)

**Response includes:**
- Availability rates (available, soldout, limited)
- Time-based statistics
- Sellout history (if includeDetails=true)
- Top sellout restaurants (for overall stats)

### Record Availability Summary

```http
POST /api/restaurants/availability-summary
Content-Type: application/json

{
  "totalRestaurants": 12,
  "available": 8,
  "soldout": 3,
  "limited": 1,
  "timeSlot": "12:00-12:30pm",
  "timestamp": "2024-01-15T18:30:00Z"
}
```

**Request Body:**
- `totalRestaurants` (required): Total number of restaurants in the grid
- `available` (required): Number of available restaurants
- `soldout` (required): Number of sold out restaurants
- `limited` (required): Number of restaurants with limited availability
- `timeSlot` (optional): Time slot for the availability data
- `timestamp` (required): When the data was collected

**Response includes:**
- Success confirmation
- Processed summary data

**Use Case:**
This endpoint is used by the Chrome extension to automatically record availability data scraped from the LunchDrop restaurant grid page.

### Get Daily Availability

```http
GET /api/restaurants/daily-availability?date=2025-01-15&includeDetails=true
```

**Query Parameters:**
- `date` (required): Date in YYYY-MM-DD format
- `includeDetails` (optional): Include detailed summaries (default: false)

**Response includes:**
- Daily availability totals
- Time slot breakdowns
- City information
- Detailed summaries (if requested)

### Get Office Availability Trends

```http
GET /api/restaurants/office-availability?startDate=2025-01-01&endDate=2025-01-31&limit=30
```

**Query Parameters:**
- `startDate` (optional): Start date in YYYY-MM-DD format
- `endDate` (optional): End date in YYYY-MM-DD format
- `limit` (optional): Maximum number of days to return (default: 30)

**Response includes:**
- Office-wide statistics over time
- Average availability rates
- Daily breakdowns
- Trend analysis

### Restaurant Stats with User History

```http
GET /api/restaurants/stats?restaurant=pizza-place&userId=user123&timeRange=all
```

**Parameters:**
- `restaurant` (required): Restaurant ID or name
- `userId` (optional): User ID to include personal order history
- `timeRange` (optional): Time range filter (default: "all")

**Response includes:**
- Restaurant appearance statistics
- Sold out rates and dates
- User order history (if userId provided):
  - Total orders from this restaurant
  - Last order date
  - Last item purchased
  - All order dates
  - Recent orders (last 5)

### User Order History

```http
GET /api/orders?userId=user123&restaurantId=pizza-place
```

**Parameters:**
- `userId` (required): User ID
- `restaurantId` (optional): Filter by specific restaurant

**Response includes:**
- Complete order history for user
- Filtered by restaurant if specified
- Order dates and items

### Store User Order

```http
POST /api/orders
Content-Type: application/json

{
  "userId": "user123",
  "restaurantId": "pizza-place",
  "orderData": {
    "date": "2024-01-15",
    "items": ["Margherita Pizza", "Caesar Salad"]
  }
}
```

### Sync Ratings

```http
POST /api/sync
Content-Type: application/json

{
  "ratings": [
    {
      "orderId": "order_123",
      "restaurant": "Pizza Place",
      "items": ["Margherita Pizza"],
      "rating": 5,
      "comment": "Great!",
      "orderTotal": "$25.99"
    }
  ]
}
```

## Data Storage

The worker uses Cloudflare KV for data storage with the following key patterns:

- `rating:{ratingId}` - Individual rating records
- `restaurant:{restaurantName}:{ratingId}` - Ratings by restaurant
- `order:{orderId}` - Ratings by order ID (prevents duplicates)
- `stats:restaurant:{restaurantName}:{timeRange}` - Restaurant statistics by time range
- `stats:overall:{timeRange}` - Overall system statistics by time range
- `restaurants:list` - Master list of all restaurants for discovery
- `rate_limit:{clientIP}` - Rate limiting data
- `user_restaurant_history:{userId}:{restaurantId}` - Individual user-restaurant order history records

**Time Ranges Supported:**
- `all` - All-time statistics
- `year` - Year-to-date statistics
- `month` - Month-to-date statistics  
- `week` - Week-to-date statistics

**Additional Data Keys:**
- `sellout:{restaurant}:{timestamp}` - Individual sellout status records
- `daily:sellout:{date}` - Daily sellout tracking by date
- `daily:availability:{date}` - Daily availability statistics by date
- `daily:availability:office:{date}` - Office-specific daily availability
- `availability:summary:{date}:{timeSlot}` - Availability summaries by date and time
- `availability:office:{date}:{timeSlot}` - Office-specific availability summaries
- `restaurants:list` - Master restaurant list with availability tracking

**Date-Based Structure:**
The system now leverages LunchDrop's URL structure (`/app/YYYY-MM-DD`) to track:
- Daily restaurant counts and availability patterns
- Office-wide trends over time
- Historical data for trend analysis
- Time slot availability within each day

## Rate Limiting

- Default: 10 ratings per minute per IP address
- Configurable via environment variable `MAX_RATINGS_PER_USER`
- Rate limit resets after 1 minute

## Environment Variables

- `ENVIRONMENT`: "development", "staging", or "production"
- `MAX_RATINGS_PER_USER`: Maximum ratings per user per minute
- `RATE_LIMIT_PER_MINUTE`: Rate limit threshold

## Local Development

```bash
# Install dependencies
pnpm install

# Start local development server
pnpm run dev

# The worker will be available at http://localhost:8787
```

## Testing

Test the API endpoints using curl or any HTTP client:

```bash
# Health check
curl https://your-worker.your-subdomain.workers.dev/api/health

# Submit rating
curl -X POST https://your-worker.your-subdomain.workers.dev/api/ratings \
  -H "Content-Type: application/json" \
  -d '{"orderId":"test123","restaurant":"Test Place","items":["Test Item"],"rating":5,"orderTotal":"$10.00"}'
```

## Monitoring

Monitor your worker in the Cloudflare dashboard:
- Analytics and metrics
- Error logs
- Performance insights
- KV storage usage

## Security Considerations

- CORS enabled for all origins (customize as needed)
- Rate limiting to prevent abuse
- Input validation for all endpoints
- No sensitive data stored in plain text

## Scaling

The worker automatically scales based on demand:
- No server management required
- Global edge deployment
- Automatic load balancing
- Pay-per-request pricing model
