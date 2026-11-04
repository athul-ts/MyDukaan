# 📌 Countdown Timer + Analytics — Shopify App Sample Project PRD

Source: https://helixo.notion.site/Countdown-Timer-Analytics-Shopify-App-Sample-Project-PRD-bfad1acb2d764be29a2a167aed1305ed

## 1. Introduction

- **Purpose of the Document:** This document outlines the product requirements for a Shopify app that allows merchants to add a countdown timer for special promotions and discounts on their product pages.
- **Intended Audience:** This document is intended for the development team, project manager, and stakeholders involved in the development of the discount countdown timer Shopify app.
- **Project Scope:** The scope of this project is to develop a Shopify app that allows merchants to create and display countdown timers for promotions and discounts on their product pages.

## 2. Overall Description

- **Product Perspective:** The product is a standalone Shopify app.
- **Product Features:** The app will allow merchants to create different countdown timers for promotions and discounts.
- **User Classes and Characteristics:** The primary users of this app are Shopify merchants who want to create urgency and encourage customers to make purchases by displaying a countdown timer for special promotions.
- **Operating Environment:** The app will operate within the Shopify platform and will interact with the merchant's Shopify admin panel and storefront.
- **Design and Implementation Constraints:** The app must be developed using the MERN stack and Shopify CLI 3.0 and use latest Shopify polaris UI components and guidelines

## 3. User Stories

- As a merchant, I want to create countdown timers with start/end dates so promotions activate automatically.
- As a merchant, I want to create evergreen timers (user-session based, resets per visitor) for persistent urgency.
- As a merchant, I want to assign timers to specific products, collections, or all products.
- As a merchant, I want to customize timer appearance (colors, position, text) to match my brand.
- As a merchant, I want to see basic analytics (impressions count) for my timers.
- As a merchant, I want visual urgency cues when timers are close to expiring.

## 4. System Features

### 4.1 Timer Types (Required)

- **Fixed Timer:** Specific start and end datetime (all users see same countdown)
- **Evergreen Timer:** Session-based timer that starts when user first visits (stored in localStorage), resets after expiry or session end

### 4.2 Timer Targeting

- Apply timer to: All products / Specific products / Specific collections
- Use Shopify Resource Picker for product/collection selection

### 4.3 Data Architecture

Design a MongoDB schema that efficiently handles:

- Multi-tenant data isolation (multiple stores)
- Timer configurations with targeting rules
- Basic analytics tracking (impression counts)

### 4.4 Client-Side App (Admin)

- Dashboard showing all timers with status (active/scheduled/expired)
- Timer creation/edit form with validation
- Product/Collection picker integration
- Basic analytics display per timer

### 4.5 Widget-Side App (Storefront)

- Lightweight Preact widget (~15KB max gzipped target)
- Efficient polling/caching strategy for timer data
- Handle edge cases: expired timers, no active timers, network failures
- Smooth countdown animation without layout shifts

The widget-side app will fetch the timer's JSON data from the server and display the countdown timer prominently on the product page.

### 4.6 API Design

Design RESTful APIs with:

- Proper error handling and HTTP status codes
- Input validation and sanitization
- Rate limiting consideration (document your approach)

## 5. Technical Requirements

### 5.1 Architecture

- Use Theme App Extension (not ScriptTag)
- Widget should load timer config via a single optimized API call
- Implement proper caching headers for timer data
- Document your architecture decisions in a brief README section

### 5.2 Code Quality (Mandatory)

- **javascript:** Use javascript for at least the backend
- **Testing:** Minimum 5 meaningful unit tests covering critical business logic
- **Error Handling:** Graceful degradation—widget should never break the storefront
- **Linting:** ESLint configuration with consistent code style

### 5.3 Performance Requirements

- Widget bundle: Target <30KB gzipped
- API response time: <200ms for timer fetch
- No Cumulative Layout Shift (CLS) from timer injection
- Document any performance optimizations made

### 5.4 Security Requirements

- Validate shop ownership on all API calls
- Sanitize all user inputs (XSS prevention)
- No sensitive data exposure in client-side code

## 6. Wireframes

Refer to the wireframe diagram of the app working model (embedded Figma file: https://www.figma.com/file/8tJ1nbL9Hv0GLUJqj5oiNQ):

*Wireframe image removed. Described in [05-widget.md](05-widget.md#wireframe-reference).*

Admin panel reference screenshot:

*Admin screenshot removed. Described in [06-admin.md](06-admin.md#mockup-reference).*

## 7. Deliverables

- GitHub Repository with:
  - Clean commit history showing progression
  - README with: setup instructions, architecture decisions, assumptions made
  - Brief documentation of API endpoints
- Loom Video (10-15 min) demonstrating:
  - App functionality walkthrough
  - Code architecture explanation
  - Discussion of trade-offs and what you'd improve with more time

## 8. Timeline

- **Duration:** 48hrs days from assignment
- Submit before deadline with GitHub link and Loom video to HR contact.

## 9. Prerequisite Setup for Shopify App

To set up the Shopify app, please follow these steps:

1. Create a Shopify Partners account by visiting the Shopify Partners website (https://www.shopify.com/partners).
2. Once you have created your Shopify Partners account, log in and navigate to the "Apps" section.
3. Click on "Create App" to create a new Shopify app.
   - Fill in the required information for your app, including the app name, developer email, and URL.
4. After creating the app, you will receive API keys and credentials that will be used for authentication and API access.
5. Also, create a new development store from the partners' dashboard and import a few products to be displayed in the store.
   - Sample products CSV link: https://github.com/shopifypartners/product-csvs/blob/master/home-and-garden.csv
6. Use Shopify CLI 3.0 to set up the project locally for your Shopify app.
7. Refer to Shopify developer docs for tutorials or API docs: https://shopify.dev/docs
8. Create the app using Shopify CLI and use Shopify's official node-express template:
   - How to use custom templates with CLI: https://shopify.dev/docs/apps/tools#app-templates
   - Direct link to template: https://github.com/Shopify/shopify-app-template-node

**NOTE:** Never miss the deadlines, submit it before the deadline and inform your HR Manager.

> "Don't make excuses for why you can't get it done. Focus on all the reasons why you must make it happen." ― Ralph Marston

Its not about perfection, but what are you learning from this short time frame

Happy Hacking!
