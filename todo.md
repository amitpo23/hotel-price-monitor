# Hotel Price Monitor - SaaS Platform TODO

## Phase 1: Database Schema & Backend API
- [x] Design database schema for hotels, scans, scan results, and schedules
- [x] Create hotels table (name, url, location, category, etc.)
- [x] Create scans table (scan configuration, room types, date ranges)
- [x] Create scan_results table (hotel prices, dates, room types, timestamps)
- [x] Create scan_schedules table (cron expression, enabled status, last run)
- [x] Push database migrations
- [x] Create database helper functions for CRUD operations
- [x] Build tRPC procedures for hotel management (create, read, update, delete)
- [x] Build tRPC procedures for scan configuration
- [x] Build tRPC procedures for scan scheduling
- [x] Build tRPC procedures for fetching scan results and statistics

## Phase 2: Hotel Management UI
- [x] Create Hotels page with list view
- [x] Implement add hotel form (name, Booking.com URL, location)
- [x] Implement edit hotel functionality
- [x] Implement delete hotel with confirmation
- [x] Add hotel status indicators (active/inactive)
- [x] Create competitor grouping functionality

## Phase 3: Scan Configuration UI
- [ ] Create Scan Configuration page
- [ ] Build room type selector (Room Only / With Breakfast)
- [ ] Implement date range picker (60 days forward)
- [ ] Add hotel selection for scan
- [ ] Create scan schedule builder (time picker, frequency)
- [ ] Implement save scan configuration

## Phase 4: Price Scanning Engine
- [ ] Build Booking.com scraper with Playwright/Selenium
- [ ] Implement room type filtering logic
- [ ] Add price extraction for different room categories
- [ ] Create background job system for scheduled scans
- [ ] Implement scan execution and result storage
- [ ] Add error handling and retry logic
- [ ] Create scan progress tracking

## Phase 5: Results Dashboard
- [ ] Create Results Dashboard page
- [ ] Build price comparison table view
- [ ] Implement date range filter for historical data
- [ ] Add hotel filter and grouping
- [ ] Create price trend charts (line charts, bar charts)
- [ ] Build market position analysis view
- [ ] Implement insights and recommendations section
- [ ] Add export to Excel functionality
- [ ] Add export to PDF functionality
- [ ] Implement email report sending
- [ ] Create historical statistics view

## Phase 6: Additional Features
- [ ] Add user authentication and authorization
- [ ] Implement role-based access (admin/user)
- [ ] Create notification system for scan completion
- [ ] Add scan history and audit log
- [ ] Implement data retention policies
- [ ] Add system settings page
- [ ] Create help/documentation section

## Phase 7: Testing & Deployment
- [ ] Test hotel CRUD operations
- [ ] Test scan configuration and scheduling
- [ ] Test price scraping with real data
- [ ] Test export functionality (Excel, PDF, Email)
- [ ] Test dashboard charts and filters
- [ ] Verify database performance with large datasets
- [ ] Create checkpoint for deployment
- [ ] Document system usage and setup


## Current Sprint: Scan Configuration Page
- [x] Build complete scan configuration page with form
- [x] Implement target hotel selector
- [x] Implement competitor hotels multi-select
- [x] Add room type checkboxes (Room Only / With Breakfast)
- [x] Add days forward input (default 60)
- [x] Build schedule configuration (cron builder or time picker)
- [x] Display list of existing scan configurations
- [x] Add edit/delete functionality for scan configs
- [x] Test scan configuration creation and editing


## Current Sprint: Excel Export Functionality
- [x] Install ExcelJS library for Excel generation
- [x] Create backend API endpoint for Excel export
- [x] Build Excel file with multiple sheets (summary, per-hotel data)
- [x] Add formatting and styling to Excel output
- [x] Create download button in Results page
- [x] Test Excel export with sample data


## Current Sprint: Price Scanning Engine
- [x] Install Playwright for browser automation
- [x] Create TypeScript script for Booking.com scraping
- [x] Implement date range iteration (60 days forward)
- [x] Extract prices for room types (room only / with breakfast)
- [x] Handle availability detection
- [x] Add error handling and retries
- [x] Create scan service to orchestrate scraping
- [x] Integrate scanning with tRPC API
- [x] Add "Run Scan Now" button in UI
- [x] Test end-to-end scanning flow


## Bug Fixes
- [x] Fix NaN error in scanConfigId when creating scan configuration
- [x] Ensure insertId is properly extracted from database insert result


## Current Sprint: Real-time Progress & Email Reports
- [x] Add polling mechanism to track scan progress in real-time
- [x] Create progress bar component showing completed/total hotels
- [x] Display scan status (running/completed/failed) in UI
- [x] Improve scraper to detect breakfast inclusions from page content
- [x] Parse room type descriptions to identify breakfast automatically
- [x] Add email sending functionality using SMTP
- [x] Create email template with scan summary and Excel attachment
- [x] Integrate email sending with scan completion
- [x] Add email configuration settings (recipient, schedule)
- [x] Test complete flow: scan → progress → email delivery


## Current Sprint: Price Trend Visualizations
- [x] Install Recharts library for data visualization
- [x] Create line chart component for price trends over time
- [x] Add separate charts for room types (room only vs with breakfast)
- [x] Implement hotel comparison in charts (target vs competitors)
- [x] Add interactive tooltips showing exact prices on hover
- [x] Create legend with color coding for each hotel
- [x] Update Results page to display charts alongside data table
- [x] Test charts with real scan data


## Bug Fixes - Critical
- [x] Fix action buttons not working in Scan Configs table (Run, Edit, Delete) - Fixed by recreating configs
- [x] Debug why mutations are not triggering - Working correctly now
- [x] Check tRPC router connections - All connections verified
- [x] Test complete scan flow end-to-end - Successfully tested: create config → run scan → view progress
- [x] Verify database operations are working - All CRUD operations working
- [x] Test edit functionality for scan configurations - Working


## Bug Fix: Scraper Price Extraction
- [x] Debug why scraper is not extracting prices correctly
- [x] Test Booking.com page structure manually
- [x] Update price selectors to match current Booking.com HTML
- [x] Add proper waits for dynamic content loading
- [x] Improve price parsing logic
- [x] Test with real hotel URLs
- [x] Run full scan to verify price collection works - SUCCESS!
- [x] Fix scraper to match current Booking.com HTML structure
- [x] Test with real Scarlet Tel Aviv URL  
- [x] Run new scan with Python scraper to verify it works - SUCCESS!


## Critical Fix: Use Python Scraper (Original Working Approach)
- [x] Create Python scraper script using Playwright (like the original working version)
- [x] Add Node.js wrapper to call Python script from server
- [x] Test Python scraper standalone to verify it works - SUCCESS! Found prices: ₪99-113
- [x] Integrate Python scraper with scan service
- [x] Run full scan and verify prices are collected successfully - WORKING! Shows 60 dates, ₪99-113 prices, charts, and tables

## Bug Fix: Missing Python Scraper File
- [x] Recreate scraper_v5.py in project directory (file was lost from previous session)
- [x] Verify scraper works with current project structure
- [x] Test end-to-end scan flow


## New Feature: Visual Monitoring Dashboard
- [x] Create Monitoring page with real-time metrics display
- [x] Add charts for system health, scan performance, and error rates
- [x] Display live logs with filtering and search
- [x] Add refresh mechanism for real-time updates
- [x] Integrate with monitoring API endpoints


## Critical Bug: Scans Running But No Results
- [x] Investigate why 18 scans completed but 0 results stored
- [x] Check scraper logs for errors
- [x] Verify Python scraper is being called correctly
- [x] Fix __dirname issue in ES modules
- [x] Fix Python version mismatch (use python3.11 instead of python3)


## Bug: python3.11 not found in runtime
- [x] Revert to python3 command (python3.11 only exists in dev sandbox)
- [x] Ensure Playwright is installed in runtime environment
- [x] Test scan with python3 and verify it works - SUCCESS! ₪502, ₪458


## Workaround: Direct Database Scraper
- [ ] Create standalone script that scrapes and inserts to DB directly
- [ ] Run script and verify results appear in Results page
- [ ] Fix the main scan service to work properly


## Bug: Results Page Not Displaying Data
- [x] Results exist in database (scan 300006 has 7 results) but not shown in UI
- [x] Investigate Results page query logic - Found: selectedConfigId starts empty
- [x] Fix the display issue - Auto-select first config on load


## Critical: Python Not Available in Production
- [ ] Add nixpacks.toml to install Python 3.11 in production
- [ ] Install Playwright and dependencies in production
- [ ] Ensure scraper works in Docker container environment


## Workaround: Replace Python with Node.js Scraper
- [x] Create Node.js scraper using Playwright (avoid Python dependency)
- [x] Update scanService to call Node.js scraper instead of Python
- [x] Reverted to Python scraper for Railway deployment

## Railway Deployment
- [x] Save checkpoint with Python scraper
- [x] Push to GitHub
- [ ] Deploy to Railway
- [ ] Configure environment variables
- [ ] Test scraper in production


## New Features Added by User (7,873 lines of code)
- [x] AI Chat System (AIChat.tsx + ai.ts router - 1,088 lines)
  - [x] Chat interface with conversation history
  - [x] Message storage in database
  - [x] AI-powered pricing analysis
  - [x] Natural language queries
- [x] Pricing Dashboard (PricingDashboard.tsx + pricing.ts router - 476 lines)
  - [x] AI-powered price recommendations
  - [x] Market analysis and positioning
  - [x] Competitor comparison charts
  - [x] Pricing alerts system
  - [x] Revenue optimization insights
- [x] Advanced Scraper Engine (ScraperEngine.ts - 526 lines)
  - [x] Inspired by changedetection.io architecture
  - [x] Proxy rotation support
  - [x] Browser steps automation
  - [x] Retry logic with exponential backoff
  - [x] Screenshot capabilities
  - [x] JSON extraction
  - [x] Change detection
- [x] OnlyNight API Integration (onlyNightApi.ts - 281 lines)
  - [x] Instant price search
  - [x] Room archive data retrieval
  - [x] Authentication handling
  - [x] Token refresh mechanism
- [x] Database Schema Extensions
  - [x] chatConversations table
  - [x] chatMessages table
  - [x] priceRecommendations table
  - [x] pricingAlerts table
  - [x] scraperConfigs table (for advanced scraper)

## Bug Fixes - TypeScript Errors
- [x] Fixed pricing.ts type errors (any types for reduce functions)
- [x] Fixed advancedScanService.ts enum value (snapshotType)
- [x] Fixed PricingDashboard.tsx tRPC endpoint (getScanConfigs → configs.list)

## System Fixes
- [x] Fixed "EMFILE: too many open files" error by adding polling mode to vite.config.ts
- [x] Server now runs successfully with watch mode

## Next Steps
- [ ] Test AI Chat with real queries
- [ ] Test Pricing Dashboard with scan data
- [ ] Test Advanced Scraper Engine
- [ ] Test OnlyNight API integration
- [ ] Save checkpoint with all new features
- [ ] Deploy to Railway


## 🎯 Critical Features Implementation (User Request)

### 1. Calendar View (תצוגת לוח שנה)
- [x] Create calendar component with date grid
- [x] Display prices for each date
- [x] Color coding by competitiveness (green=competitive, red=expensive)
- [x] Inline price editing from calendar
- [x] Month/week/day views
- [x] Competitor prices overlay
- [x] Quick actions (copy prices, apply template)

### 2. Revenue Management Dashboard
- [x] Calculate and display KPIs:
  - [x] RevPAR (Revenue Per Available Room)
  - [x] ADR (Average Daily Rate)
  - [x] Occupancy Rate
- [x] Revenue forecasting charts
- [x] Period comparison (YoY, MoM, WoW)
- [x] Break-even analysis
- [x] Revenue optimization suggestions

### 3. Dynamic Pricing Engine
- [x] Create pricing rules engine
- [x] Demand-based pricing algorithm
- [x] Competitor-based pricing algorithm
- [x] Time-based pricing rules
- [x] Automated price updates
- [x] Price change history tracking
- [x] Manual override capabilities
- [x] Pricing strategy templates

### 4. Demand Forecasting
- [ ] Collect historical occupancy data
- [ ] ML model for demand prediction
- [ ] Seasonality analysis
- [ ] Local events integration
- [ ] Price recommendations based on forecast
- [ ] Confidence intervals for predictions
- [ ] Forecast accuracy tracking

### 5. Competitor Intelligence
- [ ] Real-time price change alerts
- [ ] Competitor pricing strategy analysis
- [ ] Market positioning score calculation
- [ ] Price gap analysis
- [ ] Competitive advantage indicators
- [ ] Alert notification system

### 6. Rate Parity Monitoring
- [ ] Multi-platform price scraping (Booking, Expedia, Direct)
- [ ] Rate parity violation detection
- [ ] Automated alerts for discrepancies
- [ ] Platform comparison dashboard

### 7. Bulk Price Updates
- [ ] Bulk price update UI
- [ ] Pricing templates system
- [ ] Rule-based automatic updates
- [ ] Date range selection
- [ ] Preview before apply
- [ ] Rollback functionality

### 8. Guest Segmentation
- [ ] Guest type classification (business, leisure, families)
- [ ] Segment-specific pricing
- [ ] Special rates management
- [ ] Segment performance analytics

### 9. Cancellation Policy Optimizer
- [ ] Policy impact analysis
- [ ] Revenue vs risk calculator
- [ ] Policy recommendations
- [ ] A/B testing framework

### 10. Integration Hub
- [ ] PMS integration framework
- [ ] Channel Manager integration
- [ ] Webhook system for price changes
- [ ] API documentation

## 🚀 Advanced Features (Nice to Have)

### 11. Multi-Property Management
- [ ] Multi-hotel selector
- [ ] Cross-property comparison
- [ ] Consolidated reporting
- [ ] Property groups

### 12. API for External Systems
- [ ] REST API endpoints
- [ ] Webhook notifications
- [ ] API authentication
- [ ] Rate limiting
- [ ] API documentation

### 13. Advanced Analytics
- [ ] Cohort analysis
- [ ] Funnel analysis
- [ ] Attribution modeling
- [ ] Custom metrics builder

### 14. Automated Reporting
- [ ] Weekly/monthly report scheduler
- [ ] Custom report builder
- [ ] Export to PowerPoint/PDF
- [ ] Email distribution

## 🎨 UX Improvements

- [ ] Onboarding wizard for new users
- [ ] Dashboard customization
- [ ] Dark/Light mode toggle
- [ ] Keyboard shortcuts
- [ ] Bulk actions UI
- [ ] Improved mobile responsiveness


## 🔬 Advanced Features (Current Implementation)

### ML Demand Forecasting
- [x] Build linear regression model for demand prediction
- [x] Train on historical occupancy data
- [x] Integrate with pricing engine
- [x] Confidence intervals for predictions
- [x] Seasonal adjustment factors
- [x] Event detection and impact

### Competitor Intelligence Dashboard
- [x] Real-time competitor price monitoring
- [x] Price change alerts
- [x] Market positioning analysis
- [x] Competitor strategy detection
- [x] Price gap visualization
- [x] Alert management UI

### A/B Testing for Pricing Rules
- [x] Create A/B test framework
- [x] Split traffic between rule variants
- [x] Track revenue impact
- [x] Statistical significance testing
- [x] Test results dashboard
- [x] Winner selection and rollout
