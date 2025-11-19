// Privacy Policy API endpoint
// Serves the privacy policy as HTML for Chrome Web Store compliance

export async function getPrivacyPolicy(_request, _env) {
  const privacyPolicyHTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>LanchDrap Privacy Policy</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f5f5f5;
    }
    .container {
      background: white;
      padding: 40px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    h1 {
      color: #2c3e50;
      border-bottom: 3px solid #3498db;
      padding-bottom: 10px;
    }
    h2 {
      color: #34495e;
      margin-top: 30px;
    }
    h3 {
      color: #555;
      margin-top: 20px;
    }
    p {
      margin: 15px 0;
    }
    ul {
      margin: 15px 0;
      padding-left: 30px;
    }
    li {
      margin: 8px 0;
    }
    .last-updated {
      color: #7f8c8d;
      font-style: italic;
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #ecf0f1;
    }
    .contact {
      background: #ecf0f1;
      padding: 15px;
      border-radius: 5px;
      margin-top: 20px;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>LanchDrap Privacy Policy</h1>
    
    <p><strong>Last Updated:</strong> ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
    
    <p>This Privacy Policy describes how LanchDrap ("we", "our", or "us") collects, uses, and protects your information when you use our Chrome extension.</p>
    
    <h2>1. Information We Collect</h2>
    
    <h3>1.1 Personally Identifiable Information</h3>
    <p>We collect the following personally identifiable information:</p>
    <ul>
      <li><strong>User ID:</strong> Your LunchDrop.com user ID (numeric identifier) extracted from the LunchDrop.com website. This is used to associate your ratings and order history with your account.</li>
    </ul>
    
    <h3>1.2 Website Content</h3>
    <p>We read and process content from LunchDrop.com pages that you are viewing, including:</p>
    <ul>
      <li>Restaurant names and identifiers</li>
      <li>Menu items and descriptions</li>
      <li>Order details (items, quantities, prices)</li>
      <li>Restaurant availability status</li>
      <li>Restaurant colors and logos</li>
    </ul>
    
    <h3>1.3 User Activity</h3>
    <p>We track the following user activities:</p>
    <ul>
      <li>Rating submissions (1-5 stars with optional comments)</li>
      <li>Order history and associated ratings</li>
      <li>Restaurant viewing patterns</li>
      <li>Timestamps of ratings and orders</li>
    </ul>
    
    <h2>2. How We Use Your Information</h2>
    
    <p>We use the collected information for the following purposes:</p>
    <ul>
      <li><strong>User Identification:</strong> Your user ID is used to store and retrieve your personal rating history and order data.</li>
      <li><strong>Rating Functionality:</strong> Restaurant and order data enable the extension to provide rating and tracking features.</li>
      <li><strong>Personal History:</strong> Ratings and comments are stored to provide you with your personal rating history and restaurant analytics.</li>
      <li><strong>Analytics:</strong> Restaurant information is tracked to provide statistics about restaurant availability and sellout patterns.</li>
    </ul>
    
    <h2>3. Data Storage</h2>
    
    <h3>3.1 Local Storage</h3>
    <p>Your user ID is stored locally in your browser using Chrome's storage API. This data remains on your device and is not transmitted except as described below.</p>
    
    <h3>3.2 Backend Storage</h3>
    <p>The following data is sent to and stored on our Cloudflare Worker backend:</p>
    <ul>
      <li>Ratings (1-5 stars) and comments</li>
      <li>Order history (restaurant names, menu items, order dates)</li>
      <li>Restaurant tracking data (appearances, sellout status)</li>
    </ul>
    <p>All data is associated with your LunchDrop.com user ID and stored securely using Cloudflare's infrastructure.</p>
    
    <h2>4. Data Sharing</h2>
    
    <p>We do not share, sell, or rent your personal information to third parties. Your data is only used to provide the extension's core functionality (rating and tracking features).</p>
    
    <h2>5. Data Security</h2>
    
    <p>We implement appropriate technical and organizational measures to protect your data:</p>
    <ul>
      <li>Data is transmitted over HTTPS</li>
      <li>Data is stored securely using Cloudflare's infrastructure</li>
      <li>Access to data is restricted to the extension's functionality</li>
    </ul>
    
    <h2>6. Your Rights</h2>
    
    <p>You have the right to:</p>
    <ul>
      <li><strong>Access:</strong> Request access to your personal data stored by the extension</li>
      <li><strong>Deletion:</strong> Request deletion of your data by uninstalling the extension and contacting us to remove backend data</li>
      <li><strong>Correction:</strong> Update or correct your ratings and comments through the extension interface</li>
    </ul>
    
    <h2>7. Third-Party Services</h2>
    
    <p>Our extension integrates with:</p>
    <ul>
      <li><strong>LunchDrop.com:</strong> We read data from LunchDrop.com pages that you are viewing. We are not affiliated with LunchDrop.com.</li>
      <li><strong>Cloudflare:</strong> We use Cloudflare Workers and KV storage to host our backend API and store your data.</li>
    </ul>
    
    <h2>8. Children's Privacy</h2>
    
    <p>Our extension is not intended for users under the age of 13. We do not knowingly collect personal information from children under 13.</p>
    
    <h2>9. Changes to This Privacy Policy</h2>
    
    <p>We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last Updated" date.</p>
    
    <h2>10. Contact Us</h2>
    
    <div class="contact">
      <p>If you have any questions about this Privacy Policy, please contact us:</p>
      <ul>
        <li><strong>GitHub:</strong> <a href="https://github.com/kayluhb/lanchdrap" target="_blank">https://github.com/kayluhb/lanchdrap</a></li>
      </ul>
    </div>
    
    <div class="last-updated">
      <p>This privacy policy is effective as of ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}.</p>
    </div>
  </div>
</body>
</html>`;

  return new Response(privacyPolicyHTML, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=UTF-8',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
