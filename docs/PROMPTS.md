# User Prompts - LunchDrop Rating Extension Project

This document contains all the prompts and requests made during the development of the LunchDrop Rating Extension and Cloudflare Worker project.

## Initial Project Request

**Prompt 1:**
```
I want to create a chrome extension and cloudflare worker that allows users to rate lunch drop orders when they're on the lunchdrop website
```

## Package Manager and Tooling

**Prompt 2:**
```
can you switch it to use pnpm
```

**Prompt 3:**
```
install the latest biome (2.2.2) and configure this to use husky and lint-staged for formatting.
```

## Feature Enhancements

**Prompt 4:**
```
store stats in the cloudflare worker
```

**Prompt 5:**
```
track whether or not a restaurant sells out and how frequently they appear on lunchdrop.
```

**Prompt 6:**
```
the URLs of the site are in this format @https://austin.lunchdrop.com/app/2025-09-04 track the daily counts and daily sales using that
```

**Prompt 7:**
```
does lunchdrop have an API available?
```

**Prompt 8:**
```
I don't want to track other cities, this will only be used by a single office.
```

## Configuration Updates

**Prompt 9:**
```
update the KV to be LANCHDRAP_RATINGS
```

**Prompt 10:**
```
the setup command is actually wrangler kv namespace create LANCHDRAP_RATINGS
```

**Prompt 11:**
```
update the URLs to @  https://lunchdrop-ratings.caleb-brown.workers.dev
```

## Extension Management

**Prompt 12:**
```
do I need to do something to get the extension to reload in chrome?
```

## UI and Styling Issues

**Prompt 13:**
```
these styles are overwriting the entire site's styles. can they be namespaced to the extension
```

**Prompt 14:**
```
add rating information for each restaurant
```

## URL and Date Handling

**Prompt 15:**
```
if there's no date in the URL, e.g. it's just /app that means it's today
```

**Prompt 16:**
```
the restaurant name appears in this element can you track that too? //*[@id="app"]/div[1]/div[2]/div[2]/div[6]/div/div/div/div[1]
```

**Prompt 17:**
```
display the number of times we've seen it appear and the number of times it sold out there
```

## Visual Indicators and Status Detection

**Prompt 18:**
```
the orange border indicates it's currently selected
```

**Prompt 19:**
```
sold out restaurants have the text SOLD OUT in the link
```

## Error Reports and Debugging

**Prompt 20:**
```
content.js:914 Uncaught SyntaxError: Unexpected token 'async' (at content.js:914:3)
```

**Prompt 21:**
```
content.js:928 Uncaught SyntaxError: Unexpected token '}' (at content.js:928:1)
```

## UI Enhancements

**Prompt 22:**
```
In the rate your order popup, add the restaurant name
```

## Data Accuracy Issues

**Prompt 23:**
```
Cava is not displaying as sold out in our scraped data even though it is.
```

**Prompt 24:**
```
the sold out state is when there's text in the link that says SOLD OUT
```

## User Experience Improvements

**Prompt 25:**
```
when submitting, disable the button
```

**Prompt 26:**
```
check to see if someone has rated it already and don't display the poppu
```

**Prompt 27:**
```
ratings are for restaurant and what was ordered
```

## Technical Issues

**Prompt 28:**
```
LunchDrop Rating Extension: Detected LunchDrop rating prompt for: Tex Mex Joe's
content.js:466 LunchDrop Rating Extension: Utilities not loaded, will check for rating later
content.js:834 Extension utilities not loaded yet, skipping sellout status report
site.webmanifest?v=vMOKQro44G:1 Manifest: property 'start_url' ignored, should be same origin as document.Understand this warning
content.js:84 LunchDrop Rating Extension: Found restaurant name: Chi'lantro
content.js:101 LunchDrop Rating Extension: Order data extracted: {restaurant: "Chi'lantro", items: Array(71), total: '$0.00', orderId: 'Daily LunchdropTecovas'}
content.js:198 Extension utilities not loaded yet, skipping rating check
content.js:774 Extension utilities not loaded yet, skipping availability summary
content.js:679 LunchDrop Rating Extension: Scraped availability data: (6) [{…}, {…}, {…}, {…}, {…}, {…}]
installHook.js:1 Google Maps JavaScript API warning: RetiredVersion https://developers.google.com/maps/documentation/javascript/error-messages#retired-version
overrideMethod @ installHook.js:1
Sva @ util.js:31
(anonymous) @ js?libraries=places&key=AIzaSyCEM42j_vbtCojG4LZaQUiRHmQU48McS1g&v=3.31:1415
Promise.then
(anonymous) @ js?libraries=places&key=AIzaSyCEM42j_vbtCojG4LZaQUiRHmQU48McS1g&v=3.31:1415
setTimeout
cda @ js?libraries=places&key=AIzaSyCEM42j_vbtCojG4LZaQUiRHmQU48McS1g&v=3.31:1415
google.maps.Load @ js?libraries=places&key=AIzaSyCEM42j_vbtCojG4LZaQUiRHmQU48McS1g&v=3.31:1415
(anonymous) @ js?libraries=places&key=AIzaSyCEM42j_vbtCojG4LZaQUiRHmQU48McS1g&v=3.31:1415
(anonymous) @ js?libraries=places&key=AIzaSyCEM42j_vbtCojG4LZaQUiRHmQU48McS1g&v=3.31:1415Understand this warning
```

**Prompt 29:**
```
the utilities never load
```

## Documentation Request

**Prompt 30:**
```
can you write every prompt I made to a docs/PROMPTS.md file?
```

---

## Summary

This project evolved from a simple rating system to a comprehensive restaurant tracking and analytics platform. The prompts show a progression from basic functionality to advanced features including:

- Restaurant availability tracking
- Sellout detection and analytics
- User rating history and statistics
- Date-based URL handling
- Visual indicator interpretation
- Error handling and debugging
- UI/UX improvements
- Technical configuration updates

The development process involved iterative refinement based on user feedback and real-world testing on the LunchDrop platform.
