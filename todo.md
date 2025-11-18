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
